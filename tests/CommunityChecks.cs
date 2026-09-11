using Andrade;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Npgsql;
public static class CommunityChecks
{
 public static async Task Run(Database db, IConfiguration config, HttpClient client)
 {
  var secrets=new NotificationSecrets(config); var mail=new EmailService(db,config,secrets,new NoDelivery()); var p=new Portal(db,mail,secrets);
  var marker="community-"+Guid.NewGuid().ToString("N"); var period=DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).ToString("yyyy-MM");
  var original=(await p.Settings())!; var settings=original.DeepClone();
  void Check(bool ok,string label){if(!ok)throw new Exception("FAIL: "+label);Console.WriteLine("PASS: "+label);}
  async Task Reject(Func<Task> action,string label){try{await action();}catch(PortalException){Console.WriteLine("PASS: "+label);return;}catch(PostgresException e)when(e.SqlState=="23505"){Console.WriteLine("PASS: "+label);return;}throw new Exception("FAIL: "+label);}
  SolidarityInput Input(int n)=>new("Prueba solidaria",marker+n+"@example.invalid","0990000000","Asunto de prueba confidencial para validación técnica.","Babahoyo","CONTEXTO-PRIVADO-"+marker,true,true,Guid.NewGuid().ToString(),Auth.Token());
  async Task<JsonNode> Entry(string reference)=>(await p.SolidarityRequests(period))!.AsArray().Single(n=>n!["reference"]!.ToString()==reference)!;
  async Task<string> Apply(SolidarityInput i)=>JsonSerializer.SerializeToNode(await p.ApplySolidarity(i))!["reference"]!.ToString();
  JsonObject Decision(JsonNode r,string decision)=>new(){["decision"]=decision,["updatedAt"]=r["updatedAt"]!.ToString(),["publicNote"]="Mensaje público de revisión para esta prueba.",["privateNote"]="INTERNO-"+marker};
  try {
   Check(original["emailEnabled"]?.GetValue<bool>()!=true,"Pruebas comunitarias sin envío real de correos");
   Check((await p.SolidarityRequests(period))!.AsArray().Count==0,"Convocatoria de prueba sin postulaciones reales que afectar");
   settings["solidarityEnabled"]=true; settings["solidarityCloseDay"]=28;
   await db.Execute("UPDATE andrade_portal.settings SET data=@data::jsonb WHERE id=true",("data",settings.ToJsonString()));
   await Reject(()=>p.ApplySolidarity(Input(0) with {TermsConsent=false}),"Consentimiento específico obligatorio");
   var first=Input(1);var ref1=await Apply(first);var retry=await Apply(first);Check(ref1==retry,"Reenvío de postulación conserva referencia sin duplicarla");
   await Reject(()=>p.ApplySolidarity(first with {IdempotencyKey=Guid.NewGuid().ToString(),TrackingToken=Auth.Token(),Email=first.Email.ToUpperInvariant()}),"Una postulación por correo normalizado y mes");
   var r1=await Entry(ref1);var id1=Guid.Parse(r1["id"]!.ToString());var tracked=await p.Track(ref1,first.TrackingToken);
   Check(tracked["solidarity"]?["period"]?.ToString()==period&&!tracked.ToJsonString().Contains(marker),"Seguimiento solidario excluye relato, contacto y circunstancias");
   Check(!(await p.Requests())!.ToJsonString().Contains(ref1),"Postulaciones separadas de las citas y CRM ordinario");
   await Reject(()=>p.UpdateRequest(id1,new JsonObject{["status"]="revision"},"QA"),"No se puede eludir la selección desde la API de citas");
   var outbox=(await db.Json("SELECT jsonb_agg(to_jsonb(o)) FROM andrade_portal.email_outbox o WHERE request_id=@id",("id",id1)))!.AsArray();Check(outbox.Count==2,"Postulación y avisos para ambas partes guardados juntos");
   var payload=secrets.Unprotect(outbox[0]!["payload_secret"]!.ToString());Check(!payload.Contains("CONTEXTO-PRIVADO")&&payload.Contains("solidari"),"Correo solidario no incluye relato sensible");
   await p.DecideSolidarity(id1,Decision(r1,"revision"),"QA");await Reject(()=>p.DecideSolidarity(id1,Decision(r1,"seleccionado"),"QA"),"Edición obsoleta rechazada");
   var second=Input(2);var ref2=await Apply(second);var r2=await Entry(ref2);var id2=Guid.Parse(r2["id"]!.ToString());r1=await Entry(ref1);
   async Task<bool> Select(Guid id,JsonNode row){try{await p.DecideSolidarity(id,Decision(row,"seleccionado"),"QA");return true;}catch(PostgresException e)when(e.SqlState=="23505"){return false;}}
   var concurrent=await Task.WhenAll(Select(id1,r1),Select(id2,r2));Check(concurrent.Count(v=>v)==1,"Selecciones simultáneas permiten solo un apoyo por mes");
   await Reject(()=>p.ApplySolidarity(Input(3)),"La selección cierra nuevas postulaciones del mes");
   var winner=concurrent[0]?first:second;var winnerRef=concurrent[0]?ref1:ref2;await p.Cancel(winnerRef,winner.TrackingToken);
   await Reject(async ()=>await p.DecideSolidarity(concurrent[0]?id2:id1,Decision(await Entry(concurrent[0]?ref2:ref1),"seleccionado"),"QA"),"Retirar la solicitud no permite conceder un segundo apoyo mensual");
   var pending=await Entry(concurrent[0]?ref2:ref1);await p.DecideSolidarity(Guid.Parse(pending["id"]!.ToString()),Decision(pending,"no_seleccionado"),"QA");
   Check((await Entry(concurrent[0]?ref2:ref1))["decision"]!.ToString()=="no_seleccionado","El despacho puede cerrar las demás postulaciones con respuesta privada");
   using var publicClient=new HttpClient{BaseAddress=client.BaseAddress};Check((await publicClient.GetAsync("/api/admin/solidarity")).StatusCode==HttpStatusCode.Unauthorized,"Bandeja solidaria protegida sin sesión");
   var program=await publicClient.GetStringAsync("/api/solidarity");Check(!program.Contains(marker)&&program.Contains("false"),"Estado público de convocatoria sin identidad de postulantes");
   var body=new JsonObject{["title"]="Caso QA temporal",["summary"]="Resumen de validación técnica temporal.",["active"]=true,["outcome"]="Resultado temporal para verificación de la publicación.",["publicationReviewed"]=false};
   Check((await client.PutAsJsonAsync("/api/admin/content/cases/"+marker,body)).StatusCode==HttpStatusCode.BadRequest,"Casos no se publican sin revisión de resultado y privacidad");
   body["publicationReviewed"]=true;Check((await client.PutAsJsonAsync("/api/admin/content/cases/"+marker,body)).IsSuccessStatusCode,"Publicación de casos revisados desde CMS");
   Check((await p.Content("cases"))!.ToJsonString().Contains(marker),"Casos publicados visibles en la API pública");
   body["active"]=false;await client.PutAsJsonAsync("/api/admin/content/cases/"+marker,body);Check(!(await p.Content("cases"))!.ToJsonString().Contains(marker),"Retirar publicación oculta el caso conservando el borrador");
   foreach(var kind in new[]{"education","achievements","gallery"}){Check((await client.PutAsJsonAsync("/api/admin/content/"+kind+"/"+marker+"-"+kind,new{title="Trayectoria QA",summary="Contenido temporal de formación y galería",cover="/images/angel-andrade.jpg",active=true})).IsSuccessStatusCode,"CMS de "+kind);}
   var invalid=settings.DeepClone().AsObject();invalid["buildingImage"]="https://malicious.invalid/photo.jpg";await Reject(()=>{Validate.PremiumSettings(invalid);return Task.CompletedTask;},"Foto del edificio limitada a biblioteca del despacho");
   await db.Execute("DELETE FROM andrade_portal.requests WHERE email LIKE @pattern",("pattern",marker+"%@example.invalid"));settings["solidarityEnabled"]=false;await db.Execute("UPDATE andrade_portal.settings SET data=@data::jsonb WHERE id=true",("data",settings.ToJsonString()));await Reject(()=>p.ApplySolidarity(Input(4)),"Convocatoria pausada rechaza nuevos envíos en servidor");
  } finally {await db.Execute("DELETE FROM andrade_portal.requests WHERE email LIKE @pattern",("pattern",marker+"%@example.invalid"));await db.Execute("DELETE FROM andrade_portal.content WHERE id LIKE @pattern",("pattern",marker+"%"));await db.Execute("DELETE FROM andrade_portal.audit_log WHERE target LIKE @pattern",("pattern",marker+"%"));await db.Execute("UPDATE andrade_portal.settings SET data=@data::jsonb WHERE id=true",("data",original.ToJsonString()));}
 }
 private sealed class NoDelivery:IHttpClientFactory{public HttpClient CreateClient(string name)=>throw new Exception("No está permitido enviar correos reales en estas pruebas.");}
}
