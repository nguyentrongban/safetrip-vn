import type { PlacePoint } from '../types';
import { MAPBOX_TOKEN, mapboxConfigured } from './mapbox';
import { simplifyRoute } from './geo';

/**
 * Driving-route prediction (v1.29): Mapbox Directions first (the app's
 * existing token), OSRM's free public router as fallback. Returns the
 * route polyline ([lat, lng] pairs), total distance and drive time —
 * used for the automatic ETA and the off-route alarms. null on any
 * failure (offline, quota…) so a trip can still start without a route.
 */
export interface RouteResult {
  points: [number, number][];
  distanceKm: number;
  durationMin: number;
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface RawRoute { coords: [number, number][]; distanceM: number; durationS: number }

function parse(j: unknown): RawRoute | null {
  const routes = (j as { routes?: unknown[] })?.routes;
  if (!Array.isArray(routes) || routes.length === 0) return null;
  const r = routes[0] as { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number };
  const coords = r.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2 || typeof r.distance !== 'number' || typeof r.duration !== 'number') return null;
  // Directions APIs speak [lng, lat]; the app speaks [lat, lng].
  return { coords: coords.map(([ln, la]) => [la, ln] as [number, number]), distanceM: r.distance, durationS: r.duration };
}

export async function fetchRoute(from: PlacePoint, to: PlacePoint): Promise<RouteResult | null> {
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  let raw: RawRoute | null = null;
  if (mapboxConfigured()) {
    const j = await fetchJson(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${path}?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`,
    );
    raw = parse(j);
  }
  if (!raw) {
    const j = await fetchJson(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`);
    raw = parse(j);
  }
  if (!raw) return null;
  return {
    points: simplifyRoute(raw.coords, 0.03),
    distanceKm: raw.distanceM / 1000,
    durationMin: raw.durationS / 60,
  };
}
