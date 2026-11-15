import { CAMADAS_DO_MAPA, ZOOM_MAXIMO_SALVO, type CamadaBase } from './camadasDoMapa';
import { gravarArmazenado, lerArmazenado, removerArmazenado } from './armazenamento';
import type { LatLng } from '../types';

const NOME_DO_CACHE = 'saerpa-mapa-salvo';
const CHAVE = 'saerpa:mapa-salvo';

export const LIMITE_EM_BYTES = 100 * 1024 * 1024;
const ORCAMENTO_ESTIMADO_EM_BYTES = 85 * 1024 * 1024;
const BYTES_ESTIMADOS: Record<CamadaBase, number> = { satelite: 28_000, ruas: 14_000 };
const RAIOS_EM_QUILOMETROS = [20, 16, 12, 8, 5, 3, 2];
const ZOOM_MINIMO_SALVO = 8;
const ZOOM_DO_RAIO_FIXO = 11;
const RAIO_MINIMO_DOS_ZOOMS_BAIXOS_EM_QUILOMETROS = 80;
const CONEXOES = 4;
const FALHAS_SEGUIDAS_PARA_DESISTIR = 12;
const QUILOMETROS_POR_GRAU = 111.32;

export interface MapaSalvo {
  latitude: number;
  longitude: number;
  raioEmQuilometros: number;
  bytes: number;
  imagens: number;
  completo: boolean;
  salvoEm: string;
}

interface Imagem {
  camada: CamadaBase;
  nivelDeZoom: number;
  x: number;
  y: number;
}

export function lerMapaSalvo(): MapaSalvo | null {
  const texto = lerArmazenado(CHAVE);
  if (texto === null) return null;
  try {
    const valor = JSON.parse(texto) as MapaSalvo;
    return Number.isFinite(valor.latitude) && Number.isFinite(valor.longitude) && Number.isFinite(valor.bytes) ? valor : null;
  } catch {
    return null;
  }
}

function colunaDoLongitude(longitude: number, nivelDeZoom: number): number {
  return Math.floor(((longitude + 180) / 360) * 2 ** nivelDeZoom);
}

function linhaDaLatitude(latitude: number, nivelDeZoom: number): number {
  const radianos = (latitude * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(radianos) + 1 / Math.cos(radianos)) / Math.PI) / 2) * 2 ** nivelDeZoom);
}

export function imagensDoRaio(centro: LatLng, raioEmQuilometros: number): Imagem[] {
  const [latitude, longitude] = centro;
  const imagens: Imagem[] = [];
  for (let nivelDeZoom = ZOOM_MINIMO_SALVO; nivelDeZoom <= ZOOM_MAXIMO_SALVO; nivelDeZoom += 1) {
    const raio = nivelDeZoom < ZOOM_DO_RAIO_FIXO ? Math.max(raioEmQuilometros, RAIO_MINIMO_DOS_ZOOMS_BAIXOS_EM_QUILOMETROS) : raioEmQuilometros;
    const variacaoDeLatitude = raio / QUILOMETROS_POR_GRAU;
    const variacaoDeLongitude = raio / (QUILOMETROS_POR_GRAU * Math.cos((latitude * Math.PI) / 180));
    const colunaInicial = colunaDoLongitude(longitude - variacaoDeLongitude, nivelDeZoom);
    const colunaFinal = colunaDoLongitude(longitude + variacaoDeLongitude, nivelDeZoom);
    const linhaInicial = linhaDaLatitude(latitude + variacaoDeLatitude, nivelDeZoom);
    const linhaFinal = linhaDaLatitude(latitude - variacaoDeLatitude, nivelDeZoom);
    for (let x = colunaInicial; x <= colunaFinal; x += 1) {
      for (let y = linhaInicial; y <= linhaFinal; y += 1) {
        imagens.push({ camada: 'satelite', nivelDeZoom, x, y }, { camada: 'ruas', nivelDeZoom, x, y });
      }
    }
  }
  return imagens;
}

function bytesEstimados(imagens: Imagem[]): number {
  return imagens.reduce((total, imagem) => total + BYTES_ESTIMADOS[imagem.camada], 0);
}

/** Maior raio ao redor do centro cujo mapa estimado cabe no orçamento */
export function planejar(centro: LatLng): { raioEmQuilometros: number; imagens: Imagem[] } {
  for (const raio of RAIOS_EM_QUILOMETROS) {
    const imagens = imagensDoRaio(centro, raio);
    if (bytesEstimados(imagens) <= ORCAMENTO_ESTIMADO_EM_BYTES) return { raioEmQuilometros: raio, imagens };
  }
  const menor = RAIOS_EM_QUILOMETROS[RAIOS_EM_QUILOMETROS.length - 1];
  return { raioEmQuilometros: menor, imagens: imagensDoRaio(centro, menor) };
}

