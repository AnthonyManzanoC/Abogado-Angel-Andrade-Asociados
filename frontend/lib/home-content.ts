export const homeFields = [
  [
    'homeServicesTitle',
    'Título de servicios',
    'Soluciones para lo que importa.',
  ],
  [
    'homeProcessTitle',
    'Título del proceso',
    'De la primera pregunta al siguiente paso.',
  ],
  [
    'homeProcessDescription',
    'Presentación del proceso',
    'Una atención clara, con información que puedes consultar cuando la necesites.',
  ],
  ['homeStep1Title', 'Paso 1 · título', 'Cuéntanos tu situación'],
  [
    'homeStep1Text',
    'Paso 1 · explicación',
    'Envía una consulta o solicita un horario. Puedes hacerlo desde el formulario o con Alma; recibirás una referencia privada.',
  ],
  ['homeStep2Title', 'Paso 2 · título', 'Definimos cómo avanzar'],
  [
    'homeStep2Text',
    'Paso 2 · explicación',
    'El abogado revisa tu solicitud y acuerda contigo el alcance de la atención. Si eliges una cita virtual, primero se verifica la transferencia.',
  ],
  ['homeStep3Title', 'Paso 3 · título', 'Tu atención, conectada'],
  [
    'homeStep3Text',
    'Paso 3 · explicación',
    'Consulta la confirmación, la dirección o el enlace de videollamada en tu seguimiento. Las decisiones importantes también se comunican por correo.',
  ],
  [
    'homeApproachTitle',
    'Título del compromiso',
    'Escuchar primero. Construir una estrategia contigo.',
  ],
  [
    'homeApproachText',
    'Texto del compromiso',
    'Detrás de cada consulta hay una persona y una decisión importante. La atención empieza por comprender tu situación, revisar los antecedentes y explicarte las alternativas con claridad.',
  ],
  [
    'homeModalitiesTitle',
    'Título de modalidades',
    'Cerca de ti, estés donde estés.',
  ],
  [
    'homeOfficeText',
    'Descripción presencial',
    'Conversemos personalmente en el despacho. Solicita un horario y espera la confirmación antes de acudir.',
  ],
  [
    'homeVirtualText',
    'Descripción virtual',
    'Recibe atención por videollamada. El despacho confirma el pago y el horario antes de compartir el acceso a tu cita.',
  ],
  ['homeFaqTitle', 'Título de preguntas', 'Antes de dar el primer paso.'],
  ['homeFaq1Question', 'Pregunta 1', '¿Enviar una solicitud confirma mi cita?'],
  [
    'homeFaq1Answer',
    'Respuesta 1',
    'La solicitud inicia la revisión. Tu cita queda agendada cuando el despacho la confirma; puedes comprobarlo con tu enlace privado de seguimiento.',
  ],
  ['homeFaq2Question', 'Pregunta 2', '¿Qué debo preparar para la consulta?'],
  [
    'homeFaq2Answer',
    'Respuesta 2',
    'Un resumen de los hechos, las fechas relevantes y las preguntas que deseas resolver. El abogado te indicará qué documentos necesita revisar.',
  ],
  ['homeFaq3Question', 'Pregunta 3', '¿Cómo recibo las novedades?'],
  [
    'homeFaq3Answer',
    'Respuesta 3',
    'Conserva tu referencia y el enlace privado. El seguimiento reúne el estado actual; el correo comunica la recepción y las decisiones importantes. También puedes contactar al despacho por WhatsApp.',
  ],
] as const;
export const homeDefaults: Record<string, string> = Object.fromEntries(
  homeFields.map(([key, , value]) => [key, value]),
);
export const serviceImages = [
  'civil',
  'penal',
  'familia',
  'laboral',
  'negocios',
].map((id) => ({
  value: `/images/servicio-${id}.webp`,
  label: `Imagen referencial · ${id}`,
}));
export function serviceCover(service: { id: string; cover?: string }) {
  // An explicit empty value lets the administrator remove a background.
  const id = service.id === 'civil-patrimonial' ? 'civil' : service.id;
  return (
    service.cover ??
    serviceImages.find((image) => image.value === `/images/servicio-${id}.webp`)
      ?.value ??
    ''
  );
}
