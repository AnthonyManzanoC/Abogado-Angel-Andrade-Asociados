'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MapPin, Video, Plus } from 'lucide-react';
import { Settings } from '@/lib/api';
import { homeDefaults } from '@/lib/home-content';
export function HomeExperience({
  settings: s,
  part,
}: {
  settings: Settings;
  part: 'process' | 'approach' | 'questions';
}) {
  const [step, setStep] = useState(1);
  const text = (key: string) => s[key] || homeDefaults[key];
  if (part === 'process')
    return (
      <section className="home-process section wrap">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TU ATENCIÓN / PASO A PASO</span>
            <h2>{text('homeProcessTitle')}</h2>
          </div>
          <p>{text('homeProcessDescription')}</p>
        </div>
        <div className="process-layout">
          <div className="process-steps" aria-label="Pasos de la atención">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={step === n}
                aria-controls="home-step-panel"
                onClick={() => setStep(n)}
              >
                <span>0{n}</span>
                {text(`homeStep${n}Title`)}
                <ArrowUpRight size={20} />
              </button>
            ))}
          </div>
          <div
            className="process-detail"
            id="home-step-panel"
            aria-live="polite"
          >
            <span className="process-number" aria-hidden="true">
              0{step}
            </span>
            <h3>{text(`homeStep${step}Title`)}</h3>
            <p>{text(`homeStep${step}Text`)}</p>
            <Link
              href={step === 3 ? '/seguimiento' : '/consulta'}
              className="text-link"
            >
              {step === 3 ? 'Abrir seguimiento' : 'Empezar mi consulta'}{' '}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    );
  if (part === 'approach')
    return (
      <>
        <section className="home-approach wrap">
          <div className="approach-portrait">
            <img
              src={s.profileImage || s.heroImage || '/images/angel-andrade.jpg'}
              alt={s.profileName || s.name}
              loading="lazy"
            />
            <span className="small-caps">{s.profileName || s.name}</span>
          </div>
          <div>
            <span className="eyebrow">EL COMPROMISO DEL DESPACHO</span>
            <h2>{text('homeApproachTitle')}</h2>
            <p>{text('homeApproachText')}</p>
            <Link href="/firma" className="btn outline">
              Conoce mi trayectoria <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className="home-modalities section wrap">
          <div className="section-heading">
            <div>
              <span className="eyebrow">DOS FORMAS DE ENCONTRARNOS</span>
              <h2>{text('homeModalitiesTitle')}</h2>
            </div>
          </div>
          <div className="modality-grid">
            <article>
              <MapPin />
              <span className="small-caps">EN EL DESPACHO</span>
              <h3>Atención presencial</h3>
              <p>{text('homeOfficeText')}</p>
              <p className="modality-meta">
                {s.address}
                <br />
                {s.city}
                <br />
                {s.hours}
              </p>
              <Link href="/contacto" className="text-link">
                Ver ubicación y contacto <ArrowUpRight size={18} />
              </Link>
            </article>
            <article>
              <Video />
              <span className="small-caps">DESDE DONDE ESTÉS</span>
              <h3>Consulta virtual</h3>
              <p>{text('homeVirtualText')}</p>
              <p className="modality-meta">
                Fecha, pago y acceso en tu seguimiento privado.
              </p>
              <Link href="/consulta" className="text-link">
                Solicitar una cita <ArrowUpRight size={18} />
              </Link>
            </article>
          </div>
        </section>
      </>
    );
  return (
    <section className="home-faq section wrap">
      <div>
        <span className="eyebrow">PREGUNTAS FRECUENTES</span>
        <h2>{text('homeFaqTitle')}</h2>
        <Link href="/contacto" className="text-link">
          Habla con el despacho <ArrowUpRight size={18} />
        </Link>
      </div>
      <div>
        {[1, 2, 3].map((n) => (
          <details key={n}>
            <summary>
              {text(`homeFaq${n}Question`)}
              <Plus size={20} />
            </summary>
            <p>{text(`homeFaq${n}Answer`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
