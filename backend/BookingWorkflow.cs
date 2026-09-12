using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Npgsql;

namespace Andrade;
public sealed partial class Portal
{
    public async Task<JsonNode> Track(string reference, string token)
    {
        if (!Regex.IsMatch(reference ?? "", @"^AA-[A-F0-9]{12}$") || !Regex.IsMatch(token ?? "", @"^[a-f0-9]{64}$")) throw new PortalException("Código o clave de seguimiento incorrectos.", 404);
        return await db.Json("""
            SELECT jsonb_build_object('solidarity',(SELECT jsonb_build_object('period',a.period,'decision',a.decision) FROM andrade_portal.solidarity_applications a WHERE a.request_id=r.id),'reference',r.reference,'status',r.status,'serviceId',r.service_id,'mode',r.mode,
            'appointmentAt',r.appointment_at,'publicNote',r.public_note,'createdAt',r.created_at,'updatedAt',r.updated_at,
            'paymentStatus',r.payment_status,'paymentAmount',r.payment_amount,'paymentTest',r.payment_test,
            'paymentInstructions',CASE WHEN r.payment_test THEN 'DEMOSTRACIÓN. No realices transferencias. Contacta al despacho.' ELSE r.payment_instructions END,
            'paymentReference',r.payment_reference,'meetingUrl',CASE WHEN r.status='confirmado' THEN r.meeting_url ELSE '' END,
            'notifications',COALESCE((SELECT jsonb_agg(jsonb_build_object('eventStatus',o.event_status,'status',o.status,'deliveryStatus',o.delivery_status,'deliveryAt',o.delivery_at,'createdAt',o.created_at,'acceptedAt',o.accepted_at) ORDER BY o.created_at) FROM andrade_portal.email_outbox o WHERE o.request_id=r.id AND o.audience='client'),'[]'::jsonb),
            'events',COALESCE((SELECT jsonb_agg(jsonb_build_object('status',e.status,'note',e.note,'createdAt',e.created_at) ORDER BY e.id) FROM andrade_portal.request_events e WHERE e.request_id=r.id),'[]'::jsonb))
            FROM andrade_portal.requests r WHERE reference=@ref AND tracking_hash=@hash
            """, ("ref", reference), ("hash", Auth.Hash(token!))) ?? throw new PortalException("Código o clave de seguimiento incorrectos.", 404);
    }
    public Task<JsonNode?> Requests() => db.Json("""
        SELECT COALESCE(jsonb_agg(row ORDER BY row->>'createdAt' DESC),'[]'::jsonb) FROM (
        SELECT jsonb_build_object('id',id,'reference',reference,'name',name,'email',email,'phone',phone,'serviceId',service_id,
        'message',message,'mode',mode,'appointmentAt',appointment_at,'status',status,'publicNote',public_note,'privateNote',private_note,
        'paymentStatus',payment_status,'paymentAmount',payment_amount,'paymentTest',payment_test,'paymentReference',payment_reference,
        'paymentVerifiedBy',payment_verified_by,'paymentVerifiedAt',payment_verified_at,'meetingUrl',meeting_url,
        'createdAt',created_at,'updatedAt',updated_at) row FROM andrade_portal.requests WHERE service_id<>'solidarity' ORDER BY created_at DESC LIMIT 500) x
        """);
    private static async Task<JsonNode> LockRequest(NpgsqlConnection c, Guid id)
    {
        await using var cmd = Database.Command(c, "SELECT to_jsonb(r) FROM andrade_portal.requests r WHERE id=@id FOR UPDATE", ("id", id));
        var result = await cmd.ExecuteScalarAsync(); return result == null ? throw new PortalException("Solicitud no encontrada.", 404) : JsonNode.Parse(result.ToString()!)!;
    }
    private static async Task Event(NpgsqlConnection c, Guid id, string status, string note)
    {
        await using var cmd = Database.Command(c, "INSERT INTO andrade_portal.request_events(request_id,status,note) VALUES(@id,@status,@note)", ("id", id), ("status", status), ("note", note)); await cmd.ExecuteNonQueryAsync();
    }
    public async Task UpdateRequest(Guid id, JsonObject body, string actor)
    {
        var status = body["status"]?.ToString() ?? "";
        if (!Statuses.Contains(status)) throw new PortalException("Estado no válido.");
        var note = body["publicNote"]?.ToString() ?? ""; var privateNote = body["privateNote"]?.ToString() ?? "";
        if (note.Length > 2000 || privateNote.Length > 4000) throw new PortalException("La nota es demasiado larga.");
        await using var c = await db.Source.OpenConnectionAsync(); await using var tx = await c.BeginTransactionAsync();
        var old = await LockRequest(c, id); string O(string k) => old[k]?.ToString() ?? "";
        if (O("service_id") == "solidarity") throw new PortalException("Gestiona esta postulación desde Apoyo solidario.", 409);
        var oldStatus = O("status");
        if (body["updatedAt"] != null && DateTimeOffset.Parse(body["updatedAt"]!.ToString()) != DateTimeOffset.Parse(O("updated_at"))) throw new PortalException("Otra sesión actualizó esta solicitud. Cierra y vuelve a abrirla antes de guardar.", 409);
        var transitions = new Dictionary<string, string[]> {
            ["recibido"] = ["revision","aprobado","confirmado","cancelado"], ["revision"] = ["aprobado","confirmado","cancelado"],
            ["pendiente_pago"] = ["revision","aprobado","confirmado","cancelado"], ["aprobado"] = ["pendiente_pago","confirmado","cancelado"],
            ["confirmado"] = ["completado","cancelado"], ["completado"] = [], ["cancelado"] = [] };
        if (status != oldStatus && !transitions[oldStatus].Contains(status)) throw new PortalException("Ese cambio de estado no está permitido.", 409);
        var meeting = body["meetingUrl"]?.ToString().Trim() ?? O("meeting_url");
        if (meeting != "" && !Validate.MeetingUrl(meeting)) throw new PortalException("Usa un enlace HTTPS válido de Google Meet o Zoom.");
        var verify = body["verifyPayment"]?.GetValue<bool>() ?? false;
        var payment = O("payment_status");
        if (verify && payment != "verificado")
        {
            if (payment == "no_requerido" || new[] { "cancelado", "completado" }.Contains(oldStatus)) throw new PortalException("Esta solicitud no admite verificación de pago.", 409);
            if (old["payment_test"]!.GetValue<bool>()) throw new PortalException("Esta solicitud es de prueba: no puede registrar un pago real. Activa los datos bancarios reales y crea una nueva solicitud.", 409);
            Validate.Text(body["verificationNote"]?.ToString(), 8, 500, "referencia bancaria comprobada");
            payment = "verificado";
            await using var verification = Database.Command(c, "UPDATE andrade_portal.requests SET payment_status='verificado',payment_verified_by=@actor,payment_verified_at=now() WHERE id=@id", ("actor", actor), ("id", id)); await verification.ExecuteNonQueryAsync();
            await using var audit = Database.Command(c, "INSERT INTO andrade_portal.audit_log(actor,action,target) VALUES(@actor,@action,@target)", ("actor", actor), ("action", "payment.verified: " + body["verificationNote"]!.ToString()), ("target", id.ToString())); await audit.ExecuteNonQueryAsync();
        }
        DateTimeOffset? appointment = O("appointment_at") == "" ? null : DateTimeOffset.Parse(O("appointment_at"));
        if (status == "confirmado")
        {
            if (appointment == null || (status != oldStatus && appointment <= DateTimeOffset.UtcNow)) throw new PortalException("Solo se puede agendar una solicitud con un horario futuro.", 409);
            if (O("mode") == "virtual" && (status != oldStatus || meeting != O("meeting_url")) && (payment != "verificado" || !Validate.MeetingUrl(meeting))) throw new PortalException("Verifica el ingreso bancario e indica el enlace de videollamada antes de agendar.", 409);
        }
        if (status == "pendiente_pago" && payment is "no_requerido" or "verificado") throw new PortalException("La solicitud no tiene un pago pendiente.", 409);
        if (new[] { "cancelado", "completado" }.Contains(oldStatus) && meeting != O("meeting_url")) throw new PortalException("No puedes cambiar el enlace de una solicitud cerrada.", 409);
        var publicChange = status != oldStatus || note != O("public_note") || meeting != O("meeting_url") || payment != O("payment_status");
        await using (var cmd = Database.Command(c, "UPDATE andrade_portal.requests SET status=@status,public_note=@note,private_note=@private,meeting_url=@meeting,updated_at=now() WHERE id=@id", ("id", id), ("status", status), ("note", note), ("private", privateNote), ("meeting", meeting))) { await cmd.ExecuteNonQueryAsync(); }
        if (publicChange) {
            var eventStatus = status != oldStatus ? status : payment != O("payment_status") ? "pago_verificado" : "actualizacion";
            await Event(c, id, eventStatus, note == "" ? EmailService.Label(eventStatus) : note);
            await using var policyCmd = Database.Command(c, "SELECT data->>'emailPolicy' FROM andrade_portal.settings WHERE id=true");
            var allChanges = (await policyCmd.ExecuteScalarAsync())?.ToString() == "all";
            if (eventStatus != "actualizacion" || (status == "confirmado" && meeting != O("meeting_url")) || allChanges) await email.Queue(c, id, eventStatus);
        }
        await tx.CommitAsync();
    }
    public async Task Cancel(string reference, string token)
    {
        await Track(reference, token);
        await using var c = await db.Source.OpenConnectionAsync(); await using var tx = await c.BeginTransactionAsync();
        await using var cmd = Database.Command(c, "UPDATE andrade_portal.requests SET status='cancelado',updated_at=now(),public_note='Solicitud cancelada por el cliente.' WHERE reference=@ref AND tracking_hash=@hash AND status NOT IN ('completado','cancelado') RETURNING id", ("ref", reference), ("hash", Auth.Hash(token)));
        var result = await cmd.ExecuteScalarAsync(); if (result == null) throw new PortalException("Esta solicitud ya está cerrada.", 409);
        var id = (Guid)result; await Event(c, id, "cancelado", "Solicitud cancelada por el cliente. Si ya pagaste, contacta al despacho para coordinar la devolución o reprogramación.");
        await email.Queue(c, id, "cancelado"); await tx.CommitAsync();
    }
    public async Task ReportPayment(string reference, string token, string bankReference)
    {
        await Track(reference, token); Validate.Text(bankReference, 5, 150, "referencia de transferencia");
        await using var c = await db.Source.OpenConnectionAsync(); await using var tx = await c.BeginTransactionAsync();
        await using var find = Database.Command(c, "SELECT id FROM andrade_portal.requests WHERE reference=@ref AND tracking_hash=@hash", ("ref", reference), ("hash", Auth.Hash(token)));
        var id = (Guid)(await find.ExecuteScalarAsync())!; var old = await LockRequest(c, id);
        if (old["payment_test"]!.GetValue<bool>()) throw new PortalException("Modo de prueba: no se reciben pagos. Contacta al despacho.", 409);
        if (new[] { "cancelado", "completado" }.Contains(old["status"]!.ToString()) || !new[] { "pendiente", "revision" }.Contains(old["payment_status"]!.ToString())) throw new PortalException("Esta solicitud no admite una transferencia pendiente.", 409);
        if (old["payment_reference"]!.ToString() == bankReference.Trim()) return;
        if (old["payment_status"]!.ToString() == "revision") throw new PortalException("Tu transferencia ya está en revisión. Contacta al despacho si necesitas corregirla.", 409);
        await using var update = Database.Command(c, "UPDATE andrade_portal.requests SET payment_status='revision',payment_reference=@ref,updated_at=now() WHERE id=@id", ("id", id), ("ref", bankReference.Trim())); await update.ExecuteNonQueryAsync();
        await Event(c, id, "revision", "Referencia de transferencia recibida. El despacho verificará el ingreso bancario; la cita aún no está agendada.");
        await email.Queue(c, id, "pago_revision"); await tx.CommitAsync();
    }
}
