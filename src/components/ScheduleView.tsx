'use client';
import { useState, useMemo } from 'react';
import { RECESS_SCHEDULE, RECESS_SCHEDULE_TITLE, RecessScheduleItem, RecessArenaId } from '@/data/recessSchedule';
import { TIMELINE, TimelineEvent } from '@/data/timeline';
import { safeUrl } from '@/lib/urls';
import styles from './ScheduleTable.module.css';

// ===== Recess schedule (לו"ז) =====
// Recess format: dated items only (deadlines, hearings, events), grouped by
// arena → day. Arenas mirror the sekira tabs; an empty arena is not rendered.
// Background/status content lives in the sekira — never duplicated here.

const rcKey = (arena: string, day: string, it: RecessScheduleItem) => `${arena}|${day}|${it.title}`;

// Open tag set — known tags get a color, anything else falls back to neutral
const TAG_COLORS: Record<string, { fg: string; bg: string; border: string }> = {
  'דדליין': { fg: '#b45309', bg: '#fffbeb', border: '#e8d3a8' },
  'דיון': { fg: '#0075C4', bg: '#e9f2fa', border: '#c6d3e8' },
};
const TAG_FALLBACK = { fg: '#475569', bg: '#f1f5f9', border: '#d7dde5' };

function RcTag({ tag }: { tag: string }) {
  const c = TAG_COLORS[tag] ?? TAG_FALLBACK;
  return (
    <span className={styles.rcTag} style={{ color: c.fg, background: c.bg, borderColor: c.border }}>
      {tag}
    </span>
  );
}

// All-day Google-Calendar link from a day header like "יום רביעי, 22.7"
function rcGcalUrl(day: string, title: string): string {
  const base = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}`;
  const m = day.match(/(\d{1,2})\.(\d{1,2})/);
  if (!m) return base;
  const year = new Date().getFullYear();
  const start = new Date(year, parseInt(m[2]) - 1, parseInt(m[1]));
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${base}&dates=${fmt(start)}/${fmt(end)}`;
}

// ===== Timeline (אירועים בולטים) =====

const tlKey = (e: TimelineEvent) => `${e.dateStart}|${e.title}`;

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

const MONTH_TABS = [
  { num: 6,  label: 'יוני' },
  { num: 7,  label: 'יולי' },
  { num: 8,  label: 'אוגוסט' },
  { num: 9,  label: 'ספטמבר' },
  { num: 10, label: 'אוקטובר' },
];

function evMonth(e: TimelineEvent) { return parseInt(e.dateStart.slice(5, 7)); }
function inMonthTab(e: TimelineEvent, m: number) { return m === 6 ? evMonth(e) <= 6 : evMonth(e) === m; }

