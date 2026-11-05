/**
 * Location consent (Nghị định 13/2023): GPS coordinates are sensitive
 * personal data, so the app keeps its OWN consent layer in front of the
 * browser's permission dialog. The record (decision + timestamp + the
 * policy version agreed to) lives only in this browser's storage.
 * Bumping POLICY_VERSION re-asks everyone on their next visit.
 */
export const POLICY_VERSION = '2026-11-05';

const KEY = 'safetrip_consent_v1';

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
    return rec && (rec.decision === 'granted' || rec.decision === 'later') ? rec : null;
  } catch { return null; }
}

export function hasLocationConsent(): boolean {
  const rec = getConsent();
  return !!rec && rec.decision === 'granted' && rec.policy === POLICY_VERSION;
}

export function saveConsent(decision: 'granted' | 'later'): ConsentRecord {
  const rec: ConsentRecord = { decision, at: new Date().toISOString(), policy: POLICY_VERSION };
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* storage blocked */ }
  return rec;
}

/** Withdrawal: the record is deleted outright — the app behaves as if
 *  consent was never given and will ask again before any GPS use. */
export function clearConsent(): void {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

export function askConsent(): void {
  try { window.dispatchEvent(new Event(CONSENT_EVENT)); } catch { /* noop */ }
}
