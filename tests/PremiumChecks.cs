using Andrade;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;

public static class PremiumChecks
{
    public static async Task Run(Database db, IConfiguration config)
    {
        var secrets = new NotificationSecrets(config); var factory = new FakeBrevo();
        var mail = new EmailService(db, config, secrets, factory); var portal = new Portal(db, mail, secrets);
        var marker = "premium-" + Guid.NewGuid().ToString("N") + "@example.invalid"; var ids = new List<Guid>();
        void Check(bool ok, string label) { if (!ok) throw new Exception("FAIL: " + label); Console.WriteLine("PASS: " + label); }
        async Task Reject(Func<Task> action, string label) { try { await action(); } catch (PortalException) { Console.WriteLine("PASS: " + label); return; } throw new Exception("FAIL: " + label); }
        async Task<int> Count(Guid id) => (await db.Json("SELECT to_jsonb(count(*)) FROM andrade_portal.email_outbox WHERE request_id=@id", ("id", id)))!.GetValue<int>();
        try
        {
            Check(secrets.Unprotect(secrets.Protect("private-link-test")) == "private-link-test", "Cifrado autenticado de enlaces y mensajes");
            var publicSettings = (await portal.PublicSettings()).AsObject();
            Check(!publicSettings.ContainsKey("notificationEmail") && !publicSettings.ContainsKey("bankInstructions") && !publicSettings.ContainsKey("senderEmail"), "Configuración operativa excluida de API pública y MCP");
            Check(!Validate.MeetingUrl("https://meet.google.com.evil.invalid/a") && !Validate.MeetingUrl("javascript:alert(1)") && Validate.MeetingUrl("https://meet.google.com/abc-defg-hij"), "Videollamada validada por host y protocolo");
            string? slot = null; var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-5));
            for (var day = 1; day < 30 && slot == null; day++) slot = (await portal.Slots(today.AddDays(day).ToString("yyyy-MM-dd"))).FirstOrDefault();
            if (slot == null) throw new Exception("No hay un horario disponible para prueba premium.");
            var token = Auth.Token(); var idem = Guid.NewGuid().ToString();
            var input = new RequestInput("Validación premium", marker, "0990000000", "general", "Validación técnica temporal del flujo virtual.", "virtual", slot, true, idem, token);
            var created = JsonSerializer.SerializeToNode(await portal.CreateRequest(input))!; var reference = created["reference"]!.ToString();
            var row = (await portal.Requests())!.AsArray().Single(r => r!["reference"]!.ToString() == reference)!;
            var id = Guid.Parse(row["id"]!.ToString()); ids.Add(id);
            Check(created["status"]!.ToString() == "pendiente_pago" && await Count(id) == 2, "Cita virtual y dos avisos guardados juntos");
            await portal.CreateRequest(input); Check(await Count(id) == 2, "Reintento no duplica avisos");
            var encrypted = (await db.Json("SELECT to_jsonb(o) FROM andrade_portal.email_outbox o WHERE request_id=@id AND audience='client'", ("id", id)))!;
            Check(!encrypted.ToJsonString().Contains(token), "Cola sin clave privada en texto claro");
            var payload = JsonNode.Parse(secrets.Unprotect(encrypted["payload_secret"]!.ToString()))!;
            Check(payload["htmlContent"]!.ToString().Contains("#ref=" + reference + "&amp;key=" + token), "Correo contiene enlace privado para regresar");
            if (Environment.GetEnvironmentVariable("TEST_BREVO_SANDBOX") == "true")
            {
                var sandbox = payload.DeepClone(); sandbox["headers"] = new JsonObject { ["X-Sib-Sandbox"] = "drop" };
                using var client = new HttpClient(); using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
                request.Headers.Add("api-key", config["BREVO_API_KEY"]); request.Content = new StringContent(sandbox.ToJsonString(), Encoding.UTF8, "application/json");
                using var response = await client.SendAsync(request);
                Check(response.StatusCode == HttpStatusCode.Created, "API real de Brevo acepta la plantilla en sandbox sin enviar correos");
            }
            await Reject(() => portal.UpdateRequest(id, new JsonObject { ["status"] = "confirmado", ["meetingUrl"] = "https://meet.google.com/abc-defg-hij" }, "QA"), "No se agenda sin comprobar el pago");
            await Reject(() => portal.ReportPayment(reference, Auth.Token(), "BANK-123456"), "Clave ajena no puede reportar pagos");
            if (row["paymentTest"]?.GetValue<bool>() == true) await Reject(() => portal.ReportPayment(reference, token, "BANK-123456"), "Demostración bloquea transferencias reales");
            // Only the disposable QA request changes mode. No global bank settings or real payments change.
            await db.Execute("UPDATE andrade_portal.requests SET payment_test=false,payment_instructions='VALIDACIÓN TÉCNICA; NO TRANSFERIR' WHERE id=@id", ("id", id));
            await portal.ReportPayment(reference, token, "BANK-QA-123456"); await portal.ReportPayment(reference, token, "BANK-QA-123456");
            Check(await Count(id) == 4, "Reporte de transferencia idempotente");
            await portal.UpdateRequest(id, new JsonObject { ["status"] = "aprobado", ["privateNote"] = "SECRET-INTERNAL" }, "QA");
            Check(await Count(id) == 6, "Aprobación avisa al cliente y al administrador");
            await portal.UpdateRequest(id, new JsonObject { ["status"] = "aprobado", ["privateNote"] = "SECRET-INTERNAL-EDIT" }, "QA");
            Check(await Count(id) == 6, "Notas internas no generan correos");
            await Reject(() => portal.UpdateRequest(id, new JsonObject { ["status"] = "confirmado", ["verifyPayment"] = true, ["verificationNote"] = "Ingreso de validación" }, "QA"), "Pago sin enlace no confirma la cita");
            Check((await portal.Track(reference, token))["paymentStatus"]!.ToString() == "revision", "Verificación fallida revierte cambios");
            await portal.UpdateRequest(id, new JsonObject { ["status"] = "confirmado", ["verifyPayment"] = true, ["verificationNote"] = "Ingreso de validación", ["meetingUrl"] = "https://meet.google.com/abc-defg-hij" }, "QA");
            var tracked = await portal.Track(reference, token);
            Check(tracked["status"]!.ToString() == "confirmado" && tracked["paymentStatus"]!.ToString() == "verificado" && tracked["meetingUrl"]!.ToString().Contains("meet.google.com"), "Pago verificado permite agendar y entrar a la videollamada");
            Check(await Count(id) == 8 && !tracked.ToJsonString().Contains("SECRET-INTERNAL"), "Agendamiento notifica y protege notas internas");
            await portal.UpdateRequest(id, new JsonObject { ["status"] = "confirmado", ["meetingUrl"] = "https://meet.google.com/abc-defg-hij" }, "QA");
            Check(await Count(id) == 8, "Guardar sin cambios públicos no duplica avisos");
            await Reject(() => portal.UpdateRequest(id, new JsonObject { ["status"] = "recibido" }, "QA"), "Transiciones regresivas rechazadas");
            await portal.Cancel(reference, token);
            Check((await portal.Track(reference, token))["meetingUrl"]!.ToString() == "" && await Count(id) == 10, "Cancelación oculta reunión y notifica");
            Check((await portal.Slots(slot[..10])).Contains(slot), "Cancelación libera el horario");
            await mail.Deliver(encrypted, CancellationToken.None);
            var accepted = await db.Json("SELECT to_jsonb(status) FROM andrade_portal.email_outbox WHERE id=@id", ("id", Guid.Parse(encrypted["id"]!.ToString())));
            Check(factory.Count == 1 && accepted!.ToString() == "accepted", "Transporte simulado de Brevo persiste aceptación");
            factory.Status = HttpStatusCode.TooManyRequests; await mail.Deliver(encrypted, CancellationToken.None);
            Check((await db.Json("SELECT to_jsonb(status) FROM andrade_portal.email_outbox WHERE id=@id", ("id", Guid.Parse(encrypted["id"]!.ToString()))))!.ToString() == "pending", "Límite de Brevo programa reintento");
            factory.Status = HttpStatusCode.InternalServerError; await mail.Deliver(encrypted, CancellationToken.None);
            Check((await db.Json("SELECT to_jsonb(status) FROM andrade_portal.email_outbox WHERE id=@id", ("id", Guid.Parse(encrypted["id"]!.ToString()))))!.ToString() == "uncertain", "Respuesta ambigua no causa reenvío automático");
            await mail.Retry(Guid.Parse(encrypted["id"]!.ToString()));
            Check((await db.Json("SELECT to_jsonb(status) FROM andrade_portal.email_outbox WHERE id=@id", ("id", Guid.Parse(encrypted["id"]!.ToString()))))!.ToString() == "pending", "Reintento administrativo conserva el aviso y actualiza la configuración");
        }
        finally
        {
            await db.Execute("DELETE FROM andrade_portal.requests WHERE email=@email", ("email", marker));
            foreach (var id in ids) await db.Execute("DELETE FROM andrade_portal.audit_log WHERE target=@target AND actor='QA'", ("target", id.ToString()));
        }
    }
    private sealed class FakeBrevo : HttpMessageHandler, IHttpClientFactory
    {
        public int Count { get; private set; }
        public HttpStatusCode Status = HttpStatusCode.Created;
        public HttpClient CreateClient(string name) => new(this, false);
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        { Count++; return Task.FromResult(new HttpResponseMessage(Status) { Content = new StringContent("{\"messageId\":\"qa-only\"}", Encoding.UTF8, "application/json") }); }
    }
}
