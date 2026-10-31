/**
 * Vietnam administrative units — POST-MERGER structure (from 2025-07-01):
 * 34 provinces/cities → 3,321 wards/communes, NO district level anymore.
 * Data comes from the free public API provinces.open-api.vn (v2), which
 * sends CORS `*`, so the browser can call it directly. Responses are cached
 * in LocalStorage (they change rarely) and every caller must handle the
 * offline failure case with a fallback.
 */
export interface VnProvince { code: number; name: string }
export interface VnWard { code: number; name: string }

const API = 'https://provinces.open-api.vn/api/v2';
const PROV_KEY = 'safetrip_vn_provinces_v2';
const WARD_KEY = (code: number) => `safetrip_vn_wards_v2_${code}`;
const TTL_MS = 30 * 24 * 3600 * 1000;

interface Cache<T> { at: number; data: T }

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cache<T>;
    if (Date.now() - c.at > TTL_MS) return null;
    return c.data;
  } catch { return null; }
}
function writeCache<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data } satisfies Cache<T>)); } catch { /* full/blocked */ }
}

export async function fetchProvinces(): Promise<VnProvince[]> {
  const cached = readCache<VnProvince[]>(PROV_KEY);
  if (cached) return cached;
  const res = await fetch(`${API}/p/`);
  if (!res.ok) throw new Error(`provinces ${res.status}`);
  const rows = (await res.json()) as { code: number; name: string }[];
  const data = rows.map((r) => ({ code: r.code, name: r.name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  writeCache(PROV_KEY, data);
  return data;
}

export async function fetchWards(provinceCode: number): Promise<VnWard[]> {
  const cached = readCache<VnWard[]>(WARD_KEY(provinceCode));
  if (cached) return cached;
  const res = await fetch(`${API}/p/${provinceCode}?depth=2`);
  if (!res.ok) throw new Error(`wards ${res.status}`);
  const json = (await res.json()) as { wards?: { code: number; name: string }[] };
  const data = (json.wards || []).map((w) => ({ code: w.code, name: w.name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  writeCache(WARD_KEY(provinceCode), data);
  return data;
}
