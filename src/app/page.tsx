'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { OfficeLogin, OfficeSetPassword } from '@/components/office/OfficeLogin';
import { supabase } from '@/lib/supabase';
import { getOfficeMe, LinkKind, officeSignOut, OfficeUser, officeVisit } from '@/lib/office';

// הלשכה — the site is one workspace behind a personal account:
//   sign in (email + password)  →  the office, by role (admin / office).
// A one-time link from an admin (…/#invite=<token> or …/#reset=<token>) opens
// the set-password screen instead. The session is kept in the browser, so a
// returning user goes straight in. There is no other way in: the shared
// password and the MK personal codes were switched off on 24.11.2026.
// The office itself is code-split so the sign-in screen loads instantly.
// (The election-period tabs were retired on 15.11.2026; their components stay
// in the repo as an archive but nothing renders them.)
const OfficeShell = dynamic(() => import('@/components/office/OfficeShell'), { loading: () => null });

type Screen = 'loading' | 'login' | 'link' | 'ready';

const NOT_REGISTERED = 'החשבון הזה אינו רשום בלשכה. פונים למנהל/ת הלשכה.';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [user, setUser] = useState<OfficeUser | null>(null);
  const [link, setLink] = useState<{ kind: LinkKind; token: string } | null>(null);
  const [notice, setNotice] = useState('');
  // True while the office is open
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

  // Entry log: a sign of life about once a minute while the office is open and
  // the tab is visible. The database decides who it is.
  const logging = screen === 'ready' && !!user;
  useEffect(() => {
    if (!logging) return;
    let visit: string | null = null;
    let stopped = false;
    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      const id = await officeVisit(visit);
      if (!stopped && id) visit = id;
    };
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    beat();
    const timer = setInterval(beat, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [logging]);

  function closeLink() {
    window.history.replaceState(null, '', window.location.pathname);
    setLink(null);
  }

  async function logout() {
    signedIn.current = false;
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
  if (screen === 'login' || !user) return <OfficeLogin notice={notice} onSignedIn={enter} />;
  return <OfficeShell user={user} onLogout={logout} />;
}
