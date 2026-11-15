import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadMunicipios } from '../data/locations';
import { apagarArea, criarArea, listarAreas, renomearArea, salvarHistorico, trocarDePropriedade } from '../services/areas';
import { buscarCatalogo } from '../services/catalogo';
import { celulaDaNasa } from '../lib/nasa';
import { buscarClima } from '../services/clima';
import type { Area, Historico, LatLng, Municipio } from '../types';

const CHAVES = {
  catalogo: ['catalogo'] as const,
  municipios: (uf: string | undefined) => ['municipios', uf] as const,
  areas: (codigoIbge: number | undefined) => ['areas', codigoIbge] as const,
  clima: (latitudeDaCelula: number | undefined, longitudeDaCelula: number | undefined) => ['clima', latitudeDaCelula, longitudeDaCelula] as const,
};

export function useCatalogo() {
  return useQuery({ queryKey: CHAVES.catalogo, queryFn: buscarCatalogo, staleTime: Infinity });
}

export function useMunicipios(uf: string | undefined) {
  return useQuery({
    queryKey: CHAVES.municipios(uf),
    queryFn: () => loadMunicipios(uf!),
    enabled: uf !== undefined,
    staleTime: Infinity,
  });
}

export function useAreas(municipio: Municipio | null) {
  return useQuery({
    queryKey: CHAVES.areas(municipio?.codigoIbge),
    queryFn: () => listarAreas(municipio!),
    enabled: municipio !== null,
  });
}

/** Clima real da NASA para a área escolhida (ou para a cidade, se nenhuma área estiver marcada) */
export function useClima(municipio: Municipio | null, area: Area | null) {
  const ponto: LatLng | null = area ? area.center : municipio ? [municipio.lat, municipio.lng] : null;
  const celula = ponto ? celulaDaNasa(ponto) : null;
  return useQuery({
    queryKey: CHAVES.clima(celula?.latitude, celula?.longitude),
    queryFn: () => buscarClima(ponto!),
    enabled: ponto !== null,
    staleTime: 30 * 60 * 1000,
    // null = a região ainda está sendo buscada na NASA pelo worker: tenta de novo até chegar (ou dar erro)
    refetchInterval: (consulta) => (consulta.state.data === null && consulta.state.status !== 'error' ? 3000 : false),
  });
}

export function useCriarArea(municipio: Municipio | null) {
  const clienteDeConsultas = useQueryClient();
  return useMutation({
    mutationFn: ({ nome, coordenadas }: { nome: string; coordenadas: LatLng[] }) =>
      criarArea(municipio!, nome, coordenadas),
    onSuccess: (novaArea) => {
      clienteDeConsultas.setQueryData<Area[]>(CHAVES.areas(municipio?.codigoIbge), (areas = []) => [...areas, novaArea]);
    },
  });
}

export function useApagarArea(municipio: Municipio | null) {
  const clienteDeConsultas = useQueryClient();
  return useMutation({
    mutationFn: (areaId: number) => apagarArea(areaId),
    onSuccess: (_, areaId) => {
      clienteDeConsultas.setQueryData<Area[]>(CHAVES.areas(municipio?.codigoIbge), (areas = []) =>
        areas.filter((area) => area.id !== areaId));
    },
  });
}

/** Atualiza a tela na hora e desfaz se o servidor recusar. */
export function useSalvarHistorico(municipio: Municipio | null) {
  const clienteDeConsultas = useQueryClient();
  const chave = CHAVES.areas(municipio?.codigoIbge);
  return useMutation({
    mutationFn: ({ areaId, historico }: { areaId: number; historico: Historico }) => salvarHistorico(areaId, historico),
    onMutate: async ({ areaId, historico }) => {
      await clienteDeConsultas.cancelQueries({ queryKey: chave });
      const anteriores = clienteDeConsultas.getQueryData<Area[]>(chave);
      clienteDeConsultas.setQueryData<Area[]>(chave, (areas = []) =>
        areas.map((area) => (area.id === areaId ? { ...area, historico } : area)));
      return { anteriores };
    },
    onError: (_, __, contexto) => {
      if (contexto?.anteriores) clienteDeConsultas.setQueryData(chave, contexto.anteriores);
    },
    onSettled: () => clienteDeConsultas.invalidateQueries({ queryKey: chave }),
  });
}

/** Atualiza o nome na tela na hora e desfaz se o servidor recusar. */
export function useRenomearArea(municipio: Municipio | null) {
  const clienteDeConsultas = useQueryClient();
  const chave = CHAVES.areas(municipio?.codigoIbge);
  return useMutation({
    mutationFn: ({ areaId, nome }: { areaId: number; nome: string }) => renomearArea(areaId, nome),
    onMutate: async ({ areaId, nome }) => {
      await clienteDeConsultas.cancelQueries({ queryKey: chave });
      const anteriores = clienteDeConsultas.getQueryData<Area[]>(chave);
      clienteDeConsultas.setQueryData<Area[]>(chave, (areas = []) =>
        areas.map((area) => (area.id === areaId ? { ...area, nome } : area)));
      return { anteriores };
    },
    onError: (_, __, contexto) => {
      if (contexto?.anteriores) clienteDeConsultas.setQueryData(chave, contexto.anteriores);
    },
    onSettled: () => clienteDeConsultas.invalidateQueries({ queryKey: chave }),
  });
}


/** Troca a única propriedade: exclui a antiga no servidor e passa a usar a nova cidade */
export function useTrocarDePropriedade() {
  const clienteDeConsultas = useQueryClient();
  return useMutation({
    mutationFn: trocarDePropriedade,
    onSuccess: () => clienteDeConsultas.removeQueries({ queryKey: ['areas'] }),
  });
}
