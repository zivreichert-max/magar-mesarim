'use client';

import Header from '@/components/Header';
import type { MkAccess } from '@/components/PasswordGate';
import OfficeLegislation from './OfficeLegislation';
import s from './Office.module.css';

// The view an MK gets after entering with a personal code: only the products
// that were assigned to them in the legislation tracker. The data itself is
// fetched with their code, so nothing about other MKs ever reaches the browser.

interface MkOfficeProps {
  access: MkAccess;
  client: { name: string; color: string } | null; // the party of the MK
}

export default function MkOffice({ access, client }: MkOfficeProps) {
  const badge = { name: access.name, color: client?.color ?? '#6b7280' };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Header count={0} total={0} role="client" activeClient={badge} viewTitle="הלשכה שלי" />
      <div className={s.wrap}>
        <OfficeLegislation accessKey={access.key} />
      </div>
    </div>
  );
}
