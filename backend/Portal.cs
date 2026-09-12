using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Npgsql;

namespace Andrade;
public record RequestInput(string Name, string Email, string Phone, string ServiceId, string Message, string Mode, string? AppointmentAt, bool Consent, string IdempotencyKey, string TrackingToken, string? Website = null);
public sealed partial class Portal(Database db, EmailService email, NotificationSecrets secrets)
{
    public static readonly string[] Statuses = ["recibido", "revision", "aprobado", "pendiente_pago", "confirmado", "completado", "cancelado"];
    public Task<JsonNode?> Settings() => db.Json("SELECT data FROM andrade_portal.settings WHERE id=true");
    public Task<JsonNode?> Content(string kind, bool admin = false) => db.Json("SELECT COALESCE(jsonb_agg(data || jsonb_build_object('id',id,'active',active,'sortOrder',sort_order,'createdAt',created_at) ORDER BY sort_order,id),'[]'::jsonb) FROM andrade_portal.content WHERE kind=@kind AND (@admin OR active)", ("kind", kind), ("admin", admin));
    public async Task<JsonNode> PublicSettings() { var s = (await Settings())!.DeepClone().AsObject(); foreach (var key in new[] { "senderEmail", "notificationEmail", "publicSiteUrl", "bankInstructions" }) s.Remove(key); return s; }
    public async Task<object> Public() => new { settings = await PublicSettings(), services = await Content("services"), promotions = await Content("promotions"), education = await Content("education"), achievements = await Content("achievements"), gallery = await Content("gallery"), cases = await Content("cases") };
    public async Task<object> Posts(int offset = 0, int limit = 6, string? category = null, string? search = null) { offset = Math.Clamp(offset, 0, 100000); limit = Math.Clamp(limit, 1, 12); var all = await db.Json("SELECT COALESCE(jsonb_agg(row),'[]'::jsonb) FROM (SELECT data || jsonb_build_object('id',id,'createdAt',created_at) AS row FROM andrade_portal.content WHERE kind='posts' AND active AND (@category='' OR data->>'category'=@category) AND (@q='' OR data->>'title' ILIKE @pattern OR data->>'summary' ILIKE @pattern) ORDER BY sort_order,id LIMIT @limit OFFSET @offset) x", ("category", category ?? ""), ("q", search ?? ""), ("pattern", "%" + (search ?? "").Replace("%", "\\%").Replace("_", "\\_") + "%"), ("limit", limit + 1), ("offset", offset)); var items = all!.AsArray(); var more = items.Count > limit; if (more) items.RemoveAt(items.Count - 1); return new { items, hasMore = more, nextOffset = offset + items.Count }; }
    public async Task<string[]> Slots(string date)
    {
        if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", out var day)) throw new PortalException("Elige una fecha válida."); var now = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)); if (day < DateOnly.FromDateTime(now.Date) || day > DateOnly.FromDateTime(now.Date).AddDays(60)) return [];
        var s = (await Settings())!; var weekdays = s["weekdays"]!.AsArray().Select(v => v!.GetValue<int>()); if (!weekdays.Contains((int)day.DayOfWeek) || s["closedDates"]!.AsArray().Any(d => d!.ToString() == date)) return [];
        var booked = (await db.Json("SELECT COALESCE(jsonb_agg(to_char(appointment_at AT TIME ZONE 'America/Guayaquil','YYYY-MM-DD HH24:MI')),'[]'::jsonb) FROM andrade_portal.requests WHERE appointment_at IS NOT NULL AND status NOT IN ('cancelado','completado') AND (appointment_at AT TIME ZONE 'America/Guayaquil')::date=@date::date", ("date", date)))!.AsArray().Select(d => d!.ToString()).ToHashSet();
        return Enumerable.Range(s["startHour"]!.GetValue<int>(), s["endHour"]!.GetValue<int>() - s["startHour"]!.GetValue<int>()).Select(h => $"{date}T{h:00}:00:00-05:00").Where(v => DateTimeOffset.Parse(v) > now.AddHours(1) && !booked.Contains(v[..10] + " " + v.Substring(11, 5))).ToArray();
    }
    public async Task<object> CreateRequest(RequestInput input, SolidarityInput? solidarity = null)
    {
        if (!string.IsNullOrWhiteSpace(input.Website)) throw new PortalException("Solicitud no válida.");
        Validate.Text(input.Name, 2, 100, "nombre"); Validate.Text(input.Phone, 7, 25, "teléfono"); if (!Regex.IsMatch(input.Phone, @"^\+?[\d\s()\-]{7,25}$")) throw new PortalException("Revisa tu teléfono.");
        if (string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 200 || !System.Net.Mail.MailAddress.TryCreate(input.Email, out _)) throw new PortalException("Indica un correo válido para recibir el enlace privado y las novedades.");
        Validate.Text(input.Message, 10, 3000, "resumen"); if (!input.Consent) throw new PortalException("Debes aceptar el tratamiento de datos para enviar la solicitud."); if (!new[] { "presencial", "virtual" }.Contains(input.Mode)) throw new PortalException("Selecciona una modalidad válida.");
        if (!Guid.TryParse(input.IdempotencyKey, out var idem) || !Regex.IsMatch(input.TrackingToken ?? "", @"^[a-f0-9]{64}$")) throw new PortalException("Recarga el formulario antes de enviar.");
        var trackingHash = Auth.Hash(input.TrackingToken!);
        var previous = await db.Json("SELECT jsonb_build_object('reference',reference,'status',status,'appointmentAt',appointment_at) FROM andrade_portal.requests WHERE idempotency_key=@key AND tracking_hash=@hash", ("key", idem), ("hash", trackingHash)); if (previous != null) return previous;
        if (solidarity == null && input.ServiceId != "general" && (await Content("services"))!.AsArray().All(s => s!["id"]!.ToString() != input.ServiceId)) throw new PortalException("Selecciona un servicio disponible.");
        DateTimeOffset? appointment = null; if (!string.IsNullOrWhiteSpace(input.AppointmentAt)) { if (!DateTimeOffset.TryParse(input.AppointmentAt, out var parsed)) throw new PortalException("Horario no válido."); appointment = parsed.ToUniversalTime(); var date = parsed.ToOffset(TimeSpan.FromHours(-5)).ToString("yyyy-MM-dd"); if (!(await Slots(date)).Any(slot => DateTimeOffset.Parse(slot) == parsed)) throw new PortalException("Este horario ya no está disponible. Elige otro.", 409); }
        var id = Guid.NewGuid(); var reference = "AA-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(6));
        var settings = (await Settings())!;
        var needsPayment = input.Mode == "virtual" && appointment != null;
        var paymentTest = settings["paymentTestMode"]?.GetValue<bool>() ?? true;
        var amount = settings["virtualFee"]?.GetValue<decimal>() ?? 0;
        var instructions = settings["bankInstructions"]?.ToString() ?? "";
        if (needsPayment && !paymentTest && (amount <= 0 || instructions.Length < 10)) throw new PortalException("El despacho debe completar los datos de pago. Puedes contactar por WhatsApp.", 409);
        var initialStatus = needsPayment ? "pendiente_pago" : "recibido";
        await using var c = await db.Source.OpenConnectionAsync(); await using var tx = await c.BeginTransactionAsync(); try
        {
            var solidarityPeriod = solidarity != null ? await PrepareSolidarity(c, solidarity) : null;
            await using (var cmd = Database.Command(c, "INSERT INTO andrade_portal.requests(id,reference,tracking_hash,idempotency_key,name,email,phone,service_id,message,mode,appointment_at) VALUES(@id,@ref,@hash,@key,@name,@email,@phone,@service,@message,@mode,@at)", ("id", id), ("ref", reference), ("hash", trackingHash), ("key", idem), ("name", input.Name.Trim()), ("email", input.Email.Trim()), ("phone", input.Phone.Trim()), ("service", input.ServiceId), ("message", input.Message.Trim()), ("mode", input.Mode), ("at", appointment))) { await cmd.ExecuteNonQueryAsync(); }
            await using (var cmd = Database.Command(c, "INSERT INTO andrade_portal.request_events(request_id,status,note) VALUES(@id,'recibido','Solicitud recibida. El despacho revisará los datos y confirmará los siguientes pasos.')", ("id", id))) { await cmd.ExecuteNonQueryAsync(); }
            await using (var cmd = Database.Command(c, "UPDATE andrade_portal.requests SET tracking_secret=@secret,status=@status,payment_status=@payment,payment_amount=@amount,payment_instructions=@instructions,payment_test=@test WHERE id=@id", ("id", id), ("secret", secrets.Protect(input.TrackingToken!)), ("status", initialStatus), ("payment", needsPayment ? "pendiente" : "no_requerido"), ("amount", needsPayment ? amount : (decimal?)null), ("instructions", needsPayment ? instructions : ""), ("test", needsPayment && paymentTest))) { await cmd.ExecuteNonQueryAsync(); }
            if (needsPayment) { await using var evt = Database.Command(c, "INSERT INTO andrade_portal.request_events(request_id,status,note) VALUES(@id,'pendiente_pago',@note)", ("id", id), ("note", paymentTest ? "Demostración: no realices transferencias. El despacho debe activar los pagos reales." : "Pendiente de transferencia y verificación del despacho. El horario aún no está confirmado.")); await evt.ExecuteNonQueryAsync(); }
            if (solidarity != null) await InsertSolidarity(c, id, solidarity, solidarityPeriod!);
            await email.Queue(c, id, solidarity == null ? "recibido" : "solidarity_recibido");
            await tx.CommitAsync();
        }
        catch (PostgresException ex) when (ex.SqlState == "23505") { throw new PortalException("El horario acaba de ocuparse o la solicitud ya se envió. Consulta tu seguimiento o elige otro horario.", 409); }
        return new { reference, status = initialStatus, appointmentAt = appointment, notificationStatus = "pending" };
    }
}
public sealed class PortalException(string message, int status = 400) : Exception(message) { public int Status { get; } = status; }
public static class Validate
{
    public static bool MeetingUrl(string raw) => Uri.TryCreate(raw, UriKind.Absolute, out var u) && u.Scheme == "https" && u.Port == 443 && u.UserInfo == "" && (u.Host == "meet.google.com" || u.Host == "zoom.us" || u.Host.EndsWith(".zoom.us", StringComparison.Ordinal)) && u.AbsolutePath.Length > 2 && raw.Length < 1000;
    public static void PremiumSettings(JsonObject s)
    {
        if(s["emailPolicy"] != null && s["emailPolicy"]!.ToString() is not "important" and not "all") throw new PortalException("Selecciona una frecuencia de correo válida.");
        foreach(var pair in s.Where(x => x.Key.StartsWith("home", StringComparison.Ordinal))) Text(pair.Value?.ToString(), 2, 1200, pair.Key);
        foreach (var key in new[] { "assistantName", "introTitle" }) if (s[key] != null) Text(s[key]!.ToString(), 2, 100, key);
        foreach (var key in new[] { "logoUrl", "introPoster", "buildingImage", "profileImage" }) if (!MediaUrl(s[key]?.ToString())) throw new PortalException("Selecciona una imagen de la biblioteca.");
        foreach (var key in new[] { "profileName", "profileSubtitle", "buildingCaption", "solidarityTitle", "solidarityDescription", "solidarityTerms" }) if (s[key] != null) Text(s[key]!.ToString(), 2, 3000, key);
        if (s["solidarityCloseDay"] != null && (!int.TryParse(s["solidarityCloseDay"]!.ToString(), out var closeDay) || closeDay < 1 || closeDay > 28)) throw new PortalException("El día de cierre debe estar entre 1 y 28.");
        var video = s["introVideoUrl"]?.ToString() ?? "";
        if (video != "" && !Regex.IsMatch(video, @"^/api/media/[a-fA-F0-9-]{36}$") && !(SocialUrl(video) && Uri.TryCreate(video, UriKind.Absolute, out var u) && new[] { "youtube.com", "www.youtube.com", "youtu.be" }.Contains(u.Host))) throw new PortalException("Usa un video de la biblioteca o un enlace de YouTube.");
        foreach (var key in new[] { "notificationEmail", "senderEmail" }) if (!string.IsNullOrEmpty(s[key]?.ToString()) && (!System.Net.Mail.MailAddress.TryCreate(s[key]!.ToString(), out var address) || address.Address != s[key]!.ToString() || s[key]!.ToString().Length > 200)) throw new PortalException("Revisa el correo de notificaciones y el remitente.");
        var phone = s["whatsapp"]?.ToString() ?? ""; if (phone != "" && !Regex.IsMatch(phone, @"^\+?[1-9][\d\s-]{7,20}$")) throw new PortalException("WhatsApp debe incluir el código de país.");
        var site = s["publicSiteUrl"]?.ToString() ?? ""; if (site != "" && (!Uri.TryCreate(site, UriKind.Absolute, out var origin) || origin.Scheme != "https" || origin.UserInfo != "" || origin.AbsolutePath != "/" || origin.Query != "" || origin.Fragment != "")) throw new PortalException("Indica la URL HTTPS raíz de la web, sin rutas ni parámetros.");
        if ((s["bankInstructions"]?.ToString().Length ?? 0) > 2000) throw new PortalException("Datos bancarios demasiado largos.");
        if (s["virtualFee"] != null && (!decimal.TryParse(s["virtualFee"]!.ToString(), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var fee) || fee < 0 || fee > 10000)) throw new PortalException("El valor debe estar entre 0 y 10000 USD.");
        if (s["paymentTestMode"]?.GetValue<bool>() == false && ((s["virtualFee"]?.GetValue<decimal>() ?? 0) <= 0 || (s["bankInstructions"]?.ToString().Length ?? 0) < 10 || (s["bankInstructions"]?.ToString() ?? "").Contains("PRUEBA", StringComparison.OrdinalIgnoreCase))) throw new PortalException("Reemplaza los datos de prueba e indica un valor antes de activar pagos reales.");
    }
    public static void Text(string? s, int min, int max, string name) { if (s == null || s.Trim().Length < min || s.Length > max) throw new PortalException($"Revisa el campo {name} ({min}–{max} caracteres)."); }
    public static bool MediaUrl(string? url) => string.IsNullOrEmpty(url) || Regex.IsMatch(url, @"^/images/[a-zA-Z0-9._-]+$") || Regex.IsMatch(url, @"^/api/media/[a-fA-F0-9-]{36}$");
    public static bool SocialUrl(string? raw) { if (string.IsNullOrEmpty(raw)) return true; if (!Uri.TryCreate(raw, UriKind.Absolute, out var u) || u.Scheme != "https") return false; return new[] { "www.instagram.com", "instagram.com", "www.youtube.com", "youtube.com", "youtu.be", "www.tiktok.com", "tiktok.com", "www.linkedin.com", "linkedin.com", "ec.linkedin.com" }.Contains(u.Host); }
    public static void Content(string kind, JsonObject data) { if (kind == "cases" && data["active"]?.GetValue<bool>() == true) { Text(data["outcome"]?.ToString(), 10, 2000, "resultado verificado"); if (data["publicationReviewed"]?.GetValue<bool>() != true) throw new PortalException("Confirma la verificación del resultado y la revisión de confidencialidad antes de publicar."); } Text(data["title"]?.ToString(), 3, 160, "título"); Text(data["summary"]?.ToString(), 5, 400, "resumen"); if ((data["description"]?.ToString().Length ?? 0) > 20000) throw new PortalException("Descripción demasiado larga."); if (!MediaUrl(data["cover"]?.ToString())) throw new PortalException("Sube una imagen desde la biblioteca."); if (kind == "posts") { var type = data["kind"]?.ToString(); if (!new[] { "article", "instagram", "youtube", "tiktok", "linkedin", "video" }.Contains(type)) throw new PortalException("Tipo de publicación no válido."); var url = data["url"]?.ToString(); if (type != "article" && string.IsNullOrWhiteSpace(url)) throw new PortalException("Indica la URL del video o sube un archivo."); if (type == "video" && !Regex.IsMatch(url ?? "", @"^/api/media/[a-fA-F0-9-]{36}$")) throw new PortalException("Selecciona un video de la biblioteca."); if (type != "article" && type != "video" && !SocialUrl(url)) throw new PortalException("Utiliza una URL HTTPS de una red social compatible."); } }
}
