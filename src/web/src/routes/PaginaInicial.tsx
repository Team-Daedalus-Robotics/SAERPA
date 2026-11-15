import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { useCallback } from 'react';
import Ajuda from '../components/Ajuda';
import LocationPicker from '../components/LocationPicker';
import MapView, { SMAP_ZOOM_MINIMO, type BaseLayer, type MapTarget } from '../components/MapView';
import PlantouCard from '../components/PlantouCard';
import SugestoesCard from '../components/SugestoesCard';
import Tour, { PASSOS_TOUR } from '../components/Tour';
import { EmptyState, Icon, StepTitle } from '../components/ui';
import { ESTADOS } from '../data/locations';
import { useApagarArea, useAreas, useCatalogo, useCriarArea, useMunicipios, useSalvarHistorico, useUmidade } from '../hooks/consultas';
import { gravarArmazenado, lerArmazenado } from '../lib/armazenamento';
import { formatarNumero } from '../lib/geo';
import { mensagemDoErro } from '../services/clienteApi';
import type { Entrada } from '../services/rotacao';
import { USE_MOCK } from '../services/smap';
import type { Estado, Historico, LatLng, Municipio, Regiao } from '../types';

const rotaInicial = getRouteApi('/');

/** Zoom mínimo para marcar uma área com precisão */
const ZOOM_MINIMO_PARA_DESENHAR = 13;
const MES_ATUAL = new Date().getMonth() + 1;
const HISTORICO_VAZIO: Historico = { ultima: null, anteriores: [], respondeu: false };
const CHAVE_HISTORICO_DA_CIDADE = 'saerpa:historicoDaCidade';

type HistoricosDasCidades = Record<number, Historico>;

function lerHistoricosDasCidades(): HistoricosDasCidades {
  try {
    return JSON.parse(lerArmazenado(CHAVE_HISTORICO_DA_CIDADE) ?? '{}') as HistoricosDasCidades;
  } catch {
    return {};
  }
}

function proximoNomeDeArea(nomes: string[]): string {
  const numeros = nomes.map((nome) => Number(/^Área (\d+)$/.exec(nome)?.[1] ?? 0));
  return `Área ${Math.max(0, ...numeros) + 1}`;
}

