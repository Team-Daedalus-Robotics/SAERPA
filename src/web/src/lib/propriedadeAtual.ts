import type { Municipio } from '../types';
import { gravarArmazenado, lerArmazenado, removerArmazenado } from './armazenamento';

const CHAVE = 'saerpa:propriedade-atual';
const CHAVE_ANTIGA_DA_CIDADE = (codigoIbge: number) => `saerpa:propriedade:${codigoIbge}`;

/** A única propriedade do navegador: a última cidade escolhida e, depois da primeira área, o id dela no servidor. */
export interface PropriedadeAtual {
  uf: string;
  municipio: Municipio;
  propriedadeId: number | null;
}

export function lerPropriedadeAtual(): PropriedadeAtual | null {
  const texto = lerArmazenado(CHAVE);
  if (texto === null) return null;
  try {
    const valor = JSON.parse(texto) as PropriedadeAtual;
    const valida =
      typeof valor.uf === 'string' &&
      Number.isInteger(valor.municipio?.codigoIbge) &&
      typeof valor.municipio.nome === 'string' &&
      Number.isFinite(valor.municipio.lat) &&
      Number.isFinite(valor.municipio.lng) &&
      (valor.propriedadeId === null || Number.isInteger(valor.propriedadeId));
    return valida ? valor : null;
  } catch {
    return null;
  }
}

export function gravarPropriedadeAtual(propriedade: PropriedadeAtual): void {
  gravarArmazenado(CHAVE, JSON.stringify(propriedade));
}

export function removerPropriedadeAtual(): void {
  removerArmazenado(CHAVE);
}

/** Id da propriedade da cidade. Quem já usava a versão antiga (uma propriedade por cidade) mantém as áreas da cidade que abrir. */
export function propriedadeIdDaCidade(codigoIbge: number): number | null {
  const atual = lerPropriedadeAtual();
  if (atual !== null) return atual.municipio.codigoIbge === codigoIbge ? atual.propriedadeId : null;

  const texto = lerArmazenado(CHAVE_ANTIGA_DA_CIDADE(codigoIbge));
  const identificador = texto === null ? NaN : Number(texto);
  return Number.isInteger(identificador) ? identificador : null;
}

export function esquecerPropriedadeAntigaDaCidade(codigoIbge: number): void {
  removerArmazenado(CHAVE_ANTIGA_DA_CIDADE(codigoIbge));
}
