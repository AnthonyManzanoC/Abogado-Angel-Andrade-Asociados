using System.Net;
using System.Text.Json.Nodes;
namespace Andrade;
public static class EmailTemplate
{
 public static string Render(JsonNode r, JsonNode s, string eventStatus, string audience, string destination)
 {
  string R(string k)=>r[k]?.ToString()??""; string S(string k)=>s[k]?.ToString()??""; string H(string v)=>WebUtility.HtmlEncode(v);
  var aid=R("service_id")=="solidarity";var appointment=R("appointment_at")!="";var admin=audience=="admin";
  var type=aid?"Apoyo solidario":appointment?"Cita legal":"Consulta legal";
  var title=EmailService.Label(eventStatus);
  var next=eventStatus switch {
   "recibido"=>"Recibimos tu solicitud. El despacho revisará los datos y te comunicará los siguientes pasos.",
   "revision"=>"El despacho está revisando tu solicitud. Puedes consultar las novedades en tu seguimiento privado.",
   "aprobado"=>"Tu solicitud fue aprobada. Consulta los pasos pendientes; la fecha queda confirmada cuando el estado sea Agendada.",
   "pendiente_pago"=>"Completa la transferencia indicada y registra la referencia en tu seguimiento. El despacho verificará el ingreso antes de agendar.",
   "pago_revision"=>"Recibimos la referencia de tu transferencia. La confirmación depende de la comprobación bancaria del despacho.",
   "pago_verificado"=>"El despacho verificó el ingreso de la transferencia. Consulta el estado y los datos de tu cita en el seguimiento.",
   "confirmado"=>"Tu cita está agendada. Conserva este correo y revisa la fecha, la modalidad y los datos de acceso.",
   "completado"=>"El despacho ha marcado esta atención como completada. Puedes regresar al seguimiento para consultar el historial.",
   "cancelado"=>aid?"La postulación fue retirada o cancelada. Puedes consultar su historial en el enlace privado.":"La solicitud fue cancelada. Si realizaste un pago, contacta al despacho para coordinar los siguientes pasos.",
   "solidarity_recibido"=>"Tu postulación fue recibida de forma privada. El abogado valorará necesidad, viabilidad y alcance. Postular no tiene costo ni garantiza selección.",
   "solidarity_revision"=>"El abogado está revisando tu postulación al programa mensual. No necesitas realizar ningún pago.",
   "solidarity_seleccionado"=>"Tu caso fue seleccionado para el apoyo mensual. El despacho coordinará contigo el alcance de la atención y los siguientes pasos.",
   "solidarity_no_seleccionado"=>"Tu caso no fue seleccionado en esta convocatoria. Puedes consultar el mensaje del abogado y las condiciones de futuras convocatorias.",
   "delivery_issue"=>"Brevo informó un problema al entregar un aviso al cliente. Revisa la bandeja de notificaciones y comprueba el correo o contacta directamente con la persona.",
   _=>"El abogado compartió una novedad. Consulta el mensaje y el historial en tu seguimiento privado." };
  if(admin && eventStatus!="delivery_issue") next="Se registró una novedad en "+type.ToLowerInvariant()+". Revisa la solicitud en el administrador. El aviso del cliente tiene su propio estado de entrega.";
  var date=appointment?DateTimeOffset.Parse(R("appointment_at")).ToOffset(TimeSpan.FromHours(-5)).ToString("dd/MM/yyyy HH:mm")+" · Ecuador (UTC−5)":"";
  var info=appointment?"<p><strong>Horario "+(R("status")=="confirmado"?"confirmado":"solicitado")+":</strong> "+H(date)+"<br><strong>Modalidad:</strong> "+H(R("mode"))+"</p>":"";
  if(appointment&&R("status")=="confirmado"&&R("mode")=="presencial")info+="<p><strong>Dirección:</strong> "+H(S("address"))+" · "+H(S("city"))+"</p>";
  var note=R("public_note");var noteHtml=note!=""&&eventStatus is not "recibido" and not "solidarity_recibido" and not "delivery_issue"?"<div style='background:#f5f2ec;padding:20px;border-left:3px solid #b99760'><strong>Mensaje del despacho</strong><p style='white-space:pre-line'>"+H(note)+"</p></div>":"";
  var bank="";if(!aid&&!admin&&R("payment_status") is "pendiente" or "revision"&&R("status") is not "cancelado" and not "completado")bank=r["payment_test"]?.GetValue<bool>()==true?"<p><strong>DEMOSTRACIÓN: no realices transferencias. Los datos reales aún no están activados.</strong></p>":"<h2>Transferencia para la consulta virtual</h2><p>Valor: USD "+H(R("payment_amount"))+"</p><p style='white-space:pre-line'>"+H(R("payment_instructions"))+"</p>";
  var meeting=appointment&&R("status")=="confirmado"&&Validate.MeetingUrl(R("meeting_url"))?"<p><a href='"+H(R("meeting_url"))+"'>Entrar a la videollamada</a></p>":"";
  var action=destination==""?"<p>Conserva el comprobante obtenido en la web para consultar el seguimiento.</p>":"<p><a style='display:inline-block;padding:15px 22px;background:#d2b879;color:#111719;text-decoration:none;border-radius:6px' href='"+H(destination)+"'>"+(admin?"Abrir administrador":"Ver mi seguimiento")+"</a></p>";
  var when=DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).ToString("dd/MM/yyyy HH:mm");
  return "<html lang='es'><body style='margin:0;background:#eeeae2;color:#252d2a;font-family:Arial,sans-serif;padding:24px'><main style='max-width:620px;margin:auto;background:#fff;border-radius:10px;overflow:hidden'><header style='padding:28px;background:#151d1b;color:#d2b879'><p style='letter-spacing:2px'>"+H(S("name"))+"</p><strong>"+H(type)+" · "+H(R("reference"))+"</strong></header><div style='padding:30px'><h1 style='font-size:26px'>"+H(title)+"</h1><p>"+(admin?"Hola, equipo del despacho.":"Hola, "+H(R("name"))+".")+"</p><p style='line-height:1.7'>"+H(next)+"</p>"+info+noteHtml+bank+action+meeting+"<p style='font-size:13px;color:#657068'>Este aviso corresponde a la novedad registrada el "+when+" (Ecuador). El seguimiento muestra el estado más reciente. Conserva su enlace de forma privada.</p><p style='font-size:13px'>"+H(S("hours"))+"<br>"+H(S("phone"))+"</p></div></main></body></html>";
 }
}
