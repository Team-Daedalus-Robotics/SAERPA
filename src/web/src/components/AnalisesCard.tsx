import { useState } from 'react';
import { useAnalises } from '../hooks/consultas';
import { formatarNumero } from '../lib/geo';
import type { Analise, MedidaUsada, OrigemDaMedida } from '../services/analises';
import { Icone, type NomeDeIcone } from './icones';
import { EmptyState } from './ui';

const ASSUNTOS: Record<string, { titulo: string; icone: NomeDeIcone; explicacao: string }> = {
  irrigation_need: { titulo: 'Precisa regar?', icone: 'gota', explicacao: 'Compara a umidade da terra, a chuva e o calor dos últimos dias com o que a planta precisa.' },
  soil_moisture_condition: { titulo: 'Como está a umidade da terra', icone: 'gota', explicacao: 'Olha a umidade da terra e do ar para dizer se o solo está seco ou molhado.' },
  rotation_next_crop: { titulo: 'O que plantar em seguida', icone: 'broto', explicacao: 'Junta o que já foi plantado, a época do ano e a condição da terra para escolher a próxima planta.' },
};

const NOME_DA_MEDIDA: Record<string, string> = {
  soil_moisture: 'Umidade da terra',
  soil_moisture_surface: 'Umidade da terra (em cima)',
  soil_moisture_root_zone: 'Umidade da terra (na raiz)',
  soil_temperature: 'Temperatura da terra',
  air_temperature: 'Temperatura do ar',
  air_temperature_max: 'Temperatura mais alta do dia',
  air_temperature_min: 'Temperatura mais baixa do dia',
  air_humidity: 'Umidade do ar',
  rainfall: 'Chuva',
};

const ORIGEM: Record<OrigemDaMedida, { rotulo: string; explicacao: string }> = {
  sensor: { rotulo: 'Sensor na roça', explicacao: 'medido pelo aparelho instalado na plantação' },
  satellite_hourly: { rotulo: 'NASA, hora a hora', explicacao: 'dados da NASA para a região, um valor por hora' },
  satellite_daily: { rotulo: 'Satélite, dia a dia', explicacao: 'observação de satélite da região, um valor por dia' },
};

function nomeDaMedida(medida: MedidaUsada): string {
  if (medida.origem === 'sensor') return medida.nomeDoSensor ?? medida.tipo ?? 'Sensor';
  return (medida.tipo && NOME_DA_MEDIDA[medida.tipo]) ?? medida.nomeDoSensor ?? medida.tipo ?? 'Medida';
}

function comUnidade(valor: number | null, unidade: string | null): string {
  if (valor === null) return 'sem valor';
  return `${formatarNumero(valor, Math.abs(valor) < 1 && valor !== 0 ? 2 : 1)}${unidade ? ` ${unidade}` : ''}`;
}

