import type { Hortalica, Regiao } from '../types';

export const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function indexarPorId(catalogo: Hortalica[]): Record<string, Hortalica> {
  return Object.fromEntries(catalogo.map((hortalica) => [hortalica.id, hortalica]));
}

/** Hortaliças que a tabela recomenda em ALGUM mês na região */
export function daRegiao(catalogo: Hortalica[], regiao: Regiao): Hortalica[] {
  return catalogo.filter((hortalica) => (hortalica.epocas[regiao]?.length ?? 0) > 0);
}
