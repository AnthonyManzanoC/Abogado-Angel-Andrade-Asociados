'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { statusLabels, formatDate } from '@/lib/portal-tools';
import { emailStatusLabels, notificationState } from './notification-status';
import { Check } from './form-controls';
export function NotificationAdmin() {
  const [check, setCheck] = useState<{
    ready: boolean;
    issues: string[];
    webhookConfigured: boolean;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [searchNotice, setSearchNotice] = useState('');
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
  async function verifyConfiguration() {
    if (data && typeof data.webhookConfigured !== 'boolean') {
      setError(
        'El servidor todavía ejecuta una versión anterior. Despliega el último commit del backend en Render y vuelve a comprobar la configuración.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      setCheck(await api('/admin/notifications/check'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel notification-admin">
      <div className="panel-heading">
        <h2>Centro de notificaciones · Brevo</h2>
        <button className="text-link" onClick={load}>
          Actualizar
        </button>
      </div>
      <button
        type="button"
        className="btn outline"
        disabled={busy}
        onClick={() => void verifyConfiguration()}
      >
        Comprobar configuración y remitente
      </button>
      {check && (
        <div className="notice" role="status">
          <strong>
            {check.ready
              ? 'Brevo y el remitente están preparados.'
              : 'Hay configuración pendiente:'}
          </strong>
          {check.issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
          <p>
            La confirmación de entrega requiere también registrar el webhook en
            Brevo. Activar el envío procesa los avisos pendientes.
          </p>
        </div>
      )}
      <label className="field-label">
        Buscar una referencia entre los últimos 100 avisos
        <input
          className="field"
          value={search}
          onChange={(e) => {
            if (/xkeysib-/i.test(e.target.value)) {
              setSearch('');
              setSearchNotice(
                'Este buscador solo filtra números de solicitud. La clave de Brevo se configura como BREVO_API_KEY en el servidor de Render.',
              );
              return;
            }
            setSearchNotice('');
            setSearch(e.target.value);
          }}
          placeholder="AA-…"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="form-note">
          Introduce el número AA- de una solicitud para localizar sus avisos.
        </span>
      </label>
      {searchNotice && (
        <p className="notice" role="status">
          {searchNotice}
        </p>
      )}
      <p>
        {data
          ? data.enabled
            ? 'Envío activado'
            : 'Envío pausado: los avisos permanecen guardados.'
          : 'Consultando notificaciones…'}
      </p>
      {data && !data.configured && (
        <div className="error-message">
          <strong>Falta configurar Brevo en Render.</strong>
          <p>
            En el servicio andrade-legal-api, abre Environment y configura
            BREVO_API_KEY, NOTIFICATION_ENCRYPTION_KEY, BREVO_WEBHOOK_SECRET y
            EMAIL_DELIVERY_ENABLED=true. Conserva la clave de cifrado existente
            y despliega el backend actualizado.
          </p>
          <p>
            Después comprueba el remitente aquí y activa los correos en
            Configuración. Pegar una clave en el buscador no activa los envíos.
          </p>
        </div>
      )}
      {data && !data.webhookConfigured && (
        <p className="notice">
          Falta configurar la confirmación de entrega (webhook) en el servidor.
          Por ahora solo se puede comprobar la aceptación por Brevo.
        </p>
      )}
      <p className="form-note">
        Consultas, citas y apoyo solidario. La aceptación por Brevo no acredita
        la entrega. Los envíos sin respuesta confirmada requieren revisar el
        registro de Brevo antes de reintentar. Se conserva el contenido
        original; comprueba la fecha de la novedad para no reenviar estados
        antiguos.
      </p>
      <Check checked={reviewed} onChange={setReviewed}>
        He revisado el registro de Brevo y el estado actual de la solicitud
        antes de reintentar los avisos.
      </Check>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="notification-list">
        {data?.items
          ?.filter((n: any) =>
            n.reference.toLowerCase().includes(search.trim().toLowerCase()),
          )
          .map((n: any) => (
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
                <strong>{emailStatusLabels[notificationState(n)]}</strong>
                {n.lastError && <p className="form-note">{n.lastError}</p>}
                {['failed', 'uncertain'].includes(n.status) &&
                  (!n.deliveryStatus || n.deliveryStatus === 'unknown') && (
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
