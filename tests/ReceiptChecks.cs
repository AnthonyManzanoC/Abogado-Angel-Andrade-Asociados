using Andrade;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
public static class ReceiptChecks
{
 public static async Task Run(Database db, IConfiguration config)
 {
  void Check(bool ok,string name){if(!ok)throw new Exception(name);Console.WriteLine("PASS: "+name);}
  var secrets=new NotificationSecrets(config);var mail=new EmailService(db,config,secrets,new NoMail());var portal=new Portal(db,mail,secrets);
  var address="receipt-"+Guid.NewGuid().ToString("N")+"@example.invalid";var token=Auth.Token();
  var settings=(await portal.Settings())!.ToJsonString();
  using var client=new HttpClient(new HttpClientHandler{CookieContainer=new CookieContainer()}){BaseAddress=new Uri(Environment.GetEnvironmentVariable("TEST_API_URL")??"http://127.0.0.1:5086")};client.DefaultRequestHeaders.Add("X-Portal-Client","web");
  try {
   await db.Execute("UPDATE andrade_portal.settings SET data=data||'{\"paymentTestMode\":false,\"emailPolicy\":\"important\"}'::jsonb");
   string? slot=null;for(var i=1;i<30&&slot==null;i++)slot=(await portal.Slots(DateTime.UtcNow.AddHours(-5).AddDays(i).ToString("yyyy-MM-dd"))).FirstOrDefault();
   var result=JsonNode.Parse(System.Text.Json.JsonSerializer.Serialize(await portal.CreateRequest(new("Prueba comprobante",address,"0990000000","general","Prueba aislada de comprobante privado.","virtual",slot,true,Guid.NewGuid().ToString(),token))))!;
   var reference=result["reference"]!.ToString();var row=(await portal.Requests())!.AsArray().Single(r=>r!["reference"]!.ToString()==reference)!;var id=Guid.Parse(row["id"]!.ToString());
   var bad=new PaymentReceiptInput(Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("<html>archivo falso</html>")));
   var rejected=false;try{await portal.ReportPayment(reference,token,"QA-12345",bad);}catch(PortalException){rejected=true;}
   Check(rejected&&(await portal.Track(reference,token))["paymentStatus"]!.ToString()=="pendiente","Archivo inválido no cambia pago ni notifica");
   rejected=false;try{PaymentReceipt.Decode(new(new string('A',4*((PaymentReceipt.MaxBytes+2)/3)+1)));}catch(PortalException){rejected=true;}
   Check(rejected,"Comprobante excesivo rechazado antes de decodificar");
   var png=Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=");
   var receipt=new PaymentReceiptInput(Convert.ToBase64String(png));
   var unauthorized=await client.PostAsJsonAsync("/api/track/payment",new{reference,token=Auth.Token(),bankReference="QA-12345",receipt});
   Check(unauthorized.StatusCode==HttpStatusCode.NotFound,"Clave ajena no puede subir comprobantes");
   var saved=await client.PostAsJsonAsync("/api/track/payment",new{reference,token,bankReference="QA-12345",receipt});Check(saved.IsSuccessStatusCode,"Carga privada de comprobante por API");
   await portal.ReportPayment(reference,token,"QA-12345",receipt);
   var track=await portal.Track(reference,token);Check(track["paymentReceiptUploaded"]!.GetValue<bool>()&&track["paymentStatus"]!.ToString()=="revision"&&!track.ToJsonString().Contains(receipt.Base64),"Seguimiento confirma archivo sin exponerlo");
   var count=(await db.Json("SELECT to_jsonb(count(*)) FROM andrade_portal.email_outbox WHERE request_id=@id AND event_status='pago_revision'",("id",id)))!.GetValue<int>();Check(count==1,"Subir y reintentar genera un solo aviso para admin");
   var stored=(await db.Json("SELECT to_jsonb(payload_secret) FROM andrade_portal.payment_receipts WHERE request_id=@id",("id",id)))!.ToString();Check(stored!=receipt.Base64&&secrets.Unprotect(stored)==receipt.Base64,"Comprobante cifrado y recuperable");
   Check((await client.GetAsync("/api/admin/requests/"+id+"/receipt")).StatusCode==HttpStatusCode.Unauthorized,"Descarga exige sesión administrativa");
   var login=await client.PostAsJsonAsync("/api/admin/login",new{email=config["ADMIN_EMAIL"],password=config["ADMIN_PASSWORD"]});Check(login.IsSuccessStatusCode,"Sesión de prueba administrativa");
   var file=await client.GetAsync("/api/admin/requests/"+id+"/receipt");Check(file.IsSuccessStatusCode&&(await file.Content.ReadAsByteArrayAsync()).SequenceEqual(png)&&file.Headers.CacheControl?.NoStore==true&&file.Content.Headers.ContentDisposition?.DispositionType=="attachment","Admin descarga original sin caché y como adjunto");
   var messages=(await db.Json("SELECT jsonb_agg(jsonb_build_object('audience',audience,'payload',payload_secret)) FROM andrade_portal.email_outbox WHERE request_id=@id",("id",id)))!.AsArray();
   foreach(var audience in new[]{"client","admin"}) {
    var payload=JsonNode.Parse(secrets.Unprotect(messages.First(m=>m!["audience"]!.ToString()==audience)!["payload"]!.ToString()))!;var html=payload["htmlContent"]!.ToString();
    Check(audience=="client"?html.Contains("/seguimiento#ref="+reference)&&html.Contains("subir el comprobante")&&html.Contains(token):html.Contains("/admin#section=requests&amp;ref="+reference)&&html.Contains("Inicia sesión"),"Correo "+audience+" incluye acceso y pasos para regresar");
   }
   Check(EmailService.AdminDestination("https://example.com",new JsonObject{["reference"]=reference,["service_id"]="solidarity",["created_at"]="2026-09-01T02:00:00Z"}).Contains("section=solidarity&ref="+reference+"&period=2026-08"),"Aviso solidario conserva convocatoria en hora de Ecuador");
   await client.PostAsJsonAsync("/api/admin/logout",new{});
  } finally {await db.Execute("DELETE FROM andrade_portal.requests WHERE email=@email",("email",address));await db.Execute("UPDATE andrade_portal.settings SET data=@settings::jsonb",("settings",settings));}
 }
 private sealed class NoMail:IHttpClientFactory {public HttpClient CreateClient(string name)=>throw new Exception("No enviar correo real.");}
}
