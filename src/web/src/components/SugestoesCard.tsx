import { useState } from 'react';
import { NOMES_MES } from '../data/hortalicas';
import { fmt } from '../lib/geo';
import { planoDoAno, recomendar, type Entrada, type Sugestao } from '../services/rotacao';
import { classify } from '../services/smap';
import type { MoistureStats } from '../types';
import { EmptyState, StepTitle } from './ui';

interface Props {
  entrada: Entrada | null;
  umidade: MoistureStats | null;
  mesAtual: number;
  onMes: (m: number) => void;
  onColherRapido: (v: boolean) => void;
}

const BADGE = {
  otima: { txt: 'Ótima escolha', cls: 'b-great' },
  boa: { txt: 'Boa escolha', cls: 'b-good' },
  ok: { txt: 'Pode plantar', cls: 'b-ok' },
  evitar: { txt: 'Evite', cls: 'b-bad' },
} as const;

/** Conselho simples a partir da umidade da terra (satélite NASA SMAP) */
const DICA_UMIDADE = {
  dry: { icon: '🏜️', txt: 'A terra está seca. Regue bem antes de plantar e cubra o canteiro com palha para segurar a água.' },
  mid: { icon: '💧', txt: 'A terra está um pouco seca. Regue com frequência nos primeiros dias depois de plantar.' },
  ok:  { icon: '👍', txt: 'A umidade da terra está boa para plantar.' },
  wet: { icon: '🌧️', txt: 'A terra está muito molhada. Faça canteiros mais altos para a água escorrer.' },
} as const;

const PRIMEIROS = 5;

/** Passo 3 — "O que plantar agora" */
export default function SugestoesCard({ entrada, umidade, mesAtual, onMes, onColherRapido }: Props) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [verMais, setVerMais] = useState(false);

  if (!entrada) {
    return (
      <section className="card step-off">
        <StepTitle n={3} title="O que plantar agora" />
        <EmptyState icon="🧑‍🌾" title="Aqui aparecem as sugestões" text="Escolha a cidade no passo 1 para começar." />
      </section>
    );
  }

  const r = recomendar(entrada);
  const plano = planoDoAno(entrada, 3);
  const lista = verMais ? r.agora : r.agora.slice(0, PRIMEIROS);
  const dica = umidade ? DICA_UMIDADE[classify(umidade.mean).tone] : null;
  const ehAgora = entrada.mes === mesAtual;

  return (
    <section className="card">
      <StepTitle
        n={3}
        title={ehAgora ? 'O que plantar agora' : `O que plantar em ${NOMES_MES[entrada.mes - 1]}`}
        sub={`Região ${entrada.regiao} · tabela de plantio da Embrapa`}
      />

      <div className="controls" data-tour="quando">
        <label className="ctl">
          <span>Quando vai plantar?</span>
          <select value={entrada.mes} onChange={(e) => { onMes(+e.target.value); setVerMais(false); }}>
            {NOMES_MES.map((m, i) => (
              <option key={m} value={i + 1}>{i + 1 === mesAtual ? `Agora (${m})` : cap(m)}</option>
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
          <p>{dica.txt} <small>Umidade medida por satélite da NASA: {fmt(umidade.mean)} (média de 30 dias)</small></p>
        </div>
      )}

      <h3 className="list-title">✅ Boas para plantar {ehAgora ? 'agora' : `em ${NOMES_MES[entrada.mes - 1]}`}</h3>
      {r.agora.length === 0 && <p className="hint">Nenhuma planta da tabela é indicada para este mês na sua região. Veja os próximos meses abaixo.</p>}
      <ul className="sug-list" data-tour="sugestoes">
        {lista.map((s, i) => (
          <SugestaoItem key={s.h.id} s={s} destaque={i === 0} aberto={aberto === s.h.id}
            onToggle={() => setAberto(aberto === s.h.id ? null : s.h.id)} />
        ))}
      </ul>
      {!verMais && r.agora.length > PRIMEIROS && (
        <button className="btn-more" onClick={() => setVerMais(true)}>Ver mais {r.agora.length - PRIMEIROS} opções</button>
      )}

      {r.proximosMeses.length > 0 && (
        <>
          <h3 className="list-title">📅 Para os próximos meses</h3>
          <ul className="mini-list">
            {r.proximosMeses.slice(0, 4).map((s) => (
              <li key={s.h.id}><span>{s.h.emoji}</span><b>{s.h.nome}</b><em>a partir de {NOMES_MES[s.proximoMes! - 1]}</em></li>
            ))}
          </ul>
        </>
      )}

      {r.evitar.length > 0 && (
        <div data-tour="evitar">
          <h3 className="list-title">⚠️ Evite plantar no mesmo lugar</h3>
          <p className="hint">São da mesma família do que você plantou. Pegam as mesmas pragas e doenças.</p>
          <ul className="mini-list bad">
            {r.evitar.slice(0, 5).map((s) => (
              <li key={s.h.id}><span>{s.h.emoji}</span><b>{s.h.nome}</b><em>{s.h.familia}</em></li>
            ))}
          </ul>
        </div>
      )}

      {plano.length > 1 && (
        <>
          <h3 className="list-title">🗓️ Ideia de sequência para o ano</h3>
          <div className="timeline">
            {plano.map((p, i) => (
              <div key={i} className="t-step">
                <span className="e">{p.s.h.emoji}</span>
                <b>{p.s.h.nome}</b>
                {cap(NOMES_MES[p.mes - 1])}
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

function SugestaoItem({ s, destaque, aberto, onToggle }: { s: Sugestao; destaque: boolean; aberto: boolean; onToggle: () => void }) {
  const b = BADGE[s.nivel];
  const h = s.h;
  return (
    <li className={`sug ${destaque ? 'top' : ''} ${aberto ? 'open' : ''}`}>
      <button className="sug-head" onClick={onToggle} aria-expanded={aberto}>
        <span className="sug-emoji">{h.emoji}</span>
        <span className="sug-main">
          <b>{h.nome}</b>
          <span className={`badge ${b.cls}`}>{destaque ? '⭐ Melhor escolha' : b.txt}</span>
          <span className="sug-sub">Colhe em {h.colheitaDias[0]}–{h.colheitaDias[1]} dias</span>
        </span>
        <span className="sug-more">{aberto ? 'Fechar' : 'Ver como plantar'}</span>
      </button>
      {aberto && (
        <div className="sug-body">
          <h4>Por que?</h4>
          <ul className="reasons">
            {s.motivos.map((m, i) => <li key={i} className={m.tipo}>{m.texto}</li>)}
          </ul>
          <h4>Como plantar</h4>
          <dl className="howto">
            <div><dt>📏 Entre as linhas</dt><dd>{h.espacamentoCm.linhas} cm</dd></div>
            <div><dt>📐 Entre as plantas</dt><dd>{h.espacamentoCm.plantas} cm</dd></div>
            <div><dt>🌱 Jeito de plantar</dt><dd>{h.tipoPlantio}</dd></div>
            <div><dt>🧺 Colheita</dt><dd>{h.colheitaDias[0]} a {h.colheitaDias[1]} dias depois de plantar</dd></div>
            {h.producaoM2 && <div><dt>⚖️ Produção</dt><dd>{h.producaoM2} por m²</dd></div>}
          </dl>
        </div>
      )}
    </li>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
