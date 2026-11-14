'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import s from './Office.module.css';

// לשכה — the admin's parliamentary workspace. Each section is a lean table;
// sections are code-split so the tab opens instantly on the weekly schedule.
const loading = () => <div className={s.none}>טוען…</div>;
const OfficeWeek = dynamic(() => import('./OfficeWeek'), { loading });
const OfficeGov = dynamic(() => import('./OfficeGov'), { loading });

type SectionId = 'week' | 'gov';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'week', label: 'לו"ז שבועי' },
  { id: 'gov', label: 'ממשלה' },
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
      {section === 'gov' && <OfficeGov />}
    </div>
  );
}
