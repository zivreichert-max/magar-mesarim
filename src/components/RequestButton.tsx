'use client';

import { useState } from 'react';
import { submitClientRequest } from '@/lib/supabase';
import { Topic, TOPICS } from '@/data/messages';

const TOPICS_LIST = Object.keys(TOPICS) as Topic[];

interface RequestButtonProps {
  authorName: string;
  clientId: string;
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

export default function RequestButton({ authorName, clientId }: RequestButtonProps) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic | 'other' | ''>('');
  const [customTopic, setCustomTopic] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  function resetForm() {
    setTopic('');
    setCustomTopic('');
    setDescription('');
    setSource('');
    setError('');
  }

  async function handleSubmit() {
    if (!topic || !description.trim() || submitting) return;
    if (topic === 'other' && !customTopic.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await submitClientRequest({
        client_id: clientId,
        client_name: authorName,
        subtopic: topic === 'other' ? customTopic.trim() : topic,
        description: description.trim(),
        source: source.trim(),
      });
      setSubmitting(false);
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setOpen(false);
        resetForm();
      }, 1800);
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof Error ? e.message : 'שגיאה בשליחה, נסה שוב');
    }
  }

  const isValid = topic !== '' && description.trim() && (topic !== 'other' || customTopic.trim());

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 28,
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
        <span style={{ fontSize: 16 }}>✦</span>
        בקשה לתוכן
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); resetForm(); } }}
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
              gap: 20,
            }}
          >
            {/* Header */}
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
                בקשה לתוכן
              </h2>
              <button
                onClick={() => { setOpen(false); resetForm(); }}
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
                ✓ הבקשה נשלחה בהצלחה!
              </div>
            ) : (
              <>
                {/* Topic */}
                <div>
                  <label style={labelStyle}>נושא *</label>
                  <select
                    value={topic}
                    onChange={e => setTopic(e.target.value as Topic | 'other' | '')}
                    style={{
                      ...inputStyle,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">בחר נושא</option>
                    {TOPICS_LIST.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="other">אחר</option>
                  </select>
                </div>

                {/* Custom topic (shown only when "other" is selected) */}
                {topic === 'other' && (
                  <div>
                    <label style={labelStyle}>נושא מותאם *</label>
                    <input
                      type="text"
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      placeholder="הזן נושא"
                      style={inputStyle}
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label style={labelStyle}>פירוט *</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="תיאור הבקשה..."
                    rows={4}
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      lineHeight: 1.6,
                    }}
                  />
                </div>

                {/* Source */}
                <div>
                  <label style={labelStyle}>קישור/מקור</label>
                  <input
                    type="text"
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    placeholder="מקור, קישור, או שם פרסום"
                    style={inputStyle}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                  style={{
                    padding: '13px',
                    borderRadius: 10,
                    border: 'none',
                    background: isValid && !submitting ? 'var(--text)' : 'var(--bg3)',
                    color: isValid && !submitting ? 'var(--bg)' : 'var(--muted)',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: isValid && !submitting ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                  }}
                >
                  {submitting ? 'שולח...' : 'שלח בקשה'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
