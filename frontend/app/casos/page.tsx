import Link from 'next/link';
import { getPublic } from '@/lib/api';
import { CaseStudies } from '@/components/case-studies';
export const metadata = { title: 'Casos ganados y resultados' };
export default async function Page() {
  const data = await getPublic();
  const cases = data.cases || [];
  return (
    <section className="wrap page-section">
      <div className="page-heading">
        <div className="eyebrow">EXPERIENCIA EN ACCIÓN</div>
        <h1>
          Detrás de cada caso,
          <br />
          una historia.
        </h1>
        <p>
          Una mirada al trabajo del despacho: el problema, la estrategia y el
          resultado. Casos publicados con revisión de confidencialidad.
        </p>
      </div>
      {cases.length ? (
        <CaseStudies items={cases} />
      ) : (
        <div className="form-panel">
          <h2>Cada situación merece su propio análisis.</h2>
          <p>
            {data.unavailable
              ? 'No se pudo cargar el contenido. Inténtalo en unos momentos.'
              : 'El despacho está preparando sus casos para compartirlos con el cuidado que merece la información de sus clientes.'}
          </p>
          <Link className="btn gold" href="/consulta">
            Conversemos sobre tu caso ↗
          </Link>
        </div>
      )}
      <p className="case-disclaimer">
        Los resultados corresponden a las circunstancias de cada asunto. Un
        resultado anterior no garantiza el de otro caso.
      </p>
    </section>
  );
}
