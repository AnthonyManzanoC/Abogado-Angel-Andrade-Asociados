import { getPublic } from '@/lib/api';
import { SolidarityForm } from '@/components/solidarity-form';
export const metadata = { title: 'Apoyo solidario mensual' };
export default async function Page() {
  const { settings: s } = await getPublic();
  return (
    <section className="wrap page-section">
      <div className="page-heading solidarity-heading">
        <div className="eyebrow">COMPROMISO CON LA COMUNIDAD</div>
        <h1>{s.solidarityTitle || 'Una oportunidad para volver a empezar.'}</h1>
        <p>
          {s.solidarityDescription ||
            'Un espacio para que una situación de vulnerabilidad encuentre escucha y acompañamiento legal.'}
        </p>
      </div>
      <div className="solidarity-layout">
        <aside className="solidarity-guide">
          <span className="solidarity-number">
            01<span>caso al mes</span>
          </span>
          <h2>
            La ayuda comienza
            <br />
            por escuchar.
          </h2>
          <ol>
            <li>
              <strong>Cuéntanos tu situación</strong>
              <p>
                Un formulario privado, sin cobro ni publicación de tu historia.
              </p>
            </li>
            <li>
              <strong>Revisión personal</strong>
              <p>
                El abogado valora la necesidad, la viabilidad y el alcance del
                apoyo.
              </p>
            </li>
            <li>
              <strong>Una respuesta con claridad</strong>
              <p>
                Consulta tu enlace privado. Si tu caso es seleccionado, el
                despacho coordinará contigo los siguientes pasos.
              </p>
            </li>
          </ol>
          <p className="muted">
            Si tienes una audiencia, un plazo próximo o una emergencia, busca
            atención directa; no esperes la selección mensual.
          </p>
        </aside>
        <SolidarityForm
          terms={
            s.solidarityTerms ||
            'La postulación no garantiza selección ni atención inmediata. El alcance del apoyo se acuerda con el abogado.'
          }
        />
      </div>
    </section>
  );
}
