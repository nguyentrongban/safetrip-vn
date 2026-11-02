import { useCallback, useState } from 'react';
import { latchMapboxOff, mapboxConfigured, mapboxLatchedOff } from '../utils/mapbox';

export type MapEngine = 'leaflet' | 'mapbox';

export interface SavedView {
  center: [number, number]; // [lat, lng]
  zoom: number;
}

/**
 * The ONE engine-choice seam shared by the Giám Sát monitor map and the
 * family LiveView map. Starts on Mapbox only when a token is configured and
 * Mapbox has not failed earlier in this session; any failure reported via
 * `fail()` latches Mapbox off (see utils/mapbox) and swaps this component
 * tree to the Leaflet renderer, seeding it with the last Mapbox view so the
 * user keeps their place on the map.
 */
export function useMapEngine() {
  const [engine, setEngine] = useState<MapEngine>(() =>
    mapboxConfigured() && !mapboxLatchedOff() ? 'mapbox' : 'leaflet',
  );
  const [savedView, setSavedView] = useState<SavedView | null>(null);

  const fail = useCallback((reason: string, view?: SavedView | null) => {
    latchMapboxOff(reason);
    if (view) setSavedView(view);
    setEngine('leaflet');
  }, []);

  return { engine, savedView, fail };
}
