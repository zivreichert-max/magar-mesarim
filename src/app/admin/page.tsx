'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Suggestion, SiteSession, getSiteSessions, IntakeItem, getIntakeQueue, updateIntakeStatus } from '@/lib/supabase';
import { CLIENTS } from '@/data/clients';
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

// Each password maps to a party colour (from clients.ts); the full/internal
// password and unknown clients get their own colours so every chart segment,
// dot and bar is colour-coded consistently across the dashboard.
const PARTY_COLOR: Record<string, string> = Object.fromEntries(CLIENTS.map(c => [c.id, c.color]));
const FULL_COLOR = '#0f172a';
const UNKNOWN_COLOR = '#9ca3af';

function partyMeta(s: SiteSession): { key: string; name: string; color: string } {
  if (s.client_id && PARTY_COLOR[s.client_id]) {
    return { key: s.client_id, name: s.client_name ?? s.client_id, color: PARTY_COLOR[s.client_id] };
  }
  if (s.role === 'full') return { key: '__full__', name: 'צוות / מנהל', color: FULL_COLOR };
  return { key: '__unknown__', name: 'לא ידוע', color: UNKNOWN_COLOR };
}

interface PartyStat {
  key: string;
  name: string;
  color: string;
  entries: number;
  users: number;
  totalMs: number;
  avgMs: number;
  lastActive: string;
}

function aggregateByParty(sessions: SiteSession[]): PartyStat[] {
  const map = new Map<string, { name: string; color: string; sessions: SiteSession[]; users: Set<string> }>();
  for (const s of sessions) {
    const m = partyMeta(s);
    let g = map.get(m.key);
    if (!g) { g = { name: m.name, color: m.color, sessions: [], users: new Set() }; map.set(m.key, g); }
    g.sessions.push(s);
    g.users.add(s.user_label || '—');
  }
  const out: PartyStat[] = [];
  for (const [key, g] of map) {
    const totalMs = g.sessions.reduce((a, s) => a + sessionDurationMs(s), 0);
    const lastActive = g.sessions.reduce((a, s) => s.last_active > a ? s.last_active : a, g.sessions[0].last_active);
    out.push({
      key, name: g.name, color: g.color,
      entries: g.sessions.length,
      users: g.users.size,
      totalMs,
      avgMs: totalMs / g.sessions.length,
      lastActive,
    });
  }
  return out.sort((a, b) => b.entries - a.entries);
}

interface DayPartySeg { key: string; name: string; color: string; count: number; }
interface DayStat { key: string; label: string; entries: number; totalMs: number; sortTs: number; parties: DayPartySeg[]; }

