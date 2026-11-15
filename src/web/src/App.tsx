import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LocationPicker from './components/LocationPicker';
import MapView, { SMAP_ZOOM_MINIMO, type BaseLayer, type MapTarget } from './components/MapView';
import PlantouCard from './components/PlantouCard';
import SugestoesCard from './components/SugestoesCard';
import Ajuda from './components/Ajuda';
import Tour, { PASSOS_TOUR } from './components/Tour';
import { Icon, StepTitle } from './components/ui';
import { areaEmHectares, centroid, formatarNumero } from './lib/geo';
import type { Entrada } from './services/rotacao';
import { USE_MOCK, fieldStatistics, pointStatistics } from './services/smap';
import type { Area, Estado, Historico, LatLng, MoistureStatistics, Municipio, Regiao } from './types';

/** Zoom mínimo para marcar uma área com precisão */
const ZOOM_MINIMO_PARA_DESENHAR = 13;
const MES_ATUAL = new Date().getMonth() + 1;
const HISTORICO_VAZIO: Historico = { ultima: null, anteriores: [], respondeu: false };

export default function App() {
  // ---- passo 1: onde ----
  const [estado, setEstado] = useState<Estado | null>(null);
  const [municipio, setMunicipio] = useState<Municipio | null>(null);
  const [target, setTarget] = useState<MapTarget>({ kind: 'brasil' });

  // ---- mapa ----
  const [base, setBase] = useState<BaseLayer>('satelite');
  const [showSmap, setShowSmap] = useState(true);
  const [zoom, setZoom] = useState(4);
  const [drawing, setDrawing] = useState<LatLng[] | null>(null);

  // ---- áreas marcadas pelo usuário (opcional) ----
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // ---- passo 2: histórico da cidade toda (quando nenhuma área está marcada) ----
  const [historicoDaCidade, setHistoricoDaCidade] = useState<Historico>(HISTORICO_VAZIO);

  // ---- passo 3 ----
  const [mes, setMes] = useState(MES_ATUAL);
  const [colherRapido, setColherRapido] = useState(false);
  const [umidade, setUmidade] = useState<MoistureStatistics | null>(null);

  // ---- UI ----
  const [ajuda, setAjuda] = useState(false);
  const [tour, setTour] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((mensagem: string) => {
    setToast(mensagem);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const area = areas.find((candidata) => candidata.id === selectedId) ?? null;
  const historico = area ? area.historico : historicoDaCidade;
  const regiao = (estado?.regiao ?? null) as Regiao | null;

  function escolherEstado(estadoEscolhido: Estado | null) {
    setEstado(estadoEscolhido);
    setMunicipio(null);
    setSelectedId(null);
    setDrawing(null);
    setTarget(estadoEscolhido ? { kind: 'point', center: [estadoEscolhido.lat, estadoEscolhido.lng], zoom: 6 } : { kind: 'brasil' });
  }
  function escolherMunicipio(municipioEscolhido: Municipio | null) {
    setMunicipio(municipioEscolhido);
    setSelectedId(null);
    if (municipioEscolhido) setTarget({ kind: 'point', center: [municipioEscolhido.lat, municipioEscolhido.lng], zoom: 13 });
  }

  // ---- umidade da terra (NASA SMAP) da área ou da cidade ----
  useEffect(() => {
    let alive = true;
    setUmidade(null);
    const consulta = area ? fieldStatistics(area.coordenadas, area.center)
      : municipio ? pointStatistics([municipio.lat, municipio.lng]) : null;
    consulta?.then((estatisticas) => alive && setUmidade(estatisticas));
    return () => { alive = false; };
  }, [area?.id, municipio]); // eslint-disable-line react-hooks/exhaustive-deps

  function mudarHistorico(novoHistorico: Historico) {
    if (area) setAreas((areasAtuais) => areasAtuais.map((candidata) => (candidata.id === area.id ? { ...candidata, historico: novoHistorico } : candidata)));
    else setHistoricoDaCidade(novoHistorico);
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
    const id = (areas.at(-1)?.id ?? 0) + 1;
    const novaArea: Area = {
      id, nome: `Área ${id}`, coordenadas: drawing, center: centroid(drawing), areaEmHectares: areaEmHectares(drawing),
      historico: { ...HISTORICO_VAZIO },
    };
    setAreas((areasAtuais) => [...areasAtuais, novaArea]);
    setSelectedId(id);
    setDrawing(null);
    showToast(`${novaArea.nome} marcada (${formatarNumero(novaArea.areaEmHectares, 2)} hectares). Agora diga o que plantou nela.`);
  }
  function apagarArea(id: number) {
    setAreas((areasAtuais) => areasAtuais.filter((candidata) => candidata.id !== id));
    setSelectedId(null);
  }

  const entrada: Entrada | null = useMemo(
    () => (regiao && municipio ? { historico, regiao, mes, colherRapido } : null),
    [regiao, municipio, historico, mes, colherRapido],
  );

  const ondeLabel = area ? area.nome : municipio ? `${municipio.nome} (cidade toda)` : '';

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
              base={base} showSmap={showSmap} target={target} municipio={municipio}
              areas={areas} selectedId={selectedId} drawing={drawing}
              onSelectArea={setSelectedId}
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
                  <button className="btn" disabled={drawing.length < 3} onClick={terminarMarcar}>Pronto</button>
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

          {areas.length > 0 && (
            <div className="area-bar">
              <span>Ver sugestão para:</span>
              <button className={`tab ${selectedId === null ? 'active' : ''}`} onClick={() => setSelectedId(null)}>🏙️ Cidade toda</button>
              {areas.map((cadaArea) => (
                <button key={cadaArea.id} className={`tab ${cadaArea.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(cadaArea.id)}>
                  📍 {cadaArea.nome} · {formatarNumero(cadaArea.areaEmHectares, 1)} hectares
                </button>
              ))}
              {area && <button className="link-danger" onClick={() => apagarArea(area.id)}>Apagar {area.nome}</button>}
            </div>
          )}
        </section>

        <div className="cards">
          {/* ===== Passo 2 ===== */}
          <PlantouCard key={area?.id ?? 'cidade'} regiao={municipio ? regiao : null}
            historico={historico} onChange={mudarHistorico} ondeLabel={ondeLabel} />
          {/* ===== Passo 3 ===== */}
          <SugestoesCard entrada={entrada} umidade={umidade} mesAtual={MES_ATUAL}
            onMes={setMes} onColherRapido={setColherRapido} />
        </div>
      </main>

      <Ajuda open={ajuda} onClose={() => setAjuda(false)} onTour={() => setTour(true)} />
      {tour && <Tour passos={PASSOS_TOUR} onFim={() => setTour(false)} />}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
