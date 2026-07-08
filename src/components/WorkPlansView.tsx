'use client';
import { useState, useEffect } from 'react';
import { WORKPLANS, WorkPlan } from '@/data/workplans';
import { CLIENTS } from '@/data/clients';
import { getSharesForWorkplan, addWorkplanShare, removeWorkplanShare, getSharedWorkplanIds } from '@/lib/supabase';

interface Props {
  role: string;
  clientId?: string;
}

export default function WorkPlansView({ role, clientId }: Props) {
  const [selected, setSelected] = useState<WorkPlan | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [allowedIds, setAllowedIds] = useState<number[] | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  function openPanel(p: WorkPlan) {
    setSharedWith([]);
    setSelected(p);
    requestAnimationFrame(() => setIsOpen(true));
  }
  function closePanel() {
    setIsOpen(false);
    setTimeout(() => setSelected(null), 300);
  }

  useEffect(() => {
    if (role === 'client' && clientId) {
      getSharedWorkplanIds(clientId).then(setAllowedIds);
    }
  }, [role, clientId]);

  useEffect(() => {
    if (!selected || role !== 'full') return;
    let cancelled = false;
    getSharesForWorkplan(selected.id).then(ids => {
      if (!cancelled) setSharedWith(ids);
    });
    return () => { cancelled = true; };
  }, [selected, role]);

  async function handleToggleShare(cid: string) {
    if (!selected) return;
    const isShared = sharedWith.includes(cid);
    setSharedWith(prev => isShared ? prev.filter(id => id !== cid) : [...prev, cid]);
    setShareError(null);
    try {
      if (isShared) await removeWorkplanShare(selected.id, cid);
      else await addWorkplanShare(selected.id, cid);
    } catch (e) {
      setSharedWith(prev => isShared ? [...prev, cid] : prev.filter(id => id !== cid));
      setShareError((e as Error).message);
    }
  }

  const visible = role === 'full'
    ? WORKPLANS
    : WORKPLANS.filter(p => allowedIds?.includes(p.id) ?? false);

  // Group by main topic, preserving order
  const groups: { topic: string; plans: WorkPlan[] }[] = [];
  for (const p of visible) {
    let g = groups.find(x => x.topic === p.mainTopic);
    if (!g) { g = { topic: p.mainTopic, plans: [] }; groups.push(g); }
    g.plans.push(p);
  }

  return (
    <div style={{ direction: 'rtl', fontFamily: "var(--font-heebo), sans-serif" }}>
      {/* Overlay */}
      <div onClick={closePanel} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998,
        opacity: isOpen ? 1 : 0, transition: 'opacity 0.25s ease', pointerEvents: isOpen ? 'all' : 'none',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 560, zIndex: 9999,
        background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.32, 0, 0, 1)',
      }}>{selected && (
        <>
          <div style={{ background: '#0075C4', padding: '20px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 8px', borderRadius: 2, display: 'inline-block', marginBottom: 8 }}>
                  {selected.mainTopic}
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.4 }}>{selected.title}</div>
              </div>
              <button onClick={closePanel} type="button" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 2, padding: '6px 10px', fontSize: 16, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>✕</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', background: '#fff', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {selected.background && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0075C4', letterSpacing: '0.08em', marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>רקע</div>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: '#374151' }}>{selected.background}</div>
              </div>
            )}
            {selected.data.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0075C4', letterSpacing: '0.08em', marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>נתונים</div>
                <ul style={{ paddingRight: 18, display: 'flex', flexDirection: 'column', gap: 6, margin: 0 }}>
                  {selected.data.map((d, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>{d}</li>)}
                </ul>
              </div>
            )}
            {selected.points.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0075C4', letterSpacing: '0.08em', marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>עיקרי התוכנית</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.points.map((pt, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#0075C4', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.75, color: '#374151', flex: 1 }}>{pt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selected.visuals.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0075C4', letterSpacing: '0.08em', marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>ויזואליה</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selected.visuals.map((v, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <img
                        src={v}
                        onClick={() => setZoomImg(v)}
                        alt=""
                        title="לחץ להגדלה"
                        style={{ maxWidth: '100%', maxHeight: '40vh', borderRadius: 6, objectFit: 'contain', display: 'inline-block', cursor: 'zoom-in', border: '1px solid #e5e7eb' }}
                      />
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>לחץ על התמונה להגדלה</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selected.bottomLine && (
              <div style={{ background: '#e6f1fb', border: '0.5px solid #93c5fd', borderRadius: 4, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0c447c', letterSpacing: '0.08em', marginBottom: 6 }}>שורה תחתונה</div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1e40af', fontWeight: 500 }}>{selected.bottomLine}</div>
              </div>
            )}

            {role === 'full' && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>לשתף עם:</div>
                {shareError && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8, padding: '6px 10px', background: '#fee2e2', borderRadius: 4 }}>שגיאה: {shareError}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CLIENTS.map(c => {
                    const isActive = sharedWith.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => handleToggleShare(c.id)}
                        style={{ padding: '4px 14px', fontSize: 12, fontWeight: 600, border: `1px solid ${c.color}`, background: isActive ? c.color : 'transparent', color: isActive ? '#fff' : c.color, borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
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

      {/* Cards grouped by main topic */}
      <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14 }}>אין תכניות עבודה זמינות</div>
        ) : groups.map(g => (
          <div key={g.topic} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a7b', borderBottom: '2px solid #1e3a7b', paddingBottom: 6, marginBottom: 12 }}>{g.topic}</div>
            {g.plans.map(plan => (
              <div key={plan.id} onClick={() => openPanel(plan)}
                style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRight: '3px solid #0075C4', borderRadius: 4, marginBottom: 10, cursor: 'pointer', padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, marginBottom: 5 }}>{plan.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{plan.background}</div>
                  <div style={{ fontSize: 11, color: '#0075C4', fontWeight: 600, marginTop: 6 }}>{plan.points.length} צעדים · לחצו לפירוט</div>
                </div>
                <div style={{ fontSize: 20, color: '#0075C4', flexShrink: 0, paddingTop: 2 }}>›</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Fullscreen image zoom */}
      {zoomImg && (
        <div
          onClick={() => setZoomImg(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 19999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
          }}
        >
          <img src={zoomImg} alt="" style={{ maxWidth: '95vw', maxHeight: '92vh', borderRadius: 8, objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: 16, left: 16, color: '#fff', fontSize: 24, cursor: 'pointer', fontWeight: 700 }}>✕</div>
        </div>
      )}
    </div>
  );
}