function aggregateByDay(sessions: SiteSession[]): DayStat[] {
  const WD = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const map = new Map<string, DayStat & { _p: Map<string, DayPartySeg> }>();
  for (const s of sessions) {
    const d = new Date(s.started_at);
    const key = d.toLocaleDateString('he-IL');
    let g = map.get(key);
    if (!g) {
      g = { key, label: `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`, entries: 0, totalMs: 0, sortTs: 0, parties: [], _p: new Map() };
      map.set(key, g);
    }
    g.entries += 1;
    g.totalMs += sessionDurationMs(s);
    g.sortTs = Math.max(g.sortTs, d.getTime());
    const m = partyMeta(s);
    const seg = g._p.get(m.key);
    if (seg) seg.count += 1;
    else g._p.set(m.key, { key: m.key, name: m.name, color: m.color, count: 1 });
  }
  return [...map.values()]
    .map(g => ({ ...g, parties: [...g._p.values()].sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.sortTs - a.sortTs);
}

const SESSION_LOG_LIMIT = 200;

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [section, setSection] = useState<'suggestions' | 'intake' | 'analytics'>('suggestions');
  const [sessions, setSessions] = useState<SiteSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [intake, setIntake] = useState<IntakeItem[]>([]);
  const [intakeLoading, setIntakeLoading] = useState(false);

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

  const fetchIntake = useCallback(async () => {
    setIntakeLoading(true);
    try {
      setIntake(await getIntakeQueue());
    } catch {
      setIntake([]);
    }
    setIntakeLoading(false);
  }, []);

  // Deferred a tick so the effect body has no synchronous setState
  // (react-hooks/set-state-in-effect; keeps React Compiler optimizations)
  useEffect(() => {
    if (!unlocked) return;
    const t = setTimeout(fetchSuggestions, 0);
    return () => clearTimeout(t);
  }, [unlocked, fetchSuggestions]);

  useEffect(() => {
    if (!unlocked || section !== 'analytics') return;
    const t = setTimeout(fetchSessions, 0);
    return () => clearTimeout(t);
  }, [unlocked, section, fetchSessions]);

  useEffect(() => {
    if (!unlocked || section !== 'intake') return;
    const t = setTimeout(fetchIntake, 0);
    return () => clearTimeout(t);
  }, [unlocked, section, fetchIntake]);

  async function setIntakeItemStatus(id: string, status: string) {
    try {
      await updateIntakeStatus(id, status);
    } catch (err) {
      alert(`עדכון הסטטוס נכשל (${err instanceof Error ? err.message : ''})`);
      return;
    }
    setIntake(prev => prev.map(i => (i.id === id ? { ...i, status } : i)));
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('suggestions').update({ status }).eq('id', id);
    if (error) {
      alert(`עדכון הסטטוס נכשל — לא נשמר. (${error.message})`);
      return;
    }
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
            fontFamily: "var(--font-frank-ruhl), serif",
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
              background: 'var(--brand)',
              color: '#fff',
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
        {([['suggestions', 'הצעות תוכן'], ['intake', 'הזנה מהירה'], ['analytics', 'שימוש']] as const).map(([sec, label]) => {
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
                background: isActive ? 'var(--brand)' : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
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

      {section === 'intake' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-frank-ruhl), serif", fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
                הזנה מהירה — תור עיבוד
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                {intake.length} פריטים · {intake.filter(i => i.status === 'pending').length} ממתינים לעיבוד
              </p>
            </div>
            <button
              onClick={fetchIntake}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}
            >
              רענן
            </button>
          </div>

          {intakeLoading ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>טוען...</p>
          ) : intake.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              התור ריק — פריטים שנשלחים מכפתור ״⚡ הזנה מהירה״ באתר יופיעו כאן
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {intake.map(item => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
                    padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr auto',
                    gap: '12px 20px', alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {item.topic_hint && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: topicColor(item.topic_hint), letterSpacing: 0.5 }}>
                          {item.topic_hint}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {item.author_name} · {formatDate(item.created_at)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {item.raw_text}
                    </p>
                    {item.image_url && (
                      <a href={item.image_url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image_url}
                          alt="ויזואליה מצורפת"
                          style={{ maxWidth: 220, maxHeight: 130, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'cover' }}
                        />
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '4px 12px', borderRadius: 12,
                        color: item.status === 'pending' ? '#d4a843' : item.status === 'processed' ? '#22c55e' : '#ef4444',
                        border: '1px solid currentColor',
                      }}
                    >
                      {item.status === 'pending' ? 'ממתין' : item.status === 'processed' ? 'עובד ✓' : 'נדחה'}
                    </span>
                    {item.status === 'pending' ? (
                      <button
                        onClick={() => setIntakeItemStatus(item.id, 'rejected')}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#ef4444', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
                      >
                        דחה
                      </button>
                    ) : (
                      <button
                        onClick={() => setIntakeItemStatus(item.id, 'pending')}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
                      >
                        החזר לתור
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
              fontFamily: "var(--font-frank-ruhl), serif",
              fontSize: 24,
              fontWeight: 900,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            הצעות תוכן
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {counts.all} הצעות סה&quot;כ · {counts.pending} ממתינות
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
                background: isActive ? 'var(--brand)' : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
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
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
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
  // Aggregations only depend on the session list — memoized so typing in the
  // filter selects doesn't recompute them on every render
  const stats = useMemo(() => aggregateByParty(sessions), [sessions]);
  const dayStats = useMemo(() => aggregateByDay(sessions), [sessions]);
  const maxDayEntries = useMemo(() => Math.max(1, ...dayStats.map(d => d.entries)), [dayStats]);
  const totalEntries = sessions.length;
  const totalMs = useMemo(() => sessions.reduce((a, s) => a + sessionDurationMs(s), 0), [sessions]);

  // ── Excel-style filters for the session log ──────────────────────────────
  const [fParty, setFParty] = useState('');
  const [fUser, setFUser] = useState('');
  const [fDate, setFDate] = useState('');
  const userOptions = useMemo(
    () => [...new Set(sessions.map(s => s.user_label || '—'))].sort((a, b) => a.localeCompare(b, 'he')),
    [sessions]
  );
  const filteredSessions = useMemo(() => sessions.filter(s =>
    (!fParty || partyMeta(s).key === fParty) &&
    (!fUser || (s.user_label || '—') === fUser) &&
    (!fDate || new Date(s.started_at).toLocaleDateString('he-IL') === fDate)
  ), [sessions, fParty, fUser, fDate]);
  const hasFilter = !!(fParty || fUser || fDate);
  const selectStyle = {
    padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: '#fff', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-frank-ruhl), serif", fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            שימוש באתר
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {totalEntries} כניסות סה&quot;כ · {formatDuration(totalMs)} זמן מצטבר
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
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: st.color, flexShrink: 0 }} />
                {st.name}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{st.entries}</span>
              <span style={{ fontSize: 14, color: 'var(--text)', textAlign: 'center' }}>{st.users}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>{formatDuration(st.avgMs)}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>{formatDuration(st.totalMs)}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'left' }}>{formatDateTime(st.lastActive)}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <>
          {/* ── Per-day breakdown ───────────────────────────────────────── */}
          <div style={{ marginTop: 36 }}>
            <h2 style={{ fontFamily: "var(--font-frank-ruhl), serif", fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 14px' }}>
              פילוח לפי יום
            </h2>
            {/* Legend — colour per party */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              {stats.map(st => (
                <span key={st.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: st.color }} />
                  {st.name}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dayStats.map(d => (
                <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 160px', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{d.label}</span>
                  <div style={{ background: 'var(--bg3)', borderRadius: 6, height: 22, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', height: '100%', width: `${(d.entries / maxDayEntries) * 100}%` }}>
                      {d.parties.map(p => (
                        <div key={p.key} title={`${p.name}: ${p.count}`} style={{ flexGrow: p.count, flexBasis: 0, background: p.color }} />
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'left' }}>{d.entries} כניסות · {formatDuration(d.totalMs)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Session log ─────────────────────────────────────────────── */}
          <div style={{ marginTop: 36 }}>
            <h2 style={{ fontFamily: "var(--font-frank-ruhl), serif", fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 14px' }}>
              יומן כניסות
            </h2>
            {/* Excel-style filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <select value={fParty} onChange={e => setFParty(e.target.value)} style={selectStyle}>
                <option value="">כל המפלגות</option>
                {stats.map(st => <option key={st.key} value={st.key}>{st.name}</option>)}
              </select>
              <select value={fUser} onChange={e => setFUser(e.target.value)} style={selectStyle}>
                <option value="">כל המשתמשים</option>
                {userOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select value={fDate} onChange={e => setFDate(e.target.value)} style={selectStyle}>
                <option value="">כל התאריכים</option>
                {dayStats.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              {hasFilter && (
                <button
                  onClick={() => { setFParty(''); setFUser(''); setFDate(''); }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}
                >
                  נקה סינון
                </button>
              )}
              <span style={{ fontSize: 12, color: 'var(--muted)', marginInlineStart: 'auto' }}>
                {filteredSessions.length} כניסות
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1.2fr 0.8fr', gap: 12, padding: '0 16px', fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
                <span>מפלגה</span>
                <span>שם</span>
                <span>מתי</span>
                <span style={{ textAlign: 'left' }}>משך</span>
              </div>
              {filteredSessions.slice(0, SESSION_LOG_LIMIT).map(s => (
                <div
                  key={s.id}
                  style={{
                    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '10px 16px', display: 'grid',
                    gridTemplateColumns: '1.4fr 1.2fr 1.2fr 0.8fr', gap: 12, alignItems: 'center',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: partyMeta(s).color, flexShrink: 0 }} />
                    {partyMeta(s).name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{s.user_label || '—'}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDateTime(s.started_at)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>{formatDuration(sessionDurationMs(s))}</span>
                </div>
              ))}
            </div>
            {filteredSessions.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
                אין כניסות התואמות לסינון.
              </p>
            ) : filteredSessions.length > SESSION_LOG_LIMIT ? (
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>
                מוצגות {SESSION_LOG_LIMIT} הכניסות האחרונות מתוך {filteredSessions.length}.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
