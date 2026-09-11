ALTER TABLE andrade_portal.content DROP CONSTRAINT content_kind_check;
ALTER TABLE andrade_portal.content ADD CONSTRAINT content_kind_check CHECK(kind IN ('services','posts','promotions','education','achievements','gallery','cases'));
CREATE TABLE andrade_portal.solidarity_applications (
 request_id uuid PRIMARY KEY REFERENCES andrade_portal.requests(id) ON DELETE CASCADE,
 period text NOT NULL CHECK(period ~ '^[0-9]{4}-[0-9]{2}$'),
 email_hash text NOT NULL,
 city text NOT NULL,
 circumstances text NOT NULL,
 decision text NOT NULL DEFAULT 'recibido' CHECK(decision IN ('recibido','revision','seleccionado','no_seleccionado')),
 reviewed_by text NOT NULL DEFAULT '',
 terms_snapshot text NOT NULL,
 selected_at timestamptz,
 UNIQUE(period,email_hash)
);
-- An award remains recorded even if the applicant subsequently withdraws.
CREATE UNIQUE INDEX one_solidarity_award_per_month ON andrade_portal.solidarity_applications(period) WHERE selected_at IS NOT NULL;
ALTER TABLE andrade_portal.solidarity_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON andrade_portal.solidarity_applications FROM PUBLIC, anon, authenticated;
UPDATE andrade_portal.settings SET data='{"buildingImage":"","buildingCaption":"Edificio Alavama · Babahoyo","profileImage":"","profileName":"Ángel Andrade Núñez","profileSubtitle":"Una relación personal. Un compromiso profesional.","solidarityEnabled":true,"solidarityTitle":"Una oportunidad para volver a empezar.","solidarityDescription":"Cada mes, el abogado selecciona un caso para ofrecer acompañamiento legal gratuito a una persona que atraviesa una situación de vulnerabilidad.","solidarityCloseDay":25,"solidarityTerms":"La postulación es gratuita y confidencial. Se selecciona como máximo un caso al mes, mediante revisión personal de la necesidad, la viabilidad y el alcance del asunto. Postular no garantiza la selección, una cita ni un resultado. El alcance del apoyo y cualquier gasto de terceros se acuerdan antes de iniciar. Este canal no atiende emergencias ni suspende plazos."}'::jsonb || data WHERE id=true;
