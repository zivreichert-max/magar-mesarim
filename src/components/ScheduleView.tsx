'use client';
import { useState, useEffect } from 'react';
import { SCHEDULE, WEEK_TITLE, ScheduleEvent } from '@/data/schedule';
import { TIMELINE, TimelineEvent } from '@/data/timeline';
import { getScheduleCancellations, ScheduleCancellation, getManualScheduleEvents, ManualScheduleEvent } from '@/lib/supabase';
import styles from './ScheduleTable.module.css';

// Row accent within the white/blue/black palette (presentation only — the
// distinct per-category colors in schedule.ts data are kept, just not shown here)
const ACCENT: Record<string, string> = {
  bgz: '#0075C4', events: '#1e3a7b', gov: '#0c447c', ministers: '#2077BB', plenary: '#0075C4',
};
function accentFor(category: string): string {
  return ACCENT[category] ?? '#0075C4';
}

// Strip the leading institution/committee name from a title so the table's
// "topic" column shows just the subject (the institution is its own column)
function topicOf(e: ScheduleEvent): string {
  const m = e.title.match(/^([^:–]{2,70}?)\s*[:–]\s+([\s\S]+)$/) ||
            e.title.match(/^([^-]{2,70}?)\s+-\s+([\s\S]+)$/);
  if (m && /ועד|וועד|בג"ץ|בג״ץ|מליא/.test(m[1])) return m[2].trim();
  return e.title;
}

const STATIC_CATS = [
  { id: 'all',       label: 'הכל',            color: '#6b7280' },
  { id: 'bgz',       label: 'בג"ץ',           color: '#0075C4' },
  { id: 'events',    label: 'אירועים בולטים', color: '#7c3aed' },
  { id: 'gov',       label: 'ממשלה',          color: '#16a34a' },
  { id: 'ministers', label: 'ועדת שרים',      color: '#d97706' },
  { id: 'plenary',   label: 'מליאה',          color: '#0891b2' },
  { id: 'knesset',   label: 'ועדות (מוסף)',   color: '#6b7280' },
];
const STATIC_IDS = new Set(STATIC_CATS.map(c => c.id));
const KNESSET_COLOR = '#6b7280';

// Build committee filter pills dynamically from schedule data
const KNESSET_CATS = Array.from(
  new Set(SCHEDULE.filter(e => !STATIC_IDS.has(e.category)).map(e => e.category))
).map(id => ({ id, label: id, color: KNESSET_COLOR }));

const CATS = [...STATIC_CATS, ...KNESSET_CATS];
const DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי'];

const DAY_OFFSET: Record<string, number> = {
  'יום ראשון': 0, 'יום שני': 1, 'יום שלישי': 2, 'יום רביעי': 3, 'יום חמישי': 4,
};

// First (Sunday) date of the week, parsed from WEEK_TITLE.
// Supports the current "14.06-19.06" / "14.06.2026-19.06" format and the
// legacy "07-11.06" format. Returns null if the title is unparseable.
function weekSunday(): Date | null {
  // new: dd.mm[.yyyy] before the dash
  let m = WEEK_TITLE.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s*[-–]/);
  if (m) {
    const year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    return new Date(year, parseInt(m[2]) - 1, parseInt(m[1]));
  }
  // legacy: dd-dd.mm[.yyyy]
  m = WEEK_TITLE.match(/(\d{1,2})-\d{1,2}\.(\d{1,2})(?:\.(\d{4}))?/);
  if (m) {
    const year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    return new Date(year, parseInt(m[2]) - 1, parseInt(m[1]));
  }
  return null;
}

function buildGcalUrl(ev: ScheduleEvent): string {
  let dateStr = '';
  const sunday = weekSunday();
  if (sunday) {
    const base = new Date(sunday);
    base.setDate(base.getDate() + (DAY_OFFSET[ev.day] ?? 0));
    dateStr = `${base.getFullYear()}${String(base.getMonth() + 1).padStart(2, '0')}${String(base.getDate()).padStart(2, '0')}`;
  }

  const DURATION = 90;
  let startDt = '', endDt = '';
  const tm = ev.time?.match(/(\d{1,2}):(\d{2})/);
  if (dateStr && tm) {
    const h = parseInt(tm[1]), min = parseInt(tm[2]);
    const endMins = h * 60 + min + DURATION;
    startDt = `${dateStr}T${String(h).padStart(2,'0')}${String(min).padStart(2,'0')}00`;
    endDt   = `${dateStr}T${String(Math.floor(endMins/60)).padStart(2,'0')}${String(endMins%60).padStart(2,'0')}00`;
  }

  const title   = encodeURIComponent(ev.title);

  const base = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}`;
  return startDt && endDt ? `${base}&dates=${startDt}/${endDt}` : base;
}

const TL_COLORS: Record<string, string> = {
  'בג"ץ': '#0075C4',
  'פוליטי': '#7c3aed',
  'בחירות': '#dc2626',
  'כלכלי': '#16a34a',
  'גיאופוליטי': '#0891b2',
  'חגים': '#d97706',
  'מועדי כנסת ופגרה': '#6b7280',
};
function tlColor(cat: string) { return TL_COLORS[cat] ?? '#9ca3af'; }

const TL_CATS = ['הכל', ...Array.from(new Set(TIMELINE.map(e => e.category)))];
const SORTED_TIMELINE = [...TIMELINE].sort((a, b) => a.dateStart.localeCompare(b.dateStart));

function normalizeTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${(m ?? '00')}`;
}

