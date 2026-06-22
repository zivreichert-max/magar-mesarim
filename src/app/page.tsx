'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { MESSAGES, Message, Topic } from '@/data/messages';
import { Client } from '@/data/clients';
import PasswordGate from '@/components/PasswordGate';
import NamePrompt from '@/components/NamePrompt';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import MessageCard from '@/components/MessageCard';
import DetailPanel from '@/components/DetailPanel';
import SuggestButton from '@/components/SuggestButton';
import RequestButton from '@/components/RequestButton';
import ScheduleView from '@/components/ScheduleView';
import ClientRequestsView from '@/components/ClientRequestsView';
import PapersView from '@/components/PapersView';
import WorkPlansView from '@/components/WorkPlansView';
import KnessetUpdates from '@/components/KnessetUpdates';
import PriceCalc from '@/components/PriceCalc';
import SekiraView from '@/components/SekiraView';
import SekiraIntro from '@/components/SekiraIntro';
import { Paper } from '@/data/papers';
import { getSharedMessageIds, startSession, pingSession, pingSessionBeacon } from '@/lib/supabase';

type AppState = 'password' | 'name' | 'ready';

const VIEW_TITLES: Record<string, string> = {
  sekira:     'סקירה',
  messages:   'מסרים',
  schedule:   'לו"ז שבועי',
  requests:   'בקשות',
  papers:     'ניירות עמדה',
  workplans:  'תכניות עבודה',
  updates:    'עדכונים אוטומטיים',
  calculator: 'מחשבון התייקרויות',
};

type ViewId = 'sekira' | 'messages' | 'schedule' | 'requests' | 'papers' | 'workplans' | 'updates' | 'calculator';

// Order matters: first = rightmost tab (RTL). סקירה is the natural entry point.
const TABS: { id: ViewId; label: string; fullOnly?: boolean }[] = [
  { id: 'sekira',     label: 'סקירה' },
  { id: 'schedule',   label: 'לו"ז' },
  { id: 'updates',    label: 'עדכונים אוטומטיים', fullOnly: true },
  { id: 'papers',     label: 'ניירות עמדה' },
  { id: 'workplans',  label: 'תכניות עבודה' },
  { id: 'messages',   label: 'מסרים' },
  { id: 'requests',   label: 'בקשות', fullOnly: true },
  { id: 'calculator', label: 'מחשבונים' },
];

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
  const [authorName, setAuthorName] = useState('');
  const [role, setRole] = useState<'full' | 'client'>('full');
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [allowedMessageIds, setAllowedMessageIds] = useState<number[] | null>(null);
  const [activeFilter, setActiveFilter] = useState<Topic | 'הכל'>('הכל');
  const [search, setSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [activeView, setActiveView] = useState<ViewId>('sekira');
  const [introDone, setIntroDone] = useState(false);
  const [paperToOpen, setPaperToOpen] = useState<Paper | null>(null);
  const sessionStarted = useRef(false);

  // On mount, check if name is already stored + whether intro was already seen
  useEffect(() => {
    Promise.resolve(localStorage.getItem('author_name')).then(stored => {
      if (stored) setAuthorName(stored);
    });
    if (hasSeenIntro()) setIntroDone(true);
  }, []);

  function enterFromIntro() {
    markIntroSeen();
    setIntroDone(true);
    window.scrollTo(0, 0);
  }

  // Open a position paper from the סקירה tab → switch to ניירות עמדה and open it
  function openPaper(p: Paper) {
    setPaperToOpen(p);
    setActiveView('papers');
  }

  // Same, but from the intro overlay — also dismiss the intro into the app
  function openPaperFromIntro(p: Paper) {
    markIntroSeen();
    setIntroDone(true);
    openPaper(p);
    window.scrollTo(0, 0);
  }

  // When client role becomes ready, fetch allowed message IDs
  useEffect(() => {
    if (appState === 'ready' && role === 'client' && activeClient) {
      getSharedMessageIds(activeClient.id).then(ids => {
        setAllowedMessageIds(ids);
      });
    }
  }, [appState, role, activeClient]);

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
    document.addEventListener('visibilitychange', finalPing);
    window.addEventListener('pagehide', () => { if (sessionId) pingSessionBeacon(sessionId); });

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', finalPing);
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
      msgs = msgs.filter(msg => allowedMessageIds.includes(msg.id));
    }

    return msgs;
  }, [activeFilter, search, role, allowedMessageIds]);

  if (appState === 'password') return <PasswordGate onUnlock={handleUnlock} />;
  if (appState === 'name') return <NamePrompt onName={handleName} />;

  // First-entry onboarding overlay — sits above the app; "כניסה"/"דלג" reveals it
  if (!introDone) return <SekiraIntro onEnter={enterFromIntro} onOpenPaper={openPaperFromIntro} />;

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

      {activeView === 'sekira' && <SekiraView onOpenPaper={openPaper} />}

      {activeView === 'messages' ? (
        <>
          <FilterBar
            activeFilter={activeFilter}
            search={search}
            onFilterChange={setActiveFilter}
            onSearchChange={setSearch}
          />

          <main className="page-main" style={{ flex: 1, padding: '28px 32px' }}>
            {filtered.length === 0 ? (
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
      {activeView === 'calculator' && <PriceCalc />}

      <DetailPanel
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        authorName={authorName}
        role={role}
      />

      {role === 'full' ? (
        <SuggestButton authorName={authorName} />
      ) : (
        <RequestButton authorName={activeClient?.name ?? ''} clientId={activeClient?.id ?? ''} />
      )}
    </div>
  );
}
