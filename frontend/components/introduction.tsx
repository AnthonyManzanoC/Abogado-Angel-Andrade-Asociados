import Link from 'next/link';
import { ArrowUpRight, Play } from 'lucide-react';
import { embedUrl } from '@/lib/embeds';
import { Settings } from '@/lib/api';

export function Introduction({ settings: s }: { settings: Settings }) {
  const video = s.introVideoUrl || '';
  const embed = video ? embedUrl('youtube', video) : null;
  return (
    <section className="introduction wrap" id="presentacion">
      <div className="intro-copy">
        <div className="eyebrow">EL ABOGADO / LA PERSONA</div>
        <h2>
          {s.introTitle || 'Conoce a tu abogado. En sus propias palabras.'}
        </h2>
        <p>
          {s.biography?.split('\n').filter(Boolean)[0] ||
            'Una conversación cercana es el primer paso para entender tu situación y decidir cómo avanzar.'}
        </p>
        <Link href="/firma" className="text-link">
          Conoce su trayectoria <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="intro-media">
        {video.startsWith('/api/media/') ? (
          <video
            controls
            playsInline
            preload="metadata"
            poster={s.introPoster || s.heroImage}
            src={video}
            aria-label={'Presentación de ' + s.name}
          />
        ) : embed ? (
          <iframe
            src={embed}
            title={'Presentación de ' + s.name}
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <>
            <img
              src={s.heroImage || '/images/angel-andrade.jpg'}
              alt={s.name || 'Ángel Andrade Núñez'}
              loading="lazy"
            />
            <div className="intro-caption">
              <span className="small-caps">UNA ATENCIÓN PERSONAL</span>
              <h3>{s.name || 'Ángel Andrade Núñez'}</h3>
              <Link href="/firma" className="text-link">
                Conóceme <ArrowUpRight size={18} />
              </Link>
            </div>
          </>
        )}
        {video && (
          <span className="intro-video-label">
            <Play size={14} /> Mi historia, mi compromiso.
          </span>
        )}
      </div>
    </section>
  );
}
