import LeafletMapView from './LeafletMapView';
import MapboxMapView from './MapboxMapView';
import { useMapEngine } from '../hooks/useMapEngine';
import type { PlacePoint } from '../types';

interface Props {
  lat: number | null;
  lng: number | null;
  /** Predicted-route polyline ([lat, lng] pairs) to draw, if any. */
  route?: [number, number][] | null;
  /** Destination point to flag on the map, if picked. */
  dest?: PlacePoint | null;
}

/**
 * Engine-choice wrapper for the Giám Sát monitor map (v1.25).
 * Mapbox GL (branded vector style) is primary when a token is configured;
 * ANY Mapbox failure swaps in the Leaflet/Esri map automatically, silently,
 * at the same view — and stays there for the rest of the session.
 * With no token configured this renders exactly the v1.24 Leaflet map.
 */
export default function MapView({ lat, lng, route = null, dest = null }: Props) {
  const { engine, savedView, fail } = useMapEngine();
  if (engine === 'mapbox') {
    return <MapboxMapView lat={lat} lng={lng} onFail={fail} route={route} dest={dest} />;
  }
  return <LeafletMapView lat={lat} lng={lng} initialView={savedView} route={route} dest={dest} />;
}
