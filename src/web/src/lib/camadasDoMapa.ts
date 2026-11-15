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
    maxZoom: 18,
  },
  ruas: {
    url: import.meta.env.VITE_URL_DAS_RUAS ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
};

/** Zoom mais fundo que o mapa salvo guarda; sem internet, a imagem desse nível é esticada */
export const ZOOM_MAXIMO_SALVO = 16;
