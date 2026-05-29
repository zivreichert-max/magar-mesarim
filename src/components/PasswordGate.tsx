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
            fontFamily: "'Heebo', sans-serif",
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
            fontFamily: "'Heebo', sans-serif",
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

      <p style={{ color: '#555555', fontSize: 14, margin: 0 }}>הזן סיסמה לכניסה</p>

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
            borderRadius: 0,
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
            borderRadius: 2,
            border: 'none',
            background: '#0075C4',
            color: '#ffffff',
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
