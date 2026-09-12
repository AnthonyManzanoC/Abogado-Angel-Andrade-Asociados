CREATE TABLE andrade_portal.payment_receipts (
 request_id uuid PRIMARY KEY REFERENCES andrade_portal.requests(id) ON DELETE CASCADE,
 content_type text NOT NULL,
 payload_secret text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE andrade_portal.payment_receipts ENABLE ROW LEVEL SECURITY;