function committeeMatches(committee: string, ev: ScheduleEvent): boolean {
  if (committee === ev.category) return true;
  // e.g. category='ביטחון לאומי', title starts with 'הוועדה לביטחון לאומי:'
  if (ev.title.startsWith(committee + ':') || ev.title.startsWith(committee + ' ')) return true;
  // partial: 'הוועדה לביטחון לאומי' contains 'ביטחון לאומי'
  if (committee.includes(ev.category) || ev.category.includes(committee)) return true;
  return false;
}

function isCancelledBySchedule(ev: ScheduleEvent, cancellations: ScheduleCancellation[]) {
  return cancellations.some(c =>
    c.day_name === ev.day &&
    normalizeTime(c.time_before) === normalizeTime(ev.time) &&
    committeeMatches(c.committee, ev)
  );
}

const MONTH_TABS = [
  { num: 6,  label: 'יוני' },
  { num: 7,  label: 'יולי' },
  { num: 8,  label: 'אוגוסט' },
  { num: 9,  label: 'ספטמבר' },
  { num: 10, label: 'אוקטובר' },
];

function evMonth(e: TimelineEvent) { return parseInt(e.dateStart.slice(5, 7)); }
function inMonthTab(e: TimelineEvent, m: number) { return m === 6 ? evMonth(e) <= 6 : evMonth(e) === m; }

