import type { ScheduleEvent } from '@/data/schedule';

// ─── Shared week/time/committee helpers ──────────────────────────────────────
// Single source of truth for logic that was previously duplicated between
// ScheduleView, KnessetUpdates and supabase.ts — the week-rollover pair in
// particular must agree, or the view can display one week while a save
// targets another.

/** Local YYYY-MM-DD — toISOString() is UTC and would shift the date back a
 *  day when called between midnight and ~03:00 Israel time. */
export function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Sunday anchoring the work week containing `now` (+ optional week offset).
 *  From Friday the work week is over — anchor to the upcoming Sunday, so
 *  Fri/Sat already belong to the week being planned. */
export function anchorSunday(now: Date, weekOffset = 0): Date {
  const sunday = new Date(now);
  const rollover = now.getDay() >= 5 ? 7 : 0;
  sunday.setDate(now.getDate() - now.getDay() + rollover + weekOffset * 7);
  return sunday;
}

export function normalizeTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m ?? '00'}`;
}

export function committeeMatches(committee: string, ev: ScheduleEvent): boolean {
  if (committee === ev.category) return true;
  // e.g. category='ביטחון לאומי', title starts with 'הוועדה לביטחון לאומי:'
  if (ev.title.startsWith(committee + ':') || ev.title.startsWith(committee + ' ')) return true;
  // partial: 'הוועדה לביטחון לאומי' contains 'ביטחון לאומי'
  if (committee.includes(ev.category) || ev.category.includes(committee)) return true;
  return false;
}
