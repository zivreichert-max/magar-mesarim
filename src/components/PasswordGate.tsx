'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { getOfficeData } from '@/lib/office';
import Brand from '@/components/office/Brand';
import s from '@/components/office/Office.module.css';

// The site is the admin's office. One password opens everything — it is also
// handed up as the key that unlocks the protected legislation tracker, so no
// screen ever asks for a second credential.
// (update-legislation.py reads this constant to register the same password
// in the database — keep the name and the single-quoted form.)
const FULL_PASSWORD = '61218384';

// An MK who entered with a personal code — sees only their own products
export interface MkAccess {
  key: string;
  name: string;
  party: string;
}

export type Unlock =
  | { role: 'admin'; key: string }
  | { role: 'mk'; access: MkAccess };

interface PasswordGateProps {
  onUnlock: (unlock: Unlock) => void;
}

export default function PasswordGate({ onUnlock }: PasswordGateProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (checking) return;
    if (value === FULL_PASSWORD) {
      onUnlock({ role: 'admin', key: value });
      return;
    }
    // Not the admin password — it may be a personal MK code. Codes are
    // verified in the database (hashed there); none are stored in this app.
    const code = value.trim().toUpperCase();
    if (code.length >= 6) {
      setChecking(true);
      const res = await getOfficeData(code);
      setChecking(false);
      if (res.status === 'ok' && res.data.role === 'mk' && res.data.name) {
        onUnlock({ role: 'mk', access: { key: code, name: res.data.name, party: res.data.party ?? '' } });
        return;
      }
    }
    setError('סיסמה שגויה');
    setValue('');
    setTimeout(() => setError(''), 2000);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div className={s.gateScreen}>
      <div className={s.gateCard}>
        <Brand />
        <label className={s.gateLabel} htmlFor="gate-password">סיסמת כניסה</label>
        <input
          id="gate-password"
          ref={inputRef}
          className={s.gateInput}
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          dir="ltr"
          style={{ textAlign: 'center', letterSpacing: 4 }}
        />
        <button type="button" className={s.gateBtn} onClick={handleSubmit}>
          {checking ? 'בודק…' : 'כניסה'}
        </button>
        <div className={s.gateErr} role="alert">{error}</div>
      </div>
    </div>
  );
}
