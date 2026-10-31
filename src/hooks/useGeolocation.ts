import { useCallback, useEffect, useRef, useState } from 'react';

export interface GeoState {
  lat: number | null; lng: number | null; speedKmh: number | null;
  accuracy: number | null; status: 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported';
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
    setState((s) => ({ ...s, status: err.code === err.PERMISSION_DENIED ? 'denied' : s.status, error: err.message }));
  }, []);

  const requestOnce = useCallback(() => {
    if (!('geolocation' in navigator)) { setState((s) => ({ ...s, status: 'unsupported', error: 'Thiết bị không hỗ trợ GPS' })); return; }
    setState((s) => ({ ...s, status: 'locating' }));
    navigator.geolocation.getCurrentPosition(apply, fail, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  }, [apply, fail]);

  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    if (watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(apply, fail, { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 });
  }, [apply, fail]);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
  }, []);

  useEffect(() => () => stopWatch(), [stopWatch]);
  useEffect(() => { requestOnce(); }, [requestOnce]);

  return { ...state, requestOnce, startWatch, stopWatch, watching: watchId.current !== null };
}
