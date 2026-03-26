'use client';

import { Message, TOPICS } from '@/data/messages';

interface MessageCardProps {
  message: Message;
  index: number;
  onClick: () => void;
}

export default function MessageCard({ message, index, onClick }: MessageCardProps) {
  const color = TOPICS[message.topic]?.color ?? 'rgba(255,255,255,0.2)';
  const sourceShort = message.source ? message.source.split('|')[0].trim() : '';

  function CredibilityBadge({ level }: { level?: 1 | 2 | 3 }) {
    if (!level) return null;
    const filled = '⬤';
    const empty = '○';
    const labels: Record<number, string> = { 1: 'כתבה', 2: 'מכון מחקר', 3: 'מקור ממשלתי' };
    const colors: Record<number, string> = { 1: '#7a7d8a', 2: '#4a9eff', 3: '#22c55e' };
    const dots = Array.from({ length: 3 }, (_, i) => i < level ? filled : empty).join('');
    return (
      <span style={{
        fontSize: 10,
        color: colors[level],
        letterSpacing: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
      }}>
        <span>{dots}</span>
        <span style={{ letterSpacing: 0, opacity: 0.7 }}>{labels[level]}</span>
      </span>
    );
  }
  return (
    <div
      onClick={onClick}
      className="animate-fade-up"
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animationDelay: `${index * 25}ms`,
        transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = 'var(--bg3)';
        el.style.borderColor = 'rgba(255,255,255,0.15)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = 'var(--bg2)';
        el.style.borderColor = 'var(--border)';
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* Color bar on the right (RTL) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 3,
          height: '100%',
          background: color,
          borderRadius: '0 12px 12px 0',
        }}
      />

      {/* Topic label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: color,
            letterSpacing: 0.5,
          }}
        >
          {message.topic}
        </span>
        <CredibilityBadge level={message.credibility} />
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.5,
          color: 'var(--text)',
          paddingRight: 8,
        }}
      >
        {message.title}
      </div>

      {/* Summary preview */}
      {message.summary && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            lineHeight: 1.6,
            flex: 1,
            paddingRight: 8,
          }}
        >
          {message.summary.length > 110
            ? message.summary.slice(0, 110) + '…'
            : message.summary}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 4,
          paddingRight: 8,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.6 }}>
          {sourceShort}
        </span>
        <span style={{ fontSize: 14, color: 'var(--muted)', opacity: 0.4 }}>
          ←
        </span>
      </div>
    </div>
  );
}
