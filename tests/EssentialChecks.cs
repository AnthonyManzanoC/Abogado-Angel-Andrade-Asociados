using Andrade;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
public static class EssentialChecks
{
 public static async Task Run(Database db, IConfiguration config)
 {
  void Check(bool ok,string label) { if(!ok)throw new Exception("FAIL: "+label);Console.WriteLine("PASS: "+label); }
  var secret=new NotificationSecrets(config);var mail=new EmailService(db,config,secret,new NeverSend());var portal=new Portal(db,mail,secret);var tools=new PortalTools(portal);
  foreach(var size in new[]{16,24,32}) {
   var key=Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(size));
   Check(NotificationSecrets.ValidKey(key),"Clave AES de "+size+" bytes compatible con la comprobación");
   var old=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["NOTIFICATION_ENCRYPTION_KEY"]=key}).Build();
   var stored=new NotificationSecrets(old).Protect("aviso anterior");
   var rotated=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["NOTIFICATION_ENCRYPTION_KEY"]=config["NOTIFICATION_ENCRYPTION_KEY"],["NOTIFICATION_LEGACY_ENCRYPTION_KEYS"]=key}).Build();
   Check(new NotificationSecrets(rotated).Unprotect(stored)=="aviso anterior","Clave anterior recupera avisos sin cambiar la clave actual: "+size);
  }
  Check(!NotificationSecrets.ValidKey("not-a-key")&&!NotificationSecrets.ValidKey(Convert.ToBase64String(new byte[20])),"Claves inválidas rechazadas");
  Check(!EmailService.ShouldNotify("revision","client","important")&&!EmailService.ShouldNotify("pago_verificado","admin","important")&&EmailService.ShouldNotify("revision","client","all"),"Política esencial omite revisiones; modo completo las conserva");
  Check(EmailService.ShouldNotify("pago_revision","admin","important")&&!EmailService.ShouldNotify("pago_revision","client","important"),"Transferencia reportada avisa solo al administrador en modo esencial");
  var email="essential-"+Guid.NewGuid().ToString("N")+"@example.invalid";
  async Task<JsonNode> Entry(string reference)=>(await portal.Requests())!.AsArray().Single(r=>r!["reference"]!.ToString()==reference)!;
  async Task<int> Count(Guid id)=>(await db.Json("SELECT to_jsonb(count(*)) FROM andrade_portal.email_outbox WHERE request_id=@id",("id",id)))!.GetValue<int>();
  try {
   var token=Auth.Token();var idem=Guid.NewGuid().ToString();
   var result=JsonNode.Parse(await tools.CreateConsultation("Prueba Alma","0990000000","Consulta temporal desde el asistente.",idem,token,true,email))!;
   var reference=result["reference"]!.ToString();var entry=await Entry(reference);var id=Guid.Parse(entry["id"]!.ToString());
   await tools.CreateConsultation("Prueba Alma","0990000000","Consulta temporal desde el asistente.",idem,token,true,email);
   Check(await Count(id)==2,"Alma/MCP crea avisos para cliente y administrador sin duplicarlos al reintentar");
   var queued=(await db.Json("SELECT to_jsonb(id) FROM andrade_portal.email_outbox WHERE request_id=@id LIMIT 1",("id",id)))!.ToString();
   await db.Execute("UPDATE andrade_portal.email_outbox SET status='processing',claimed_at=now()-interval '5 minutes' WHERE id=@id",("id",Guid.Parse(queued)));
   var disabled=new ConfigurationBuilder().AddConfiguration(config).AddInMemoryCollection(new Dictionary<string,string?>{["EMAIL_DELIVERY_ENABLED"]="false"}).Build();
   Check(!await new EmailService(db,disabled,secret,new NeverSend()).Dispatch(CancellationToken.None)&&(await db.Json("SELECT to_jsonb(status) FROM andrade_portal.email_outbox WHERE id=@id",("id",Guid.Parse(queued))))!.ToString()=="processing","Servidor local con envío desactivado no cambia ni consume la cola");
   await db.Execute("UPDATE andrade_portal.email_outbox SET status='pending',claimed_at=NULL WHERE id=@id",("id",Guid.Parse(queued)));
   await portal.UpdateRequest(id,new JsonObject{["status"]="revision",["publicNote"]="La solicitud está en revisión."},"QA");
   Check(await Count(id)==2&&(await portal.Track(reference,token))["events"]!.AsArray().Count==2,"Revisión visible en seguimiento sin correo rutinario");
   await portal.UpdateRequest(id,new JsonObject{["status"]="aprobado",["publicNote"]="Consulta aprobada por el abogado."},"QA");
   Check(await Count(id)==4,"Aprobación de consulta informa a ambos destinatarios");
   await portal.UpdateRequest(id,new JsonObject{["status"]="aprobado",["publicNote"]="Nota pública corregida."},"QA");
   Check(await Count(id)==4,"Corrección rutinaria de nota no duplica correos");
   await portal.Cancel(reference,token);Check(await Count(id)==6,"Cancelación del cliente informa a ambos destinatarios");
   string? slot=null;var today=DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-5));for(var n=1;n<30&&slot==null;n++)slot=(await portal.Slots(today.AddDays(n).ToString("yyyy-MM-dd"))).FirstOrDefault();
   if(slot==null)throw new Exception("No hay horario de prueba.");
   var appointment=JsonNode.Parse(await tools.CreateConsultation("Prueba cita Alma","0990000000","Reserva temporal desde el asistente.",Guid.NewGuid().ToString(),Auth.Token(),true,email,"general","presencial",slot))!;
   entry=await Entry(appointment["reference"]!.ToString());id=Guid.Parse(entry["id"]!.ToString());
   await portal.UpdateRequest(id,new JsonObject{["status"]="confirmado"},"QA");Check(await Count(id)==4,"Cita solicitada por Alma y agendada por admin avisa a ambos");
   await portal.UpdateRequest(id,new JsonObject{["status"]="completado"},"QA");Check(await Count(id)==6,"Finalización de atención avisa a ambos");
   var payload=(await db.Json("SELECT to_jsonb(payload_secret) FROM andrade_portal.email_outbox WHERE request_id=@id AND event_status='confirmado' AND audience='client'",("id",id)))!;
   var html=JsonNode.Parse(secret.Unprotect(payload.ToString()))!["htmlContent"]!.ToString();
   Check(html.Contains("Horario confirmado")&&html.Contains("Ver mi seguimiento"),"Correo de cita de Alma incluye horario y regreso privado");
   var covers=(await portal.Content("services"))!.AsArray();Check(covers.All(s=>Validate.MediaUrl(s!["cover"]?.ToString())&&!string.IsNullOrWhiteSpace(s!["cover"]?.ToString())),"Todos los servicios iniciales tienen una imagen local válida");
  } finally {await db.Execute("DELETE FROM andrade_portal.requests WHERE email=@email",("email",email));}
 }
 private sealed class NeverSend:IHttpClientFactory {public HttpClient CreateClient(string name)=>throw new Exception("No se permite correo real en pruebas.");}
}
