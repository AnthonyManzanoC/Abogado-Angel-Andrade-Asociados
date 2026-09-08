'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="wrap page-section empty-state">
      <h1>No pudimos cargar esta página.</h1>
      <p>Vuelve a intentarlo en unos momentos.</p>
      <button className="btn gold" onClick={reset}>
        Intentar de nuevo
      </button>
    </section>
  );
}
