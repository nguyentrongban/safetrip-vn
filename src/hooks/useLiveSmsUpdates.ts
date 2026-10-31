import { useCallback, useEffect, useRef, useState } from 'react';
import { beep, vibrate } from '../utils/audio';
import { googleMapsLink, haversineKm } from '../utils/geo';
import { buildSmsUrl, loadSOS } from '../utils/storage';
import { liveLink, loadLiveConfig, loadLiveSessionCode } from '../utils/live';

export const UPDATE_DISTANCE_KM = 1.0;
export const UPDATE_INTERVAL_MIN = 5;

interface SentPoint { lat: number; lng: number; at: number }

/**
 * While an alarm or a monitored trip is active, a single SMS snapshot goes
 * stale as soon as the vehicle moves. This hook watches movement and, when
 * the user has moved >= 500m OR 5 minutes passed since the last sent point,
 * raises a one-tap "send updated location" prompt (SMS opens prefilled with
 * the freshest coordinates; the user still taps Send — browsers require it).
 * Distance threshold is 1km (user's final call, supersedes the earlier 500m).
 */
export function useLiveSmsUpdates(enabled: boolean, lat: number | null, lng: number | null) {
  const [prompt, setPrompt] = useState<SentPoint | null>(null);
  const lastSentRef = useRef<SentPoint | null>(null);

  useEffect(() => {
    if (!enabled) { lastSentRef.current = null; setPrompt(null); return; }
    if (lat === null || lng === null) return;
    if (!lastSentRef.current) { lastSentRef.current = { lat, lng, at: Date.now() }; return; }
    if (prompt) return;
    const d = haversineKm(lat, lng, lastSentRef.current.lat, lastSentRef.current.lng);
    const mins = (Date.now() - lastSentRef.current.at) / 60000;
    if (d >= UPDATE_DISTANCE_KM || mins >= UPDATE_INTERVAL_MIN) {
      beep(2, 1100, 150); vibrate([150, 80, 150]);
      setPrompt({ lat, lng, at: Date.now() });
    }
  }, [enabled, lat, lng, prompt]);

  const sendUpdate = useCallback(() => {
    setPrompt((p) => {
      if (!p) return null;
      const cfg = loadSOS();
      const phone = cfg.phone1 || cfg.phone2;
      if (phone) {
        const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        let body = `VỊ TRÍ MỚI của tôi lúc ${time} (xe vẫn đang di chuyển): ${googleMapsLink(p.lat, p.lng)}`;
        const code = loadLiveSessionCode();
        const liveCfg = loadLiveConfig();
        if (code && liveCfg) body += `\nTheo dõi trực tiếp: ${liveLink(code, liveCfg)}`;
        window.location.href = buildSmsUrl(phone, body);
      }
      lastSentRef.current = { lat: p.lat, lng: p.lng, at: Date.now() };
      return null;
    });
  }, []);

  const dismiss = useCallback(() => {
    setPrompt((p) => {
      if (p) lastSentRef.current = { lat: p.lat, lng: p.lng, at: Date.now() };
      return null;
    });
  }, []);

  return { prompt, sendUpdate, dismiss };
}
