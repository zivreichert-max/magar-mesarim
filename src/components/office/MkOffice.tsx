'use client';

import type { MkAccess } from '@/components/PasswordGate';
import Brand from './Brand';
import OfficeLegislation from './OfficeLegislation';
import s from './Office.module.css';

// The view an MK gets after entering with a personal code: only the products
// that were assigned to them. The data is fetched with their code, so nothing
// about other MKs ever reaches the browser. (MK access is on hold for now —
// codes have not been handed out; the admin office comes first.)

interface MkOfficeProps {
  access: MkAccess;
  onLogout: () => void;
}

export default function MkOffice({ access, onLogout }: MkOfficeProps) {
  return (
    <div className={s.shell}>
      <aside className={s.side}>
        <Brand />
        <nav className={s.nav}>
          <button type="button" className={`${s.navItem} ${s.navOn}`} aria-current="page">התוצרים שלי</button>
        </nav>
        <div className={s.sideFoot}>
          <div className={s.avatar}>{access.name.trim().charAt(0)}</div>
          <div>
            <div className={s.footName}>{access.name}</div>
            <div className={s.footRole}>חבר/ת כנסת</div>
          </div>
          <button type="button" className={s.logout} onClick={onLogout}>יציאה</button>
        </div>
      </aside>
      <main className={s.main}>
        <div className={s.wrap}>
          <OfficeLegislation accessKey={access.key} />
        </div>
      </main>
    </div>
  );
}
