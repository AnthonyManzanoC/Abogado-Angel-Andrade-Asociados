import { LegalFeed } from '@/components/legal-feed';
export const metadata = { title: 'Vitrina legal' };
export default function Page() {
  return (
    <section className="wrap page-section">
      <div className="page-heading feed-heading">
        <div className="eyebrow">
          <span className="status-dot" /> VITRINA LEGAL
        </div>
        <h1>
          Una perspectiva.
          <br />
          <span className="gold-text">Muchas conversaciones.</span>
        </h1>
        <p>
          Videos, ideas y novedades del despacho. El derecho, contado de una
          forma más cercana.
        </p>
      </div>
      <LegalFeed />
    </section>
  );
}
