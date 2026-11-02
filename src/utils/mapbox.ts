import type { Map as MapboxMap } from 'mapbox-gl';
import { ISLAND_GROUPS } from './data';

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

export const MAPBOX_STREET_STYLE = 'mapbox://styles/mapbox/streets-v12';
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
/* Brand paint (v1.27): repaint the stock streets style into a cute    */
/* pastel look in the spirit of Bump/Zenly — warm cream land, soft     */
/* sky-blue water, mint parks, chunky white roads with pastel          */
/* motorways and rounded caps, friendly slate labels with a white      */
/* halo. Every tweak is best-effort — a layer that does not exist (or  */
/* a property it does not support) is skipped silently. Satellite      */
/* keeps its imagery untouched; only its labels are restyled.          */
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
          map.setPaintProperty(id, 'background-color', '#FDF6E9');
        } else if (lower.includes('water') && layer.type === 'fill') {
          map.setPaintProperty(id, 'fill-color', '#A5DBF7');
        } else if (lower.includes('water') && layer.type === 'line') {
          map.setPaintProperty(id, 'line-color', '#8ED0F2');
        } else if (layer.type === 'fill' && lower.includes('building')) {
          map.setPaintProperty(id, 'fill-color', '#F6DDBE');
        } else if (layer.type === 'fill' && (lower.includes('park') || lower.includes('grass') || lower.includes('pitch'))) {
          map.setPaintProperty(id, 'fill-color', '#C9EDBE');
        } else if (layer.type === 'fill' && (lower.includes('wood') || lower.includes('forest') || lower.includes('scrub'))) {
          map.setPaintProperty(id, 'fill-color', '#BCE3C2');
        } else if (layer.type === 'fill' && (lower.includes('land') || lower.includes('landcover') || lower.includes('landuse') || lower.includes('urban'))) {
          map.setPaintProperty(id, 'fill-color', '#FBF2DF');
        } else if (layer.type === 'line' && (lower.includes('motorway') || lower.includes('trunk')) && lower.includes('casing')) {
          map.setPaintProperty(id, 'line-color', '#F5A95C');
        } else if (layer.type === 'line' && (lower.includes('motorway') || lower.includes('trunk'))) {
          map.setPaintProperty(id, 'line-color', '#FFB56B');
          try { map.setLayoutProperty(id, 'line-cap', 'round'); } catch { /* skip */ }
          try { map.setLayoutProperty(id, 'line-join', 'round'); } catch { /* skip */ }
        } else if (layer.type === 'line' && lower.includes('primary') && lower.includes('casing')) {
          map.setPaintProperty(id, 'line-color', '#F2C879');
        } else if (layer.type === 'line' && lower.includes('primary')) {
          map.setPaintProperty(id, 'line-color', '#FFD98E');
          try { map.setLayoutProperty(id, 'line-cap', 'round'); } catch { /* skip */ }
        } else if (layer.type === 'line' && lower.includes('casing') && (lower.includes('road') || lower.includes('secondary') || lower.includes('tertiary') || lower.includes('street') || lower.includes('minor'))) {
          map.setPaintProperty(id, 'line-color', '#EBDCC0');
        } else if (layer.type === 'line' && (lower.includes('road') || lower.includes('secondary') || lower.includes('tertiary') || lower.includes('street') || lower.includes('minor'))) {
          map.setPaintProperty(id, 'line-color', '#FFFFFF');
          try { map.setLayoutProperty(id, 'line-cap', 'round'); } catch { /* skip */ }
          try { map.setLayoutProperty(id, 'line-join', 'round'); } catch { /* skip */ }
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
        if (opts.satellite) {
          try { map.setPaintProperty(id, 'text-color', '#E8EEF9'); } catch { /* icon-only layer */ }
          try { map.setPaintProperty(id, 'text-halo-color', '#0B1226'); } catch { /* skip */ }
          try { map.setPaintProperty(id, 'text-halo-width', 1.4); } catch { /* skip */ }
        } else {
          try { map.setPaintProperty(id, 'text-color', '#41516B'); } catch { /* icon-only layer */ }
          try { map.setPaintProperty(id, 'text-halo-color', '#FFFFFF'); } catch { /* skip */ }
          try { map.setPaintProperty(id, 'text-halo-width', 1.6); } catch { /* skip */ }
        }
      }
    } catch {
      /* layer/property not supported — skip silently */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Sovereignty markers: Hoàng Sa + Trường Sa — a Vietnam flag pinned   */
/* at each archipelago with an always-visible bilingual label          */
/* ("Quần đảo Hoàng Sa" / "Paracel Islands · Vietnam"), on the Mapbox  */
/* maps. Idempotent — safe to re-run after setStyle.                   */
/* ------------------------------------------------------------------ */
export function addSovereigntyMarkers(map: MapboxMap): void {
  try {
    if (!map.hasImage('vn-flag')) {
      const w = 96;
      const h = 72;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rr = (x: number, y: number, rw: number, rh: number, r: number) => {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + rw, y, x + rw, y + rh, r);
          ctx.arcTo(x + rw, y + rh, x, y + rh, r);
          ctx.arcTo(x, y + rh, x, y, r);
          ctx.arcTo(x, y, x + rw, y, r);
          ctx.closePath();
        };
        // white frame, then the red field of the Vietnam flag
        rr(2, 2, w - 4, h - 4, 14);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        rr(8, 8, w - 16, h - 16, 9);
        ctx.fillStyle = '#DA251D';
        ctx.fill();
        // gold star
        const cx = w / 2;
        const cy = h / 2;
        const rOuter = 17;
        const rInner = 7.2;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? rOuter : rInner;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#FFDE00';
        ctx.fill();
        map.addImage('vn-flag', ctx.getImageData(0, 0, w, h), { pixelRatio: 2 });
      }
    }
    if (!map.getSource('safetrip-islands')) {
      map.addSource('safetrip-islands', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: ISLAND_GROUPS.map((g) => ({
            type: 'Feature' as const,
            properties: { name: g.name, sub: `${g.en} · Vietnam` },
            geometry: { type: 'Point' as const, coordinates: [g.lng, g.lat] as [number, number] },
          })),
        },
      });
    }
    if (!map.getLayer('safetrip-islands-flag')) {
      map.addLayer({
        id: 'safetrip-islands-flag', type: 'symbol', source: 'safetrip-islands',
        layout: {
          'icon-image': 'vn-flag',
          'icon-size': 1,
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
    }
    if (!map.getLayer('safetrip-islands-label')) {
      map.addLayer({
        id: 'safetrip-islands-label', type: 'symbol', source: 'safetrip-islands',
        layout: {
          'text-field': ['concat', ['get', 'name'], '\n', ['get', 'sub']],
          'text-size': 13,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'top',
          'text-offset': [0, 0.35],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-letter-spacing': 0.04,
        },
        paint: {
          'text-color': '#9A3412',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2,
        },
      });
    }
  } catch {
    /* best-effort overlay — never break the map over the markers */
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
