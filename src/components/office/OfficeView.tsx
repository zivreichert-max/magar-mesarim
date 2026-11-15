'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import s from './Office.module.css';

// לשכה — the admin's parliamentary workspace. Each section is a lean table;
// sections are code-split so the tab opens instantly on the weekly schedule.
const loading = () => <div className={s.none}>טוען…</div>;
const OfficeWeek = dynamic(() => import('./OfficeWeek'), { loading });
const OfficeBudget = dynamic(() => import('./OfficeBudget'), { loading });
const OfficeGov = dynamic(() => import('./OfficeGov'), { loading });
const OfficeLegislation = dynamic(() => import('./OfficeLegislation'), { loading });
const OfficeDates = dynamic(() => import('./OfficeDates'), { loading });

type SectionId = 'week' | 'budget' | 'laws' | 'gov' | 'court' | 'dates';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'week', label: 'לו"ז שבועי' },
  { id: 'budget', label: 'פניות תקציב' },
  { id: 'laws', label: 'רמזור חקיקה' },
  { id: 'gov', label: 'ממשלה' },
  { id: 'court', label: 'בג"ץ' },
  { id: 'dates', label: 'מועדים' },
];

// `adminKey` is the password the admin logged in with — it also unlocks the
// protected legislation tracker, so no section asks for anything further.
export default function OfficeView({ adminKey }: { adminKey: string }) {
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
      {section === 'budget' && <OfficeBudget />}
      {section === 'laws' && <OfficeLegislation accessKey={adminKey} />}
      {section === 'gov' && <OfficeGov />}
      {section === 'court' && (
        <OfficeDates
          only='בג"ץ'
          title='בג"ץ'
          subtitle="דיונים קרובים"
          emptyText='לא הוזנו דיונים קרובים. מוסיפים שורה בקטגוריה בג"ץ באקסל המועדים.'
        />
      )}
      {section === 'dates' && <OfficeDates />}
    </div>
  );
}