export default function ScheduleView({ onOpenSekira }: {
  // Cross-link: opens the סקירה tab on the arena matching a schedule section
  onOpenSekira?: (tab: RecessArenaId) => void;
}) {
  const [subView, setSubView] = useState<'weekly' | 'timeline'>('weekly');
  const [tlCat, setTlCat] = useState('הכל');
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [openTl, setOpenTl] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const m = new Date().getMonth() + 1;
    return Math.max(6, Math.min(10, m));
  });

  // Empty arenas are hidden entirely — no "אין פריטים" placeholder
  const arenas = RECESS_SCHEDULE.filter(a => a.days.some(d => d.items.length > 0));

  const tlFiltered = useMemo(
    () => SORTED_TIMELINE.filter(e =>
      inMonthTab(e, selectedMonth) && (tlCat === 'הכל' || e.category === tlCat)
    ),
    [selectedMonth, tlCat]
  );

  return (
    <div style={{ direction: 'rtl', fontFamily: "var(--font-heebo), sans-serif" }}>
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
          {/* Masthead — title comes from the document (rolling two-week range) */}
          <div className={styles.masthead}>
            <h1 className={styles.title}>{RECESS_SCHEDULE_TITLE}</h1>
            <div className={styles.sub}>סדר היום לתקופת הפגרה · בונים מחדש</div>
          </div>

          <div style={{ padding: '8px 24px 80px', maxWidth: 900, margin: '0 auto' }}>
            {arenas.map(arena => (
              <section key={arena.arena} className={styles.day}>
                <div className={styles.dayhead}>
                  <h2>{arena.label}</h2>
                  {onOpenSekira && (
                    <button
                      type="button"
                      className={styles.rcSekiraLink}
                      onClick={() => onOpenSekira(arena.arena)}
                    >
                      לסקירה המלאה ←
                    </button>
                  )}
                </div>

                {arena.days.filter(d => d.items.length > 0).map(day => (
                  <div key={day.day} className={styles.rcDay}>
                    <div className={styles.rcDayName}>{day.day}</div>
                    <div className={styles.rcTbl}>
                      {day.items.map(it => {
                        const k = rcKey(arena.arena, day.day, it);
                        const isOpen = openItem === k;
                        // Per the document rules: click opens the הרחבה; items
                        // without one (or sources) are not clickable
                        const hasPanel = !!it.detail || it.sources.length > 0;
                        const rowCls = [
                          styles.rcRow,
                          isOpen ? styles.open : '',
                          hasPanel ? '' : styles.noexp,
                        ].filter(Boolean).join(' ');
                        return (
                          <div key={k} className={rowCls}
                            onClick={() => hasPanel && setOpenItem(isOpen ? null : k)}>
                            <div className={styles.rcTagCell}>
                              {it.tag ? <RcTag tag={it.tag} /> : <span className={styles.rcNoTag}>—</span>}
                            </div>
                            <div className={styles.cTopic}>
                              <div className={styles.tt}>{it.title}</div>
                              {it.summary && <div className={styles.rcSummary}>{it.summary}</div>}
                            </div>
                            <div className={styles.cX}><span className={styles.chev}>›</span></div>

                            {hasPanel && (
                              <div className={styles.panel}><div><div className={styles.panelIn}>
                                {it.detail && <>
                                  <div className={styles.lbl}>הרחבה</div>
                                  <p>{it.detail}</p>
                                </>}
                                {it.sources.length > 0 && <>
                                  <div className={styles.lbl}>סימוכין</div>
                                  <div className={styles.links}>
                                    {it.sources.map((s, i) => {
                                      const u = s.url && (s.url.startsWith('/') ? s.url : safeUrl(s.url));
                                      return u ? (
                                        <a key={i} href={u} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                          ↗ {s.label}
                                        </a>
                                      ) : (
                                        <span key={i} style={{ fontSize: 12, color: '#6b7280', marginInlineEnd: 14 }}>{s.label}</span>
                                      );
                                    })}
                                  </div>
                                </>}
                                <div className={styles.panelFoot}>
                                  <span>{day.day}</span>
                                  <a className={styles.gcal} href={rcGcalUrl(day.day, it.title)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                    📅 הוסף ליומן
                                  </a>
                                </div>
                              </div></div></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
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
                {tlFiltered.map(ev => {
                  const k = tlKey(ev);
                  const isOpen = openTl === k;
                  const hasDetail = !!ev.detail;
                  const compact = (iso: string) => { const p = iso.split('-'); return `${+p[2]}.${+p[1]}`; };
                  const dateLabel = ev.dateEnd && ev.dateEnd !== ev.dateStart
                    ? `${compact(ev.dateStart)}–${compact(ev.dateEnd)}` : compact(ev.dateStart);
                  const isEstimate = ev.importance === 'הערכה';
                  const rowCls = [styles.tlRow, isOpen ? styles.open : '', hasDetail ? '' : styles.noexp].filter(Boolean).join(' ');
                  return (
                    <div key={k} className={rowCls}
                      style={{ ['--c' as string]: '#0075C4' } as React.CSSProperties}
                      onClick={() => hasDetail && setOpenTl(isOpen ? null : k)}>
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
                          {safeUrl(ev.url) && (
                            <div className={styles.links}>
                              <a href={safeUrl(ev.url)!} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>↗ מקור</a>
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
