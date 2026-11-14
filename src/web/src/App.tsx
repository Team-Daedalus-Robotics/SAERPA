import { useEffect, useState } from 'react';

type Health = {
  status: string;
  service: string;
  database: string;
};

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API indisponível');
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(true);
      });

    return () => controller.abort();
  }, []);

  return (
    <main>
      <span className="eyebrow">Arquitetura mínima Aspire</span>
      <h1>SAERPA</h1>
      <p className="subtitle">React, Python e PostgreSQL orquestrados em um único ambiente.</p>

      <section className="status" aria-live="polite">
        <span className={`indicator ${health ? 'online' : ''}`} />
        {health
          ? `API online · ${health.database}`
          : error
            ? 'API indisponível'
            : 'Verificando API...'}
      </section>

      <section className="services" aria-label="Serviços">
        <article><strong>Web</strong><span>React + Vite</span></article>
        <article><strong>API</strong><span>FastAPI</span></article>
        <article><strong>Worker</strong><span>Python</span></article>
        <article><strong>Dados</strong><span>PostgreSQL persistente</span></article>
      </section>
    </main>
  );
}
