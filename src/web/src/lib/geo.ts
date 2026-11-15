import type { LatLng } from '../types';

export function centroid(coordenadas: LatLng[]): LatLng {
  return [
    coordenadas.reduce((soma, coordenada) => soma + coordenada[0], 0) / coordenadas.length,
    coordenadas.reduce((soma, coordenada) => soma + coordenada[1], 0) / coordenadas.length,
  ];
}

export const formatarNumero = (numero: number, casasDecimais = 2) =>
  numero.toLocaleString('pt-BR', { minimumFractionDigits: casasDecimais, maximumFractionDigits: casasDecimais });

/** Limites aproximados do Brasil (para a visão inicial do mapa) */
export const BRAZIL_BOUNDS: [LatLng, LatLng] = [[-33.8, -74.0], [5.3, -34.7]];
