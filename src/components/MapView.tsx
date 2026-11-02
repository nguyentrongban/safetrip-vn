import LeafletMapView from './LeafletMapView';
import MapboxMapView from './MapboxMapView';
import { useMapEngine } from '../hooks/useMapEngine';

interface Props { lat: number | null; lng: number | null }

/**
 * Engine-choice wrapper for the Giám Sát monitor map (v1.25).
 * Mapbox GL (branded vector style) is primary when a token is configured;
 * ANY Mapbox failure swaps in the Leaflet/Esri map automatically, silently,
 * at the same view — and stays there for the rest of the session.
 * With no token configured this renders exactly the v1.24 Leaflet map.
 */
export default function MapView({ lat, lng }: Props) {
  const { engine, savedView, fail } = useMapEngine();
  if (engine === 'mapbox') {
    return <MapboxMapView lat={lat} lng={lng} onFail={fail} />;
  }
  return <LeafletMapView lat={lat} lng={lng} initialView={savedView} />;
}
