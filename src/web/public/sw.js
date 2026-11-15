/* Service worker do SAERPA: guarda o app e as imagens do mapa para abrir e mostrar o mapa sem internet. */
const ARQUIVOS = 'saerpa-arquivos-v1';
const MAPA_SALVO = 'saerpa-mapa-salvo';
const MAPA_VISTO = 'saerpa-mapa-visto';
const LIMITE_DE_IMAGENS_VISTAS = 1500;

const ehImagemDoMapa = (url) => url.origin !== self.location.origin && /\/\d{1,2}\/\d+\/\d+(\.(png|jpe?g))?$/.test(url.pathname);
// o OpenStreetMap responde por a/b/c.tile...: todos valem a mesma imagem
const chaveDaImagem = (url) => `${url.protocol}//${url.host.replace(/^[abc]\./, '')}${url.pathname}${url.search}`;
const ehFonte = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) {
        if (nome.startsWith('saerpa-arquivos-') && nome !== ARQUIVOS) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

async function aparar(cache) {
  const chaves = await cache.keys();
  for (const chave of chaves.slice(0, Math.max(0, chaves.length - LIMITE_DE_IMAGENS_VISTAS))) await cache.delete(chave);
}

async function imagemDoMapa(requisicao, url) {
  const chave = chaveDaImagem(url);
  for (const nome of [MAPA_SALVO, MAPA_VISTO]) {
    const guardada = await (await caches.open(nome)).match(chave);
    if (guardada) return guardada;
  }
  try {
    const resposta = await fetch(new Request(requisicao.url, { mode: 'cors' }));
    if (resposta.ok) {
      const cache = await caches.open(MAPA_VISTO);
      await cache.put(chave, resposta.clone());
      await aparar(cache);
    }
    return resposta;
  } catch {
    try {
      return await fetch(requisicao);
    } catch {
      return Response.error();
    }
  }
}

async function paginaOuArquivo(requisicao) {
  const cache = await caches.open(ARQUIVOS);
  const chave = requisicao.mode === 'navigate' ? '/' : requisicao;
  try {
    const resposta = await fetch(requisicao);
    if (resposta.ok) await cache.put(chave, resposta.clone());
    return resposta;
  } catch {
    const guardada = await cache.match(chave);
    return guardada ?? Response.error();
  }
}

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;
  const url = new URL(requisicao.url);

  if (ehImagemDoMapa(url)) {
    evento.respondWith(imagemDoMapa(requisicao, url));
  } else if (url.origin === self.location.origin && url.pathname.startsWith('/api')) {
    return;
  } else if (requisicao.mode === 'navigate' || url.origin === self.location.origin || ehFonte(url)) {
    evento.respondWith(paginaOuArquivo(requisicao));
  }
});
