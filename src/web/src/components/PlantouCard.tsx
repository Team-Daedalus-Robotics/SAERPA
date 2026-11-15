import { useMemo, useState } from 'react';
import { GRUPOS } from '../data/classificacao';
import { daRegiao, indexarPorId } from '../data/hortalicas';
import type { Historico, Hortalica, Regiao } from '../types';
import { EmptyState, StepTitle } from './ui';

interface Propriedades {
  catalogo: Hortalica[];
  regiao: Regiao | null;
  historico: Historico;
  onChange: (historico: Historico) => void;
  /** nome da área em análise ("toda a cidade" ou "Área 1") */
  ondeLabel: string;
}

const LIMITE = 12;

/** Passo 2 — "O que você plantou por último?" */
export default function PlantouCard({ catalogo, regiao, historico, onChange, ondeLabel }: Propriedades) {
  const [busca, setBusca] = useState('');
  const [verTodas, setVerTodas] = useState(false);
  const [trocando, setTrocando] = useState(false);

  const opcoes = useMemo(() => {
    if (!regiao) return [];
    const consulta = normalizar(busca);
    return daRegiao(catalogo, regiao).filter((hortalica) => !consulta || normalizar(hortalica.nome).includes(consulta));
  }, [catalogo, regiao, busca]);

  if (!regiao) {
    return (
      <section className="card step-off" data-tour="plantou">
        <StepTitle numero={2} title="O que você plantou por último?" />
        <EmptyState icon="🌱" title="Primeiro escolha a cidade" text="Assim mostramos as plantas que dão certo na sua região." />
      </section>
    );
  }

  const porId = indexarPorId(catalogo);
  const ultima = historico.ultima ? porId[historico.ultima] : null;
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
      <StepTitle numero={2} title="O que você plantou por último?" subtitulo={`Em ${ondeLabel}`} />

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
            onChange={(evento) => setBusca(evento.target.value)}
          />
          <div className="tiles">
            {!busca && (
              <button className={`tile ${escolheu && !ultima ? 'active' : ''}`} onClick={() => escolher(null)}>
                <span className="tile-emoji">🤷</span>
                <span>Nada / não sei</span>
              </button>
            )}
            {visiveis.map((hortalica) => (
              <button key={hortalica.id} className={`tile ${hortalica.id === historico.ultima ? 'active' : ''}`} onClick={() => escolher(hortalica.id)}>
                <span className="tile-emoji">{hortalica.emoji}</span>
                <span>{hortalica.nome}</span>
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
            {historico.anteriores.map((id, indice) => (
              <span key={indice} className="pill-item">
                {porId[id]?.emoji} {porId[id]?.nome}
                <button aria-label={`Tirar ${porId[id]?.nome}`}
                  onClick={() => onChange({ ...historico, anteriores: historico.anteriores.filter((_, outroIndice) => outroIndice !== indice) })}>×</button>
              </span>
            ))}
            {historico.anteriores.length < 3 && (
              <select
                className="add-select"
                value=""
                onChange={(evento) => evento.target.value && onChange({ ...historico, anteriores: [...historico.anteriores, evento.target.value] })}
              >
                <option value="">+ Adicionar</option>
                {daRegiao(catalogo, regiao).map((hortalica) => <option key={hortalica.id} value={hortalica.id}>{hortalica.nome}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
