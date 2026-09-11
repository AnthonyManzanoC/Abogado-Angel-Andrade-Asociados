using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.RateLimiting;
using Andrade;
using Microsoft.AspNetCore.RateLimiting;
using ModelContextProtocol.Server;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false).AddEnvironmentVariables();
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 27 * 1024 * 1024);
builder.Services.AddSingleton<Database>(); builder.Services.AddSingleton<Portal>();
builder.Services.AddSingleton<NotificationSecrets>(); builder.Services.AddSingleton<EmailService>();
builder.Services.AddHttpClient("brevo", client => client.Timeout = TimeSpan.FromSeconds(25));
builder.Services.AddHostedService<EmailWorker>();
var allowedOrigins = (builder.Configuration["ALLOWED_ORIGINS"] ?? "http://localhost:3000,http://127.0.0.1:3000").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddPolicy("direct-upload", p => p.WithOrigins(allowedOrigins).WithMethods("POST").WithHeaders("Content-Type", "Authorization", "X-Portal-Client")));
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429; o.OnRejected = async (ctx, ct) => { ctx.HttpContext.Response.Headers.RetryAfter = "60"; await ctx.HttpContext.Response.WriteAsJsonAsync(new { error = "Demasiados intentos. Espera un minuto e inténtalo otra vez." }, ct); };
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx => RateLimitPartition.GetFixedWindowLimiter((ctx.Connection.RemoteIpAddress?.ToString() ?? "local") + (ctx.Request.Path == "/api/admin/login" ? ":login" : (ctx.Request.Path == "/api/requests" || ctx.Request.Path == "/api/solidarity") ? ":submit" : ":general"), _ => new() { PermitLimit = ctx.Request.Path == "/api/admin/login" ? 8 : (ctx.Request.Path == "/api/requests" || ctx.Request.Path == "/api/solidarity") ? 10 : 240, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddMcpServer().WithHttpTransport(o => { o.Stateless = true; }).WithTools<PortalTools>();
var app = builder.Build();
var db = app.Services.GetRequiredService<Database>();
if (args.Contains("--reset-admin")) { await db.ResetAdmin(builder.Configuration); Console.WriteLine("Acceso administrativo restablecido. Sesiones anteriores cerradas."); return; }
if (args.Contains("--check-db")) { await using var c = await db.Source.OpenConnectionAsync(); Console.WriteLine("Supabase: conexión PostgreSQL verificada con TLS y certificado válido."); return; }
await db.Migrate(app.Environment.ContentRootPath); await db.Seed(app.Environment.ContentRootPath, builder.Configuration);
if (args.Contains("--migrate")) { Console.WriteLine("Migraciones y contenido inicial aplicados en andrade_portal."); return; }
var origins = (builder.Configuration["ALLOWED_ORIGINS"] ?? "http://localhost:3000,http://127.0.0.1:3000").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.XContentTypeOptions = "nosniff"; ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    if (ctx.Request.Path.StartsWithSegments("/api/admin") || ctx.Request.Path.StartsWithSegments("/api/track")) ctx.Response.Headers.CacheControl = "no-store";
    try
    {
        var origin = ctx.Request.Headers.Origin.ToString(); if (!string.IsNullOrEmpty(origin) && !origins.Contains(origin)) throw new PortalException("Origen no autorizado.", 403);
        if (ctx.Request.Path == "/api/webhooks/brevo") { var secret = builder.Configuration["BREVO_WEBHOOK_SECRET"] ?? ""; if (secret.Length < 32 || !Auth.Equal(ctx.Request.Headers.Authorization.ToString(), "Bearer " + secret)) throw new PortalException("Webhook no autorizado.", 401); }
        else if (ctx.Request.Path.StartsWithSegments("/mcp")) { var expected = builder.Configuration["MCP_API_KEY"] ?? ""; var actual = ctx.Request.Headers.Authorization.ToString(); if (expected.Length < 32 || !Auth.Equal(actual, "Bearer " + expected)) throw new PortalException("Token MCP requerido.", 401); }
        else if (!HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method) && !(HttpMethods.IsOptions(ctx.Request.Method) && ctx.Request.Path == "/api/uploads") && ctx.Request.Headers["X-Portal-Client"] != "web") throw new PortalException("Solicitud no autorizada.", 403);
        if (ctx.Request.Path.StartsWithSegments("/api/admin") && ctx.Request.Path != "/api/admin/login")
        {
            var token = ctx.Request.Cookies["aa_session"] ?? ""; var user = await db.Json("SELECT jsonb_build_object('id',u.id,'email',u.email) FROM andrade_portal.sessions s JOIN andrade_portal.admin_users u ON u.id=s.user_id WHERE s.token_hash=@hash AND s.expires_at>now()", ("hash", Auth.Hash(token)));
            if (user == null) throw new PortalException("Inicia sesión para continuar.", 401); ctx.Items["admin"] = user;
        }
        await next();
    }
    catch (PortalException e) { if (!ctx.Response.HasStarted) { ctx.Response.StatusCode = e.Status; await ctx.Response.WriteAsJsonAsync(new { error = e.Message }); } }
    catch (PostgresException e) when (e.SqlState == "23505") { ctx.Response.StatusCode = 409; await ctx.Response.WriteAsJsonAsync(new { error = "Este registro o horario ya existe. Actualiza los datos e inténtalo nuevamente." }); }
    catch (BadHttpRequestException) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { error = "Revisa los datos enviados." }); }
    catch (Exception e) { app.Logger.LogError("Operación fallida: {Type}", e.GetType().Name); if (!ctx.Response.HasStarted) { ctx.Response.StatusCode = 500; await ctx.Response.WriteAsJsonAsync(new { error = "No pudimos completar la operación. Inténtalo en unos momentos." }); } }
});
app.UseCors();
app.UseRateLimiter();
app.MapGet("/api/health", async () => { await using var c = await db.Source.OpenConnectionAsync(); return Results.Ok(new { status = "ok", database = "connected", assistant = "deterministic", version = "1.0.0" }); });
app.MapGet("/api/public", (Portal p) => p.Public());
app.MapGet("/api/posts", (Portal p, int? offset, int? limit, string? category, string? search) => p.Posts(offset ?? 0, limit ?? 6, category, search));
app.MapGet("/api/posts/{id}", async (string id) => await db.Json("SELECT data || jsonb_build_object('id',id,'createdAt',created_at) FROM andrade_portal.content WHERE id=@id AND kind='posts' AND active", ("id", id)) ?? throw new PortalException("Publicación no disponible.", 404));
app.MapGet("/api/availability", async (Portal p, string date) => new { date, timezone = "America/Guayaquil", slots = await p.Slots(date) });
app.MapPost("/api/requests", (Portal p, RequestInput input) => p.CreateRequest(input));
app.MapPost("/api/track", (Portal p, TrackInput input) => p.Track(input.Reference, input.Token));
app.MapPost("/api/track/cancel", async (Portal p, TrackInput input) => { await p.Cancel(input.Reference, input.Token); return Results.Ok(new { ok = true }); });
app.MapPost("/api/track/payment", async (Portal p, PaymentInput input) => { await p.ReportPayment(input.Reference, input.Token, input.BankReference); return Results.Ok(new { ok = true }); });
app.MapPost("/api/admin/login", async (HttpContext ctx, LoginInput input) =>
{
    Validate.Text(input.Email, 3, 200, "correo"); Validate.Text(input.Password, 1, 200, "contraseña");
    var user = await db.Json("SELECT jsonb_build_object('id',id,'hash',password_hash,'email',email) FROM andrade_portal.admin_users WHERE email=@email", ("email", input.Email.Trim().ToLowerInvariant()));
    if (!Auth.Verify(input.Password, user?["hash"]?.ToString() ?? Auth.PasswordHash("not-the-password"))) throw new PortalException("Correo o contraseña incorrectos.", 401);
    var token = Auth.Token(); await db.Execute("DELETE FROM andrade_portal.sessions WHERE expires_at<now()"); await db.Execute("INSERT INTO andrade_portal.sessions(token_hash,user_id,expires_at) VALUES(@hash,@id,now()+interval '12 hours')", ("hash", Auth.Hash(token)), ("id", Guid.Parse(user!["id"]!.ToString())));
    ctx.Response.Cookies.Append("aa_session", token, new() { HttpOnly = true, Secure = !app.Environment.IsDevelopment(), SameSite = SameSiteMode.Strict, Path = "/", MaxAge = TimeSpan.FromHours(12) });
    return Results.Ok(new { email = user["email"]!.ToString() });
});
app.MapGet("/api/admin/me", (HttpContext ctx) => ctx.Items["admin"]);
app.MapPost("/api/admin/logout", async (HttpContext ctx) => { await db.Execute("DELETE FROM andrade_portal.sessions WHERE token_hash=@hash", ("hash", Auth.Hash(ctx.Request.Cookies["aa_session"] ?? ""))); ctx.Response.Cookies.Delete("aa_session", new() { Path = "/" }); return Results.Ok(new { ok = true }); });
app.MapPost("/api/admin/password", async (HttpContext ctx, PasswordInput input) => { Validate.Text(input.NewPassword, 14, 200, "nueva contraseña"); var uid = Guid.Parse(((JsonNode)ctx.Items["admin"]!)["id"]!.ToString()); var user = await db.Json("SELECT jsonb_build_object('hash',password_hash) FROM andrade_portal.admin_users WHERE id=@id", ("id", uid)); if (!Auth.Verify(input.CurrentPassword, user!["hash"]!.ToString())) throw new PortalException("La contraseña actual es incorrecta.", 403); await db.Execute("UPDATE andrade_portal.admin_users SET password_hash=@hash WHERE id=@id", ("hash", Auth.PasswordHash(input.NewPassword)), ("id", uid)); await db.Execute("DELETE FROM andrade_portal.sessions WHERE user_id=@id", ("id", uid)); ctx.Response.Cookies.Delete("aa_session", new() { Path = "/" }); return Results.Ok(new { ok = true }); });
app.MapGet("/api/admin/content/{kind}", (Portal p, string kind) => p.Content(kind, true));
app.MapPut("/api/admin/content/{kind}/{id}", async (HttpContext ctx, string kind, string id, JsonObject input) =>
{
    if (!new[] { "services", "posts", "promotions", "education", "achievements", "gallery", "cases" }.Contains(kind) || !System.Text.RegularExpressions.Regex.IsMatch(id, @"^[a-z0-9-]{3,80}$")) throw new PortalException("Tipo o identificador no válido."); Validate.Content(kind, input);
    var active = input["active"]?.GetValue<bool>() ?? false; var sort = input["sortOrder"]?.GetValue<int>() ?? 0; input["id"] = id;
    var existing = await db.Json("SELECT jsonb_build_object('kind',kind) FROM andrade_portal.content WHERE id=@id", ("id", id)); if (existing != null && existing["kind"]!.ToString() != kind) throw new PortalException("El identificador pertenece a otro tipo de contenido.", 409);
    await db.Execute("INSERT INTO andrade_portal.content(id,kind,data,active,sort_order) VALUES(@id,@kind,@data::jsonb,@active,@sort) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,active=EXCLUDED.active,sort_order=EXCLUDED.sort_order,updated_at=now()", ("id", id), ("kind", kind), ("data", input.ToJsonString()), ("active", active), ("sort", sort)); await Audit(ctx, "content.saved", id); return Results.Ok(new { ok = true, id });
});
app.MapDelete("/api/admin/content/{kind}/{id}", async (HttpContext ctx, string kind, string id) => { await db.Execute("DELETE FROM andrade_portal.content WHERE id=@id AND kind=@kind", ("id", id), ("kind", kind)); await Audit(ctx, "content.deleted", id); return Results.Ok(new { ok = true }); });
app.MapGet("/api/admin/settings", (Portal p) => p.Settings());
app.MapPut("/api/admin/settings", async (HttpContext ctx, EmailService email, JsonObject input) =>
{
    Validate.PremiumSettings(input);
    if (input["emailEnabled"]?.GetValue<bool>() == true && (await db.Json("SELECT data->'emailEnabled' FROM andrade_portal.settings WHERE id=true"))?.GetValue<bool>() != true) { var readiness = await email.CheckConfiguration(input); if (!readiness.Ready) throw new PortalException(string.Join(" ", readiness.Issues), 409); }
    foreach (var key in new[] { "name", "heroTitle", "heroDescription", "address", "city", "hours", "biography" }) Validate.Text(input[key]?.ToString(), 2, key == "biography" ? 10000 : 500, key);
    if (!Validate.MediaUrl(input["heroImage"]?.ToString())) throw new PortalException("Selecciona una imagen de la biblioteca.");
    foreach (var key in new[] { "instagram", "linkedin" }) if (!Validate.SocialUrl(input[key]?.ToString())) throw new PortalException("Enlace social no válido.");
    if ((input["phone"]?.ToString().Length ?? 0) > 25 || (input["email"]?.ToString().Length ?? 0) > 200) throw new PortalException("Revisa los datos de contacto.");
    var start = input["startHour"]?.GetValue<int>() ?? -1; var end = input["endHour"]?.GetValue<int>() ?? -1; if (start < 0 || end > 23 || end <= start) throw new PortalException("Revisa el horario de atención.");
    if (input["weekdays"] is not JsonArray days || days.Count > 7 || days.Any(d => d == null || d.GetValue<int>() < 0 || d.GetValue<int>() > 6)) throw new PortalException("Revisa los días de atención.");
    if (input["closedDates"] is not JsonArray dates || dates.Count > 366 || dates.Any(d => !DateOnly.TryParseExact(d?.ToString(), "yyyy-MM-dd", out _))) throw new PortalException("Revisa las fechas de cierre.");
    await db.Execute("UPDATE andrade_portal.settings SET data=@data::jsonb,updated_at=now() WHERE id=true", ("data", input.ToJsonString())); await Audit(ctx, "settings.saved", "public"); return Results.Ok(new { ok = true });
});
app.MapGet("/api/admin/requests", (Portal p) => p.Requests());
app.MapPut("/api/admin/requests/{id:guid}", async (HttpContext ctx, Portal p, Guid id, JsonObject input) => { await p.UpdateRequest(id, input, ((JsonNode)ctx.Items["admin"]!)["email"]!.ToString()); await Audit(ctx, "request.updated", id.ToString()); return Results.Ok(new { ok = true }); });
app.MapPost("/api/admin/requests/{id:guid}/message", async (HttpContext ctx, Portal p, Guid id, JsonObject input) => { await p.SendClientMessage(id, input, ((JsonNode)ctx.Items["admin"]!)["email"]!.ToString()); return Results.Ok(new { ok = true }); });
app.MapPost("/api/webhooks/brevo", async (EmailService email, JsonObject input) => { await email.ReceiveDelivery(input); return Results.Ok(new { ok = true }); });
app.MapGet("/api/admin/notifications/check", (EmailService email) => email.CheckConfiguration());
app.MapGet("/api/admin/notifications", async (Portal p) => new {
    enabled = builder.Configuration["EMAIL_DELIVERY_ENABLED"] == "true" && (await p.Settings())?["emailEnabled"]?.GetValue<bool>() == true,
    configured = !string.IsNullOrEmpty(builder.Configuration["BREVO_API_KEY"]),
    webhookConfigured = (builder.Configuration["BREVO_WEBHOOK_SECRET"]?.Length ?? 0) >= 32,
    items = await db.Json("SELECT COALESCE(jsonb_agg(row),'[]'::jsonb) FROM (SELECT jsonb_build_object('id',o.id,'reference',r.reference,'audience',o.audience,'eventStatus',o.event_status,'status',o.status,'deliveryStatus',o.delivery_status,'deliveryAt',o.delivery_at,'attempts',o.attempts,'lastError',o.last_error,'createdAt',o.created_at,'providerId',o.provider_id) row FROM andrade_portal.email_outbox o JOIN andrade_portal.requests r ON r.id=o.request_id ORDER BY o.created_at DESC LIMIT 100) x")
});
app.MapPost("/api/admin/notifications/{id:guid}/retry", async (HttpContext ctx, Guid id, EmailService email) => {
    await email.Retry(id);
    await Audit(ctx, "notification.retry", id.ToString()); return Results.Ok(new { ok = true });
});
app.MapGet("/api/admin/audit", () => db.Json("SELECT COALESCE(jsonb_agg(row),'[]'::jsonb) FROM (SELECT jsonb_build_object('action',action,'target',target,'actor',actor,'createdAt',created_at) row FROM andrade_portal.audit_log ORDER BY id DESC LIMIT 50) x"));
app.MapGet("/api/admin/media", () => db.Json("SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'name',name,'contentType',content_type,'size',octet_length(bytes),'url','/api/media/'||id,'createdAt',created_at) ORDER BY created_at DESC),'[]'::jsonb) FROM andrade_portal.media"));
app.MapPost("/api/admin/media", (Func<HttpContext, Task<IResult>>)UploadMedia);
app.MapPost("/api/admin/upload-ticket", async (HttpContext ctx) =>
{
    var token = Auth.Token(); var userId = Guid.Parse(((JsonNode)ctx.Items["admin"]!)["id"]!.ToString());
    await db.Execute("DELETE FROM andrade_portal.upload_tickets WHERE expires_at<now()");
    await db.Execute("INSERT INTO andrade_portal.upload_tickets(token_hash,user_id,expires_at) VALUES(@hash,@id,now()+interval '2 minutes')", ("hash", Auth.Hash(token)), ("id", userId));
    var publicUrl = builder.Configuration["API_PUBLIC_URL"] ?? builder.Configuration["RENDER_EXTERNAL_URL"] ?? "http://127.0.0.1:5080";
    return Results.Ok(new { token, url = publicUrl.TrimEnd('/') + "/api/uploads" });
});
app.MapPost("/api/uploads", async (HttpContext ctx) =>
{
    var auth = ctx.Request.Headers.Authorization.ToString(); if (!auth.StartsWith("Bearer ") || auth.Length != 71) throw new PortalException("Autorización de carga requerida.", 401);
    var user = await db.Json("WITH ticket AS (DELETE FROM andrade_portal.upload_tickets WHERE token_hash=@hash AND expires_at>now() RETURNING user_id) SELECT jsonb_build_object('id',u.id,'email',u.email) FROM ticket t JOIN andrade_portal.admin_users u ON u.id=t.user_id", ("hash", Auth.Hash(auth[7..])));
    if (user == null) throw new PortalException("El permiso de carga venció o ya se utilizó. Reintenta la carga.", 401); ctx.Items["admin"] = user; return await UploadMedia(ctx);
}).RequireCors("direct-upload");
app.MapGet("/api/media/{id:guid}", async (Guid id, HttpContext ctx) => { await using var c = await db.Source.OpenConnectionAsync(); await using var cmd = Database.Command(c, "SELECT bytes,content_type FROM andrade_portal.media WHERE id=@id", ("id", id)); await using var reader = await cmd.ExecuteReaderAsync(); if (!await reader.ReadAsync()) return Results.NotFound(); ctx.Response.Headers.CacheControl = "public,max-age=86400,immutable"; return Results.File((byte[])reader[0], reader.GetString(1), enableRangeProcessing: true); });
app.MapGet("/api/solidarity", (Portal p) => p.SolidarityProgram());
app.MapPost("/api/solidarity", (Portal p, SolidarityInput input) => p.ApplySolidarity(input));
app.MapGet("/api/admin/solidarity", (Portal p, string? period) => p.SolidarityRequests(period));
app.MapPut("/api/admin/solidarity/{id:guid}", async (HttpContext ctx, Portal p, Guid id, JsonObject input) => { await p.DecideSolidarity(id, input, ((JsonNode)ctx.Items["admin"]!)["email"]!.ToString()); await Audit(ctx, "solidarity.reviewed", id.ToString()); return Results.Ok(new { ok = true }); });
app.MapMcp("/mcp");
app.Run();
async Task<IResult> UploadMedia(HttpContext ctx)
{
    if (!ctx.Request.HasFormContentType) throw new PortalException("Selecciona un archivo."); var form = await ctx.Request.ReadFormAsync(); var file = form.Files.GetFile("file"); if (file == null || file.Length < 12 || file.Length > 25 * 1024 * 1024) throw new PortalException("El archivo debe pesar entre 12 bytes y 25 MB.");
    using var stream = new MemoryStream(); await file.CopyToAsync(stream); var bytes = stream.ToArray(); string mime;
    if (bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff) mime = "image/jpeg"; else if (bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) mime = "image/png"; else if (Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP") mime = "image/webp"; else if (Encoding.ASCII.GetString(bytes, 4, 4) == "ftyp") mime = "video/mp4"; else if (bytes.AsSpan(0, 4).SequenceEqual(new byte[] { 0x1a, 0x45, 0xdf, 0xa3 })) mime = "video/webm"; else throw new PortalException("Formato no compatible. Usa JPG, PNG, WebP, MP4 o WebM.");
    var id = Guid.NewGuid(); await db.Execute("INSERT INTO andrade_portal.media(id,name,content_type,bytes) VALUES(@id,@name,@mime,@bytes)", ("id", id), ("name", Path.GetFileName(file.FileName)[..Math.Min(Path.GetFileName(file.FileName).Length, 150)]), ("mime", mime), ("bytes", bytes)); await Audit(ctx, "media.uploaded", id.ToString()); return Results.Ok(new { id, url = "/api/media/" + id, contentType = mime, size = bytes.Length });
}
async Task Audit(HttpContext ctx, string action, string target) => await db.Execute("INSERT INTO andrade_portal.audit_log(actor,action,target) VALUES(@actor,@action,@target)", ("actor", ((JsonNode)ctx.Items["admin"]!)["email"]!.ToString()), ("action", action), ("target", target));
record LoginInput(string Email, string Password);
record PasswordInput(string CurrentPassword, string NewPassword);
record TrackInput(string Reference, string Token);
record PaymentInput(string Reference, string Token, string BankReference);
