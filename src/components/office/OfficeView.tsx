'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import s from './Office.module.css';

// לשכה — the admin's parliamentary workspace. Each section is a lean table;
// sections are code-split so the tab opens instantly on the weekly schedule.
const loading = () => <div className={s.none}>טוען…</div>;
const OfficeWeek = dynamic(() => import('./OfficeWeek'), { loading });
const OfficeGov = dynamic(() => import('./OfficeGov'), { loading });
const OfficeLegislation = dynamic(() => import('./OfficeLegislation'), { loading });
const OfficeDates = dynamic(() => import('./OfficeDates'), { loading });

type SectionId = 'week' | 'laws' | 'gov' | 'dates';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'week', label: 'לו"ז שבועי' },
  { id: 'laws', label: 'רמזור חקיקה' },
  { id: 'gov', label: 'ממשלה' },
  { id: 'dates', label: 'מועדים' },
];

export default function OfficeView() {
  const [section, setSection] = useState<SectionId>('week');

  return (
    <div className={s.wrap}>
      <div className={s.pills}>
        {SECTIONS.map(x => (
          <button
            key={x.id}
            type="button"
            className={`${s.pill} ${section === x.id ? s.pillOn : ''}`}
            onClick={() => setSection(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      {section === 'week' && <OfficeWeek />}
      {section === 'laws' && <OfficeLegislation />}
      {section === 'gov' && <OfficeGov />}
      {section === 'dates' && <OfficeDates />}
    </div>
  );
}
