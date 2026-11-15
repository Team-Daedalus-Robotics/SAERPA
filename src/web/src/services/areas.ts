import { centroid } from '../lib/geo';
import { gravarArmazenado, lerArmazenado, removerArmazenado } from '../lib/armazenamento';
import type { Area, Historico, LatLng, Municipio } from '../types';
import { ErroDaApi, requisitar } from './clienteApi';

interface AreaDaApi {
  id: number;
  property_id: number;
  name: string | null;
  coordinates: { lat: number; lng: number }[];
  area_in_hectares: number;
  history: { last_crop_slug: string | null; previous_crop_slugs: string[] };
}

interface PropriedadeDaApi {
  id: number;
}

const chaveDaPropriedade = (codigoIbge: number) => `saerpa:propriedade:${codigoIbge}`;

function lerPropriedadeSalva(codigoIbge: number): number | null {
  const texto = lerArmazenado(chaveDaPropriedade(codigoIbge));
  const identificador = texto === null ? NaN : Number(texto);
  return Number.isInteger(identificador) ? identificador : null;
}

function converterArea(area: AreaDaApi): Area {
  const coordenadas: LatLng[] = area.coordinates.map((ponto) => [ponto.lat, ponto.lng]);
  return {
    id: area.id,
    nome: area.name ?? `Área ${area.id}`,
    coordenadas,
    center: centroid(coordenadas),
    areaEmHectares: area.area_in_hectares,
    historico: {
      ultima: area.history.last_crop_slug,
      anteriores: area.history.previous_crop_slugs,
      respondeu: area.history.last_crop_slug !== null,
    },
  };
}

function ehNaoEncontrado(erro: unknown): boolean {
  return erro instanceof ErroDaApi && erro.status === 404;
}

/** Cada navegador guarda o id da sua propriedade por cidade; a propriedade só é criada ao marcar a primeira área. */
async function criarPropriedade(municipio: Municipio): Promise<number> {
  const propriedade = await requisitar<PropriedadeDaApi>('POST', '/api/properties', {
    name: municipio.nome,
    lat: municipio.lat,
    lng: municipio.lng,
  });
  gravarArmazenado(chaveDaPropriedade(municipio.codigoIbge), String(propriedade.id));
  return propriedade.id;
}

export async function listarAreas(municipio: Municipio): Promise<Area[]> {
  const propriedadeId = lerPropriedadeSalva(municipio.codigoIbge);
  if (propriedadeId === null) return [];

  try {
    const areas = await requisitar<AreaDaApi[]>('GET', `/api/properties/${propriedadeId}/fields`);
    return areas.map(converterArea);
  } catch (erro) {
    if (!ehNaoEncontrado(erro)) throw erro;
    removerArmazenado(chaveDaPropriedade(municipio.codigoIbge));
    return [];
  }
}

export async function criarArea(municipio: Municipio, nome: string, coordenadas: LatLng[]): Promise<Area> {
  const corpo = { name: nome, coordinates: coordenadas.map(([lat, lng]) => ({ lat, lng })) };
  const propriedadeSalva = lerPropriedadeSalva(municipio.codigoIbge);

  if (propriedadeSalva !== null) {
    try {
      return converterArea(await requisitar<AreaDaApi>('POST', `/api/properties/${propriedadeSalva}/fields`, corpo));
    } catch (erro) {
      if (!ehNaoEncontrado(erro)) throw erro;
    }
  }

  const propriedadeId = await criarPropriedade(municipio);
  return converterArea(await requisitar<AreaDaApi>('POST', `/api/properties/${propriedadeId}/fields`, corpo));
}

export async function apagarArea(areaId: number): Promise<void> {
  await requisitar<void>('DELETE', `/api/fields/${areaId}`);
}

export async function salvarHistorico(areaId: number, historico: Historico): Promise<Area> {
  const area = await requisitar<AreaDaApi>('PUT', `/api/fields/${areaId}/history`, {
    last_crop_slug: historico.ultima,
    previous_crop_slugs: historico.anteriores,
  });
  return converterArea(area);
}
