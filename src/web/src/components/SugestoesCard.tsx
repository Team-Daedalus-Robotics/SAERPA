import { useState } from 'react';
import { NOMES_MES } from '../data/hortalicas';
import { formatarNumero } from '../lib/geo';
import { planoDoAno, recomendar, type Entrada, type Sugestao } from '../services/rotacao';
import { classify } from '../services/smap';
import type { MoistureStatistics } from '../types';
import { EmptyState, StepTitle } from './ui';

interface Propriedades {
  entrada: Entrada | null;
  umidade: MoistureStatistics | null;
  mesAtual: number;
  onMes: (mes: number) => void;
  onColherRapido: (ativado: boolean) => void;
}

const BADGE = {
  otima: { texto: 'Ótima escolha', classeCss: 'b-great' },
  boa: { texto: 'Boa escolha', classeCss: 'b-good' },
  ok: { texto: 'Pode plantar', classeCss: 'b-ok' },
  evitar: { texto: 'Evite', classeCss: 'b-bad' },
} as const;

/** Conselho simples a partir da umidade da terra (satélite NASA SMAP) */
const DICA_UMIDADE = {
  dry: { icon: '🏜️', texto: 'A terra está seca. Regue bem antes de plantar e cubra o canteiro com palha para segurar a água.' },
  mid: { icon: '💧', texto: 'A terra está um pouco seca. Regue com frequência nos primeiros dias depois de plantar.' },
  ok:  { icon: '👍', texto: 'A umidade da terra está boa para plantar.' },
  wet: { icon: '🌧️', texto: 'A terra está muito molhada. Faça canteiros mais altos para a água escorrer.' },
} as const;

const PRIMEIROS = 5;

/** Passo 3 — "O que plantar agora" */
export default function SugestoesCard({ entrada, umidade, mesAtual, onMes, onColherRapido }: Propriedades) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [verMais, setVerMais] = useState(false);

  if (!entrada) {
    return (
      <section className="card step-off">
        <StepTitle numero={3} title="O que plantar agora" />
        <EmptyState icon="🧑‍🌾" title="Aqui aparecem as sugestões" text="Escolha a cidade no passo 1 para começar." />
      </section>
    );
  }

  const resultado = recomendar(entrada);
  const plano = planoDoAno(entrada, 3);
  const lista = verMais ? resultado.agora : resultado.agora.slice(0, PRIMEIROS);
  const dica = umidade ? DICA_UMIDADE[classify(umidade.mean).tone] : null;
  const ehAgora = entrada.mes === mesAtual;

  return (
    <section className="card">
      <StepTitle
        numero={3}
        title={ehAgora ? 'O que plantar agora' : `O que plantar em ${NOMES_MES[entrada.mes - 1]}`}
        subtitulo={`Região ${entrada.regiao} · tabela de plantio da Embrapa`}
      />

      <div className="controls" data-tour="quando">
        <label className="ctl">
          <span>Quando vai plantar?</span>
          <select value={entrada.mes} onChange={(evento) => { onMes(Number(evento.target.value)); setVerMais(false); }}>
            {NOMES_MES.map((nomeDoMes, indice) => (
              <option key={nomeDoMes} value={indice + 1}>{indice + 1 === mesAtual ? `Agora (${nomeDoMes})` : primeiraLetraMaiuscula(nomeDoMes)}</option>
            ))}
          </select>
        </label>
        <button
          className={`chip-toggle ${entrada.colherRapido ? 'on' : ''}`}
          aria-pressed={entrada.colherRapido}
          onClick={() => onColherRapido(!entrada.colherRapido)}
        >
          ⏱️ Quero colher rápido
        </button>
      </div>

      {!entrada.historico.respondeu && (
        <p className="nudge">👆 Conte no passo 2 o que você plantou por último. Assim a sugestão cuida melhor da sua terra.</p>
      )}

      {dica && umidade && (
        <div className="tip">
          <span className="tip-icon">{dica.icon}</span>
          <p>{dica.texto} <small>Umidade medida por satélite da NASA: {formatarNumero(umidade.mean)} (média de 30 dias)</small></p>
        </div>
      )}

      <h3 className="list-title">✅ Boas para plantar {ehAgora ? 'agora' : `em ${NOMES_MES[entrada.mes - 1]}`}</h3>
      {resultado.agora.length === 0 && <p className="hint">Nenhuma planta da tabela é indicada para este mês na sua região. Veja os próximos meses abaixo.</p>}
      <ul className="sug-list" data-tour="sugestoes">
        {lista.map((sugestao, indice) => (
          <SugestaoItem key={sugestao.hortalica.id} sugestao={sugestao} destaque={indice === 0} aberto={aberto === sugestao.hortalica.id}
            onToggle={() => setAberto(aberto === sugestao.hortalica.id ? null : sugestao.hortalica.id)} />
        ))}
      </ul>
      {!verMais && resultado.agora.length > PRIMEIROS && (
        <button className="btn-more" onClick={() => setVerMais(true)}>Ver mais {resultado.agora.length - PRIMEIROS} opções</button>
      )}

      {resultado.proximosMeses.length > 0 && (
        <>
          <h3 className="list-title">📅 Para os próximos meses</h3>
          <ul className="mini-list">
            {resultado.proximosMeses.slice(0, 4).map((sugestao) => (
              <li key={sugestao.hortalica.id}><span>{sugestao.hortalica.emoji}</span><b>{sugestao.hortalica.nome}</b><em>a partir de {NOMES_MES[sugestao.proximoMes! - 1]}</em></li>
            ))}
          </ul>
        </>
      )}

      {resultado.evitar.length > 0 && (
        <div data-tour="evitar">
          <h3 className="list-title">⚠️ Evite plantar no mesmo lugar</h3>
          <p className="hint">São da mesma família do que você plantou. Pegam as mesmas pragas e doenças.</p>
          <ul className="mini-list bad">
            {resultado.evitar.slice(0, 5).map((sugestao) => (
              <li key={sugestao.hortalica.id}><span>{sugestao.hortalica.emoji}</span><b>{sugestao.hortalica.nome}</b><em>{sugestao.hortalica.familia}</em></li>
            ))}
          </ul>
        </div>
      )}

      {plano.length > 1 && (
        <>
          <h3 className="list-title">🗓️ Ideia de sequência para o ano</h3>
          <div className="timeline">
            {plano.map((passoDoPlano, indice) => (
              <div key={indice} className="t-step">
                <span className="e">{passoDoPlano.sugestao.hortalica.emoji}</span>
                <b>{passoDoPlano.sugestao.hortalica.nome}</b>
                {primeiraLetraMaiuscula(NOMES_MES[passoDoPlano.mes - 1])}
              </div>
            ))}
          </div>
        </>
      )}

      <p className="source">
        Épocas, espaçamento e colheita: Embrapa (Sisteminha) — adaptado de Amaro et al. (2007) e Embrapa Hortaliças e Sebrae (2010).
      </p>
    </section>
  );
}

