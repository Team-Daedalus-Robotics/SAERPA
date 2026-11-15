import type { CelulaDaNasa, LatLng } from '../types';

const PASSO_DE_LATITUDE = 0.5;
const PASSO_DE_LONGITUDE = 0.625;

/** Mesma regra da API: a célula da grade da NASA cujo centro é o múltiplo de 0,5 / 0,625 mais próximo */
export function celulaDaNasa([latitude, longitude]: LatLng): CelulaDaNasa {
  const centroDaLatitude = Math.round(latitude / PASSO_DE_LATITUDE) * PASSO_DE_LATITUDE;
  const centroDaLongitude = Math.round(longitude / PASSO_DE_LONGITUDE) * PASSO_DE_LONGITUDE;
  return {
    latitude: centroDaLatitude,
    longitude: centroDaLongitude,
    sul: centroDaLatitude - PASSO_DE_LATITUDE / 2,
    norte: centroDaLatitude + PASSO_DE_LATITUDE / 2,
    oeste: centroDaLongitude - PASSO_DE_LONGITUDE / 2,
    leste: centroDaLongitude + PASSO_DE_LONGITUDE / 2,
  };
}
