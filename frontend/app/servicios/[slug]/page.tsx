import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublic } from '@/lib/api';
import { ServiceIcon } from '@/components/service-icon';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await getPublic();
  return { title: d.services.find((s) => s.id === slug)?.title || 'Servicio' };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await getPublic();
  const s = d.services.find((s) => s.id === slug);
  if (!s) notFound();
  return (
    <section className="wrap page-section">
      <Link href="/servicios" className="text-link">
        <ArrowLeft size={16} /> Volver a servicios
      </Link>
      <div className="detail-layout">
        <div>
          <div className="large-service-icon">
            <ServiceIcon name={s.icon} />
          </div>
          <div className="eyebrow">{s.category}</div>
          <h1 className="detail-title">{s.title}</h1>
          <p className="detail-intro">{s.summary}</p>
          <div className="prose pre-line">{s.description}</div>
          <Link className="btn gold" href={'/consulta?servicio=' + s.id}>
            Consultar sobre este servicio <ArrowUpRight size={18} />
          </Link>
        </div>
        <aside className="info-panel">
          <span className="eyebrow">EL PRIMER PASO</span>
          <h2>Preparemos la conversación.</h2>
          {[
            'Un resumen de tu situación.',
            'Las fechas y hechos relevantes.',
            'Las preguntas que quieres resolver.',
          ].map((t) => (
            <p key={t}>
              <Check size={17} />
              {t}
            </p>
          ))}
          <span className="muted">
            Los honorarios y el alcance se acuerdan personalmente con el
            abogado.
          </span>
        </aside>
      </div>
    </section>
  );
}
