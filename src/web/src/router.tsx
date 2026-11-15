import { Link, Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { ESTADOS } from './data/locations';
import PaginaInicial from './routes/PaginaInicial';

function numeroInteiro(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isInteger(valor) ? valor : undefined;
}

function PaginaNaoEncontrada() {
  return (
    <main className="not-found">
      <h1>Página não encontrada</h1>
      <p>Esse endereço não existe no SAERPA.</p>
      <Link to="/" className="btn">Voltar ao início</Link>
    </main>
  );
}

const rotaRaiz = createRootRoute({ component: Outlet, notFoundComponent: PaginaNaoEncontrada });

const rotaInicial = createRoute({
  getParentRoute: () => rotaRaiz,
  path: '/',
  component: PaginaInicial,
  validateSearch: (busca: Record<string, unknown>): { estado?: string; municipio?: number; area?: number } => ({
    estado: typeof busca.estado === 'string' && ESTADOS.some((candidato) => candidato.uf === busca.estado) ? busca.estado : undefined,
    municipio: numeroInteiro(busca.municipio),
    area: numeroInteiro(busca.area),
  }),
});

export const roteador = createRouter({ routeTree: rotaRaiz.addChildren([rotaInicial]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof roteador;
  }
}
