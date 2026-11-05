import { useCallback, useEffect, useRef, useState } from 'react';
import { askConsent, hasLocationConsent } from '../utils/consent';

export interface GeoState {
  lat: number | null; lng: number | null; speedKmh: number | null;
  accuracy: number | null;
  /** error = permission is fine but no GPS fix (timeout / unavailable) — the UI must say so instead of looking dead. */
  status: 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported' | 'error';
  error: string;
}

const IDLE: GeoState = { lat: null, lng: null, speedKmh: null, accuracy: null, status: 'idle', error: '' };

export function useGeolocation() {
  const [state, setState] = useState<GeoState>(IDLE);
  const watchId = useRef<number | null>(null);

  const apply = useCallback((pos: GeolocationPosition) => {
    setState({
      lat: pos.coords.latitude, lng: pos.coords.longitude,
      speedKmh: pos.coords.speed !== null ? Math.round(pos.coords.speed * 3.6) : null,
      accuracy: Math.round(pos.coords.accuracy), status: 'granted', error: '',
    });
  }, []);
  const fail = useCallback((err: GeolocationPositionError) => {
    setState((s) => ({
      ...s,
      status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
      error: err.message,
    }));
  }, []);

  const requestOnce = useCallback(() => {
    // Consent gate (Nghị định 13/2023): without a valid in-app consent
    // on file, never touch the browser's GPS — open the consent sheet.
    if (!hasLocationConsent()) { askConsent(); return; }
    if (!('geolocation' in navigator)) { setState((s) => ({ ...s, status: 'unsupported', error: 'Thiết bị không hỗ trợ GPS' })); return; }
    setState((s) => ({ ...s, status: 'locating', error: '' }));
    // High accuracy first; indoors the first fix often times out on iPhone,
    // so fall back ONCE to a coarse fix (cell/wifi) instead of failing mute.
    navigator.geolocation.getCurrentPosition(apply, (err) => {
      if (err.code === err.PERMISSION_DENIED) { fail(err); return; }
      navigator.geolocation.getCurrentPosition(apply, fail, { enableHighAccuracy: false, timeout: 25000, maximumAge: 60000 });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  }, [apply, fail]);

  const startWatch = useCallback(() => {
    if (!hasLocationConsent()) { askConsent(); return; }
    if (!('geolocation' in navigator)) return;
    if (watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(apply, fail, { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 });
  }, [apply, fail]);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
  }, []);

  useEffect(() => () => stopWatch(), [stopWatch]);
  useEffect(() => { if (hasLocationConsent()) requestOnce(); }, [requestOnce]);

  return { ...state, requestOnce, startWatch, stopWatch, watching: watchId.current !== null };
}
