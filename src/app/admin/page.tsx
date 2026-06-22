'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, Suggestion, SiteSession, getSiteSessions } from '@/lib/supabase';
import { TOPICS } from '@/data/messages';

const CORRECT_PASSWORD = '61218384';

const STATUS_COLORS: Record<string, string> = {
  pending:  '#d4a843',
  approved: '#22c55e',
  rejected: '#ef4444',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function topicColor(topic: string) {
  return (TOPICS as Record<string, { color: string }>)[topic]?.color ?? '#7a7d8a';
}

function sessionDurationMs(s: SiteSession) {
  return Math.max(0, new Date(s.last_active).getTime() - new Date(s.started_at).getTime());
}

function formatDuration(ms: number) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return '< דקה';
  if (totalMin < 60) return `${totalMin} דק׳`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} ש׳ ${m} דק׳` : `${h} ש׳`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface PartyStat {
  key: string;
  name: string;
  entries: number;
  users: number;
  totalMs: number;
  avgMs: number;
  lastActive: string;
}

function aggregateByParty(sessions: SiteSession[]): PartyStat[] {
  const map = new Map<string, { name: string; sessions: SiteSession[]; users: Set<string> }>();
  for (const s of sessions) {
    const key = s.client_id ?? (s.role === 'full' ? '__full__' : '__unknown__');
    const name = s.client_name ?? (s.role === 'full' ? 'צוות / מנהל' : 'לא ידוע');
    let g = map.get(key);
    if (!g) { g = { name, sessions: [], users: new Set() }; map.set(key, g); }
    g.sessions.push(s);
    g.users.add(s.user_label || '—');
  }
  const out: PartyStat[] = [];
  for (const [key, g] of map) {
    const totalMs = g.sessions.reduce((a, s) => a + sessionDurationMs(s), 0);
    const lastActive = g.sessions.reduce((a, s) => s.last_active > a ? s.last_active : a, g.sessions[0].last_active);
    out.push({
      key, name: g.name,
      entries: g.sessions.length,
      users: g.users.size,
      totalMs,
      avgMs: totalMs / g.sessions.length,
      lastActive,
    });
  }
  return out.sort((a, b) => b.entries - a.entries);
}

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [section, setSection] = useState<'suggestions' | 'analytics'>('suggestions');
  const [sessions, setSessions] = useState<SiteSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setSuggestions(data as Suggestion[]);
    setLoading(false);
  }, []);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessions(await getSiteSessions());
    setSessionsLoading(false);
  }, []);

  useEffect(() => {
    if (unlocked) fetchSuggestions();
  }, [unlocked, fetchSuggestions]);

  useEffect(() => {
    if (unlocked && section === 'analytics') fetchSessions();
  }, [unlocked, section, fetchSessions]);

  async function updateStatus(id: string, status: string) {
    await supabase.from('suggestions').update({ status }).eq('id', id);
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, status } : s)
    );
  }

  function handleLogin() {
    if (pw === CORRECT_PASSWORD) {
      setUnlocked(true);
    } else {
      setPwError('סיסמה שגויה');
      setPw('');
      setTimeout(() => setPwError(''), 2000);
    }
  }

  if (!unlocked) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          background: 'var(--bg)',
        }}
      >
        <h1
          style={{
            fontFamily: "'Frank Ruhl Libre', serif",
            fontSize: 26,
            fontWeight: 900,
            color: 'var(--text)',
          }}
        >
          🔒 פאנל ניהול
        </h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            autoFocus
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: 16,
              outline: 'none',
              width: 200,
              textAlign: 'center',
              letterSpacing: 4,
              direction: 'ltr',
            }}
          />
          <button
            onClick={handleLogin}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--text)',
              color: 'var(--bg)',
              fontFamily: 'inherit',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            כניסה
          </button>
        </div>
        <div style={{ height: 18, color: '#ef4444', fontSize: 13 }}>{pwError}</div>
      </div>
    );
  }

  const visible = filter === 'all'
    ? suggestions
    : suggestions.filter(s => s.status === filter);

  const counts = {
    all: suggestions.length,
    pending: suggestions.filter(s => s.status === 'pending').length,
    approved: suggestions.filter(s => s.status === 'approved').length,
    rejected: suggestions.filter(s => s.status === 'rejected').length,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px' }}>
      {/* Section switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {([['suggestions', 'הצעות תוכן'], ['analytics', 'שימוש']] as const).map(([sec, label]) => {
          const isActive = section === sec;
          return (
            <button
              key={sec}
              onClick={() => setSection(sec)}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: isActive ? 'transparent' : 'var(--border)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--muted)',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {section === 'analytics' && (
        <AnalyticsPanel sessions={sessions} loading={sessionsLoading} onRefresh={fetchSessions} />
      )}

      {section === 'suggestions' && (
      <>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 28,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Frank Ruhl Libre', serif",
              fontSize: 24,
              fontWeight: 900,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            הצעות תוכן
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {counts.all} הצעות סה"כ · {counts.pending} ממתינות
          </p>
        </div>
        <button
          onClick={fetchSuggestions}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg3)',
            color: 'var(--muted)',
            fontFamily: 'inherit',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          רענן
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => {
          const labels = { all: 'הכל', pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' };
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: isActive ? 'transparent' : 'var(--border)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--muted)',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {labels[f]} ({counts[f]})
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>טוען...</p>
      ) : visible.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>אין הצעות להצגה</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(s => (
            <div
              key={s.id}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '12px 20px',
                alignItems: 'start',
              }}
            >
              {/* Left: content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Topic + subtopic row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: topicColor(s.topic),
                      letterSpacing: 0.5,
                    }}
                  >
                    {s.topic}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>›</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {s.subtopic}
                  </span>
                </div>

                {/* Description */}
                <p style={{ fontSize: 13, color: 'rgba(232,230,224,0.8)', lineHeight: 1.6, margin: 0 }}>
                  {s.description}
                </p>

                {/* Source */}
                {s.source && (
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
                    מקור: {s.source}
                  </p>
                )}

                {/* Meta row */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {s.author_name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.6 }}>·</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.6 }}>
                    {formatDate(s.created_at)}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: STATUS_COLORS[s.status] ?? 'var(--muted)',
                      border: `1px solid ${STATUS_COLORS[s.status] ?? 'var(--border)'}`,
                      borderRadius: 10,
                      padding: '2px 8px',
                    }}
                  >
                    {s.status === 'pending' ? 'ממתין' : s.status === 'approved' ? 'אושר' : 'נדחה'}
                  </span>
                </div>
              </div>

              {/* Right: actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.status !== 'approved' && (
                  <button
                    onClick={() => updateStatus(s.id, 'approved')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 7,
                      border: 'none',
                      background: '#22c55e22',
                      color: '#22c55e',
                      fontFamily: 'inherit',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    אשר
                  </button>
                )}
                {s.status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(s.id, 'rejected')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 7,
                      border: 'none',
                      background: '#ef444422',
                      color: '#ef4444',
                      fontFamily: 'inherit',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    דחה
                  </button>
                )}
                {s.status !== 'pending' && (
                  <button
                    onClick={() => updateStatus(s.id, 'pending')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--muted)',
                      fontFamily: 'inherit',
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    אפס
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}

interface AnalyticsPanelProps {
  sessions: SiteSession[];
  loading: boolean;
  onRefresh: () => void;
}

function AnalyticsPanel({ sessions, loading, onRefresh }: AnalyticsPanelProps) {
  const stats = aggregateByParty(sessions);
  const totalEntries = sessions.length;
  const totalMs = sessions.reduce((a, s) => a + sessionDurationMs(s), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'Frank Ruhl Libre', serif", fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            שימוש באתר
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {totalEntries} כניסות סה"כ · {formatDuration(totalMs)} זמן מצטבר
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}
        >
          רענן
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>טוען...</p>
      ) : stats.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>אין נתוני שימוש עדיין</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.8fr 1fr 1fr 1.2fr', gap: 12, padding: '0 20px', fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
            <span>מפלגה</span>
            <span style={{ textAlign: 'center' }}>כניסות</span>
            <span style={{ textAlign: 'center' }}>משתמשים</span>
            <span style={{ textAlign: 'center' }}>זמן ממוצע</span>
            <span style={{ textAlign: 'center' }}>זמן מצטבר</span>
            <span style={{ textAlign: 'left' }}>פעילות אחרונה</span>
          </div>
          {stats.map(st => (
            <div
              key={st.key}
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '16px 20px', display: 'grid',
                gridTemplateColumns: '1.6fr 0.8fr 0.8fr 1fr 1fr 1.2fr', gap: 12, alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{st.name}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{st.entries}</span>
              <span style={{ fontSize: 14, color: 'rgba(232,230,224,0.8)', textAlign: 'center' }}>{st.users}</span>
              <span style={{ fontSize: 13, color: 'rgba(232,230,224,0.8)', textAlign: 'center' }}>{formatDuration(st.avgMs)}</span>
              <span style={{ fontSize: 13, color: 'rgba(232,230,224,0.8)', textAlign: 'center' }}>{formatDuration(st.totalMs)}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'left' }}>{formatDateTime(st.lastActive)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
