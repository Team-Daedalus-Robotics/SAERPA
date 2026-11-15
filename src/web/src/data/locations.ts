/* =========================================================================
 * Estados e municípios do Brasil (IBGE) com coordenadas da sede municipal.
 * Fonte: github.com/kelvins/municipios-brasileiros (dados IBGE, licença MIT).
 * Os municípios são carregados sob demanda (arquivo separado no build).
 * ========================================================================= */
import estadosJson from './estados.json';
import type { Estado, Municipio } from '../types';

export const ESTADOS: Estado[] = estadosJson;

type Raw = Record<string, [string, number, number, number][]>;
let cache: Raw | null = null;

export async function loadMunicipios(uf: string): Promise<Municipio[]> {
  if (!cache) cache = (await import('./municipios.json')).default as unknown as Raw;
  return (cache[uf] ?? []).map(([nome, lat, lng, codigoIbge]) => ({ nome, lat, lng, codigoIbge }));
}
