'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { getOfficeVisits, OfficeVisitRow } from '@/lib/office';
import { partyColor } from './parties';
import s from './Office.module.css';

// יומן כניסות — admins only: who entered the site, when and for how long, by
// office. One row per office (visits / total time / last entry); a click opens
// that office's visits. The data is written by the heartbeat in page.tsx and
// lives in a protected table; nothing of it is in this repo.
//
// "How long" is an approximation and the screen says so: a visit runs from the
// entry to the last sign of life the open, visible tab sent (about one a
// minute). Nobody can know when a tab was actually closed.

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const minutesOf = (v: OfficeVisitRow) => Math.max(0, Math.round((Date.parse(v.last) - Date.parse(v.start)) / 60000));
const dur = (m: number) => (m < 1 ? 'פחות מדקה' : m < 60 ? `${m} דק׳` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} שע׳`);
const dayOf = (t: string) => new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
const timeOf = (t: string) => new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const ADMINS = '\u0000admins';
interface Group { key: string; label: string; party: string; visits: OfficeVisitRow[]; minutes: number; last: string }

function groupVisits(rows: OfficeVisitRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const v of rows) {
    const key = v.role === 'admin' ? ADMINS : (v.mk ?? '');
    let g = map.get(key);
    if (!g) {
      g = { key, label: v.role === 'admin' ? 'מנהלים' : `לשכת ח"כ ${v.mk ?? ''}`, party: v.party ?? '', visits: [], minutes: 0, last: v.start };
      map.set(key, g);
    }
    g.visits.push(v);
    g.minutes += minutesOf(v);
    if (v.start > g.last) g.last = v.start;
  }
  // offices by their latest entry, the admins' own entries last
  return [...map.values()].sort((a, b) => (a.key === ADMINS ? 1 : b.key === ADMINS ? -1 : b.last.localeCompare(a.last)));
}

type Phase = 'loading' | 'ready' | 'setup' | 'denied' | 'error';

export default function OfficeVisits({ seg }: { seg: ReactNode }) {
  const [from, setFrom] = useState(() => daysAgo(29));
  const [to, setTo] = useState(() => iso(new Date()));
  const [rows, setRows] = useState<OfficeVisitRow[]>([]);
  const [since, setSince] = useState<string | null>(null);
  const [keepDays, setKeepDays] = useState(365);
  const [phase, setPhase] = useState<Phase>('loading');
  const [office, setOffice] = useState('');        // '' = every office
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOfficeVisits(from, to).then(res => {
      if (cancelled) return;
      if (res.status === 'ok') { setRows(res.rows); setSince(res.since); setKeepDays(res.keepDays); setPhase('ready'); }
      else setPhase(res.status);
    });
    return () => { cancelled = true; };
  }, [from, to]);

  const groups = useMemo(() => groupVisits(rows), [rows]);
  const shown = office ? groups.filter(g => g.key === office) : groups;
  const total = shown.reduce((n, g) => n + g.visits.length, 0);

  function range(days: number) { setFrom(daysAgo(days - 1)); setTo(iso(new Date())); }

  const mast = (
    <div className={s.mast}>
      <h1>יומן כניסות</h1>
      <div className={`${s.mastTools} ${s.stats}`}>
        {phase === 'ready' && <span><b>{total}</b> כניסות</span>}
        {seg}
      </div>
    </div>
  );

  if (phase === 'setup' || phase === 'denied' || phase === 'error') {
    return (
      <>
        {mast}
        <div className={s.notice}>
          <h2>{phase === 'setup' ? 'נדרשת הגדרה חד-פעמית' : 'היומן לא נטען'}</h2>
          <p>
            {phase === 'setup'
              ? <>יומן הכניסות נשמר במסד נתונים מוגן. כדי להפעיל אותו מריצים פעם אחת ב-Supabase את הקובץ <span className={s.code}>supabase-office-v5.sql</span>.</>
              : phase === 'denied' ? 'היומן פתוח למנהלים שנכנסו עם חשבון אישי.' : 'נסו לרענן את העמוד.'}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {mast}
      <div className={s.filters}>
        <select value={office} onChange={e => { setOffice(e.target.value); setOpen(e.target.value || null); }} aria-label="סינון לפי לשכה">
          <option value="">כל הלשכות</option>
          {groups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <input type="date" value={from} max={to} onChange={e => { if (e.target.value) setFrom(e.target.value); }} aria-label="מתאריך" />
        <span>עד</span>
        <input type="date" value={to} min={from} onChange={e => { if (e.target.value) setTo(e.target.value); }} aria-label="עד תאריך" />
        <button type="button" className={s.btn} onClick={() => range(7)}>7 ימים</button>
        <button type="button" className={s.btn} onClick={() => range(30)}>30 ימים</button>
      </div>

      <div className={s.tbl}>
        <div className={`${s.bHead} ${s.vGrid}`}>
          <div>לשכה</div><div>כניסות</div><div>זמן כולל</div><div>כניסה אחרונה</div>
        </div>
        {phase === 'loading' && <div className={s.none}>טוען…</div>}
        {phase === 'ready' && shown.length === 0 && <div className={s.none}>אין כניסות בטווח התאריכים הזה</div>}
        {shown.map(g => {
          const expanded = open === g.key;
          const toggle = () => setOpen(expanded ? null : g.key);
          return (
            <div key={g.key}>
              <div
                className={`${s.bRow} ${s.vGrid}`} role="button" tabIndex={0} aria-expanded={expanded}
                onClick={toggle}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } }}
              >
                <span className={s.bMin}>
                  {g.key !== ADMINS && <span className={s.dot} style={{ ['--c' as string]: partyColor(g.party) }} />}
                  {g.label}
                </span>
                <span className={s.vNum}>{g.visits.length}</span>
                <span className={s.vNum}>{dur(g.minutes)}</span>
                <span className={s.vLast}>{dayOf(g.last)} · <span dir="ltr">{timeOf(g.last)}</span></span>
              </div>
              {expanded && (
                <div className={s.vList}>
                  <div className={`${s.vRow} ${s.vHead}`}><span>תאריך</span><span>משתמש</span><span>שעה</span><span>משך</span></div>
                  {g.visits.map(v => (
                    <div key={v.id} className={s.vRow}>
                      <span>{dayOf(v.start)}</span>
                      <span title={v.email}>{v.name || v.email}</span>
                      <span dir="ltr">{timeOf(v.start)}</span>
                      <span>{dur(minutesOf(v))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className={s.meta}>
        <span>המשך מקורב: מהכניסה ועד הסימן האחרון שהלשונית הייתה פתוחה ופעילה</span>
        {since && <span>היומן מתחיל ב-{dayOf(since)}</span>}
        <span>רשומה נמחקת אחרי {keepDays} ימים</span>
      </div>
    </>
  );
}
