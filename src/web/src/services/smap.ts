/* =========================================================================
 * Serviço de umidade do solo — NASA SMAP
 * -------------------------------------------------------------------------
 * Dataset: NASA_SMAP_SPL3SMP_E_006 (Google Earth Engine)
 *   ee.ImageCollection('NASA/SMAP/SPL3SMP_E/006')
 *   Bandas: soil_moisture_am / soil_moisture_pm (cm³/cm³), grade ~9 km.
 *
 * AGORA: valores SIMULADOS (USE_MOCK = true) para o front funcionar sozinho.
 *
 * Endpoints esperados do back end (trocar USE_MOCK para false):
 *
 *   GET  /api/smap/tiles?start=YYYY-MM-DD&end=YYYY-MM-DD
 *        -> { urlFormat: "https://earthengine.googleapis.com/.../{z}/{x}/{y}" }
 *        servidor: smap.mean().getMapId({ min: 0, max: 0.5, palette: [...] })
 *
 *   POST /api/smap/point   body: { lat, lng, days: 30 }
 *   POST /api/smap/field   body: { geometry: GeoJSON, days: 30 }
 *        -> { mean: 0.27, series: [{ date, value }, ...] }
 *        servidor: reduceRegion({ reducer: ee.Reducer.mean(), geometry, scale: 9000 })
 * ========================================================================= */
import type { LatLng, MoistureStatistics } from '../types';

export const USE_MOCK = true;
const API_BASE = '/api/smap';
export const CELL_SIZE_DEGREES = 0.081; // ~9 km
export const PALETTE = ['#a3542a', '#d98c3f', '#e9c46a', '#8ab17d', '#2a9d8f', '#1d5d7a'];

function noise(lat: number, lng: number, tempo: number): number {
  return (
    Math.sin(lat * 12.9898 + lng * 78.233) * 0.5 +
    Math.sin(lat * 3.1 - lng * 2.7 + tempo * 0.21) * 0.3 +
    Math.cos(lat * 7.3 + lng * 5.1) * 0.2
  );
}

/** Umidade simulada (cm³/cm³), 0,05–0,45 */
function mockValue(lat: number, lng: number, dayOffset = 0): number {
  return Math.max(0.05, Math.min(0.45, 0.25 + noise(lat, lng, dayOffset) * 0.12));
}

export function colorFor(valor: number): string {
  const posicao = Math.max(0, Math.min(0.999, (valor - 0.05) / 0.4));
  return PALETTE[Math.floor(posicao * PALETTE.length)];
}

export function classify(valor: number): { label: string; tone: 'dry' | 'mid' | 'ok' | 'wet' } {
  if (valor < 0.15) return { label: 'Seco', tone: 'dry' };
  if (valor < 0.25) return { label: 'Moderado', tone: 'mid' };
  if (valor < 0.35) return { label: 'Adequado', tone: 'ok' };
  return { label: 'Muito úmido', tone: 'wet' };
}

export interface GridCell {
  bounds: [LatLng, LatLng];
  value: number;
  color: string;
}

/** Células 9 km cobrindo a área visível (só no mock) */
export function gridCells(sul: number, oeste: number, norte: number, leste: number): GridCell[] {
  const cells: GridCell[] = [];
  const inicioSul = Math.floor(sul / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES;
  const inicioOeste = Math.floor(oeste / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES;
  for (let lat = inicioSul; lat < norte; lat += CELL_SIZE_DEGREES) {
    for (let lng = inicioOeste; lng < leste; lng += CELL_SIZE_DEGREES) {
      const valor = mockValue(lat + CELL_SIZE_DEGREES / 2, lng + CELL_SIZE_DEGREES / 2);
      cells.push({
        bounds: [[lat, lng], [lat + CELL_SIZE_DEGREES, lng + CELL_SIZE_DEGREES]],
        value: valor,
        color: colorFor(valor),
      });
    }
  }
  return cells;
}

function mockSeries([lat, lng]: LatLng): MoistureStatistics {
  const series = [];
  const hoje = new Date();
  for (let diasAtras = 29; diasAtras >= 0; diasAtras--) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - diasAtras);
    series.push({ date: data.toISOString().slice(0, 10), value: mockValue(lat, lng, -diasAtras) });
  }
  const mean = series.reduce((soma, ponto) => soma + ponto.value, 0) / series.length;
  return { mean, series };
}

/** Umidade média + série de 30 dias para um ponto (centro da cidade) */
export async function pointStatistics(point: LatLng): Promise<MoistureStatistics> {
  if (USE_MOCK) return mockSeries(point);
  const resposta = await fetch(`${API_BASE}/point`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: point[0], lng: point[1], days: 30 }),
  });
  return resposta.json();
}

/** Umidade média + série de 30 dias para um talhão (polígono) */
export async function fieldStatistics(coordenadas: LatLng[], center: LatLng): Promise<MoistureStatistics> {
  if (USE_MOCK) return mockSeries(center);
  const geometry = {
    type: 'Polygon',
    coordinates: [[...coordenadas, coordenadas[0]].map(([latitude, longitude]) => [longitude, latitude])],
  };
  const resposta = await fetch(`${API_BASE}/field`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geometry, days: 30 }),
  });
  return resposta.json();
}
