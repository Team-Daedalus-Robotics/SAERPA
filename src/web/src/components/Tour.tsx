/* =========================================================================
 * Passo a passo guiado (tour)
 * -------------------------------------------------------------------------
 * Mostra balões que apontam para cada parte da tela, um de cada vez.
 * Cada parte da tela que entra no tour tem um atributo  data-tour="nome".
 * Se a parte ainda não existe na tela (ex.: sugestões antes de escolher a
 * cidade), o balão aparece no meio da tela com um aviso.
 * ========================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TourStep {
  /** valor do atributo data-tour do elemento destacado (vazio = balão no centro) */
  alvo?: string;
  icone: string;
  titulo: string;
  texto: string;
  /** frase mostrada quando o alvo ainda não está na tela */
  seAusente?: string;
}

export const PASSOS_TOUR: TourStep[] = [
  {
    icone: '👋', titulo: 'Bem-vindo ao Field Shift!',
    texto: 'Este app ajuda você a escolher o que plantar depois, no mesmo lugar, para a terra continuar forte e produzindo. São só 3 passos. Vamos ver cada parte?',
  },
  {
    alvo: 'local', icone: '📍', titulo: 'Passo 1 · Onde fica sua plantação',
    texto: 'Escolha o seu estado e depois digite o nome da cidade. É com isso que sabemos a época certa de plantar na sua região.',
  },
  {
    alvo: 'mapa', icone: '🗺️', titulo: 'O mapa',
    texto: 'Depois que você escolhe a cidade, o mapa vai até ela. Para aproximar, use os botões + e −, ou abra e feche dois dedos na tela. Para mover, arraste com o dedo.',
  },
  {
    alvo: 'umidade', icone: '💧', titulo: 'Umidade da terra',
    texto: 'As cores mostram se a terra está seca (marrom) ou molhada (azul), medidas por um satélite da NASA. Toque no botão para mostrar ou esconder as cores.',
  },
  {
    alvo: 'marcar', icone: '✏️', titulo: 'Marcar sua área (opcional)',
    texto: 'Aproxime o mapa até ver seu terreno, toque aqui e depois toque nos cantos dele. Assim o app guarda o que foi plantado em cada canteiro ou roça. Se errar um toque, use "Desfazer".',
    seAusente: 'Este botão aparece depois que você escolhe a cidade, logo abaixo do mapa.',
  },
  {
    alvo: 'plantou', icone: '🥬', titulo: 'Passo 2 · O que você plantou por último',
    texto: 'Toque na figura da planta que você colheu por último. Se não lembrar ou se for a primeira vez, toque em "Nada / não sei". Se quiser, adicione também o que plantou antes disso.',
  },
  {
    alvo: 'quando', icone: '📅', titulo: 'Passo 3 · Quando vai plantar',
    texto: 'Já vem marcado o mês de hoje. Se for plantar mais para frente, troque o mês. Toque em "Quero colher rápido" para ver primeiro as plantas que ficam prontas mais cedo.',
    seAusente: 'Esta parte aparece depois que você escolhe a cidade.',
  },
  {
    alvo: 'sugestoes', icone: '✅', titulo: 'As sugestões',
    texto: 'A primeira da lista é a melhor escolha. Toque em uma planta para ver por que ela é boa e como plantar: espaço entre as plantas, jeito de plantar e quantos dias até a colheita.',
    seAusente: 'A lista aparece depois que você escolhe a cidade.',
  },
  {
    alvo: 'evitar', icone: '⚠️', titulo: 'O que evitar',
    texto: 'Estas plantas são da mesma família do que você plantou. Plantar uma atrás da outra no mesmo lugar junta pragas e doenças na terra.',
    seAusente: 'Esta lista aparece depois que você conta, no passo 2, o que plantou por último.',
  },
  {
    alvo: 'ajuda', icone: '❓', titulo: 'Pronto!',
    texto: 'Sempre que tiver dúvida, toque em "Ajuda" para ver este passo a passo de novo ou ler a explicação de cada parte.',
  },
];

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 8;
const LARGURA = 380;

