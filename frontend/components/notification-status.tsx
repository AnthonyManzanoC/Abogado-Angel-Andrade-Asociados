'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Mail } from 'lucide-react';
export const emailStatusLabels: Record<string, string> = {
  pending: 'Pendiente de envío',
  processing: 'Enviando',
  accepted: 'Aceptado por Brevo',
  failed: 'No se pudo enviar',
  uncertain: 'Envío por comprobar',
};
export function ReceiptEmail({
  reference,
  token,
  email,
}: {
  reference: string;
  token: string;
  email: string;
}) {
  const [status, setStatus] = useState('pending');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const r = await api('/track', {
          method: 'POST',
          body: JSON.stringify({ reference, token }),
        });
        if (active) setStatus(r.notifications?.at(-1)?.status || 'pending');
      } catch {
        /* The saved receipt remains usable when the status check fails. */
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [reference, token]);
  return (
    <div className="notice receipt-email" role="status">
      <Mail size={18} />
      <div>
        <strong>{emailStatusLabels[status]}</strong>
        <p>
          {status === 'accepted'
            ? `Brevo aceptó el correo dirigido a ${email}. Incluye el enlace para regresar a tu solicitud. Revisa también spam; la aceptación no confirma la entrega.`
            : `El aviso con tu enlace privado está destinado a ${email}. Puedes acceder ahora con el botón de seguimiento, aunque el correo tarde.`}
        </p>
      </div>
    </div>
  );
}
