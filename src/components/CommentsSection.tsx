'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, Comment } from '@/lib/supabase';

interface CommentsSectionProps {
  cardId: number;
  authorName: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export default function CommentsSection({ cardId, authorName }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchComments();
  }, [cardId]);

  async function fetchComments() {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });
    if (data) setComments(data as Comment[]);
  }

  async function handleSubmit() {
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({ card_id: cardId, author_name: authorName, body: text })
      .select()
      .single();
    setSubmitting(false);
    if (!error && data) {
      setComments(prev => [...prev, data as Comment]);
      setBody('');
      textareaRef.current?.focus();
    }
  }

  return (
    <section>
      {/* Section header */}
      <h3
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          color: 'var(--muted)',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border)',
        }}
      >
        הערות ({comments.length})
      </h3>

      {/* Comments list */}
      {comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {comments.map(c => (
            <div
              key={c.id}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 5,
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  {c.author_name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                  {formatDate(c.created_at)}
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(232,230,224,0.8)', margin: 0 }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {comments.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          אין הערות עדיין. היה הראשון.
        </p>
      )}

      {/* Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            marginBottom: 2,
          }}
        >
          מגיב בשם: <strong style={{ color: 'var(--text)' }}>{authorName}</strong>
        </div>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          placeholder="הוסף הערה..."
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 13,
            lineHeight: 1.6,
            outline: 'none',
            resize: 'vertical',
            direction: 'rtl',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
          style={{
            alignSelf: 'flex-start',
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: body.trim() && !submitting ? 'var(--text)' : 'var(--bg3)',
            color: body.trim() && !submitting ? 'var(--bg)' : 'var(--muted)',
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: 13,
            cursor: body.trim() && !submitting ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          {submitting ? 'שולח...' : 'פרסם הערה'}
        </button>
      </div>
    </section>
  );
}
