/* =========================================================================
 * Classificação das hortaliças para a ROTAÇÃO
 * -------------------------------------------------------------------------
 * A tabela da Embrapa (hortalicas.json) não traz regras de rotação.
 * Esta classificação foi ADICIONADA PELO TIME com base em botânica básica:
 *
 *  - familia: família botânica. Plantas da mesma família compartilham pragas
 *    e doenças, então não devem ser plantadas em seguida no mesmo lugar.
 *  - grupo:   parte da planta que se colhe. Rotação clássica de horta:
 *               folha → fruto → raiz → leguminosa → folha …
 *             Folhas gastam muito nitrogênio; frutos gastam fósforo/potássio;
 *             raízes exploram camadas mais fundas; leguminosas devolvem
 *             nitrogênio ao solo.
 *
 * Revisar com alguém de agronomia antes de usar em produção.
 * ========================================================================= */
import type { Grupo } from '../types';

export interface Classe {
  familia: string;
  grupo: Grupo;
  emoji: string;
}

export const GRUPOS: Record<Grupo, { nome: string; emoji: string; frase: string }> = {
  folha:      { nome: 'Folhas',      emoji: '🥬', frase: 'de folha' },
  fruto:      { nome: 'Frutos',      emoji: '🍅', frase: 'de fruto' },
  raiz:       { nome: 'Raízes',      emoji: '🥕', frase: 'de raiz ou bulbo' },
  leguminosa: { nome: 'Leguminosas', emoji: '🫛', frase: 'leguminosa (vagem)' },
};

/** Ordem da rotação: depois de cada grupo, qual é o ideal */
export const PROXIMO_GRUPO: Record<Grupo, Grupo> = {
  folha: 'fruto',
  fruto: 'raiz',
  raiz: 'leguminosa',
  leguminosa: 'folha',
};

const C = (familia: string, grupo: Grupo, emoji: string): Classe => ({ familia, grupo, emoji });

export const CLASSIFICACAO: Record<string, Classe> = {
  // Cucurbitáceas (abóboras, pepino, melancia…)
  abobora:               C('Cucurbitáceas', 'fruto', '🎃'),
  abobrinha:             C('Cucurbitáceas', 'fruto', '🥒'),
  chuchu:                C('Cucurbitáceas', 'fruto', '🥒'),
  maxixe:                C('Cucurbitáceas', 'fruto', '🥒'),
  melancia:              C('Cucurbitáceas', 'fruto', '🍉'),
  melao:                 C('Cucurbitáceas', 'fruto', '🍈'),
  moranga:               C('Cucurbitáceas', 'fruto', '🎃'),
  pepino:                C('Cucurbitáceas', 'fruto', '🥒'),

  // Solanáceas (tomate, pimentão, batata…)
  batata:                C('Solanáceas', 'raiz', '🥔'),
  berinjela:             C('Solanáceas', 'fruto', '🍆'),
  jilo:                  C('Solanáceas', 'fruto', '🟢'),
  pimenta:               C('Solanáceas', 'fruto', '🌶️'),
  pimentao:              C('Solanáceas', 'fruto', '🫑'),
  'tomate-mesa':         C('Solanáceas', 'fruto', '🍅'),
  'tomate-industria':    C('Solanáceas', 'fruto', '🍅'),

  // Brássicas (couve, repolho, rúcula…)
  agriao:                C('Brássicas', 'folha', '🌿'),
  'brocolis-de-inverno': C('Brássicas', 'folha', '🥦'),
  'brocolis-de-verao':   C('Brássicas', 'folha', '🥦'),
  couve:                 C('Brássicas', 'folha', '🥬'),
  'couve-chinesa':       C('Brássicas', 'folha', '🥬'),
  'couve-flor-de-inverno': C('Brássicas', 'folha', '🥦'),
  'couve-flor-de-verao': C('Brássicas', 'folha', '🥦'),
  mostarda:              C('Brássicas', 'folha', '🥬'),
  nabo:                  C('Brássicas', 'raiz', '🥕'),
  rabanete:              C('Brássicas', 'raiz', '🔴'),
  'repolho-de-inverno':  C('Brássicas', 'folha', '🥬'),
  'repolho-de-verao':    C('Brássicas', 'folha', '🥬'),
  rucula:                C('Brássicas', 'folha', '🌿'),

  // Asteráceas (alface, chicória…)
  alcachofra:            C('Asteráceas', 'fruto', '🌼'),
  'alface-de-inverno':   C('Asteráceas', 'folha', '🥬'),
  'alface-de-verao':     C('Asteráceas', 'folha', '🥬'),
  almeirao:              C('Asteráceas', 'folha', '🥬'),
  chicoria:              C('Asteráceas', 'folha', '🥬'),

  // Amarantáceas (beterraba, acelga, espinafre)
  acelga:                C('Amarantáceas', 'folha', '🥬'),
  beterraba:             C('Amarantáceas', 'raiz', '🟣'),
  espinafre:             C('Amarantáceas', 'folha', '🍃'),

  // Aliáceas (alho, cebola…)
  alho:                  C('Aliáceas', 'raiz', '🧄'),
  'alho-porro':          C('Aliáceas', 'folha', '🧅'),
  cebola:                C('Aliáceas', 'raiz', '🧅'),
  cebolinha:             C('Aliáceas', 'folha', '🌱'),

  // Apiáceas (cenoura, salsa, coentro)
  'cenoura-de-inverno':  C('Apiáceas', 'raiz', '🥕'),
  'cenoura-de-verao':    C('Apiáceas', 'raiz', '🥕'),
  coentro:               C('Apiáceas', 'folha', '🌿'),
  'mandioquinha-salsa':  C('Apiáceas', 'raiz', '🥕'),
  salsa:                 C('Apiáceas', 'folha', '🌿'),

  // Leguminosas (devolvem nitrogênio ao solo)
  'ervilha-grao':        C('Leguminosas', 'leguminosa', '🫛'),
  'ervilha-torta':       C('Leguminosas', 'leguminosa', '🫛'),
  'feijao-vagem':        C('Leguminosas', 'leguminosa', '🫛'),

  // Aráceas (inhame, taioba, taro)
  inhame:                C('Aráceas', 'raiz', '🍠'),
  taioba:                C('Aráceas', 'folha', '🍃'),
  taro:                  C('Aráceas', 'raiz', '🍠'),

  // Outras famílias
  'batata-doce':         C('Convolvuláceas', 'raiz', '🍠'),
  bertalha:              C('Baseláceas', 'folha', '🍃'),
  gengibre:              C('Zingiberáceas', 'raiz', '🫚'),
  'milho-verde':         C('Gramíneas', 'fruto', '🌽'),
  morango:               C('Rosáceas', 'fruto', '🍓'),
  quiabo:                C('Malváceas', 'fruto', '🟩'),
};
