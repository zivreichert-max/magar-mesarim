'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getWeeklyKnessetSessions, KnessetSessionRow,
  getManualEventsForWeek, addManualEventForWeek, deleteManualEvent, ManualScheduleEvent,
} from '@/lib/supabase';
import { localIso, anchorSunday, normalizeTime } from '@/lib/scheduleUtils';
import { safeUrl } from '@/lib/urls';
import type { GovAgendaItem } from '@/app/api/gov-agenda/route';
import s from './Office.module.css';

// Weekly schedule for the לשכה tab — ONE lean table for the whole week:
// day → time / body / topic. Sources: Knesset committees + plenum (Supabase,
// filled by sync-knesset.mjs), government + ministerial-committee agendas
// (gov.il via /api/gov-agenda), and manual rows the admin adds.

const DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי'];
const SHORT = (d: string) => d.replace('יום ', '');

type Kind = 'cm' | 'pl' | 'gov' | 'manual';
interface Row {
  key: string;
  time: string;       // '' when unknown
  body: string;
  topic: string;
  url: string | null;
  kind: Kind;
  cancelled?: boolean;
  closed?: boolean;
  manualId?: string;
}

const COLORS: Record<'gov' | 'pl' | 'cm', string> = { gov: '#111827', pl: '#1e3a7b', cm: '#0075C4' };

// Manual rows carry a free-text body — color them like the matching arena
function colorFor(row: Row): string {
  if (row.kind === 'pl' || /מליאה/.test(row.body)) return COLORS.pl;
  if (row.kind === 'gov' || /ממשלה|קבינט|שרים/.test(row.body)) return COLORS.gov;
  return COLORS.cm;
}

function weekDays(offset: number, now: Date) {
  const sunday = anchorSunday(now, offset);
  return DAYS.map((name, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return { name, iso: localIso(d), display: `${d.getDate()}.${d.getMonth() + 1}` };
  });
}

export default function OfficeWeek() {
  const [sessions, setSessions] = useState<KnessetSessionRow[]>([]);
  const [gov, setGov] = useState<GovAgendaItem[]>([]);
  const [manual, setManual] = useState<ManualScheduleEvent[]>([]);
  const [offset, setOffset] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ day: DAYS[0], time: '', body: '', topic: '' });
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sess, govRes] = await Promise.all([
        getWeeklyKnessetSessions(),
        fetch('/api/gov-agenda').then(r => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
      ]);
      if (cancelled) return;
      setSessions(sess);
      setGov((govRes as { items?: GovAgendaItem[] }).items ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

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
    try { await deleteManualEvent(id); loadManual(); }
    catch (e) { setErr(`המחיקה נכשלה: ${(e as Error).message}`); }
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
                  const style = { ['--c' as string]: colorFor(r) };
                  const inner = (
                    <>
                      <div className={`${s.time} ${r.time ? '' : s.timeNone}`}>{r.time || '—'}</div>
                      <div className={s.body}><span className={s.dot} />{r.body}</div>
                      <div className={s.topic}>
                        <span className={`${s.topicText} ${r.topic ? '' : s.topicNone}`}>{r.topic || 'הנושא טרם פורסם'}</span>
                        {r.cancelled && <span className={`${s.tag} ${s.tagRed}`}>בוטל</span>}
                        {r.kind === 'manual' && <span className={s.tag}>ידני</span>}
                        {r.manualId && (
                          <button type="button" className={s.del} title="מחק" aria-label="מחק אירוע"
                            onClick={e => { e.preventDefault(); remove(r.manualId!); }}>×</button>
                        )}
                      </div>
                    </>
                  );
                  const cls = `${s.row} ${r.cancelled ? s.cancelled : ''}`;
                  return r.url && !r.manualId
                    ? <a key={r.key} className={cls} style={style} href={r.url} target="_blank" rel="noopener noreferrer">{inner}</a>
                    : <div key={r.key} className={cls} style={style}>{inner}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={s.meta}>
        <span>ועדות ומליאה: אתר הכנסת{lastSync ? ` · סונכרן ${new Date(lastSync).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        <span>ממשלה וועדת שרים: gov.il</span>
      </div>
    </>
  );
}
