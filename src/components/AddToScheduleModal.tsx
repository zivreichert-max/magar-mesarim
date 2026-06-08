'use client';
import { useState } from 'react';
import { addManualScheduleEvent, ManualScheduleEvent } from '@/lib/supabase';

export interface SessionInfo {
  committee: string;
  title: string;
  day_name: string;
  time: string;
}

interface Props {
  session: SessionInfo;
  onClose: () => void;
  onSaved: (ev: ManualScheduleEvent) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db',
  borderRadius: 6, fontFamily: 'inherit', direction: 'rtl', boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', lineHeight: 1.6,
};

export default function AddToScheduleModal({ session, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(session.title || session.committee);
  const [summary, setSummary] = useState('');
  const [detail, setDetail] = useState('');
  const [source, setSource] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function buildPrompt(): string {
    return `אתה כותב פריט לו"ז לאתר "זמן בחירות" של "בונים מחדש". כתוב תקציר, הרחבה וסימוכין לפי המתודולוגיה הבאה:

— תקציר: פסקה אחת, 3–5 משפטים. מסביר מה הדיון, למה הוא חשוב, ומה הזווית המרכזית למעקב. ספציפי ולא כללי.
— הרחבה: 2–4 פסקאות קצרות. פסקה 1 — רקע עובדתי. פסקה 2 — המחלוקת/הבעיה. פסקה 3 — נקודת המעקב.
— סימוכין: 1–3 מקורות. סדר עדיפות: המכון הישראלי לדמוקרטיה (נושאים חוקתיים/משפטיים/דמוקרטיים), מרכז המחקר והמידע של הכנסת (נתונים/תקציב), אתר הכנסת, תקשורת כלכלית-משפטית איכותית.

סגנון: קצר, חד, נגיש, לא אקדמי. מזהה את המחלוקת הפוליטית-ציבורית אך נשען על עובדות. מותר מסגור ביקורתי כשיש בסיס עובדתי ברור (החלשת שומרי סף, פגיעה בשוויון, פוליטיזציה, תקציבים סקטוריאליים, עקיפת בג"ץ).

כללי זהירות: אל תמציא מידע. אל תטען שיש נייר עמדה של המכון הישראלי לדמוקרטיה אם לא מצאת כזה. אם אין מספיק מידע — כתוב "סביר שהדיון יתמקד..." או "בשלב זה לא אותר מקור רשמי". תמיד סיים את ההרחבה בנקודת מעקב או במשמעות הציבורית.

פרטי הדיון:
גוף: ${session.committee}
נושא: ${session.title || session.committee}
יום: ${session.day_name}
שעה: ${session.time}

חפש בחומרים גלויים על הדיון הזה (אתר הכנסת, ניירות עמדה, תקשורת) וכתוב את שלושת החלקים: תקציר, הרחבה וסימוכין.`;
  }

  function copyPrompt() {
    navigator.clipboard.writeText(buildPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function generateAI() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committee: session.committee,
          title: session.title || session.committee,
          day: session.day_name,
          time: session.time,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSummary(data.summary ?? '');
      setDetail(data.detail ?? '');
      setSource(data.source ?? '');
    } catch (e) {
      setError('שגיאה ביצירת תוכן: ' + (e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!title.trim()) { setError('כותרת נדרשת'); return; }
    setSaving(true);
    setError('');
    try {
      const saved = await addManualScheduleEvent({
        day: session.day_name,
        time: session.time,
        title: title.trim(),
        summary,
        detail,
        source,
        category: 'knesset',
        color: '#6b7280',
      });
      onSaved(saved);
      onClose();
    } catch (e) {
      setError('שגיאה בשמירה: ' + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000 }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', right: '50%', transform: 'translate(50%, -50%)',
        width: '92%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 10, zIndex: 10001, direction: 'rtl',
        fontFamily: "'Heebo', sans-serif",
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{ background: '#0075C4', padding: '16px 20px', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 3 }}>{session.committee}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>הוספה ללו&quot;ז</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>{session.day_name} · {session.time}</div>
          </div>
          <button onClick={onClose} type="button" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '6px 10px', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Title */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>כותרת</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
          </div>

          {/* אפשרות חינמית — העתקת פרומפט לצ'אט */}
          <div style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
              אפשרות חינמית — דרך הצ&#39;אט
            </div>
            <button
              type="button"
              onClick={copyPrompt}
              style={{
                width: '100%', padding: '9px', background: copied ? '#16a34a' : '#0075C4',
                color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {copied ? '✓ הועתק! הדבק בצ\'אט וכתוב את הטיוטה' : '📋 העתק פרומפט מוכן'}
            </button>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, lineHeight: 1.5 }}>
              הדבק בצ&#39;אט (Claude/ChatGPT) → קבל טיוטה → הדבק חזרה בשדות למטה
            </div>
          </div>

          {/* AI button */}
          <button type="button" onClick={generateAI} disabled={generating || saving}
            style={{
              padding: 10, background: generating ? '#93c5fd' : '#0075C4', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
              cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
            {generating ? '✦ מייצר תוכן... (עד כדקה)' : '✦ צור תוכן אוטומטי עם AI'}
          </button>

          {error && (
            <div style={{ fontSize: 12, color: '#dc2626', background: '#fee2e2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>
          )}

          {/* Editable fields */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>תקציר</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} style={textareaStyle} placeholder="תקציר קצר..." />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>הרחבה</label>
            <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={5} style={textareaStyle} placeholder="הרחבה..." />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>סימוכין</label>
            <textarea value={source} onChange={e => setSource(e.target.value)} rows={2} style={textareaStyle} placeholder="שם מקור — תיאור&#10;https://..." />
          </div>

          {/* Save buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={save} disabled={saving}
              style={{ flex: 1, padding: 10, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'שומר...' : 'שמור ללו"ז'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
