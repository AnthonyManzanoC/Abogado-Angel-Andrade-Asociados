using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Npgsql;

namespace Andrade;

// A stable server-only key is required so queued mail survives redeploys.
public sealed class NotificationSecrets(IConfiguration config)
{
    public static bool ValidKey(string? value)
    {
        try { return Convert.FromBase64String(value ?? "").Length is 16 or 24 or 32; }
        catch (FormatException) { return false; }
    }
    private byte[] Key => Convert.FromBase64String(config["NOTIFICATION_ENCRYPTION_KEY"] ?? throw new PortalException("Falta configurar la protección de notificaciones en el servidor.", 503));
    public string Protect(string plain)
    {
        var nonce = RandomNumberGenerator.GetBytes(12); var bytes = Encoding.UTF8.GetBytes(plain);
        var cipher = new byte[bytes.Length]; var tag = new byte[16];
        using var aes = new AesGcm(Key, 16); aes.Encrypt(nonce, bytes, cipher, tag);
        return Convert.ToBase64String(nonce.Concat(tag).Concat(cipher).ToArray());
    }
    public string Unprotect(string secret)
    {
        var bytes = Convert.FromBase64String(secret); var plain = new byte[bytes.Length - 28];
        var keys = new[] { config["NOTIFICATION_ENCRYPTION_KEY"] ?? "" }.Concat((config["NOTIFICATION_LEGACY_ENCRYPTION_KEYS"] ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        foreach (var key in keys.Where(ValidKey).Distinct())
        {
            try { using var aes = new AesGcm(Convert.FromBase64String(key), 16); aes.Decrypt(bytes.AsSpan(0, 12), bytes.AsSpan(28), bytes.AsSpan(12, 16), plain); return Encoding.UTF8.GetString(plain); }
            catch (CryptographicException) { /* Try an explicitly configured previous key. */ }
        }
        throw new CryptographicException("La clave configurada no permite abrir este aviso.");
    }
}

public sealed partial class EmailService(Database db, IConfiguration config, NotificationSecrets secrets, IHttpClientFactory clients)
{
    private readonly SemaphoreSlim wake = new(0, 1);
    public void Wake() { if (wake.CurrentCount == 0) try { wake.Release(); } catch (SemaphoreFullException) { } }
    public Task<bool> Wait(CancellationToken ct) => wake.WaitAsync(TimeSpan.FromSeconds(1), ct);
    public static bool ShouldNotify(string eventStatus, string audience, string policy) => policy == "all" || eventStatus switch {
        "revision" or "solidarity_revision" or "pago_verificado" => false,
        "pago_revision" => audience == "admin",
        _ => true
    };
    public static string Label(string status) => status switch {
        "solidarity_recibido" => "Postulación solidaria recibida", "solidarity_revision" => "Postulación en revisión", "solidarity_seleccionado" => "Tu caso fue seleccionado para el apoyo mensual", "solidarity_no_seleccionado" => "Tu caso no fue seleccionado en esta convocatoria",
        "actualizacion" => "Nueva comunicación del despacho", "solidarity_actualizacion" => "Novedad de tu apoyo solidario", "pago_verificado" => "Transferencia verificada", "delivery_issue" => "Un aviso al cliente no pudo entregarse",
        "recibido" => "Solicitud recibida", "revision" => "Solicitud en revisión", "aprobado" => "Solicitud aprobada",
        "pendiente_pago" => "Pendiente de pago", "confirmado" => "Cita agendada", "completado" => "Atención completada",
        "cancelado" => "Solicitud cancelada", "pago_revision" => "Transferencia en revisión", _ => "Novedad en tu solicitud" };
    public async Task Queue(NpgsqlConnection c, Guid id, string eventStatus, string? dedupeKey = null, string? onlyAudience = null)
    {
        await using var cmd = Database.Command(c, "SELECT to_jsonb(r) FROM andrade_portal.requests r WHERE id=@id", ("id", id));
        var r = JsonNode.Parse((await cmd.ExecuteScalarAsync())!.ToString()!)!;
        await using var settingsCmd = Database.Command(c, "SELECT data FROM andrade_portal.settings WHERE id=true");
        var s = JsonNode.Parse((await settingsCmd.ExecuteScalarAsync())!.ToString()!)!;
        string S(string key) => s[key]?.ToString() ?? "";
        string R(string key) => r[key]?.ToString() ?? "";
        var origin = (config["PUBLIC_SITE_URL"] ?? S("publicSiteUrl")).TrimEnd('/');
        var siteReady = Uri.TryCreate(origin, UriKind.Absolute, out var site) && site.Scheme == "https" && site.AbsolutePath == "/" && string.IsNullOrEmpty(site.Query) && string.IsNullOrEmpty(site.Fragment);
        var tracking = siteReady && R("tracking_secret") != "" ? origin + "/seguimiento#ref=" + R("reference") + "&key=" + secrets.Unprotect(R("tracking_secret")) : "";
        var title = Label(eventStatus);
        foreach (var audience in new[] { "client", "admin" })
        {
            if (onlyAudience != null && audience != onlyAudience) continue;
            if (!ShouldNotify(eventStatus, audience, S("emailPolicy"))) continue;
            var outboxId = Guid.NewGuid();
            var recipient = audience == "client" ? R("email") : S("notificationEmail");
            if (recipient == "") continue;
            var destination = audience == "client" ? tracking : siteReady ? origin + "/admin" : "";
            var subject = title + " · " + R("reference");
            var html = EmailTemplate.Render(r, s, eventStatus, audience, destination);
            var payload = new JsonObject { ["sender"] = new JsonObject { ["email"] = S("senderEmail"), ["name"] = S("name") }, ["to"] = new JsonArray(new JsonObject { ["email"] = recipient }), ["subject"] = subject, ["htmlContent"] = html, ["tags"] = new JsonArray("andrade-citas") };
            await using var insert = Database.Command(c, "INSERT INTO andrade_portal.email_outbox(id,request_id,audience,event_status,payload_secret,status,last_error,dedupe_key) VALUES(@id,@request,@audience,@event,@payload,@status,@error,@dedupe) ON CONFLICT DO NOTHING",
                ("id", outboxId), ("dedupe", dedupeKey), ("request", id), ("audience", audience), ("event", eventStatus), ("payload", secrets.Protect(payload.ToJsonString())),
                ("status", siteReady && S("senderEmail") != "" ? "pending" : "failed"), ("error", siteReady && S("senderEmail") != "" ? "" : "Falta URL pública HTTPS o remitente. Completa Configuración antes de nuevas solicitudes."));
            await insert.ExecuteNonQueryAsync();
        }
        Wake();
    }
    private static string H(string text) => WebUtility.HtmlEncode(text);
    public async Task Retry(Guid id)
    {
        await using var c = await db.Source.OpenConnectionAsync(); await using var tx = await c.BeginTransactionAsync();
        await using var select = Database.Command(c, "SELECT to_jsonb(o) FROM andrade_portal.email_outbox o WHERE id=@id AND status IN ('failed','uncertain') AND delivery_status='unknown' FOR UPDATE", ("id", id));
        var raw = await select.ExecuteScalarAsync();
        if (raw == null) throw new PortalException("Solo puedes reintentar avisos fallidos o sin respuesta y sin confirmación de entrega del proveedor. Revisa la incidencia antes de reenviar.", 409);
        var row = JsonNode.Parse(raw.ToString()!)!;
        await using var settingsCmd = Database.Command(c, "SELECT data FROM andrade_portal.settings WHERE id=true");
        var s = JsonNode.Parse((await settingsCmd.ExecuteScalarAsync())!.ToString()!)!;
        var origin = (config["PUBLIC_SITE_URL"] ?? s["publicSiteUrl"]?.ToString() ?? "").TrimEnd('/');
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.Scheme != "https" || string.IsNullOrWhiteSpace(s["senderEmail"]?.ToString())) throw new PortalException("Completa la URL pública y el remitente antes de reintentar.", 409);
        var payload = JsonNode.Parse(secrets.Unprotect(row["payload_secret"]!.ToString()))!;
        payload["sender"] = new JsonObject { ["email"] = s["senderEmail"]!.ToString(), ["name"] = s["name"]!.ToString() };
        if (row["audience"]!.ToString() == "admin") payload["to"] = new JsonArray(new JsonObject { ["email"] = s["notificationEmail"]!.ToString() });
        await using var requestCmd = Database.Command(c, "SELECT jsonb_build_object('reference',reference,'secret',tracking_secret) FROM andrade_portal.requests WHERE id=@id", ("id", Guid.Parse(row["request_id"]!.ToString())));
        var request = JsonNode.Parse((await requestCmd.ExecuteScalarAsync())!.ToString()!)!;
        var admin = row["audience"]!.ToString() == "admin";
        var url = admin ? origin + "/admin" : request["secret"]!.ToString() == "" ? "" : origin + "/seguimiento#ref=" + request["reference"]!.ToString() + "&key=" + secrets.Unprotect(request["secret"]!.ToString());
        if (url != "")
        {
            var label = admin ? "Abrir administrador" : "Ver mi seguimiento";
            var html = payload["htmlContent"]!.ToString();
            html = System.Text.RegularExpressions.Regex.Replace(html, "href='[^']*'>" + label, "href='" + H(url) + "'>" + label);
            html = html.Replace("<p>Conserva el comprobante obtenido en la web para consultar el seguimiento.</p>", "<p><a href='" + H(url) + "'>" + label + "</a></p>");
            payload["htmlContent"] = html;
        }
        await using var update = Database.Command(c, "UPDATE andrade_portal.email_outbox SET payload_secret=@payload,status='pending',next_attempt_at=now(),attempts=0,last_error='' WHERE id=@id", ("id", id), ("payload", secrets.Protect(payload.ToJsonString())));
        await update.ExecuteNonQueryAsync(); await tx.CommitAsync(); Wake();
    }
    public async Task<bool> Dispatch(CancellationToken ct)
    {
        if (config["EMAIL_DELIVERY_ENABLED"] != "true" || string.IsNullOrEmpty(config["BREVO_API_KEY"])) return false;
        if ((await db.Json("SELECT data->'emailEnabled' FROM andrade_portal.settings WHERE id=true"))?.GetValue<bool>() != true) return false;
        // An interrupted delivery can have reached Brevo: do not blindly send it twice.
        await db.Execute("UPDATE andrade_portal.email_outbox SET status='uncertain',last_error='Envío interrumpido; revisa el registro de Brevo antes de reintentar.' WHERE status='processing' AND claimed_at<now()-interval '2 minutes'");
        var row = await db.Json("WITH next AS (SELECT id FROM andrade_portal.email_outbox WHERE status='pending' AND delivery_status='unknown' AND next_attempt_at<=now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) UPDATE andrade_portal.email_outbox o SET status='processing',attempts=attempts+1,claimed_at=now() FROM next WHERE o.id=next.id RETURNING to_jsonb(o)");
        if (row == null) return false;
        await Deliver(row, ct);
        return true;
    }
    public async Task Deliver(JsonNode row, CancellationToken ct)
    {
        var id = Guid.Parse(row["id"]!.ToString());
        try
        {
            var payload = JsonNode.Parse(secrets.Unprotect(row["payload_secret"]!.ToString()))!;
            payload["headers"] = new JsonObject { ["idempotencyKey"] = id.ToString(), ["X-Mailin-custom"] = "andrade:" + id.ToString() };
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
            request.Headers.Add("api-key", config["BREVO_API_KEY"]);
            request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");
            using var response = await clients.CreateClient("brevo").SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
            {
                var responseBody = JsonNode.Parse(await response.Content.ReadAsStringAsync(ct));
                await db.Execute("UPDATE andrade_portal.email_outbox SET status='accepted',provider_id=@provider,accepted_at=now(),last_error='' WHERE id=@id", ("id", id), ("provider", responseBody?["messageId"]?.ToString() ?? ""));
            }
            else
            {
                var retry = (int)response.StatusCode == 429 && row["attempts"]!.GetValue<int>() < 5;
                var ambiguous = (int)response.StatusCode >= 500;
                var delay = response.Headers.RetryAfter?.Delta?.TotalSeconds ?? (response.Headers.RetryAfter?.Date is { } at ? (at - DateTimeOffset.UtcNow).TotalSeconds : 30 * Math.Pow(2, Math.Clamp(row["attempts"]!.GetValue<int>(), 0, 5)));
                delay = Math.Clamp(delay, 30, 86400);
                await db.Execute("UPDATE andrade_portal.email_outbox SET status=@status,last_error=@error,next_attempt_at=now()+@delay*interval '1 second' WHERE id=@id", ("id", id), ("delay", delay), ("status", retry ? "pending" : ambiguous ? "uncertain" : "failed"), ("error", "Brevo HTTP " + (int)response.StatusCode + (ambiguous ? ". Revisa Brevo antes de reintentar." : ". Revisa remitente, cuota y configuración.")));
            }
        }
        catch (Exception e) when (e is HttpRequestException or OperationCanceledException)
        { await db.Execute("UPDATE andrade_portal.email_outbox SET status='uncertain',last_error='Respuesta no confirmada. Revisa Brevo antes de reintentar para evitar duplicados.' WHERE id=@id", ("id", id)); }
        catch (Exception)
        { await db.Execute("UPDATE andrade_portal.email_outbox SET status='failed',last_error='No se pudo preparar el correo. Revisa la configuración del servidor.' WHERE id=@id", ("id", id)); }
    }
}

public sealed class EmailWorker(EmailService email, ILogger<EmailWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
            try {
                await email.Wait(stoppingToken);
                for (var i = 0; i < 20 && !stoppingToken.IsCancellationRequested; i++)
                    if (!await email.Dispatch(stoppingToken)) break;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception e) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning("Cola de correo temporalmente no disponible: {Type}", e.GetType().Name); }
    }
}
