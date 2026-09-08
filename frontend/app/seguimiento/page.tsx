import { Tracking } from '@/components/tracking';
export const metadata = {
  title: 'Seguimiento de tu solicitud',
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <section className="wrap page-section">
      <div className="page-heading">
        <div className="eyebrow">SIEMPRE AL TANTO</div>
        <h1>
          Cada paso.
          <br />
          Con claridad.
        </h1>
        <p>
          Consulta el estado de tu solicitud y las novedades que el despacho
          tiene para ti.
        </p>
      </div>
      <Tracking />
    </section>
  );
}
