import { PUSH_WORKER_URL } from './push';
import { getDeviceCode } from './consent';
import { haversineKm } from './geo';
import { vnDate } from './vntime';

/**
 * Community danger areas — COMMUNE edition (v1.42; storage moved to the
 * Cloudflare relay in v1.43 at the owner's request — Supabase keeps only
 * live tracking):
 *  - Danger is attached to a whole commune/ward (xã/phường), not a drawn
 *    circle. The app tints the commune's REAL administrative boundary on
 *    the map and warns a traveler who is inside that commune.
 *  - Reports live on the Cloudflare Worker (same station as the DMS push
 *    watcher): POST /zone-report lands as 'pending', GET /zones returns
 *    APPROVED reports only, moderation happens on the Worker's /admin
 *    page — so every area carries a source (community) and a freshness
 *    timestamp (updatedAt, bumped when another traveler re-confirms it).
 *  - Boundary polygons are public OpenStreetMap data: fetched on demand
 *    per commune from Nominatim (simplified), then cached in localStorage
 *    — only communes that actually have approved reports are ever loaded.
 *    If a commune has no mapped boundary, the app falls back to a soft
 *    circle around the report point(s) and says so honestly in the popup.
 */

export type DangerZoneType = 'cuop-giat' | 'don-xe' | 'duong-nguy-hiem';

export interface DangerReport {
  id: string;
  provinceCode: number;
  provinceName: string;
  wardCode: number;
  wardName: string;
  type: DangerZoneType;
  description: string;
  reportLat: number | null;
  reportLng: number | null;
  /** Commune boundary resolved SERVER-side at approval time (v1.47+);
   *  when present the app uses it directly and never fetches OSM. */
  geometry?: ZoneGeometry | null;
  confirmCount: number;
  createdAt: string;
  updatedAt: string;
}

/** GeoJSON geometry with [lng, lat] coordinates (as Nominatim returns). */
export type ZoneGeometry =
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };

/** One commune with ≥1 approved reports, ready to draw + hit-test. */
export interface CommuneZone {
  key: string; // `${provinceCode}:${wardCode}`
  provinceCode: number;
  provinceName: string;
  wardCode: number;
  wardName: string;
  reports: DangerReport[];
  topType: DangerZoneType;
  geometry: ZoneGeometry | null;
  /** Average of the reports' positions — fallback centre when the
   *  commune has no mapped boundary (yet). */
  centroid: { lat: number; lng: number } | null;
}

export const ZONE_TYPE_META: Record<DangerZoneType, { label: string; short: string; color: string }> = {
  'cuop-giat': { label: 'Có báo cáo cướp giật', short: 'Cướp giật', color: '#EF4444' },
  'don-xe': { label: 'Có báo cáo điểm đón xe bất thường', short: 'Đón xe bất thường', color: '#F59E0B' },
  'duong-nguy-hiem': { label: 'Có báo cáo đoạn đường nguy hiểm', short: 'Đường nguy hiểm', color: '#A855F7' },
};

/** Severity order for choosing a commune's tint when it has several
 *  report types: snatching first, then pickup scams, then bad roads. */
const TYPE_SEVERITY: DangerZoneType[] = ['cuop-giat', 'don-xe', 'duong-nguy-hiem'];

/** Radius of the honest fallback circle when a boundary is unavailable. */
export const FALLBACK_RADIUS_M = 500;

// ---------------------------------------------------------------------------
// Cloudflare relay endpoints (the response shapes are already the
// client's camelCase shapes — the Worker owns the contract).
// ---------------------------------------------------------------------------
function workerBase(): string {
  return PUSH_WORKER_URL.replace(/\/+$/, '');
}

