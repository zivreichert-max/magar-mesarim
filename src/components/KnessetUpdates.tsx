'use client';
import { useEffect, useState } from 'react';
import { getAllKnessetUpdates, KnessetUpdate } from '@/lib/knessetSync';
import { getWeeklyKnessetSessions, KnessetSessionRow, markKnessetUpdateInSchedule, ManualScheduleEvent } from '@/lib/supabase';
import { SCHEDULE, ScheduleEvent } from '@/data/schedule';
import AddToScheduleModal, { SessionInfo } from './AddToScheduleModal';

const DAY_ORDER = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי'];
const UPDATE_PRIORITY: Record<string, number> = { cancel: 3, change: 2, new: 1 };

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

export default function KnessetUpdates() {
  const [sessions, setSessions] = useState<KnessetSessionRow[]>([]);
  const [updates, setUpdates] = useState<KnessetUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [markErrors, setMarkErrors] = useState<Record<string, string>>({});
  const [modalSession, setModalSession] = useState<SessionInfo | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const [sessionData, updateData] = await Promise.all([
        getWeeklyKnessetSessions(),
        getAllKnessetUpdates(),
      ]);
      setSessions(sessionData);
      setUpdates(updateData);
      setLastCheck(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setLoading(false);
    }
  }

  async function manualRefresh() {
    setRefreshing(true);
    await load();
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

  useEffect(() => { load(); }, []);

  // Build map: session_id → highest-priority update
  const updateMap = new Map<string, KnessetUpdate>();
  for (const u of updates) {
    const existing = updateMap.get(u.session_id);
    if (!existing || (UPDATE_PRIORITY[u.update_type] ?? 0) > (UPDATE_PRIORITY[existing.update_type] ?? 0)) {
      updateMap.set(u.session_id, u);
    }
  }

  // Group by day, sort by time within each day
  const byDay = DAY_ORDER.map(day => ({
    day,
    sessions: sessions
      .filter(s => s.day_name === day)
      .sort((a, b) => normalizeTime(a.time).localeCompare(normalizeTime(b.time))),
  })).filter(d => d.sessions.length > 0);

  const cancelCount = sessions.filter(s => s.status === 'cancelled').length;

  if (loading) return null;

  return (
    <div style={{ marginTop: 28, padding: '0 24px 80px', direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: refreshing ? '#d97706' : '#16a34a' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>ועדות כנסת השבוע</span>
          {lastCheck && <span style={{ fontSize: 11, color: '#9ca3af' }}>עדכון: {lastCheck}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cancelCount > 0 && (
            <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
              {cancelCount} ביטולים
            </span>
          )}
          <button type="button" onClick={manualRefresh} disabled={refreshing}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, fontFamily: 'inherit', cursor: refreshing ? 'default' : 'pointer', border: '1px solid #e5e7eb', background: '#fff' }}>
            {refreshing ? '...' : '↻ רענן'}
          </button>
        </div>
      </div>

      {byDay.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9ca3af', padding: '12px 0' }}>אין נתונים לשבוע זה</div>
      ) : (
        byDay.map(({ day, sessions: daySessions }) => (
          <div key={day} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, borderBottom: '0.5px solid #e5e7eb', paddingBottom: 5, marginBottom: 6, color: '#111' }}>
              {day}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {daySessions.map(session => {
                const isCancelled = session.status === 'cancelled';
                const update = updateMap.get(session.id);
                const isMarked = update?.marked_in_schedule ?? false;
                const isMarking = update ? markingIds.has(update.id) : false;
                const markErr = update ? markErrors[update.id] : undefined;
                const matchedEvent = findMatchingScheduleEvent(session);

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
                          יסמן בלו"ז: <span style={{ fontWeight: 600, color: '#374151' }}>{matchedEvent.title}</span>
                        </div>
                      )}
                      {isCancelled && update && !isMarked && !matchedEvent && (
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>לא נמצא אירוע מתאים בלו"ז שלך</div>
                      )}
                      {isMarked && !markErr && matchedEvent && (
                        <div style={{ fontSize: 10, color: '#16a34a', marginTop: 3 }}>✓ מסומן בלו"ז: {matchedEvent.title}</div>
                      )}
                      {!isCancelled && matchedEvent && (
                        <div style={{ fontSize: 10, color: '#0075C4', marginTop: 4, background: '#eff6ff', borderRadius: 3, padding: '2px 6px', display: 'inline-block' }}>
                          קיים בלו"ז: <span style={{ fontWeight: 600 }}>{matchedEvent.title}</span>
                        </div>
                      )}
                      {!isCancelled && !matchedEvent && (
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>לא נמצא בלו"ז שלך</div>
                      )}
                    </div>

                    {/* Add to schedule button — for all non-cancelled sessions */}
                    {!isCancelled && !addedIds.has(session.id) && (
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

                    {/* Mark button — only for cancelled sessions with a matching schedule event */}
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
          </div>
        ))
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: '#d1d5db', textAlign: 'center' }}>
        סורק כל שעתיים · ועדות כנסת בלבד · בג&quot;ץ/ממשלה — עדכון ידני
      </div>

      {modalSession && (
        <AddToScheduleModal
          session={modalSession}
          onClose={() => setModalSession(null)}
          onSaved={(saved: ManualScheduleEvent) => {
            setAddedIds(prev => new Set([...prev, sessions.find(s => s.committee === modalSession.committee && s.day_name === modalSession.day_name && s.time === modalSession.time)?.id ?? '']));
          }}
        />
      )}
    </div>
  );
}
