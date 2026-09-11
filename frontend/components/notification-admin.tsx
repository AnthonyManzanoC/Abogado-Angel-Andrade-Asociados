'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { statusLabels, formatDate } from '@/lib/portal-tools';
import { emailStatusLabels } from './notification-status';
import { Check } from './form-controls';
export function NotificationAdmin() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false);
  async function load() {
    try {
      setData(await api('/admin/notifications'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15000);
    return () => clearInterval(timer);
  }, []);
  async function retry(id: string) {
    setBusy(true);
    try {
      await api('/admin/notifications/' + id + '/retry', { method: 'POST' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel notification-admin">
      <div className="panel-heading">
        <h2>Correos de citas · Brevo</h2>
        <button className="text-link" onClick={load}>
          Actualizar
        </button>
      </div>
      <p>
        {data
          ? data.enabled
            ? 'Envío activado'
            : 'Envío pausado: los avisos permanecen guardados.'
          : 'Consultando notificaciones…'}
      </p>
      {data && !data.configured && (
        <p className="error-message">Falta la clave de Brevo en el servidor.</p>
      )}
      <p className="form-note">
        La aceptación por Brevo no acredita la entrega. Los envíos sin respuesta
        confirmada requieren revisar el registro de Brevo antes de reintentar.
        Se conserva el contenido original; comprueba la fecha de la novedad para
        no reenviar estados antiguos.
      </p>
      <Check checked={reviewed} onChange={setReviewed}>
        He revisado el registro de Brevo y el estado actual de la cita antes de
        reintentar los avisos.
      </Check>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="notification-list">
        {data?.items?.map((n: any) => (
          <div key={n.id} className="notification-row">
            <div>
              <strong>{n.reference}</strong>
              <p>
                {n.audience === 'client' ? 'Cliente' : 'Administrador'} ·{' '}
                {statusLabels[n.eventStatus] || n.eventStatus}
              </p>
              <small>{formatDate(n.createdAt)}</small>
            </div>
            <div>
              <strong>{emailStatusLabels[n.status]}</strong>
              {n.lastError && <p className="form-note">{n.lastError}</p>}
              {['failed', 'uncertain'].includes(n.status) && (
                <button
                  className="btn outline"
                  disabled={busy || !reviewed || !data.enabled}
                  onClick={() => retry(n.id)}
                >
                  Reintentar aviso
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {data?.items?.length === 0 && (
        <p className="admin-empty">Todavía no hay avisos en la cola.</p>
      )}
    </section>
  );
}
