'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { MESSAGES, Message, Topic } from '@/data/messages';
import { Client } from '@/data/clients';
import dynamic from 'next/dynamic';
import PasswordGate from '@/components/PasswordGate';
import NamePrompt from '@/components/NamePrompt';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import MessageCard from '@/components/MessageCard';
import DetailPanel from '@/components/DetailPanel';
import SuggestButton from '@/components/SuggestButton';
import IntakeButton from '@/components/IntakeButton';
import RequestButton from '@/components/RequestButton';
import type { Paper } from '@/data/papers';

// Tab views are code-split: each drags in its own generated data files
// (schedule, timeline, sekira, papers, workplans…), and without dynamic()
// all of it downloads and parses before the password screen even renders
const viewLoading = () => (
  <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>טוען…</div>
);
const ScheduleView = dynamic(() => import('@/components/ScheduleView'), { loading: viewLoading });
const ClientRequestsView = dynamic(() => import('@/components/ClientRequestsView'), { loading: viewLoading });
const PapersView = dynamic(() => import('@/components/PapersView'), { loading: viewLoading });
const WorkPlansView = dynamic(() => import('@/components/WorkPlansView'), { loading: viewLoading });
const KnessetUpdates = dynamic(() => import('@/components/KnessetUpdates'), { loading: viewLoading });
const CalculatorsHub = dynamic(() => import('@/components/CalculatorsHub'), { loading: viewLoading });
const SekiraView = dynamic(() => import('@/components/SekiraView'), { loading: viewLoading });
const SekiraIntro = dynamic(() => import('@/components/SekiraIntro'), { loading: viewLoading });
import { getSharedMessageIds, startSession, pingSession, pingSessionBeacon } from '@/lib/supabase';

type AppState = 'password' | 'name' | 'ready';

type ViewId = 'sekira' | 'messages' | 'schedule' | 'requests' | 'papers' | 'workplans' | 'updates' | 'calculator';

// Order matters: first = rightmost tab (RTL). סקירה is the natural entry point.
// `title` (header heading) defaults to the tab label when omitted.
const TABS: { id: ViewId; label: string; title?: string; fullOnly?: boolean }[] = [
  { id: 'sekira',     label: 'סקירה' },
  { id: 'schedule',   label: 'לו"ז', title: 'לו"ז שבועי' },
  { id: 'updates',    label: 'עדכונים אוטומטיים', fullOnly: true },
  { id: 'papers',     label: 'ניירות עמדה' },
  { id: 'workplans',  label: 'תכניות עבודה' },
  { id: 'messages',   label: 'מסרים' },
  { id: 'requests',   label: 'בקשות', fullOnly: true },
  { id: 'calculator', label: 'מחשבונים' },
];

const VIEW_TITLES: Record<string, string> = Object.fromEntries(
  TABS.map(t => [t.id, t.title ?? t.label])
);

