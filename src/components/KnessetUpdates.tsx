'use client';
import { useEffect, useState } from 'react';
import { getAllKnessetUpdates, KnessetUpdate } from '@/lib/knessetSync';
import { getWeeklyKnessetSessions, KnessetSessionRow, markKnessetUpdateInSchedule, ManualScheduleEvent } from '@/lib/supabase';
import { SCHEDULE, ScheduleEvent } from '@/data/schedule';
import { TIMELINE, TimelineEvent } from '@/data/timeline';
import AddToScheduleModal, { SessionInfo } from './AddToScheduleModal';
import type { GovAgendaItem } from '@/app/api/gov-agenda/route';

const WORK_DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי'];
const UPDATE_PRIORITY: Record<string, number> = { cancel: 3, change: 2, new: 1 };

type WeekView = 'current' | 'next';

// Compute YYYY-MM-DD for each work day of the requested week (0 = current, 1 = next).
// Uses local date parts — toISOString() is UTC and shifts the date back
// a day between midnight and ~03:00 Israel time.
function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getWeekDateMap(weekOffset: number): Record<string, string> {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() + weekOffset * 7);
  const map: Record<string, string> = {};
  WORK_DAYS.forEach((name, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    map[name] = localIso(d);
  });
  return map;
}
const WEEK_DATE_MAPS: Record<WeekView, Record<string, string>> = {
  current: getWeekDateMap(0),
  next: getWeekDateMap(1),
};

// "11.6"-style display date expected for each day of each week —
// a session's day+date pins it to a week; rows from older weeks match neither
const toDisplayMap = (m: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(m).map(([day, iso]) => {
      const [, mo, d] = iso.split('-');
      return [day, `${Number(d)}.${Number(mo)}`];
    })
  );
const WEEK_DISPLAY_DATES: Record<WeekView, Record<string, string>> = {
  current: toDisplayMap(WEEK_DATE_MAPS.current),
  next: toDisplayMap(WEEK_DATE_MAPS.next),
};

function sessionWeek(s: KnessetSessionRow): WeekView | null {
  if (WEEK_DISPLAY_DATES.current[s.day_name] === s.date) return 'current';
  if (WEEK_DISPLAY_DATES.next[s.day_name] === s.date) return 'next';
  return null;
}

