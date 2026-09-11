using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace Andrade;
public sealed partial class EmailService
{
 public async Task ReceiveDelivery(JsonObject body)
 {
  var eventName=body["event"]?.ToString()??"";
  var state=eventName switch {"delivered"=>"delivered","soft_bounce" or "deferred"=>"deferred","hard_bounce"=>"bounced","blocked" or "invalid" or "error"=>"blocked","spam"=>"complaint",_=>""};
  if(state=="")return;
  var provider=(body["message-id"]?.ToString()??"").Trim('<','>');
  if(provider.Length>300)return;
  var custom=body["X-Mailin-custom"]?.ToString()??"";var match=Regex.Match(custom,@"^andrade:([a-fA-F0-9-]{36})$");
  Guid? customId=match.Success&&Guid.TryParse(match.Groups[1].Value,out var parsed)?parsed:null;
  if(provider==""&&customId==null)return;
  if(!long.TryParse((body["ts_event"]??body["ts"])?.ToString(),out var timestamp)||timestamp<0||timestamp>DateTimeOffset.UtcNow.AddDays(1).ToUnixTimeSeconds())return;
  var at=DateTimeOffset.FromUnixTimeSeconds(timestamp);
  await using var c=await db.Source.OpenConnectionAsync();await using var tx=await c.BeginTransactionAsync();
  await using var find=Database.Command(c,"SELECT to_jsonb(o) FROM andrade_portal.email_outbox o WHERE (@provider<>'' AND btrim(provider_id,'<>')=@provider) OR id=@custom::uuid FOR UPDATE",("provider",provider),("custom",customId));
  var raw=await find.ExecuteScalarAsync();if(raw==null)return;
  var row=JsonNode.Parse(raw.ToString()!)!;var id=Guid.Parse(row["id"]!.ToString());
  var key=Auth.Hash(id+"|"+eventName+"|"+timestamp+"|"+provider);
  await using(var insert=Database.Command(c,"INSERT INTO andrade_portal.email_delivery_events(event_key,outbox_id,event,occurred_at) VALUES(@key,@id,@event,@at) ON CONFLICT DO NOTHING",("key",key),("id",id),("event",eventName),("at",at))) if(await insert.ExecuteNonQueryAsync()==0){await tx.CommitAsync();return;}
  var previous=row["delivery_status"]!.ToString();
  var latest=row["delivery_at"]==null||at>=DateTimeOffset.Parse(row["delivery_at"]!.ToString());
  // A late soft bounce must not undo delivery or a final rejection.
  var terminal=previous is "delivered" or "bounced" or "blocked" or "complaint";
  if(latest&&!(terminal&&state=="deferred")&&previous!="complaint") {
   await using(var update=Database.Command(c,"UPDATE andrade_portal.email_outbox SET delivery_status=@state,delivery_at=@at WHERE id=@id",("id",id),("state",state),("at",at)))await update.ExecuteNonQueryAsync();
   if(row["audience"]!.ToString()=="client"&&state is "bounced" or "blocked" or "complaint")await Queue(c,Guid.Parse(row["request_id"]!.ToString()),"delivery_issue","delivery:"+id,"admin");
  }
  await tx.CommitAsync();
 }
}