function SugestaoItem({ sugestao, destaque, aberto, onToggle }: { sugestao: Sugestao; destaque: boolean; aberto: boolean; onToggle: () => void }) {
  const selo = BADGE[sugestao.nivel];
  const hortalica = sugestao.hortalica;
  return (
    <li className={`sug ${destaque ? 'top' : ''} ${aberto ? 'open' : ''}`}>
      <button className="sug-head" onClick={onToggle} aria-expanded={aberto}>
        <span className="sug-emoji">{hortalica.emoji}</span>
        <span className="sug-main">
          <b>{hortalica.nome}</b>
          <span className={`badge ${selo.classeCss}`}>{destaque ? '⭐ Melhor escolha' : selo.texto}</span>
          <span className="sug-sub">Colhe em {hortalica.colheitaDias[0]}–{hortalica.colheitaDias[1]} dias</span>
        </span>
        <span className="sug-more">{aberto ? 'Fechar' : 'Ver como plantar'}</span>
      </button>
      {aberto && (
        <div className="sug-body">
          <h4>Por que?</h4>
          <ul className="reasons">
            {sugestao.motivos.map((motivo, indice) => <li key={indice} className={motivo.tipo}>{motivo.texto}</li>)}
          </ul>
          <h4>Como plantar</h4>
          <dl className="howto">
            <div><dt>📏 Entre as linhas</dt><dd>{hortalica.espacamentoEmCentimetros.linhas} cm</dd></div>
            <div><dt>📐 Entre as plantas</dt><dd>{hortalica.espacamentoEmCentimetros.plantas} cm</dd></div>
            <div><dt>🌱 Jeito de plantar</dt><dd>{hortalica.tipoPlantio}</dd></div>
            <div><dt>🧺 Colheita</dt><dd>{hortalica.colheitaDias[0]} a {hortalica.colheitaDias[1]} dias depois de plantar</dd></div>
            {hortalica.producaoPorMetroQuadrado && <div><dt>⚖️ Produção</dt><dd>{hortalica.producaoPorMetroQuadrado} por m²</dd></div>}
          </dl>
        </div>
      )}
    </li>
  );
}

const primeiraLetraMaiuscula = (texto: string) => texto[0].toUpperCase() + texto.slice(1);
