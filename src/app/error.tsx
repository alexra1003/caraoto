"use client";

export default function ErrorPage() {
  return (
    <section className="card mt-8 space-y-4" role="alert">
      <p>No pudimos cargar tu espacio. Inténtalo de nuevo en un momento.</p>
      <button className="btn" onClick={() => window.location.reload()}>Reintentar</button>
    </section>
  );
}

