import type { Map as MapboxMap } from 'mapbox-gl';

/**
 * Mapbox GL is the PRIMARY map engine (v1.25) — a vector map with a
 * SafeTrip-branded dark style. The Leaflet/Esri map stays as the automatic
 * fallback renderer (see useMapEngine + the map wrappers).
 *
 * TO ENABLE MAPBOX: paste the public token (pk.…) on the next line — that is
 * the ONLY change needed. While the token is empty the app behaves exactly
 * like v1.24: the Mapbox code chunk is never even downloaded.
 */
export const MAPBOX_TOKEN = 'pk.eyJ1IjoidHJvbmd0YW4iLCJhIjoiY212eXZrMmhrMWxjMzJ6cGtkNWU4ajFmeiJ9.x-aiNOVnetmGidTzaKsmrw';

export const MAPBOX_STREET_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';
export const MAPBOX_SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';

/** How long the style may take to load before we give up and fall back. */
export const MAPBOX_LOAD_TIMEOUT_MS = 6000;
/** Post-load tile/source errors tolerated before falling back. */
export const MAPBOX_MAX_ERRORS = 3;

/* ------------------------------------------------------------------ */
/* Session latch: once Mapbox fails, stay on Leaflet for the whole     */
/* session (no flapping). The next app launch retries Mapbox fresh     */
/* because this module state resets.                                   */
/* ------------------------------------------------------------------ */
let latchedOff = false;

export function mapboxLatchedOff(): boolean {
  return latchedOff;
}

export function latchMapboxOff(reason: string): void {
  if (!latchedOff) {
    latchedOff = true;
    // eslint-disable-next-line no-console
    console.warn(`[SafeTrip] Mapbox disabled for this session → Leaflet fallback. Reason: ${reason}`);
  }
}

export function mapboxConfigured(): boolean {
  return MAPBOX_TOKEN.trim() !== '';
}

/* ------------------------------------------------------------------ */
/* Dynamic loader — mapbox-gl (JS + CSS) is fetched only when a map    */
/* actually wants the Mapbox engine.                                   */
/* ------------------------------------------------------------------ */
/** The mapboxgl runtime object (the module's default export). */
export type MapboxGL = (typeof import('mapbox-gl'))['default'];

export async function loadMapboxGL(): Promise<MapboxGL> {
  const mod = await import('mapbox-gl');
  await import('mapbox-gl/dist/mapbox-gl.css');
  const mapboxgl = mod.default;
  mapboxgl.accessToken = MAPBOX_TOKEN;
  return mapboxgl;
}

/* ------------------------------------------------------------------ */
/* Fallback watchdog — this is the single place that decides a live    */
/* Mapbox map is unhealthy and the wrapper must swap to Leaflet:       */
/*  • style does not fire 'load' within MAPBOX_LOAD_TIMEOUT_MS         */
/*    (covers dead network + HTTP 401/402/403 style responses)         */
/*  • an HTTP 401/402/403 style error fails fast, before the timeout   */
/*  • ≥ MAPBOX_MAX_ERRORS 'error' events after the map has loaded      */
/* Returns a cleanup function.                                         */
/* ------------------------------------------------------------------ */
export function watchMapboxMap(map: MapboxMap, onFail: (reason: string) => void): () => void {
  let loaded = false;
  let errors = 0;
  let done = false;

  const fail = (reason: string) => {
    if (done) return;
    done = true;
    onFail(reason);
  };

  const timer = window.setTimeout(() => {
    if (!loaded) fail(`style-load-timeout-${MAPBOX_LOAD_TIMEOUT_MS}ms`);
  }, MAPBOX_LOAD_TIMEOUT_MS);

  const onLoad = () => {
    loaded = true;
    window.clearTimeout(timer);
  };

  const onError = (e: unknown) => {
    const err = (e as { error?: { status?: number; message?: string } })?.error;
    const status = err?.status;
    if (!loaded && (status === 401 || status === 402 || status === 403)) {
      fail(`style-http-${status}`);
      return;
    }
    errors += 1;
    if (loaded && errors >= MAPBOX_MAX_ERRORS) {
      fail(`map-errors-after-load-${errors}`);
    } else if (!loaded && errors >= MAPBOX_MAX_ERRORS) {
      fail('style-load-errors');
    }
  };

  map.on('load', onLoad);
  map.on('error', onError);
  return () => {
    window.clearTimeout(timer);
    map.off('load', onLoad);
    map.off('error', onError);
  };
}

/* ------------------------------------------------------------------ */
/* Brand paint: nudge the stock night style toward SafeTrip navy/sky.  */
/* Every tweak is best-effort — a layer that does not exist (or a      */
/* property it does not support) is skipped silently. Satellite keeps  */
/* its imagery untouched; only its labels are restyled.                */
/* ------------------------------------------------------------------ */
export function applyBrandPaint(map: MapboxMap, opts: { satellite: boolean }): void {
  let layers: { id: string; type: string }[] = [];
  try {
    layers = (map.getStyle()?.layers ?? []) as { id: string; type: string }[];
  } catch {
    return;
  }

  for (const layer of layers) {
    const id = layer.id;
    const lower = id.toLowerCase();
    try {
      if (!opts.satellite) {
        if (layer.type === 'background') {
          map.setPaintProperty(id, 'background-color', '#0B1226');
        } else if (lower.includes('water') && layer.type === 'fill') {
          map.setPaintProperty(id, 'fill-color', '#0D1B3E');
        } else if (lower.includes('water') && layer.type === 'line') {
          map.setPaintProperty(id, 'line-color', '#14305E');
        } else if (layer.type === 'fill' && (lower.includes('land') || lower.includes('landcover') || lower.includes('landuse') || lower.includes('park') || lower.includes('wood') || lower.includes('grass'))) {
          map.setPaintProperty(id, 'fill-color', lower.includes('building') ? '#16233F' : '#0E1730');
        } else if (layer.type === 'fill' && lower.includes('building')) {
          map.setPaintProperty(id, 'fill-color', '#16233F');
        } else if (layer.type === 'line' && lower.includes('casing') && (lower.includes('road') || lower.includes('motorway') || lower.includes('trunk') || lower.includes('primary') || lower.includes('street'))) {
          map.setPaintProperty(id, 'line-color', '#2C3E63');
        }
      }
      if (layer.type === 'symbol') {
        // Vietnamese labels first where the style's text-field reads a name
        // property; formatted/exotic expressions are left alone.
        const tf: unknown = (() => { try { return map.getLayoutProperty(id, 'text-field'); } catch { return undefined; } })();
        if (tf !== undefined && tf !== null) {
          const s = JSON.stringify(tf);
          if (s.includes('name') && !s.includes('"format"')) {
            try { map.setLayoutProperty(id, 'text-field', ['coalesce', ['get', 'name:vi'], ['get', 'name']]); } catch { /* skip */ }
          }
        }
        try { map.setPaintProperty(id, 'text-color', '#E8EEF9'); } catch { /* icon-only layer */ }
        try { map.setPaintProperty(id, 'text-halo-color', '#0B1226'); } catch { /* skip */ }
        try { map.setPaintProperty(id, 'text-halo-width', 1.4); } catch { /* skip */ }
      }
    } catch {
      /* layer/property not supported — skip silently */
    }
  }
}

/* ------------------------------------------------------------------ */
/* GeoJSON helper: ground circle (for the 15 km gate radius rings).    */
/* ------------------------------------------------------------------ */
export function circlePolygon(lat: number, lng: number, radiusKm: number, steps = 72): [number, number][] {
  const coords: [number, number][] = [];
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return coords;
}
