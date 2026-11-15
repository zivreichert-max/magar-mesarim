'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getWeeklyKnessetSessions, KnessetSessionRow,
  getManualEventsForWeek, addManualEventForWeek, deleteManualEvent, ManualScheduleEvent,
  getOfficePapers, setOfficePaper,
} from '@/lib/supabase';
import { localIso, anchorSunday, normalizeTime } from '@/lib/scheduleUtils';
import { safeUrl } from '@/lib/urls';
import type { GovAgendaItem } from '@/app/api/gov-agenda/route';
import { KEY_DATES } from '@/data/keyDates';
import s from './Office.module.css';

// Weekly schedule — ONE lean table for the whole week: day → time / body /
// topic. Sources: Knesset committees + plenum (Supabase, filled by
// sync-knesset.mjs), government + ministerial-committee agendas (gov.il via
// /api/gov-agenda), Supreme Court hearings (the בג"ץ rows of the key-dates
// workbook), and manual rows the admin adds.
//
// Clicking a row opens its detail: the official source, and a position-paper
// link that the admin can attach (shown on the row as a "נייר עמדה" chip).

const DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי'];
const SHORT = (d: string) => d.replace('יום ', '');

type Kind = 'cm' | 'pl' | 'gov' | 'court' | 'manual';
const COURT_CATEGORY = 'בג"ץ';

interface Row {
  key: string;        // stable id — position papers are stored under it
  time: string;       // '' when unknown
  body: string;
  topic: string;
  url: string | null;
  kind: Kind;
  cancelled?: boolean;
  manualId?: string;
}

const COLORS: Record<'gov' | 'pl' | 'cm' | 'court', string> = {
  gov: '#0d0d0d', pl: '#1e3a7b', cm: '#1f72c4', court: '#7c3aed',
};

