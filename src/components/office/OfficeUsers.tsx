'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { getOfficeData, listOfficeUsers, manageOfficeUsers, OfficeMk, OfficeUserRow } from '@/lib/office';
import { exposureParties, partyColor } from './parties';
import OfficeVisits from './OfficeVisits';
import s from './Office.module.css';

// ניהול משתמשים — admins only. Two kinds of users: an admin (sees everything)
// and an office, named after its MK (sees the laws exposed to that MK and the
// public sections). Several people can share one office, each with their own
// email and password.
//
// There is no mail service: creating a user — or asking for a new link for
// one who forgot their password — returns a one-time link that the admin
// passes on by WhatsApp or email. The link is shown once and never stored.

type FormKind = 'office' | 'admin' | null;
interface Issued { name: string; email: string; link: string; isNew: boolean }

const dateOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '';

// The section has two views: the users, and the entry log (who entered, when
// and for how long, by office).
export default function OfficeUsers() {
  const [view, setView] = useState<'users' | 'visits'>('users');
  const seg = (
    <div className={s.seg}>
      <button type="button" className={view === 'users' ? s.on : ''} onClick={() => setView('users')}>משתמשים</button>
      <button type="button" className={view === 'visits' ? s.on : ''} onClick={() => setView('visits')}>יומן כניסות</button>
    </div>
  );
  return view === 'visits' ? <OfficeVisits seg={seg} /> : <UsersList seg={seg} />;
}

