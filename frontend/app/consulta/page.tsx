import { getPublic } from '@/lib/api';
import { RequestForm } from '@/components/request-form';
import { MapPin, ShieldCheck, MessageSquareText } from 'lucide-react';
export const metadata = { title: 'Agenda tu consulta' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string }>;
}) {
  const data = await getPublic();
  const { servicio } = await searchParams;
  return (
    <section className="wrap page-section">
      <div className="page-heading">
        <div className="eyebrow">HABLEMOS DE TU CASO</div>
        <h1>
          Una conversación puede
          <br />
          hacer la diferencia.
        </h1>
        <p>
          El primer paso es entender tu situación. Agenda un espacio o cuéntanos
          qué necesitas.
        </p>
      </div>
      <div className="consult-layout">
        <RequestForm services={data.services} initialService={servicio} />
        <aside className="consult-aside">
          <div className="aside-portrait">
            <img src="/images/angel-andrade.jpg" alt="Ángel Andrade Núñez" />
            <div>
              <span className="small-caps">ATENCIÓN PERSONAL</span>
              <h3>Ángel Andrade Núñez</h3>
              <p>Abogado en Babahoyo</p>
            </div>
          </div>
          <div className="aside-item">
            <MapPin />
            <div>
              <h3>En el corazón de Babahoyo</h3>
              <p>
                {data.settings.address ||
                  'Edificio Alavama, Sucre y 5 de Junio'}
              </p>
            </div>
          </div>
          <div className="aside-item">
            <ShieldCheck />
            <div>
              <h3>Un espacio confidencial</h3>
              <p>Tu información se utiliza para atender la solicitud.</p>
            </div>
          </div>
          <div className="aside-item">
            <MessageSquareText />
            <div>
              <h3>Siempre al tanto</h3>
              <p>
                Recibirás un código privado para consultar las novedades aquí.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
