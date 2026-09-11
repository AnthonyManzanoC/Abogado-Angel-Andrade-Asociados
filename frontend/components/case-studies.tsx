import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Content } from '@/lib/api';
export function CaseStudies({ items }: { items: Content[] }) {
  return (
    <div className="case-grid">
      {items.map((item, i) => (
        <article className="case-card" key={item.id}>
          {item.cover && (
            <img src={item.cover} alt={item.title} loading="lazy" />
          )}
          <div>
            <span className="eyebrow">
              {String(i + 1).padStart(2, '0')} /{' '}
              {item.label || 'RESULTADO DEL DESPACHO'}
            </span>
            <h2>{item.title}</h2>
            <p>{item.summary}</p>
            <details>
              <summary>
                Conocer el caso <ArrowUpRight size={17} />
              </summary>
              <div className="case-detail">
                <p className="pre-line">{item.description}</p>
                <h3>Resultado obtenido</h3>
                <p className="pre-line">{item.outcome}</p>
                <Link className="text-link" href="/consulta">
                  Consultar una situación similar <ArrowUpRight size={17} />
                </Link>
              </div>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}
