'use client';

import { Message, TOPICS } from '@/data/messages';

interface MessageCardProps {
  message: Message;
  index: number;
  onClick: () => void;
}

export default function MessageCard({ message, index, onClick }: MessageCardProps) {
  const color = TOPICS[message.topic]?.color ?? '#0075C4';
  const sourceShort = message.source ? message.source.split('|')[0].trim() : '';

  return (
    <button
      onClick={() => { console.log('card div clicked'); onClick(); }}
      className="animate-fade-up card-padding"
      style={{
        background: '#ffffff',
        borderTop: `3px solid ${color}`,
        borderRight: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        borderLeft: '1px solid #e5e7eb',
        outline: 'none',
        borderRadius: 0,
        padding: 20,
        cursor: 'pointer',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        fontFamily: 'inherit',
        textAlign: 'right',
        animationDelay: `${index * 25}ms`,
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.boxShadow = 'none';
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* Topic badge */}
      <div>
        <span
          style={{
            display: 'inline-block',
            background: color,
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
            padding: '2px 8px',
            borderRadius: 2,
          }}
        >
          {message.topic}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.5,
          color: '#111111',
          direction: 'rtl',
          textAlign: 'right',
        }}
      >
        {message.title}
      </div>

      {/* Summary preview */}
      {message.summary && (
        <div
          style={{
            fontSize: 12,
            color: '#555555',
            lineHeight: 1.6,
            flex: 1,
            direction: 'rtl',
            textAlign: 'right',
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
        }}
      >
        <span style={{ fontSize: 11, color: '#555555', opacity: 0.6 }}>
          {sourceShort}
        </span>
        <span style={{ fontSize: 14, color: '#0075C4', opacity: 0.7 }}>
          ←
        </span>
      </div>
    </button>
  );
}
