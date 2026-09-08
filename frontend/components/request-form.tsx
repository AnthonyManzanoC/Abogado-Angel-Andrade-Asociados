'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Download,
  CalendarDays,
  ShieldCheck,
  LoaderCircle,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Choice, Check } from './form-controls';
import { Content } from '@/lib/api';
import {
  credentials,
  executePortalTool,
  formatDate,
  localDate,
  trackingLink,
} from '@/lib/portal-tools';
export function RequestForm({
  services,
  initialService = 'general',
}: {
  services: Content[];
  initialService?: string;
}) {
  const [step, setStep] = useState(1),
    [type, setType] = useState('appointment'),
    [date, setDate] = useState(''),
    [slots, setSlots] = useState<string[]>([]),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState<any>(null),
    [keys, setKeys] = useState({ idempotencyKey: '', trackingToken: '' });
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    serviceId: initialService,
    message: '',
    mode: 'presencial',
    appointmentAt: '',
    consent: false,
    website: '',
  });
  const change = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  useEffect(() => setKeys(credentials()), []);
  useEffect(() => {
    if (!date) return;
    let alive = true;
    setLoading(true);
    setError('');
    change('appointmentAt', '');
    executePortalTool('check_availability', { date })
      .then((d) => {
        if (alive) setSlots(d.slots);
      })
      .catch((e) => {
        if (alive) {
          setSlots([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [date]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (step === 1) {
      if (type === 'appointment' && !form.appointmentAt) {
        setError('Selecciona una fecha y un horario disponible.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (!form.consent) {
      setError('Acepta el tratamiento de datos antes de enviar.');
      return;
    }
    setBusy(true);
    try {
      const r = await executePortalTool('create_consultation', {
        ...form,
        ...keys,
        appointmentAt: type === 'appointment' ? form.appointmentAt : null,
      });
      setReceipt(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const text =
      'ÁNGEL ANDRADE NÚÑEZ · SOLICITUD RECIBIDA\n\nReferencia: ' +
      receipt.reference +
      '\nClave privada: ' +
      keys.trackingToken +
      '\nSeguimiento: ' +
      window.location.origin +
      trackingLink(receipt.reference, keys.trackingToken) +
      '\n\n' +
      (receipt.appointmentAt
        ? 'Horario solicitado: ' + formatDate(receipt.appointmentAt) + '\n'
        : '') +
      'La cita queda pendiente de confirmación del despacho. Conserva este archivo de forma privada.';
    const url = URL.createObjectURL(
      new Blob([text], { type: 'text/plain;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = receipt.reference + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
  if (receipt)
    return (
      <div className="form-panel receipt" role="status">
        <span className="success-icon">
          <CheckCircle2 size={32} />
        </span>
        <div className="eyebrow">SOLICITUD RECIBIDA</div>
        <h2>Tu siguiente paso ya está en marcha.</h2>
        <p>
          El despacho revisará tu solicitud.{' '}
          {receipt.appointmentAt
            ? 'La cita está pendiente de confirmación.'
            : ''}{' '}
          Consulta las novedades en tu espacio de seguimiento.
        </p>
        <div className="receipt-code">{receipt.reference}</div>
        <p className="muted">
          Guarda el comprobante: contiene tu enlace y clave privada. Solo quien
          tenga esa clave podrá consultar la solicitud.
        </p>
        <div className="button-row">
          <Link
            className="btn gold"
            href={trackingLink(receipt.reference, keys.trackingToken)}
          >
            Ver mi seguimiento <ArrowRight size={17} />
          </Link>
          <button className="btn outline" onClick={download}>
            <Download size={17} /> Guardar comprobante
          </button>
        </div>
      </div>
    );
  return (
    <div className="form-panel">
      <div className="steps">
        {['Tu consulta', 'Tus datos', 'Revisa y envía'].map((s, i) => (
          <div
            key={s}
            className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''}
          >
            <span>{step > i + 1 ? '✓' : i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        {step === 1 && (
          <>
            <h2>¿Cómo podemos ayudarte?</h2>
            <p className="muted">
              Elige una cita o envía un mensaje al despacho.
            </p>
            <Tabs
              value={type}
              onValueChange={(v) => setType(String(v))}
              className="form-tabs"
            >
              <TabsList>
                <TabsTrigger value="appointment">
                  Solicitar una cita
                </TabsTrigger>
                <TabsTrigger value="message">Enviar una consulta</TabsTrigger>
              </TabsList>
            </Tabs>
            <label className="field-label">
              Área de consulta
              <Choice
                label="Área de consulta"
                value={form.serviceId}
                onChange={(v) => change('serviceId', v)}
                options={[
                  { value: 'general', label: 'Quiero orientación inicial' },
                  ...services.map((s) => ({ value: s.id, label: s.title })),
                ]}
              />
            </label>
            <label className="field-label">
              Modalidad
              <Choice
                label="Modalidad"
                value={form.mode}
                onChange={(v) => change('mode', v)}
                options={[
                  {
                    value: 'presencial',
                    label: 'Presencial · Edificio Alavama',
                  },
                  {
                    value: 'virtual',
                    label: 'Virtual · Por coordinar con el despacho',
                  },
                ]}
              />
            </label>
            {type === 'appointment' && (
              <>
                <label className="field-label">
                  Fecha de la consulta
                  <input
                    className="field"
                    type="date"
                    value={date}
                    min={localDate()}
                    max={new Date(Date.now() + 60 * 86400000)
                      .toISOString()
                      .slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </label>
                <span className="field-label">
                  Horarios disponibles{' '}
                  <span className="muted">· Hora de Ecuador (UTC−5)</span>
                </span>
                {loading ? (
                  <p className="inline-loading">
                    <LoaderCircle size={16} /> Consultando la agenda…
                  </p>
                ) : !date ? (
                  <p className="muted">
                    Selecciona una fecha para ver los horarios.
                  </p>
                ) : slots.length === 0 ? (
                  <p className="notice">
                    No hay horarios libres para esta fecha. Elige otro día o
                    envía una consulta.
                  </p>
                ) : (
                  <div className="time-grid">
                    {slots.map((s) => (
                      <button
                        type="button"
                        key={s}
                        className={
                          form.appointmentAt === s
                            ? 'time-slot selected'
                            : 'time-slot'
                        }
                        onClick={() => change('appointmentAt', s)}
                        aria-pressed={form.appointmentAt === s}
                      >
                        {s.substring(11, 16)}
                      </button>
                    ))}
                  </div>
                )}
                <p className="form-note">
                  <CalendarDays size={15} /> La reserva se confirma después de
                  la revisión del despacho.
                </p>
              </>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <h2>Primero, conozcámonos.</h2>
            <p className="muted">
              Comparte lo necesario para responder a tu solicitud.
            </p>
            <label className="field-label">
              Nombre completo
              <input
                className="field"
                value={form.name}
                onChange={(e) => change('name', e.target.value)}
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
                placeholder="Tu nombre y apellido"
              />
            </label>
            <div className="form-row">
              <label className="field-label">
                Teléfono
                <input
                  className="field"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => change('phone', e.target.value)}
                  minLength={7}
                  maxLength={25}
                  required
                  placeholder="Tu número de contacto"
                />
              </label>
              <label className="field-label">
                Correo <span className="muted">(opcional)</span>
                <input
                  className="field"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => change('email', e.target.value)}
                  maxLength={200}
                  placeholder="nombre@correo.com"
                />
              </label>
            </div>
            <label className="field-label">
              Cuéntanos brevemente
              <textarea
                className="field"
                value={form.message}
                onChange={(e) => change('message', e.target.value)}
                minLength={10}
                maxLength={3000}
                rows={5}
                required
                placeholder="¿Sobre qué te gustaría conversar?"
              />
            </label>
            <p className="form-note">
              Evita incluir números de identificación, documentos o detalles
              sensibles en este primer mensaje.
            </p>
            <div className="honeypot" aria-hidden="true">
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => change('website', e.target.value)}
                aria-label="Sitio web"
              />
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Todo listo para el siguiente paso.</h2>
            <p className="muted">Revisa tu información antes de enviarla.</p>
            <dl className="review-details">
              <div>
                <dt>Nombre</dt>
                <dd>{form.name}</dd>
              </div>
              <div>
                <dt>Contacto</dt>
                <dd>
                  {form.phone}
                  {form.email && ' · ' + form.email}
                </dd>
              </div>
              <div>
                <dt>Servicio</dt>
                <dd>
                  {services.find((s) => s.id === form.serviceId)?.title ||
                    'Orientación inicial'}
                </dd>
              </div>
              <div>
                <dt>Modalidad</dt>
                <dd>{form.mode}</dd>
              </div>
              {type === 'appointment' && (
                <div>
                  <dt>Horario solicitado</dt>
                  <dd>{formatDate(form.appointmentAt)}</dd>
                </div>
              )}
              <div>
                <dt>Tu consulta</dt>
                <dd className="pre-line">{form.message}</dd>
              </div>
            </dl>
            <Check
              checked={form.consent}
              onChange={(v) => change('consent', v)}
            >
              Autorizo el tratamiento de mis datos para atender esta solicitud y
              he leído el{' '}
              <Link href="/privacidad" target="_blank" className="inline-link">
                aviso de privacidad
              </Link>
              .
            </Check>
            <p className="form-note">
              <ShieldCheck size={16} /> El envío no constituye contratación ni
              asesoría jurídica.
            </p>
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {step > 1 && (
            <button
              className="btn outline"
              type="button"
              onClick={() => {
                setStep(step - 1);
                setError('');
              }}
              disabled={busy}
            >
              <ArrowLeft size={16} /> Volver
            </button>
          )}
          <button className="btn gold" type="submit" disabled={busy || loading}>
            {busy
              ? 'Enviando…'
              : step === 3
                ? 'Enviar mi solicitud'
                : 'Continuar'}{' '}
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ArrowRight size={17} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
