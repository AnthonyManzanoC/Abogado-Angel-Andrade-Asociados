import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getPublic } from '@/lib/api';
import { ServiceCard } from '@/components/service-card';
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
          <ServiceCard key={s.id} service={s} index={i} />
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
