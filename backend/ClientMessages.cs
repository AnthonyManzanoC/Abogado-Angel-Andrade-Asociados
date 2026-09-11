using System.Text.Json.Nodes;
namespace Andrade;
public sealed partial class Portal
{
    public async Task SendClientMessage(Guid id, JsonObject body, string actor)
    {
        var message = body["message"]?.ToString().Trim() ?? ""; Validate.Text(message, 10, 2000, "mensaje para el cliente");
        await using var c = await db.Source.OpenConnectionAsync(); await using var tx = await c.BeginTransactionAsync();
        var row = await LockRequest(c, id);
        if (!DateTimeOffset.TryParse(body["updatedAt"]?.ToString(), out var version) || version != DateTimeOffset.Parse(row["updated_at"]!.ToString())) throw new PortalException("La solicitud cambió. Actualízala antes de enviar la novedad.", 409);
        if (message == row["public_note"]?.ToString()) throw new PortalException("Este mensaje ya está guardado. Escribe una novedad diferente.", 409);
        await using (var update = Database.Command(c, "UPDATE andrade_portal.requests SET public_note=@note,updated_at=now() WHERE id=@id", ("id", id), ("note", message))) await update.ExecuteNonQueryAsync();
        var status = row["service_id"]?.ToString() == "solidarity" ? "solidarity_actualizacion" : "actualizacion";
        await Event(c, id, status, message); await email.Queue(c, id, status);
        await using (var audit = Database.Command(c, "INSERT INTO andrade_portal.audit_log(actor,action,target) VALUES(@actor,'request.message',@target)", ("actor", actor), ("target", id.ToString()))) await audit.ExecuteNonQueryAsync();
        await tx.CommitAsync();
    }
}
