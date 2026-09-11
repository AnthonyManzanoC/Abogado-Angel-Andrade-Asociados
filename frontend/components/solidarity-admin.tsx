'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Choice } from './form-controls';
const labels: Record<string, string> = {
  recibido: 'Recibida',
  revision: 'En revisión',
  seleccionado: 'Seleccionada',
  no_seleccionado: 'No seleccionada',
};
export function SolidarityAdmin() {
  const [period, setPeriod] = useState(() =>
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: '2-digit',
      }).format(new Date()),
    ),
    [items, setItems] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState(false);
  async function load() {
    setItems(await api('/admin/solidarity?period=' + period));
  }
  useEffect(() => {
    let active = true;
    setSelected(null);
    setItems([]);
    api<any[]>('/admin/solidarity?period=' + period)
      .then((v) => {
        if (active) setItems(v);
      })
      .catch((e) => setMessage(e.message));
    return () => {
      active = false;
    };
  }, [period]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (selected.decision === 'seleccionado' && !confirm) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api('/admin/solidarity/' + selected.id, {
        method: 'PUT',
        body: JSON.stringify(selected),
      });
      await load();
      setSelected(null);
      setConfirm(false);
      setMessage(
        'Decisión guardada y avisos preparados para el cliente y el administrador.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="form-panel">
        <h2>Apoyo solidario mensual</h2>
        <p>
          Revisión humana y confidencial. Evalúa necesidad, viabilidad y
          alcance; la web no clasifica a las personas por su historia.
        </p>
        <p className="muted">
          La apertura, textos, condiciones y día de cierre se editan en
          Configuración. Seleccionar un caso cierra nuevas postulaciones del
          mes. Revisa y comunica también la decisión de las restantes. Una
          selección final no se puede reemplazar.
        </p>
        <label className="field-label">
          Convocatoria
          <input
            className="field"
            type="month"
            required
            value={period}
            disabled={busy}
            onChange={(e) => {
              if (e.target.value) setPeriod(e.target.value);
            }}
          />
        </label>
        <button
          className="btn outline"
          disabled={busy}
          onClick={() => {
            setSelected(null);
            load().catch((e) => setMessage(e.message));
          }}
        >
          Actualizar bandeja
        </button>
        <p>
          {items.length} postulaciones ·{' '}
          {items.filter((i) => i.decision === 'seleccionado').length} de 1 caso
          seleccionado
        </p>
      </div>
      <p role="status">{message}</p>
      {selected ? (
        <form className="form-panel editorial-editor" onSubmit={save}>
          <h2>{selected.name}</h2>
          <p>
            {selected.reference} · {selected.city}
          </p>
          <p>
            {selected.email} · {selected.phone}
          </p>
          <h3>Situación legal</h3>
          <p className="pre-line">{selected.message}</p>
          <h3>Contexto de necesidad</h3>
          <p className="pre-line">{selected.circumstances}</p>
          <details>
            <summary>Condiciones aceptadas al postular</summary>
            <p>{selected.terms}</p>
          </details>
          <fieldset
            disabled={
              busy ||
              selected.status === 'cancelado' ||
              ['seleccionado', 'no_seleccionado'].includes(
                selected.originalDecision,
              )
            }
          >
            <Choice
              label="Decisión"
              value={
                selected.decision === 'recibido'
                  ? 'revision'
                  : selected.decision
              }
              onChange={(v) => {
                setSelected({ ...selected, decision: v });
                setConfirm(false);
              }}
              options={[
                { value: 'revision', label: 'En revisión' },
                {
                  value: 'seleccionado',
                  label: 'Seleccionar para apoyo gratuito',
                },
                { value: 'no_seleccionado', label: 'No seleccionado este mes' },
              ]}
            />
            <label className="field-label">
              Mensaje para la persona
              <textarea
                className="field"
                required
                minLength={10}
                maxLength={2000}
                value={selected.publicNote}
                onChange={(e) =>
                  setSelected({ ...selected, publicNote: e.target.value })
                }
              />
            </label>
            <label className="field-label">
              Notas privadas del despacho
              <textarea
                className="field"
                maxLength={4000}
                value={selected.privateNote}
                onChange={(e) =>
                  setSelected({ ...selected, privateNote: e.target.value })
                }
              />
            </label>
            {confirm && (
              <p className="notice">
                Vas a asignar el único apoyo de {period} a {selected.name}. La
                decisión es definitiva y se prepararán los correos. Confirma
                para continuar.
              </p>
            )}
            <button className="btn gold">
              {busy
                ? 'Guardando…'
                : confirm
                  ? 'Confirmar selección mensual'
                  : 'Guardar revisión'}
            </button>
          </fieldset>
          <button
            className="btn outline"
            type="button"
            disabled={busy}
            onClick={() => {
              setSelected(null);
              setConfirm(false);
            }}
          >
            Volver a la bandeja
          </button>
        </form>
      ) : (
        <div className="editorial-list">
          {items.map((item) => (
            <article className="form-panel" key={item.id}>
              <span className="eyebrow">
                {item.status === 'cancelado'
                  ? 'RETIRADA'
                  : labels[item.decision]}
              </span>
              <h3>{item.name}</h3>
              <p>
                {item.city} · {item.reference}
              </p>
              <button
                className="btn outline"
                onClick={() => {
                  setSelected({
                    ...item,
                    originalDecision: item.decision,
                    decision:
                      item.decision === 'recibido' ? 'revision' : item.decision,
                  });
                  setConfirm(false);
                }}
              >
                Abrir postulación privada
              </button>
            </article>
          ))}
          {!items.length && (
            <p className="notice">No hay postulaciones en esta convocatoria.</p>
          )}
        </div>
      )}
    </div>
  );
}
