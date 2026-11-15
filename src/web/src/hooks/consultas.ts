import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadMunicipios } from '../data/locations';
import { apagarArea, criarArea, listarAreas, salvarHistorico } from '../services/areas';
import { buscarCatalogo } from '../services/catalogo';
import { fieldStatistics, pointStatistics } from '../services/smap';
import type { Area, Historico, LatLng, Municipio } from '../types';

const CHAVES = {
  catalogo: ['catalogo'] as const,
  municipios: (uf: string | undefined) => ['municipios', uf] as const,
  areas: (codigoIbge: number | undefined) => ['areas', codigoIbge] as const,
  umidade: (codigoIbge: number | undefined, areaId: number | null) => ['umidade', codigoIbge, areaId] as const,
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

export function useUmidade(municipio: Municipio | null, area: Area | null) {
  return useQuery({
    queryKey: CHAVES.umidade(municipio?.codigoIbge, area?.id ?? null),
    queryFn: () => (area
      ? fieldStatistics(area.coordenadas, area.center)
      : pointStatistics([municipio!.lat, municipio!.lng])),
    enabled: municipio !== null,
    staleTime: 5 * 60 * 1000,
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