// First-entry intro flag — NOT localStorage (unsupported here); cookie with a
// graceful fallback (if cookies are blocked, the intro simply shows each entry).
const INTRO_COOKIE = 'sekira_intro_seen';
function hasSeenIntro(): boolean {
  try { return document.cookie.includes(`${INTRO_COOKIE}=1`); } catch { return false; }
}
function markIntroSeen() {
  try { document.cookie = `${INTRO_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}`; } catch { /* ignore */ }
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>('password');
  // Lazy initializers read browser-only storage once; safe because the first
  // rendered screen (password gate) does not depend on either value
  const [authorName, setAuthorName] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('author_name') ?? '') : ''
  );
  const [role, setRole] = useState<'full' | 'client'>('full');
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [allowedMessageIds, setAllowedMessageIds] = useState<number[] | null>(null);
  const [sharesError, setSharesError] = useState(false);
  const [sharesRetry, setSharesRetry] = useState(0);
  const [activeFilter, setActiveFilter] = useState<Topic | 'הכל'>('הכל');
  const [search, setSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [activeView, setActiveView] = useState<ViewId>('sekira');
  const [introDone, setIntroDone] = useState(() =>
    typeof document !== 'undefined' && hasSeenIntro()
  );
  const [paperToOpen, setPaperToOpen] = useState<Paper | null>(null);
  const sessionStarted = useRef(false);

  function enterFromIntro() {
    markIntroSeen();
    setIntroDone(true);
    window.scrollTo(0, 0);
  }

  // When client role becomes ready, fetch allowed message IDs
  useEffect(() => {
    if (appState === 'ready' && role === 'client' && activeClient) {
      let cancelled = false;
      getSharedMessageIds(activeClient.id)
        .then(ids => {
          if (!cancelled) {
            setAllowedMessageIds(ids);
            setSharesError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setSharesError(true);
        });
      return () => { cancelled = true; };
    }
  }, [appState, role, activeClient, sharesRetry]);

  // Usage analytics — one session row per entry, heartbeat keeps duration fresh
  useEffect(() => {
    if (appState !== 'ready' || sessionStarted.current) return;
    sessionStarted.current = true;

    let sessionId: string | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const label = role === 'client'
      ? (activeClient?.name ?? 'מפלגה לא ידועה')
      : (authorName || 'צוות');

    startSession({
      client_id: activeClient?.id ?? null,
      client_name: activeClient?.name ?? null,
      role,
      user_label: label,
    }).then(id => {
      sessionId = id;
      if (!id) return;
      interval = setInterval(() => pingSession(id), 30_000);
    });

    const finalPing = () => {
      if (sessionId && document.visibilityState === 'hidden') pingSessionBeacon(sessionId);
    };
    const onPageHide = () => { if (sessionId) pingSessionBeacon(sessionId); };
    document.addEventListener('visibilitychange', finalPing);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', finalPing);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [appState, role, activeClient, authorName]);

  function handleUnlock(unlockedRole: 'full' | 'client', client: Client | null) {
    setRole(unlockedRole);
    setActiveClient(client);

    if (unlockedRole === 'client' && client) {
      // Skip NamePrompt for clients — use their registered name
      setAuthorName(client.name);
      setAppState('ready');
    } else {
      // Full role: existing flow
      const stored = localStorage.getItem('author_name');
      if (stored) {
        setAuthorName(stored);
        setAppState('ready');
      } else {
        setAppState('name');
      }
    }
  }

  function handleName(name: string) {
    setAuthorName(name);
    setAppState('ready');
  }

  const filtered = useMemo(() => {
    let msgs = MESSAGES.filter(msg => {
      if (activeFilter !== 'הכל' && msg.topic !== activeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [msg.title, msg.summary, msg.detail, msg.topic, msg.source]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // For client role, further filter to allowed IDs only
    if (role === 'client') {
      if (allowedMessageIds === null) return []; // Still loading
      const allowed = new Set(allowedMessageIds);
      msgs = msgs.filter(msg => allowed.has(msg.id));
    }

    return msgs;
  }, [activeFilter, search, role, allowedMessageIds]);

  if (appState === 'password') return <PasswordGate onUnlock={handleUnlock} />;
  if (appState === 'name') return <NamePrompt onName={handleName} />;

  // First-entry onboarding overlay — sits above the app; "כניסה"/"דלג" reveals it
  if (!introDone) return <SekiraIntro onEnter={enterFromIntro} />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Header count={filtered.length} total={role === 'client' ? (allowedMessageIds?.length ?? 0) : MESSAGES.length} role={role} activeClient={activeClient} viewTitle={VIEW_TITLES[activeView]} />

      {/* View switcher */}
      <div style={{
        background: '#fff', borderBottom: '2px solid #e5e7eb',
        display: 'flex', padding: '0 24px',
      }}>
        {TABS.filter(tab => !tab.fullOnly || role === 'full').map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveView(tab.id)}
            style={{
              padding: '12px 20px', fontSize: 14, fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeView === tab.id ? '2px solid #0075C4' : '2px solid transparent',
              color: activeView === tab.id ? '#0075C4' : '#6b7280',
              fontFamily: 'inherit', touchAction: 'manipulation',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeView === 'sekira' && <SekiraView />}

      {activeView === 'messages' ? (
        <>
          <FilterBar
            activeFilter={activeFilter}
            search={search}
            onFilterChange={setActiveFilter}
            onSearchChange={setSearch}
          />

          <main className="page-main" style={{ flex: 1, padding: '28px 32px' }}>
            {role === 'client' && sharesError ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
                <p style={{ fontSize: 14, marginBottom: 12 }}>שגיאה בטעינת המסרים — נסה שוב</p>
                <button
                  type="button"
                  onClick={() => setSharesRetry(n => n + 1)}
                  style={{
                    padding: '8px 24px', border: 'none', borderRadius: 6,
                    background: '#0075C4', color: '#fff', fontFamily: 'inherit',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  טען מחדש
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <p style={{ fontSize: 14 }}>לא נמצאו מסרים תואמים</p>
              </div>
            ) : (
              <div
                className="cards-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 16,
                }}
              >
                {filtered.map((msg, i) => (
                  <MessageCard
                    key={msg.id}
                    message={msg}
                    index={i}
                    onClick={() => setSelectedMessage(msg)}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      ) : activeView === 'schedule' ? (
        <ScheduleView />
      ) : null}

      {activeView === 'requests' && role === 'full' && <ClientRequestsView />}
      {activeView === 'papers' && (
        <PapersView
          role={role}
          clientId={activeClient?.id}
          externalPaper={paperToOpen}
          onExternalConsumed={() => setPaperToOpen(null)}
        />
      )}
      {activeView === 'workplans' && <WorkPlansView role={role} clientId={activeClient?.id} />}
      {activeView === 'updates' && role === 'full' && <KnessetUpdates />}
      {activeView === 'calculator' && <CalculatorsHub />}

      <DetailPanel
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        authorName={authorName}
        role={role}
      />

      {role === 'full' ? (
        <>
          <SuggestButton authorName={authorName} />
          <IntakeButton authorName={authorName} />
        </>
      ) : (
        <RequestButton authorName={activeClient?.name ?? ''} clientId={activeClient?.id ?? ''} />
      )}
    </div>
  );
}
