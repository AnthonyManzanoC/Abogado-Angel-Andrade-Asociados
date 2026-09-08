'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  RefreshCw,
  LockKeyhole,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  executePortalTool,
  formatDate,
  statusLabels,
} from '@/lib/portal-tools';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
export function Tracking() {
  const [reference, setReference] = useState(''),
    [token, setToken] = useState(''),
    [result, setResult] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [cancel, setCancel] = useState(false);
  const last = useRef('');
  async function load(ref = reference, key = token, quiet = false) {
    if (!quiet) setBusy(true);
    try {
      const d = await executePortalTool('track_request', {
        reference: ref.trim().toUpperCase(),
        token: key.trim(),
      });
      if (last.current && last.current !== d.updatedAt)
        setNotice('Hay una actualización del despacho en tu solicitud.');
      last.current = d.updatedAt;
      setResult(d);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      if (!quiet) setResult(null);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const ref = p.get('ref'),
      key = p.get('key');
    if (ref && key) {
      setReference(ref);
      setToken(key);
      void load(ref, key);
    }
  }, []);
  useEffect(() => {
    if (!result) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible')
        void load(reference, token, true);
    }, 15000);
    return () => clearInterval(id);
  }, [result?.reference, reference, token]);
  async function cancelRequest() {
    setBusy(true);
    try {
      await api('/track/cancel', {
        method: 'POST',
        body: JSON.stringify({ reference, token }),
      });
      setCancel(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tracking-layout">
      <div className="form-panel">
        <span className="large-service-icon">
          <LockKeyhole size={25} />
        </span>
        <h2>Tu espacio privado.</h2>
        <p className="muted">
          Introduce la referencia y la clave de tu comprobante.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label className="field-label">
            Referencia
            <input
              className="field"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              required
              placeholder="AA-XXXXXXXXXXXX"
              autoComplete="off"
              maxLength={15}
            />
          </label>
          <label className="field-label">
            Clave privada
            <input
              className="field"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              type="password"
              placeholder="Clave incluida en tu comprobante"
              autoComplete="off"
              maxLength={64}
            />
          </label>
          <button className="btn gold" disabled={busy}>
            <Search size={17} />
            {busy ? 'Consultando…' : 'Consultar mi solicitud'}
          </button>
        </form>
        <p className="form-note">
          Tu clave es personal. El seguimiento muestra únicamente las novedades
          que el despacho comparte contigo.
        </p>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </div>
      <div>
        {result ? (
          <div className="form-panel tracking-result">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{result.reference}</span>
                <h2>Así va tu solicitud.</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => load()}
                aria-label="Actualizar seguimiento"
                disabled={busy}
              >
                <RefreshCw size={19} />
              </button>
            </div>
            <span className={'status-badge ' + result.status}>
              {statusLabels[result.status]}
            </span>
            {notice && (
              <div className="notice" role="status">
                {notice}
              </div>
            )}
            {result.appointmentAt && (
              <p className="tracking-date">
                <CalendarDays size={19} />
                {formatDate(result.appointmentAt)}
                <span className="muted"> · {result.mode}</span>
              </p>
            )}
            {result.appointmentAt &&
              result.status !== 'confirmado' &&
              result.status !== 'completado' && (
                <p className="form-note">
                  El horario solicitado queda sujeto a confirmación.
                </p>
              )}
            <ol className="timeline">
              {result.events.map((event: any, i: number) => (
                <li key={i}>
                  <span className="timeline-dot">
                    <CheckCircle2 size={15} />
                  </span>
                  <div>
                    <span className="small-caps">
                      {formatDate(event.createdAt)}
                    </span>
                    <h3>{statusLabels[event.status]}</h3>
                    <p>
                      {event.note ||
                        'El despacho actualizó el estado de tu solicitud.'}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="form-note">
              Las novedades se actualizan automáticamente mientras esta página
              está abierta.
            </p>
            {!['cancelado', 'completado'].includes(result.status) && (
              <button
                className="text-link danger-text"
                onClick={() => setCancel(true)}
              >
                Cancelar mi solicitud
              </button>
            )}
          </div>
        ) : (
          <div className="tracking-empty">
            <span className="line-art-icon">
              <CheckCircle2 size={48} strokeWidth={1} />
            </span>
            <h2>Las novedades, en un solo lugar.</h2>
            <p>
              Consulta la recepción, revisión y confirmación de tu solicitud.
            </p>
            <Link href="/consulta" className="text-link">
              ¿Aún no tienes una solicitud? Agenda aquí.
            </Link>
          </div>
        )}
      </div>
      <AlertDialog open={cancel} onOpenChange={setCancel}>
        <AlertDialogContent>
          <AlertDialogTitle>¿Cancelar esta solicitud?</AlertDialogTitle>
          <AlertDialogDescription>
            El despacho verá la cancelación y el horario quedará disponible.
            Puedes enviar una nueva solicitud después.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Mantener solicitud</AlertDialogCancel>
            <button
              className="btn gold"
              disabled={busy}
              onClick={cancelRequest}
            >
              Confirmar cancelación
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
