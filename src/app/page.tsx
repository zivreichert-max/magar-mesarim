'use client';

import { useState, useMemo, useEffect } from 'react';
import { MESSAGES, Message, Topic } from '@/data/messages';
import PasswordGate from '@/components/PasswordGate';
import NamePrompt from '@/components/NamePrompt';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import MessageCard from '@/components/MessageCard';
import DetailPanel from '@/components/DetailPanel';
import SuggestButton from '@/components/SuggestButton';

type AppState = 'password' | 'name' | 'ready';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('password');
  const [authorName, setAuthorName] = useState('');
  const [activeFilter, setActiveFilter] = useState<Topic | 'הכל'>('הכל');
  const [search, setSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // On mount, check if name is already stored
  useEffect(() => {
    const stored = localStorage.getItem('author_name');
    if (stored) setAuthorName(stored);
  }, []);

  function handleUnlock() {
    const stored = localStorage.getItem('author_name');
    if (stored) {
      setAuthorName(stored);
      setAppState('ready');
    } else {
      setAppState('name');
    }
  }

  function handleName(name: string) {
    setAuthorName(name);
    setAppState('ready');
  }

  const filtered = useMemo(() => {
    return MESSAGES.filter(msg => {
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
  }, [activeFilter, search]);

  if (appState === 'password') return <PasswordGate onUnlock={handleUnlock} />;
  if (appState === 'name') return <NamePrompt onName={handleName} />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Header count={filtered.length} total={MESSAGES.length} />

      <FilterBar
        activeFilter={activeFilter}
        search={search}
        onFilterChange={setActiveFilter}
        onSearchChange={setSearch}
      />

      <main style={{ flex: 1, padding: '28px 32px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 14 }}>לא נמצאו מסרים תואמים</p>
          </div>
        ) : (
          <div
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

      <DetailPanel
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        authorName={authorName}
      />

      <SuggestButton authorName={authorName} />
    </div>
  );
}
