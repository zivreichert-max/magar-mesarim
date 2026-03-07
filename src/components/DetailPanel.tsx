'use client';

import { useEffect } from 'react';
import { Message, TOPICS } from '@/data/messages';

interface DetailPanelProps {
  message: Message | null;
  onClose: () => void;
}

export default function DetailPanel({ message, onClose }: DetailPanelProps) {
  const isOpen = !!message;
  const color = message ? (TOPICS[message.topic]?.color ?? '#fff') : '#fff';

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity 0.25s',
          backdropFilter: isOpen ? 'blur(4px)' : 'none',
        }}
      />

      {/* Panel – slides in from left (correct for RTL: detail panel on left side) */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 520,
          maxWidth: '100vw',
          background: 'var(--bg2)',
          borderRight: '1px solid var(--border)',
          zIndex: 101,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {message && (
          <>
            {/* Panel Header */}
            <div
              style={{
                padding: '24px 24px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      color: color,
                    }}
                  >
                    {message.topic}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    color: 'var(--text)',
                  }}
                >
                  {message.title}
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 18,
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
              >
                ✕
              </button>
            </div>

            {/* Panel Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              {/* Summary */}
              {message.summary && (
                <section>
                  <h3
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: 'var(--muted)',
                      marginBottom: 10,
                      paddingBottom: 8,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    תקציר
                  </h3>
                  <p
                    style={{
                      fontSize: 15,
                      lineHeight: 1.85,
                      color: 'rgba(232,230,224,0.9)',
                    }}
                  >
                    {message.summary}
                  </p>
                </section>
              )}

              {/* Detail */}
              {message.detail && message.detail.trim() && (
                <section>
                  <h3
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: 'var(--muted)',
                      marginBottom: 10,
                      paddingBottom: 8,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    הרחבה
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      lineHeight: 1.9,
                      color: 'rgba(232,230,224,0.8)',
                    }}
                  >
                    {message.detail}
                  </p>
                </section>
              )}

              {/* Source */}
              {message.source && (
                <section>
                  <div
                    style={{
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '12px 16px',
                    }}
                  >
                    <strong
                      style={{
                        display: 'block',
                        marginBottom: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        color: 'var(--text)',
                      }}
                    >
                      מקורות ועדכניות
                    </strong>
                    <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                      {message.source}
                    </span>
                  </div>
                </section>
              )}

              {/* Empty state for items with no content */}
              {!message.summary && !message.detail && !message.source && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: 'var(--muted)',
                    fontSize: 13,
                  }}
                >
                  תוכן בפיתוח – יתווסף בקרוב
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
