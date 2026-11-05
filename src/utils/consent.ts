/**
 * Location consent (Nghị định 13/2023): GPS coordinates are sensitive
 * personal data, so the app keeps its OWN consent layer in front of the
 * browser's permission dialog. An agreement is stored durably (decision
 * + timestamp + the policy version agreed to); bumping POLICY_VERSION
 * re-asks everyone on their next visit.
 *
 * "Để sau" only dismisses the sheet for the current view: the next
 * page load asks again, and it keeps asking on every load until the
 * user agrees (owner's rule, 2026-11-05 21:38). A deferral is not a
 * decision and must never silence the sheet. Older builds
 * (v1.58–v1.64) stored 'later' as a permanent record; those records are
 * dropped on sight below so affected phones heal themselves.
 */
export const POLICY_VERSION = '2026-11-05.2';

import { PUSH_WORKER_URL } from './push';

const KEY = 'safetrip_consent_v1';
const DEVICE_KEY = 'safetrip_device_code';
const LOGGED_KEY = 'safetrip_consent_logged_v1';
const DEFER_KEY = 'safetrip_consent_deferred';

/** Fired by the geolocation hook when a feature wants GPS but there is
 *  no valid consent on file — App opens the consent sheet instead. */
export const CONSENT_EVENT = 'safetrip:consent-needed';

export interface ConsentRecord {
  decision: 'granted' | 'later';
  at: string;
  policy: string;
}

export function getConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as ConsentRecord;
    if (rec && rec.decision === 'granted') return rec;
    // Legacy permanent 'later' record — not a real decision; clear it
    // so the sheet can ask again on this phone.
    localStorage.removeItem(KEY);
    return null;
  } catch { return null; }
}

export function hasLocationConsent(): boolean {
  const rec = getConsent();
  return !!rec && rec.decision === 'granted' && rec.policy === POLICY_VERSION;
}

export function saveConsent(decision: 'granted' | 'later'): ConsentRecord | null {
  if (decision === 'later') { deferConsent(); return null; }
  const rec: ConsentRecord = { decision, at: new Date().toISOString(), policy: POLICY_VERSION };
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* storage blocked */ }
  logConsentEvent('granted');
  try { localStorage.setItem(LOGGED_KEY, '1'); } catch { /* storage blocked */ }
  return rec;
}

/** Random per-device code for the anonymous consent ledger. It is NOT
 *  an account and carries no identity — it only lets the operator's
 *  copy of a grant/withdrawal be told apart from other devices'. */
export function getDeviceCode(): string {
  try {
    let code = localStorage.getItem(DEVICE_KEY);
    if (!code || !/^[a-f0-9]{16}$/.test(code)) {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      code = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(DEVICE_KEY, code);
    }
    return code;
  } catch { return '0000000000000000'; }
}

/** Fire-and-forget mirror of a consent decision to the operator's
 *  anonymous evidence log (Worker POST /consent-log). Never blocks or
 *  breaks the consent flow — the on-device record stays authoritative
 *  for behaviour; the log exists only as dispute evidence. */
export function logConsentEvent(event: 'granted' | 'withdrawn'): void {
  try {
    void fetch(`${PUSH_WORKER_URL.replace(/\/+$/, '')}/consent-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: getDeviceCode(), event, policy: POLICY_VERSION }),
      keepalive: true,
    }).catch(() => { /* offline — the on-device record still counts */ });
  } catch { /* noop */ }
}

/** One-time backfill: a consent granted before the evidence log
 *  existed gets its anonymous row on the next visit. */
export function ensureConsentLogged(): void {
  try {
    if (!hasLocationConsent()) return;
    if (localStorage.getItem(LOGGED_KEY) === '1') return;
    logConsentEvent('granted');
    localStorage.setItem(LOGGED_KEY, '1');
  } catch { /* noop */ }
}

/** Dismiss the consent sheet for the current view. The next page load
 *  asks again — only a granted consent stops the asking. */
export function deferConsent(): void {
  try {
    sessionStorage.setItem(DEFER_KEY, '1');
    localStorage.removeItem(KEY);
  } catch { /* storage blocked */ }
}

export function isDeferredThisSession(): boolean {
  try { return sessionStorage.getItem(DEFER_KEY) === '1'; } catch { return false; }
}

/** Withdrawal: the record is deleted outright — the app behaves as if
 *  consent was never given and will ask again before any GPS use. */
export function clearConsent(): void {
  logConsentEvent('withdrawn');
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LOGGED_KEY);
    sessionStorage.removeItem(DEFER_KEY);
  } catch { /* storage blocked */ }
}

export function askConsent(): void {
  try { window.dispatchEvent(new Event(CONSENT_EVENT)); } catch { /* noop */ }
}
