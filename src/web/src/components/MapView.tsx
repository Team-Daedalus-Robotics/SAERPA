import { useEffect } from 'react';
import Leaflet from 'leaflet';
import {
  CircleMarker, MapContainer, Polygon, Rectangle, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents,
} from 'react-leaflet';
import { BRAZIL_BOUNDS } from '../lib/geo';
import type { Area, CelulaDaNasa, LatLng, Municipio } from '../types';

export type BaseLayer = 'satelite' | 'ruas';

/** Para onde o mapa deve voar quando o usuário escolhe estado/cidade */
export type MapTarget =
  | { kind: 'brasil' }
  | { kind: 'point'; center: LatLng; zoom: number };

const TILES: Record<BaseLayer, { url: string; attribution: string; maxZoom: number }> = {
  satelite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri',
    maxZoom: 18,
  },
  ruas: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
};

function FlyTo({ target }: { target: MapTarget }) {
  const map = useMap();
  useEffect(() => {
    if (target.kind === 'brasil') map.flyToBounds(BRAZIL_BOUNDS, { duration: 0.8 });
    else map.flyTo(target.center, target.zoom, { duration: 1.2 });
  }, [map, target]);
  return null;
}

/** Região da grade da NASA (cerca de 55 km) de onde vêm os dados do local escolhido */
function CelulaDaNasaNoMapa({ celula, cor }: { celula: CelulaDaNasa; cor: string }) {
  return (
    <Rectangle
      bounds={[[celula.sul, celula.oeste], [celula.norte, celula.leste]]}
      interactive={false}
      pathOptions={{ color: '#ffffff', weight: 2, dashArray: '8 6', opacity: 0.9, fillColor: cor, fillOpacity: 0.26 }}
    />
  );
}

function ZoomWatcher({ onZoom }: { onZoom: (nivelDeZoom: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

function ClickCatcher({ onClick }: { onClick: (ponto: LatLng) => void }) {
  useMapEvents({ click: (evento) => onClick([evento.latlng.lat, evento.latlng.lng]) });
  return null;
}

interface Propriedades {
  base: BaseLayer;
  celula: CelulaDaNasa | null;
  corDaCelula: string;
  target: MapTarget;
  municipio: Municipio | null;
  areas: Area[];
  selectedId: number | null;
  drawing: LatLng[] | null;
  onSelectArea: (id: number) => void;
  onMapClick: (ponto: LatLng) => void;
  onZoom: (nivelDeZoom: number) => void;
}

export default function MapView(propriedades: Propriedades) {
  const tile = TILES[propriedades.base];
  return (
    <MapContainer bounds={BRAZIL_BOUNDS} zoomControl={false} className="map" minZoom={3}>
      <TileLayer key={propriedades.base} url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
      <ZoomControl position="bottomright" />
      <FlyTo target={propriedades.target} />
      <ZoomWatcher onZoom={propriedades.onZoom} />
      <ClickCatcher onClick={propriedades.onMapClick} />
      {propriedades.celula && <CelulaDaNasaNoMapa celula={propriedades.celula} cor={propriedades.corDaCelula} />}

      {propriedades.municipio && (
        <CircleMarker
          center={[propriedades.municipio.lat, propriedades.municipio.lng]}
          radius={7}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#1570ef', fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -8]} className="map-tip">{propriedades.municipio.nome}</Tooltip>
        </CircleMarker>
      )}

      {propriedades.areas.map((area) => {
        const selecionada = area.id === propriedades.selectedId;
        return (
          <Polygon
            key={`${area.id}-${selecionada}`}
            positions={area.coordenadas}
            pathOptions={{
              color: selecionada ? '#ffd43b' : '#ffffff',
              weight: selecionada ? 3.5 : 2,
              dashArray: selecionada ? undefined : '5 4',
              fillColor: '#2e9e5b',
              fillOpacity: selecionada ? 0.4 : 0.22,
            }}
            eventHandlers={{
              click: (evento) => {
                if (propriedades.drawing) return; // deixa o clique chegar no mapa para marcar ponto
                Leaflet.DomEvent.stop(evento);
                propriedades.onSelectArea(area.id);
              },
            }}
          >
            <Tooltip permanent direction="center" className="map-tip">{area.nome}</Tooltip>
          </Polygon>
        );
      })}

      {propriedades.drawing && propriedades.drawing.length > 0 && (
        <>
          <Polygon positions={propriedades.drawing} pathOptions={{ color: '#ffd43b', weight: 2, dashArray: '4 4', fillOpacity: 0.15 }} />
          {propriedades.drawing.map((ponto, indice) => (
            <CircleMarker key={indice} center={ponto} radius={5}
              pathOptions={{ color: '#fff', weight: 2, fillColor: '#ffd43b', fillOpacity: 1 }} />
          ))}
        </>
      )}
    </MapContainer>
  );
}
