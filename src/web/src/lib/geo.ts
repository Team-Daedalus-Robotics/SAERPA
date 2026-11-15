import type { LatLng } from '../types';

/** Área de um polígono em hectares (aproximação plana — ok para talhões) */
export function areaHa(coords: LatLng[]): number {
  const lat0 = coords.reduce((a, c) => a + c[0], 0) / coords.length;
  const mLat = 111320;
  const mLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  let s = 0;
  for (let i = 0; i < coords.length; i++) {
    const [y1, x1] = coords[i];
    const [y2, x2] = coords[(i + 1) % coords.length];
    s += x1 * mLng * (y2 * mLat) - x2 * mLng * (y1 * mLat);
  }
  return Math.abs(s / 2) / 10000;
}

export function centroid(coords: LatLng[]): LatLng {
  return [
    coords.reduce((a, c) => a + c[0], 0) / coords.length,
    coords.reduce((a, c) => a + c[1], 0) / coords.length,
  ];
}

export const fmt = (n: number, d = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Limites aproximados do Brasil (para a visão inicial do mapa) */
export const BRAZIL_BOUNDS: [LatLng, LatLng] = [[-33.8, -74.0], [5.3, -34.7]];
