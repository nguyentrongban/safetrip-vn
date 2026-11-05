import { loadLiveConfig } from './live';
import type { CommunityFraudEntry } from '../types';

/**
 * Community fraud database (v1.18):
 *  - TEXT (plates, operators, descriptions) lives in the SAME Supabase
 *    project as live tracking, behind gatekeeper RPCs (fraud_search /
 *    fraud_report in supabase/fraud.sql). Reports land as 'pending' and only
 *    appear in search after the owner approves them.
 *  - EVIDENCE IMAGES live on Cloudinary (free tier), compressed hard in the
 *    browser before upload. This module stores only the returned URLs.
 */

// ============================================================================
// CLOUDINARY — điền 2 giá trị này sau khi tấn tạo tài khoản Cloudinary +
// 1 "unsigned upload preset" (xem README mục Kho lừa đảo cộng đồng).
// Chưa điền thì tính năng đính kèm ảnh tự tắt, báo cáo chữ vẫn chạy.
// ============================================================================
// Điền cloudName + uploadPreset vào chuỗi JSON dưới đây (để dạng JSON để bộ
// đóng gói không "gập" mất nhánh tải ảnh khi cấu hình còn trống).
const CLOUDINARY_JSON = '{"cloudName":"yixmuaub","uploadPreset":"safetripvn"}';

/** The Cloudinary config, or null until the owner fills it in above. */
export function cloudinaryConfig(): { cloudName: string; uploadPreset: string } | null {
  try {
    const c = JSON.parse(CLOUDINARY_JSON) as { cloudName: string; uploadPreset: string };
    if (c.cloudName.trim().length > 1 && c.uploadPreset.trim().length > 1) {
      return { cloudName: c.cloudName.trim(), uploadPreset: c.uploadPreset.trim() };
    }
  } catch { /* misconfigured JSON — photos stay off */ }
  return null;
}

export const cloudinaryReady = (): boolean => {
  const c = cloudinaryConfig();
  return !!c && c.cloudName.length > 1 && c.uploadPreset.length > 1;
};

/** Small on-screen thumbnail from a stored Cloudinary URL. */
export function cloudinaryThumb(url: string): string {
  return url.replace('/image/upload/', '/image/upload/w_400,c_limit,f_auto,q_auto/');
}

/** Wider variant for the full-width evidence photo on a result card. */
export function cloudinaryWide(url: string): string {
  return url.replace('/image/upload/', '/image/upload/w_900,c_limit,f_auto,q_auto/');
}

// ---------------------------------------------------------------------------
// Form validation rules (v1.20) — mirrored server-side in fraud_report so a
// modified client cannot bypass them.
// ---------------------------------------------------------------------------
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB, checked BEFORE compression
export const MAX_PHOTOS = 1;

/** Returns a user-facing error message, or null when the file is acceptable. */
export function validateImageFile(file: File): string | null {
  const looksImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name);
  if (!looksImage) return 'Chỉ được tải lên file ẢNH (jpg, png, webp…).';
  if (file.size > MAX_IMAGE_BYTES) return 'Ảnh quá nặng — tối đa 10MB mỗi tấm.';
  if (file.size === 0) return 'File ảnh rỗng, chọn ảnh khác nhé.';
  return null;
}

/** VN phone: digits only (spaces/dots stripped), 9–11 digits, starts with 0. REQUIRED since v1.21 — empty is invalid. */
export function normalizeVnPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}
export function isValidVnPhone(raw: string): boolean {
  return /^0\d{8,10}$/.test(normalizeVnPhone(raw));
}

// ---------------------------------------------------------------------------
// Image compression: shrink to at most 1280px on the long edge and re-encode
// (WebP if the browser can, else JPEG). A phone photo of several MB typically
// lands at 60–150KB — small, but plates/faces/text stay clearly readable.
// ---------------------------------------------------------------------------
export async function compressImage(file: File): Promise<Blob> {
  const loaded = await loadImageSource(file);
  try {
    const MAX = 1280;
    const scale = Math.min(1, MAX / Math.max(loaded.width, loaded.height));
    const w = Math.max(1, Math.round(loaded.width * scale));
    const h = Math.max(1, Math.round(loaded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(loaded.source, 0, 0, w, h);
    const webp = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.72));
    if (webp && webp.type === 'image/webp') return webp;
    const jpeg = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.78));
    if (jpeg) return jpeg;
    throw new Error('image encode failed');
  } finally { loaded.cleanup(); }
}

interface LoadedImage { source: CanvasImageSource; width: number; height: number; cleanup: () => void }

async function loadImageSource(file: File): Promise<LoadedImage> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, cleanup: () => bmp.close() };
    } catch { /* fall through to <img> loading */ }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('img load')); img.src = url; });
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, cleanup: () => URL.revokeObjectURL(url) };
}

/** Upload one compressed image to Cloudinary (unsigned preset). Returns the hosted URL. */
export async function uploadEvidence(blob: Blob): Promise<string> {
  const cfg = cloudinaryConfig();
  if (!cfg) throw new Error('cloudinary not configured');
  const form = new FormData();
  form.append('file', blob, blob.type === 'image/webp' ? 'evidence.webp' : 'evidence.jpg');
  form.append('upload_preset', cfg.uploadPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`cloudinary ${res.status}`);
  const json = (await res.json()) as { secure_url?: string };
  if (!json.secure_url) throw new Error('cloudinary: no url');
  return json.secure_url;
}

// ---------------------------------------------------------------------------
// Gatekeeper RPCs on the shared Supabase project (same pattern as live.ts).
// ---------------------------------------------------------------------------
async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const cfg = loadLiveConfig();
  if (!cfg) throw new Error('no relay config');
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}`);
  // fraud_report returns void → PostgREST answers 204 with an EMPTY body.
  // Parsing that as JSON throws, which used to make the app report a failed
  // submission even though the report had landed perfectly (v1.23 fix —
  // mirror live.ts, whose push path never parses the body).
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

interface FraudRow {
  plate: string; plate_display: string; operator_name: string; phone: string;
  scam_type: string; area: string; description: string; image_urls: string[];
  report_count: number; created_at: string;
}

/** Search APPROVED community reports. Throws on network/config errors so the UI can fall back to the built-in list. */
export async function searchCommunity(query: string): Promise<CommunityFraudEntry[]> {
  const rows = await rpc<FraudRow[]>('fraud_search', { p_query: query });
  return rows.map((r) => ({
    plate: r.plate, plateDisplay: r.plate_display, operatorName: r.operator_name,
    phone: r.phone, scamType: r.scam_type, area: r.area, description: r.description,
    imageUrls: r.image_urls || [], reportCount: r.report_count, createdAt: r.created_at,
  }));
}

export interface FraudReportInput {
  plate: string; operatorName: string; phone: string; scamType: string;
  area: string; description: string; imageUrls: string[];
}

/** Submit a report. It lands as 'pending' — invisible until the owner approves it. */
export async function submitCommunityReport(input: FraudReportInput): Promise<void> {
  await rpc<unknown>('fraud_report', {
    p_plate: input.plate, p_operator: input.operatorName, p_phone: input.phone,
    p_scam_type: input.scamType, p_area: input.area, p_description: input.description,
    p_image_urls: input.imageUrls,
  });
}
