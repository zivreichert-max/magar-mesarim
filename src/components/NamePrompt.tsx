'use client';

import { useState, KeyboardEvent } from 'react';
import Brand from '@/components/office/Brand';
import s from '@/components/office/Office.module.css';

interface NamePromptProps {
  onName: (name: string) => void;
}

// Asked once per device, right after the first login: the name is shown in
// the side panel and labels the visit in the usage log.
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
    <div className={s.gateScreen}>
      <div className={s.gateCard}>
        <Brand />
        <label className={s.gateLabel} htmlFor="gate-name">מה השם שלך?</label>
        <input
          id="gate-name"
          className={s.gateInput}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="שם מלא"
          autoFocus
        />
        <button type="button" className={s.gateBtn} onClick={handleSubmit}>המשך</button>
      </div>
    </div>
  );
}