function formatarQuando(instanteIso: string | null): string {
  if (!instanteIso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(instanteIso)) return new Date(`${instanteIso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const instante = new Date(instanteIso);
  if (Number.isNaN(instante.getTime())) return '';
  return instante.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function emPorcentagem(fracao: number): number {
  return Math.round(Math.max(0, Math.min(1, fracao <= 1 ? fracao : fracao / 100)) * 100);
}

const primeiraLetraMaiuscula = (texto: string) => (texto ? texto[0].toUpperCase() + texto.slice(1) : texto);

const OPCOES_VISIVEIS = 5;

/** Últimas decisões do suggestion_worker, por assunto, mostrando as medidas que levaram a cada uma */
export default function AnalisesCard() {
  const consulta = useAnalises();
  const analises = consulta.data ?? [];
  const [abertas, setAbertas] = useState<Record<number, boolean>>({});

  const grupos = new Map<string, Analise[]>();
  for (const analise of analises) grupos.set(analise.assunto, [...(grupos.get(analise.assunto) ?? []), analise]);

  return (
    <section className="card" id="secao-analises">
      <div className="analises-topo">
        <span className="selo selo-neutro" style={{ width: 44, height: 44 }}><Icone nome="lista" /></span>
        <div>
          <h2>Como o SAERPA chegou nas sugestões</h2>
          <span className="step-sub">As {analises.length > 0 ? analises.length : 10} últimas análises, separadas por assunto. Toque em uma para ver as medidas usadas.</span>
        </div>
      </div>

      {consulta.isPending && <p className="hint">Buscando as análises…</p>}
      {consulta.isError && (
        <>
          <p className="hint">Não foi possível buscar as análises agora.</p>
          <button className="btn-outline" onClick={() => consulta.refetch()}><Icone nome="troca" tamanho={18} /> Tentar de novo</button>
        </>
      )}
      {consulta.isSuccess && analises.length === 0 && (
        <EmptyState icone="relogio" title="Ainda não há análises" text="Elas aparecem aqui assim que o sistema juntar as primeiras medidas dos sensores e da NASA." />
      )}

      {[...grupos.entries()].map(([assunto, doAssunto]) => {
        const descricao = ASSUNTOS[assunto] ?? { titulo: assunto, icone: 'info' as NomeDeIcone, explicacao: '' };
        return (
          <div key={assunto} className="analise-grupo">
            <h3 className="list-title">
              <Icone nome={descricao.icone} tamanho={20} /> {descricao.titulo}
              <span className="contagem">{doAssunto.length}</span>
            </h3>
            {descricao.explicacao && <p className="hint">{descricao.explicacao}</p>}
            <ul className="sug-list">
              {doAssunto.map((analise, indice) => {
                const aberta = abertas[analise.id] ?? indice === 0;
                return (
                  <AnaliseItem key={analise.id} analise={analise} maisRecente={indice === 0} aberta={aberta}
                    onAlternar={() => setAbertas({ ...abertas, [analise.id]: !aberta })} />
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function AnaliseItem({ analise, maisRecente, aberta, onAlternar }: { analise: Analise; maisRecente: boolean; aberta: boolean; onAlternar: () => void }) {
  const ehEscala = analise.tipo === 'score';
  const opcoes = ehEscala ? analise.opcoes : analise.opcoes.slice(0, OPCOES_VISIVEIS);
  const opcoesEscondidas = analise.opcoes.length - opcoes.length;
  const temProbabilidade = analise.opcoes.some((opcao) => opcao.probabilidade !== null);

  return (
    <li className={`sug ${maisRecente ? 'top' : ''} ${aberta ? 'open' : ''}`}>
      <button className="sug-head" onClick={onAlternar} aria-expanded={aberta}>
        <span className="sug-main">
          <b>{analise.resposta ? primeiraLetraMaiuscula(analise.resposta) : 'Sem resposta'}</b>
          <span className="sug-sub">
            {formatarQuando(analise.criadaEm)}
            {analise.culturaAlvo ? ` · para ${analise.culturaAlvo}` : ''}
          </span>
        </span>
        {maisRecente && <span className="badge b-great">Mais recente</span>}
        <span className="sug-seta"><Icone nome="baixo" tamanho={20} /></span>
      </button>

      {aberta && (
        <div className="sug-body">
          {analise.pergunta && (
            <>
              <h4>A pergunta</h4>
              <p className="analise-pergunta">{analise.pergunta}</p>
            </>
          )}

          {analise.certeza !== null && (
            <div className="analise-certeza">
              <span>Certeza da resposta</span>
              <div className="analise-barra"><i style={{ width: `${emPorcentagem(analise.certeza)}%` }} /></div>
              <b>{emPorcentagem(analise.certeza)}%</b>
            </div>
          )}

          {opcoes.length > 0 && (
            <>
              <h4>{ehEscala ? 'Onde a resposta caiu na escala' : 'As opções comparadas'}</h4>
              <ol className={`analise-opcoes ${ehEscala ? 'escala-de-niveis' : ''}`}>
                {opcoes.map((opcao) => (
                  <li key={opcao.rotulo} className={opcao.escolhida ? 'escolhida' : ''}>
                    <span className="analise-opcao-rotulo">{opcao.rotulo}</span>
                    <span className="analise-opcao-texto">
                      {opcao.descricao && <span>{primeiraLetraMaiuscula(opcao.descricao)}</span>}
                      {temProbabilidade && opcao.probabilidade !== null && (
                        <span className="analise-barra"><i style={{ width: `${emPorcentagem(opcao.probabilidade)}%` }} /></span>
                      )}
                    </span>
                    {temProbabilidade && opcao.probabilidade !== null && <em>{emPorcentagem(opcao.probabilidade)}%</em>}
                    {opcao.escolhida && <Icone nome="sucesso" tamanho={20} />}
                  </li>
                ))}
              </ol>
              {opcoesEscondidas > 0 && <p className="hint">E mais {opcoesEscondidas} opções da época que ficaram atrás.</p>}
            </>
          )}

          <h4>Medidas usadas para chegar nessa resposta</h4>
          {analise.medidas.length === 0 && <p className="hint">Nenhuma medida de sensor ou satélite estava disponível nessa análise.</p>}
          <ul className="analise-medidas">
            {analise.medidas.map((medida, indice) => (
              <li key={indice}>
                <div className="analise-medida-topo">
                  <b>{nomeDaMedida(medida)}</b>
                  <span className={`chip-fonte origem-${medida.origem}`}>{ORIGEM[medida.origem].rotulo}</span>
                </div>
                <div className="analise-medida-valor">
                  <strong>{comUnidade(medida.ultimoValor, medida.unidade)}</strong>
                  <span>última leitura{medida.ultimaLeituraEm ? ` (${formatarQuando(medida.ultimaLeituraEm) || medida.ultimaLeituraEm})` : ''}</span>
                </div>
                {medida.leituras > 1 && medida.media !== null && (
                  <span className="analise-medida-resumo">
                    Média de {medida.leituras} leituras: {comUnidade(medida.media, medida.unidade)}
                    {medida.minimo !== null && medida.maximo !== null ? ` (de ${formatarNumero(medida.minimo, 1)} a ${formatarNumero(medida.maximo, 1)})` : ''}
                  </span>
                )}
                <span className="analise-medida-resumo">{primeiraLetraMaiuscula(ORIGEM[medida.origem].explicacao)}.</span>
              </li>
            ))}
          </ul>

          {analise.plantios.length > 0 && (
            <>
              <h4>Plantios anteriores que entraram na conta</h4>
              <ul className="reasons">
                {analise.plantios.map((plantio, indice) => (
                  <li key={indice} className="info">
                    <Icone nome="broto" tamanho={18} />
                    <span>
                      {plantio.cultura}{plantio.area ? ` em ${plantio.area}` : ''}
                      {plantio.plantadoEm ? `, plantado em ${new Date(`${plantio.plantadoEm}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}
                      {plantio.aindaPlantado ? ' (ainda na terra)' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="source">
            {analise.regiao ? `Época de plantio da região ${analise.regiao} (tabela da Embrapa). ` : ''}
            Resposta calculada por inteligência artificial{analise.modelo ? ` (${analise.modelo})` : ''} só com as medidas acima. Use como apoio, não como ordem.
          </p>
        </div>
      )}
    </li>
  );
}