async function workerPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${workerBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`worker ${path} ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const REPORTS_CACHE_KEY = 'safetrip_danger_reports_v2';

export function loadCachedReports(): DangerReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { reports?: DangerReport[] };
    return Array.isArray(parsed.reports) ? parsed.reports : [];
  } catch { return []; }
}

/** Fetch APPROVED reports from the relay; on any failure falls back to
 *  the last cached set so the feature never breaks the monitor offline. */
export async function fetchDangerReports(): Promise<DangerReport[]> {
  if (!PUSH_WORKER_URL) return loadCachedReports();
  try {
    const res = await fetch(`${workerBase()}/zones`);
    if (!res.ok) throw new Error(`worker /zones ${res.status}`);
    const json = (await res.json()) as { zones?: DangerReport[] };
    const rows = Array.isArray(json.zones) ? json.zones : [];
    const reports: DangerReport[] = rows.map((r) => ({
      ...r,
      type: (r.type as DangerZoneType) in ZONE_TYPE_META ? r.type : 'duong-nguy-hiem',
    }));
    try { localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify({ at: Date.now(), reports })); } catch { /* storage full/blocked */ }
    return reports;
  } catch {
    return loadCachedReports();
  }
}

export interface ZoneReportInput {
  provinceCode: number; provinceName: string;
  wardCode: number; wardName: string;
  type: DangerZoneType; description: string;
  lat: number | null; lng: number | null;
}

/** Submit a report for a whole commune. It lands as 'pending' — the
 *  commune only lights up on the map after the owner approves it. */
export async function reportDangerZone(input: ZoneReportInput): Promise<void> {
  await workerPost<unknown>('/zone-report', {
    provinceCode: input.provinceCode, provinceName: input.provinceName,
    wardCode: input.wardCode, wardName: input.wardName,
    type: input.type, description: input.description,
    lat: input.lat, lng: input.lng,
  });
}

const ZONE_CONFIRMED_KEY = 'safetrip_zone_confirmed_v1';

/** Report ids THIS device has already confirmed — remembered on-device
 * so the button keeps saying "Bạn đã xác nhận rồi" after a reload
 * (owner 2026-11-06). The server enforces the same rule for counting. */
export function loadConfirmedZoneIds(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(ZONE_CONFIRMED_KEY) || '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch { return new Set(); }
}

function rememberConfirmedZoneId(id: string): void {
  try {
    const set = loadConfirmedZoneIds();
    set.add(id);
    localStorage.setItem(ZONE_CONFIRMED_KEY, JSON.stringify([...set].slice(-500)));
  } catch { /* storage blocked */ }
}

/** Re-confirm an approved report is still valid (bumps its freshness).
 * ONE confirmation per device per report (owner 2026-11-06): the
 * anonymous device code rides along so the server counts each
 * (report, device) pair exactly once, and the id is remembered on this
 * device so the button stays confirmed across reloads. */
export async function confirmDangerZone(id: string): Promise<void> {
  rememberConfirmedZoneId(id);
  try { await workerPost<unknown>('/zone-confirm', { id, device: getDeviceCode() }); } catch { /* best effort */ }
}

// ---------------------------------------------------------------------------
// Grouping: reports → communes.
// ---------------------------------------------------------------------------
export function buildCommuneZones(reports: DangerReport[]): CommuneZone[] {
  const byKey = new Map<string, DangerReport[]>();
  for (const r of reports) {
    const key = `${r.provinceCode}:${r.wardCode}:${r.wardName}`;
    const arr = byKey.get(key) ?? [];
    arr.push(r);
    byKey.set(key, arr);
  }
  const zones: CommuneZone[] = [];
  for (const [key, rs] of byKey) {
    const first = rs[0];
    const topType = TYPE_SEVERITY.find((t) => rs.some((r) => r.type === t)) ?? 'duong-nguy-hiem';
    const pts = rs.filter((r) => r.reportLat !== null && r.reportLng !== null);
    const centroid = pts.length
      ? { lat: pts.reduce((s, r) => s + (r.reportLat as number), 0) / pts.length, lng: pts.reduce((s, r) => s + (r.reportLng as number), 0) / pts.length }
      : null;
    zones.push({
      key,
      provinceCode: first.provinceCode, provinceName: first.provinceName,
      wardCode: first.wardCode, wardName: first.wardName,
      reports: rs, topType, geometry: rs.find((r) => r.geometry)?.geometry ?? null, centroid,
    });
  }
  return zones;
}

export interface ZoneTypeGroup {
  type: DangerZoneType;
  reports: DangerReport[];
  totalConfirms: number;
}

/** Group one commune's reports BY TYPE (owner 2026-11-06): the map popup
 * shows ONE compact row per type ("3 báo cáo · 3 lượt xác nhận") and the
 * per-report detail lives in a sheet behind that row. Groups follow the
 * severity order; reports inside a group are newest-updated first. */
export function groupZoneReports(zone: CommuneZone): ZoneTypeGroup[] {
  return TYPE_SEVERITY
    .map((type) => {
      const reports = zone.reports
        .filter((r) => r.type === type)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      return { type, reports, totalConfirms: reports.reduce((s, r) => s + r.confirmCount, 0) };
    })
    .filter((g) => g.reports.length > 0);
}

// ---------------------------------------------------------------------------
// Commune boundary polygons from OpenStreetMap (Nominatim), cached.
// ---------------------------------------------------------------------------
const GEOM_CACHE_PREFIX = 'safetrip_commune_geom_v2_';
const GEOM_NULL_TTL_MS = 3600 * 1000;

interface GeomCache { at: number; geom: ZoneGeometry | null }

function readGeomCache(key: string): GeomCache | null {
  try {
    const raw = localStorage.getItem(GEOM_CACHE_PREFIX + key);
    if (!raw) return null;
    const c = JSON.parse(raw) as GeomCache;
    if (c.geom === null && Date.now() - c.at > GEOM_NULL_TTL_MS) return null;
    return c;
  } catch { return null; }
}

/** Ray-casting point-in-ring on [lng, lat] coordinates. */
function ringContains(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonContains(lng: number, lat: number, rings: [number, number][][]): boolean {
  if (rings.length === 0 || !ringContains(lng, lat, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (ringContains(lng, lat, rings[k])) return false; // hole
  return true;
}

export function pointInGeometry(lat: number, lng: number, geom: ZoneGeometry): boolean {
  if (geom.type === 'Polygon') return polygonContains(lng, lat, geom.coordinates);
  return geom.coordinates.some((poly) => polygonContains(lng, lat, poly));
}

/** Is the traveler inside this commune zone? Real boundary when we have
 *  it; the honest fallback circle around the report point(s) otherwise. */
export function communeContains(zone: CommuneZone, lat: number, lng: number): boolean {
  if (zone.geometry) return pointInGeometry(lat, lng, zone.geometry);
  if (zone.centroid) return haversineKm(lat, lng, zone.centroid.lat, zone.centroid.lng) * 1000 <= FALLBACK_RADIUS_M;
  return false;
}

interface NominatimHit {
  class?: string; type?: string;
  geojson?: { type?: string; coordinates?: unknown };
}

/**
 * Fetch one commune's boundary. Candidates are verified against a hint
 * point (a report's GPS position) whenever one exists, so a same-named
 * commune elsewhere in Vietnam can't be picked by mistake. Returns null
 * when OSM has no boundary for the commune (caller uses the fallback).
 */
export async function fetchCommuneGeometry(
  zone: CommuneZone, hint: { lat: number; lng: number } | null,
): Promise<ZoneGeometry | null> {
  // Server-resolved boundary (attached at approval time) always wins —
  // no OSM fetch, no cache trap.
  if (zone.geometry) return zone.geometry;
  const cached = readGeomCache(zone.key);
  if (cached) return cached.geom;
  let geom: ZoneGeometry | null = null;
  try {
    const q = encodeURIComponent(`${zone.wardName}, ${zone.provinceName}, Việt Nam`);
    // No polygon_threshold — the full boundary is only ~1–3 KB and the
    // simplification crushed real outlines (55 pts → 10 for Bến Thành).
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&limit=5&q=${q}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const hits = (await res.json()) as NominatimHit[];
      const adminCandidates: ZoneGeometry[] = [];
      const candidates: ZoneGeometry[] = [];
      for (const h of hits) {
        const g = h.geojson;
        if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon') && g.coordinates) {
          (h.type === 'administrative' ? adminCandidates : candidates).push(g as ZoneGeometry);
        }
      }
      const ordered = [...adminCandidates, ...candidates];
      if (hint) geom = ordered.find((c) => pointInGeometry(hint.lat, hint.lng, c)) ?? null;
      if (!geom && !hint) geom = ordered[0] ?? null;
      // With a hint but no containing candidate: leave geom null — a
      // wrong-commune polygon is worse than the honest fallback circle.
    }
  } catch { geom = null; }
  try { localStorage.setItem(GEOM_CACHE_PREFIX + zone.key, JSON.stringify({ at: Date.now(), geom } satisfies GeomCache)); } catch { /* storage full/blocked */ }
  return geom;
}

/** Reverse-geocode a GPS position to commune + province NAMES (used to
 *  pre-fill the report form with "the commune you are standing in").
 *  Returns null on any failure — the picker stays manual then. */
export async function reverseCommune(lat: number, lng: number): Promise<{ ward: string; province: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as { address?: Record<string, string> };
    const a = json.address ?? {};
    const ward = a.quarter || a.suburb || a.village || a.town || a.neighbourhood || a.hamlet || '';
    const province = a.state || a.city || a.province || '';
    if (!ward || !province) return null;
    return { ward, province };
  } catch { return null; }
}

/** Loose Vietnamese name matching for picker prefill: case- and
 *  diacritic-insensitive, and tolerant of the API's administrative
 *  prefixes ("Phường ", "Xã ", "Thành phố ", "Tỉnh "…). */
export function normalizeAdminName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/^(phuong|xa|thi tran|dac khu|thanh pho|tinh|thi xa)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function namesMatch(a: string, b: string): boolean {
  const na = normalizeAdminName(a);
  const nb = normalizeAdminName(b);
  return na !== '' && (na === nb || na.includes(nb) || nb.includes(na));
}

/** dd/mm/yyyy for freshness labels ("Cập nhật 03/11/2026") — always
 * the VIETNAM calendar day, whatever timezone the phone is in. */
export function formatZoneDate(iso: string): string {
  return vnDate(iso);
}