export default function ScheduleView() {
  const [subView, setSubView] = useState<'weekly' | 'timeline'>('weekly');
  const [activeCat, setActiveCat] = useState('all');
  const [tlCat, setTlCat] = useState('הכל');
  const [openEvent, setOpenEvent] = useState<number | null>(null);
  const [openTl, setOpenTl] = useState<number | null>(null);
  const [cancellations, setCancellations] = useState<ScheduleCancellation[]>([]);
  const [manualEvents, setManualEvents] = useState<ManualScheduleEvent[]>([]);
  // 'all' shows every day stacked (default); a day name filters to that day only
  const [selectedWeekDay, setSelectedWeekDay] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const m = new Date().getMonth() + 1;
    return Math.max(6, Math.min(10, m));
  });

  useEffect(() => {
    getScheduleCancellations().then(setCancellations).catch(() => {});
    getManualScheduleEvents().then(setManualEvents).catch(() => {});
  }, []);

  const manualAsSchedule: ScheduleEvent[] = manualEvents.map(m => ({
    day: m.day, time: m.time, title: m.title, summary: m.summary,
    detail: m.detail, source: m.source, category: m.category, color: m.color,
  }));
  const ALL_EVENTS = [...SCHEDULE, ...manualAsSchedule];

  const filtered = ALL_EVENTS.filter(e => activeCat === 'all' || e.category === activeCat);

  // Days (ראשון–חמישי) that have at least one event under the current category filter
  const daysWithEvents = DAYS.filter(day => filtered.some(e => e.day.startsWith(day)));

  // Which day-sections to render: 'all' → every populated day; else just the picked one
  const visibleDays = selectedWeekDay === 'all'
    ? daysWithEvents
    : daysWithEvents.filter(d => d === selectedWeekDay);

  // Dates per day derived from WEEK_TITLE (supports "14.06-19.06" and legacy "07-11.06")
  const weekDates: Record<string, string> = (() => {
    const result: Record<string, string> = {};
    const sunday = weekSunday();
    if (!sunday) return result;
    DAYS.forEach(day => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + (DAY_OFFSET[day] ?? 0));
      result[day] = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    return result;
  })();

  const tlFiltered = SORTED_TIMELINE.filter(e =>
    inMonthTab(e, selectedMonth) && (tlCat === 'הכל' || e.category === tlCat)
  );

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>
      {/* Sub-tabs */}
      <div style={{
        background: '#fff', borderBottom: '0.5px solid #e5e7eb',
        display: 'flex', padding: '0 24px', position: 'sticky', top: 0, zIndex: 30,
      }}>
        {(['weekly', 'timeline'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setSubView(v)}
            style={{
              padding: '10px 18px', fontSize: 13, fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: subView === v ? '2px solid #0075C4' : '2px solid transparent',
              color: subView === v ? '#0075C4' : '#6b7280',
              fontFamily: 'inherit', touchAction: 'manipulation', marginBottom: -1,
            }}
          >
            {v === 'weekly' ? 'לו"ז' : 'אירועים בולטים'}
          </button>
        ))}
      </div>

      {subView === 'weekly' ? (
        <>
          {/* Masthead */}
          <div className={styles.masthead}>
            <h1 className={styles.title}>{WEEK_TITLE}</h1>
            <div className={styles.sub}>סדר היום השבועי · בונים מחדש</div>
          </div>

          {/* Filters: category pills + day selector */}
          <div style={{ background: '#fff', borderBottom: '0.5px solid #e5e7eb', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATS.map(cat => (
                <button key={cat.id} type="button" onClick={() => setActiveCat(cat.id)}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 600,
                    border: '1px solid #0075C4',
                    background: activeCat === cat.id ? '#0075C4' : 'transparent',
                    color: activeCat === cat.id ? '#fff' : '#0075C4',
                    borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation',
                  }}>{cat.label}</button>
              ))}
            </div>
            {/* Day filter — "הכל" (default) shows every day stacked */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', ...daysWithEvents].map(day => {
                const isSel = selectedWeekDay === day;
                const label = day === 'all' ? 'כל השבוע' : day.replace('יום ', '');
                return (
                  <button key={day} type="button" onClick={() => setSelectedWeekDay(day)}
                    style={{
                      padding: '5px 13px', fontSize: 12, fontWeight: 700, borderRadius: 4,
                      border: `1.5px solid ${isSel ? '#1e3a7b' : '#d1d5db'}`,
                      background: isSel ? '#1e3a7b' : '#fff',
                      color: isSel ? '#fff' : '#374151',
                      cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation',
                    }}>
                    {label}
                    {day !== 'all' && weekDates[day] && (
                      <span style={{ fontWeight: 400, fontSize: 10, marginInlineStart: 5, opacity: 0.8, direction: 'ltr', display: 'inline-block' }}>{weekDates[day]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ padding: '8px 24px 80px' }}>
            {visibleDays.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>אין אירועים בסינון זה</div>
            )}
            {visibleDays.map(day => {
              const dayEvents = filtered.filter(e => e.day.startsWith(day));
              return (
                <section key={day} className={styles.day}>
                  <div className={styles.dayhead}>
                    <h2>{day}</h2>
                    <span className={styles.dayDate}>{weekDates[day] ?? ''}</span>
                    <span className={styles.dayCount}>{dayEvents.length} פריטים</span>
                  </div>
                  <div className={styles.tbl}>
                    <div className={styles.thead}>
                      <div>שעה</div><div>מוסד</div><div>נושא ותקציר</div><div />
                    </div>
                    {dayEvents.map(ev => {
                      const gi = ALL_EVENTS.indexOf(ev);
                      const isOpen = openEvent === gi;
                      const hasDetail = !!(ev.summary || ev.detail);
                      const isCancelled = isCancelledBySchedule(ev, cancellations);
                      const instLabel = CATS.find(c => c.id === ev.category)?.label ?? ev.category;
                      const topic = topicOf(ev);
                      const urls = (ev.url ?? '').split('\n').map(s => s.trim()).filter(Boolean);
                      const rowCls = [
                        styles.row,
                        isOpen ? styles.open : '',
                        hasDetail ? '' : styles.noexp,
                        isCancelled ? styles.cancelled : '',
                      ].filter(Boolean).join(' ');
                      return (
                        <div key={gi} className={rowCls}
                          style={{ ['--c' as string]: isCancelled ? '#dc2626' : accentFor(ev.category) } as React.CSSProperties}
                          onClick={() => hasDetail && setOpenEvent(isOpen ? null : gi)}>
                          <div className={`${styles.cTime} ${ev.time ? '' : styles.cTimeNone}`}>{ev.time || '—'}</div>
                          <div className={styles.cInst}>
                            <span className={styles.dot} />{instLabel}
                            {isCancelled && <span className={styles.badge}>בוטל</span>}
                          </div>
                          <div className={styles.cTopic}>
                            <div className={styles.tt}>{topic}</div>
                            {ev.summary && <div className={styles.sm}>{ev.summary}</div>}
                          </div>
                          <div className={styles.cX}><span className={styles.chev}>›</span></div>

                          {hasDetail && (
                            <div className={styles.panel}><div><div className={styles.panelIn}>
                              {ev.summary && <>
                                <div className={styles.lbl}>תקציר</div>
                                <p>{ev.summary}</p>
                              </>}
                              {ev.detail && <>
                                <div className={styles.lbl}>הרחבה</div>
                                <p>{ev.detail}</p>
                              </>}
                              {urls.length > 0 && <>
                                <div className={styles.lbl}>מקורות</div>
                                <div className={styles.links}>
                                  {urls.map((u, k) => (
                                    <a key={k} href={u} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                      ↗ {u.replace(/^https?:\/\//, '').split('/')[0]}
                                    </a>
                                  ))}
                                </div>
                              </>}
                              <div className={styles.panelFoot}>
                                <span>משך משוער: 90 דקות</span>
                                <a className={styles.gcal} href={buildGcalUrl(ev)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                  📅 הוסף ליומן
                                </a>
                              </div>
                            </div></div></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Timeline category filter */}
          <div style={{ background: '#fff', borderBottom: '0.5px solid #e5e7eb', padding: '10px 24px' }}>
            <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 8 }}>אירועים בולטים עד הבחירות</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TL_CATS.map(cat => {
                const color = cat === 'הכל' ? '#6b7280' : tlColor(cat);
                return (
                  <button key={cat} type="button" onClick={() => setTlCat(cat)}
                    style={{
                      padding: '4px 12px', fontSize: 12, fontWeight: 600,
                      border: `1px solid ${color}`,
                      background: tlCat === cat ? color : 'transparent',
                      color: tlCat === cat ? '#fff' : color,
                      borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation',
                    }}>{cat}</button>
                );
              })}
            </div>
          </div>
          {/* Month tab bar */}
          <div style={{ display: 'flex', background: '#f0f4f9', borderBottom: '2px solid #dde3ed', overflowX: 'auto', direction: 'rtl' }}>
            {MONTH_TABS.map(({ num, label }) => {
              const isSel = selectedMonth === num;
              const count = SORTED_TIMELINE.filter(e => inMonthTab(e, num)).length;
              return (
                <button key={num} type="button" onClick={() => setSelectedMonth(num)}
                  style={{
                    padding: '10px 16px', minWidth: 76, textAlign: 'center',
                    background: isSel ? '#1e3a7b' : 'transparent',
                    color: isSel ? '#fff' : '#1e3a7b',
                    border: 'none', borderLeft: '1px solid #dde3ed',
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, touchAction: 'manipulation',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>{count} אירועים</div>
                </button>
              );
            })}
          </div>
          <div style={{ padding: '12px 24px 80px' }}>
            {tlFiltered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>אין אירועים בסינון זה</div>
            ) : (
              <div className={styles.tlTable}>
                <div className={styles.tlHead}><div>תאריך</div><div>קטגוריה</div><div>אירוע</div><div /></div>
                {tlFiltered.map((ev, idx) => {
                  const isOpen = openTl === idx;
                  const hasDetail = !!ev.detail;
                  const compact = (iso: string) => { const p = iso.split('-'); return `${+p[2]}.${+p[1]}`; };
                  const dateLabel = ev.dateEnd && ev.dateEnd !== ev.dateStart
                    ? `${compact(ev.dateStart)}–${compact(ev.dateEnd)}` : compact(ev.dateStart);
                  const isEstimate = ev.importance === 'הערכה';
                  const rowCls = [styles.tlRow, isOpen ? styles.open : '', hasDetail ? '' : styles.noexp].filter(Boolean).join(' ');
                  return (
                    <div key={idx} className={rowCls}
                      style={{ ['--c' as string]: '#0075C4' } as React.CSSProperties}
                      onClick={() => hasDetail && setOpenTl(isOpen ? null : idx)}>
                      <div className={styles.tlDate}>{dateLabel}</div>
                      <div className={styles.tlCat}>
                        {ev.category}{isEstimate && <span style={{ fontWeight: 400, color: '#9ca3af' }}> · הערכה</span>}
                      </div>
                      <div className={styles.tlMain}>
                        <div className={styles.tlTitle}>{ev.title}</div>
                        {ev.detail && <div className={styles.tlSnippet}>{ev.detail}</div>}
                      </div>
                      <div className={styles.cX}><span className={styles.chev}>›</span></div>

                      {hasDetail && (
                        <div className={styles.panel}><div><div className={styles.panelIn}>
                          <p>{ev.detail}</p>
                          {ev.url && (
                            <div className={styles.links}>
                              <a href={ev.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>↗ מקור</a>
                            </div>
                          )}
                        </div></div></div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
