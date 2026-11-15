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
  hortalica: Hortalica;
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

const limitar = (valor: number, minimo = 0, maximo = 100) => Math.max(minimo, Math.min(maximo, valor));

/** Quantos meses faltam até a janela de plantio (0 = já está na janela) */
function mesesAte(janela: number[], mes: number): number {
  for (let deslocamento = 0; deslocamento < 12; deslocamento++) {
    if (janela.includes(((mes - 1 + deslocamento) % 12) + 1)) return deslocamento;
  }
  return 99;
}

function avaliar(hortalica: Hortalica, entrada: Entrada): Sugestao {
  const janela = hortalica.epocas[entrada.regiao] ?? [];
  const falta = mesesAte(janela, entrada.mes);
  const motivos: Motivo[] = [];
  let nota = 0;
  let evitar = false;

  // ---- 1. época de plantio (Embrapa) ----
  if (falta === 0) {
    nota += 35;
    motivos.push({ tipo: 'bom', texto: `Época certa para plantar na região ${entrada.regiao} (tabela Embrapa).` });
  } else {
    if (falta === 1) nota += 15;
    const mesDeInicio = ((entrada.mes - 1 + falta) % 12) + 1;
    motivos.push({ tipo: 'info', texto: `Na região ${entrada.regiao}, a época de plantio começa em ${NOMES_MES[mesDeInicio - 1]}.` });
  }

  // ---- 2. rotação ----
  const ultima = entrada.historico.ultima ? POR_ID[entrada.historico.ultima] : null;
  if (!ultima) {
    nota += 25;
  } else if (ultima.familia === hortalica.familia) {
    evitar = true;
    motivos.unshift({
      tipo: 'ruim',
      texto: hortalica.id === ultima.id
        ? `É a mesma planta de antes. Repetir no mesmo lugar junta pragas e doenças na terra.`
        : `É da mesma família da ${ultima.nome.toLowerCase()} (${hortalica.familia}). Elas pegam as mesmas pragas e doenças.`,
    });
  } else if (hortalica.grupo === PROXIMO_GRUPO[ultima.grupo]) {
    nota += 45;
    motivos.unshift({
      tipo: 'bom',
      texto: `Depois de uma planta ${GRUPOS[ultima.grupo].frase}, uma ${GRUPOS[hortalica.grupo].frase} aproveita melhor o que ficou na terra.`,
    });
  } else if (hortalica.grupo === 'leguminosa' && (ultima.grupo === 'folha' || ultima.grupo === 'fruto')) {
    nota += 35;
    motivos.unshift({ tipo: 'bom', texto: 'É leguminosa: devolve nitrogênio para a terra, como um adubo natural.' });
  } else if (hortalica.grupo === ultima.grupo) {
    nota += 10;
    motivos.push({ tipo: 'info', texto: `Também é uma planta ${GRUPOS[hortalica.grupo].frase}, como a anterior. Funciona, mas cansa mais a terra.` });
  } else {
    nota += 25;
    motivos.unshift({ tipo: 'bom', texto: `É de outra família (${hortalica.familia}), o que ajuda a quebrar o ciclo de pragas.` });
  }

  const familiasAnteriores = entrada.historico.anteriores.slice(-2).map((id) => POR_ID[id]?.familia);
  if (!evitar && familiasAnteriores.includes(hortalica.familia)) {
    nota -= 15;
    motivos.push({ tipo: 'ruim', texto: `Uma planta da mesma família (${hortalica.familia}) já foi plantada aqui há pouco tempo.` });
  }

  // ---- 3. colher rápido ----
  const [diasMinimos, diasMaximos] = hortalica.colheitaDias;
  if (entrada.colherRapido) nota += limitar(20 * (1 - (diasMinimos - 25) / (180 - 25)), 0, 20);
  motivos.push({ tipo: 'info', texto: `Fica pronta para colher em ${diasMinimos} a ${diasMaximos} dias.` });

  nota = Math.round(limitar(nota));
  const nivel: Nivel = evitar ? 'evitar' : nota >= 70 ? 'otima' : nota >= 50 ? 'boa' : 'ok';
  const proximoMes = falta === 0 || falta === 99 ? null : ((entrada.mes - 1 + falta) % 12) + 1;
  return { hortalica, nota, nivel, agora: falta === 0, proximoMes, motivos };
}

export function recomendar(entrada: Entrada): Resultado {
  const todas = daRegiao(entrada.regiao).map((hortalica) => avaliar(hortalica, entrada));
  // empate: ciclo mais curto primeiro
  const porNota = (primeira: Sugestao, segunda: Sugestao) =>
    segunda.nota - primeira.nota || primeira.hortalica.colheitaDias[0] - segunda.hortalica.colheitaDias[0];
  return {
    agora: todas.filter((sugestao) => sugestao.agora && sugestao.nivel !== 'evitar').sort(porNota),
    proximosMeses: todas
      .filter((sugestao) => !sugestao.agora && sugestao.nivel !== 'evitar' && sugestao.proximoMes !== null)
      .sort((primeira, segunda) =>
        mesesAte([primeira.proximoMes!], entrada.mes) - mesesAte([segunda.proximoMes!], entrada.mes) || porNota(primeira, segunda)),
    evitar: todas.filter((sugestao) => sugestao.nivel === 'evitar').sort(porNota),
  };
}

/** Sugestão de sequência: planta, espera a colheita, planta a próxima… */
export function planoDoAno(entrada: Entrada, quantidadeDePassos = 3): { sugestao: Sugestao; mes: number }[] {
  const plano: { sugestao: Sugestao; mes: number }[] = [];
  let historicoAtual = { ...entrada.historico, anteriores: [...entrada.historico.anteriores] };
  let mes = entrada.mes;
  for (let passo = 0; passo < quantidadeDePassos; passo++) {
    const resultado = recomendar({ ...entrada, historico: historicoAtual, mes });
    const sugestao = resultado.agora[0] ?? resultado.proximosMeses[0];
    if (!sugestao) break;
    const mesDoPlantio = sugestao.agora ? mes : sugestao.proximoMes!;
    plano.push({ sugestao, mes: mesDoPlantio });
    historicoAtual = {
      respondeu: true,
      ultima: sugestao.hortalica.id,
      anteriores: [...historicoAtual.anteriores, ...(historicoAtual.ultima ? [historicoAtual.ultima] : [])],
    };
    mes = ((mesDoPlantio - 1 + Math.ceil(sugestao.hortalica.colheitaDias[0] / 30)) % 12) + 1;
  }
  return plano;
}
