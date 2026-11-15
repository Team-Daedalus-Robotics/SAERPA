import { requisitar } from './clienteApi';

export type OrigemDaMedida = 'sensor' | 'satellite_hourly' | 'satellite_daily';

interface AnaliseDaApi {
  id: number;
  question_id: string | null;
  type: string;
  question: string | null;
  model_name: string | null;
  answer: string | null;
  choice: string | null;
  score: number | null;
  confidence: number | null;
  options: { label: string; description: string | null; probability: number | null; chosen: boolean }[];
  measures: {
    origin: OrigemDaMedida;
    measure_type: string | null;
    sensor_name: string | null;
    measurement_unit: string | null;
    latest_value: number | null;
    average_value: number | null;
    minimum_value: number | null;
    maximum_value: number | null;
    reading_count: number;
    latest_at: string | null;
  }[];
  target_crop_name: string | null;
  region: string | null;
  plantings: { crop_name: string; field_name: string | null; planting_date: string | null; still_planted: boolean }[];
  created_at: string | null;
}

export interface OpcaoDaAnalise {
  rotulo: string;
  descricao: string | null;
  probabilidade: number | null;
  escolhida: boolean;
}

export interface MedidaUsada {
  origem: OrigemDaMedida;
  tipo: string | null;
  nomeDoSensor: string | null;
  unidade: string | null;
  ultimoValor: number | null;
  media: number | null;
  minimo: number | null;
  maximo: number | null;
  leituras: number;
  ultimaLeituraEm: string | null;
}

export interface PlantioConsiderado {
  cultura: string;
  area: string | null;
  plantadoEm: string | null;
  aindaPlantado: boolean;
}

/** Uma decisão gravada pelo suggestion_worker na tabela `recommendation` */
export interface Analise {
  id: number;
  assunto: string;
  /** 'score' = nota numa escala de níveis; 'choice' = escolha entre opções */
  tipo: string;
  pergunta: string | null;
  modelo: string | null;
  resposta: string | null;
  nota: number | null;
  certeza: number | null;
  opcoes: OpcaoDaAnalise[];
  medidas: MedidaUsada[];
  culturaAlvo: string | null;
  regiao: string | null;
  plantios: PlantioConsiderado[];
  criadaEm: string | null;
}

function converterAnalise(analise: AnaliseDaApi): Analise {
  return {
    id: analise.id,
    assunto: analise.question_id ?? analise.type,
    tipo: analise.type,
    pergunta: analise.question,
    modelo: analise.model_name,
    resposta: analise.answer,
    nota: analise.score,
    certeza: analise.confidence,
    opcoes: analise.options.map((opcao) => ({
      rotulo: opcao.label, descricao: opcao.description, probabilidade: opcao.probability, escolhida: opcao.chosen,
    })),
    medidas: analise.measures.map((medida) => ({
      origem: medida.origin,
      tipo: medida.measure_type,
      nomeDoSensor: medida.sensor_name,
      unidade: medida.measurement_unit,
      ultimoValor: medida.latest_value,
      media: medida.average_value,
      minimo: medida.minimum_value,
      maximo: medida.maximum_value,
      leituras: medida.reading_count,
      ultimaLeituraEm: medida.latest_at,
    })),
    culturaAlvo: analise.target_crop_name,
    regiao: analise.region,
    plantios: analise.plantings.map((plantio) => ({
      cultura: plantio.crop_name, area: plantio.field_name, plantadoEm: plantio.planting_date, aindaPlantado: plantio.still_planted,
    })),
    criadaEm: analise.created_at,
  };
}

/** Últimas análises automáticas (irrigação, rotação…) com as medidas que cada uma usou */
export async function buscarAnalises(limite = 10): Promise<Analise[]> {
  const analises = await requisitar<AnaliseDaApi[]>('GET', `/api/recommendations?limit=${limite}`);
  return analises.map(converterAnalise);
}
