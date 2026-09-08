import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { getPublic } from '@/lib/api';
export const metadata = { title: 'El abogado' };
export default async function Page() {
  const { settings: s } = await getPublic();
  return (
    <section className="wrap page-section">
      <div className="profile-layout">
        <div className="profile-photo">
          <img
            src={s.heroImage || '/images/angel-andrade.jpg'}
            alt="Retrato del Ab. Ángel Andrade Núñez"
          />
        </div>
        <div>
          <div className="eyebrow">EL ABOGADO</div>
          <h1>
            Ángel Andrade
            <br />
            Núñez.
          </h1>
          <p className="profile-subtitle">
            Una relación personal.
            <br />
            Un compromiso profesional.
          </p>
          <div className="prose pre-line">{s.biography}</div>
          <p className="location-line">
            <MapPin size={17} />
            {s.city || 'Babahoyo, Ecuador'}
          </p>
          <Link className="btn gold" href="/consulta">
            Conversemos <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
      <div className="values-row">
        {[
          [
            '01',
            'Escuchar primero',
            'Entender tu situación es el punto de partida de cada consulta.',
          ],
          [
            '02',
            'Hablar con claridad',
            'Conocer el alcance y los pasos del servicio para decidir con información.',
          ],
          [
            '03',
            'Acompañar de cerca',
            'Una comunicación directa durante el trabajo encomendado.',
          ],
        ].map(([n, title, text]) => (
          <div key={n}>
            <span className="eyebrow">{n}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
