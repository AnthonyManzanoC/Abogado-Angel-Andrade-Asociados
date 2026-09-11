ALTER TABLE andrade_portal.requests DROP CONSTRAINT requests_status_check;
ALTER TABLE andrade_portal.requests ADD CONSTRAINT requests_status_check CHECK(status IN ('recibido','revision','aprobado','pendiente_pago','confirmado','completado','cancelado'));
ALTER TABLE andrade_portal.requests
  ADD COLUMN tracking_secret text NOT NULL DEFAULT '',
  ADD COLUMN payment_status text NOT NULL DEFAULT 'no_requerido' CHECK(payment_status IN ('no_requerido','pendiente','revision','verificado')),
  ADD COLUMN payment_amount numeric(10,2),
  ADD COLUMN payment_test boolean NOT NULL DEFAULT false,
  ADD COLUMN payment_instructions text NOT NULL DEFAULT '',
  ADD COLUMN payment_reference text NOT NULL DEFAULT '',
  ADD COLUMN payment_verified_by text NOT NULL DEFAULT '',
  ADD COLUMN payment_verified_at timestamptz,
  ADD COLUMN meeting_url text NOT NULL DEFAULT '';
-- Historical virtual bookings keep their status; new virtual appointments require payment.
CREATE TABLE andrade_portal.email_outbox (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES andrade_portal.requests(id) ON DELETE CASCADE,
  audience text NOT NULL CHECK(audience IN ('client','admin')),
  event_status text NOT NULL,
  payload_secret text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','accepted','failed','uncertain')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  provider_id text NOT NULL DEFAULT '',
  last_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
CREATE INDEX email_queue_due ON andrade_portal.email_outbox(next_attempt_at) WHERE status='pending';
ALTER TABLE andrade_portal.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON andrade_portal.email_outbox FROM PUBLIC, anon, authenticated;
UPDATE andrade_portal.settings SET data = '{"assistantName":"Alma","whatsapp":"+593 98 664 8328","logoUrl":"","introVideoUrl":"","introPoster":"","introTitle":"Conoce a tu abogado. En sus propias palabras.","virtualFee":25,"paymentTestMode":true,"bankInstructions":"DATOS DE PRUEBA — NO TRANSFERIR\nBanco: ejemplo\nTitular: por configurar\nCuenta: pendiente de ingreso por el administrador","publicSiteUrl":"https://abogado-angel-andrade-asociados.vercel.app","senderEmail":"abogadoandradenotificaciones@gmail.com","notificationEmail":"abogadoandradenotificaciones@gmail.com","emailEnabled":false}'::jsonb || data WHERE id=true;
