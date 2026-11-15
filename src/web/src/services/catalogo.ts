import type { Grupo, Hortalica, Regiao } from '../types';
import { requisitar } from './clienteApi';

interface CulturaDaApi {
  slug: string;
  name: string;
  botanical_family: string;
  crop_group: Grupo;
  emoji: string;
  row_spacing_centimeters: number;
  plant_spacing_centimeters: number;
  planting_type: string;
  harvest_days_min: number;
  harvest_days_max: number;
  production_per_square_meter: string | null;
  source: Hortalica['fonte'];
  planting_windows: Partial<Record<Regiao, number[]>>;
}

function converterCultura(cultura: CulturaDaApi): Hortalica {
  return {
    id: cultura.slug,
    nome: cultura.name,
    epocas: cultura.planting_windows,
    espacamentoEmCentimetros: { linhas: cultura.row_spacing_centimeters, plantas: cultura.plant_spacing_centimeters },
    tipoPlantio: cultura.planting_type,
    colheitaDias: [cultura.harvest_days_min, cultura.harvest_days_max],
    producaoPorMetroQuadrado: cultura.production_per_square_meter,
    fonte: cultura.source,
    familia: cultura.botanical_family,
    grupo: cultura.crop_group,
    emoji: cultura.emoji,
  };
}

/** Catálogo de hortaliças (tabela Embrapa + classificação do time), vindo do banco */
export async function buscarCatalogo(): Promise<Hortalica[]> {
  const culturas = await requisitar<CulturaDaApi[]>('GET', '/api/crops');
  return culturas.map(converterCultura);
}
