import { api } from './api';
export const statusLabels: Record<string, string> = {
  solidarity_recibido: 'Postulación recibida',
  solidarity_revision: 'Postulación en revisión',
  solidarity_seleccionado: 'Seleccionada para apoyo gratuito',
  solidarity_no_seleccionado: 'No seleccionada este mes',
  actualizacion: 'Nueva comunicación',
  solidarity_actualizacion: 'Novedad del apoyo solidario',
  pago_verificado: 'Transferencia verificada',
  delivery_issue: 'Problema de entrega al cliente',
  recibido: 'Recibida',
  revision: 'En revisión',
  aprobado: 'Aprobada',
  pendiente_pago: 'Pendiente de pago',
  confirmado: 'Agendada',
  pago_revision: 'Transferencia en revisión',
  completado: 'Completada',
  cancelado: 'Cancelada',
};
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
export function credentials() {
  return {
    idempotencyKey: crypto.randomUUID(),
    trackingToken: Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  };
}
export function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function formatDate(s: string) {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(s));
}
export function trackingLink(reference: string, token: string) {
  return (
    '/seguimiento#' +
    new URLSearchParams({ ref: reference, key: token }).toString()
  );
}
export const toolDefinitions = [
  {
    name: 'list_services',
    description: 'Lista las áreas y servicios públicos del despacho.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_office',
    description: 'Devuelve la dirección, atención y contacto público.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_posts',
    description: 'Busca contenido en la vitrina legal.',
    inputSchema: {
      type: 'object',
      properties: { search: { type: 'string' }, offset: { type: 'number' } },
    },
  },
  {
    name: 'check_availability',
    description:
      'Consulta horarios libres en Ecuador para una fecha YYYY-MM-DD.',
    inputSchema: {
      type: 'object',
      properties: { date: { type: 'string' } },
      required: ['date'],
    },
  },
  {
    name: 'create_consultation',
    description:
      'Registra una solicitud o cita pendiente de confirmación. Requiere datos revisados y consentimiento explícito del cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        serviceId: { type: 'string' },
        message: { type: 'string' },
        mode: { type: 'string', enum: ['presencial', 'virtual'] },
        appointmentAt: { type: ['string', 'null'] },
        consent: { type: 'boolean' },
        idempotencyKey: { type: 'string' },
        trackingToken: { type: 'string' },
      },
      required: [
        'name',
        'email',
        'phone',
        'message',
        'consent',
        'idempotencyKey',
        'trackingToken',
      ],
    },
  },
  {
    name: 'track_request',
    description:
      'Consulta el estado con referencia y clave privada del cliente.',
    inputSchema: {
      type: 'object',
      properties: { reference: { type: 'string' }, token: { type: 'string' } },
      required: ['reference', 'token'],
    },
  },
];
export async function executePortalTool(
  name: string,
  args: Record<string, any> = {},
) {
  switch (name) {
    case 'list_services':
      return (await api('/public')).services;
    case 'get_office':
      return (await api('/public')).settings;
    case 'search_posts':
      return api(
        '/posts?' +
          new URLSearchParams({
            search: args.search || '',
            offset: String(args.offset || 0),
          }),
      );
    case 'check_availability':
      return api('/availability?date=' + encodeURIComponent(args.date));
    case 'create_consultation':
      return api('/requests', {
        method: 'POST',
        body: JSON.stringify({
          email: '',
          serviceId: 'general',
          mode: 'presencial',
          appointmentAt: null,
          ...args,
        }),
      });
    case 'track_request':
      return api('/track', { method: 'POST', body: JSON.stringify(args) });
    default:
      throw Error('Esta acción no está disponible.');
  }
}
export function registerWebMCP() {
  const context =
    (document as any).modelContext || (navigator as any).modelContext;
  if (!context?.registerTool) return () => {};
  const controller = new AbortController();
  let stopped = false;
  for (const tool of toolDefinitions) {
    Promise.resolve(
      context.registerTool(
        {
          ...tool,
          annotations: {
            readOnlyHint: tool.name !== 'create_consultation',
            consequentialHint: tool.name === 'create_consultation',
            untrustedContentHint: true,
          },
          execute: async (args: Record<string, any>) => {
            if (stopped) throw Error('Página cerrada.');
            if (
              tool.name === 'create_consultation' &&
              !window.confirm(
                '¿Autorizar el envío de esta solicitud al despacho?\n\n' +
                  String(args.name || '') +
                  ' · ' +
                  String(args.phone || '') +
                  '\n' +
                  String(args.message || '') +
                  '\n\nAceptas el tratamiento de estos datos para atender tu solicitud.',
              )
            )
              return 'Envío cancelado por el usuario.';
            return JSON.stringify(await executePortalTool(tool.name, args));
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
  }
  return () => {
    stopped = true;
    controller.abort();
    if (context.unregisterTool)
      for (const tool of toolDefinitions)
        try {
          context.unregisterTool(tool.name);
        } catch {}
  };
}
export function detectIntent(text: string) {
  const t = normalize(text);
  if (/^(cancelar|reiniciar|empezar de nuevo)$/.test(t)) return 'reset';
  if (/(solidari|caso gratis|gratuit|pro bono|vulnerab)/.test(t))
    return 'solidarity';
  if (/(seguimiento|estado|solicitud|codigo)/.test(t)) return 'track';
  if (/(cita|agendar|reservar|agenda)/.test(t)) return 'appointment';
  if (/(ubicacion|direccion|donde|llegar|oficina|horario|contacto)/.test(t))
    return 'office';
  if (/(video|vitrina|publicacion|redes|buscar)/.test(t)) return 'posts';
  if (
    /(servicio|area|especialidad|familia|civil|penal|defensa|laboral|contrato|negocio)/.test(
      t,
    )
  )
    return 'services';
  if (/(consulta|mensaje|abogado|hablar|caso|contactar)/.test(t))
    return 'consultation';
  return 'help';
}
