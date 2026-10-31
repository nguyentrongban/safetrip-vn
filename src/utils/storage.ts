import type { PersonalReport, SOSConfig, TripConfig } from '../types';

const K = { sos: 'safetrip_sos_config', reports: 'safetrip_personal_reports', trip: 'safetrip_active_trip' } as const;

export const DEFAULT_SOS: SOSConfig = {
  phone1: '', phone2: '',
  message: 'KHẨN CẤP! Tôi đang gặp nguy hiểm trên xe khách. Đây là vị trí hiện tại của tôi:',
};

export function loadSOS(): SOSConfig {
  try { const raw = localStorage.getItem(K.sos); if (raw) return { ...DEFAULT_SOS, ...(JSON.parse(raw) as SOSConfig) }; } catch { /* corrupted storage */ }
  return DEFAULT_SOS;
}
export function saveSOS(cfg: SOSConfig): void { localStorage.setItem(K.sos, JSON.stringify(cfg)); }

export function loadReports(): PersonalReport[] {
  try { const raw = localStorage.getItem(K.reports); if (raw) return JSON.parse(raw) as PersonalReport[]; } catch { /* corrupted */ }
  return [];
}
export function saveReports(list: PersonalReport[]): void {
  try { localStorage.setItem(K.reports, JSON.stringify(list)); } catch { /* quota: image too large */ }
}
export function loadTrip(): TripConfig | null {
  try { const raw = localStorage.getItem(K.trip); if (raw) return JSON.parse(raw) as TripConfig; } catch { /* corrupted */ }
  return null;
}
export function saveTrip(t: TripConfig | null): void {
  if (t) localStorage.setItem(K.trip, JSON.stringify(t)); else localStorage.removeItem(K.trip);
}
export function buildSmsUrl(phone: string, body: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(body)}`;
}
export function buildSosBody(cfg: SOSConfig, lat: number | null, lng: number | null): string {
  const loc = lat !== null && lng !== null ? `https://www.google.com/maps?q=${lat},${lng}` : 'Không lấy được GPS';
  return `${cfg.message} ${loc}`;
}
