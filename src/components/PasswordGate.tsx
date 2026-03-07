'use client';

import { useState, useRef, KeyboardEvent } from 'react';

const CORRECT_PASSWORD = '61218384';

interface PasswordGateProps {
  onUnlock: () => void;
}

export default function PasswordGate({ onUnlock }: PasswordGateProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (value === CORRECT_PASSWORD) {
      onUnlock();
    } else {
      setError('סיסמה שגויה');
      setValue('');
      setTimeout(() => setError(''), 2000);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-6 z-50"
      style={{ background: 'var(--bg)' }}
    >
      <h1
        className="text-3xl font-black"
        style={{ fontFamily: "'Frank Ruhl Libre', serif", color: 'var(--text)' }}
      >
        🔒 מאגר מסרים
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>הזן סיסמה לכניסה</p>

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
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg3)',
            color: 'var(--text)',
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
            borderRadius: 8,
            border: 'none',
            background: 'var(--text)',
            color: 'var(--bg)',
            fontFamily: 'inherit',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          כניסה
        </button>
      </div>

      <div style={{ height: 18, color: '#ef4444', fontSize: 13 }}>
        {error}
      </div>
    </div>
  );
}
