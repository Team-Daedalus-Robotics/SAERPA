import { useEffect, useState } from 'react';
import L from 'leaflet';
import {
  CircleMarker, MapContainer, Polygon, Rectangle, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents,
} from 'react-leaflet';
import { BRAZIL_BOUNDS } from '../lib/geo';
import { gridCells, type GridCell } from '../services/smap';
import type { Area, LatLng, Municipio } from '../types';

export type BaseLayer = 'sat' | 'osm';

/** Para onde o mapa deve voar quando o usuário escolhe estado/cidade */
export type MapTarget =
  | { kind: 'brasil' }
  | { kind: 'point'; center: LatLng; zoom: number };

const TILES: Record<BaseLayer, { url: string; attribution: string; maxZoom: number }> = {
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri',
    maxZoom: 18,
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
};

/** Zoom mínimo para desenhar a grade SMAP de 9 km (abaixo disso seriam milhares de células) */
export const SMAP_MIN_ZOOM = 8;

function FlyTo({ target }: { target: MapTarget }) {
  const map = useMap();
  useEffect(() => {
    if (target.kind === 'brasil') map.flyToBounds(BRAZIL_BOUNDS, { duration: 0.8 });
    else map.flyTo(target.center, target.zoom, { duration: 1.2 });
  }, [map, target]);
  return null;
}

function SmapGrid({ visible }: { visible: boolean }) {
  const [cells, setCells] = useState<GridCell[]>([]);
  const map = useMapEvents({ moveend: () => update() });
  function update() {
    if (!visible || map.getZoom() < SMAP_MIN_ZOOM) return setCells([]);
    const b = map.getBounds().pad(0.2);
    setCells(gridCells(b.getSouth(), b.getWest(), b.getNorth(), b.getEast()));
  }
  useEffect(update, [visible]);
  return (
    <>
      {cells.map((c, i) => (
        <Rectangle
          key={i}
          bounds={c.bounds}
          interactive={false}
          pathOptions={{ color: '#fff', weight: 0.5, opacity: 0.35, fillColor: c.color, fillOpacity: 0.42 }}
        />
      ))}
    </>
  );
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

function ClickCatcher({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

interface Props {
  base: BaseLayer;
  showSmap: boolean;
  target: MapTarget;
  municipio: Municipio | null;
  areas: Area[];
  selectedId: number | null;
  drawing: LatLng[] | null;
  onSelectArea: (id: number) => void;
  onMapClick: (p: LatLng) => void;
  onZoom: (z: number) => void;
}

export default function MapView(p: Props) {
  const tile = TILES[p.base];
  return (
    <MapContainer bounds={BRAZIL_BOUNDS} zoomControl={false} className="map" minZoom={3}>
      <TileLayer key={p.base} url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
      <ZoomControl position="bottomright" />
      <FlyTo target={p.target} />
      <ZoomWatcher onZoom={p.onZoom} />
      <ClickCatcher onClick={p.onMapClick} />
      <SmapGrid visible={p.showSmap} />

      {p.municipio && (
        <CircleMarker
          center={[p.municipio.lat, p.municipio.lng]}
          radius={7}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#e4572e', fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -8]} className="map-tip">{p.municipio.nome}</Tooltip>
        </CircleMarker>
      )}

      {p.areas.map((a) => {
        const sel = a.id === p.selectedId;
        return (
          <Polygon
            key={`${a.id}-${sel}`}
            positions={a.coords}
            pathOptions={{
              color: sel ? '#e4572e' : '#fffdf7',
              weight: sel ? 3.5 : 2,
              dashArray: sel ? undefined : '5 4',
              fillColor: '#6a994e',
              fillOpacity: sel ? 0.4 : 0.22,
            }}
            eventHandlers={{
              click: (e) => {
                if (p.drawing) return; // deixa o clique chegar no mapa para marcar ponto
                L.DomEvent.stop(e);
                p.onSelectArea(a.id);
              },
            }}
          >
            <Tooltip permanent direction="center" className="map-tip">{a.nome}</Tooltip>
          </Polygon>
        );
      })}

      {p.drawing && p.drawing.length > 0 && (
        <>
          <Polygon positions={p.drawing} pathOptions={{ color: '#e4572e', weight: 2, dashArray: '4 4', fillOpacity: 0.15 }} />
          {p.drawing.map((pt, i) => (
            <CircleMarker key={i} center={pt} radius={5}
              pathOptions={{ color: '#fff', weight: 2, fillColor: '#e4572e', fillOpacity: 1 }} />
          ))}
        </>
      )}
    </MapContainer>
  );
}
