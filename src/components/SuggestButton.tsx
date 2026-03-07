'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Topic, TOPICS } from '@/data/messages';

const TOPICS_LIST = Object.keys(TOPICS) as Topic[];

interface SuggestButtonProps {
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

export default function SuggestButton({ authorName }: SuggestButtonProps) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic>(TOPICS_LIST[0]);
  const [subtopic, setSubtopic] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!subtopic.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    await supabase.from('suggestions').insert({
      topic,
      subtopic: subtopic.trim(),
      description: description.trim(),
      source: source.trim(),
      author_name: authorName,
      status: 'pending',
    });
    setSubmitting(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setOpen(false);
      setSubtopic('');
      setDescription('');
      setSource('');
      setTopic(TOPICS_LIST[0]);
    }, 1800);
  }

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
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
      >
        <span style={{ fontSize: 16 }}>✦</span>
        הצע תוכן
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed',
            inset: 0,
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
                  fontFamily: "'Frank Ruhl Libre', serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                הצע תוכן חדש
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
                ✓ ההצעה נשלחה בהצלחה!
              </div>
            ) : (
              <>
                {/* Topic */}
                <div>
                  <label style={labelStyle}>נושא</label>
                  <select
                    value={topic}
                    onChange={e => setTopic(e.target.value as Topic)}
                    style={{
                      ...inputStyle,
                      cursor: 'pointer',
                    }}
                  >
                    {TOPICS_LIST.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Subtopic */}
                <div>
                  <label style={labelStyle}>תת נושא *</label>
                  <input
                    type="text"
                    value={subtopic}
                    onChange={e => setSubtopic(e.target.value)}
                    placeholder="כותרת התוכן המוצע"
                    style={inputStyle}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={labelStyle}>הסבר קצר *</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="תיאור התוכן, הנתון, או הטיעון..."
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
                  <label style={labelStyle}>סימוכין / קישור</label>
                  <input
                    type="text"
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    placeholder="מקור, קישור, או שם פרסום"
                    style={inputStyle}
                  />
                </div>

                {/* Author (read-only display) */}
                <div>
                  <label style={labelStyle}>שם המציע</label>
                  <div
                    style={{
                      ...inputStyle,
                      color: 'var(--muted)',
                      background: 'var(--bg3)',
                    }}
                  >
                    {authorName}
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!subtopic.trim() || !description.trim() || submitting}
                  style={{
                    padding: '13px',
                    borderRadius: 10,
                    border: 'none',
                    background:
                      subtopic.trim() && description.trim() && !submitting
                        ? 'var(--text)'
                        : 'var(--bg3)',
                    color:
                      subtopic.trim() && description.trim() && !submitting
                        ? 'var(--bg)'
                        : 'var(--muted)',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor:
                      subtopic.trim() && description.trim() && !submitting
                        ? 'pointer'
                        : 'default',
                    transition: 'all 0.15s',
                  }}
                >
                  {submitting ? 'שולח...' : 'שלח הצעה'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
