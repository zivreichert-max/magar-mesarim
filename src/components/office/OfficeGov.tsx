'use client';

import { useEffect, useState } from 'react';
import { safeUrl } from '@/lib/urls';
import type { GovAgendaItem } from '@/app/api/gov-agenda/route';
import s from './Office.module.css';

// Government tracking for the לשכה tab: the latest published agendas of the
// cabinet and of the Ministerial Committee for Legislation (gov.il). Headline
// rows only — a click opens the official agenda page.

const SECTIONS: { key: GovAgendaItem['key']; title: string }[] = [
  { key: 'government', title: 'ישיבות הממשלה' },
  { key: 'ministers', title: 'ועדת השרים לענייני חקיקה' },
];

function shortDate(item: GovAgendaItem): string {
  if (item.meetingDate) {
    const [, m, d] = item.meetingDate.split('-');
    return `${Number(d)}.${Number(m)}`;
  }
  const m = item.publishDate.match(/^(\d{2})\.(\d{2})/);
  return m ? `${Number(m[1])}.${Number(m[2])}` : '—';
}

export default function OfficeGov() {
  const [items, setItems] = useState<GovAgendaItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gov-agenda')
      .then(r => (r.ok ? r.json() : { items: [] }))
      .catch(() => ({ items: [] }))
      .then((d: { items?: GovAgendaItem[] }) => { if (!cancelled) setItems(d.items ?? []); });
    return () => { cancelled = true; };
  }, []);

  if (items === null) return <div className={s.none}>טוען…</div>;

  return (
    <>
      <div className={s.mast}>
        <h1>ממשלה</h1>
        <span className={s.mastDate}>סדרי יום אחרונים שפורסמו</span>
      </div>
      {SECTIONS.map(sec => {
        const rows = items.filter(i => i.key === sec.key);
        return (
          <div key={sec.key}>
            <div className={s.h2}>{sec.title}</div>
            <div className={s.list}>
              {rows.length === 0 && <div className={s.none}>לא נמצאו פרסומים</div>}
              {rows.map(r => {
                const url = safeUrl(r.url);
                const inner = (
                  <>
                    <div className={s.liDate}>{shortDate(r)}</div>
                    <div className={s.liText}>{r.description}</div>
                    <div className={s.liArrow}>{url ? '↗' : ''}</div>
                  </>
                );
                return url
                  ? <a key={r.url} className={s.li} href={url} target="_blank" rel="noopener noreferrer">{inner}</a>
                  : <div key={r.url} className={s.li}>{inner}</div>;
              })}
            </div>
          </div>
        );
      })}
      <div className={s.meta}><span>מקור: gov.il · מתעדכן אוטומטית</span></div>
    </>
  );
}
