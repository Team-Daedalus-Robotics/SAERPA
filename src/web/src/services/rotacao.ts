/* =========================================================================
 * Motor de recomendação — o que plantar depois
 * -------------------------------------------------------------------------
 * Para cada hortaliça da tabela Embrapa que serve para a região:
 *
 *  1. ÉPOCA (tabela Embrapa): está no mês certo para plantar na região?
 *       no mês escolhido ............. +35
 *       começa no mês seguinte ....... +15
 *       mais tarde ................... 0   (vai para "próximos meses")
 *
 *  2. ROTAÇÃO (classificacao.ts): combina com o que foi plantado antes?
 *       mesma família da última ...... EVITAR (pragas e doenças em comum)
 *       grupo ideal (folha→fruto→raiz→leguminosa→folha) ... +45
 *       leguminosa depois de folha/fruto (devolve nitrogênio) +35
 *       outro grupo .................. +25
 *       mesmo grupo .................. +10
 *       família plantada nas 2 safras anteriores ........... −15
 *       primeira vez / não sabe ...... +25 (neutro)
 *
 *  3. COLHER RÁPIDO (opcional): até +20 para ciclos curtos (tabela Embrapa)
 *
 * Nota final de 0 a 100 → "Ótima escolha" (≥70), "Boa escolha" (≥50), "Pode plantar".
 * ========================================================================= */
import { GRUPOS, PROXIMO_GRUPO } from '../data/classificacao';
import { NOMES_MES, POR_ID, daRegiao } from '../data/hortalicas';
import type { Historico, Hortalica, Regiao } from '../types';

export interface Entrada {
  historico: Historico;
  regiao: Regiao;
  /** mês em que vai plantar (1–12) */
  mes: number;
  colherRapido: boolean;
}

export type Nivel = 'otima' | 'boa' | 'ok' | 'evitar';

export interface Motivo {
  tipo: 'bom' | 'ruim' | 'info';
  texto: string;
}

export interface Sugestao {
  h: Hortalica;
  nota: number;
  nivel: Nivel;
  /** pode plantar no mês escolhido */
  agora: boolean;
  /** próximo mês bom para plantar (se não for agora) */
  proximoMes: number | null;
  motivos: Motivo[];
}

export interface Resultado {
  agora: Sugestao[];
  proximosMeses: Sugestao[];
  evitar: Sugestao[];
}

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/** Quantos meses faltam até a janela de plantio (0 = já está na janela) */
function mesesAte(janela: number[], mes: number): number {
  for (let d = 0; d < 12; d++) if (janela.includes(((mes - 1 + d) % 12) + 1)) return d;
  return 99;
}

