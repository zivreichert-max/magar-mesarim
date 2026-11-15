'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import PasswordGate, { MkAccess, Unlock } from '@/components/PasswordGate';
import NamePrompt from '@/components/NamePrompt';
import { startSession, pingSession, pingSessionBeacon } from '@/lib/supabase';

// הלשכה — the site is one workspace: password → (name, first time) → office.
// The office itself is code-split so the password screen loads instantly.
// (The election-period tabs — messages, sekira, papers, work plans,
// calculators — were retired on 15.11.2026; their components stay in the repo
// as an archive but nothing renders them.)
const OfficeShell = dynamic(() => import('@/components/office/OfficeShell'), { loading: () => null });
const MkOffice = dynamic(() => import('@/components/office/MkOffice'), { loading: () => null });

type AppState = 'password' | 'name' | 'ready';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('password');
  // Lazy initializer reads browser-only storage once; safe because the first
  // rendered screen (password gate) does not depend on the value
  const [userName, setUserName] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('author_name') ?? '') : ''
  );
  // The admin password as typed at the gate — also unlocks the protected
  // legislation tracker, so the office never asks for a second credential
  const [adminKey, setAdminKey] = useState('');
  // Set when an MK entered with a personal code — they get their own view only
  const [mkAccess, setMkAccess] = useState<MkAccess | null>(null);
  const sessionStarted = useRef(false);

  // Usage log — one session row per entry, heartbeat keeps the duration fresh
  useEffect(() => {
    if (appState !== 'ready' || sessionStarted.current) return;
    sessionStarted.current = true;

    let sessionId: string | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    startSession({
      client_id: mkAccess ? mkAccess.party : null,
      client_name: mkAccess ? mkAccess.party : null,
      role: mkAccess ? 'client' : 'full',
      user_label: mkAccess ? mkAccess.name : (userName || 'צוות'),
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
  }, [appState, mkAccess, userName]);

  function handleUnlock(unlock: Unlock) {
    if (unlock.role === 'mk') {
      setMkAccess(unlock.access);
      setAppState('ready');
      return;
    }
    setAdminKey(unlock.key);
    const stored = localStorage.getItem('author_name');
    if (stored) {
      setUserName(stored);
      setAppState('ready');
    } else {
      setAppState('name');
    }
  }

  function handleName(name: string) {
    setUserName(name);
    setAppState('ready');
  }

  function logout() {
    setAdminKey('');
    setMkAccess(null);
    sessionStarted.current = false;
    setAppState('password');
  }

  if (appState === 'password') return <PasswordGate onUnlock={handleUnlock} />;
  if (appState === 'name') return <NamePrompt onName={handleName} />;
  if (mkAccess) return <MkOffice access={mkAccess} onLogout={logout} />;
  return <OfficeShell adminKey={adminKey} userName={userName} onLogout={logout} />;
}
