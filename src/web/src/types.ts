export type LatLng = [number, number];

export type Regiao = 'Sul' | 'Sudeste' | 'Nordeste' | 'Centro-Oeste' | 'Norte';

/** Parte da planta que se colhe — base da rotação de horta */
export type Grupo = 'folha' | 'fruto' | 'raiz' | 'leguminosa';

/** Uma linha da tabela Embrapa (src/data/hortalicas.json) + classificação do time */
export interface Hortalica {
  id: string;
  nome: string;
  /** meses (1–12) bons para plantar em cada região; [] = inadequado; ausente = sem dado */
  epocas: Partial<Record<Regiao, number[]>>;
  espacamentoCm: { linhas: number; plantas: number };
  tipoPlantio: string;
  /** dias do plantio até a colheita [mínimo, máximo] */
  colheitaDias: [number, number];
  producaoM2: string | null;
  fonte: 'Brasil' | 'Região sul';
  familia: string;
  grupo: Grupo;
  emoji: string;
}

export interface Estado {
  uf: string;
  nome: string;
  regiao: string;
  lat: number;
  lng: number;
}

export interface Municipio {
  nome: string;
  lat: number;
  lng: number;
  codigoIbge: number;
}

/** O que foi plantado por último numa área. null = primeira vez / não sabe */
export interface Historico {
  ultima: string | null;
  anteriores: string[];
  /** true quando o usuário já respondeu (inclusive "nada / não sei") */
  respondeu: boolean;
}

export interface Area {
  id: number;
  nome: string;
  coords: LatLng[];
  center: LatLng;
  areaHa: number;
  historico: Historico;
}

export interface MoisturePoint {
  date: string;
  value: number;
}

export interface MoistureStats {
  mean: number;
  series: MoisturePoint[];
}
