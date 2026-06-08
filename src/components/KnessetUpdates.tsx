'use client';
import { useEffect, useState } from 'react';
import { getRecentKnessetUpdates, KnessetUpdate } from '@/lib/knessetSync';
import { markKnessetUpdateInSchedule } from '@/lib/supabase';
import { SCHEDULE } from '@/data/schedule';

function normalizeTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m ?? '00'}`;
}

function findScheduleTitle(u: KnessetUpdate): string {
  const ev = SCHEDULE.find(e =>
    e.category === u.committee &&
    e.day === u.day_name &&
    normalizeTime(e.time) === normalizeTime(u.time_before)
  );
  if (!ev) return u.title;
  // Strip leading "CommitteeName: " prefix if present
  const prefix = u.committee + ':';
  const t = ev.title.startsWith(prefix) ? ev.title.slice(prefix.length).trim() : ev.title;
  return t || u.title;
}

export default function KnessetUpdates() {
  const [updates, setUpdates] = useState<KnessetUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const data = await getRecentKnessetUpdates();
      setUpdates(data);
      setLastCheck(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setLoading(false);
    }
  }

  async function manualRefresh() {
    setRefreshing(true);
    setLoading(false);
    await load();
    setRefreshing(false);
  }

  async function handleMarkInSchedule(u: KnessetUpdate) {
    const newMarked = !u.marked_in_schedule;
    setMarkingIds(prev => new Set([...prev, u.id]));
    try {
      await markKnessetUpdateInSchedule(u.id, newMarked);
      setUpdates(prev => prev.map(x => x.id === u.id ? { ...x, marked_in_schedule: newMarked } : x));
    } finally {
      setMarkingIds(prev => { const s = new Set(prev); s.delete(u.id); return s; });
    }
  }

  useEffect(() => { load(); }, []);

  const typeConfig = {
    new:    { label: 'נוספה',  color: '#16a34a', bg: '#dcfce7', icon: '+' },
    cancel: { label: 'בוטלה', color: '#dc2626', bg: '#fee2e2', icon: '✕' },
    change: { label: 'שונה',   color: '#d97706', bg: '#fef3c7', icon: '!' },
  };

  if (loading) return null;

  return (
    <div style={{ marginTop: 28, padding: '0 24px 80px', direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: refreshing ? '#d97706' : '#16a34a' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>עדכוני כנסת אוטומטיים</span>
          {lastCheck && (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>עדכון אחרון: {lastCheck}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {updates.length > 0 && (
            <span style={{ background: '#e6f1fb', color: '#0c447c', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
              {updates.length} עדכונים
            </span>
          )}
          <button
            type="button"
            onClick={manualRefresh}
            disabled={refreshing}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, fontFamily: 'inherit', cursor: refreshing ? 'default' : 'pointer', border: '1px solid #e5e7eb', background: '#fff' }}
          >
            {refreshing ? '...' : '↻ רענן'}
          </button>
        </div>
      </div>

      {/* Updates */}
      {updates.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9ca3af', padding: '12px 0' }}>אין שינויים ב-48 השעות האחרונות</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {updates.map(u => {
            const cfg = typeConfig[u.update_type as keyof typeof typeConfig];
            const ago = getAgo(u.created_at);
            const topic = findScheduleTitle(u);
            return (
              <div key={u.id} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRight: `3px solid ${cfg.color}`, borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginBottom: 3 }}>{cfg.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                    {u.committee}
                  </div>
                  {topic && topic !== u.committee && (
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4, marginTop: 1 }}>
                      {topic}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{u.day_name} {u.date}</span>
                    {u.time_after && <span>· {u.time_after}</span>}
                    <span>·</span>
                    <span>{ago}</span>
                    <a href={u.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#0075C4', fontWeight: 600, fontSize: 11, textDecoration: 'none' }}>
                      ↗ דף הישיבה
                    </a>
                  </div>
                  {u.change_desc && (
                    <div style={{ fontSize: 11, color: '#6b7280', background: '#f9fafb', borderRadius: 3, padding: '2px 7px', marginTop: 5, display: 'inline-block' }}>
                      {u.change_desc}
                    </div>
                  )}
                  {u.update_type === 'cancel' && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        disabled={markingIds.has(u.id)}
                        onClick={e => { e.stopPropagation(); handleMarkInSchedule(u); }}
                        style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 4, fontFamily: 'inherit',
                          cursor: markingIds.has(u.id) ? 'default' : 'pointer',
                          border: `1px solid ${u.marked_in_schedule ? '#16a34a' : '#6b7280'}`,
                          background: u.marked_in_schedule ? '#dcfce7' : '#f9fafb',
                          color: u.marked_in_schedule ? '#16a34a' : '#374151',
                          fontWeight: 600,
                        }}
                      >
                        {markingIds.has(u.id) ? '...' : u.marked_in_schedule ? '✓ מסומן בלו"ז' : 'עדכן בלו"ז ←'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: '#d1d5db', textAlign: 'center' }}>
        סורק כל שעתיים · ועדות כנסת בלבד · בג&quot;ץ/ממשלה — עדכון ידני
      </div>
    </div>
  );
}

function getAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}
