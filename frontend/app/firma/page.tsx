import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { ProfileGallery } from '@/components/profile-gallery';
import { getPublic } from '@/lib/api';
export const metadata = { title: 'El abogado' };
export default async function Page() {
  const {
    settings: s,
    education = [],
    achievements = [],
    gallery = [],
  } = await getPublic();
  return (
    <section className="wrap page-section">
      <div className="profile-layout" id="biografia">
        <div className="profile-photo">
          <img
            src={s.profileImage || s.heroImage || '/images/angel-andrade.jpg'}
            alt="Retrato del Ab. Ángel Andrade Núñez"
          />
        </div>
        <div>
          <div className="eyebrow">EL ABOGADO</div>
          <h1>{s.profileName || 'Ángel Andrade Núñez'}</h1>
          <p className="profile-subtitle">
            {s.profileSubtitle ||
              'Una relación personal. Un compromiso profesional.'}
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
      <nav className="profile-jump" aria-label="Explorar trayectoria">
        <a href="#biografia">Biografía ↗</a>
        {education.length > 0 && <a href="#formacion">Formación ↗</a>}
        {achievements.length > 0 && <a href="#logros">Logros ↗</a>}
        {gallery.some((p) => p.cover) && <a href="#galeria">En imágenes ↗</a>}
        <Link href="/casos">Casos ganados ↗</Link>
        <Link href="/apoyo">Compromiso social ↗</Link>
      </nav>
      {education.length > 0 && (
        <section className="profile-section" id="formacion">
          <div>
            <span className="eyebrow">01 / FORMACIÓN</span>
            <h2>
              El conocimiento
              <br />
              detrás del criterio.
            </h2>
          </div>
          <div className="education-timeline">
            {education.map((p) => (
              <article key={p.id}>
                <span className="eyebrow">{p.label}</span>
                <h3>{p.title}</h3>
                <p>{p.summary}</p>
                {p.description && (
                  <p className="pre-line muted">{p.description}</p>
                )}
                {p.cover && (
                  <img
                    className="education-image"
                    src={p.cover}
                    alt={p.title}
                    loading="lazy"
                  />
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {achievements.length > 0 && (
        <section className="section" id="logros">
          <span className="eyebrow">02 / LOGROS Y RECONOCIMIENTOS</span>
          <h2 className="editorial-title">Un camino de compromiso.</h2>
          <div className="achievement-grid">
            {achievements.map((p) => (
              <article className="form-panel" key={p.id}>
                {p.cover && (
                  <img
                    className="education-image"
                    src={p.cover}
                    alt={p.title}
                    loading="lazy"
                  />
                )}
                <span className="eyebrow">{p.label}</span>
                <h3>{p.title}</h3>
                <p>{p.summary}</p>
                <p className="pre-line muted">{p.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      {gallery.some((p) => p.cover) && (
        <section className="section" id="galeria">
          <span className="eyebrow">03 / MOMENTOS DE UNA TRAYECTORIA</span>
          <h2 className="editorial-title">La persona detrás del abogado.</h2>
          <ProfileGallery items={gallery} />
        </section>
      )}
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
