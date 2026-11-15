/** A Esri só tem foto de satélite até por volta do zoom 16 em áreas rurais; acima disso devolve "Map data not yet available" */
export const ZOOM_MAXIMO_DO_MAPA = 16;

export type CamadaBase = 'satelite' | 'ruas';

export interface CamadaDoMapa {
  url: string;
  attribution: string;
  maxZoom: number;
}

export const CAMADAS_DO_MAPA: Record<CamadaBase, CamadaDoMapa> = {
  satelite: {
    url: import.meta.env.VITE_URL_DO_SATELITE ?? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri',
    maxZoom: ZOOM_MAXIMO_DO_MAPA,
  },
  ruas: {
    url: import.meta.env.VITE_URL_DAS_RUAS ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: ZOOM_MAXIMO_DO_MAPA,
  },
};

export const ZOOM_MAXIMO_SALVO = ZOOM_MAXIMO_DO_MAPA;
