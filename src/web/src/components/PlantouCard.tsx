import { useMemo, useState } from 'react';
import { GRUPOS } from '../data/classificacao';
import { POR_ID, daRegiao } from '../data/hortalicas';
import type { Historico, Regiao } from '../types';
import { EmptyState, StepTitle } from './ui';

interface Props {
  regiao: Regiao | null;
  historico: Historico;
  onChange: (h: Historico) => void;
  /** nome da área em análise ("toda a cidade" ou "Área 1") */
  ondeLabel: string;
}

const LIMITE = 12;

/** Passo 2 — "O que você plantou por último?" */
export default function PlantouCard({ regiao, historico, onChange, ondeLabel }: Props) {
  const [busca, setBusca] = useState('');
  const [verTodas, setVerTodas] = useState(false);
  const [trocando, setTrocando] = useState(false);

  const opcoes = useMemo(() => {
    if (!regiao) return [];
    const q = normalize(busca);
    return daRegiao(regiao).filter((h) => !q || normalize(h.nome).includes(q));
  }, [regiao, busca]);

  if (!regiao) {
    return (
      <section className="card step-off" data-tour="plantou">
        <StepTitle n={2} title="O que você plantou por último?" />
        <EmptyState icon="🌱" title="Primeiro escolha a cidade" text="Assim mostramos as plantas que dão certo na sua região." />
      </section>
    );
  }

  const ultima = historico.ultima ? POR_ID[historico.ultima] : null;
  const escolheu = historico.ultima !== null || historico.respondeu;
  const mostrarGrade = !escolheu || trocando;

  function escolher(id: string | null) {
    onChange({ ...historico, ultima: id, respondeu: true });
    setTrocando(false);
    setBusca('');
    setVerTodas(false);
  }

  const visiveis = verTodas || busca ? opcoes : opcoes.slice(0, LIMITE);

  return (
    <section className="card" data-tour="plantou">
      <StepTitle n={2} title="O que você plantou por último?" sub={`Em ${ondeLabel}`} />

      {!mostrarGrade && (
        <div className="answer">
          <span className="answer-emoji">{ultima ? ultima.emoji : '🤷'}</span>
          <div>
            <b>{ultima ? ultima.nome : 'Nada / não sei'}</b>
            <span>{ultima ? `Planta ${GRUPOS[ultima.grupo].frase} · família ${ultima.familia}` : 'Vamos sugerir pela época do ano'}</span>
          </div>
          <button className="btn-outline" onClick={() => setTrocando(true)}>Trocar</button>
        </div>
      )}

      {mostrarGrade && (
        <>
          <input
            className="search"
            type="search"
            placeholder="🔎 Procure: alface, tomate, cenoura…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className="tiles">
            {!busca && (
              <button className={`tile ${escolheu && !ultima ? 'active' : ''}`} onClick={() => escolher(null)}>
                <span className="tile-emoji">🤷</span>
                <span>Nada / não sei</span>
              </button>
            )}
            {visiveis.map((h) => (
              <button key={h.id} className={`tile ${h.id === historico.ultima ? 'active' : ''}`} onClick={() => escolher(h.id)}>
                <span className="tile-emoji">{h.emoji}</span>
                <span>{h.nome}</span>
              </button>
            ))}
          </div>
          {busca && opcoes.length === 0 && <p className="hint">Nenhuma planta com esse nome na tabela da Embrapa para a sua região.</p>}
          {!busca && !verTodas && opcoes.length > LIMITE && (
            <button className="btn-more" onClick={() => setVerTodas(true)}>Ver todas as {opcoes.length} plantas</button>
          )}
        </>
      )}

      {ultima && !mostrarGrade && (
        <div className="before">
          <span className="before-label">E antes disso? <small>(se lembrar — melhora a sugestão)</small></span>
          <div className="before-row">
            {historico.anteriores.map((id, i) => (
              <span key={i} className="pill-item">
                {POR_ID[id]?.emoji} {POR_ID[id]?.nome}
                <button aria-label={`Tirar ${POR_ID[id]?.nome}`}
                  onClick={() => onChange({ ...historico, anteriores: historico.anteriores.filter((_, j) => j !== i) })}>×</button>
              </span>
            ))}
            {historico.anteriores.length < 3 && (
              <select
                className="add-select"
                value=""
                onChange={(e) => e.target.value && onChange({ ...historico, anteriores: [...historico.anteriores, e.target.value] })}
              >
                <option value="">+ Adicionar</option>
                {daRegiao(regiao).map((h) => <option key={h.id} value={h.id}>{h.nome}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
