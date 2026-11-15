import { useState } from 'react';
import { NOMES_MES } from '../data/hortalicas';
import { formatarNumero } from '../lib/geo';
import { planoDoAno, recomendar, type Entrada, type Sugestao } from '../services/rotacao';
import { classificarUmidadeDoSolo } from '../services/clima';
import type { Clima } from '../types';
import { Icone, SeloDaCultura, type NomeDeIcone } from './icones';
import { EmptyState, Sparkline, StepTitle } from './ui';

interface Propriedades {
  entrada: Entrada | null;
  clima: Clima | null;
  climaCarregando: boolean;
  climaComErro: boolean;
  onTentarClimaDeNovo: () => void;
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

/** Conselho simples a partir da umidade do solo (NASA POWER) */
const DICA_UMIDADE = {
  dry: 'A terra está seca. Regue bem antes de plantar e cubra o canteiro com palha para segurar a água.',
  mid: 'A terra está um pouco seca. Regue com frequência nos primeiros dias depois de plantar.',
  ok: 'A umidade da terra está boa para plantar.',
  wet: 'A terra está muito molhada. Faça canteiros mais altos para a água escorrer.',
} as const;

const ICONE_DO_MOTIVO: Record<'bom' | 'ruim' | 'info', NomeDeIcone> = { bom: 'sucesso', ruim: 'alerta', info: 'info' };

const PRIMEIROS = 5;

function posicaoNaEscala(percentual: number): number {
  return Math.max(0, Math.min(100, percentual));
}

function formatarDia(instanteIso: string): string {
  return new Date(instanteIso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

/** Passo 3 — "O que plantar agora" */
export default function SugestoesCard({ entrada, clima, climaCarregando, climaComErro, onTentarClimaDeNovo, mesAtual, onMes, onColherRapido }: Propriedades) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [verMais, setVerMais] = useState(false);

  if (!entrada) {
    return (
      <section className="card step-off">
        <StepTitle numero={3} title="O que plantar agora" />
        <EmptyState icone="lista" title="Aqui aparecem as sugestões" text="Escolha a cidade no passo 1 para começar." />
      </section>
    );
  }

  const resultado = recomendar(entrada);
  const plano = planoDoAno(entrada, 3);
  const lista = verMais ? resultado.agora : resultado.agora.slice(0, PRIMEIROS);
  const classificacao = clima ? classificarUmidadeDoSolo(clima.umidadeDoSolo.atual) : null;
  const ehAgora = entrada.mes === mesAtual;
  const nomeDoMes = NOMES_MES[entrada.mes - 1];

  return (
    <section className="card">
      <StepTitle
        numero={3}
        title={ehAgora ? 'O que plantar agora' : `O que plantar em ${nomeDoMes}`}
        subtitulo={`Região ${entrada.regiao} · tabela de plantio da Embrapa`}
      />

      <div className="controls" data-tour="quando">
        <label className="ctl">
          <span>Quando vai plantar?</span>
          <select value={entrada.mes} onChange={(evento) => { onMes(Number(evento.target.value)); setVerMais(false); }}>
            {NOMES_MES.map((nome, indice) => (
              <option key={nome} value={indice + 1}>{indice + 1 === mesAtual ? `Agora (${nome})` : primeiraLetraMaiuscula(nome)}</option>
            ))}
          </select>
        </label>
        <button
          className={`chip-toggle ${entrada.colherRapido ? 'on' : ''}`}
          aria-pressed={entrada.colherRapido}
          onClick={() => onColherRapido(!entrada.colherRapido)}
        >
          <Icone nome="relogio" tamanho={18} /> Quero colher rápido
        </button>
      </div>

      {!entrada.historico.respondeu && (
        <p className="nudge"><Icone nome="info" tamanho={20} /> Conte no passo 2 o que você plantou por último. Assim a sugestão cuida melhor da sua terra.</p>
      )}

      <div className="stat">
        <div className="stat-head">
          <span className="stat-titulo"><Icone nome="gota" tamanho={18} /> Umidade do solo e clima</span>
          <span className="chip-fonte">NASA</span>
        </div>
        {climaCarregando && !clima && <p className="hint">Buscando os dados da NASA para este local… A primeira vez pode levar alguns segundos.</p>}
        {climaComErro && !clima && (
          <>
            <p className="hint">Não foi possível buscar os dados da NASA agora.</p>
            <button className="btn-outline" onClick={onTentarClimaDeNovo}><Icone nome="troca" tamanho={18} /> Tentar de novo</button>
          </>
        )}
        {clima && classificacao && (
          <>
            <div className="stat-valor">
              <b className={`tom-${classificacao.tom}`}>{classificacao.rotulo}</b>
              <span>{formatarNumero(clima.umidadeDoSolo.atual, 0)}% do máximo de água que o solo segura · média de 30 dias: {formatarNumero(clima.umidadeDoSolo.media, 0)}%</span>
            </div>
            <div className="escala" aria-hidden="true">
              <span className="escala-faixa f-dry" /><span className="escala-faixa f-mid" /><span className="escala-faixa f-ok" /><span className="escala-faixa f-wet" />
              <span className="escala-marca" style={{ left: `${posicaoNaEscala(clima.umidadeDoSolo.atual)}%` }} />
            </div>
            <div className="escala-rotulos"><span>Seco</span><span>Molhado</span></div>
            <p className="stat-dica">{DICA_UMIDADE[classificacao.tom]}</p>
            <Sparkline series={clima.umidadeDoSolo.diaria} rotulo="Umidade do solo nos últimos 30 dias" />
            <span className="spark-legenda">Umidade do solo nos últimos 30 dias</span>
            <div className="stat-grid">
              <div className="mini-stat"><span>Chuva em 7 dias</span><b>{formatarNumero(clima.chuva.ultimos7Dias, 1)} mm</b></div>
              <div className="mini-stat"><span>Ar agora</span><b>{formatarNumero(clima.temperaturaDoAr.atual, 0)} °C</b></div>
              <div className="mini-stat"><span>Solo agora</span><b>{formatarNumero(clima.temperaturaDoSolo.atual, 0)} °C</b></div>
              <div className="mini-stat"><span>Umidade do ar</span><b>{formatarNumero(clima.umidadeDoAr.atual, 0)}%</b></div>
            </div>
            <span className="stat-fonte">Dados reais da NASA POWER (modelo, região de cerca de 55 km), até {formatarDia(clima.atualizadoAte)}.</span>
          </>
        )}
      </div>

      <h3 className="list-title">
        Boas para plantar {ehAgora ? 'agora' : `em ${nomeDoMes}`}
        <span className="contagem">{resultado.agora.length}</span>
      </h3>
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
          <h3 className="list-title">Para os próximos meses</h3>
          <ul className="mini-list">
            {resultado.proximosMeses.slice(0, 4).map((sugestao) => (
              <li key={sugestao.hortalica.id}>
                <SeloDaCultura grupo={sugestao.hortalica.grupo} tamanho={36} />
                <b>{sugestao.hortalica.nome}</b>
                <em>a partir de {NOMES_MES[sugestao.proximoMes! - 1]}</em>
              </li>
            ))}
          </ul>
        </>
      )}

      {resultado.evitar.length > 0 && (
        <div data-tour="evitar">
          <h3 className="list-title">Evite plantar no mesmo lugar</h3>
          <p className="hint">São da mesma família do que você plantou. Pegam as mesmas pragas e doenças.</p>
          <ul className="mini-list bad">
            {resultado.evitar.slice(0, 5).map((sugestao) => (
              <li key={sugestao.hortalica.id}>
                <SeloDaCultura grupo={sugestao.hortalica.grupo} tamanho={36} />
                <b>{sugestao.hortalica.nome}</b>
                <em>{sugestao.hortalica.familia}</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plano.length > 1 && (
        <>
          <h3 className="list-title">Ideia de sequência para o ano</h3>
          <ol className="timeline">
            {plano.map((passoDoPlano, indice) => (
              <li key={indice} className="t-step">
                <span className="t-num">{indice + 1}</span>
                <b>{passoDoPlano.sugestao.hortalica.nome}</b>
                <span>{primeiraLetraMaiuscula(NOMES_MES[passoDoPlano.mes - 1])}</span>
              </li>
            ))}
          </ol>
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
        <SeloDaCultura grupo={hortalica.grupo} />
        <span className="sug-main">
          <b>{hortalica.nome}</b>
          <span className="sug-sub">Colhe em {hortalica.colheitaDias[0]}–{hortalica.colheitaDias[1]} dias</span>
        </span>
        <span className={`badge ${selo.classeCss}`}>{destaque ? 'Melhor escolha' : selo.texto}</span>
        <span className="sug-seta"><Icone nome="baixo" tamanho={20} /></span>
      </button>
      {aberto && (
        <div className="sug-body">
          <h4>Por que?</h4>
          <ul className="reasons">
            {sugestao.motivos.map((motivo, indice) => (
              <li key={indice} className={motivo.tipo}><Icone nome={ICONE_DO_MOTIVO[motivo.tipo]} tamanho={18} /><span>{motivo.texto}</span></li>
            ))}
          </ul>
          <h4>Como plantar</h4>
          <dl className="howto">
            <div><dt>Entre as linhas</dt><dd>{hortalica.espacamentoEmCentimetros.linhas} cm</dd></div>
            <div><dt>Entre as plantas</dt><dd>{hortalica.espacamentoEmCentimetros.plantas} cm</dd></div>
            <div><dt>Jeito de plantar</dt><dd>{hortalica.tipoPlantio}</dd></div>
            <div><dt>Colheita</dt><dd>{hortalica.colheitaDias[0]} a {hortalica.colheitaDias[1]} dias depois de plantar</dd></div>
            {hortalica.producaoPorMetroQuadrado && <div><dt>Produção</dt><dd>{hortalica.producaoPorMetroQuadrado} por m²</dd></div>}
          </dl>
        </div>
      )}
    </li>
  );
}

const primeiraLetraMaiuscula = (texto: string) => texto[0].toUpperCase() + texto.slice(1);
