'use client';
import { useId, useState } from 'react';
import { api } from '@/lib/api';
export function ClientUpdate({
  id,
  updatedAt,
  onSaved,
}: {
  id: string;
  updatedAt: string;
  onSaved: () => void;
}) {
  const fieldId = useId();
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function send() {
    if (message.trim().length < 10) {
      setError('Escribe una novedad de al menos 10 caracteres.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/admin/requests/' + id + '/message', {
        method: 'POST',
        body: JSON.stringify({ message, updatedAt }),
      });
      setMessage('');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="client-update">
      <h3>Comunicar una novedad</h3>
      <p className="form-note">
        Este mensaje aparecerá en el seguimiento privado y preparará un correo
        para el cliente y otro para el administrador. Puede usarse también
        después de la atención o selección solidaria.
      </p>
      <label className="field-label" htmlFor={fieldId}>
        Mensaje para el cliente
      </label>
      <textarea
        id={fieldId}
        className="field"
        rows={4}
        maxLength={2000}
        value={message}
        disabled={busy}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Indica el avance o el siguiente paso. Las notas internas deben mantenerse en su campo privado."
      />
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn gold"
        disabled={busy || message.trim().length < 10}
        onClick={() => void send()}
      >
        {busy
          ? 'Guardando y preparando avisos…'
          : 'Guardar y notificar a ambas partes'}
      </button>
    </section>
  );
}
