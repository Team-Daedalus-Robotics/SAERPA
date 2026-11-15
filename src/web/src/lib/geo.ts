import type { LatLng } from '../types';

/** Área de um polígono em hectares (aproximação plana — ok para talhões) */
export function areaEmHectares(coordenadas: LatLng[]): number {
  const latitudeMedia = coordenadas.reduce((soma, coordenada) => soma + coordenada[0], 0) / coordenadas.length;
  const metrosPorGrauDeLatitude = 111320;
  const metrosPorGrauDeLongitude = 111320 * Math.cos((latitudeMedia * Math.PI) / 180);
  let somaDosProdutosCruzados = 0;
  for (let indice = 0; indice < coordenadas.length; indice++) {
    const [latitudeAtual, longitudeAtual] = coordenadas[indice];
    const [latitudeSeguinte, longitudeSeguinte] = coordenadas[(indice + 1) % coordenadas.length];
    somaDosProdutosCruzados +=
      longitudeAtual * metrosPorGrauDeLongitude * (latitudeSeguinte * metrosPorGrauDeLatitude) -
      longitudeSeguinte * metrosPorGrauDeLongitude * (latitudeAtual * metrosPorGrauDeLatitude);
  }
  return Math.abs(somaDosProdutosCruzados / 2) / 10000;
}

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
