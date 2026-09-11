using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Andrade;
using Microsoft.Extensions.Configuration;

var root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../"));
// Pass the repository path explicitly when using a custom output directory.
if(args.Length>0)root=Path.GetFullPath(args[0]);
var config=new ConfigurationBuilder().AddJsonFile(Path.Combine(root,"backend","appsettings.Local.json")).Build();
config["PGSSLROOTCERT"]=Path.Combine(root,"backend","certs","supabase-ca.crt");
await using var db=new Database(config);
using var handler=new HttpClientHandler{CookieContainer=new CookieContainer()};
using var client=new HttpClient(handler){BaseAddress=new Uri(Environment.GetEnvironmentVariable("TEST_API_URL") ?? "http://127.0.0.1:5080"),Timeout=TimeSpan.FromSeconds(35)};
client.DefaultRequestHeaders.Add("X-Portal-Client","web");client.DefaultRequestHeaders.Add("Origin","http://127.0.0.1:3000");
var runId=Guid.NewGuid().ToString("N");var email="test-"+runId+"@example.invalid";var contentIds=new List<string>();Guid? mediaId=null;string? sessionHash=null;var passed=0;
void Check(bool ok,string label){if(!ok)throw new Exception("FAIL: "+label);Console.WriteLine("PASS: "+label);passed++;}
async Task<JsonNode> Read(HttpResponseMessage response){var text=await response.Content.ReadAsStringAsync();if(!response.IsSuccessStatusCode)throw new Exception("HTTP "+(int)response.StatusCode+": "+text);return JsonNode.Parse(text)!;}
async Task<HttpResponseMessage> Post(string path,object body)=>await client.PostAsJsonAsync(path,body);
object Request(string slot,string idem,string token,bool consent=true)=>new{name="Prueba técnica "+runId,email,phone="0990000000",serviceId="general",message="Solicitud temporal para validar el funcionamiento del portal.",mode="presencial",appointmentAt=slot,consent,idempotencyKey=idem,trackingToken=token};
try{
 Check((await client.GetAsync("/api/health")).IsSuccessStatusCode,"API y PostgreSQL disponibles");
 Check((await client.GetAsync("/api/admin/requests")).StatusCode==HttpStatusCode.Unauthorized,"CRM protegido sin sesión");
 using(var forbidden=new HttpRequestMessage(HttpMethod.Post,"/api/requests")){forbidden.Headers.Add("Origin","https://example.invalid");forbidden.Content=JsonContent.Create(new{});Check((await client.SendAsync(forbidden)).StatusCode==HttpStatusCode.Forbidden,"Bloqueo de origen externo");}
 Check((await Post("/api/admin/login",new{email="nobody@example.invalid",password="incorrect-password"})).StatusCode==HttpStatusCode.Unauthorized,"Contraseña incorrecta rechazada");
 var auth=await Read(await Post("/api/admin/login",new{email=config["ADMIN_EMAIL"],password=config["ADMIN_PASSWORD"]}));
 Check(auth["email"]!.ToString()==config["ADMIN_EMAIL"],"Inicio de sesión administrativo real");
 var cookie=handler.CookieContainer.GetCookies(client.BaseAddress)["aa_session"]!;sessionHash=Auth.Hash(cookie.Value);Check(cookie.HttpOnly,"Cookie de sesión HttpOnly");
 var s=await Read(await client.GetAsync("/api/admin/settings"));Check(s["name"]!.ToString().Contains("Andrade"),"Configuración persistida en Supabase");
 var settingUpdate=(JsonObject)s.DeepClone();settingUpdate["hours"]="Prueba temporal de horario "+runId;
 await Read(await client.PutAsJsonAsync("/api/admin/settings",settingUpdate));var visible=await Read(await client.GetAsync("/api/public"));Check(visible["settings"]!["hours"]!.ToString()==settingUpdate["hours"]!.ToString(),"Cambios de CMS visibles en API pública");
 await Read(await client.PutAsJsonAsync("/api/admin/settings",s));
 for(int i=0;i<8;i++){var id="qa-"+runId+"-"+i;contentIds.Add(id);await Read(await client.PutAsJsonAsync("/api/admin/content/posts/"+id,new{id,title="Publicación de prueba "+i,summary="Contenido temporal para validación de paginación.",description="Validación técnica temporal.",kind="article",category="Actualidad",active=i>0,sortOrder=9000+i,cover="",url=""}));}
 Check((await client.GetAsync("/api/posts/"+contentIds[0])).StatusCode==HttpStatusCode.NotFound,"Los borradores no son públicos");
 var page1=await Read(await client.GetAsync("/api/posts?category=Actualidad&search=Publicaci%C3%B3n%20de%20prueba&limit=3&offset=0"));var page2=await Read(await client.GetAsync("/api/posts?category=Actualidad&search=Publicaci%C3%B3n%20de%20prueba&limit=3&offset=3"));
 Check(page1["hasMore"]!.GetValue<bool>()&&page1["items"]!.AsArray().Count==3&&page2["items"]!.AsArray().Count==3,"Paginación real de vitrina legal");Check(!page1["items"]!.AsArray().Any(a=>page2["items"]!.AsArray().Any(b=>a!["id"]!.ToString()==b!["id"]!.ToString())),"Páginas de publicaciones sin duplicados");
 var bytes=await File.ReadAllBytesAsync(Path.Combine(root,"frontend/public/images/angel-andrade-profile.jpg"));using(var form=new MultipartFormDataContent()){form.Add(new ByteArrayContent(bytes),"file","qa-"+runId+".jpg");var upload=await Read(await client.PostAsync("/api/admin/media",form));mediaId=Guid.Parse(upload["id"]!.ToString());using var request=new HttpRequestMessage(HttpMethod.Get,upload["url"]!.ToString());request.Headers.Range=new(0,31);var range=await client.SendAsync(request);Check(range.StatusCode==HttpStatusCode.PartialContent&&(await range.Content.ReadAsByteArrayAsync()).SequenceEqual(bytes[..32]),"Carga durable y reproducción con HTTP Range");}
 var ticket=await Read(await Post("/api/admin/upload-ticket",new{}));
 using(var preflight=new HttpRequestMessage(HttpMethod.Options,"/api/uploads")){preflight.Headers.Add("Access-Control-Request-Method","POST");preflight.Headers.Add("Access-Control-Request-Headers","authorization,x-portal-client");var response=await client.SendAsync(preflight);Check(response.StatusCode==HttpStatusCode.NoContent&&response.Headers.Contains("Access-Control-Allow-Origin"),"Preflight CORS de carga directa autorizado");}
 async Task<HttpResponseMessage> DirectUpload(){var form=new MultipartFormDataContent();form.Add(new ByteArrayContent(bytes),"file","qa-direct-"+runId+".jpg");var request=new HttpRequestMessage(HttpMethod.Post,ticket["url"]!.ToString()){Content=form};request.Headers.Add("Authorization","Bearer "+ticket["token"]!.ToString());return await client.SendAsync(request);}
 var direct=await Read(await DirectUpload());Check(direct["id"]!=null,"Carga directa a la API sin límites de proxy de Vercel");await db.Execute("DELETE FROM andrade_portal.media WHERE id=@id",("id",Guid.Parse(direct["id"]!.ToString())));Check((await DirectUpload()).StatusCode==HttpStatusCode.Unauthorized,"Permiso de carga consumido una sola vez");
 using(var badFile=new MultipartFormDataContent()){badFile.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("<html><script>alert(1)</script></html>")),"file","unsafe.jpg");Check((await client.PostAsync("/api/admin/media",badFile)).StatusCode==HttpStatusCode.BadRequest,"Archivos ejecutables disfrazados rechazados");}
 string? slot=null;var today=DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-5));for(var day=1;day<=15&&slot==null;day++){var available=await Read(await client.GetAsync("/api/availability?date="+today.AddDays(day).ToString("yyyy-MM-dd")));slot=available["slots"]!.AsArray().FirstOrDefault()?.ToString();}if(slot==null)throw new Exception("No hay un turno configurado para ejecutar la prueba.");
 var idem=Guid.NewGuid().ToString();var token=Auth.Token();
 Check((await Post("/api/requests",Request(slot,idem,token,false))).StatusCode==HttpStatusCode.BadRequest,"Consentimiento obligatorio validado en servidor");
 var invalid=Request("2020-01-01T09:00:00-05:00",idem,token);Check((await Post("/api/requests",invalid)).StatusCode==HttpStatusCode.BadRequest||(await Post("/api/requests",invalid)).StatusCode==HttpStatusCode.Conflict,"Fechas pasadas rechazadas");
 var first=await Read(await Post("/api/requests",Request(slot,idem,token)));var reference=first["reference"]!.ToString();Check(first["status"]!.ToString()=="recibido","Solicitud guardada como pendiente");
 var duplicate=await Read(await Post("/api/requests",Request(slot,idem,token)));Check(duplicate["reference"]!.ToString()==reference,"Reintento idempotente sin duplicar consulta");
 Check((await Post("/api/requests",Request(slot,Guid.NewGuid().ToString(),Auth.Token()))).StatusCode==HttpStatusCode.Conflict,"Horario ocupado rechazado");
 Check((await Post("/api/track",new{reference,token=Auth.Token()})).StatusCode==HttpStatusCode.NotFound,"Clave ajena no permite consultar datos");
 var all=await Read(await client.GetAsync("/api/admin/requests"));var entry=all.AsArray().Single(r=>r!["reference"]!.ToString()==reference)!;var idRequest=entry["id"]!.ToString();await Read(await client.PutAsJsonAsync("/api/admin/requests/"+idRequest,new{status="confirmado",publicNote="Cita confirmada para prueba.",privateNote="INTERNO-NO-PUBLICAR-"+runId}));
 var tracked=await Read(await Post("/api/track",new{reference,token}));Check(tracked["status"]!.ToString()=="confirmado"&&tracked["events"]!.AsArray().Count==2,"Actualización administrativa reflejada en seguimiento");Check(!tracked.ToJsonString().Contains("INTERNO-NO-PUBLICAR")&&!tracked.ToJsonString().Contains(email),"Seguimiento excluye notas internas y datos de contacto");
 await Read(await Post("/api/track/cancel",new{reference,token}));var freeAgain=await Read(await client.GetAsync("/api/availability?date="+slot[..10]));Check(freeAgain["slots"]!.AsArray().Any(n=>n!.ToString()==slot),"Cancelación libera el horario");
 var simultaneous=await Task.WhenAll(Post("/api/requests",Request(slot,Guid.NewGuid().ToString(),Auth.Token())),Post("/api/requests",Request(slot,Guid.NewGuid().ToString(),Auth.Token())));Check(simultaneous.Count(r=>r.IsSuccessStatusCode)==1&&simultaneous.Count(r=>r.StatusCode==HttpStatusCode.Conflict)==1,"Reservas simultáneas: solo una ocupa el horario");
 Check((await client.GetAsync("/mcp")).StatusCode==HttpStatusCode.Unauthorized,"Servidor MCP protegido por token");
 async Task<JsonNode> Mcp(string method,object body,int id){using var request=new HttpRequestMessage(HttpMethod.Post,"/mcp");request.Headers.Add("Authorization","Bearer "+config["MCP_API_KEY"]);request.Headers.Add("Accept","application/json, text/event-stream");request.Headers.Add("MCP-Protocol-Version","2025-11-25");request.Content=JsonContent.Create(new{jsonrpc="2.0",id,method,@params=body});var response=await client.SendAsync(request);var text=await response.Content.ReadAsStringAsync();if(!response.IsSuccessStatusCode)throw new Exception("MCP HTTP "+response.StatusCode+": "+text);if(text.StartsWith("event:")||text.StartsWith("data:"))text=text.Split('\n').First(line=>line.StartsWith("data:")).Substring(5).Trim();return JsonNode.Parse(text)!;}
 var init=await Mcp("initialize",new{protocolVersion="2025-11-25",capabilities=new{},clientInfo=new{name="andrade-integration-test",version="1.0"}},1);Check(init["result"]?["protocolVersion"]!=null,"Negociación MCP con SDK oficial");var tools=await Mcp("tools/list",new{},2);Check(tools["result"]!["tools"]!.AsArray().Count==6,"Seis herramientas MCP descubiertas");var result=await Mcp("tools/call",new{name="list_services",arguments=new{}},3);Check(result["result"]?["content"]!=null&&result["result"]?["isError"]?.ToString()!="true","Ejecución MCP de servicios");
 var schema=await db.Json("SELECT jsonb_build_object('tables',count(*),'secured',bool_and(relrowsecurity)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='andrade_portal' AND c.relkind='r'");Check(schema!["tables"]!.GetValue<int>()>=9&&schema["secured"]!.GetValue<bool>(),"Tablas de Supabase con RLS activado");
 var persisted=await db.Json("SELECT jsonb_build_object('count',count(*)) FROM andrade_portal.requests WHERE email=@email",("email",email));Check(persisted!["count"]!.GetValue<int>()==2,"Solicitudes confirmadas directamente en PostgreSQL");
 using var web=new HttpClient(handler,false){BaseAddress=new Uri(Environment.GetEnvironmentVariable("TEST_WEB_URL") ?? "http://127.0.0.1:3000"),Timeout=TimeSpan.FromSeconds(60)};foreach(var path in new[]{"/","/firma","/servicios","/servicios/familia","/vitrina","/consulta","/seguimiento","/contacto","/privacidad","/admin","/api/health","/api/admin/me"})Check((await web.GetAsync(path)).IsSuccessStatusCode,"Ruta frontend "+path);
 await PremiumChecks.Run(db,config);
 var currentPeriod=DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).ToString("yyyy-MM");
 var currentApplications=(await db.Json("SELECT to_jsonb(count(*)) FROM andrade_portal.solidarity_applications WHERE period=@period",("period",currentPeriod)))!.GetValue<int>();
 if(currentApplications==0)await CommunityChecks.Run(db,config,client);
 else Console.WriteLine("SKIP: Selección de la convocatoria actual: existen postulaciones reales. Se conservan sin modificaciones.");
 await NotificationChecks.Run(db,config,client);
 Console.WriteLine($"\n{passed} verificaciones completadas. Se eliminarán todos los registros temporales.");
}finally{
 await db.Execute("DELETE FROM andrade_portal.requests WHERE email=@email",("email",email));
 foreach(var id in contentIds)await db.Execute("DELETE FROM andrade_portal.content WHERE id=@id",("id",id));
 if(mediaId!=null)await db.Execute("DELETE FROM andrade_portal.media WHERE id=@id",("id",mediaId));
 if(sessionHash!=null)await db.Execute("DELETE FROM andrade_portal.sessions WHERE token_hash=@hash",("hash",sessionHash));
 await db.Execute("DELETE FROM andrade_portal.audit_log WHERE target LIKE @pattern",("pattern","qa-"+runId+"-%"));
 Console.WriteLine("Datos temporales eliminados.");
}
