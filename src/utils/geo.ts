import type { BorderPoint, GeoPoint } from '../types';

/** Haversine: distance in KM between two GPS points. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function toRad(deg: number): number { return (deg * Math.PI) / 180; }

export function nearestBorder(point: GeoPoint, borders: BorderPoint[]): { border: BorderPoint; distanceKm: number } {
  let best: BorderPoint = borders[0];
  let bestKm = Infinity;
  for (const b of borders) {
    const d = haversineKm(point.lat, point.lng, b.lat, b.lng);
    if (d < bestKm) { bestKm = d; best = b; }
  }
  return { border: best, distanceKm: bestKm };
}

export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** Reverse geocode via Nominatim (free, no key). Returns '' on any failure (offline etc). */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!res.ok) return '';
    const j = await res.json();
    return (j.display_name as string) || '';
  } catch { return ''; }
}

export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '');
}
export function normalizePhone(input: string): string {
  return input.replace(/[^0-9]/g, '').replace(/^84/, '0');
}
