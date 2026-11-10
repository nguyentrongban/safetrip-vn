import { useEffect, useState } from 'react';
import { BORDER_POINTS } from './data';
import { haversineKm } from './geo';

/**
 * GPS simulation mode (v1.81) — TEST TOOL ONLY.
 *
 * Exists so the owner can verify the near-border alarm without travelling
 * to a border. It is invisible in normal use: the panel only appears when
 * the app is opened with ?sim=1, and a drive only runs after an explicit
 * tap. While a simulated drive runs, App.tsx feeds these coordinates to
 * every screen INSTEAD of the real GPS — and, for safety, live-relay
 * pushes, SMS-composer auto-opens and DMS server sync are all suppressed,
 * so a fake position can never reach relatives or the shared station.
 * Nothing is persisted; closing the app ends the simulation.
 *
 * Track: a straight westward drive along the gate's parallel toward
 * Cửa khẩu Mỹ Quý Tây (Long An), starting ~27 km out — the same track
 * verified against this codebase's own distance functions.
 */
const GATE = BORDER_POINTS.find((b) => b.id === 'my-quy-tay')!;
const START = { lat: GATE.lat, lng: 106.4333 };
const END_LNG = 106.1873; // ~0.4 km short of the gate itself
const STEP_KM = 0.55;
const TICK_MS = 1500;
const KM_PER_DEG_LNG = 109.4; // at lat ~10.85
export const SIM_SPEED_KMH = 80;
export const SIM_GATE_NAME = GATE.name;

export interface SimSnapshot {
  enabled: boolean;
  driving: boolean;
  done: boolean;
  lat: number;
  lng: number;
  gateKm: number;
}

const simEnabled = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('sim') === '1';

let snap: SimSnapshot = {
  enabled: simEnabled,
  driving: false,
  done: false,
  lat: START.lat,
  lng: START.lng,
  gateKm: haversineKm(START.lat, START.lng, GATE.lat, GATE.lng),
};
const listeners = new Set<() => void>();
let timer: number | null = null;

function emit(next: Partial<SimSnapshot>) {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
}

export function startSimDrive() {
  if (snap.driving) return;
  emit({ driving: true, done: false, lat: START.lat, lng: START.lng, gateKm: haversineKm(START.lat, START.lng, GATE.lat, GATE.lng) });
  timer = window.setInterval(() => {
    const nextLng = Math.max(END_LNG, snap.lng - STEP_KM / KM_PER_DEG_LNG);
    const gateKm = haversineKm(snap.lat, nextLng, GATE.lat, GATE.lng);
    if (nextLng <= END_LNG) {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      emit({ lng: nextLng, gateKm, done: true }); // parked at the gate; drive stays "on" until stopped
    } else {
      emit({ lng: nextLng, gateKm });
    }
  }, TICK_MS);
}

export function stopSimDrive() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  emit({ driving: false, done: false, lat: START.lat, lng: START.lng, gateKm: haversineKm(START.lat, START.lng, GATE.lat, GATE.lng) });
}

export function useSim(): SimSnapshot {
  const [s, setS] = useState<SimSnapshot>(snap);
  useEffect(() => {
    const l = () => setS({ ...snap });
    listeners.add(l);
    setS({ ...snap });
    return () => { listeners.delete(l); };
  }, []);
  return s;
}
