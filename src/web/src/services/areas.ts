import { centroid } from '../lib/geo';
import { gravarPropriedadeAtual, lerPropriedadeAtual, propriedadeIdDaCidade, type PropriedadeAtual } from '../lib/propriedadeAtual';
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

/** Cada navegador tem uma só propriedade (a última cidade escolhida); ela só é criada no servidor ao marcar a primeira área. */
async function criarPropriedade(municipio: Municipio): Promise<number> {
  const propriedade = await requisitar<PropriedadeDaApi>('POST', '/api/properties', {
    name: municipio.nome,
    lat: municipio.lat,
    lng: municipio.lng,
  });
  guardarIdDaPropriedade(municipio.codigoIbge, propriedade.id);
  return propriedade.id;
}

function guardarIdDaPropriedade(codigoIbge: number, propriedadeId: number | null): void {
  const atual = lerPropriedadeAtual();
  if (atual !== null && atual.municipio.codigoIbge === codigoIbge) gravarPropriedadeAtual({ ...atual, propriedadeId });
}

/** Exclui de verdade (no servidor) a propriedade antiga, com áreas e histórico, e passa a usar a nova cidade. */
export async function trocarDePropriedade(nova: { uf: string; municipio: Municipio }): Promise<PropriedadeAtual> {
  const antiga = lerPropriedadeAtual();
  if (antiga?.propriedadeId != null) {
    try {
      await requisitar<void>('DELETE', `/api/properties/${antiga.propriedadeId}`);
    } catch (erro) {
      if (!ehNaoEncontrado(erro)) throw erro;
    }
  }
  const atual: PropriedadeAtual = { uf: nova.uf, municipio: nova.municipio, propriedadeId: null };
  gravarPropriedadeAtual(atual);
  return atual;
}

export async function listarAreas(municipio: Municipio): Promise<Area[]> {
  const propriedadeId = propriedadeIdDaCidade(municipio.codigoIbge);
  if (propriedadeId === null) return [];

  try {
    const areas = await requisitar<AreaDaApi[]>('GET', `/api/properties/${propriedadeId}/fields`);
    return areas.map(converterArea);
  } catch (erro) {
    if (!ehNaoEncontrado(erro)) throw erro;
    guardarIdDaPropriedade(municipio.codigoIbge, null);
    return [];
  }
}

export async function criarArea(municipio: Municipio, nome: string, coordenadas: LatLng[]): Promise<Area> {
  const corpo = { name: nome, coordinates: coordenadas.map(([lat, lng]) => ({ lat, lng })) };
  const propriedadeSalva = propriedadeIdDaCidade(municipio.codigoIbge);

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

export async function renomearArea(areaId: number, nome: string): Promise<Area> {
  return converterArea(await requisitar<AreaDaApi>('PATCH', `/api/fields/${areaId}`, { name: nome }));
}
