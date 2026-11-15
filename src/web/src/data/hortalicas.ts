/* =========================================================================
 * Hortaliças — tabela Embrapa + classificação para rotação
 * -------------------------------------------------------------------------
 * hortalicas.json é GERADO por scripts/import_embrapa.py a partir de
 * data-raw/embrapa-informacoes-gerais-plantio-hortalicas.xlsx
 * (Sisteminha Embrapa — "Informações gerais sobre o plantio de hortaliças";
 *  fonte da planilha: Amaro et al. 2007; Embrapa Hortaliças e Sebrae 2010).
 * Não edite o JSON à mão: corrija o script e rode de novo.
 * ========================================================================= */
import raw from './hortalicas.json';
import { CLASSIFICACAO } from './classificacao';
import type { Hortalica, Regiao } from '../types';

type RawRow = Omit<Hortalica, 'familia' | 'grupo' | 'emoji'>;

export const HORTALICAS: Hortalica[] = (raw as unknown as RawRow[]).map((h) => {
  const c = CLASSIFICACAO[h.id];
  if (!c) throw new Error(`Hortaliça sem classificação em classificacao.ts: ${h.id}`);
  return { ...h, ...c };
});

export const POR_ID: Record<string, Hortalica> = Object.fromEntries(HORTALICAS.map((h) => [h.id, h]));

/** Hortaliças que a tabela recomenda em ALGUM mês na região */
export function daRegiao(regiao: Regiao): Hortalica[] {
  return HORTALICAS.filter((h) => (h.epocas[regiao]?.length ?? 0) > 0);
}

export const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
