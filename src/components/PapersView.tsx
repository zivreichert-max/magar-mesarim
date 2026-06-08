'use client';
import { useState, useEffect } from 'react';
import { PAPERS, Paper } from '@/data/papers';
import { CLIENTS } from '@/data/clients';
import { getSharesForPaper, addPaperShare, removePaperShare, getSharedPaperIds } from '@/lib/supabase';

interface PapersViewProps {
  role: string;
  clientId?: string;
}

export default function PapersView({ role, clientId }: PapersViewProps) {
  const [selected, setSelected] = useState<Paper | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [allowedPaperIds, setAllowedPaperIds] = useState<number[] | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  function openPanel(paper: Paper) {
    setSelected(paper);
    requestAnimationFrame(() => setIsOpen(true));
  }

  function closePanel() {
    setIsOpen(false);
    setTimeout(() => setSelected(null), 300);
  }

  // For client role: load which papers are shared with them
  useEffect(() => {
    if (role === 'client' && clientId) {
      getSharedPaperIds(clientId).then(ids => setAllowedPaperIds(ids));
    }
  }, [role, clientId]);

  // When a paper is selected (full role): load its sharing state from Supabase
  useEffect(() => {
    if (!selected || role !== 'full') { setSharedWith([]); return; }
    getSharesForPaper(selected.id).then(ids => setSharedWith(ids));
  }, [selected, role]);

  async function handleToggleShare(cid: string) {
    if (!selected) return;
    const isShared = sharedWith.includes(cid);
    setSharedWith(prev => isShared ? prev.filter(id => id !== cid) : [...prev, cid]);
    setShareError(null);
    try {
      if (isShared) await removePaperShare(selected.id, cid);
      else await addPaperShare(selected.id, cid);
    } catch (e) {
      // Revert optimistic update on failure
      setSharedWith(prev => isShared ? [...prev, cid] : prev.filter(id => id !== cid));
      setShareError((e as Error).message);
    }
  }

  const visible = role === 'full'
    ? PAPERS
    : PAPERS.filter(p => allowedPaperIds?.includes(p.id) ?? false);

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>
      {/* Overlay */}
      <div
        onClick={closePanel}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.25s ease',
          pointerEvents: isOpen ? 'all' : 'none',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 520, zIndex: 9999,
        background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.32, 0, 0, 1)',
      }}>{selected && (
          <>
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
                onClick={closePanel}
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

            {/* Share — full role only */}
            {role === 'full' && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>לשתף עם:</div>
                {shareError && (
                  <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8, padding: '6px 10px', background: '#fee2e2', borderRadius: 4 }}>
                    שגיאה: {shareError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CLIENTS.map(c => {
                    const isActive = sharedWith.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleShare(c.id)}
                        style={{
                          padding: '4px 14px', fontSize: 12, fontWeight: 600,
                          border: `1px solid ${c.color}`,
                          background: isActive ? c.color : 'transparent',
                          color: isActive ? '#fff' : c.color,
                          borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit',
                          transition: 'all 0.15s',
                        }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      </div>

      {/* Cards */}
      <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14 }}>אין ניירות עמדה זמינים</div>
        ) : visible.map(paper => (
          <div
            key={paper.id}
            onClick={() => openPanel(paper)}
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
