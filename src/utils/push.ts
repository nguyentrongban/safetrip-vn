import { ensureLiveSession, loadLiveSessionCode } from './live';

/**
 * Web Push for the Dead Man's Switch warning (v1.34, re-platformed v1.36).
 *
 * Since v1.36 the whole push subsystem lives on a small Cloudflare Worker
 * (cloudflare/worker.js in this repo): subscriptions and check-in
 * deadlines are stored in its D1 database, and its per-minute cron sends
 * the "−5 minutes" warning. Supabase keeps only live tracking + the fraud
 * database — nothing push-related touches it any more.
 *
 * The VAPID public key below is public by design — it ships inside the app
 * so browsers can create subscriptions bound to this application server.
 * The matching PRIVATE key exists ONLY as a secret of the Cloudflare
 * Worker (never in this repo). Keypair generated 2026-11-03; see
 * CLOUDFLARE-SETUP.md for the deployment steps.
 */

/**
 * Base URL of the push Worker, e.g. "https://safetrip-push.<you>.workers.dev".
 * EMPTY (the default) = push features gracefully off: the "Thông báo điểm
 * danh" card shows its not-configured state and no request is ever made —
 * the same behaviour as an empty Mapbox token. Fill this in after creating
 * the Worker (CLOUDFLARE-SETUP.md, step 7).
 */
export const PUSH_WORKER_URL = 'https://safetrip-push.nguyentrongban01052003.workers.dev';

export const VAPID_PUBLIC_KEY = 'BBj1cG8XJoN-UirQrguiiDh7S3lRINn23belRWYP71y8n-5ZIU2VurQZVKDxS1lUIzObyJonkeF0wN_E2QgBpc4';

export function isPushConfigured(): boolean {
  return PUSH_WORKER_URL.trim().length > 0;
}

const LS_ENDPOINT = 'safetrip_push_endpoint';
const LS_CODE = 'safetrip_push_code';

async function postToWorker(path: string, body: Record<string, unknown>): Promise<boolean> {
  if (!isPushConfigured()) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${PUSH_WORKER_URL.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}

/** PushManager.subscribe() wants the VAPID key as raw bytes, not base64url. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** iOS only allows Web Push for web apps ADDED TO THE HOME SCREEN (iOS
 * 16.4+); in a Safari tab PushManager simply doesn't exist. The card uses
 * this to show the install guidance BEFORE the generic "unsupported" note. */
export function iosNeedsInstall(): boolean {
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  return !standalone;
}

/** True when running as the installed home-screen app (not a browser
 *  tab). The Monitor tab uses it to collapse browser-only guidance —
 *  in a tab the push card shrinks to one slim row (v1.48). */
export function isStandaloneApp(): boolean {
  try {
    return (navigator as unknown as { standalone?: boolean }).standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;
  } catch { return false; }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch { return null; }
}

function remember(endpoint: string, code: string): void {
  try {
    localStorage.setItem(LS_ENDPOINT, endpoint);
    localStorage.setItem(LS_CODE, code);
  } catch { /* storage unavailable */ }
}
export function registeredCode(): string | null {
  try { return localStorage.getItem(LS_CODE); } catch { return null; }
}
export function registeredEndpoint(): string | null {
  try { return localStorage.getItem(LS_ENDPOINT); } catch { return null; }
}
function forget(): void {
  try {
    localStorage.removeItem(LS_ENDPOINT);
    localStorage.removeItem(LS_CODE);
  } catch { /* ignore */ }
}

async function sendSubscriptionToWorker(code: string, sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh || '';
  const auth = json.keys?.auth || '';
  if (!p256dh || !auth) return false;
  const ok = await postToWorker('/subscribe', {
    code, endpoint: sub.endpoint, p256dh, auth,
  });
  if (ok) remember(sub.endpoint, code);
  return ok;
}

export type SubscribeResult = 'subscribed' | 'denied' | 'unsupported' | 'no-relay' | 'failed';

/** Ask permission (must be called from a user tap), subscribe this device,
 * and register the subscription with the push Worker under the device's
 * live session code. 'no-relay' = the push Worker is not configured yet
 * (PUSH_WORKER_URL empty). */
export async function subscribePush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return 'unsupported';
  if (!isPushConfigured()) return 'no-relay';
  let permission: NotificationPermission;
  try { permission = await Notification.requestPermission(); } catch { return 'failed'; }
  if (permission !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
    const code = ensureLiveSession();
    return (await sendSubscriptionToWorker(code, sub)) ? 'subscribed' : 'failed';
  } catch { return 'failed'; }
}

/** The live session code rotates after each trip (v1.14). If this device is
 * subscribed but the Worker still has the subscription filed under an old
 * code, re-file it under the current one — otherwise the watcher would
 * look up the new code and find nobody to warn. Cheap no-op when current. */
export async function refreshPushRegistration(): Promise<void> {
  if (!isPushConfigured() || !isPushSupported() || Notification.permission !== 'granted') return;
  const code = loadLiveSessionCode();
  if (!code || code === registeredCode()) return;
  const sub = await currentSubscription();
  if (sub) await sendSubscriptionToWorker(code, sub);
}

/** Turn notifications off for this device: drop the browser subscription
 * and remove it from the Worker. */
export async function unsubscribePush(): Promise<void> {
  const sub = await currentSubscription();
  const endpoint = sub?.endpoint || registeredEndpoint();
  try { await sub?.unsubscribe(); } catch { /* already gone */ }
  if (endpoint) await postToWorker('/unsubscribe', { endpoint });
  forget();
}

/** Report the current Dead Man's Switch deadline (absolute epoch ms) to
 * the push Worker — its cron watcher Web-Pushes a warning ~5 minutes
 * before this deadline, and keeps working after the traveler closes the
 * web app, which the in-page countdown cannot. `null` clears the deadline
 * (DMS off / trip ended on purpose). Fire-and-forget: a failed sync is
 * retried by the caller's periodic re-assert and never blocks the trip UI. */
export async function syncDmsDeadline(code: string, deadlineMs: number | null): Promise<boolean> {
  return postToWorker('/deadline', { code, deadlineMs });
}
