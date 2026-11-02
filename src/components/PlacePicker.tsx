import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react';
import type { PlacePoint } from '../types';
import { fetchProvinces, fetchWards, type VnProvince, type VnWard } from '../utils/vnAdmin';

/**
 * Detailed place picker (v1.29) — replaces the old province-only dropdown.
 * Three ways to set a point:
 *  • "Vị trí hiện tại" — snapshot the phone's GPS (start point only)
 *  • Tìm kiếm — free-text search (Nominatim, Vietnam only)
 *  • Phường xã — province → ward/commune selects, geocoded to a point
 * (The tap-on-map mode was removed in v1.30 at tấn's request.)
 */

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

function shortName(hit: NominatimHit): string {
  const a = hit.address ?? {};
  const ward = a.suburb || a.quarter || a.village || a.hamlet || a.neighbourhood || '';
  const district = a.city_district || a.county || a.town || a.district || '';
  const province = a.city || a.state || '';
  const parts = [ward, district, province].filter((x, i, arr) => x && arr.indexOf(x) === i);
  if (parts.length > 0) return parts.join(', ');
  return hit.display_name.split(',').slice(0, 3).join(',').trim();
}

async function nominatim(path: string): Promise<NominatimHit[] | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = (await res.json()) as NominatimHit[];
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

const searchPlaces = (q: string) =>
  nominatim(`search?format=jsonv2&limit=6&countrycodes=vn&addressdetails=1&accept-language=vi&q=${encodeURIComponent(q)}`);

interface Props {
  label: string;
  value: PlacePoint | null;
  onChange: (p: PlacePoint | null) => void;
  /** Show the "use my current position" shortcut (start point). */
  allowCurrent?: boolean;
  currentPos?: { lat: number; lng: number } | null;
}

type Mode = 'search' | 'ward';

export default function PlacePicker({ label, value, onChange, allowCurrent = false, currentPos = null }: Props) {
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [provinces, setProvinces] = useState<VnProvince[] | null>(null);
  const [wards, setWards] = useState<VnWard[] | null>(null);
  const [provinceCode, setProvinceCode] = useState<number | ''>('');
  const [wardBusy, setWardBusy] = useState(false);
  const [wardNote, setWardNote] = useState('');
  const debounceRef = useRef<number | null>(null);

  /* debounced free-text search */
  useEffect(() => {
    if (mode !== 'search') return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3) { setResults(null); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = window.setTimeout(() => {
      void searchPlaces(q).then((hits) => { setResults(hits); setSearching(false); });
    }, 550);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, mode]);

  /* load provinces lazily when the ward mode opens */
  useEffect(() => {
    if (mode !== 'ward' || provinces !== null) return;
    void fetchProvinces().then(setProvinces).catch(() => setProvinces([]));
  }, [mode, provinces]);

  useEffect(() => {
    if (provinceCode === '') { setWards(null); return; }
    setWards(null);
    void fetchWards(provinceCode).then(setWards).catch(() => setWards([]));
  }, [provinceCode]);

  const pickWard = async (wardName: string) => {
    const prov = provinces?.find((p) => p.code === provinceCode);
    if (!prov || !wardName) return;
    setWardBusy(true);
    setWardNote('');
    const hits = await nominatim(
      `search?format=jsonv2&limit=1&countrycodes=vn&accept-language=vi&q=${encodeURIComponent(`${wardName}, ${prov.name}`)}`,
    );
    setWardBusy(false);
    if (hits && hits.length > 0) {
      onChange({ lat: parseFloat(hits[0].lat), lng: parseFloat(hits[0].lon), name: `${wardName}, ${prov.name}` });
    } else {
      setWardNote('Chưa tìm thấy vị trí của xã/phường này — thử lại bằng ô Tìm kiếm.');
    }
  };

  const chip = (m: Mode, text: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`px-3 py-1.5 rounded-full text-xs font-bold ${mode === m ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
    >
      {text}
    </button>
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-slate-300">{label}</p>

      {value ? (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/50 rounded-2xl px-3.5 py-3">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="flex-1 min-w-0 text-sm font-bold text-white truncate">{value.name}</p>
          <button type="button" onClick={() => onChange(null)} className="shrink-0 text-slate-400 hover:text-white p-1" aria-label="Chọn lại">
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {allowCurrent && (
              <button
                type="button"
                disabled={!currentPos}
                onClick={() => currentPos && onChange({ lat: currentPos.lat, lng: currentPos.lng, name: 'Vị trí hiện tại' })}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-sky-600 text-white disabled:bg-slate-800 disabled:text-slate-500 flex items-center gap-1"
              >
                <LocateFixed className="w-3.5 h-3.5" /> Vị trí hiện tại
              </button>
            )}
            {chip('search', '🔍 Tìm kiếm')}
            {chip('ward', '🏛 Phường xã')}
          </div>

          {mode === 'search' && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Gõ tên nơi, đường, phường xã…"
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-10 pr-4 py-3 text-base text-white placeholder:text-slate-500"
                />
              </div>
              {searching && <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tìm…</p>}
              {results !== null && !searching && results.length === 0 && (
                <p className="text-xs text-slate-400">Không thấy nơi này. Thử gõ thêm tên tỉnh, hoặc dùng mục Phường xã.</p>
              )}
              {results?.map((h, i) => (
                <button
                  key={`${h.lat}-${h.lon}-${i}`}
                  type="button"
                  onClick={() => onChange({ lat: parseFloat(h.lat), lng: parseFloat(h.lon), name: shortName(h) })}
                  className="w-full text-left bg-slate-900 border border-slate-700 rounded-2xl px-3.5 py-2.5 hover:border-sky-500"
                >
                  <span className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white truncate">{shortName(h)}</span>
                      <span className="block text-[11px] text-slate-400 truncate">{h.display_name}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {mode === 'ward' && (
            <div className="space-y-2">
              <select
                value={provinceCode}
                onChange={(e) => setProvinceCode(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-base text-white"
              >
                <option value="">— Chọn tỉnh / thành phố —</option>
                {provinces?.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
              <select
                disabled={provinceCode === '' || wards === null}
                defaultValue=""
                onChange={(e) => void pickWard(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-base text-white disabled:opacity-50"
              >
                <option value="">— Chọn phường / xã —</option>
                {wards?.map((w) => <option key={w.code} value={w.name}>{w.name}</option>)}
              </select>
              {wardBusy && <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tìm vị trí phường xã…</p>}
              {wardNote && <p className="text-xs text-amber-300">{wardNote}</p>}
            </div>
          )}

        </>
      )}
    </div>
  );
}