function UsersList({ seg }: { seg: ReactNode }) {
  const [users, setUsers] = useState<OfficeUserRow[] | null>(null);
  const [me, setMe] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [mks, setMks] = useState<OfficeMk[]>([]);
  const [tick, setTick] = useState(0);

  const [form, setForm] = useState<FormKind>(null);
  const [party, setParty] = useState('');
  const [mk, setMk] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOfficeUsers().then(res => {
      if (cancelled) return;
      if (!res) { setPhase('denied'); return; }
      setUsers(res.users);
      setMe(res.me);
      setPhase('ready');
    });
    return () => { cancelled = true; };
  }, [tick]);

  useEffect(() => {
    let cancelled = false;
    getOfficeData().then(res => { if (!cancelled && res.status === 'ok') setMks(res.data.mks ?? []); });
    return () => { cancelled = true; };
  }, []);

  const parties = useMemo(() => exposureParties(mks), [mks]);

  function openForm(kind: FormKind) {
    setForm(form === kind ? null : kind);
    setParty(''); setMk(''); setName(''); setEmail(''); setErr('');
  }

  async function create() {
    if (busy || !form) return;
    const n = name.trim(), e = email.trim().toLowerCase();
    if (form === 'office' && !mk) { setErr('בוחרים מפלגה ואז ח"כ'); return; }
    if (!n) { setErr('חסר שם'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setErr('כתובת המייל לא תקינה'); return; }
    setBusy(true); setErr('');
    const res = await manageOfficeUsers(
      form === 'office' ? { action: 'invite', role: 'office', email: e, name: n, mk } : { action: 'invite', role: 'admin', email: e, name: n },
    );
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setIssued({ name: n, email: e, link: res.link ?? '', isNew: true });
    setCopied(false);
    setForm(null);
    setTick(t => t + 1);
  }

  async function newLink(u: OfficeUserRow) {
    if (busy) return;
    setBusy(true); setErr('');
    const res = await manageOfficeUsers({ action: 'link', id: u.id });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setIssued({ name: u.name, email: u.email, link: res.link ?? '', isNew: !u.active });
    setCopied(false);
    window.scrollTo(0, 0);
  }

  async function remove(u: OfficeUserRow) {
    if (busy) return;
    setBusy(true); setErr('');
    const res = await manageOfficeUsers({ action: 'remove', id: u.id });
    setBusy(false);
    setConfirmDel(null);
    if (!res.ok) setErr(res.error);
    else setOpen(null);
    setTick(t => t + 1);
  }

  async function copyMessage() {
    if (!issued) return;
    const text = [
      `שלום ${issued.name},`,
      issued.isNew ? 'נפתח עבורך חשבון ב"הלשכה" של בונים מחדש.' : 'זה קישור לקביעת סיסמה חדשה ב"הלשכה" של בונים מחדש.',
      'לקביעת הסיסמה (הקישור תקף ל-24 שעות ולשימוש אחד):',
      issued.link,
      `אחרי כן נכנסים עם המייל ${issued.email} בכתובת ${window.location.origin}`,
    ].join('\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { setErr('ההעתקה נחסמה. אפשר לסמן את הקישור ולהעתיק ידנית.'); }
  }

  if (phase === 'loading') return <div className={s.none}>טוען…</div>;
  if (phase === 'denied' || !users) {
    return (
      <div className={s.notice}>
        <h2>ניהול המשתמשים לא זמין</h2>
        <p>המסך פתוח למנהלים שנכנסו עם חשבון אישי (מייל וסיסמה).</p>
      </div>
    );
  }

  const admins = users.filter(u => u.role === 'admin').length;

  return (
    <>
      <div className={s.mast}>
        <h1>ניהול משתמשים</h1>
        <div className={`${s.mastTools} ${s.stats}`}>
          <span><b>{admins}</b> מנהלים</span>
          <span><b>{users.length - admins}</b> משתמשי לשכות</span>
          {seg}
          <button type="button" className={s.btn} onClick={() => openForm('admin')}>{form === 'admin' ? 'סגור' : '+ מנהל'}</button>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => openForm('office')}>{form === 'office' ? 'סגור' : '+ לשכה'}</button>
        </div>
      </div>

      {form && (
        <div className={s.uForm}>
          {form === 'office' && (
            <>
              <div className={s.assignRow}>
                {parties.map(p => (
                  <button
                    key={p.party} type="button"
                    className={`${s.pChip} ${party === p.party ? s.pChipOn : ''}`}
                    style={{ ['--c' as string]: partyColor(p.party) }}
                    aria-pressed={party === p.party}
                    onClick={() => { setParty(p.party); setMk(''); }}
                  >
                    {p.party}
                  </button>
                ))}
                {parties.length === 0 && <span className={s.none}>רשימת הח&quot;כים לא נטענה</span>}
              </div>
              {party && (
                <div className={s.inline}>
                  <select value={mk} onChange={e => setMk(e.target.value)} aria-label={`בחירת ח"כ מתוך ${party}`}>
                    <option value="">בחירת ח&quot;כ מתוך {party}</option>
                    {(parties.find(p => p.party === party)?.mks ?? []).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          <div className={s.inline}>
            <input placeholder={form === 'office' ? 'שם המשתמש/ת בלשכה' : 'שם המנהל/ת'} value={name} onChange={e => setName(e.target.value)} aria-label="שם" />
            <input
              placeholder="מייל" dir="ltr" type="email" value={email} aria-label="מייל"
              onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }}
            />
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={create} disabled={busy}>
              {busy ? 'יוצר…' : 'יצירת משתמש וקישור'}
            </button>
          </div>
        </div>
      )}

      {issued && (
        <div className={s.linkBox}>
          <div className={s.linkTitle}>קישור חד-פעמי עבור {issued.name} · <span dir="ltr">{issued.email}</span></div>
          <div className={s.inline}>
            <input readOnly dir="ltr" value={issued.link} onFocus={e => e.target.select()} aria-label="הקישור" />
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={copyMessage}>{copied ? 'הועתק ✓' : 'העתק הודעה לשליחה'}</button>
            <button type="button" className={s.btn} onClick={() => setIssued(null)}>סגור</button>
          </div>
          <div className={s.linkNote}>תקף ל-24 שעות ולשימוש אחד. שולחים בוואטסאפ או במייל. הקישור לא נשמר ולא יוצג שוב.</div>
        </div>
      )}
      {err && <div className={s.err}>{err}</div>}

      <div className={s.tbl}>
        <div className={`${s.bHead} ${s.uGrid}`}>
          <div>שם</div><div>מייל</div><div>תפקיד</div><div>מצב</div>
        </div>
        {users.map(u => {
          const expanded = open === u.id;
          const toggle = () => { setOpen(expanded ? null : u.id); setConfirmDel(null); };
          return (
            <div key={u.id}>
              <div
                className={`${s.bRow} ${s.uGrid}`} role="button" tabIndex={0} aria-expanded={expanded}
                onClick={toggle}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } }}
              >
                <span className={s.bMin}>{u.name || '—'}{u.id === me && <span className={s.uMe}> (אני)</span>}</span>
                <span className={s.uMail} dir="ltr">{u.email}</span>
                <span className={s.uRole}>
                  {u.role === 'admin' ? 'מנהל/ת' : (
                    <>
                      <span className={s.dot} style={{ ['--c' as string]: partyColor(u.party ?? '') }} />
                      לשכת ח&quot;כ {u.mk}
                    </>
                  )}
                </span>
                <span className={u.active ? s.uOn : s.uWait}>{u.active ? 'פעיל' : 'ממתין לקביעת סיסמה'}</span>
              </div>
              {expanded && (
                <div className={s.detail}>
                  <div>
                    {u.role === 'office' && u.party ? `${u.party} · ` : ''}
                    {u.last_sign_in ? `כניסה אחרונה ${dateOf(u.last_sign_in)}` : 'עדיין לא נכנס/ה'}
                    {` · נוצר ${dateOf(u.created_at)}`}
                  </div>
                  <div className={s.inline} style={{ marginTop: 10 }}>
                    <button type="button" className={s.btn} onClick={() => newLink(u)} disabled={busy}>
                      {u.active ? 'קישור לסיסמה חדשה' : 'קישור חדש'}
                    </button>
                    {u.id !== me && confirmDel !== u.id && (
                      <button type="button" className={s.btn} onClick={() => setConfirmDel(u.id)}>הסרה</button>
                    )}
                    {confirmDel === u.id && (
                      <>
                        <span>להסיר את {u.name || u.email}? הגישה נסגרת מיד.</span>
                        <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => remove(u)} disabled={busy}>כן, להסיר</button>
                        <button type="button" className={s.btn} onClick={() => setConfirmDel(null)}>ביטול</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className={s.meta}>
        <span>אין הרשמה עצמית: רק מי שמופיע כאן יכול להיכנס</span>
        <span>לשכה רואה את החוקים שנחשפו לח&quot;כ שלה ואת המדורים הציבוריים, לקריאה בלבד</span>
      </div>
    </>
  );
}
