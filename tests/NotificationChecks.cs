using Andrade;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
public static class NotificationChecks
{
 public static async Task Run(Database db,IConfiguration config,HttpClient client)
 {
  var secret=new NotificationSecrets(config);var mail=new EmailService(db,config,secret,new FakeSenders());var p=new Portal(db,mail,secret);
  var marker="notifications-"+Guid.NewGuid().ToString("N");var email=marker+"@example.invalid";var adminId=Guid.NewGuid();Guid? requestId=null;
  void Check(bool ok,string label){if(!ok)throw new Exception("FAIL: "+label);Console.WriteLine("PASS: "+label);}
  async Task Reject(Func<Task> action,string label){try{await action();}catch(PortalException){Console.WriteLine("PASS: "+label);return;}throw new Exception("FAIL: "+label);}
  try {
   var settings=(await p.Settings())!;Check(settings["emailEnabled"]?.GetValue<bool>()!=true,"Validación de notificaciones sin envío real");
   var services=(await p.Content("services"))!.AsArray();Check(services.Any(x=>x!["id"]!.ToString()=="penal")&&services.Any(x=>x!["title"]!.ToString()=="Derecho Laboral"),"Penal y Laboral publicados en servicios");
   Check(settings["weekdays"]!.ToJsonString()=="[1,2,3,4,5]","Atención configurada de lunes a viernes");
   var saturday=DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-5));while(saturday.DayOfWeek!=DayOfWeek.Saturday)saturday=saturday.AddDays(1);Check((await p.Slots(saturday.ToString("yyyy-MM-dd"))).Length==0,"No se ofrecen nuevas citas en sábado");
   var token=Auth.Token();var input=new RequestInput("Prueba notificaciones",email,"0990000000","general","Solicitud temporal de prueba para comunicaciones.","presencial",null,true,Guid.NewGuid().ToString(),token);
   var reference=JsonSerializer.SerializeToNode(await p.CreateRequest(input))!["reference"]!.ToString();var entry=(await p.Requests())!.AsArray().Single(x=>x!["reference"]!.ToString()==reference)!;requestId=Guid.Parse(entry["id"]!.ToString());
   await db.Execute("UPDATE andrade_portal.requests SET private_note='INTERNO-NO-ENVIAR' WHERE id=@id",("id",requestId));
   var message=new JsonObject{["message"]="Novedad para el cliente <script>alert(1)</script>",["updatedAt"]=entry["updatedAt"]!.ToString()};
   await p.SendClientMessage(requestId.Value,message,"QA");await Reject(()=>p.SendClientMessage(requestId.Value,message,"QA"),"Reenvío de novedad con versión antigua no duplica correos");
   var rows=(await db.Json("SELECT jsonb_agg(to_jsonb(o) ORDER BY created_at) FROM andrade_portal.email_outbox o WHERE request_id=@id",("id",requestId)))!.AsArray();Check(rows.Count==4,"Recepción y novedad generan avisos separados a cliente y admin");
   var update=rows.First(x=>x!["event_status"]!.ToString()=="actualizacion"&&x["audience"]!.ToString()=="client")!;
   var html=JsonNode.Parse(secret.Unprotect(update["payload_secret"]!.ToString()))!["htmlContent"]!.ToString();Check(html.Contains("Novedad para el cliente")&&html.Contains("&lt;script&gt;")&&!html.Contains("<script>")&&!html.Contains("INTERNO-NO-ENVIAR"),"Correo incluye mensaje público escapado y excluye notas internas");
   Check(html.Contains("Consulta legal")&&!html.Contains("Horario solicitado"),"Plantilla distingue una consulta sin cita");
   var tracked=await p.Track(reference,token);Check(tracked["events"]!.AsArray().Last()!["status"]!.ToString()=="actualizacion","Seguimiento conserva cada novedad del abogado");
   var receipt=rows.First(x=>x!["audience"]!.ToString()=="client"&&x["event_status"]!.ToString()=="recibido")!;var receiptId=Guid.Parse(receipt["id"]!.ToString());var time=DateTimeOffset.UtcNow.ToUnixTimeSeconds();
   JsonObject Callback(Guid id,string type,long at)=>new(){["event"]=type,["X-Mailin-custom"]="andrade:"+id,["message-id"]="<qa-"+id+">",["ts_event"]=at};
   using(var external=new HttpClient{BaseAddress=client.BaseAddress})Check((await external.PostAsJsonAsync("/api/webhooks/brevo",Callback(receiptId,"delivered",time))).StatusCode==HttpStatusCode.Unauthorized,"Webhook rechaza solicitudes sin autenticación");
   using(var callback=new HttpRequestMessage(HttpMethod.Post,"/api/webhooks/brevo")){callback.Headers.Authorization=new("Bearer",config["BREVO_WEBHOOK_SECRET"]);callback.Content=JsonContent.Create(Callback(receiptId,"delivered",time));Check((await client.SendAsync(callback)).IsSuccessStatusCode,"Webhook autenticado registra entrega real del proveedor");}
   await mail.ReceiveDelivery(Callback(receiptId,"delivered",time));Check((await db.Json("SELECT to_jsonb(count(*)) FROM andrade_portal.email_delivery_events WHERE outbox_id=@id",("id",receiptId)))!.GetValue<int>()==1,"Repetición de webhook no duplica eventos");
   await mail.ReceiveDelivery(Callback(receiptId,"soft_bounce",time-1));await mail.ReceiveDelivery(Callback(receiptId,"deferred",time+1));
   Check((await db.Json("SELECT to_jsonb(delivery_status) FROM andrade_portal.email_outbox WHERE id=@id",("id",receiptId)))!.ToString()=="delivered","Eventos tardíos no revierten una entrega confirmada");
   await db.Execute("UPDATE andrade_portal.email_outbox SET status='uncertain' WHERE id=@id",("id",receiptId));await Reject(()=>mail.Retry(receiptId),"No se permite reenviar un correo cuya entrega ya fue confirmada");
   var updateId=Guid.Parse(update["id"]!.ToString());await mail.ReceiveDelivery(Callback(updateId,"hard_bounce",time));await mail.ReceiveDelivery(Callback(updateId,"blocked",time+1));
   var alerts=(await db.Json("SELECT jsonb_agg(to_jsonb(o)) FROM andrade_portal.email_outbox o WHERE request_id=@id AND event_status='delivery_issue'",("id",requestId)))!.AsArray();Check(alerts.Count==1&&alerts[0]!["audience"]!.ToString()=="admin","Rechazo al cliente genera un solo aviso al administrador");
   await mail.ReceiveDelivery(Callback(Guid.Parse(alerts[0]!["id"]!.ToString()),"hard_bounce",time+2));Check((await db.Json("SELECT to_jsonb(count(*)) FROM andrade_portal.email_outbox WHERE request_id=@id AND event_status='delivery_issue'",("id",requestId)))!.GetValue<int>()==1,"Fallo del correo del administrador no produce un bucle de avisos");
   tracked=await p.Track(reference,token);Check(tracked["notifications"]!.AsArray().Any(x=>x!["deliveryStatus"]!.ToString()=="delivered"),"Cliente puede consultar la confirmación de entrega en su seguimiento");
   await db.Execute("INSERT INTO andrade_portal.admin_users(id,email,password_hash) VALUES(@id,@email,@hash)",("id",adminId),("email",email),("hash",Auth.PasswordHash(Auth.Token())));
   var session=Auth.Token();await db.Execute("INSERT INTO andrade_portal.sessions(token_hash,user_id,expires_at) VALUES(@hash,@id,now()+interval '1 hour')",("hash",Auth.Hash(session)),("id",adminId));var replacement=Auth.Token();
   var recovery=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["ADMIN_EMAIL"]=email,["ADMIN_PASSWORD"]=replacement}).Build();await db.ResetAdmin(recovery);
   Check(Auth.Verify(replacement,(await db.Json("SELECT to_jsonb(password_hash) FROM andrade_portal.admin_users WHERE id=@id",("id",adminId)))!.ToString()),"Recuperación explícita actualiza la contraseña persistida");
   Check((await db.Json("SELECT to_jsonb(count(*)) FROM andrade_portal.sessions WHERE user_id=@id",("id",adminId)))!.GetValue<int>()==0,"Recuperación cierra las sesiones anteriores");
   var readiness=await mail.CheckConfiguration();Check(readiness.Ready,"Comprobador valida configuración y remitente con transporte simulado");
   // Isolated synthetic month: never select or close the live monthly program.
   var aidToken=Auth.Token();var aidRef=JsonSerializer.SerializeToNode(await p.CreateRequest(input with {TrackingToken=aidToken,IdempotencyKey=Guid.NewGuid().ToString()}))!["reference"]!.ToString();
   var fixture=(await p.Requests())!.AsArray().Single(x=>x!["reference"]!.ToString()==aidRef)!;var aidId=Guid.Parse(fixture["id"]!.ToString());var fixturePeriod="2999-12";
   await db.Execute("UPDATE andrade_portal.requests SET service_id='solidarity' WHERE id=@id",("id",aidId));
   await db.Execute("INSERT INTO andrade_portal.solidarity_applications(request_id,period,email_hash,city,circumstances,terms_snapshot) VALUES(@id,@period,@hash,'QA','Contexto técnico temporal','Condiciones de prueba')",("id",aidId),("period",fixturePeriod),("hash",Auth.Hash(email)));
   var aid=(await p.SolidarityRequests(fixturePeriod))!.AsArray().Single(x=>x!["reference"]!.ToString()==aidRef)!;
   await p.DecideSolidarity(aidId,new JsonObject{["decision"]="seleccionado",["updatedAt"]=aid["updatedAt"]!.ToString(),["publicNote"]="Caso de prueba seleccionado para validación."},"QA");
   aid=(await p.SolidarityRequests(fixturePeriod))!.AsArray().Single(x=>x!["reference"]!.ToString()==aidRef)!;
   await p.SendClientMessage(aidId,new JsonObject{["message"]="El abogado coordinará contigo los siguientes pasos del apoyo.",["updatedAt"]=aid["updatedAt"]!.ToString()},"QA");
   Check((await p.Track(aidRef,aidToken))["events"]!.AsArray().Last()!["status"]!.ToString()=="solidarity_actualizacion","Caso solidario seleccionado admite novedades posteriores sin cambiar la decisión");
  } finally {await db.Execute("DELETE FROM andrade_portal.requests WHERE email=@email",("email",email));await db.Execute("DELETE FROM andrade_portal.admin_users WHERE id=@id",("id",adminId));await db.Execute("DELETE FROM andrade_portal.audit_log WHERE target=@email OR (target=@id AND actor='QA')",("email",email),("id",requestId?.ToString()??""));}
 }
 private sealed class FakeSenders:HttpMessageHandler,IHttpClientFactory {
  public HttpClient CreateClient(string name)=>new(this,false);
  protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){if(request.Method!=HttpMethod.Get)throw new Exception("Prohibido enviar correo real en prueba");return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=JsonContent.Create(new{senders=new[]{new{email="abogadoandradenotificaciones@gmail.com",active=true}}})});}
 }
}
