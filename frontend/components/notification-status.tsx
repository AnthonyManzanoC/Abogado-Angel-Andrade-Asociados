'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Mail } from 'lucide-react';
export const emailStatusLabels: Record<string, string> = {
  delivered: 'Entregado al servidor del destinatario',
  bounced: 'Rechazado por el correo de destino',
  blocked: 'Entrega bloqueada',
  complaint: 'El destinatario marcó el correo como spam',
  deferred: 'Entrega demorada',
  pending: 'Pendiente de envío',
  processing: 'Enviando',
  accepted: 'Aceptado por Brevo',
  failed: 'No se pudo enviar',
  uncertain: 'Envío por comprobar',
};
export function notificationState(n?: {
  deliveryStatus?: string;
  status?: string;
}) {
  return n?.deliveryStatus && n.deliveryStatus !== 'unknown'
    ? n.deliveryStatus
    : n?.status || 'pending';
}
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
        if (active) setStatus(notificationState(r.notifications?.at(-1)));
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
          {status === 'delivered'
            ? `El servidor de correo de ${email} confirmó la recepción. Si no lo ves, revisa spam. Conserva el enlace privado de seguimiento.`
            : ['bounced', 'blocked', 'complaint'].includes(status)
              ? 'No se pudo entregar este aviso. Puedes continuar con tu enlace privado; el despacho verá la incidencia para revisar el contacto.'
              : status === 'accepted'
                ? `Brevo aceptó el correo dirigido a ${email}. Incluye el enlace para regresar a tu solicitud. Revisa también spam; la aceptación no confirma la entrega.`
                : `El aviso con tu enlace privado está destinado a ${email}. Puedes acceder ahora con el botón de seguimiento, aunque el correo tarde.`}
        </p>
      </div>
    </div>
  );
}
