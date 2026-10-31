import { useEffect, useRef, useState } from 'react';
import { haversineKm } from '../utils/geo';
import { clearLiveSession, ensureLiveSession, pushPosition, type LiveConfig } from '../utils/live';

/**
 * Sender engine for Grab-style live tracking. While enabled (SOS alarm or an
 * active monitored trip) and a Supabase config exists, it pushes the current
 * position every 20s and whenever the device moved >200m, so the family's
 * viewer page (?live=CODE) sees the dot glide in near real time. The 20s/200m
 * cadence is the community bandwidth diet: ~0.5MB per trip-hour, so the free
 * Supabase tier carries ~10,000 trip-hours/month for the whole community.
 * Push failures (no internet) just flip `online` to false; the SMS fallback
 * (useLiveSmsUpdates, 1km cadence) covers the offline case.
 */
export function useLiveTracking(enabled: boolean, cfg: LiveConfig | null, lat: number | null, lng: number | null, speedKmh: number | null) {
  const [code, setCode] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const geoRef = useRef({ lat, lng, speedKmh });
  geoRef.current = { lat, lng, speedKmh };
  const lastPushRef = useRef<{ lat: number; lng: number } | null>(null);
  // Owner's three-state model: ONLY a deliberate in-app stop (end trip /
  // stop SOS) may tell the family "trip ended". Closing/swiping the app
  // must leave SILENCE — the viewer's silence alarm treats an unexplained
  // stop as possible danger (phone seized, forced to stop sharing).
  // pagehide marks a closing page so the cleanup below stays silent.
  const closingRef = useRef(false);

  useEffect(() => {
    const onHide = () => { closingRef.current = true; };
    const onShow = () => { closingRef.current = false; };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    return () => { window.removeEventListener('pagehide', onHide); window.removeEventListener('pageshow', onShow); };
  }, []);

  // Keep the screen awake while sharing: an auto-sleeping screen suspends
  // web geolocation on most phones, which would fake a "sudden stop".
  useEffect(() => {
    if (!enabled) return;
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      try { lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen'); } catch { /* unsupported */ }
    };
    void acquire();
    const onVis = () => { if (document.visibilityState === 'visible') void acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); void lock?.release().catch(() => {}); };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !cfg) { setCode(null); return; }
    const sessionCode = ensureLiveSession();
    setCode(sessionCode);
    let cancelled = false;

    const push = async () => {
      const g = geoRef.current;
      if (g.lat === null || g.lng === null || cancelled) return;
      const ok = await pushPosition(cfg, sessionCode, g.lat, g.lng, g.speedKmh, true);
      if (!cancelled) { setOnline(ok); if (ok) lastPushRef.current = { lat: g.lat, lng: g.lng }; }
    };

    void push();
    const id = window.setInterval(() => { void push(); }, 20000);

    return () => {
      cancelled = true;
      clearInterval(id);
      // Deliberate stop while the page stays alive -> one last active=false
      // push so the family sees a calm "Chuyến đi đã kết thúc". If the page
      // itself is closing (pagehide seen), stay silent on purpose.
      if (!closingRef.current) {
        const last = lastPushRef.current;
        if (last) void pushPosition(cfg, sessionCode, last.lat, last.lng, geoRef.current.speedKmh, false, true);
        // Rotate to a fresh code for the next trip/SOS: a link shared for
        // THIS trip must not silently open the next one (v1.14 security).
        clearLiveSession();
      }
    };
  }, [enabled, cfg]);

  // Early push when moved >200m between 20s ticks.
  useEffect(() => {
    if (!enabled || !cfg || !code || lat === null || lng === null) return;
    const last = lastPushRef.current;
    if (last && haversineKm(lat, lng, last.lat, last.lng) >= 0.2) {
      void pushPosition(cfg, code, lat, lng, speedKmh, true).then((ok) => {
        setOnline(ok);
        if (ok) lastPushRef.current = { lat, lng };
      });
    }
  }, [enabled, cfg, code, lat, lng, speedKmh]);

  return { code, online };
}
