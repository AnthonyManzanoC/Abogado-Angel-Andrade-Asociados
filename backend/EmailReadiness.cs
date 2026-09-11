using System.Text.Json.Nodes;
namespace Andrade;
public record DeliveryReadiness(bool Ready, bool SendingEnabled, bool WebhookConfigured, string[] Issues);
public sealed partial class EmailService
{
 public async Task<DeliveryReadiness> CheckConfiguration(JsonNode? proposed = null)
 {
  var s=proposed??await db.Json("SELECT data FROM andrade_portal.settings WHERE id=true");var issues=new List<string>();
  var master=config["EMAIL_DELIVERY_ENABLED"]=="true";if(!master)issues.Add("Configura EMAIL_DELIVERY_ENABLED=true en el backend de Render.");
  try { if(Convert.FromBase64String(config["NOTIFICATION_ENCRYPTION_KEY"]??"").Length!=32)issues.Add("Falta una clave de cifrado válida en el servidor."); }catch{issues.Add("Revisa NOTIFICATION_ENCRYPTION_KEY en el servidor.");}
  var origin=config["PUBLIC_SITE_URL"]??s?["publicSiteUrl"]?.ToString()??"";
  if(!Uri.TryCreate(origin,UriKind.Absolute,out var uri)||uri.Scheme!="https"||uri.AbsolutePath!="/"||uri.UserInfo!=""||uri.Query!=""||uri.Fragment!="")issues.Add("Completa la URL HTTPS pública del portal, sin rutas ni parámetros.");
  if(!System.Net.Mail.MailAddress.TryCreate(s?["notificationEmail"]?.ToString(),out _))issues.Add("Completa el correo del administrador que recibirá los avisos.");
  if(string.IsNullOrWhiteSpace(config["BREVO_API_KEY"]))issues.Add("Falta BREVO_API_KEY en el servidor.");
  else try {
   using var request=new HttpRequestMessage(HttpMethod.Get,"https://api.brevo.com/v3/senders");request.Headers.Add("api-key",config["BREVO_API_KEY"]);
   using var response=await clients.CreateClient("brevo").SendAsync(request);
   if(!response.IsSuccessStatusCode)issues.Add("Brevo no pudo validar el remitente (HTTP "+(int)response.StatusCode+"). Revisa la clave y la cuenta.");
   else {var result=JsonNode.Parse(await response.Content.ReadAsStringAsync());var sender=s?["senderEmail"]?.ToString()??"";
    if(result?["senders"] is not JsonArray senders||!senders.Any(v=>string.Equals(v?["email"]?.ToString(),sender,StringComparison.OrdinalIgnoreCase)&&v?["active"]?.GetValue<bool>()==true))issues.Add("Verifica el remitente configurado en Brevo antes de activar los correos.");}
  } catch {issues.Add("No se pudo consultar Brevo. Intenta comprobar nuevamente en unos momentos.");}
  return new(issues.Count==0,master&&s?["emailEnabled"]?.GetValue<bool>()==true,(config["BREVO_WEBHOOK_SECRET"]?.Length??0)>=32,issues.ToArray());
 }
}
