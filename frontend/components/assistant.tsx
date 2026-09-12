'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  ArrowUpRight,
  ArrowUp,
  RotateCcw,
  CheckCircle2,
  LoaderCircle,
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { Check } from './form-controls';
import { useVoice } from '@/hooks/use-voice';
import {
  credentials,
  detectIntent,
  executePortalTool,
  formatDate,
  localDate,
  normalize,
  registerWebMCP,
  statusLabels,
  trackingLink,
} from '@/lib/portal-tools';
type Message = {
  role: 'assistant' | 'user';
  text: string;
  choices?: string[];
  link?: string;
  linkLabel?: string;
};
const greeting = (name: string): Message => ({
  role: 'assistant',
  text: `Hola, soy ${name}, la asistente del despacho. Puedo ayudarte a solicitar una cita, enviar una consulta o revisar su estado. ¿Qué necesitas hoy?`,
  choices: [
    'Agendar una cita',
    'Ver servicios',
    'Consultar mi solicitud',
    'Cómo llegar',
    'Apoyo solidario',
  ],
});
export function Assistant({ name = 'Alma' }: { name?: string }) {
  const welcome = greeting(name);
  const [open, setOpen] = useState(false),
    [messages, setMessages] = useState<Message[]>([welcome]),
    [input, setInput] = useState(''),
    [step, setStep] = useState('idle'),
    [draft, setDraft] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [slots, setSlots] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null),
    [services, setServices] = useState<any[]>([]);
  const draftRef = useRef<any>({});
  useEffect(() => {
    setMessages((m) =>
      m.length === 1 && m[0].role === 'assistant' ? [greeting(name)] : m,
    );
  }, [name]);
  const voice = useVoice((text) => {
    if (!busy && step !== 'review' && step !== 'track-token') {
      setInput(text);
    }
  }, open);
  useEffect(() => registerWebMCP(), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, open]);
  const say = (
    text: string,
    choices?: string[],
    link?: string,
    linkLabel?: string,
  ) => {
    voice.speak(text);
    setMessages((m) => [
      ...m,
      { role: 'assistant', text, choices, link, linkLabel },
    ]);
  };
  const update = (key: string, value: any) => {
    draftRef.current = { ...draftRef.current, [key]: value };
    setDraft(draftRef.current);
  };
  function reset() {
    setStep('idle');
    setDraft({});
    draftRef.current = {};
    setConsent(false);
    setInput('');
    setMessages([welcome]);
  }
  async function begin(appointment: boolean) {
    const data = await executePortalTool('list_services');
    setServices(data);
    draftRef.current = {
      ...credentials(),
      appointment,
      mode: 'presencial',
      serviceId: 'general',
      email: '',
    };
    setDraft(draftRef.current);
    setStep('name');
    say('Con gusto. Primero, ¿cuál es tu nombre y apellido?');
  }
  async function send(text: string) {
    if (!text.trim() || busy) return;
    text = text.trim();
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      if (detectIntent(text) === 'reset') {
        reset();
        return;
      }
      if (step === 'name') {
        if (text.length < 2 || text.length > 100) {
          say('Escribe un nombre de entre 2 y 100 caracteres.');
          return;
        }
        update('name', text);
        setStep('phone');
        say(
          'Gracias, ' +
            text.split(' ')[0] +
            '. ¿A qué teléfono puede contactarte el despacho?',
        );
      } else if (step === 'phone') {
        if (!/^\+?[\d\s()\-]{7,25}$/.test(text)) {
          say(
            'Revisa el número. Puedes incluir el código de país, por ejemplo +593.',
          );
          return;
        }
        update('phone', text);
        setStep('email');
        say(
          '¿Cuál es tu correo? Allí recibirás el enlace privado de seguimiento y las novedades. Escríbelo para evitar errores de dictado.',
        );
      } else if (step === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
          say('Escribe un correo válido para recibir tus notificaciones.');
          return;
        }
        update('email', text);
        setStep('service');
        say('¿Con qué área se relaciona tu consulta?', [
          'Orientación inicial',
          ...services.map((s) => s.title),
        ]);
      } else if (step === 'service') {
        const service = services.find(
          (s) => normalize(s.title) === normalize(text),
        );
        if (!service && normalize(text) !== 'orientacion inicial') {
          say('Elige una de las áreas disponibles.', [
            'Orientación inicial',
            ...services.map((s) => s.title),
          ]);
          return;
        }
        update('serviceId', service?.id || 'general');
        setStep('mode');
        say('¿Prefieres atención presencial o virtual?', [
          'Presencial',
          'Virtual',
        ]);
      } else if (step === 'mode') {
        if (!['presencial', 'virtual'].includes(normalize(text))) {
          say('Elige Presencial o Virtual.', ['Presencial', 'Virtual']);
          return;
        }
        update('mode', normalize(text));
        if (draftRef.current.appointment) {
          setStep('date');
          say(
            '¿Qué día te gustaría solicitar? Elige una fecha del calendario. Los horarios corresponden a Ecuador.',
          );
        } else {
          setStep('message');
          say(
            'Cuéntame brevemente qué necesitas. Evita documentos y detalles sensibles.',
          );
        }
      } else if (step === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          say(
            'Selecciona la fecha en el calendario o escríbela como AAAA-MM-DD.',
          );
          return;
        }
        const r = await executePortalTool('check_availability', { date: text });
        if (!r.slots.length) {
          say('Ese día no tiene horarios disponibles. Elige otra fecha.');
          return;
        }
        setSlots(r.slots);
        setStep('slot');
        say(
          'Estos horarios están disponibles. ¿Cuál prefieres?',
          r.slots.map((s: string) => s.substring(11, 16)),
        );
      } else if (step === 'slot') {
        const slot = slots.find((s) => s.substring(11, 16) === text);
        if (!slot) {
          say(
            'Selecciona uno de los horarios disponibles.',
            slots.map((s) => s.substring(11, 16)),
          );
          return;
        }
        update('appointmentAt', slot);
        setStep('message');
        say(
          'Cuéntame brevemente qué necesitas. Evita documentos y detalles sensibles.',
        );
      } else if (step === 'message') {
        if (text.length < 10 || text.length > 3000) {
          say('Comparte un resumen de entre 10 y 3000 caracteres.');
          return;
        }
        update('message', text);
        setStep('review');
        const d = draftRef.current;
        say(
          'Revisa tu solicitud:\n\n' +
            d.name +
            '\n' +
            d.phone +
            (d.email ? ' · ' + d.email : '') +
            '\n' +
            (services.find((s) => s.id === d.serviceId)?.title ||
              'Orientación inicial') +
            ' · ' +
            d.mode +
            (d.appointmentAt ? '\n' + formatDate(d.appointmentAt) : '') +
            '\n\n' +
            d.message +
            '\n\nSe enviará al despacho y quedará pendiente de revisión.',
        );
      } else if (step === 'track-reference') {
        if (!/^AA-[A-F0-9]{12}$/i.test(text)) {
          say(
            'Escribe la referencia de tu comprobante, por ejemplo AA- seguido de 12 caracteres.',
          );
          return;
        }
        update('reference', text.toUpperCase());
        setStep('track-token');
        say('Ahora escribe la clave privada que aparece en tu comprobante.');
      } else if (step === 'track-token') {
        const r = await executePortalTool('track_request', {
          reference: draftRef.current.reference,
          token: text,
        });
        say(
          'Tu solicitud ' +
            r.reference +
            ' está ' +
            (statusLabels[r.status] || r.status).toLowerCase() +
            '.' +
            (r.appointmentAt
              ? '\nHorario solicitado: ' + formatDate(r.appointmentAt)
              : '') +
            '\n\n' +
            (r.events.at(-1)?.note ||
              'El despacho compartirá las novedades aquí.'),
          undefined,
          trackingLink(r.reference, text),
          'Abrir mi seguimiento',
        );
        setStep('idle');
      } else if (step === 'review') {
        say(
          'Revisa los datos y utiliza «Confirmar y enviar». Si necesitas cambiar algo, pulsa el botón de reiniciar.',
        );
      } else {
        switch (detectIntent(text)) {
          case 'solidarity':
            say(
              'El despacho tiene un programa mensual de apoyo gratuito. El abogado revisa cada postulación de forma privada y selecciona un caso según necesidad y viabilidad. Consulta la convocatoria y sus condiciones antes de enviar tu historia.',
              undefined,
              '/apoyo',
              'Conocer el apoyo solidario',
            );
            break;
          case 'appointment':
            await begin(true);
            break;
          case 'consultation':
            await begin(false);
            break;
          case 'services': {
            const data = await executePortalTool('list_services');
            say(
              'Estas son las áreas disponibles:\n\n' +
                data
                  .map((s: any) => '• ' + s.title + '\n' + s.summary)
                  .join('\n\n'),
              ['Agendar una cita', 'Enviar una consulta'],
              '/servicios',
              'Explorar los servicios',
            );
            break;
          }
          case 'office': {
            const s = await executePortalTool('get_office');
            say(
              'Nos encuentras en ' +
                s.address +
                ', ' +
                s.city +
                '.\n\n' +
                s.hours +
                (s.phone ? '\nTeléfono: ' + s.phone : ''),
              ['Agendar una cita'],
              '/contacto',
              'Ver ubicación',
            );
            break;
          }
          case 'posts': {
            const query = text.replace(
              /^(buscar|busca|videos? de|vitrina|publicaciones?)\s*/i,
              '',
            );
            const r = await executePortalTool('search_posts', {
              search: /^(video|videos|vitrina legal|redes)$/i.test(text)
                ? ''
                : query,
            });
            say(
              r.items.length
                ? 'Encontré estas publicaciones:\n\n' +
                    r.items.map((p: any) => '• ' + p.title).join('\n')
                : 'No encontré publicaciones con esas palabras. Puedes explorar todos los temas.',
              undefined,
              '/vitrina',
              'Abrir vitrina legal',
            );
            break;
          }
          case 'track':
            setStep('track-reference');
            say(
              'Voy a consultar tu solicitud. Escribe la referencia que empieza por AA-.',
            );
            break;
          default:
            say(
              'Puedo ejecutar estas gestiones del portal. Para analizar una situación jurídica, el abogado debe revisar tu caso.',
              [
                'Agendar una cita',
                'Enviar una consulta',
                'Ver servicios',
                'Consultar mi solicitud',
              ],
            );
        }
      }
    } catch (e) {
      say((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!consent || busy) return;
    setBusy(true);
    try {
      const r = await executePortalTool('create_consultation', {
        ...draftRef.current,
        consent: true,
        appointmentAt: draftRef.current.appointmentAt || null,
      });
      say(
        'Listo. Tu solicitud quedó registrada con la referencia ' +
          r.reference +
          '.\n\n' +
          (r.appointmentAt
            ? 'El horario está pendiente de confirmación. '
            : '') +
          'Se han registrado los avisos de recepción para ti y para el despacho. La aprobación, confirmación o cancelación también se notifican por correo. En tu seguimiento puedes comprobar el estado del envío; guarda este enlace privado para regresar.' +
          (r.status === 'pendiente_pago'
            ? ' La cita virtual requiere verificar el pago antes de agendar.'
            : ''),
        undefined,
        trackingLink(r.reference, draftRef.current.trackingToken),
        'Guardar y abrir mi seguimiento',
      );
      setStep('idle');
      setConsent(false);
    } catch (e) {
      say((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="assistant-launch"
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente del despacho"
      >
        <span className="assistant-symbol">
          <MessageCircle size={21} />
        </span>
        <span>
          ¿En qué te ayudo?<small>{name} · Asistente del despacho</small>
        </span>
        <span className="assistant-online" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="assistant-sheet" showCloseButton={false}>
          <header className="assistant-header">
            <span className="assistant-symbol">
              <MessageCircle size={22} />
            </span>
            <div>
              <SheetTitle>{name}</SheetTitle>
              <SheetDescription>
                Citas, consultas y seguimiento
              </SheetDescription>
            </div>
            <button
              className="icon-button"
              onClick={reset}
              aria-label="Reiniciar conversación"
            >
              <RotateCcw size={17} />
            </button>
            <SheetClose
              render={
                <button className="icon-button" aria-label="Cerrar asistente" />
              }
            >
              <X size={20} />
            </SheetClose>
          </header>
          <div className="assistant-messages" role="log" aria-live="polite">
            {messages.map((m, i) => (
              <div className={'chat-message ' + m.role} key={i}>
                <div className="chat-bubble">
                  {m.role === 'user' &&
                  i > 0 &&
                  messages[i - 1]?.text.includes('clave privada que aparece')
                    ? '•••••••• (clave privada)'
                    : m.text}
                </div>
                {m.choices && i === messages.length - 1 && (
                  <div className="chat-choices">
                    {m.choices.map((c) => (
                      <button disabled={busy} key={c} onClick={() => send(c)}>
                        {c}
                        <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>
                )}
                {m.link && (
                  <Link
                    href={m.link}
                    className="chat-result-link"
                    onClick={() => setOpen(false)}
                  >
                    {m.linkLabel}
                    <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
            ))}
            {busy && (
              <p className="assistant-working">
                <LoaderCircle size={15} className="spin" /> Consultando el
                despacho…
              </p>
            )}
            {step === 'review' && (
              <div className="chat-confirm">
                <Check checked={consent} onChange={setConsent}>
                  He revisado los datos y acepto el{' '}
                  <Link
                    href="/privacidad"
                    target="_blank"
                    className="inline-link"
                  >
                    tratamiento de datos
                  </Link>{' '}
                  para esta solicitud.
                </Check>
                <button
                  className="btn gold"
                  disabled={busy || !consent}
                  onClick={confirm}
                >
                  <CheckCircle2 size={16} /> Confirmar y enviar
                </button>
              </div>
            )}
            <div ref={bottom} />
          </div>
          <form
            className="assistant-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              type={
                step === 'date'
                  ? 'date'
                  : step === 'track-token'
                    ? 'password'
                    : 'text'
              }
              min={step === 'date' ? localDate() : undefined}
              placeholder={
                step === 'track-token'
                  ? 'Tu clave privada…'
                  : 'Escribe lo que necesitas…'
              }
              aria-label={'Mensaje para ' + name}
              disabled={busy || step === 'review'}
              maxLength={3000}
            />
            <button
              aria-label="Enviar mensaje"
              disabled={!input.trim() || busy || step === 'review'}
            >
              <ArrowUp size={19} />
            </button>
          </form>
          <div className="voice-controls">
            <button
              type="button"
              className="text-link"
              disabled={
                !voice.supported ||
                busy ||
                step === 'review' ||
                step === 'track-token'
              }
              onClick={voice.dictate}
              aria-pressed={voice.listening}
            >
              {voice.listening ? <MicOff size={16} /> : <Mic size={16} />}{' '}
              {voice.listening ? 'Detener dictado' : 'Dictar mensaje'}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={voice.toggleReading}
              aria-pressed={voice.readAloud}
            >
              {voice.readAloud ? <Volume2 size={16} /> : <VolumeX size={16} />}{' '}
              {voice.readAloud ? 'Silenciar respuestas' : 'Escuchar respuestas'}
            </button>
          </div>
          <p className="assistant-footnote" role="status">
            {voice.notice ||
              (voice.listening
                ? 'Escuchando…'
                : voice.supported
                  ? 'Revisa el dictado antes de enviarlo. El navegador puede procesar audio en sus servidores.'
                  : 'Dictado no disponible en este navegador. Puedes escribir.')}
          </p>
          <p className="assistant-footnote">
            Gestiones programadas. La asesoría la brinda el abogado.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
