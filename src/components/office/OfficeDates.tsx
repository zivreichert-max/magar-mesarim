'use client';

import { useState } from 'react';
import { KEY_DATES, KeyDate } from '@/data/keyDates';
import { localIso } from '@/lib/scheduleUtils';
import { safeUrl } from '@/lib/urls';
import s from './Office.module.css';

// מועדים — long-range key dates of the transition Knesset (government
// formation deadlines, budget milestones…). Upcoming dates first with a
// day countdown; past dates are folded away. Source: an Excel workbook
// synced by update-key-dates.py.

const CATEGORY_COLORS: Record<string, string> = {
  'הרכבת ממשלה': '#dc2626',
  'כנסת': '#1e3a7b',
  'תקציב': '#16a34a',
  'ממשלה': '#111827',
  'בג"ץ': '#7c3aed',
  'חירום': '#d97706',
};
const colorOf = (c: string) => CATEGORY_COLORS[c] ?? '#0075C4';

function fmt(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y.slice(2)}`;
}

function daysUntil(iso: string, today: string): number {
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
}

function countdown(n: number): string {
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  return `בעוד ${n} ימים`;
}

interface OfficeDatesProps {
  only?: string;      // show a single category (the בג"ץ section)
  title?: string;
  subtitle?: string;
  emptyText?: string;
}

export default function OfficeDates({ only, title = 'מועדים', subtitle = 'כנסת המעבר', emptyText = 'אין מועדים קרובים' }: OfficeDatesProps) {
  const [today] = useState(() => localIso(new Date()));
  const [open, setOpen] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const all = only ? KEY_DATES.filter(d => d.category === only) : KEY_DATES;
  const upcoming = all.filter(d => d.date >= today);
  const past = all.filter(d => d.date < today).reverse();

  const renderRow = (d: KeyDate, isPast: boolean) => {
    const id = `${d.date}|${d.title}`;
    const expanded = open === id;
    const url = safeUrl(d.url);
    const hasMore = !!(d.detail || url);
    return (
      <div key={id}>
        <button
          type="button"
          className={`${s.dateRow} ${isPast ? s.datePast : ''}`}
          style={{ ['--c' as string]: colorOf(d.category), cursor: hasMore ? 'pointer' : 'default' }}
          onClick={() => hasMore && setOpen(expanded ? null : id)}
        >
          <span className={s.dateDay} dir="ltr">{fmt(d.date)}</span>
          <span className={s.dateCat}><span className={s.dot} />{d.category}</span>
          <span className={s.dateTitle}>
            {d.title}
            {d.certainty && d.certainty !== 'ודאי' && <span className={s.tag} style={{ marginInlineStart: 8 }}>{d.certainty}</span>}
          </span>
          <span className={s.dateCount}>
            {d.time && <span dir="ltr">{d.time}</span>}
            {d.time && !isPast && ' · '}
            {isPast ? '' : countdown(daysUntil(d.date, today))}
          </span>
        </button>
        {expanded && (
          <div className={s.detail}>
            {d.detail && <div>{d.detail}</div>}
            {url && <a href={url} target="_blank" rel="noopener noreferrer">מקור ↗</a>}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={s.mast}>
        <h1>{title}</h1>
        <span className={s.mastDate}>{subtitle}</span>
      </div>

      <div className={s.tbl}>
        {upcoming.length === 0 && <div className={s.none}>{emptyText}</div>}
        {upcoming.map(d => renderRow(d, false))}
      </div>

      {past.length > 0 && (
        <>
          <button type="button" className={s.btn} style={{ marginTop: 14 }} onClick={() => setShowPast(v => !v)}>
            {showPast ? 'הסתר מועדים שעברו' : `מועדים שעברו (${past.length})`}
          </button>
          {showPast && <div className={s.tbl}>{past.map(d => renderRow(d, true))}</div>}
        </>
      )}

      <div className={s.meta}><span>מקור: אקסל &quot;מועדים - כנסת המעבר&quot; · &quot;מחושב&quot; = חישוב לפי החוק, לא פרסום רשמי</span></div>
    </>
  );
}
