import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getPublic } from '@/lib/api';
import { ServiceIcon } from '@/components/service-icon';
export const metadata = { title: 'Servicios legales' };
export default async function Page() {
  const d = await getPublic();
  return (
    <section className="wrap page-section">
      <div className="page-heading">
        <div className="eyebrow">ÁREAS DE PRÁCTICA</div>
        <h1>
          Respaldo legal.
          <br />
          En cada decisión.
        </h1>
        <p>
          Encuentra el área relacionada con tu situación. El alcance de cada
          servicio se define después de revisar tu caso.
        </p>
      </div>
      <div className="services-full">
        {d.services.map((s, i) => (
          <Link className="service-card" key={s.id} href={'/servicios/' + s.id}>
            <div className="service-card-top">
              <ServiceIcon name={s.icon} />
              <span>0{i + 1}</span>
            </div>
            <span className="small-caps">{s.category}</span>
            <h2>{s.title}</h2>
            <p>{s.summary}</p>
            <span className="service-bottom">
              Explorar servicio <ArrowUpRight size={20} />
            </span>
          </Link>
        ))}
      </div>
      {d.unavailable && (
        <p className="notice">
          No se pudo cargar el catálogo. Vuelve a intentarlo.
        </p>
      )}
      <div className="subtle-cta">
        <h2>¿No sabes por dónde empezar?</h2>
        <p>
          Cuéntanos brevemente tu situación y el despacho revisará cómo
          ayudarte.
        </p>
        <Link className="btn gold" href="/consulta">
          Solicitar orientación inicial <ArrowUpRight size={18} />
        </Link>
      </div>
    </section>
  );
}
