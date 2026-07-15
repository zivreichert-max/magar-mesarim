'use client';

import { useRef, useState } from 'react';
import { submitIntake } from '@/lib/supabase';
import { Topic, TOPICS } from '@/data/messages';

const TOPICS_LIST = Object.keys(TOPICS) as Topic[];

interface IntakeButtonProps {
  authorName: string;
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 14,
  outline: 'none',
  direction: 'rtl' as const,
};

const labelStyle = {
  fontSize: 11,
  fontWeight: 700 as const,
  color: 'var(--muted)',
  letterSpacing: 0.5,
  display: 'block' as const,
  marginBottom: 6,
};

// "הזנה מהירה" — מדביקים תוכן גולמי (כתבה/ציוץ/קישור) + צילום מסך של הוויזואליה,
// והצוות מעבד את התור לקלפים בפורמט המלא (תקציר/הרחבה/מקור) מאוחר יותר.
export default function IntakeButton({ authorName }: IntakeButtonProps) {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [topicHint, setTopicHint] = useState<string>('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickImage(f: File | null) {
    setImage(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit() {
    if (!rawText.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitIntake({
        raw_text: rawText.trim(),
        topic_hint: topicHint || null,
        author_name: authorName,
        image,
      });
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'שגיאה לא ידועה');
      return;
    }
    setSubmitting(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setOpen(false);
      setRawText('');
      setTopicHint('');
      pickImage(null);
    }, 1600);
  }

  return (
    <>
      {/* Floating button — stacked above "הצע תוכן" */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 84,
          left: 28,
          zIndex: 90,
          padding: '12px 20px',
          borderRadius: 24,
          border: '1px solid var(--border)',
          background: 'var(--bg2)',
          color: 'var(--text)',
          fontFamily: 'inherit',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          boxShadow: '0 4px 18px rgba(12,68,124,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
      >
        <span style={{ fontSize: 16 }}>⚡</span>
        הזנה מהירה
      </button>

      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed',
            top: 0, right: 0, bottom: 0, left: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 500,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2
                style={{
                  fontFamily: "var(--font-frank-ruhl), serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                ⚡ הזנה מהירה
              </h2>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 16,
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {sent ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 0',
                  color: '#22c55e',
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                ✓ נשמר בתור לעיבוד!
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                  הדבק כתבה, ציוץ או קישור — בלי לפרמט. התוכן ייכנס לתור, יעובד לקלף
                  מלא (תקציר, הרחבה, מקור רשמי) ויעלה לאתר.
                </div>

                <div>
                  <label style={labelStyle}>תוכן גולמי *</label>
                  <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder={'הדבק כאן ציטוט, ציוץ או קישור...'}
                    rows={6}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>נושא משוער (לא חובה)</label>
                  <select
                    value={topicHint}
                    onChange={e => setTopicHint(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">לא בטוח — שהצוות יחליט</option>
                    {TOPICS_LIST.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>ויזואליה / צילום מסך (לא חובה)</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={e => pickImage(e.target.files?.[0] ?? null)}
                    style={{ display: 'none' }}
                  />
                  {preview ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt="תצוגה מקדימה"
                        style={{
                          maxWidth: 140,
                          maxHeight: 90,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          objectFit: 'cover',
                        }}
                      />
                      <button
                        onClick={() => pickImage(null)}
                        style={{
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          cursor: 'pointer',
                          color: 'var(--muted)',
                          fontFamily: 'inherit',
                        }}
                      >
                        הסר
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      style={{
                        ...inputStyle,
                        cursor: 'pointer',
                        textAlign: 'center',
                        color: 'var(--muted)',
                        background: 'var(--bg3)',
                      }}
                    >
                      📷 צרף גרף / צילום מסך
                    </button>
                  )}
                </div>

                {submitError && (
                  <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                    השליחה נכשלה — לא נשמר. נסה שוב ({submitError})
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!rawText.trim() || submitting}
                  style={{
                    padding: '13px',
                    borderRadius: 10,
                    border: 'none',
                    background: rawText.trim() && !submitting ? 'var(--text)' : 'var(--bg3)',
                    color: rawText.trim() && !submitting ? 'var(--bg)' : 'var(--muted)',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: rawText.trim() && !submitting ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                  }}
                >
                  {submitting ? 'שולח...' : 'שלח לתור העיבוד'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
