'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Check } from './form-controls';
import { ReceiptEmail } from './notification-status';
export function SolidarityForm({ terms }: { terms: string }) {
  const [program, setProgram] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [accepted, setAccepted] = useState(false),
    [receipt, setReceipt] = useState<any>(null),
    [keys, setKeys] = useState<any>(null);
  useEffect(() => {
    api('/solidarity')
      .then(setProgram)
      .catch((e) => setError(e.message));
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    setKeys({
      idempotencyKey: crypto.randomUUID(),
      trackingToken: Array.from(bytes, (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
    });
  }, []);
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await api('/solidarity', {
        method: 'POST',
        body: JSON.stringify({
          ...Object.fromEntries(form),
          consent,
          termsConsent: accepted,
          ...keys,
        }),
      });
      setReceipt({ ...result, email: form.get('email') });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (receipt) {
    const link =
      '/seguimiento#ref=' + receipt.reference + '&key=' + keys.trackingToken;
    return (
      <div className="form-panel receipt" role="status">
        <span className="eyebrow">TU HISTORIA FUE RECIBIDA</span>
        <h2>Gracias por confiar.</h2>
        <p>
          El abogado revisará tu postulación de forma privada. No necesitas
          realizar ningún pago.
        </p>
        <div className="receipt-code">{receipt.reference}</div>
        <ReceiptEmail
          reference={receipt.reference}
          token={keys.trackingToken}
          email={receipt.email}
        />
        <Link className="btn gold" href={link}>
          Ver mi seguimiento privado
        </Link>
        <button
          className="btn outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.origin + link);
              setError('Enlace copiado. Guárdalo en un lugar privado.');
            } catch {
              setError(
                'Abre el seguimiento y guarda el enlace desde tu navegador.',
              );
            }
          }}
        >
          Copiar enlace para regresar
        </button>
        <p>{error}</p>
      </div>
    );
  }
  return (
    <form className="form-panel solidarity-form" onSubmit={send}>
      <span className="eyebrow">POSTULACIÓN CONFIDENCIAL</span>
      <h2>Te escuchamos.</h2>
      {program && (
        <p className="notice">
          {program.open
            ? `Convocatoria ${program.period} · hasta el ${program.deadline}, 23:59 (Ecuador).`
            : program.awarded
              ? 'El apoyo de este mes ya fue asignado. La próxima convocatoria se abre el siguiente mes si el programa está activo.'
              : 'Convocatoria cerrada. Puedes consultar aquí la próxima apertura.'}
        </p>
      )}
      <p role="alert">{error}</p>
      {!program && !error && <p>Cargando convocatoria…</p>}
      <fieldset disabled={busy || !program?.open || !keys}>
        <div className="form-grid">
          {[
            ['name', 'Nombre completo', 'text', 100],
            ['email', 'Correo para tu seguimiento', 'email', 200],
            ['phone', 'WhatsApp o teléfono', 'tel', 25],
            ['city', 'Ciudad de residencia', 'text', 120],
          ].map(([name, label, type, max]) => (
            <label className="field-label" key={name as string}>
              {label}
              <input
                className="field"
                name={name as string}
                type={type as string}
                maxLength={max as number}
                minLength={name === 'phone' ? 7 : 2}
                required
                autoComplete={
                  name === 'name'
                    ? 'name'
                    : name === 'email'
                      ? 'email'
                      : name === 'phone'
                        ? 'tel'
                        : 'address-level2'
                }
              />
            </label>
          ))}
        </div>
        <label className="field-label">
          Cuéntanos qué sucede
          <textarea
            className="field"
            name="message"
            minLength={10}
            maxLength={3000}
            rows={5}
            required
            placeholder="Describe el problema, qué ayuda necesitas y si tienes algún plazo próximo."
          />
        </label>
        <label className="field-label">
          ¿Qué dificulta que puedas acceder a ayuda legal?
          <textarea
            className="field"
            name="circumstances"
            minLength={20}
            maxLength={2000}
            rows={4}
            required
            placeholder="Comparte solo lo necesario para comprender tu situación. No incluyas cédulas, contraseñas, cuentas bancarias ni datos identificables de menores o terceros."
          />
        </label>
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="honeypot"
          aria-hidden="true"
        />
        <div className="solidarity-terms">
          <h3>Condiciones del programa</h3>
          <p className="pre-line">{terms}</p>
        </div>
        <Check checked={accepted} onChange={setAccepted}>
          He leído las condiciones y entiendo que postular no garantiza la
          selección.
        </Check>
        <Check checked={consent} onChange={setConsent}>
          Autorizo al despacho a revisar esta información y contactarme para
          esta postulación.{' '}
          <Link href="/privacidad">Política de privacidad</Link>.
        </Check>
        <button className="btn gold" disabled={!consent || !accepted}>
          {busy ? 'Enviando…' : 'Enviar mi postulación'}
        </button>
        <p className="muted">
          Una postulación por correo y mes. Tu historia no se publica ni se
          utiliza como testimonio.
        </p>
      </fieldset>
    </form>
  );
}
