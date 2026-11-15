'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { CLIENTS, Client } from '@/data/clients';
import { getOfficeData } from '@/lib/supabase';

const FULL_PASSWORD = '61218384';

// An MK who entered with a personal code — sees only their own לשכה view
export interface MkAccess {
  key: string;
  name: string;
  party: string;
}

interface PasswordGateProps {
  // `adminKey` (full role only) is the typed admin password: the protected
  // legislation tracker is unlocked with it, so the admin logs in exactly once
  onUnlock: (role: 'full' | 'client', client: Client | null, mk?: MkAccess, adminKey?: string) => void;
}

export default function PasswordGate({ onUnlock }: PasswordGateProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit() {
    if (checking) return;
    if (value === FULL_PASSWORD) {
      onUnlock('full', null, undefined, value);
      return;
    }
    const matchedClient = CLIENTS.find(c => c.password === value);
    if (matchedClient) {
      onUnlock('client', matchedClient);
      return;
    }
    // Not a site password — it may be a personal MK code. Codes are verified
    // in the database (hashed there); none are stored in this app.
    const code = value.trim().toUpperCase();
    if (code.length >= 6) {
      setChecking(true);
      const res = await getOfficeData(code);
      setChecking(false);
      if (res.status === 'ok' && res.data.role === 'mk' && res.data.name) {
        const party = CLIENTS.find(c => c.id === res.data.party) ?? null;
        onUnlock('client', party, { key: code, name: res.data.name, party: res.data.party ?? '' });
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
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-6 z-50"
      style={{ background: '#ffffff' }}
    >
      {/* Logo square */}
      <div
        style={{
          width: 64,
          height: 64,
          border: '2px solid #111111',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-heebo), sans-serif",
            fontSize: 13,
            fontWeight: 900,
            color: '#111111',
            lineHeight: 1.2,
            textAlign: 'center',
            whiteSpace: 'pre-line',
          }}
        >
          {'בונים\nמחדש'}
        </span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: "var(--font-heebo), sans-serif",
            fontSize: 28,
            fontWeight: 900,
            color: '#111111',
            margin: 0,
          }}
        >
          מסרים
        </h1>
        <p style={{ color: '#0075C4', fontSize: 14, margin: '6px 0 0' }}>
          בחירות 2026 · בונים מחדש
        </p>
      </div>

      <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>הזן סיסמה לכניסה</p>

      <div className="flex gap-2.5">
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="••••••••"
          autoFocus
          style={{
            padding: '12px 18px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            color: '#111111',
            fontFamily: 'inherit',
            fontSize: 16,
            outline: 'none',
            width: 200,
            textAlign: 'center',
            letterSpacing: 4,
            direction: 'ltr',
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            padding: '12px 24px',
            borderRadius: 6,
            border: 'none',
            background: '#0075C4',
            color: '#ffffff',
            fontFamily: 'inherit',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          {checking ? 'בודק…' : 'כניסה'}
        </button>
      </div>

      <div style={{ height: 18, color: '#dc2626', fontSize: 13 }}>
        {error}
      </div>
    </div>
  );
}
