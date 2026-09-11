ALTER TABLE andrade_portal.email_outbox
 ADD COLUMN delivery_status text NOT NULL DEFAULT 'unknown' CHECK(delivery_status IN ('unknown','delivered','deferred','bounced','blocked','complaint')),
 ADD COLUMN delivery_at timestamptz,
 ADD COLUMN dedupe_key text;
CREATE UNIQUE INDEX email_outbox_dedupe ON andrade_portal.email_outbox(request_id,audience,dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX email_provider_lookup ON andrade_portal.email_outbox(provider_id) WHERE provider_id<>'';
CREATE TABLE andrade_portal.email_delivery_events (
 event_key text PRIMARY KEY,
 outbox_id uuid NOT NULL REFERENCES andrade_portal.email_outbox(id) ON DELETE CASCADE,
 event text NOT NULL,
 occurred_at timestamptz NOT NULL
);
ALTER TABLE andrade_portal.email_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON andrade_portal.email_delivery_events FROM PUBLIC, anon, authenticated;
UPDATE andrade_portal.settings SET data=data || jsonb_build_object('weekdays',jsonb_build_array(1,2,3,4,5),'hours','Lunes a viernes · '||lpad(COALESCE(data->>'startHour','9'),2,'0')||':00 a '||lpad(COALESCE(data->>'endHour','17'),2,'0')||':00 · Con cita previa'),updated_at=now() WHERE id=true;
INSERT INTO andrade_portal.content(id,kind,data,active,sort_order) VALUES
 ('penal','services','{"id":"penal","title":"Derecho Penal y defensa","summary":"Defensa y acompañamiento ante una investigación o proceso penal.","description":"El despacho revisa tu situación, los antecedentes y la documentación disponible para definir el alcance de la defensa o del acompañamiento legal.\n\nSolicita una consulta para organizar la información y conocer los siguientes pasos. Si tienes una diligencia o plazo próximo, contacta directamente al abogado.","icon":"shield","category":"Personas"}',true,0),
 ('laboral','services','{"id":"laboral","title":"Derecho Laboral","summary":"Orientación y acompañamiento en conflictos y relaciones de trabajo.","description":"Revisión de tu situación laboral, acuerdos y documentación para definir los siguientes pasos. El alcance y los honorarios se acuerdan con el abogado antes de iniciar el servicio.","icon":"briefcase","category":"Personas y negocios"}',true,2)
 ON CONFLICT(id) DO NOTHING;
UPDATE andrade_portal.content SET data=jsonb_set(data,'{title}','"Derecho Laboral"'),active=true,updated_at=now() WHERE id='laboral' AND kind='services';
