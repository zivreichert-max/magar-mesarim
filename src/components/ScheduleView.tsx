'use client';
import { useState, useEffect } from 'react';
import { SCHEDULE, WEEK_TITLE, ScheduleEvent } from '@/data/schedule';
import { TIMELINE, TimelineEvent } from '@/data/timeline';
import { getScheduleCancellations, ScheduleCancellation } from '@/lib/supabase';

const STATIC_CATS = [
  { id: 'all',       label: 'הכל',            color: '#6b7280' },
  { id: 'bgz',       label: 'בג"ץ',           color: '#0075C4' },
  { id: 'events',    label: 'אירועים בולטים', color: '#7c3aed' },
  { id: 'gov',       label: 'ממשלה',          color: '#16a34a' },
  { id: 'ministers', label: 'ועדת שרים',      color: '#d97706' },
  { id: 'plenary',   label: 'מליאה',          color: '#0891b2' },
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

function buildGcalUrl(ev: ScheduleEvent): string {
  // WEEK_TITLE format: 'לו"ז 07-11.06' → startDay=07, month=06
  let dateStr = '';
  const m = WEEK_TITLE.match(/(\d{1,2})-\d{1,2}\.(\d{2})(?:\.(\d{4}))?/);
  if (m) {
    const year = m[3] ?? String(new Date().getFullYear());
    const base = new Date(`${year}-${m[2]}-${m[1].padStart(2, '0')}`);
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

const MONTHS = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
function fmtDate(iso: string) {
  const parts = iso.split('-');
  return `${parseInt(parts[2])} ב${MONTHS[parseInt(parts[1])]}`;
}

const TL_CATS = ['הכל', ...Array.from(new Set(TIMELINE.map(e => e.category)))];
const SORTED_TIMELINE = [...TIMELINE].sort((a, b) => a.dateStart.localeCompare(b.dateStart));

function normalizeTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${(m ?? '00')}`;
}

function isCancelledBySchedule(ev: ScheduleEvent, cancellations: ScheduleCancellation[]) {
  return cancellations.some(c =>
    c.day_name === ev.day &&
    normalizeTime(c.time_before) === normalizeTime(ev.time) &&
    c.committee === ev.category
  );
}

export default function ScheduleView() {
  const [subView, setSubView] = useState<'weekly' | 'timeline'>('weekly');
  const [activeCat, setActiveCat] = useState('all');
  const [tlCat, setTlCat] = useState('הכל');
  const [openEvent, setOpenEvent] = useState<number | null>(null);
  const [openTl, setOpenTl] = useState<number | null>(null);
  const [cancellations, setCancellations] = useState<ScheduleCancellation[]>([]);

  useEffect(() => {
    getScheduleCancellations().then(setCancellations).catch(() => {});
  }, []);

  const filtered = SCHEDULE.filter(e => activeCat === 'all' || e.category === activeCat);
  const byDay = DAYS.map(day => ({
    day,
    events: filtered.filter(e => e.day.startsWith(day)),
  })).filter(d => d.events.length > 0);

  const tlFiltered = SORTED_TIMELINE.filter(e => tlCat === 'הכל' || e.category === tlCat);

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
          {/* Week title + category filter */}
          <div style={{ background: '#fff', borderBottom: '0.5px solid #e5e7eb', padding: '10px 24px' }}>
            <div style={{ fontSize: 12, color: '#0075C4', fontWeight: 600, marginBottom: 8 }}>{WEEK_TITLE}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATS.map(cat => (
                <button key={cat.id} type="button" onClick={() => setActiveCat(cat.id)}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${cat.color}`,
                    background: activeCat === cat.id ? cat.color : 'transparent',
                    color: activeCat === cat.id ? '#fff' : cat.color,
                    borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation',
                  }}>{cat.label}</button>
              ))}
            </div>
          </div>
          <div style={{ padding: '16px 24px 80px' }}>
            {byDay.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>אין אירועים בסינון זה</div>
            )}
            {byDay.map(({ day, events }) => (
              <div key={day} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, borderBottom: '0.5px solid #e5e7eb', paddingBottom: 6, marginBottom: 6 }}>{day}</div>
                {events.map(ev => {
                  const gi = SCHEDULE.indexOf(ev);
                  const isOpen = openEvent === gi;
                  const hasDetail = !!(ev.summary || ev.detail);
                  const isCancelled = isCancelledBySchedule(ev, cancellations);
                  return (
                    <div key={gi}
                      style={{ background: isCancelled ? '#fff5f5' : '#fff', border: `0.5px solid ${isCancelled ? '#fca5a5' : '#e5e7eb'}`, borderRight: `3px solid ${isCancelled ? '#dc2626' : ev.color}`, borderRadius: 4, marginBottom: 5, overflow: 'hidden', cursor: hasDetail ? 'pointer' : 'default', opacity: isCancelled ? 0.75 : 1 }}
                      onClick={() => hasDetail && setOpenEvent(isOpen ? null : gi)}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px' }}>
                        {ev.time && <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 38, paddingTop: 2, flexShrink: 0 }}>{ev.time}</span>}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 2, background: ev.color + '20', color: ev.color }}>
                              {CATS.find(c => c.id === ev.category)?.label}
                            </div>
                            {isCancelled && (
                              <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 2, background: '#fee2e2', color: '#dc2626' }}>
                                בוטל
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, textDecoration: isCancelled ? 'line-through' : 'none', color: isCancelled ? '#9ca3af' : 'inherit' }}>{ev.title}</div>
                        </div>
                        {hasDetail && <span style={{ color: '#0075C4', fontSize: 16, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>›</span>}
                      </div>
                      {isOpen && hasDetail && (
                        <div className="animate-fade-up" style={{ borderTop: '0.5px solid #e5e7eb', padding: '10px 14px', background: '#fafbff' }}>
                          {ev.summary && <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#0075C4', marginBottom: 4, letterSpacing: '0.06em' }}>תקציר</div>
                            <div style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>{ev.summary}</div>
                          </div>}
                          {ev.detail && <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#0075C4', marginBottom: 4, letterSpacing: '0.06em' }}>הרחבה</div>
                            <div style={{ fontSize: 12, lineHeight: 1.75, color: '#555', whiteSpace: 'pre-wrap' }}>{ev.detail}</div>
                          </div>}
                          {ev.url && (
                            <a href={ev.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#0075C4' }}>
                              לקישור המקור ›
                            </a>
                          )}
                          <div style={{ borderTop: '0.5px solid #e5e7eb', paddingTop: 10, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>משך משוער: 90 דקות</span>
                            <a
                              href={buildGcalUrl(ev)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#0075C4', color: '#fff', borderRadius: 4, fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}
                            >
                              📅 הוסף ליומן
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
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
          <div style={{ padding: '16px 24px 80px' }}>
            {tlFiltered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>אין אירועים בסינון זה</div>
            )}
            {tlFiltered.map((ev, idx) => {
              const isOpen = openTl === idx;
              const hasDetail = !!(ev.detail);
              const color = tlColor(ev.category);
              const isEstimate = ev.importance === 'הערכה';
              const daySpan = ev.dateEnd && ev.dateEnd !== ev.dateStart
                ? Math.round((new Date(ev.dateEnd).getTime() - new Date(ev.dateStart).getTime()) / 86400000)
                : 0;
              const isWindow = daySpan > 20;
              return (
                <div key={idx}
                  style={{ background: isWindow ? color + '08' : '#fff', border: isWindow ? `1px solid ${color}40` : '0.5px solid #e5e7eb', borderRight: `3px solid ${color}`, borderRadius: 4, marginBottom: 5, overflow: 'hidden', cursor: hasDetail ? 'pointer' : 'default' }}
                  onClick={() => hasDetail && setOpenTl(isOpen ? null : idx)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px' }}>
                    <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 52 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isWindow ? color : '#111', lineHeight: 1.2 }}>{fmtDate(ev.dateStart)}</div>
                      {ev.dateEnd && ev.dateEnd !== ev.dateStart && (
                        <div style={{ fontSize: 10, color: isWindow ? color : '#9ca3af', fontWeight: isWindow ? 600 : 400 }}>–{fmtDate(ev.dateEnd)}</div>
                      )}
                      {isWindow && <div style={{ fontSize: 8, fontWeight: 700, color, letterSpacing: '0.05em', marginTop: 2 }}>חלון</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 2, background: color + '20', color }}>{ev.category}</div>
                        {isEstimate && <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 500 }}>הערכה</div>}
                      </div>
                      <div style={{ fontSize: isWindow ? 14 : 13, fontWeight: isWindow ? 700 : 500, lineHeight: 1.4 }}>{ev.title}</div>
                    </div>
                    {hasDetail && <span style={{ color: '#0075C4', fontSize: 16, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>›</span>}
                    {ev.url && !hasDetail && (
                      <a href={ev.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, color: '#0075C4', flexShrink: 0 }}>קישור</a>
                    )}
                  </div>
                  {isOpen && hasDetail && (
                    <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '10px 14px', background: '#fafbff' }}>
                      <div style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>{ev.detail}</div>
                      {ev.url && (
                        <a href={ev.url} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#0075C4' }}>לקישור המקור ›</a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
