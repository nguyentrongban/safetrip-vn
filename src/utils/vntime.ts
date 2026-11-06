/**
 * Vietnam time, pinned (owner 2026-11-06): EVERY user-facing clock and
 * calendar reading in the app uses Asia/Ho_Chi_Minh, no matter what
 * timezone the phone itself sits in — the audience is Vietnamese, and a
 * traveler near a border (or abroad) must still see home dates/times.
 * Stored timestamps stay unambiguous instants (ISO / epoch); only the
 * READING is pinned here.
 */
export const VN_TZ = 'Asia/Ho_Chi_Minh';

/** dd/mm/yyyy in Vietnam time. */
export function vnDate(iso: string | number | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/** HH:MM (24h) in Vietnam time. */
export function vnTime(iso: string | number | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** HH:MM, dd/mm/yyyy in Vietnam time. */
export function vnDateTime(iso: string | number | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}
