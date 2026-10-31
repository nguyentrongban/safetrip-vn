/**
 * Live tracking (Grab-style) over a free Supabase project, talked to directly
 * via PostgREST — no SDK, no server of ours. The project URL + anon key are
 * pasted once by the user inside the app and kept in LocalStorage.
 * The 8-char session code is the only "key" to a live stream.
 */
export interface LiveConfig { url: string; anonKey: string }
export interface LiveRow { code: string; lat: number; lng: number; speed: number | null; active: boolean; updated_at: string }

const CK = { url: 'safetrip_live_url', key: 'safetrip_live_key', session: 'safetrip_live_session' } as const;

/**
 * The shared community relay, baked in by the app owner so every user gets
 * live tracking with zero setup. Project 'safetrip-live' (created 2026-10-31,
 * supabase/live.sql applied, end-to-end REST roundtrip verified by the owner
 * before shipping). The publishable key is public-by-design; RLS + random
 * session codes protect the data.
 */
export const DEFAULT_LIVE_CONFIG: LiveConfig | null = {
  url: 'https://nmmpqvbrljxfujjgstjd.supabase.co',
  anonKey: 'sb_publishable_BiqRma07SCTqXO0ZuzQ5ug_UKEE47Hp',
};

export function loadOwnLiveConfig(): LiveConfig | null {
  try {
    const url = localStorage.getItem(CK.url) || '';
    const anonKey = localStorage.getItem(CK.key) || '';
    if (url.startsWith('https://') && anonKey.length > 20) {
      const own = { url: url.replace(/\/$/, ''), anonKey };
      // Default is the SHARED station (v1.17): a saved "own" config identical
      // to the shared relay is not a real own station — older versions
      // auto-saved it from ?live= links — so drop it and fall back to the
      // shared default. A deliberately saved, DIFFERENT station is kept.
      if (DEFAULT_LIVE_CONFIG && own.url === DEFAULT_LIVE_CONFIG.url && own.anonKey === DEFAULT_LIVE_CONFIG.anonKey) {
        localStorage.removeItem(CK.url); localStorage.removeItem(CK.key);
        return null;
      }
      return own;
    }
  } catch { /* storage unavailable */ }
  return null;
}

/** Effective config: a user's own relay (advanced) wins, else the shared community relay. */
export function loadLiveConfig(): LiveConfig | null {
  return loadOwnLiveConfig() || DEFAULT_LIVE_CONFIG;
}
export function saveLiveConfig(cfg: LiveConfig | null): void {
  if (!cfg) { localStorage.removeItem(CK.url); localStorage.removeItem(CK.key); return; }
  localStorage.setItem(CK.url, cfg.url.trim().replace(/\/$/, ''));
  localStorage.setItem(CK.key, cfg.anonKey.trim());
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function genLiveCode(): string {
  // 10 chars from a 31-symbol alphabet ≈ 8×10^14 combinations — the code IS
  // the key to a live location, so it must be unguessable (v1.14, was 8).
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

/** Returns the current session code, creating (and saving) one if needed. Synchronous on purpose: the first SOS SMS must already contain the live link. */
export function ensureLiveSession(): string {
  try {
    const raw = localStorage.getItem(CK.session);
    if (raw) { const s = JSON.parse(raw) as { code: string }; if (s.code && s.code.length === 10) return s.code; }
  } catch { /* corrupted */ }
  const code = genLiveCode();
  localStorage.setItem(CK.session, JSON.stringify({ code, startedAt: Date.now() }));
  return code;
}
export function loadLiveSessionCode(): string | null {
  try {
    const raw = localStorage.getItem(CK.session);
    if (raw) return (JSON.parse(raw) as { code: string }).code || null;
  } catch { /* corrupted */ }
  return null;
}
export function clearLiveSession(): void { localStorage.removeItem(CK.session); }

export function liveLink(code: string, cfg?: LiveConfig | null): string {
  const base = `${window.location.origin}${window.location.pathname}?live=${code}`;
  // The family member's phone has no config saved, so the link itself carries
  // it (base64url). The anon key is public-by-design, but since v1.14 it can
  // only call two guarded RPCs (live_push/live_fetch) — the table is locked,
  // and the session code in the link is the actual key to the location.
  if (!cfg) return base;
  const enc = btoa(`${cfg.url}|${cfg.anonKey}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base}&c=${enc}`;
}

export function decodeConfigParam(param: string): LiveConfig | null {
  try {
    const b64 = param.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const [url, anonKey] = raw.split('|');
    if (url && anonKey && url.startsWith('https://')) return { url, anonKey };
  } catch { /* bad param */ }
  return null;
}

function headers(cfg: LiveConfig): Record<string, string> {
  return { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json' };
}

/** Push one position through the guarded live_push RPC (v1.14 security:
 *  the table itself is locked — the public key can no longer read or write
 *  it directly, so nobody can dump everyone's locations or hijack a code
 *  they don't know). Returns false when offline / not configured / rejected.
 *  keepalive lets a final "trip ended" push complete while the page closes. */
export async function pushPosition(cfg: LiveConfig, code: string, lat: number, lng: number, speedKmh: number | null, active: boolean, keepalive = false): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${cfg.url}/rest/v1/rpc/live_push`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify({ p_code: code, p_lat: lat, p_lng: lng, p_speed: speedKmh, p_active: active }),
      signal: ctrl.signal,
      keepalive,
    });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}

export async function fetchPosition(cfg: LiveConfig, code: string): Promise<LiveRow | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${cfg.url}/rest/v1/rpc/live_fetch`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify({ p_code: code.toUpperCase() }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const rows = (await res.json()) as LiveRow[];
    return rows[0] || null;
  } catch { return null; }
}
