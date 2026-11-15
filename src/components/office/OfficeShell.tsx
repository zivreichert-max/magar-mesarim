'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Brand from './Brand';
import s from './Office.module.css';

// הלשכה — the whole site for the admin: a side panel with the sections and a
// white canvas. Each section is a lean table and is code-split, so the shell
// opens instantly on the weekly schedule.
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

interface OfficeShellProps {
  // The password the admin logged in with — it also unlocks the protected
  // data, so no section ever asks for anything further
  adminKey: string;
  userName: string;
  onLogout: () => void;
}

export default function OfficeShell({ adminKey, userName, onLogout }: OfficeShellProps) {
  const [section, setSection] = useState<SectionId>('week');

  function go(id: SectionId, button: HTMLElement) {
    setSection(id);
    window.scrollTo(0, 0);
    // On narrow screens the nav is a horizontal strip — keep the chosen item in view
    button.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  return (
    <div className={s.shell}>
      <aside className={s.side}>
        <Brand />
        <nav className={s.nav} aria-label="מדורי הלשכה">
          {SECTIONS.map(x => (
            <button
              key={x.id}
              type="button"
              className={`${s.navItem} ${section === x.id ? s.navOn : ''}`}
              aria-current={section === x.id ? 'page' : undefined}
              onClick={e => go(x.id, e.currentTarget)}
            >
              {x.label}
            </button>
          ))}
        </nav>
        <div className={s.sideFoot}>
          <div className={s.avatar}>{(userName || 'מ').trim().charAt(0)}</div>
          <div>
            <div className={s.footName}>{userName || 'מנהל'}</div>
            <div className={s.footRole}>מנהל/ת הלשכה</div>
          </div>
          <button type="button" className={s.logout} onClick={onLogout}>יציאה</button>
        </div>
      </aside>

      <main className={s.main}>
        <div className={s.wrap}>
          {section === 'week' && <OfficeWeek adminKey={adminKey} />}
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
      </main>
    </div>
  );
}
