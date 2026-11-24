'use client';

import { FormEvent, useState } from 'react';
import Brand from './Brand';
import { LinkKind, officeOpenLink, officeSetPassword, officeSignIn } from '@/lib/office';
import s from './Office.module.css';

// The two screens in front of the office: sign in (email + password), and
// setting a password from a one-time link an admin passed on. There is no
// self sign-up and no "forgot password" mail — an admin issues a new link.

interface LoginProps {
  notice?: string;
  onSignedIn: () => void;
}

export function OfficeLogin({ notice, onSignedIn }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError('');
    const ok = await officeSignIn(email, password);
    setBusy(false);
    if (ok) onSignedIn();
    else setError('מייל או סיסמה שגויים');
  }

  return (
    <div className={s.gateScreen}>
      <form className={s.gateCard} onSubmit={submit}>
        <Brand />
        <label className={s.gateLabel} htmlFor="login-email">מייל</label>
        <input
          id="login-email" className={s.gateInput} type="email" dir="ltr" autoComplete="username"
          value={email} onChange={e => setEmail(e.target.value)} autoFocus required
        />
        <label className={s.gateLabel} htmlFor="login-password">סיסמה</label>
        <input
          id="login-password" className={s.gateInput} type="password" dir="ltr" autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)} required
        />
        <button type="submit" className={s.gateBtn} disabled={busy}>{busy ? 'נכנס…' : 'כניסה'}</button>
        <div className={s.gateErr} role="alert">{error || notice}</div>
        <div className={s.gateNote}>
          שכחת סיסמה, או שאין לך חשבון? מנהל/ת הלשכה שולחים קישור לקביעת סיסמה.
        </div>
      </form>
    </div>
  );
}

interface SetPasswordProps {
  kind: LinkKind;
  token: string;
  onDone: () => void;
  onCancel: () => void;
}

const MIN_LENGTH = 8;

export function OfficeSetPassword({ kind, token, onDone, onCancel }: SetPasswordProps) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The link is spent on the first submit; a failed password can be retried
  const [opened, setOpened] = useState(false);
  const [dead, setDead] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (pw.length < MIN_LENGTH) { setError(`הסיסמה צריכה להיות באורך ${MIN_LENGTH} תווים לפחות`); return; }
    if (pw !== pw2) { setError('שתי הסיסמאות אינן זהות'); return; }
    setBusy(true);
    setError('');
    if (!opened) {
      if (!(await officeOpenLink(kind, token))) { setBusy(false); setDead(true); return; }
      setOpened(true);
    }
    const err = await officeSetPassword(pw);
    setBusy(false);
    if (err) setError(err);
    else onDone();
  }

  if (dead) {
    return (
      <div className={s.gateScreen}>
        <div className={s.gateCard}>
          <Brand />
          <h1 className={s.gateTitle}>הקישור אינו בתוקף</h1>
          <div className={s.gateNote}>
            הקישור פג או שכבר נעשה בו שימוש. מבקשים קישור חדש ממנהל/ת הלשכה.
          </div>
          <button type="button" className={s.gateBtn} onClick={onCancel}>למסך הכניסה</button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.gateScreen}>
      <form className={s.gateCard} onSubmit={submit}>
        <Brand />
        <h1 className={s.gateTitle}>{kind === 'invite' ? 'קביעת סיסמה' : 'סיסמה חדשה'}</h1>
        <label className={s.gateLabel} htmlFor="new-password">סיסמה ({MIN_LENGTH} תווים לפחות)</label>
        <input
          id="new-password" className={s.gateInput} type="password" dir="ltr" autoComplete="new-password"
          value={pw} onChange={e => setPw(e.target.value)} autoFocus required
        />
        <label className={s.gateLabel} htmlFor="new-password-2">הסיסמה שוב</label>
        <input
          id="new-password-2" className={s.gateInput} type="password" dir="ltr" autoComplete="new-password"
          value={pw2} onChange={e => setPw2(e.target.value)} required
        />
        <button type="submit" className={s.gateBtn} disabled={busy}>{busy ? 'שומר…' : 'שמירה וכניסה'}</button>
        <div className={s.gateErr} role="alert">{error}</div>
      </form>
    </div>
  );
}