function isoToDisplay(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

function normalizeTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m ?? '00'}`;
}

function committeeMatches(committee: string, ev: ScheduleEvent): boolean {
  if (committee === ev.category) return true;
  if (ev.title.startsWith(committee + ':') || ev.title.startsWith(committee + ' ')) return true;
  if (committee.includes(ev.category) || ev.category.includes(committee)) return true;
  return false;
}

function findMatchingScheduleEvent(session: KnessetSessionRow): ScheduleEvent | null {
  return SCHEDULE.find(ev =>
    ev.day === session.day_name &&
    normalizeTime(ev.time) === normalizeTime(session.time) &&
    committeeMatches(session.committee, ev)
  ) ?? null;
}

// Timeline events that overlap a given week-day ISO date
function timelineForDay(isoDate: string): TimelineEvent[] {
  return TIMELINE.filter(e => {
    const end = e.dateEnd ?? e.dateStart;
    return e.dateStart <= isoDate && isoDate <= end;
  });
}

// Gov agenda items whose meeting date exactly matches the given week-day ISO date
function govItemsForDay(items: GovAgendaItem[], dayName: string, dateMap: Record<string, string>): GovAgendaItem[] {
  const isoDate = dateMap[dayName];
  if (!isoDate) return [];
  return items.filter(item => item.meetingDate === isoDate);
}

export default function KnessetUpdates() {
  const [sessions, setSessions] = useState<KnessetSessionRow[]>([]);
  const [updates, setUpdates] = useState<KnessetUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState('');
  const [lastSync, setLastSync] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [markErrors, setMarkErrors] = useState<Record<string, string>>({});
  const [modalSession, setModalSession] = useState<SessionInfo | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<string>(() => WORK_DAYS[new Date().getDay()] ?? WORK_DAYS[0]);
  const [govItems, setGovItems] = useState<GovAgendaItem[]>([]);
  const [weekView, setWeekView] = useState<WeekView>('current');

  async function load() {
    try {
      const [sessionData, updateData] = await Promise.all([
        getWeeklyKnessetSessions(),
        getAllKnessetUpdates(),
      ]);
      setSessions(sessionData.filter(s => sessionWeek(s) !== null));
      setUpdates(updateData);
      const newest = sessionData.reduce<string>((max, s) => (s.last_seen && s.last_seen > max ? s.last_seen : max), '');
      setLastSync(newest);
      setLastCheck(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setLoading(false);
    }
  }

  async function loadGovAgenda() {
    try {
      const res = await fetch('/api/gov-agenda');
      if (res.ok) {
        const data = await res.json() as { items: GovAgendaItem[] };
        setGovItems(data.items ?? []);
      }
    } catch { /* silent */ }
  }

  async function manualRefresh() {
    setRefreshing(true);
    await Promise.all([load(), loadGovAgenda()]);
    setRefreshing(false);
  }

  async function handleMark(updateId: string, currentMarked: boolean) {
    const newMarked = !currentMarked;
    setMarkingIds(prev => new Set([...prev, updateId]));
    setMarkErrors(prev => { const e = { ...prev }; delete e[updateId]; return e; });
    try {
      await markKnessetUpdateInSchedule(updateId, newMarked);
      setUpdates(prev => prev.map(u => u.id === updateId ? { ...u, marked_in_schedule: newMarked } : u));
    } catch (e) {
      setMarkErrors(prev => ({ ...prev, [updateId]: (e as Error).message }));
    } finally {
      setMarkingIds(prev => { const s = new Set(prev); s.delete(updateId); return s; });
    }
  }

  // "next week" is a planning view — there is no manual לו"ז to compare against yet
  const isPlanning = weekView === 'next';
  const dateMap = WEEK_DATE_MAPS[weekView];
  const weekSessions = sessions.filter(s => sessionWeek(s) === weekView);

  // A day counts as having content if it has sessions OR gov items OR timeline
  // events — checking sessions alone would bounce the selection off days whose
  // tab exists only because of gov/timeline content
  const dayHasContent = (d: string) =>
    weekSessions.some(s => s.day_name === d) ||
    govItemsForDay(govItems, d, dateMap).length > 0 ||
    timelineForDay(dateMap[d] ?? '').length > 0;

  useEffect(() => { load(); loadGovAgenda(); }, []);
  useEffect(() => {
    if (!dayHasContent(selectedDay)) {
      const first = WORK_DAYS.find(dayHasContent);
      if (first) setSelectedDay(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, govItems, selectedDay, weekView]);

  // Build map: session_id → highest-priority update
  const updateMap = new Map<string, KnessetUpdate>();
  for (const u of updates) {
    const existing = updateMap.get(u.session_id);
    if (!existing || (UPDATE_PRIORITY[u.update_type] ?? 0) > (UPDATE_PRIORITY[existing.update_type] ?? 0)) {
      updateMap.set(u.session_id, u);
    }
  }

  // Days that have any content (sessions OR gov items OR timeline events)
  const availableDays = WORK_DAYS
    .map(day => {
      const isoDate = dateMap[day] ?? '';
      const hasSessions = weekSessions.some(s => s.day_name === day);
      const hasGov = govItemsForDay(govItems, day, dateMap).length > 0;
      const hasTimeline = isoDate ? timelineForDay(isoDate).length > 0 : false;
      if (!hasSessions && !hasGov && !hasTimeline) return null;
      // prefer session date for display, fall back to computed
      const sessionDate = weekSessions.find(s => s.day_name === day)?.date;
      return { day, date: sessionDate ?? (isoDate ? isoToDisplay(isoDate) : '') };
    })
    .filter((d): d is { day: string; date: string } => d !== null);

  const cancelCount = weekSessions.filter(s => s.status === 'cancelled').length;
  const notInScheduleCount = isPlanning ? 0
    : weekSessions.filter(s => s.status !== 'cancelled' && !findMatchingScheduleEvent(s)).length;
  const displaySessions = weekSessions
    .filter(s => s.day_name === selectedDay)
    .sort((a, b) => normalizeTime(a.time).localeCompare(normalizeTime(b.time)));

  const dayGovItems = govItemsForDay(govItems, selectedDay, dateMap);
  const dayTimelineEvents = timelineForDay(dateMap[selectedDay] ?? '');

  if (loading) return null;

  return (
    <div style={{ marginTop: 28, padding: '0 24px 80px', direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: refreshing ? '#d97706' : '#16a34a' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{isPlanning ? 'ועדות כנסת + ממשלה — שבוע הבא' : 'ועדות כנסת + ממשלה השבוע'}</span>
          {lastCheck && <span style={{ fontSize: 11, color: '#9ca3af' }}>עדכון: {lastCheck}</span>}
          {lastSync && (() => {
            const ageHours = (Date.now() - new Date(lastSync).getTime()) / 3600000;
            const stale = ageHours > 24;
            return (
              <span style={{
                fontSize: 10, fontWeight: stale ? 700 : 400,
                color: stale ? '#dc2626' : '#9ca3af',
                background: stale ? '#fee2e2' : 'transparent',
                padding: stale ? '1px 6px' : 0, borderRadius: 8,
              }}>
                {stale
                  ? `⚠ סנכרון אחרון לפני ${Math.round(ageHours)} שעות — הריצו את סקריפט הסנכרון`
                  : `סונכרן: ${new Date(lastSync).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
              </span>
            );
          })()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cancelCount > 0 && (
            <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
              {cancelCount} ביטולים
            </span>
          )}
          {notInScheduleCount > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
              {notInScheduleCount} לא בלו&quot;ז
            </span>
          )}
          <button type="button" onClick={manualRefresh} disabled={refreshing}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, fontFamily: 'inherit', cursor: refreshing ? 'default' : 'pointer', border: '1px solid #e5e7eb', background: '#fff' }}>
            {refreshing ? '...' : '↻ רענן'}
          </button>
        </div>
      </div>

      {/* Week toggle: current week / next week (planning) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['current', 'next'] as WeekView[]).map(w => {
          const isSel = weekView === w;
          const range = `${WEEK_DISPLAY_DATES[w]['יום ראשון']}–${WEEK_DISPLAY_DATES[w]['יום שישי']}`;
          return (
            <button key={w} type="button" onClick={() => setWeekView(w)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontFamily: 'inherit', cursor: 'pointer',
                border: `1.5px solid ${isSel ? '#1e3a7b' : '#d1d5db'}`,
                background: isSel ? '#1e3a7b' : '#fff',
                color: isSel ? '#fff' : '#374151',
                fontSize: 12, fontWeight: 700,
              }}>
              {w === 'current' ? 'השבוע הנוכחי' : 'שבוע הבא'}
              <span style={{ fontWeight: 400, fontSize: 10, marginRight: 6, opacity: 0.8, direction: 'ltr', display: 'inline-block' }}>{range}</span>
            </button>
          );
        })}
        {isPlanning && (
          <span style={{ fontSize: 11, color: '#7c3aed', background: '#faf5ff', border: '1px solid #ddd6fe', padding: '3px 10px', borderRadius: 10 }}>
            מצב תכנון — כל הישיבות שפורסמו לשבוע הבא, ללא השוואה ללו&quot;ז
          </span>
        )}
      </div>

      {/* Day tab bar */}
      {availableDays.length > 1 && (
        <div style={{ display: 'flex', background: '#f0f4f9', borderBottom: '2px solid #dde3ed', overflowX: 'auto', margin: '0 -24px 14px', direction: 'rtl' }}>
          {availableDays.map(({ day, date }) => {
            const isSel = selectedDay === day;
            return (
              <button key={day} type="button" onClick={() => setSelectedDay(day)}
                style={{
                  padding: '10px 16px', minWidth: 76, textAlign: 'center',
                  background: isSel ? '#1e3a7b' : 'transparent',
                  color: isSel ? '#fff' : '#1e3a7b',
                  border: 'none', borderLeft: '1px solid #dde3ed',
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{day.replace('יום ', '')}</div>
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>{date}</div>
              </button>
            );
          })}
        </div>
      )}

      {availableDays.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9ca3af', padding: '12px 0' }}>
          {isPlanning ? 'טרם פורסמו ישיבות לשבוע הבא — הריצו סנכרון (sync-knesset.mjs)' : 'אין נתונים לשבוע זה'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

          {/* ── Gov agenda items (ministers + government meeting) ─── */}
          {dayGovItems.map((item, i) => (
            <a key={`gov-${i}`} href={item.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: item.color + '08',
                border: `0.5px solid ${item.color}40`,
                borderRight: `3px solid ${item.color}`,
                borderRadius: 5, padding: '8px 12px', textDecoration: 'none',
              }}>
              <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 38, flexShrink: 0, paddingTop: 2, direction: 'ltr' }}>—</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: item.color + '20', color: item.color, padding: '1px 6px', borderRadius: 3 }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, background: '#f3f4f6', color: '#6b7280', padding: '1px 6px', borderRadius: 3 }}>
                    סדר יום
                  </span>
                  {item.publishDate && (
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>פורסם {item.publishDate}</span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.4 }}>
                  {item.description || item.label}
                </div>
              </div>
              <span style={{ fontSize: 11, color: item.color, flexShrink: 0, marginTop: 2 }}>↗</span>
            </a>
          ))}

          {/* ── Timeline events for this day ───────────────────── */}
          {dayTimelineEvents.map((ev, i) => {
            const isMultiDay = ev.dateEnd && ev.dateEnd !== ev.dateStart;
            return (
              <div key={`tl-${i}`} style={{
                background: '#faf5ff',
                border: '0.5px solid #ddd6fe',
                borderRight: '3px solid #7c3aed',
                borderRadius: 5, padding: '8px 12px',
              }}>
                <span style={{ fontSize: 11, color: '#9ca3af', display: 'inline-block', minWidth: 38, paddingTop: 2, direction: 'ltr' }}>—</span>
                <div style={{ display: 'inline-flex', gap: 6, marginBottom: 3, flexWrap: 'wrap', alignItems: 'center', marginRight: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: 3 }}>
                    אירוע בולט · {ev.category}
                  </span>
                  {ev.importance === 'הערכה' && (
                    <span style={{ fontSize: 9, color: '#9ca3af' }}>הערכה</span>
                  )}
                  {isMultiDay && (
                    <span style={{ fontSize: 9, color: '#9ca3af' }}>
                      {ev.dateStart.slice(8)}.{ev.dateStart.slice(5, 7)}–{(ev.dateEnd ?? '').slice(8)}.{(ev.dateEnd ?? '').slice(5, 7)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.4 }}>{ev.title}</div>
                {ev.detail && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, lineHeight: 1.5 }}>{ev.detail}</div>
                )}
                {ev.url && (
                  <a href={ev.url} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-block', fontSize: 11, color: '#7c3aed', marginTop: 4 }}>
                    לקישור ›
                  </a>
                )}
              </div>
            );
          })}

          {/* ── Knesset committee sessions ─────────────────────── */}
          {displaySessions.map(session => {
            const isCancelled = session.status === 'cancelled';
            const update = updateMap.get(session.id);
            const isMarked = update?.marked_in_schedule ?? false;
            const isMarking = update ? markingIds.has(update.id) : false;
            const markErr = update ? markErrors[update.id] : undefined;
            const matchedEvent = isPlanning ? null : findMatchingScheduleEvent(session);

            return (
              <div key={session.id} style={{
                background: isCancelled ? '#fff8f8' : session.session_type === 'plenary' ? '#f0f9ff' : '#fff',
                border: `0.5px solid ${isCancelled ? '#fca5a5' : '#e5e7eb'}`,
                borderRight: `3px solid ${isCancelled ? '#dc2626' : session.session_type === 'plenary' ? '#0891b2' : '#9ca3af'}`,
                borderRadius: 5,
                padding: '8px 12px',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}>
                {/* Time */}
                <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 38, flexShrink: 0, paddingTop: 2, direction: 'ltr' }}>
                  {session.time || '—'}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {session.session_type === 'plenary' && (
                    <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: '#e0f2fe', color: '#0891b2', marginBottom: 3 }}>
                      מליאה
                    </div>
                  )}
                  <div style={{
                    fontSize: 13, fontWeight: 600, lineHeight: 1.4,
                    color: isCancelled ? '#9ca3af' : '#111',
                    textDecoration: isCancelled ? 'line-through' : 'none',
                  }}>
                    {session.committee}
                  </div>
                  {session.title && (
                    <div style={{
                      fontSize: 12, lineHeight: 1.4, marginTop: 1,
                      color: isCancelled ? '#bbb' : '#374151',
                      textDecoration: isCancelled ? 'line-through' : 'none',
                    }}>
                      {session.title}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {isCancelled && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 3 }}>בוטלה</span>
                    )}
                    {update?.update_type === 'new' && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: 3 }}>חדשה</span>
                    )}
                    {update?.update_type === 'change' && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: '#fef3c7', color: '#d97706', padding: '1px 6px', borderRadius: 3 }}>
                        {update.change_desc}
                      </span>
                    )}
                    <a href={session.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: '#0075C4', textDecoration: 'none', fontWeight: 600 }}>
                      ↗ ישיבה
                    </a>
                  </div>
                  {markErr && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>שגיאה: {markErr}</div>
                  )}
                  {isCancelled && update && !isMarked && matchedEvent && (
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, background: '#f3f4f6', borderRadius: 3, padding: '2px 6px', display: 'inline-block' }}>
                      יסמן בלו&quot;ז: <span style={{ fontWeight: 600, color: '#374151' }}>{matchedEvent.title}</span>
                    </div>
                  )}
                  {isCancelled && update && !isMarked && !matchedEvent && (
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>לא נמצא אירוע מתאים בלו&quot;ז שלך</div>
                  )}
                  {isMarked && !markErr && matchedEvent && (
                    <div style={{ fontSize: 10, color: '#16a34a', marginTop: 3 }}>✓ מסומן בלו&quot;ז: {matchedEvent.title}</div>
                  )}
                  {!isCancelled && matchedEvent && (
                    <div style={{ fontSize: 10, color: '#0075C4', marginTop: 4, background: '#eff6ff', borderRadius: 3, padding: '2px 6px', display: 'inline-block' }}>
                      קיים בלו&quot;ז: <span style={{ fontWeight: 600 }}>{matchedEvent.title}</span>
                    </div>
                  )}
                  {!isCancelled && !matchedEvent && !isPlanning && (
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>לא נמצא בלו&quot;ז שלך</div>
                  )}
                </div>

                {/* Add to schedule button — current week only (modal saves into the current week_id) */}
                {!isCancelled && !isPlanning && !addedIds.has(session.id) && (
                  <button type="button"
                    onClick={() => setModalSession({ committee: session.committee, title: session.title, day_name: session.day_name, time: session.time })}
                    style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit',
                      cursor: 'pointer', border: '1px solid #0075C4', background: '#e6f1fb',
                      color: '#0075C4', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                    + הוסף ללו&quot;ז
                  </button>
                )}
                {addedIds.has(session.id) && (
                  <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>✓ בלו&quot;ז</span>
                )}

                {/* Mark button — cancelled sessions with matching schedule event */}
                {isCancelled && update && matchedEvent && (
                  <button type="button" disabled={isMarking}
                    onClick={() => handleMark(update.id, isMarked)}
                    style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit',
                      cursor: isMarking ? 'default' : 'pointer',
                      border: `1px solid ${isMarked ? '#16a34a' : '#d1d5db'}`,
                      background: isMarked ? '#dcfce7' : '#f9fafb',
                      color: isMarked ? '#16a34a' : '#374151',
                      fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                    {isMarking ? '...' : isMarked ? '✓ בלו"ז' : 'עדכן לו"ז'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: '#d1d5db', textAlign: 'center' }}>
        ועדות כנסת: סנכרון ידני (sync-knesset.mjs) · הרענון קורא מהמסד בלבד · ועדת שרים וממשלה: gov.il
      </div>

      {modalSession && (
        <AddToScheduleModal
          session={modalSession}
          onClose={() => setModalSession(null)}
          onSaved={(_saved: ManualScheduleEvent) => {
            setAddedIds(prev => new Set([...prev, sessions.find(s => s.committee === modalSession.committee && s.day_name === modalSession.day_name && s.time === modalSession.time)?.id ?? '']));
          }}
        />
      )}
    </div>
  );
}
