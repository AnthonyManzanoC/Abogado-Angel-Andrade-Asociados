import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Play,
  CalendarDays,
  MessageSquareText,
  ChevronRight,
} from 'lucide-react';
import { getPublic } from '@/lib/api';
import { ServiceIcon } from '@/components/service-icon';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const data = await getPublic();
  const s = data.settings;
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> BABAHOYO, ECUADOR{' '}
            <span className="eyebrow-line" />
          </div>
          <h1>
            {s.heroTitle || 'El siguiente paso.\nCon el respaldo\ncorrecto.'}
          </h1>
          <p className="hero-description">
            {s.heroDescription ||
              'Claridad para decidir. Estrategia para avanzar. Acompañamiento legal cercano en los momentos que importan.'}
          </p>
          <div className="hero-actions">
            <Link href="/consulta" className="btn gold">
              Agenda una consulta <ArrowUpRight size={19} />
            </Link>
            <Link href="/servicios" className="text-link">
              Explora los servicios <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-assurance">
            <ShieldCheck size={18} />
            <span>Atención personal. Tu información, confidencial.</span>
          </div>
        </div>
        <div className="hero-portrait">
          <img
            src={s.heroImage || '/images/angel-andrade.jpg'}
            alt="Ab. Ángel Andrade Núñez"
            fetchPriority="high"
          />
          <div className="portrait-gradient" />
          <span className="portrait-index">
            ESTRATEGIA · CONFIANZA · COMPROMISO
          </span>
          <div className="portrait-caption">
            <span className="small-caps">TU ABOGADO, A TU LADO</span>
            <h2>
              Ángel Andrade Núñez<span>Abogado</span>
            </h2>
            <Link
              href="/firma"
              className="round-link"
              aria-label="Conoce al abogado"
            >
              <ArrowUpRight />
            </Link>
          </div>
        </div>
      </section>
      <section className="quick-access wrap" aria-label="Accesos rápidos">
        <Link href="/consulta">
          <span className="quick-icon">
            <CalendarDays />
          </span>
          <div>
            <h3>Tu consulta, a un paso</h3>
            <p>Elige cómo y cuándo conversar.</p>
          </div>
          <ArrowUpRight />
        </Link>
        <Link href="/seguimiento">
          <span className="quick-icon">
            <MessageSquareText />
          </span>
          <div>
            <h3>Consulta tu solicitud</h3>
            <p>Conoce el estado y las novedades.</p>
          </div>
          <ArrowUpRight />
        </Link>
        <Link href="/contacto">
          <span className="quick-icon">
            <MapPin />
          </span>
          <div>
            <h3>Nos encontramos aquí</h3>
            <p>Edificio Alavama · Babahoyo</p>
          </div>
          <ArrowUpRight />
        </Link>
      </section>
      <section className="section wrap">
        <div className="section-heading">
          <div>
            <div className="eyebrow">01 / ÁREAS DE PRÁCTICA</div>
            <h2>Soluciones para lo que importa.</h2>
          </div>
          <Link href="/servicios" className="text-link">
            Todos los servicios <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="service-grid">
          {data.services.slice(0, 4).map((service, i) => (
            <Link
              href={'/servicios/' + service.id}
              key={service.id}
              className="service-card"
            >
              <div className="service-card-top">
                <ServiceIcon name={service.icon} />
                <span>0{i + 1}</span>
              </div>
              <h3>{service.title}</h3>
              <p>{service.summary}</p>
              <span className="service-bottom">
                Conoce cómo podemos ayudarte <ArrowUpRight size={18} />
              </span>
            </Link>
          ))}
        </div>
        {data.unavailable && (
          <p className="notice">
            El contenido se está conectando. Vuelve a intentar en unos momentos.
          </p>
        )}
      </section>
      <section className="vitrina-preview wrap">
        <div>
          <div className="eyebrow">02 / VITRINA LEGAL</div>
          <h2>
            El derecho, más cerca.
            <br />
            <span>Una perspectiva clara.</span>
          </h2>
          <p>
            Ideas, novedades y conversaciones del abogado en un solo espacio.
            Explora contenido a tu ritmo.
          </p>
          <Link className="btn outline" href="/vitrina">
            Entrar a la vitrina <ArrowUpRight size={18} />
          </Link>
        </div>
        <Link href="/vitrina" className="editorial-cover">
          <img
            src="/images/angel-andrade.jpg"
            alt="Explorar la vitrina legal de Ángel Andrade"
          />
          <span className="editorial-play">
            <Play fill="currentColor" size={24} />
          </span>
          <div>
            <span className="small-caps">LA CONVERSACIÓN CONTINÚA</span>
            <h3>Más allá de la consulta.</h3>
            <span>
              Vitrina legal <ChevronRight size={16} />
            </span>
          </div>
        </Link>
      </section>
      {data.promotions.length > 0 && (
        <section className="wrap promotion-section">
          {data.promotions.map((p) => (
            <div className="promotion" key={p.id}>
              <div>
                <span className="eyebrow">{p.label || 'EN EL DESPACHO'}</span>
                <h2>{p.title}</h2>
                <p>{p.summary}</p>
              </div>
              <Link href="/consulta" className="btn gold">
                {p.cta || 'Solicitar información'} <ArrowUpRight size={18} />
              </Link>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
