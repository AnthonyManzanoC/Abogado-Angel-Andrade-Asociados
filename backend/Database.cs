using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Npgsql;
using NpgsqlTypes;

namespace Andrade;
public sealed class Database : IAsyncDisposable
{
    public NpgsqlDataSource Source { get; }
    public Database(IConfiguration config)
    {
        var raw = config["DATABASE_URL"] ?? config["ConnectionStrings:Database"] ?? throw new InvalidOperationException("Configura DATABASE_URL en el servidor.");
        NpgsqlConnectionStringBuilder cs;
        if (raw.StartsWith("postgres")) { var u = new Uri(raw); var parts = u.UserInfo.Split(':', 2); cs = new() { Host = u.Host, Port = u.Port > 0 ? u.Port : 5432, Database = u.AbsolutePath.Trim('/'), Username = Uri.UnescapeDataString(parts[0]), Password = Uri.UnescapeDataString(parts[1]) }; }
        else cs = new(raw);
        cs.SslMode = SslMode.VerifyFull; cs.RootCertificate = config["PGSSLROOTCERT"] ?? Path.Combine(AppContext.BaseDirectory, "certs", "supabase-ca.crt"); cs.MaxPoolSize = 12; cs.Timeout = 15; cs.CommandTimeout = 25; cs.IncludeErrorDetail = false;
        Source = NpgsqlDataSource.Create(cs.ConnectionString);
    }
    public static NpgsqlCommand Command(NpgsqlConnection c, string sql, params (string, object?)[] values) { var cmd = new NpgsqlCommand(sql, c); foreach (var (key, value) in values) cmd.Parameters.AddWithValue(key, value ?? DBNull.Value); return cmd; }
    public async Task<int> Execute(string sql, params (string, object?)[] values) { await using var c = await Source.OpenConnectionAsync(); await using var cmd = Command(c, sql, values); return await cmd.ExecuteNonQueryAsync(); }
    public async Task<JsonNode?> Json(string sql, params (string, object?)[] values) { await using var c = await Source.OpenConnectionAsync(); await using var cmd = Command(c, sql, values); var result = await cmd.ExecuteScalarAsync(); return result is null or DBNull ? null : JsonNode.Parse(result.ToString()!); }
    public async Task Migrate(string root)
    {
        await using var c = await Source.OpenConnectionAsync(); await using var tx = await c.BeginTransactionAsync(); await using (var l = Command(c, "SELECT pg_advisory_xact_lock(730071337)")) { await l.ExecuteNonQueryAsync(); }
        await using (var pre = Command(c, "CREATE SCHEMA IF NOT EXISTS andrade_portal; CREATE TABLE IF NOT EXISTS andrade_portal.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())")) { await pre.ExecuteNonQueryAsync(); }
        foreach (var file in Directory.GetFiles(Path.Combine(root, "Migrations"), "*.sql").Order())
        {
            var version = Path.GetFileName(file); var sql = await File.ReadAllTextAsync(file); var hash = Auth.Hash(sql);
            await using var q = Command(c, "SELECT checksum FROM andrade_portal.schema_migrations WHERE version=@v", ("v", version)); var old = await q.ExecuteScalarAsync(); if (old != null) { if (old.ToString() != hash) throw new InvalidOperationException("La migración aplicada fue modificada: " + version); continue; }
            await using (var cmd = Command(c, sql)) { await cmd.ExecuteNonQueryAsync(); }
            await using (var ins = Command(c, "INSERT INTO andrade_portal.schema_migrations(version,checksum) VALUES(@v,@h)", ("v", version), ("h", hash))) { await ins.ExecuteNonQueryAsync(); }
        }
        await tx.CommitAsync();
    }
    public async Task Seed(string root, IConfiguration config)
    {
        var seed = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "seed.json")))!;
        var firstSeed = await Execute("INSERT INTO andrade_portal.settings(id,data) VALUES(true,@data::jsonb) ON CONFLICT DO NOTHING", ("data", seed["settings"]!.ToJsonString()));
        if (firstSeed == 1) foreach (var kind in new[] { "services", "posts", "promotions" }) { var index = 0; foreach (var item in seed[kind]!.AsArray()) { await Execute("INSERT INTO andrade_portal.content(id,kind,data,active,sort_order) VALUES(@id,@kind,@data::jsonb,true,@sort) ON CONFLICT DO NOTHING", ("id", item!["id"]!.ToString()), ("kind", kind), ("data", item.ToJsonString()), ("sort", index++)); } }
        var email = config["ADMIN_EMAIL"]; var password = config["ADMIN_PASSWORD"]; if (!string.IsNullOrEmpty(email) && !string.IsNullOrEmpty(password)) { if (password.Length < 14) throw new InvalidOperationException("ADMIN_PASSWORD debe tener al menos 14 caracteres."); await Execute("INSERT INTO andrade_portal.admin_users(id,email,password_hash) VALUES(@id,@email,@hash) ON CONFLICT(email) DO NOTHING", ("id", Guid.NewGuid()), ("email", email.Trim().ToLowerInvariant()), ("hash", Auth.PasswordHash(password))); }
    }
    public async ValueTask DisposeAsync() => await Source.DisposeAsync();
}
public static class Auth
{
    public static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    public static string Hash(string input) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
    public static string PasswordHash(string value) { var salt = RandomNumberGenerator.GetBytes(24); var hash = Rfc2898DeriveBytes.Pbkdf2(value, salt, 210000, HashAlgorithmName.SHA512, 64); return Convert.ToBase64String(salt) + ":" + Convert.ToBase64String(hash); }
    public static bool Verify(string value, string stored) { try { var p = stored.Split(':'); return CryptographicOperations.FixedTimeEquals(Rfc2898DeriveBytes.Pbkdf2(value, Convert.FromBase64String(p[0]), 210000, HashAlgorithmName.SHA512, 64), Convert.FromBase64String(p[1])); } catch { return false; } }
    public static bool Equal(string a, string b) => CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Hash(a)), Encoding.UTF8.GetBytes(Hash(b)));
}