export default function PaginaInicial() {
  const { estado: ufEscolhida, municipio: codigoDoMunicipio, area: areaDaUrl } = rotaInicial.useSearch();
  const navegar = rotaInicial.useNavigate();

  // ---- passo 1: onde (guardado na URL, então recarregar a página não perde a cidade) ----
  const estado: Estado | null = ESTADOS.find((candidato) => candidato.uf === ufEscolhida) ?? null;
  const { data: municipiosDoEstado } = useMunicipios(ufEscolhida);
  const municipio: Municipio | null = municipiosDoEstado?.find((candidato) => candidato.codigoIbge === codigoDoMunicipio) ?? null;

  const alvoDoMapa: MapTarget = useMemo(() => {
    if (municipio) return { kind: 'point', center: [municipio.lat, municipio.lng], zoom: 13 };
    if (estado) return { kind: 'point', center: [estado.lat, estado.lng], zoom: 6 };
    return { kind: 'brasil' };
    // o mapa só voa quando a escolha muda, não a cada renderização
  }, [estado?.uf, municipio?.codigoIbge]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- mapa ----
  const [base, setBase] = useState<BaseLayer>('satelite');
  const [showSmap, setShowSmap] = useState(true);
  const [zoom, setZoom] = useState(4);
  const [drawing, setDrawing] = useState<LatLng[] | null>(null);

  // ---- dados do servidor ----
  const catalogoConsulta = useCatalogo();
  const catalogo = catalogoConsulta.data;
  const areasConsulta = useAreas(municipio);
  const areas = areasConsulta.data ?? [];
  const area = areas.find((candidata) => candidata.id === areaDaUrl) ?? null;
  const criarAreaMutacao = useCriarArea(municipio);
  const apagarAreaMutacao = useApagarArea(municipio);
  const salvarHistoricoMutacao = useSalvarHistorico(municipio);
  const { data: umidade } = useUmidade(municipio, area);

  // ---- passo 2: histórico da cidade toda (quando nenhuma área está marcada) ----
  const [historicosDasCidades, setHistoricosDasCidades] = useState<HistoricosDasCidades>(lerHistoricosDasCidades);
  const historicoDaCidade = (codigoDoMunicipio !== undefined && historicosDasCidades[codigoDoMunicipio]) || HISTORICO_VAZIO;
  const [areasRespondidasNaSessao, setAreasRespondidasNaSessao] = useState<Set<number>>(new Set());

  // ---- passo 3 ----
  const [mes, setMes] = useState(MES_ATUAL);
  const [colherRapido, setColherRapido] = useState(false);

  // ---- UI ----
  const [ajuda, setAjuda] = useState(false);
  const [tour, setTour] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((mensagem: string) => {
    setToast(mensagem);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const historico: Historico = area
    ? { ...area.historico, respondeu: area.historico.respondeu || areasRespondidasNaSessao.has(area.id) }
    : historicoDaCidade;
  const regiao = (estado?.regiao ?? null) as Regiao | null;

  function atualizarBusca(busca: { estado?: string; municipio?: number; area?: number }) {
    navegar({ search: (anterior) => ({ ...anterior, ...busca }), replace: true });
  }

  function escolherEstado(estadoEscolhido: Estado | null) {
    atualizarBusca({ estado: estadoEscolhido?.uf, municipio: undefined, area: undefined });
    setDrawing(null);
  }
  function escolherMunicipio(municipioEscolhido: Municipio | null) {
    atualizarBusca({ municipio: municipioEscolhido?.codigoIbge, area: undefined });
  }
  function selecionarArea(areaId: number | null) {
    atualizarBusca({ area: areaId ?? undefined });
  }

  function mudarHistorico(novoHistorico: Historico) {
    if (area) {
      setAreasRespondidasNaSessao((respondidas) => new Set(respondidas).add(area.id));
      salvarHistoricoMutacao.mutate(
        { areaId: area.id, historico: novoHistorico },
        { onError: (erro) => showToast(mensagemDoErro(erro)) },
      );
    } else if (codigoDoMunicipio !== undefined) {
      const atualizados = { ...historicosDasCidades, [codigoDoMunicipio]: novoHistorico };
      setHistoricosDasCidades(atualizados);
      gravarArmazenado(CHAVE_HISTORICO_DA_CIDADE, JSON.stringify(atualizados));
    }
  }

  // ---- marcar área no mapa ----
  function comecarMarcar() {
    if (zoom < ZOOM_MINIMO_PARA_DESENHAR) {
      showToast('Aproxime mais o mapa (botão +) até ver bem o seu terreno.');
      return;
    }
    setDrawing([]);
  }
  function terminarMarcar() {
    if (!drawing || drawing.length < 3) return;
    criarAreaMutacao.mutate(
      { nome: proximoNomeDeArea(areas.map((candidata) => candidata.nome)), coordenadas: drawing },
      {
        onSuccess: (novaArea) => {
          selecionarArea(novaArea.id);
          setDrawing(null);
          showToast(`${novaArea.nome} marcada (${formatarNumero(novaArea.areaEmHectares, 2)} hectares). Agora diga o que plantou nela.`);
        },
        onError: (erro) => showToast(mensagemDoErro(erro)),
      },
    );
  }
  function apagarArea(areaId: number) {
    apagarAreaMutacao.mutate(areaId, {
      onSuccess: () => selecionarArea(null),
      onError: (erro) => showToast(mensagemDoErro(erro)),
    });
  }

  const entrada: Entrada | null = useMemo(
    () => (regiao && municipio && catalogo ? { catalogo, historico, regiao, mes, colherRapido } : null),
    [catalogo, regiao, municipio, historico, mes, colherRapido],
  );

  const ondeLabel = area ? area.nome : municipio ? `${municipio.nome} (cidade toda)` : '';
  const aguardandoCatalogo = municipio !== null && catalogo === undefined;

  return (
    <div className="app">
      <header className="topbar">
        {estado ? (
          <button className="back-btn" onClick={() => escolherEstado(null)}>
            <Icon caminho="M15 5l-7 7 7 7" /> Início
          </button>
        ) : <span className="logo">🌱</span>}
        <div className="title">
          <h1>Field Shift</h1>
          <span className="tagline">O que plantar depois, para cuidar da terra</span>
        </div>
        <button className="help-btn" data-tour="ajuda" onClick={() => setAjuda(true)}>
          <span aria-hidden="true">?</span> Ajuda
        </button>
      </header>

      <main className="layout">
        {/* ===== Passo 1: onde (mapa) ===== */}
        <section className="map-wrap">
          <div className="map-head" data-tour="local">
            <StepTitle numero={1} title="Onde fica sua plantação?" />
            <LocationPicker estado={estado} municipio={municipio} onEstado={escolherEstado} onMunicipio={escolherMunicipio} />
          </div>
          <div className="map-area" data-tour="mapa">
            <MapView
              base={base} showSmap={showSmap} target={alvoDoMapa} municipio={municipio}
              areas={areas} selectedId={area?.id ?? null} drawing={drawing}
              onSelectArea={selecionarArea}
              onMapClick={(ponto) => drawing && setDrawing([...drawing, ponto])}
              onZoom={setZoom}
            />

            <div className="map-controls">
              <button className="map-btn" onClick={() => setBase(base === 'satelite' ? 'ruas' : 'satelite')}>
                {base === 'satelite' ? '🗺️ Ver mapa' : '🛰️ Ver satélite'}
              </button>
              <button data-tour="umidade" className={`map-btn ${showSmap ? 'on' : ''}`} onClick={() => setShowSmap(!showSmap)}>
                💧 Umidade da terra {showSmap ? '✓' : ''}
              </button>
            </div>

            {showSmap && !drawing && (
              <div className="legend">
                <span className="legend-title">💧 Umidade da terra</span>
                <div className="legend-bar" />
                <div className="legend-scale"><span>Seca</span><span>Molhada</span></div>
                <span className="legend-src">Satélite NASA SMAP{USE_MOCK && <em> · dados de teste</em>}</span>
                {zoom < SMAP_ZOOM_MINIMO && <span className="legend-hint">Aproxime o mapa para ver as cores</span>}
              </div>
            )}

            {drawing && (
              <div className="draw-banner">
                <p>
                  <b>Toque nos cantos do seu terreno</b>
                  {drawing.length < 3 ? `Faltam ${3 - drawing.length} toque(s) no mínimo` : `${drawing.length} cantos marcados`}
                </p>
                <div className="draw-actions">
                  <button className="btn ghost" onClick={() => setDrawing(null)}>Cancelar</button>
                  {drawing.length > 0 && <button className="btn ghost" onClick={() => setDrawing(drawing.slice(0, -1))}>Desfazer</button>}
                  <button className="btn" disabled={drawing.length < 3 || criarAreaMutacao.isPending} onClick={terminarMarcar}>
                    {criarAreaMutacao.isPending ? 'Salvando…' : 'Pronto'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {municipio && !drawing && (
            <div className="mark-bar" data-tour="marcar">
              <button className="mark-btn" onClick={comecarMarcar}>✏️ Marcar minha área no mapa</button>
              <span>Opcional. Serve para guardar o que foi plantado em cada canteiro ou roça.</span>
            </div>
          )}

          {areasConsulta.isError && (
            <p className="hint">Não foi possível carregar as áreas salvas. Confira a internet e recarregue a página.</p>
          )}

          {areas.length > 0 && (
            <div className="area-bar">
              <span>Ver sugestão para:</span>
              <button className={`tab ${area === null ? 'active' : ''}`} onClick={() => selecionarArea(null)}>🏙️ Cidade toda</button>
              {areas.map((cadaArea) => (
                <button key={cadaArea.id} className={`tab ${cadaArea.id === area?.id ? 'active' : ''}`} onClick={() => selecionarArea(cadaArea.id)}>
                  📍 {cadaArea.nome} · {formatarNumero(cadaArea.areaEmHectares, 1)} hectares
                </button>
              ))}
              {area && <button className="link-danger" onClick={() => apagarArea(area.id)}>Apagar {area.nome}</button>}
            </div>
          )}
        </section>

        <div className="cards">
          {catalogoConsulta.isError ? (
            <section className="card step-off">
              <EmptyState icon="📡" title="Não foi possível carregar as plantas" text="Confira a internet e tente de novo." />
              <button className="btn full" onClick={() => catalogoConsulta.refetch()}>Tentar de novo</button>
            </section>
          ) : aguardandoCatalogo ? (
            <section className="card step-off">
              <EmptyState icon="🌱" title="Carregando as plantas…" text="É só um instante." />
            </section>
          ) : (
            <>
              {/* ===== Passo 2 ===== */}
              <PlantouCard key={area?.id ?? 'cidade'} catalogo={catalogo ?? []} regiao={municipio ? regiao : null}
                historico={historico} onChange={mudarHistorico} ondeLabel={ondeLabel} />
              {/* ===== Passo 3 ===== */}
              <SugestoesCard entrada={entrada} umidade={umidade ?? null} mesAtual={MES_ATUAL}
                onMes={setMes} onColherRapido={setColherRapido} />
            </>
          )}
        </div>
      </main>

      <Ajuda open={ajuda} onClose={() => setAjuda(false)} onTour={() => setTour(true)} />
      {tour && <Tour passos={PASSOS_TOUR} onFim={() => setTour(false)} />}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