export default function Tour({ passos, onFim }: { passos: TourStep[]; onFim: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [balaoAltura, setBalaoAltura] = useState(220);
  const balaoRef = useRef<HTMLDivElement>(null);
  const passo = passos[i];

  const alvoEl = useCallback(
    () => (passo.alvo ? document.querySelector<HTMLElement>(`[data-tour="${passo.alvo}"]`) : null),
    [passo.alvo],
  );

  // rola até a parte destacada e mede onde ela está
  useEffect(() => {
    const el = alvoEl();
    if (!el) { setRect(null); return; }
    // partes grandes vão para o topo da tela, para sobrar espaço para o balão
    const grande = el.getBoundingClientRect().height > window.innerHeight * 0.45;
    el.scrollIntoView({ behavior: 'smooth', block: grande ? 'start' : 'center' });
    const medir = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    medir();
    const t1 = window.setTimeout(medir, 350);
    const t2 = window.setTimeout(medir, 800);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.clearTimeout(t1); window.clearTimeout(t2);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [alvoEl]);

  useLayoutEffect(() => {
    if (balaoRef.current) setBalaoAltura(balaoRef.current.offsetHeight);
  }, [i, rect]);

  // teclado: setas e Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFim();
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, passos.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFim, passos.length]);

  // posição do balão: embaixo da parte destacada, em cima, ou no centro
  const vw = window.innerWidth, vh = window.innerHeight;
  const largura = Math.min(vw - 24, LARGURA);
  let estilo: React.CSSProperties;
  let seta: 'cima' | 'baixo' | null = null;
  if (!rect) {
    estilo = { width: largura, left: (vw - largura) / 2, top: Math.max(12, (vh - balaoAltura) / 2) };
  } else {
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - largura / 2), vw - largura - 12);
    const abaixo = rect.top + rect.height + 14;
    const acima = rect.top - balaoAltura - 14;
    if (abaixo + balaoAltura < vh - 8) { estilo = { width: largura, left, top: abaixo }; seta = 'cima'; }
    else if (acima > 8) { estilo = { width: largura, left, top: acima }; seta = 'baixo'; }
    else estilo = { width: largura, left, bottom: 12 }; // parte grande: balão fixo embaixo
  }
  // parte grande com balão embaixo: o destaque termina acima do balão
  const spot = rect && 'bottom' in estilo
    ? { ...rect, height: Math.max(60, Math.min(rect.height, vh - balaoAltura - 30 - rect.top)) }
    : rect;
  const setaLeft = rect ? Math.min(Math.max(20, rect.left + rect.width / 2 - (estilo.left as number)), largura - 20) : 0;

  const ultimo = i === passos.length - 1;
  const ausente = passo.alvo && !rect;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-titulo">
      {spot
        ? <div className="tour-spot" style={spot} />
        : <div className="tour-dim" />}
      <div className="tour-block" />

      <div className="tour-balao" ref={balaoRef} style={estilo}>
        {seta && <span className={`tour-seta ${seta}`} style={{ left: setaLeft }} />}
        <div className="tour-top">
          <span className="tour-icone">{passo.icone}</span>
          <span className="tour-cont">{i + 1} de {passos.length}</span>
          <button className="tour-x" onClick={onFim} aria-label="Fechar o passo a passo">✕</button>
        </div>
        <h3 id="tour-titulo">{passo.titulo}</h3>
        <p>{passo.texto}</p>
        {ausente && passo.seAusente && <p className="tour-aviso">ℹ️ {passo.seAusente}</p>}

        <div className="tour-dots" aria-hidden="true">
          {passos.map((_, n) => <span key={n} className={n === i ? 'on' : ''} />)}
        </div>
        <div className="tour-acoes">
          {i > 0
            ? <button className="tour-btn sec" onClick={() => setI(i - 1)}>← Voltar</button>
            : <button className="tour-btn sec" onClick={onFim}>Pular</button>}
          <button className="tour-btn" onClick={() => (ultimo ? onFim() : setI(i + 1))} autoFocus>
            {ultimo ? 'Entendi!' : 'Próximo →'}
          </button>
        </div>
      </div>
    </div>
  );
}
