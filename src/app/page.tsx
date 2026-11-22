'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import PasswordGate, { MkAccess, Unlock } from '@/components/PasswordGate';
import NamePrompt from '@/components/NamePrompt';
import { OfficeLogin, OfficeSetPassword } from '@/components/office/OfficeLogin';
import { supabase } from '@/lib/supabase';
import { getOfficeMe, LinkKind, officeSignOut, OfficeUser, setLegacyKey } from '@/lib/office';

// הלשכה — the site is one workspace behind a personal account:
//   sign in (email + password)  →  the office, by role (admin / office).
// A one-time link from an admin (…/#invite=<token> or …/#reset=<token>) opens
// the set-password screen instead. The session is kept in the browser, so a
// returning user goes straight in.
// The office itself is code-split so the sign-in screen loads instantly.
// (The election-period tabs were retired on 15.11.2026; their components stay
// in the repo as an archive but nothing renders them.)
//
// TRANSITION: until the cut-over the old shared password still opens the
// office ("כניסה בסיסמה הישנה") — PasswordGate, NamePrompt, MkOffice and the
// legacy key go away with it.
const OfficeShell = dynamic(() => import('@/components/office/OfficeShell'), { loading: () => null });
const MkOffice = dynamic(() => import('@/components/office/MkOffice'), { loading: () => null });

type Screen = 'loading' | 'login' | 'link' | 'legacy' | 'name' | 'ready';

const NOT_REGISTERED = 'החשבון הזה אינו רשום בלשכה. פונים למנהל/ת הלשכה.';
const legacyAdmin = (name: string): OfficeUser => ({ role: 'admin', name, email: '', mk: null, party: null, legacy: true });

export default function Home() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [user, setUser] = useState<OfficeUser | null>(null);
  const [link, setLink] = useState<{ kind: LinkKind; token: string } | null>(null);
  const [notice, setNotice] = useState('');
  // Transition: an MK who entered with an old personal code
  const [mkAccess, setMkAccess] = useState<MkAccess | null>(null);
  // True while the office is open on a personal account (not the old password)
  const signedIn = useRef(false);

  // Who is signed in → the office, or back to the sign-in screen
  const enter = useCallback(async () => {
    const me = await getOfficeMe();
    if (me) {
      signedIn.current = true;
      setUser(me);
      setNotice('');
      setScreen('ready');
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      // Signed in, but not (or no longer) a user of the office
      await officeSignOut();
      setNotice(NOT_REGISTERED);
    }
    setScreen('login');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = /^#(invite|reset)=([\w-]+)$/.exec(window.location.hash);
      if (m) {
        setLink({ kind: m[1] as LinkKind, token: m[2] });
        setScreen('link');
        return;
      }
      if (!cancelled) await enter();
    })();
    return () => { cancelled = true; };
  }, [enter]);

  // Signed out elsewhere (another tab, or the session was revoked) → sign-in screen
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event !== 'SIGNED_OUT' || !signedIn.current) return;
      signedIn.current = false;
      setUser(null);
      setScreen('login');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function closeLink() {
    window.history.replaceState(null, '', window.location.pathname);
    setLink(null);
  }

  function handleUnlock(unlock: Unlock) {
    if (unlock.role === 'mk') {
      setLegacyKey(unlock.access.key);
      setMkAccess(unlock.access);
      setScreen('ready');
      return;
    }
    setLegacyKey(unlock.key);
    const stored = localStorage.getItem('author_name');
    if (stored) {
      setUser(legacyAdmin(stored));
      setScreen('ready');
    } else {
      setScreen('name');
    }
  }

  async function logout() {
    signedIn.current = false;
    setLegacyKey('');
    setMkAccess(null);
    setUser(null);
    setScreen('login');
    await officeSignOut();
  }

  if (screen === 'loading') return <div style={{ position: 'fixed', inset: 0, background: '#1f72c4' }} />;
  if (screen === 'link' && link) {
    return (
      <OfficeSetPassword
        kind={link.kind} token={link.token}
        onDone={() => { closeLink(); enter(); }}
        onCancel={() => { closeLink(); enter(); }}
      />
    );
  }
  if (screen === 'login') return <OfficeLogin notice={notice} onSignedIn={enter} onLegacy={() => setScreen('legacy')} />;
  if (screen === 'legacy') return <PasswordGate onUnlock={handleUnlock} />;
  if (screen === 'name') return <NamePrompt onName={name => { setUser(legacyAdmin(name)); setScreen('ready'); }} />;
  if (mkAccess) return <MkOffice access={mkAccess} onLogout={logout} />;
  if (!user) return null;
  return <OfficeShell user={user} onLogout={logout} />;
}