function avaliar(h: Hortalica, e: Entrada): Sugestao {
  const janela = h.epocas[e.regiao] ?? [];
  const falta = mesesAte(janela, e.mes);
  const motivos: Motivo[] = [];
  let nota = 0;
  let evitar = false;

  // ---- 1. época de plantio (Embrapa) ----
  if (falta === 0) {
    nota += 35;
    motivos.push({ tipo: 'bom', texto: `Época certa para plantar na região ${e.regiao} (tabela Embrapa).` });
  } else {
    if (falta === 1) nota += 15;
    const m = ((e.mes - 1 + falta) % 12) + 1;
    motivos.push({ tipo: 'info', texto: `Na região ${e.regiao}, a época de plantio começa em ${NOMES_MES[m - 1]}.` });
  }

  // ---- 2. rotação ----
  const ultima = e.historico.ultima ? POR_ID[e.historico.ultima] : null;
  if (!ultima) {
    nota += 25;
  } else if (ultima.familia === h.familia) {
    evitar = true;
    motivos.unshift({
      tipo: 'ruim',
      texto: h.id === ultima.id
        ? `É a mesma planta de antes. Repetir no mesmo lugar junta pragas e doenças na terra.`
        : `É da mesma família da ${ultima.nome.toLowerCase()} (${h.familia}). Elas pegam as mesmas pragas e doenças.`,
    });
  } else if (h.grupo === PROXIMO_GRUPO[ultima.grupo]) {
    nota += 45;
    motivos.unshift({
      tipo: 'bom',
      texto: `Depois de uma planta ${GRUPOS[ultima.grupo].frase}, uma ${GRUPOS[h.grupo].frase} aproveita melhor o que ficou na terra.`,
    });
  } else if (h.grupo === 'leguminosa' && (ultima.grupo === 'folha' || ultima.grupo === 'fruto')) {
    nota += 35;
    motivos.unshift({ tipo: 'bom', texto: 'É leguminosa: devolve nitrogênio para a terra, como um adubo natural.' });
  } else if (h.grupo === ultima.grupo) {
    nota += 10;
    motivos.push({ tipo: 'info', texto: `Também é uma planta ${GRUPOS[h.grupo].frase}, como a anterior. Funciona, mas cansa mais a terra.` });
  } else {
    nota += 25;
    motivos.unshift({ tipo: 'bom', texto: `É de outra família (${h.familia}), o que ajuda a quebrar o ciclo de pragas.` });
  }

  const familiasAntes = e.historico.anteriores.slice(-2).map((id) => POR_ID[id]?.familia);
  if (!evitar && familiasAntes.includes(h.familia)) {
    nota -= 15;
    motivos.push({ tipo: 'ruim', texto: `Uma planta da mesma família (${h.familia}) já foi plantada aqui há pouco tempo.` });
  }

  // ---- 3. colher rápido ----
  const [dMin, dMax] = h.colheitaDias;
  if (e.colherRapido) nota += clamp(20 * (1 - (dMin - 25) / (180 - 25)), 0, 20);
  motivos.push({ tipo: 'info', texto: `Fica pronta para colher em ${dMin} a ${dMax} dias.` });

  nota = Math.round(clamp(nota));
  const nivel: Nivel = evitar ? 'evitar' : nota >= 70 ? 'otima' : nota >= 50 ? 'boa' : 'ok';
  const proximoMes = falta === 0 || falta === 99 ? null : ((e.mes - 1 + falta) % 12) + 1;
  return { h, nota, nivel, agora: falta === 0, proximoMes, motivos };
}

export function recomendar(e: Entrada): Resultado {
  const todas = daRegiao(e.regiao).map((h) => avaliar(h, e));
  // empate: ciclo mais curto primeiro
  const porNota = (a: Sugestao, b: Sugestao) => b.nota - a.nota || a.h.colheitaDias[0] - b.h.colheitaDias[0];
  return {
    agora: todas.filter((s) => s.agora && s.nivel !== 'evitar').sort(porNota),
    proximosMeses: todas
      .filter((s) => !s.agora && s.nivel !== 'evitar' && s.proximoMes !== null)
      .sort((a, b) => mesesAte([a.proximoMes!], e.mes) - mesesAte([b.proximoMes!], e.mes) || porNota(a, b)),
    evitar: todas.filter((s) => s.nivel === 'evitar').sort(porNota),
  };
}

/** Sugestão de sequência: planta, espera a colheita, planta a próxima… */
export function planoDoAno(e: Entrada, passos = 3): { s: Sugestao; mes: number }[] {
  const out: { s: Sugestao; mes: number }[] = [];
  let hist = { ...e.historico, anteriores: [...e.historico.anteriores] };
  let mes = e.mes;
  for (let i = 0; i < passos; i++) {
    const r = recomendar({ ...e, historico: hist, mes });
    const s = r.agora[0] ?? r.proximosMeses[0];
    if (!s) break;
    const mesPlantio = s.agora ? mes : s.proximoMes!;
    out.push({ s, mes: mesPlantio });
    hist = { respondeu: true, ultima: s.h.id, anteriores: [...hist.anteriores, ...(hist.ultima ? [hist.ultima] : [])] };
    mes = ((mesPlantio - 1 + Math.ceil(s.h.colheitaDias[0] / 30)) % 12) + 1;
  }
  return out;
}
