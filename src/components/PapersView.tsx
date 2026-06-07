'use client';
import { useState } from 'react';
import { PAPERS, Paper } from '@/data/papers';

interface PapersViewProps {
  role: string;
  clientId?: string;
}

export default function PapersView({ role, clientId }: PapersViewProps) {
  const [selected, setSelected] = useState<Paper | null>(null);

  const visible = role === 'full'
    ? PAPERS
    : PAPERS.filter(p => clientId && p.sharedWith.includes(clientId));

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>
      {/* Overlay */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998 }}
        />
      )}

      {/* Panel */}
      {selected && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: 520, zIndex: 9999,
          background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background: '#0075C4', padding: '20px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 8px', borderRadius: 2, display: 'inline-block', marginBottom: 8 }}>
                  {selected.tag}
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.4 }}>
                  {selected.title}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                type="button"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 2, padding: '6px 10px', fontSize: 16, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}
              >✕</button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#fff', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {selected.sections.map((sec, i) => (
              <div key={i}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0075C4', letterSpacing: '0.08em', marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
                  {sec.label}
                </div>
                {sec.type === 'text' ? (
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: '#374151' }}>{sec.content}</div>
                ) : (
                  <ul style={{ paddingRight: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sec.items?.map((item, j) => (
                      <li key={j} style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* Bottom line */}
            <div style={{ background: '#e6f1fb', border: '0.5px solid #93c5fd', borderRadius: 4, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#0c447c', letterSpacing: '0.08em', marginBottom: 6 }}>שורה תחתונה</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1e40af', fontWeight: 500 }}>{selected.bottomLine}</div>
            </div>

            {/* Share — full only */}
            {role === 'full' && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>שתף עם:</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ id: 'naama', name: 'נעמה לזימי' }, { id: 'liran', name: 'לירן אביבשר' }].map(c => (
                    <button
                      key={c.id}
                      type="button"
                      style={{
                        padding: '6px 16px', fontSize: 12, fontWeight: 600,
                        border: '1px solid #0075C4',
                        background: selected.sharedWith.includes(c.id) ? '#0075C4' : 'transparent',
                        color: selected.sharedWith.includes(c.id) ? '#fff' : '#0075C4',
                        borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cards */}
      <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14 }}>אין ניירות עמדה זמינים</div>
        ) : visible.map(paper => (
          <div
            key={paper.id}
            onClick={() => setSelected(paper)}
            style={{
              background: '#fff', border: '0.5px solid #e5e7eb',
              borderRight: '3px solid #0075C4', borderRadius: 4,
              marginBottom: 10, cursor: 'pointer', padding: '16px 18px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
              transition: 'box-shadow 0.15s',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 2, marginBottom: 6, background: '#e6f1fb', color: '#0c447c', display: 'inline-block' }}>
                {paper.tag}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, marginBottom: 5 }}>{paper.title}</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{paper.summary}</div>
            </div>
            <div style={{ fontSize: 20, color: '#0075C4', flexShrink: 0, paddingTop: 2 }}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
