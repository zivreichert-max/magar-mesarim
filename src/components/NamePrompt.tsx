'use client';

import { useState, KeyboardEvent } from 'react';

interface NamePromptProps {
  onName: (name: string) => void;
}

export default function NamePrompt({ onName }: NamePromptProps) {
  const [value, setValue] = useState('');

  function handleSubmit() {
    const name = value.trim();
    if (!name) return;
    localStorage.setItem('author_name', name);
    onName(name);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        background: 'var(--bg)',
        zIndex: 50,
      }}
    >
      <h1
        style={{
          fontFamily: "'Frank Ruhl Libre', serif",
          fontSize: 28,
          fontWeight: 900,
          color: 'var(--text)',
        }}
      >
        מה השם שלך?
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        השם יוצג ליד ההערות שלך
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="שם מלא"
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
            width: 220,
            direction: 'rtl',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          style={{
            padding: '12px 24px',
            borderRadius: 8,
            border: 'none',
            background: value.trim() ? 'var(--text)' : 'var(--bg3)',
            color: value.trim() ? 'var(--bg)' : 'var(--muted)',
            fontFamily: 'inherit',
            fontWeight: 700,
            cursor: value.trim() ? 'pointer' : 'default',
            fontSize: 15,
            transition: 'all 0.15s',
          }}
        >
          המשך
        </button>
      </div>
    </div>
  );
}
