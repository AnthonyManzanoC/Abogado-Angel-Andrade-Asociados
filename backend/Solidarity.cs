using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Npgsql;
namespace Andrade;
public record SolidarityInput(string Name, string Email, string Phone, string Message, string City, string Circumstances, bool Consent, bool TermsConsent, string IdempotencyKey, string TrackingToken, string? Website = null);
public sealed partial class Portal
{
    private static DateTimeOffset EcuadorNow() => DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5));
    private static async Task MonthLock(NpgsqlConnection c, string period) { await using var cmd = Database.Command(c, "SELECT pg_advisory_xact_lock(hashtext('solidarity:'||@period))", ("period", period)); await cmd.ExecuteNonQueryAsync(); }
    public async Task<object> SolidarityProgram()
    {
        var s = (await Settings())!; var now = EcuadorNow(); var period = now.ToString("yyyy-MM");
        var selected = await db.Json("SELECT to_jsonb(count(*)>0) FROM andrade_portal.solidarity_applications WHERE period=@period AND selected_at IS NOT NULL", ("period", period));
        var day = s["solidarityCloseDay"]?.GetValue<int>() ?? 25;
        return new { period, deadline = period + "-" + day.ToString("00"), open = s["solidarityEnabled"]?.GetValue<bool>() == true && now.Day <= day && selected?.GetValue<bool>() != true, awarded = selected?.GetValue<bool>() == true };
    }
    public Task<object> ApplySolidarity(SolidarityInput i)
    {
        Validate.Text(i.City, 2, 120, "ciudad"); Validate.Text(i.Circumstances, 20, 2000, "situación de vulnerabilidad");
        if (!i.TermsConsent) throw new PortalException("Debes aceptar las condiciones del programa.");
        return CreateRequest(new(i.Name, i.Email, i.Phone, "solidarity", i.Message, "presencial", null, i.Consent, i.IdempotencyKey, i.TrackingToken, i.Website), i);
    }
    private async Task<string> PrepareSolidarity(NpgsqlConnection c, SolidarityInput i)
    {
        var now = EcuadorNow(); var period = now.ToString("yyyy-MM"); await MonthLock(c, period);
        await using var cmd = Database.Command(c, "SELECT data FROM andrade_portal.settings WHERE id=true FOR SHARE");
        var s = JsonNode.Parse((await cmd.ExecuteScalarAsync())!.ToString()!)!;
        if (s["solidarityEnabled"]?.GetValue<bool>() != true || now.Day > (s["solidarityCloseDay"]?.GetValue<int>() ?? 25)) throw new PortalException("La convocatoria está cerrada. Consulta el próximo mes.", 409);
        await using var selected = Database.Command(c, "SELECT count(*) FROM andrade_portal.solidarity_applications WHERE period=@period AND selected_at IS NOT NULL", ("period", period));
        if ((long)(await selected.ExecuteScalarAsync())! > 0) throw new PortalException("El caso de este mes ya fue seleccionado. Puedes postular el próximo mes.", 409);
        await using var duplicate = Database.Command(c, "SELECT count(*) FROM andrade_portal.solidarity_applications WHERE period=@period AND email_hash=@hash", ("period", period), ("hash", Auth.Hash(i.Email.Trim().ToLowerInvariant())));
        if ((long)(await duplicate.ExecuteScalarAsync())! > 0) throw new PortalException("Ya hay una postulación con este correo este mes. Usa tu enlace privado de seguimiento.", 409);
        return period;
    }
    private async Task InsertSolidarity(NpgsqlConnection c, Guid id, SolidarityInput i, string period)
    {
        await using var cmd = Database.Command(c, "INSERT INTO andrade_portal.solidarity_applications(request_id,period,email_hash,city,circumstances,terms_snapshot) SELECT @id,@period,@hash,@city,@circumstances,data->>'solidarityTerms' FROM andrade_portal.settings WHERE id=true", ("id", id), ("period", period), ("hash", Auth.Hash(i.Email.Trim().ToLowerInvariant())), ("city", i.City.Trim()), ("circumstances", i.Circumstances.Trim())); await cmd.ExecuteNonQueryAsync();
        await Event(c, id, "solidarity_recibido", "Postulación privada recibida. El abogado evaluará la situación y viabilidad. No se requiere pago para postular.");
    }
    public Task<JsonNode?> SolidarityRequests(string? period)
    {
        period ??= EcuadorNow().ToString("yyyy-MM"); if (!Regex.IsMatch(period, @"^\d{4}-(0[1-9]|1[0-2])$")) throw new PortalException("Mes no válido.");
        return db.Json("SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'name',r.name,'email',r.email,'phone',r.phone,'message',r.message,'city',a.city,'circumstances',a.circumstances,'period',a.period,'decision',a.decision,'status',r.status,'publicNote',r.public_note,'privateNote',r.private_note,'updatedAt',r.updated_at,'createdAt',r.created_at,'terms',a.terms_snapshot,'reviewedBy',a.reviewed_by) ORDER BY r.created_at),'[]'::jsonb) FROM andrade_portal.solidarity_applications a JOIN andrade_portal.requests r ON r.id=a.request_id WHERE a.period=@period", ("period", period));
    }
    public async Task DecideSolidarity(Guid id, JsonObject body, string actor)
    {
        var decision = body["decision"]?.ToString() ?? "";
        if (!new[] { "revision", "seleccionado", "no_seleccionado" }.Contains(decision)) throw new PortalException("Decisión no válida.");
        var note = body["publicNote"]?.ToString() ?? ""; var privateNote = body["privateNote"]?.ToString() ?? "";
        Validate.Text(note, 10, 2000, "mensaje para la persona"); if (privateNote.Length > 4000) throw new PortalException("Nota privada demasiado larga.");
        var a = await db.Json("SELECT to_jsonb(a) FROM andrade_portal.solidarity_applications a WHERE request_id=@id", ("id", id)) ?? throw new PortalException("Postulación no encontrada.", 404);
        await using var c = await db.Source.OpenConnectionAsync(); await using var tx = await c.BeginTransactionAsync(); await MonthLock(c, a["period"]!.ToString());
        var r = await LockRequest(c, id);
        if (!DateTimeOffset.TryParse(body["updatedAt"]?.ToString(), out var version) || version != DateTimeOffset.Parse(r["updated_at"]!.ToString())) throw new PortalException("Esta postulación cambió. Actualiza la bandeja antes de continuar.", 409);
        if (r["status"]!.ToString() == "cancelado") throw new PortalException("La persona retiró su solicitud.", 409);
        await using var current = Database.Command(c, "SELECT decision FROM andrade_portal.solidarity_applications WHERE request_id=@id", ("id", id)); var previous = (string)(await current.ExecuteScalarAsync())!;
        if (previous is "seleccionado" or "no_seleccionado") throw new PortalException("La decisión final ya fue registrada.", 409);
        await using (var update = Database.Command(c, "UPDATE andrade_portal.solidarity_applications SET decision=@decision,reviewed_by=@actor,selected_at=CASE WHEN @decision='seleccionado' THEN now() ELSE selected_at END WHERE request_id=@id", ("id", id), ("decision", decision), ("actor", actor))) await update.ExecuteNonQueryAsync();
        await using (var update = Database.Command(c, "UPDATE andrade_portal.requests SET status=@status,public_note=@note,private_note=@private,updated_at=now() WHERE id=@id", ("id", id), ("status", decision == "revision" ? "revision" : decision == "seleccionado" ? "aprobado" : "completado"), ("note", note), ("private", privateNote))) await update.ExecuteNonQueryAsync();
        if (decision != previous || note != r["public_note"]?.ToString()) { await Event(c, id, "solidarity_" + decision, note); await email.Queue(c, id, "solidarity_" + decision); }
        await tx.CommitAsync();
    }
}
