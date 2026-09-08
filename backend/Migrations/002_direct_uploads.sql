CREATE TABLE andrade_portal.upload_tickets (
 token_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES andrade_portal.admin_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
ALTER TABLE andrade_portal.upload_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON andrade_portal.upload_tickets FROM PUBLIC, anon, authenticated;