function endereco(imagem: Imagem): string {
  return CAMADAS_DO_MAPA[imagem.camada].url
    .replace('{s}', 'a')
    .replace('{z}', String(imagem.nivelDeZoom))
    .replace('{x}', String(imagem.x))
    .replace('{y}', String(imagem.y));
}

/** Igual à chave do service worker: o OpenStreetMap responde por a/b/c e todos valem a mesma imagem */
function chave(enderecoDaImagem: string): string {
  const url = new URL(enderecoDaImagem);
  return `${url.protocol}//${url.host.replace(/^[abc]\./, '')}${url.pathname}${url.search}`;
}

function distanciaEmQuilometros(primeiro: LatLng, segundo: LatLng): number {
  const norteSul = (primeiro[0] - segundo[0]) * QUILOMETROS_POR_GRAU;
  const lesteOeste = (primeiro[1] - segundo[1]) * QUILOMETROS_POR_GRAU * Math.cos((primeiro[0] * Math.PI) / 180);
  return Math.hypot(norteSul, lesteOeste);
}

export function mapaPrecisaSerSalvo(centro: LatLng): boolean {
  const salvo = lerMapaSalvo();
  if (salvo === null || !salvo.completo) return true;
  return distanciaEmQuilometros(centro, [salvo.latitude, salvo.longitude]) > salvo.raioEmQuilometros / 3;
}

export function suportaMapaOffline(): boolean {
  return typeof caches !== 'undefined' && 'serviceWorker' in navigator;
}

export async function removerMapaSalvo(): Promise<void> {
  removerArmazenado(CHAVE);
  if (typeof caches !== 'undefined') await caches.delete(NOME_DO_CACHE);
}

/** Baixa em segundo plano o mapa ao redor do centro, parando no limite de bytes. Pode ser interrompido. */
export async function salvarMapaDaRegiao(centro: LatLng, sinal: AbortSignal): Promise<MapaSalvo | null> {
  const anterior = lerMapaSalvo();
  if (anterior !== null && distanciaEmQuilometros(centro, [anterior.latitude, anterior.longitude]) > anterior.raioEmQuilometros / 3) {
    await removerMapaSalvo();
  }

  const { raioEmQuilometros, imagens } = planejar(centro);
  const cache = await caches.open(NOME_DO_CACHE);
  let bytes = 0;
  for (const chaveGuardada of await cache.keys()) {
    const guardada = await cache.match(chaveGuardada);
    bytes += guardada ? (await guardada.clone().blob()).size : 0;
  }

  let proxima = 0;
  let falhasSeguidas = 0;
  let desistiu = false;
  let estourouOLimite = false;

  async function trabalhador(): Promise<void> {
    while (!sinal.aborted && !desistiu && !estourouOLimite) {
      const imagem = imagens[proxima];
      proxima += 1;
      if (imagem === undefined) return;
      const enderecoDaImagem = endereco(imagem);
      const chaveDaImagem = chave(enderecoDaImagem);
      if (await cache.match(chaveDaImagem)) continue;

      try {
        const resposta = await fetch(enderecoDaImagem, { mode: 'cors', signal: sinal });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const conteudo = await resposta.blob();
        if (bytes + conteudo.size > LIMITE_EM_BYTES) {
          estourouOLimite = true;
          return;
        }
        await cache.put(chaveDaImagem, new Response(conteudo, { headers: { 'Content-Type': conteudo.type || 'image/png' } }));
        bytes += conteudo.size;
        falhasSeguidas = 0;
      } catch {
        if (sinal.aborted) return;
        falhasSeguidas += 1;
        if (falhasSeguidas >= FALHAS_SEGUIDAS_PARA_DESISTIR) desistiu = true;
      }
    }
  }

  await Promise.all(Array.from({ length: CONEXOES }, trabalhador));
  if (sinal.aborted) return null;

  const salvo: MapaSalvo = {
    latitude: centro[0],
    longitude: centro[1],
    raioEmQuilometros,
    bytes,
    imagens: (await cache.keys()).length,
    completo: !desistiu && !estourouOLimite && proxima >= imagens.length,
    salvoEm: new Date().toISOString(),
  };
  gravarArmazenado(CHAVE, JSON.stringify(salvo));
  return salvo;
}