// Manual rows carry a free-text body — color them like the matching arena
function colorFor(row: Row): string {
  if (row.kind === 'court' || /בג"ץ|בית המשפט/.test(row.body)) return COLORS.court;
  if (row.kind === 'pl' || /מליאה/.test(row.body)) return COLORS.pl;
  if (row.kind === 'gov' || /ממשלה|קבינט|שרים/.test(row.body)) return COLORS.gov;
  return COLORS.cm;
}

const SOURCE_LABEL: Record<Kind, string> = {
  cm: 'לעמוד הדיון באתר הכנסת',
  pl: 'לסדר היום של המליאה',
  gov: 'לסדר היום באתר gov.il',
  court: 'למקור',
  manual: 'למקור',
};

function weekDays(offset: number, now: Date) {
  const sunday = anchorSunday(now, offset);
  return DAYS.map((name, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return { name, iso: localIso(d), display: `${d.getDate()}.${d.getMonth() + 1}` };
  });
}

export default function OfficeWeek({ adminKey }: { adminKey: string }) {
  const [sessions, setSessions] = useState<KnessetSessionRow[]>([]);
  const [gov, setGov] = useState<GovAgendaItem[]>([]);
  const [manual, setManual] = useState<ManualScheduleEvent[]>([]);
  // Position-paper links (row key → url). null = the feature is unavailable
  // (database update not run yet) — the UI then simply doesn't offer it.
  const [papers, setPapers] = useState<Record<string, string> | null>(null);
  const [offset, setOffset] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ day: DAYS[0], time: '', body: '', topic: '' });
  const [open, setOpen] = useState<string | null>(null);
  const [paperDraft, setPaperDraft] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  // Recompute "today" when the tab regains focus so a tab left open over a
  // week boundary doesn't keep showing last week
  const [dayStamp, setDayStamp] = useState(() => localIso(new Date()));
  useEffect(() => {
    const refresh = () => setDayStamp(localIso(new Date()));
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const days = useMemo(() => weekDays(offset, new Date(`${dayStamp}T12:00:00`)), [offset, dayStamp]);
  const weekId = days[0].iso;

  // Bumping the tick re-runs the manual-events fetch after an add/delete
  const [manualTick, setManualTick] = useState(0);
  const loadManual = () => setManualTick(t => t + 1);
  useEffect(() => {
    let cancelled = false;
    getManualEventsForWeek(weekId).then(rows => { if (!cancelled) setManual(rows); });
    return () => { cancelled = true; };
  }, [weekId, manualTick]);

  // The feeds load independently: the table appears as soon as the Knesset
  // sessions arrive, and government rows join when gov.il answers (or are
  // skipped after 8s) — a slow feed never blocks the schedule.
  useEffect(() => {
    let cancelled = false;
    getWeeklyKnessetSessions()
      .catch(() => [] as KnessetSessionRow[])
      .then(sess => { if (!cancelled) { setSessions(sess); setLoading(false); } });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    fetch('/api/gov-agenda', { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : { items: [] }))
      .catch(() => ({ items: [] }))
      .then((d: { items?: GovAgendaItem[] }) => { if (!cancelled) setGov(d.items ?? []); })
      .finally(() => clearTimeout(timer));

    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getOfficePapers(adminKey).then(p => { if (!cancelled) setPapers(p); });
    return () => { cancelled = true; };
  }, [adminKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const d of days) map.set(d.name, []);
    const dateOf = Object.fromEntries(days.map(d => [d.name, d.display]));
    const isoOf = Object.fromEntries(days.map(d => [d.iso, d.name]));

    for (const x of sessions) {
      // A stored row is pinned to a week by day-name + "16.11" display date
      if (dateOf[x.day_name] !== x.date) continue;
      const plenary = x.session_type === 'plenary';
      map.get(x.day_name)!.push({
        key: `k${x.id}`, time: normalizeTime(x.time), body: x.committee, topic: x.title,
        url: safeUrl(x.url), kind: plenary ? 'pl' : 'cm', cancelled: x.status === 'cancelled',
      });
    }
    for (const g of gov) {
      const dayName = g.meetingDate ? isoOf[g.meetingDate] : undefined;
      if (!dayName) continue;
      map.get(dayName)!.push({
        key: `g${g.url}`, time: '', body: g.label, topic: g.description,
        url: safeUrl(g.url), kind: 'gov',
      });
    }
    for (const k of KEY_DATES) {
      const dayName = k.category === COURT_CATEGORY ? isoOf[k.date] : undefined;
      if (!dayName) continue;
      map.get(dayName)!.push({
        key: `c${k.date}${k.title}`, time: k.time, body: COURT_CATEGORY, topic: k.title,
        url: safeUrl(k.url), kind: 'court',
      });
    }
    for (const m of manual) {
      if (!map.has(m.day)) continue;
      map.get(m.day)!.push({
        key: `m${m.id}`, time: normalizeTime(m.time), body: m.category, topic: m.title,
        url: safeUrl(m.source), kind: 'manual', manualId: m.id,
      });
    }
    // Untimed rows (gov agendas) first, then by time
    for (const rows of map.values()) rows.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [days, sessions, gov, manual]);

  // Friday is shown only when something is scheduled on it
  const shownDays = days.filter((d, i) => i < 5 || (byDay.get(d.name)?.length ?? 0) > 0);
  // "15–19.11" within one month, "29.11–3.12" across months
  const first = shownDays[0].display, last = shownDays[shownDays.length - 1].display;
  const rangeLabel = first.split('.')[1] === last.split('.')[1]
    ? `${first.split('.')[0]}–${last}`
    : `${first}–${last}`;
  const lastSync = sessions.reduce((max, x) => (x.last_seen && x.last_seen > max ? x.last_seen : max), '');
  const canAttach = papers !== null;

  async function submit() {
    setErr('');
    if (!form.body.trim() || !form.topic.trim()) { setErr('חסר גוף או נושא'); return; }
    try {
      await addManualEventForWeek(weekId, {
        day: form.day, time: form.time.trim(), title: form.topic.trim(),
        summary: '', detail: '', source: '', category: form.body.trim(), color: '',
      });
      setForm(f => ({ ...f, time: '', topic: '' }));
      loadManual();
    } catch (e) {
      setErr(`השמירה נכשלה: ${(e as Error).message}`);
    }
  }

  async function remove(id: string) {
    try { await deleteManualEvent(id); setOpen(null); loadManual(); }
    catch (e) { setErr(`המחיקה נכשלה: ${(e as Error).message}`); }
  }

  async function savePaper(rowKey: string, rawUrl: string) {
    setErr('');
    const url = rawUrl.trim();
    if (url && !safeUrl(url)) { setErr('הקישור צריך להתחיל ב-https://'); return; }
    const ok = await setOfficePaper(adminKey, rowKey, url);
    if (!ok) { setErr('שמירת נייר העמדה נכשלה'); return; }
    setPapers(prev => {
      const next = { ...(prev ?? {}) };
      if (url) next[rowKey] = url; else delete next[rowKey];
      return next;
    });
    setPaperDraft('');
  }

  function toggle(key: string) {
    setErr('');
    setPaperDraft('');
    setOpen(prev => (prev === key ? null : key));
  }

  async function copyWhatsapp() {
    const lines = [`📅 *השבוע בכנסת | ${rangeLabel}*`, ''];
    for (const d of shownDays) {
      const rows = (byDay.get(d.name) ?? []).filter(r => !r.cancelled);
      lines.push(`*${SHORT(d.name)} ${d.display}*`);
      if (rows.length === 0) lines.push('• לא פורסמו דיונים');
      for (const r of rows) {
        const topic = r.topic ? `: ${r.topic}` : '';
        lines.push(`• ${r.time ? r.time + ' ' : ''}${r.body}${topic}`);
      }
      lines.push('');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n').trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setErr('ההעתקה ללוח נכשלה'); }
  }

  if (loading) return <div className={s.none}>טוען…</div>;

  return (
    <>
      <div className={s.mast}>
        <h1>{offset === 0 ? 'השבוע' : 'שבוע הבא'}</h1>
        <span className={s.mastDate} dir="ltr">{rangeLabel}</span>
        <div className={s.mastTools}>
          <div className={s.seg}>
            <button type="button" className={offset === 0 ? s.on : ''} onClick={() => setOffset(0)}>השבוע</button>
            <button type="button" className={offset === 1 ? s.on : ''} onClick={() => setOffset(1)}>שבוע הבא</button>
          </div>
          <button type="button" className={s.btn} onClick={() => setFormOpen(o => !o)}>
            {formOpen ? 'סגור' : '+ אירוע'}
          </button>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={copyWhatsapp}>
            {copied ? 'הועתק ✓' : 'העתק לוואטסאפ'}
          </button>
        </div>
      </div>

      {formOpen && (
        <div className={s.form}>
          <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} aria-label="יום">
            {days.map(d => <option key={d.name} value={d.name}>{SHORT(d.name)} {d.display}</option>)}
          </select>
          <input placeholder="שעה 16:00" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} aria-label="שעה" />
          <input placeholder="גוף (מליאה, קבינט…)" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} aria-label="גוף" />
          <input placeholder="נושא" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }} aria-label="נושא" />
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={submit}>הוסף</button>
        </div>
      )}
      {err && <div className={s.err}>{err}</div>}

      <div className={s.tbl}>
        <div className={s.thead}><div>יום</div><div>שעה</div><div>גוף</div><div>נושא</div></div>
        {shownDays.map(d => {
          const rows = byDay.get(d.name) ?? [];
          return (
            <div key={d.name} className={s.day}>
              <div className={`${s.dayCell} ${d.iso === dayStamp ? s.dayToday : ''}`}>
                <b>{SHORT(d.name)}</b><span>{d.display}</span>
              </div>
              <div>
                {rows.length === 0 && <div className={s.none}>לא פורסמו דיונים</div>}
                {rows.map(r => {
                  const paper = papers ? safeUrl(papers[r.key]) : null;
                  const expandable = !!(r.url || canAttach || r.manualId);
                  const expanded = expandable && open === r.key;
                  const cls = `${s.row} ${expandable ? s.rowClick : ''} ${r.cancelled ? s.cancelled : ''}`;
                  return (
                    <div key={r.key} className={s.rowWrap}>
                      <div
                        className={cls}
                        style={{ ['--c' as string]: colorFor(r) }}
                        role={expandable ? 'button' : undefined}
                        tabIndex={expandable ? 0 : undefined}
                        aria-expanded={expandable ? expanded : undefined}
                        onClick={expandable ? () => toggle(r.key) : undefined}
                        onKeyDown={expandable ? e => {
                          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(r.key); }
                        } : undefined}
                      >
                        <span className={`${s.time} ${r.time ? '' : s.timeNone}`}>{r.time || '—'}</span>
                        <span className={s.body}><span className={s.dot} />{r.body}</span>
                        <span className={s.topic}>
                          <span className={`${s.topicText} ${r.topic ? '' : s.topicNone}`}>{r.topic || 'הנושא טרם פורסם'}</span>
                          {paper && (
                            <a className={`${s.tag} ${s.tagPaper}`} href={paper} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}>נייר עמדה</a>
                          )}
                          {r.cancelled && <span className={`${s.tag} ${s.tagRed}`}>בוטל</span>}
                          {r.kind === 'manual' && <span className={s.tag}>ידני</span>}
                        </span>
                      </div>
                      {expanded && (
                        <div className={s.detail}>
                          {r.url && (
                            <div><a href={r.url} target="_blank" rel="noopener noreferrer">{SOURCE_LABEL[r.kind]} ↗</a></div>
                          )}
                          {canAttach && (
                            <>
                              <div className={s.lbl}>נייר עמדה</div>
                              {paper ? (
                                <div className={s.inline}>
                                  <a href={paper} target="_blank" rel="noopener noreferrer">פתיחת נייר העמדה ↗</a>
                                  <button type="button" className={s.btn} onClick={() => savePaper(r.key, '')}>הסר</button>
                                </div>
                              ) : (
                                <div className={s.inline}>
                                  <input
                                    dir="ltr" placeholder="https://…  קישור לנייר העמדה" value={paperDraft} aria-label="קישור לנייר עמדה"
                                    onChange={e => setPaperDraft(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') savePaper(r.key, paperDraft); }}
                                  />
                                  <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => savePaper(r.key, paperDraft)}>צרף</button>
                                </div>
                              )}
                            </>
                          )}
                          {r.manualId && (
                            <div className={s.inline} style={{ marginTop: 10 }}>
                              <button type="button" className={s.btn} onClick={() => remove(r.manualId!)}>מחיקת האירוע</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={s.meta}>
        <span>ועדות ומליאה: אתר הכנסת{lastSync ? ` · סונכרן ${new Date(lastSync).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        <span>ממשלה וועדת שרים: gov.il</span>
        <span>בג&quot;ץ: אקסל המועדים</span>
      </div>
    </>
  );
}
