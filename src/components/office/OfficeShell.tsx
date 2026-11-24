'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Brand from './Brand';
import { BOT_URL } from './botQuestions';
import type { OfficeUser } from '@/lib/office';
import s from './Office.module.css';

// הלשכה — the whole site: a side panel with the sections and a white canvas.
// Each section is a lean table and is code-split, so the shell opens
// instantly on the weekly schedule.
//
// Two kinds of users. An ADMIN sees every section and every editing tool. An
// OFFICE (named after its MK) sees the public sections read-only and "the laws
// shared with us". The menu below is only a convenience: what each user may
// actually read or change is decided in the database, per signed-in user.
const loading = () => <div className={s.none}>טוען…</div>;
const OfficeWeek = dynamic(() => import('./OfficeWeek'), { loading });
const OfficeBudget = dynamic(() => import('./OfficeBudget'), { loading });
const OfficeGov = dynamic(() => import('./OfficeGov'), { loading });
const OfficeLegislation = dynamic(() => import('./OfficeLegislation'), { loading });
const OfficeCommittees = dynamic(() => import('./OfficeCommittees'), { loading });
const OfficePlenum = dynamic(() => import('./OfficePlenum'), { loading });
const OfficeDates = dynamic(() => import('./OfficeDates'), { loading });
const OfficeUsers = dynamic(() => import('./OfficeUsers'), { loading });

type SectionId = 'week' | 'budget' | 'laws' | 'plenum' | 'committees' | 'gov' | 'court' | 'dates' | 'users';

const SECTIONS: { id: SectionId; label: string; officeLabel?: string; adminOnly?: boolean }[] = [
  { id: 'week', label: 'לו"ז שבועי' },
  { id: 'budget', label: 'פניות תקציב', adminOnly: true },
  { id: 'laws', label: 'רמזור חקיקה', officeLabel: 'החוקים שלנו' },
  { id: 'plenum', label: 'מליאה' },
  { id: 'committees', label: 'ועדות' },
  { id: 'gov', label: 'ממשלה' },
  { id: 'court', label: 'בג"ץ' },
  { id: 'dates', label: 'מועדים' },
  { id: 'users', label: 'ניהול משתמשים', adminOnly: true },
];

interface OfficeShellProps {
  user: OfficeUser;
  onLogout: () => void;
}

export default function OfficeShell({ user, onLogout }: OfficeShellProps) {
  const [section, setSection] = useState<SectionId>('week');
  const isAdmin = user.role === 'admin';
  const sections = SECTIONS.filter(x => isAdmin || !x.adminOnly);
  const shownName = user.name || (isAdmin ? 'מנהל' : `לשכת ${user.mk ?? ''}`);

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
          {sections.map(x => (
            <button
              key={x.id}
              type="button"
              className={`${s.navItem} ${section === x.id ? s.navOn : ''}`}
              aria-current={section === x.id ? 'page' : undefined}
              onClick={e => go(x.id, e.currentTarget)}
            >
              {(!isAdmin && x.officeLabel) || x.label}
            </button>
          ))}
          {BOT_URL && (
            <a className={`${s.navItem} ${s.navLink}`} href={BOT_URL} target="_blank" rel="noopener noreferrer">
              בוט-נים ↗
            </a>
          )}
          {/* The footer (with its sign-out) is hidden on narrow screens */}
          <button type="button" className={`${s.navItem} ${s.navOut}`} onClick={onLogout}>יציאה</button>
        </nav>
        <div className={s.sideFoot}>
          <div className={s.avatar}>{shownName.trim().charAt(0)}</div>
          <div>
            <div className={s.footName}>{shownName}</div>
            <div className={s.footRole}>{isAdmin ? 'מנהל/ת הלשכה' : `לשכת ח"כ ${user.mk ?? ''}`}</div>
          </div>
          <button type="button" className={s.logout} onClick={onLogout}>יציאה</button>
        </div>
      </aside>

      <main className={s.main}>
        <div className={s.wrap}>
          {section === 'week' && <OfficeWeek canEdit={isAdmin} />}
          {section === 'budget' && isAdmin && <OfficeBudget />}
          {section === 'laws' && <OfficeLegislation />}
          {section === 'plenum' && <OfficePlenum />}
          {section === 'committees' && <OfficeCommittees />}
          {section === 'gov' && <OfficeGov />}
          {section === 'court' && (
            <OfficeDates
              only='בג"ץ'
              title='בג"ץ'
              subtitle="דיונים במעקב"
              emptyText={isAdmin ? 'לא הוזנו דיונים קרובים. מוסיפים שורה בקטגוריה בג"ץ באקסל המועדים.' : 'אין דיונים קרובים במעקב.'}
              note={
                <>
                  <span>רשימה ידנית: מוצגים רק דיונים שנמצאים במעקב, לא יומן בית המשפט המלא.</span>
                  <a href="https://www.court.gov.il/ngcs.web.site/homepage.aspx" target="_blank" rel="noopener noreferrer" style={{ color: '#1f72c4', fontWeight: 700 }}>
                    יומן הדיונים המלא בנט המשפט ↗
                  </a>
                </>
              }
            />
          )}
          {section === 'dates' && <OfficeDates />}
          {section === 'users' && isAdmin && <OfficeUsers />}
        </div>
      </main>
    </div>
  );
}
