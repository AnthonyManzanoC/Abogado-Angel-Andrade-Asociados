using System.ComponentModel;
using System.Text.Json;
using ModelContextProtocol.Server;

namespace Andrade;
[McpServerToolType]
public sealed class PortalTools(Portal portal)
{
    [McpServerTool(Name = "list_services", ReadOnly = true), Description("Lista los servicios publicados del despacho. No ofrece asesoría jurídica.")]
    public async Task<string> ListServices() => (await portal.Content("services"))!.ToJsonString();
    [McpServerTool(Name = "get_office", ReadOnly = true), Description("Consulta ubicación y datos públicos del despacho.")]
    public async Task<string> GetOffice() => (await portal.PublicSettings()).ToJsonString();
    [McpServerTool(Name = "search_posts", ReadOnly = true), Description("Busca publicaciones públicas de la vitrina legal con paginación.")]
    public async Task<string> SearchPosts(string search = "", int offset = 0) => JsonSerializer.Serialize(await portal.Posts(offset, 6, null, search));
    [McpServerTool(Name = "check_availability", ReadOnly = true), Description("Devuelve horarios libres para YYYY-MM-DD en America/Guayaquil, próximos 60 días.")]
    public async Task<string> CheckAvailability(string date) => JsonSerializer.Serialize(await portal.Slots(date));
    [McpServerTool(Name = "create_consultation", ReadOnly = false, Destructive = false, Idempotent = true), Description("Registra una solicitud, con cita opcional. Requiere consentimiento explícito del cliente; no confirma la cita. Conserva idempotencyKey (UUID) y trackingToken (64 caracteres hex aleatorios) para reintentos y seguimiento.")]
    public async Task<string> CreateConsultation(string name, string phone, string message, string idempotencyKey, string trackingToken, bool consent, string email, string serviceId = "general", string mode = "presencial", string? appointmentAt = null) => JsonSerializer.Serialize(await portal.CreateRequest(new(name, email, phone, serviceId, message, mode, appointmentAt, consent, idempotencyKey, trackingToken)));
    [McpServerTool(Name = "track_request", ReadOnly = true), Description("Consulta exclusivamente una solicitud con su referencia y clave privada.")]
    public async Task<string> TrackRequest(string reference, string token) => (await portal.Track(reference, token)).ToJsonString();
}
