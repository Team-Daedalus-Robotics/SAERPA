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

const criarClasse = (familia: string, grupo: Grupo, emoji: string): Classe => ({ familia, grupo, emoji });

export const CLASSIFICACAO: Record<string, Classe> = {
  // Cucurbitáceas (abóboras, pepino, melancia…)
  abobora:               criarClasse('Cucurbitáceas', 'fruto', '🎃'),
  abobrinha:             criarClasse('Cucurbitáceas', 'fruto', '🥒'),
  chuchu:                criarClasse('Cucurbitáceas', 'fruto', '🥒'),
  maxixe:                criarClasse('Cucurbitáceas', 'fruto', '🥒'),
  melancia:              criarClasse('Cucurbitáceas', 'fruto', '🍉'),
  melao:                 criarClasse('Cucurbitáceas', 'fruto', '🍈'),
  moranga:               criarClasse('Cucurbitáceas', 'fruto', '🎃'),
  pepino:                criarClasse('Cucurbitáceas', 'fruto', '🥒'),

  // Solanáceas (tomate, pimentão, batata…)
  batata:                criarClasse('Solanáceas', 'raiz', '🥔'),
  berinjela:             criarClasse('Solanáceas', 'fruto', '🍆'),
  jilo:                  criarClasse('Solanáceas', 'fruto', '🟢'),
  pimenta:               criarClasse('Solanáceas', 'fruto', '🌶️'),
  pimentao:              criarClasse('Solanáceas', 'fruto', '🫑'),
  'tomate-mesa':         criarClasse('Solanáceas', 'fruto', '🍅'),
  'tomate-industria':    criarClasse('Solanáceas', 'fruto', '🍅'),

  // Brássicas (couve, repolho, rúcula…)
  agriao:                criarClasse('Brássicas', 'folha', '🌿'),
  'brocolis-de-inverno': criarClasse('Brássicas', 'folha', '🥦'),
  'brocolis-de-verao':   criarClasse('Brássicas', 'folha', '🥦'),
  couve:                 criarClasse('Brássicas', 'folha', '🥬'),
  'couve-chinesa':       criarClasse('Brássicas', 'folha', '🥬'),
  'couve-flor-de-inverno': criarClasse('Brássicas', 'folha', '🥦'),
  'couve-flor-de-verao': criarClasse('Brássicas', 'folha', '🥦'),
  mostarda:              criarClasse('Brássicas', 'folha', '🥬'),
  nabo:                  criarClasse('Brássicas', 'raiz', '🥕'),
  rabanete:              criarClasse('Brássicas', 'raiz', '🔴'),
  'repolho-de-inverno':  criarClasse('Brássicas', 'folha', '🥬'),
  'repolho-de-verao':    criarClasse('Brássicas', 'folha', '🥬'),
  rucula:                criarClasse('Brássicas', 'folha', '🌿'),

  // Asteráceas (alface, chicória…)
  alcachofra:            criarClasse('Asteráceas', 'fruto', '🌼'),
  'alface-de-inverno':   criarClasse('Asteráceas', 'folha', '🥬'),
  'alface-de-verao':     criarClasse('Asteráceas', 'folha', '🥬'),
  almeirao:              criarClasse('Asteráceas', 'folha', '🥬'),
  chicoria:              criarClasse('Asteráceas', 'folha', '🥬'),

  // Amarantáceas (beterraba, acelga, espinafre)
  acelga:                criarClasse('Amarantáceas', 'folha', '🥬'),
  beterraba:             criarClasse('Amarantáceas', 'raiz', '🟣'),
  espinafre:             criarClasse('Amarantáceas', 'folha', '🍃'),

  // Aliáceas (alho, cebola…)
  alho:                  criarClasse('Aliáceas', 'raiz', '🧄'),
  'alho-porro':          criarClasse('Aliáceas', 'folha', '🧅'),
  cebola:                criarClasse('Aliáceas', 'raiz', '🧅'),
  cebolinha:             criarClasse('Aliáceas', 'folha', '🌱'),

  // Apiáceas (cenoura, salsa, coentro)
  'cenoura-de-inverno':  criarClasse('Apiáceas', 'raiz', '🥕'),
  'cenoura-de-verao':    criarClasse('Apiáceas', 'raiz', '🥕'),
  coentro:               criarClasse('Apiáceas', 'folha', '🌿'),
  'mandioquinha-salsa':  criarClasse('Apiáceas', 'raiz', '🥕'),
  salsa:                 criarClasse('Apiáceas', 'folha', '🌿'),

  // Leguminosas (devolvem nitrogênio ao solo)
  'ervilha-grao':        criarClasse('Leguminosas', 'leguminosa', '🫛'),
  'ervilha-torta':       criarClasse('Leguminosas', 'leguminosa', '🫛'),
  'feijao-vagem':        criarClasse('Leguminosas', 'leguminosa', '🫛'),

  // Aráceas (inhame, taioba, taro)
  inhame:                criarClasse('Aráceas', 'raiz', '🍠'),
  taioba:                criarClasse('Aráceas', 'folha', '🍃'),
  taro:                  criarClasse('Aráceas', 'raiz', '🍠'),

  // Outras famílias
  'batata-doce':         criarClasse('Convolvuláceas', 'raiz', '🍠'),
  bertalha:              criarClasse('Baseláceas', 'folha', '🍃'),
  gengibre:              criarClasse('Zingiberáceas', 'raiz', '🫚'),
  'milho-verde':         criarClasse('Gramíneas', 'fruto', '🌽'),
  morango:               criarClasse('Rosáceas', 'fruto', '🍓'),
  quiabo:                criarClasse('Malváceas', 'fruto', '🟩'),
};
