/* =========================================================================
 * Passo a passo guiado (tour)
 * -------------------------------------------------------------------------
 * Mostra balões que apontam para cada parte da tela, um de cada vez.
 * Cada parte da tela que entra no tour tem um atributo  data-tour="nome".
 * Se a parte ainda não existe na tela (ex.: sugestões antes de escolher a
 * cidade), o balão aparece no meio da tela com um aviso.
 * ========================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icone, type NomeDeIcone } from './icones';

export interface TourStep {
  /** valor do atributo data-tour do elemento destacado (vazio = balão no centro) */
  alvo?: string;
  icone: NomeDeIcone;
  titulo: string;
  texto: string;
  /** frase mostrada quando o alvo ainda não está na tela */
  seAusente?: string;
}

export const PASSOS_TOUR: TourStep[] = [
  {
    icone: 'broto', titulo: 'Bem-vindo ao Field Shift!',
    texto: 'Este app ajuda você a escolher o que plantar depois, no mesmo lugar, para a terra continuar forte e produzindo. São só 3 passos. Vamos ver cada parte?',
  },
  {
    alvo: 'local', icone: 'local', titulo: 'Passo 1 · Onde fica sua plantação',
    texto: 'Escolha o seu estado e depois digite o nome da cidade. É com isso que sabemos a época certa de plantar na sua região.',
  },
  {
    alvo: 'mapa', icone: 'mapa', titulo: 'O mapa',
    texto: 'Depois que você escolhe a cidade, o mapa vai até ela. Para aproximar, use os botões + e −, ou abra e feche dois dedos na tela. Para mover, arraste com o dedo.',
  },
  {
    alvo: 'umidade', icone: 'gota', titulo: 'Umidade da terra',
    texto: 'As cores mostram se a terra está seca (marrom) ou molhada (azul), medidas por um satélite da NASA. Toque no botão para mostrar ou esconder as cores.',
  },
  {
    alvo: 'marcar', icone: 'lapis', titulo: 'Marcar sua área (opcional)',
    texto: 'Aproxime o mapa até ver seu terreno, toque aqui e depois toque nos cantos dele. Assim o app guarda o que foi plantado em cada canteiro ou roça. Se errar um toque, use "Desfazer".',
    seAusente: 'Este botão aparece depois que você escolhe a cidade, logo abaixo do mapa.',
  },
  {
    alvo: 'plantou', icone: 'broto', titulo: 'Passo 2 · O que você plantou por último',
    texto: 'Toque na planta que você colheu por último. Se não lembrar ou se for a primeira vez, toque em "Nada / não sei". Se quiser, adicione também o que plantou antes disso.',
  },
  {
    alvo: 'quando', icone: 'calendario', titulo: 'Passo 3 · Quando vai plantar',
    texto: 'Já vem marcado o mês de hoje. Se for plantar mais para frente, troque o mês. Toque em "Quero colher rápido" para ver primeiro as plantas que ficam prontas mais cedo.',
    seAusente: 'Esta parte aparece depois que você escolhe a cidade.',
  },
  {
    alvo: 'sugestoes', icone: 'lista', titulo: 'As sugestões',
    texto: 'A primeira da lista é a melhor escolha. Toque em uma planta para ver por que ela é boa e como plantar: espaço entre as plantas, jeito de plantar e quantos dias até a colheita.',
    seAusente: 'A lista aparece depois que você escolhe a cidade.',
  },
  {
    alvo: 'evitar', icone: 'alerta', titulo: 'O que evitar',
    texto: 'Estas plantas são da mesma família do que você plantou. Plantar uma atrás da outra no mesmo lugar junta pragas e doenças na terra.',
    seAusente: 'Esta lista aparece depois que você conta, no passo 2, o que plantou por último.',
  },
  {
    alvo: 'ajuda', icone: 'ajuda', titulo: 'Pronto!',
    texto: 'Sempre que tiver dúvida, toque em "Ajuda" para ver este passo a passo de novo ou ler a explicação de cada parte.',
  },
];

interface Retangulo { top: number; left: number; width: number; height: number }

const MARGEM = 8;
const LARGURA = 380;

