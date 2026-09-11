using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Npgsql;

namespace Andrade;

// A stable server-only key is required so queued mail survives redeploys.
public sealed class NotificationSecrets(IConfiguration config)
{
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
        using var aes = new AesGcm(Key, 16); aes.Decrypt(bytes.AsSpan(0, 12), bytes.AsSpan(28), bytes.AsSpan(12, 16), plain);
        return Encoding.UTF8.GetString(plain);
    }
}

public sealed class EmailService(Database db, IConfiguration config, NotificationSecrets secrets, IHttpClientFactory clients)
{
    public static string Label(string status) => status switch {
        "solidarity_recibido" => "Postulación solidaria recibida", "solidarity_revision" => "Postulación en revisión", "solidarity_seleccionado" => "Tu caso fue seleccionado para el apoyo mensual", "solidarity_no_seleccionado" => "Tu caso no fue seleccionado en esta convocatoria",
        "recibido" => "Solicitud recibida", "revision" => "Solicitud en revisión", "aprobado" => "Solicitud aprobada",
        "pendiente_pago" => "Pendiente de pago", "confirmado" => "Cita agendada", "completado" => "Atención completada",
        "cancelado" => "Solicitud cancelada", "pago_revision" => "Transferencia en revisión", _ => "Novedad en tu solicitud" };
    public async Task Queue(NpgsqlConnection c, Guid id, string eventStatus)
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
        var title = Label(eventStatus); var at = R("appointment_at");
        var date = R("service_id") == "solidarity" ? "Programa de apoyo solidario · sin cobro por postular" : at == "" ? "Sin horario solicitado" : DateTimeOffset.Parse(at).ToOffset(TimeSpan.FromHours(-5)).ToString("dd/MM/yyyy HH:mm") + " · Ecuador (UTC−5)";
        foreach (var audience in new[] { "client", "admin" })
        {
            var recipient = audience == "client" ? R("email") : S("notificationEmail");
            if (recipient == "") continue;
            var destination = audience == "client" ? tracking : siteReady ? origin + "/admin" : "";
            var detail = audience == "client" ? "Puedes regresar a tu solicitud con el botón de seguimiento de este correo. Conserva este enlace de forma privada." : "Ingresa al administrador para revisar la solicitud y atender los siguientes pasos.";
            var paid = R("payment_status") == "verificado";
            var bank = r["payment_test"]?.GetValue<bool>() == true ? "<p><strong>DEMOSTRACIÓN: no realices transferencias. El despacho debe activar los datos bancarios reales.</strong></p>" : audience == "client" && !paid && R("payment_status") != "no_requerido" && !new[] { "cancelado", "completado" }.Contains(R("status"))
                ? "<h2>Transferencia para tu consulta virtual</h2><p>Valor: USD " + H(R("payment_amount")) + "</p><p style='white-space:pre-line'>" + H(R("payment_instructions")) + "</p><p>Indica la referencia de tu cita al transferir. El despacho verificará el ingreso antes de agendar.</p>" : "";
            var meeting = R("status") == "confirmado" && R("meeting_url") != "" ? "<p><a href='" + H(R("meeting_url")) + "'>Entrar a la videollamada</a></p>" : "";
            var subject = title + " · " + R("reference");
            var html = "<html lang='es'><body style='margin:0;background:#111719;color:#f0f0e9;font-family:Arial,sans-serif;padding:28px'><main style='max-width:580px;margin:auto'><p style='color:#d2b879;letter-spacing:2px'>" + H(S("name")) + "</p><h1>" + H(title) + "</h1><p>Referencia: <strong>" + H(R("reference")) + "</strong></p><p>" + H(date) + " · " + H(R("service_id") == "solidarity" ? "Revisión privada del abogado" : R("mode")) + "</p>" + (new[] { "confirmado", "cancelado", "completado" }.Contains(R("status")) ? "" : "<p>La solicitud aún no constituye una cita agendada.</p>") + bank + "<p>" + detail + "</p>" + (destination == "" ? "<p>Conserva el comprobante obtenido en la web para consultar el seguimiento.</p>" : "<p><a style='display:inline-block;padding:14px 20px;background:#d2b879;color:#111719;border-radius:6px' href='" + H(destination) + "'>" + (audience == "client" ? "Ver mi seguimiento" : "Abrir administrador") + "</a></p>") + meeting + "<p>Si no ves otros avisos, revisa también la carpeta de correo no deseado.</p></main></body></html>";
            var payload = new JsonObject { ["sender"] = new JsonObject { ["email"] = S("senderEmail"), ["name"] = S("name") }, ["to"] = new JsonArray(new JsonObject { ["email"] = recipient }), ["subject"] = subject, ["htmlContent"] = html, ["tags"] = new JsonArray("andrade-citas") };
            await using var insert = Database.Command(c, "INSERT INTO andrade_portal.email_outbox(id,request_id,audience,event_status,payload_secret,status,last_error) VALUES(@id,@request,@audience,@event,@payload,@status,@error)",
                ("id", Guid.NewGuid()), ("request", id), ("audience", audience), ("event", eventStatus), ("payload", secrets.Protect(payload.ToJsonString())),
                ("status", siteReady && S("senderEmail") != "" ? "pending" : "failed"), ("error", siteReady && S("senderEmail") != "" ? "" : "Falta URL pública HTTPS o remitente. Completa Configuración antes de nuevas solicitudes."));
            await insert.ExecuteNonQueryAsync();
        }
    }
    private static string H(string text) => WebUtility.HtmlEncode(text);
    public async Task Retry(Guid id)
    {
        await using var c = await db.Source.OpenConnectionAsync(); await using var tx = await c.BeginTransactionAsync();
        await using var select = Database.Command(c, "SELECT to_jsonb(o) FROM andrade_portal.email_outbox o WHERE id=@id AND status IN ('failed','uncertain') FOR UPDATE", ("id", id));
        var raw = await select.ExecuteScalarAsync();
        if (raw == null) throw new PortalException("Solo puedes reintentar avisos fallidos o sin respuesta confirmada.", 409);
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
        await update.ExecuteNonQueryAsync(); await tx.CommitAsync();
    }
    public async Task Dispatch(CancellationToken ct)
    {
        // An interrupted delivery can have reached Brevo: do not blindly send it twice.
        await db.Execute("UPDATE andrade_portal.email_outbox SET status='uncertain',last_error='Envío interrumpido; revisa el registro de Brevo antes de reintentar.' WHERE status='processing' AND claimed_at<now()-interval '2 minutes'");
        if (config["EMAIL_DELIVERY_ENABLED"] != "true" || string.IsNullOrEmpty(config["BREVO_API_KEY"])) return;
        if ((await db.Json("SELECT data->'emailEnabled' FROM andrade_portal.settings WHERE id=true"))?.GetValue<bool>() != true) return;
        var row = await db.Json("WITH next AS (SELECT id FROM andrade_portal.email_outbox WHERE status='pending' AND next_attempt_at<=now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) UPDATE andrade_portal.email_outbox o SET status='processing',attempts=attempts+1,claimed_at=now() FROM next WHERE o.id=next.id RETURNING to_jsonb(o)");
        if (row == null) return;
        await Deliver(row, ct);
    }
    public async Task Deliver(JsonNode row, CancellationToken ct)
    {
        var id = Guid.Parse(row["id"]!.ToString());
        try
        {
            var payload = JsonNode.Parse(secrets.Unprotect(row["payload_secret"]!.ToString()))!;
            payload["headers"] = new JsonObject { ["idempotencyKey"] = id.ToString() };
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
                await db.Execute("UPDATE andrade_portal.email_outbox SET status=@status,last_error=@error,next_attempt_at=now()+interval '2 minutes' WHERE id=@id", ("id", id), ("status", retry ? "pending" : ambiguous ? "uncertain" : "failed"), ("error", "Brevo HTTP " + (int)response.StatusCode + (ambiguous ? ". Revisa Brevo antes de reintentar." : ". Revisa remitente, cuota y configuración.")));
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
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        while (await timer.WaitForNextTickAsync(stoppingToken))
            try { await email.Dispatch(stoppingToken); }
            catch (Exception e) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning("Cola de correo temporalmente no disponible: {Type}", e.GetType().Name); }
    }
}
