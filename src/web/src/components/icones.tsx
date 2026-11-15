import type { ReactNode } from 'react';
import type { Grupo } from '../types';

const DESENHOS = {
  voltar: <path d="M15 18l-6-6 6-6" />,
  direita: <path d="M9 6l6 6-6 6" />,
  baixo: <path d="M6 9l6 6 6-6" />,
  fechar: <path d="M6 6l12 12M18 6L6 18" />,
  mais: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  local: <><path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  cidade: <path d="M4 21V8l6-3v16M10 21v-9l10 3v6M3 21h18M7 11h.01M7 15h.01M14 17h.01M17 17h.01" />,
  camadas: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
  gota: <path d="M12 3s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z" />,
  lapis: <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />,
  broto: <path d="M12 21v-8M12 13c0-3.6-2.6-6-6.5-6 0 3.6 2.6 6 6.5 6zM12 16c0-3 2.2-5 5.8-5 0 3-2.4 5-5.8 5z" />,
  lista: <path d="M9 6h11M9 12h11M9 18h11M3.5 6.5l1.2 1.2L7 5.4M3.5 12.5l1.2 1.2L7 11.4M3.5 18.5l1.2 1.2L7 17.4" />,
  ajuda: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.6a2.5 2.5 0 114.2 1.8c-.9.7-1.8 1.2-1.8 2.6M12 17.5h.01" /></>,
  calendario: <path d="M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 10h16M8 3v4M16 3v4" />,
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  'sem-rede': <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />,
  alerta: <path d="M12 3.5l9.5 17h-19l9.5-17zM12 10v4.5M12 17.5h.01" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  sucesso: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  busca: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  semConexao: <path d="M3 3l18 18M8.6 8.7A8.5 8.5 0 004 12.5M12 20h.01M5.5 15.7a8 8 0 018.6-1.9M16.8 10.9A12 12 0 0120 12.5" />,
  reproduzir: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5L10 15.5z" /></>,
  livro: <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15zM4 20.5A2.5 2.5 0 006.5 18M8 7h8" />,
  troca: <path d="M20 11a8 8 0 00-14.4-4.2M4 4v4h4M4 13a8 8 0 0014.4 4.2M20 20v-4h-4" />,
  desfazer: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  estrela: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />,
  mapa: <path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4zM9 4v13M15 7v13" />,
} satisfies Record<string, ReactNode>;

export type NomeDeIcone = keyof typeof DESENHOS;

export function Icone({ nome, tamanho = 22 }: { nome: NomeDeIcone; tamanho?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} className="icone" aria-hidden="true">
      {DESENHOS[nome]}
    </svg>
  );
}

const DESENHOS_DE_GRUPO: Record<Grupo, ReactNode> = {
  folha: <path d="M5 19C5 10 10.5 5 19 5c0 8.5-5 14-14 14zM5 19l8-8" />,
  fruto: <path d="M12 8.5c-3.8 0-6 2.8-6 5.7a6 6 0 0012 0c0-2.9-2.2-5.7-6-5.7zM12 8.5c0-2 .9-3.4 3-4.2" />,
  raiz: <path d="M6 8h12l-6 12L6 8zM9 8L8 4.5M12 8V4M15 8l1-3.5" />,
  leguminosa: <path d="M4.5 15C4.5 8.5 10 5 19.5 5 18.5 14 13 19 7.5 19a3 3 0 01-3-3v-1zM9.5 14.5h.01M12.5 11.5h.01M15.5 8.5h.01" />,
};

/** Selo colorido por grupo de planta (substitui os emojis das culturas) */
export function SeloDaCultura({ grupo, tamanho = 44 }: { grupo: Grupo; tamanho?: number }) {
  return (
    <span className={`selo selo-${grupo}`} style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={tamanho * 0.55} height={tamanho * 0.55} className="icone">
        {DESENHOS_DE_GRUPO[grupo]}
      </svg>
    </span>
  );
}
