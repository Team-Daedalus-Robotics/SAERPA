import { useEffect, useState } from 'react';
import { mapaPrecisaSerSalvo, salvarMapaDaRegiao, suportaMapaOffline } from '../lib/mapaOffline';
import type { LatLng } from '../types';

const ESPERA_ANTES_DE_SALVAR_EM_MILISSEGUNDOS = 4000;

export function useConexao(): boolean {
  const [conectado, setConectado] = useState(() => navigator.onLine);
  useEffect(() => {
    const ligou = () => setConectado(true);
    const caiu = () => setConectado(false);
    window.addEventListener('online', ligou);
    window.addEventListener('offline', caiu);
    return () => {
      window.removeEventListener('online', ligou);
      window.removeEventListener('offline', caiu);
    };
  }, []);
  return conectado;
}

interface ConexaoDoNavegador {
  saveData?: boolean;
}

/** Salva sozinho, em segundo plano, o mapa ao redor da propriedade (uma vez, e de novo se ela mudar de lugar) */
export function useSalvarMapaAutomaticamente(centro: LatLng | null, conectado: boolean): void {
  const latitude = centro?.[0];
  const longitude = centro?.[1];
  useEffect(() => {
    if (latitude === undefined || longitude === undefined || !conectado || !suportaMapaOffline()) return;
    const economiaDeDados = (navigator as Navigator & { connection?: ConexaoDoNavegador }).connection?.saveData === true;
    if (economiaDeDados || !mapaPrecisaSerSalvo([latitude, longitude])) return;

    const controle = new AbortController();
    const espera = window.setTimeout(() => {
      void salvarMapaDaRegiao([latitude, longitude], controle.signal).catch(() => undefined);
    }, ESPERA_ANTES_DE_SALVAR_EM_MILISSEGUNDOS);
    return () => {
      window.clearTimeout(espera);
      controle.abort();
    };
  }, [latitude, longitude, conectado]);
}
