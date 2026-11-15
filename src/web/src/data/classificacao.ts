/* =========================================================================
 * Grupos de hortaliças para a ROTAÇÃO
 * -------------------------------------------------------------------------
 * A família botânica, o grupo e o emoji de cada hortaliça vêm do banco
 * (tabela crop, via GET /api/crops), definidos pelo time em
 * src/shared/data/crop_classification.json. Revisar com agronomia.
 *
 *  - Plantas da mesma família compartilham pragas e doenças, então não devem
 *    ser plantadas em seguida no mesmo lugar.
 *  - Rotação clássica de horta: folha → fruto → raiz → leguminosa → folha …
 *    Folhas gastam muito nitrogênio; frutos gastam fósforo/potássio; raízes
 *    exploram camadas mais fundas; leguminosas devolvem nitrogênio ao solo.
 * ========================================================================= */
import type { Grupo } from '../types';

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
