import type { Clima, Indicador, LatLng, PontoDaSerie } from '../types';
import { requisitar } from './clienteApi';

interface PontoDaApi { date: string; value: number }
interface IndicadorDaApi { latest: number; average: number; daily: PontoDaApi[] }
interface ClimaDaApi {
  source: string;
  cell: { latitude: number; longitude: number; south: number; west: number; north: number; east: number };
  updated_through: string;
  soil_moisture_percent: IndicadorDaApi;
  soil_temperature_celsius: IndicadorDaApi;
  air_temperature_celsius: IndicadorDaApi;
  air_humidity_percent: IndicadorDaApi;
  rainfall: {
    last_24_hours_millimeters: number;
    last_7_days_millimeters: number;
    last_30_days_millimeters: number;
    daily: PontoDaApi[];
  };
}

const converterSerie = (pontos: PontoDaApi[]): PontoDaSerie[] => pontos.map((ponto) => ({ data: ponto.date, valor: ponto.value }));
const converterIndicador = (indicador: IndicadorDaApi): Indicador => ({
  atual: indicador.latest,
  media: indicador.average,
  diaria: converterSerie(indicador.daily),
});

interface PendenteDaApi { status: 'pending'; retry_after_seconds: number }

/**
 * Clima real (NASA POWER) do ponto escolhido. A API só lê o que o nasa_event_worker já gravou em `event`;
 * quando a região ainda não foi buscada ela responde "pendente" e esta função devolve null (o app tenta de novo).
 */
export async function buscarClima([latitude, longitude]: LatLng): Promise<Clima | null> {
  const resposta = await requisitar<ClimaDaApi | PendenteDaApi>('GET', `/api/climate?lat=${latitude.toFixed(4)}&lng=${longitude.toFixed(4)}`);
  if ('status' in resposta) return null;
  return {
    fonte: resposta.source,
    celula: {
      latitude: resposta.cell.latitude, longitude: resposta.cell.longitude,
      sul: resposta.cell.south, oeste: resposta.cell.west, norte: resposta.cell.north, leste: resposta.cell.east,
    },
    atualizadoAte: resposta.updated_through,
    umidadeDoSolo: converterIndicador(resposta.soil_moisture_percent),
    temperaturaDoSolo: converterIndicador(resposta.soil_temperature_celsius),
    temperaturaDoAr: converterIndicador(resposta.air_temperature_celsius),
    umidadeDoAr: converterIndicador(resposta.air_humidity_percent),
    chuva: {
      ultimas24Horas: resposta.rainfall.last_24_hours_millimeters,
      ultimos7Dias: resposta.rainfall.last_7_days_millimeters,
      ultimos30Dias: resposta.rainfall.last_30_days_millimeters,
      diaria: converterSerie(resposta.rainfall.daily),
    },
  };
}

export type TomDaUmidade = 'dry' | 'mid' | 'ok' | 'wet';

/** Faixas iguais de 25 pontos da saturação do solo (revisar com agronomia) */
export function classificarUmidadeDoSolo(percentual: number): { rotulo: string; tom: TomDaUmidade } {
  if (percentual < 25) return { rotulo: 'Seco', tom: 'dry' };
  if (percentual < 50) return { rotulo: 'Pouco úmido', tom: 'mid' };
  if (percentual < 75) return { rotulo: 'Adequado', tom: 'ok' };
  return { rotulo: 'Muito úmido', tom: 'wet' };
}

export const COR_DO_TOM: Record<TomDaUmidade, string> = { dry: '#d9772b', mid: '#e8c04a', ok: '#6fb26b', wet: '#2a7bbf' };
