'use client';

import { useState } from 'react';
import { BOT_URL, BotQuestion } from './botQuestions';
import s from './Office.module.css';

// "שאלות מוכנות לבוט-נים" — a row of chips inside a row's detail. A click
// copies a question that is already phrased for the bot's sources; the user
// pastes it in the bot. (When BOT_URL is set, a link to open the bot appears.)
export default function BotAsk({ questions }: { questions: BotQuestion[] }) {
  const [copied, setCopied] = useState<BotQuestion | null>(null);
  const [failed, setFailed] = useState<BotQuestion | null>(null);

  if (questions.length === 0) return null;

  async function ask(q: BotQuestion) {
    try {
      await navigator.clipboard.writeText(q.text);
      setCopied(q);
      setFailed(null);
    } catch {
      // Clipboard blocked — show the question so it can be copied by hand
      setCopied(null);
      setFailed(q);
    }
  }

  return (
    <div className={s.bot}>
      <div className={s.lbl}>שאלות מוכנות לבוט-נים</div>
      <div className={s.botChips}>
        {questions.map(q => (
          <button
            key={q.label}
            type="button"
            className={`${s.botChip} ${copied?.label === q.label ? s.botChipOn : ''}`}
            title={q.text}
            onClick={() => ask(q)}
          >
            {q.label}
          </button>
        ))}
      </div>
      {copied && (
        <div className={s.botNote}>
          הועתק ✓ להדביק בבוט-נים: <span>{copied.text}</span>
          {BOT_URL && <> <a href={BOT_URL} target="_blank" rel="noopener noreferrer">פתיחת בוט-נים ↗</a></>}
        </div>
      )}
      {failed && (
        <div className={s.botNote}>
          ההעתקה האוטומטית נחסמה. אפשר לסמן ולהעתיק: <span>{failed.text}</span>
        </div>
      )}
    </div>
  );
}
