'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Content, uploadMedia } from '@/lib/api';
import { Choice, Check } from './form-controls';
const kinds = [
  { value: 'education', label: 'Formación y estudios' },
  { value: 'achievements', label: 'Logros y reconocimientos' },
  { value: 'gallery', label: 'Galería del abogado' },
  { value: 'cases', label: 'Casos ganados' },
];
export function EditorialAdmin() {
  const router = useRouter();
  const [kind, setKind] = useState('education'),
    [items, setItems] = useState<Content[]>([]),
    [draft, setDraft] = useState<Content | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function load() {
    setItems(await api('/admin/content/' + kind));
  }
  useEffect(() => {
    let active = true;
    setItems([]);
    setDraft(null);
    api<Content[]>('/admin/content/' + kind)
      .then((v) => {
        if (active) setItems(v);
      })
      .catch((e) => setMessage(e.message));
    return () => {
      active = false;
    };
  }, [kind]);
  function change(key: string, value: any) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setMessage('');
    try {
      await api('/admin/content/' + kind + '/' + draft.id, {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      await load();
      setDraft(null);
      setMessage(
        'Contenido guardado. Los elementos publicados ya están disponibles en la web.',
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="editorial-admin">
      <div className="form-panel">
        <h2>Trayectoria y resultados</h2>
        <p className="muted">
          Publica información comprobable. La biografía, el retrato y los datos
          del edificio se editan en Configuración.
        </p>
        <Choice
          label="Tipo de contenido"
          value={kind}
          onChange={setKind}
          options={kinds}
          disabled={busy || !!draft}
        />
        <button
          className="btn gold"
          disabled={busy || !!draft}
          onClick={() =>
            setDraft({
              id: kind + '-' + crypto.randomUUID(),
              title: '',
              summary: '',
              description: '',
              active: false,
              sortOrder: items.length,
              cover: '',
              outcome: '',
              publicationReviewed: false,
            })
          }
        >
          Agregar contenido
        </button>
      </div>
      <p role="status">{message}</p>
      {draft ? (
        <form className="form-panel editorial-editor" onSubmit={save}>
          <h2>{draft.title || 'Nuevo contenido'}</h2>
          <fieldset disabled={busy}>
            <label className="field-label">
              Título
              <input
                className="field"
                required
                minLength={3}
                maxLength={160}
                value={draft.title}
                onChange={(e) => change('title', e.target.value)}
              />
            </label>
            <label className="field-label">
              Resumen
              <textarea
                className="field"
                required
                minLength={5}
                maxLength={400}
                value={draft.summary}
                onChange={(e) => change('summary', e.target.value)}
              />
            </label>
            <label className="field-label">
              {kind === 'education' ? 'Institución y año' : 'Categoría o fecha'}
              <input
                className="field"
                maxLength={160}
                value={draft.label || ''}
                onChange={(e) => change('label', e.target.value)}
              />
            </label>
            <label className="field-label">
              Descripción completa
              <textarea
                className="field"
                rows={6}
                maxLength={20000}
                value={draft.description || ''}
                onChange={(e) => change('description', e.target.value)}
              />
            </label>
            <label className="field-label">
              Fotografía (JPG, PNG o WebP, hasta 25 MB)
              <input
                className="field"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    const media = await uploadMedia(file);
                    if (!media.contentType.startsWith('image/'))
                      throw Error('Selecciona una imagen.');
                    change('cover', media.url);
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            {draft.cover && (
              <div>
                <img
                  className="cms-thumbnail"
                  src={draft.cover}
                  alt="Fotografía seleccionada"
                />
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => change('cover', '')}
                >
                  Quitar foto
                </button>
              </div>
            )}
            {kind === 'cases' && (
              <>
                <label className="field-label">
                  Resultado obtenido y alcance
                  <textarea
                    className="field"
                    minLength={10}
                    maxLength={2000}
                    required={draft.active}
                    value={draft.outcome || ''}
                    onChange={(e) => change('outcome', e.target.value)}
                  />
                </label>
                <Check
                  checked={!!draft.publicationReviewed}
                  onChange={(v) => change('publicationReviewed', v)}
                >
                  He verificado el resultado, anonimizado los datos y revisado
                  que el texto y las imágenes puedan publicarse.
                </Check>
              </>
            )}
            <label className="field-label">
              Orden
              <input
                className="field"
                type="number"
                value={draft.sortOrder || 0}
                onChange={(e) => change('sortOrder', Number(e.target.value))}
              />
            </label>
            <Check
              checked={!!draft.active}
              onChange={(v) => change('active', v)}
            >
              Publicar en la web (desmarca para conservar como borrador)
            </Check>
            <div className="hero-actions">
              <button className="btn gold">
                {busy ? 'Guardando…' : 'Guardar contenido'}
              </button>
              <button
                type="button"
                className="btn outline"
                onClick={() => setDraft(null)}
              >
                Volver
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="editorial-list">
          {items.map((item) => (
            <article className="form-panel" key={item.id}>
              <span className="eyebrow">
                {item.active ? 'PUBLICADO' : 'BORRADOR'} · {item.sortOrder}
              </span>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <button className="btn outline" onClick={() => setDraft(item)}>
                Editar / retirar publicación
              </button>
            </article>
          ))}
          {!items.length && (
            <p className="notice">
              Aún no hay contenido en esta categoría. Agrega los datos reales
              del abogado para mostrarlos en la web.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
