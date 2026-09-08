import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="wrap page-section empty-state">
      <span className="eyebrow">404 / PÁGINA NO ENCONTRADA</span>
      <h1>Volvamos al camino.</h1>
      <p>Esta página no está disponible o el contenido dejó de publicarse.</p>
      <Link href="/" className="btn gold">
        Ir al inicio
      </Link>
    </section>
  );
}
