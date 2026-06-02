'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { getSharedMessageIds } from '@/lib/supabase';

type AppState = 'password' | 'name' | 'ready';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('password');
  const [authorName, setAuthorName] = useState('');
  const [role, setRole] = useState<'full' | 'client'>('full');
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [allowedMessageIds, setAllowedMessageIds] = useState<number[] | null>(null);
  const [activeFilter, setActiveFilter] = useState<Topic | 'הכל'>('הכל');
  const [search, setSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [activeView, setActiveView] = useState<'messages' | 'schedule' | 'requests'>('messages');

  // On mount, check if name is already stored
  useEffect(() => {
    Promise.resolve(localStorage.getItem('author_name')).then(stored => {
      if (stored) setAuthorName(stored);
    });
  }, []);

  // When client role becomes ready, fetch allowed message IDs
  useEffect(() => {
    if (appState === 'ready' && role === 'client' && activeClient) {
      getSharedMessageIds(activeClient.id).then(ids => {
        setAllowedMessageIds(ids);
      });
    }
  }, [appState, role, activeClient]);

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Header count={filtered.length} total={role === 'client' ? (allowedMessageIds?.length ?? 0) : MESSAGES.length} role={role} activeClient={activeClient} />

      {/* View switcher */}
      <div style={{
        background: '#fff', borderBottom: '2px solid #e5e7eb',
        display: 'flex', padding: '0 24px',
      }}>
        <button
          type="button"
          onClick={() => setActiveView('messages')}
          style={{
            padding: '12px 20px', fontSize: 14, fontWeight: 600,
            border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeView === 'messages' ? '2px solid #0075C4' : '2px solid transparent',
            color: activeView === 'messages' ? '#0075C4' : '#6b7280',
            fontFamily: 'inherit', touchAction: 'manipulation',
            marginBottom: -2,
          }}
        >
          מסרים
        </button>
        <button
          type="button"
          onClick={() => setActiveView('schedule')}
          style={{
            padding: '12px 20px', fontSize: 14, fontWeight: 600,
            border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeView === 'schedule' ? '2px solid #0075C4' : '2px solid transparent',
            color: activeView === 'schedule' ? '#0075C4' : '#6b7280',
            fontFamily: 'inherit', touchAction: 'manipulation',
            marginBottom: -2,
          }}
        >
          לו&quot;ז
        </button>
        {role === 'full' && (
          <button
            type="button"
            onClick={() => setActiveView('requests')}
            style={{
              padding: '12px 20px', fontSize: 14, fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeView === 'requests' ? '2px solid #0075C4' : '2px solid transparent',
              color: activeView === 'requests' ? '#0075C4' : '#6b7280',
              fontFamily: 'inherit', touchAction: 'manipulation',
              marginBottom: -2,
            }}
          >
            בקשות
          </button>
        )}
      </div>

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