export default function Tour({ passos, onFim }: { passos: TourStep[]; onFim: () => void }) {
  const [indiceDoPasso, setIndiceDoPasso] = useState(0);
  const [retangulo, setRetangulo] = useState<Retangulo | null>(null);
  const [balaoAltura, setBalaoAltura] = useState(220);
  const balaoRef = useRef<HTMLDivElement>(null);
  const passo = passos[indiceDoPasso];

  const elementoAlvo = useCallback(
    () => (passo.alvo ? document.querySelector<HTMLElement>(`[data-tour="${passo.alvo}"]`) : null),
    [passo.alvo],
  );

  // rola até a parte destacada e mede onde ela está
  useEffect(() => {
    const elemento = elementoAlvo();
    if (!elemento) { setRetangulo(null); return; }
    // partes grandes vão para o topo da tela, para sobrar espaço para o balão
    const grande = elemento.getBoundingClientRect().height > window.innerHeight * 0.45;
    elemento.scrollIntoView({ behavior: 'smooth', block: grande ? 'start' : 'center' });
    const medir = () => {
      const medidas = elemento.getBoundingClientRect();
      setRetangulo({ top: medidas.top - MARGEM, left: medidas.left - MARGEM, width: medidas.width + MARGEM * 2, height: medidas.height + MARGEM * 2 });
    };
    medir();
    const temporizadorCurto = window.setTimeout(medir, 350);
    const temporizadorLongo = window.setTimeout(medir, 800);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.clearTimeout(temporizadorCurto); window.clearTimeout(temporizadorLongo);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [elementoAlvo]);

  useLayoutEffect(() => {
    if (balaoRef.current) setBalaoAltura(balaoRef.current.offsetHeight);
  }, [indiceDoPasso, retangulo]);

  // teclado: setas e Esc
  useEffect(() => {
    const aoApertarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFim();
      if (evento.key === 'ArrowRight') setIndiceDoPasso((numero) => Math.min(numero + 1, passos.length - 1));
      if (evento.key === 'ArrowLeft') setIndiceDoPasso((numero) => Math.max(numero - 1, 0));
    };
    window.addEventListener('keydown', aoApertarTecla);
    return () => window.removeEventListener('keydown', aoApertarTecla);
  }, [onFim, passos.length]);

  // posição do balão: embaixo da parte destacada, em cima, ou no centro
  const larguraDaJanela = window.innerWidth, alturaDaJanela = window.innerHeight;
  const largura = Math.min(larguraDaJanela - 24, LARGURA);
  let estilo: React.CSSProperties;
  let seta: 'cima' | 'baixo' | null = null;
  if (!retangulo) {
    estilo = { width: largura, left: (larguraDaJanela - largura) / 2, top: Math.max(12, (alturaDaJanela - balaoAltura) / 2) };
  } else {
    const left = Math.min(Math.max(12, retangulo.left + retangulo.width / 2 - largura / 2), larguraDaJanela - largura - 12);
    const abaixo = retangulo.top + retangulo.height + 14;
    const acima = retangulo.top - balaoAltura - 14;
    if (abaixo + balaoAltura < alturaDaJanela - 8) { estilo = { width: largura, left, top: abaixo }; seta = 'cima'; }
    else if (acima > 8) { estilo = { width: largura, left, top: acima }; seta = 'baixo'; }
    else estilo = { width: largura, left, bottom: 12 }; // parte grande: balão fixo embaixo
  }
  // parte grande com balão embaixo: o destaque termina acima do balão
  const destaque = retangulo && 'bottom' in estilo
    ? { ...retangulo, height: Math.max(60, Math.min(retangulo.height, alturaDaJanela - balaoAltura - 30 - retangulo.top)) }
    : retangulo;
  const setaEsquerda = retangulo ? Math.min(Math.max(20, retangulo.left + retangulo.width / 2 - (estilo.left as number)), largura - 20) : 0;

  const ultimo = indiceDoPasso === passos.length - 1;
  const ausente = passo.alvo && !retangulo;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-titulo">
      {destaque
        ? <div className="tour-destaque" style={destaque} />
        : <div className="tour-dim" />}
      <div className="tour-block" />

      <div className="tour-balao" ref={balaoRef} style={estilo}>
        {seta && <span className={`tour-seta ${seta}`} style={{ left: setaEsquerda }} />}
        <div className="tour-top">
          <span className="tour-icone"><Icone nome={passo.icone} tamanho={22} /></span>
          <span className="tour-cont">{indiceDoPasso + 1} de {passos.length}</span>
          <button className="tour-x" onClick={onFim} aria-label="Fechar o passo a passo"><Icone nome="fechar" tamanho={18} /></button>
        </div>
        <h3 id="tour-titulo">{passo.titulo}</h3>
        <p>{passo.texto}</p>
        {ausente && passo.seAusente && <p className="tour-aviso"><Icone nome="info" tamanho={18} /> {passo.seAusente}</p>}

        <div className="tour-dots" aria-hidden="true">
          {passos.map((_, numero) => <span key={numero} className={numero === indiceDoPasso ? 'on' : ''} />)}
        </div>
        <div className="tour-acoes">
          {indiceDoPasso > 0
            ? <button className="tour-btn sec" onClick={() => setIndiceDoPasso(indiceDoPasso - 1)}><Icone nome="voltar" tamanho={18} /> Voltar</button>
            : <button className="tour-btn sec" onClick={onFim}>Pular</button>}
          <button className="tour-btn" onClick={() => (ultimo ? onFim() : setIndiceDoPasso(indiceDoPasso + 1))} autoFocus>
            {ultimo ? 'Entendi' : <>Próximo <Icone nome="direita" tamanho={18} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
