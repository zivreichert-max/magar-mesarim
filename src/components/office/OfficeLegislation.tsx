'use client';

import { useEffect, useMemo, useState } from 'react';
import { getOfficeData, OfficeData, OfficeItem } from '@/lib/supabase';
import { CLIENTS } from '@/data/clients';
import { safeUrl } from '@/lib/urls';
import s from './Office.module.css';

// רמזור חקיקה — the organization's products (bills, gov decisions, other) as
// headlines grouped by chapter: readiness light, type, and which MK received
// each one. Source of truth is the Excel workbook; update-legislation.py syncs
// it into protected Supabase tables, read here through an access key.
//
// `fixedKey` = an MK's personal code (MK view: only their own products).
// Without it this is the admin view, which asks once for the office key.

const KEY_STORE = 'office_key';

const PARTY_COLS = [
  { col: 'mk_yashar', id: 'yashar' },
  { col: 'mk_beyahad', id: 'beyahad' },
  { col: 'mk_democrats', id: 'democrats' },
  { col: 'mk_beitenu', id: 'yisrael-b' },
] as const;

const partyColor = (id: string) => CLIENTS.find(c => c.id === id)?.color ?? '#6b7280';
const partyName = (id: string) => CLIENTS.find(c => c.id === id)?.name ?? id;

function assignees(it: OfficeItem): { name: string; party: string }[] {
  return PARTY_COLS
    .map(p => ({ name: (it[p.col] ?? '').trim(), party: p.id }))
    .filter(a => a.name);
}

const lightOf = (it: OfficeItem) => (it.ready === 'כן' ? s.lgreen : it.ready === 'לא' ? s.lred : s.lgray);
const kindOf = (it: OfficeItem) => it.kind || 'אחר';

type StatusFilter = 'all' | 'ready' | 'notready' | 'assigned';

export default function OfficeLegislation({ fixedKey }: { fixedKey?: string }) {
  const [key, setKey] = useState<string>(() =>
    fixedKey ?? (typeof window !== 'undefined' ? (localStorage.getItem(KEY_STORE) ?? '') : '')
  );
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'nokey' | 'loading' | 'ready' | 'badkey' | 'setup' | 'error'>(key ? 'loading' : 'nokey');
  const [data, setData] = useState<OfficeData | null>(null);
  const [errMsg, setErrMsg] = useState('');

  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [mk, setMk] = useState('');
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [openItem, setOpenItem] = useState<number | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    getOfficeData(key).then(res => {
      if (cancelled) return;
      if (res.status === 'ok') {
        setData(res.data);
        setPhase('ready');
        if (!fixedKey) { try { localStorage.setItem(KEY_STORE, key); } catch { /* ignore */ } }
      } else if (res.status === 'badkey') {
        if (!fixedKey) { try { localStorage.removeItem(KEY_STORE); } catch { /* ignore */ } }
        setPhase('badkey');
      } else if (res.status === 'setup') {
        setPhase('setup');
      } else {
        setErrMsg(res.message);
        setPhase('error');
      }
    });
    return () => { cancelled = true; };
  }, [key, fixedKey]);

  function submitKey() {
    const k = draft.trim().toUpperCase(); // generated keys are uppercase
    if (!k) return;
    setPhase('loading');
    setKey(k);
  }

  const isAdmin = data?.role === 'admin';
  const items = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return items.filter(it => {
      if (kind !== 'all' && kindOf(it) !== kind) return false;
      if (status === 'ready' && it.ready !== 'כן') return false;
      if (status === 'notready' && it.ready !== 'לא') return false;
      const who = assignees(it);
      if (status === 'assigned' && who.length === 0) return false;
      if (mk && !who.some(a => a.name === mk)) return false;
      if (q && !`${it.name} ${it.essence} ${it.chapter}`.includes(q)) return false;
      return true;
    });
  }, [items, search, kind, status, mk]);

  const chapters = useMemo(() => {
    const map = new Map<string, OfficeItem[]>();
    for (const it of filtered) {
      const c = it.chapter || 'ללא פרק';
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(it);
    }
    return [...map.entries()];
  }, [filtered]);

  // Any active filter (or the short MK view) opens every chapter
  const filtering = !!(search.trim() || kind !== 'all' || status !== 'all' || mk);
  const allOpen = filtering || !isAdmin;

  if (phase === 'loading') return <div className={s.none}>טוען…</div>;

  if (phase === 'setup') {
    return (
      <div className={s.gate}>
        <h2>נדרשת הגדרה חד-פעמית</h2>
        <p>
          רמזור החקיקה נשמר במסד נתונים מוגן. כדי להפעיל אותו: להריץ פעם אחת ב-Supabase (SQL editor) את הקובץ{' '}
          <span className={s.code}>supabase-office.sql</span>, ואז להריץ{' '}
          <span className={s.code}>py update-legislation.py</span>.
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return <div className={s.gate}><h2>שגיאה בטעינה</h2><p>{errMsg}</p></div>;
  }

  if (phase === 'nokey' || phase === 'badkey' || !data) {
    return (
      <div className={s.gate}>
        <h2>רמזור חקיקה</h2>
        <p>{phase === 'badkey' ? 'הקוד לא זוהה. נסו שוב.' : 'הזינו את מפתח הלשכה (פעם אחת במכשיר הזה).'}</p>
        <div className={s.gateRow}>
          <input
            type="password" value={draft} autoFocus aria-label="מפתח לשכה"
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitKey(); }}
          />
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={submitKey}>כניסה</button>
        </div>
      </div>
    );
  }

  const readyCount = items.filter(i => i.ready === 'כן').length;
  const assignedCount = items.filter(i => assignees(i).length > 0).length;
  const kinds = [...new Set(items.map(kindOf))];
  const updated = data.updated ? data.updated.replace('T', ' ').replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3.$2.$1') : '';

  return (
    <>
      <div className={s.mast}>
        <h1>{isAdmin ? 'רמזור חקיקה' : 'התוצרים שלי'}</h1>
        {!isAdmin && data.name && <span className={s.mastDate}>{data.name}</span>}
        <div className={`${s.mastTools} ${s.stats}`}>
          <span><b>{items.length}</b> תוצרים</span>
          <span><span className={`${s.light} ${s.lgreen}`} /> <b>{readyCount}</b> מוכנים</span>
          {isAdmin && <span><b>{assignedCount}</b> שויכו לח&quot;כ</span>}
        </div>
      </div>

      {isAdmin && (
        <div className={s.filters}>
          <input placeholder="חיפוש" value={search} onChange={e => setSearch(e.target.value)} aria-label="חיפוש" />
          <select value={kind} onChange={e => setKind(e.target.value)} aria-label="סוג תוצר">
            <option value="all">כל הסוגים</option>
            {kinds.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value as StatusFilter)} aria-label="סטטוס">
            <option value="all">כל הסטטוסים</option>
            <option value="ready">מוכן להנחה</option>
            <option value="notready">לא מוכן</option>
            <option value="assigned">שויך לח&quot;כ</option>
          </select>
          <select value={mk} onChange={e => setMk(e.target.value)} aria-label='ח"כ'>
            <option value="">כל הח&quot;כים</option>
            {CLIENTS.map(c => {
              const list = (data.mks ?? []).filter(m => m.party === c.id);
              return list.length > 0 && (
                <optgroup key={c.id} label={c.name}>
                  {list.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </optgroup>
              );
            })}
          </select>
        </div>
      )}

      <div className={s.tbl}>
        {chapters.length === 0 && (
          <div className={s.none}>{isAdmin ? 'אין תוצרים תואמים' : 'עדיין לא שויכו אליך תוצרים'}</div>
        )}
        {chapters.map(([chapter, list]) => {
          const open = allOpen || openChapters.has(chapter);
          const g = list.filter(i => i.ready === 'כן').length;
          const r = list.filter(i => i.ready === 'לא').length;
          return (
            <div key={chapter}>
              <button
                type="button"
                className={`${s.chap} ${open ? s.chapOpen : ''}`}
                onClick={() => setOpenChapters(prev => {
                  const next = new Set(prev);
                  if (next.has(chapter)) next.delete(chapter); else next.add(chapter);
                  return next;
                })}
              >
                <span className={s.chev2}>‹</span>
                <span className={s.chapName}>{chapter}</span>
                <span className={s.chapCount}>{list.length}</span>
                <span className={s.chapLights}>
                  <span><span className={`${s.light} ${s.lgreen}`} /> {g}</span>
                  <span><span className={`${s.light} ${s.lred}`} /> {r}</span>
                </span>
              </button>
              {open && list.map(it => {
                const who = assignees(it);
                const expanded = openItem === it.id;
                const link = safeUrl(it.link);
                return (
                  <div key={it.id}>
                    <button type="button" className={s.item} onClick={() => setOpenItem(expanded ? null : it.id)}>
                      <span className={`${s.light} ${lightOf(it)}`} title={it.ready === 'כן' ? 'מוכן להנחה' : it.ready === 'לא' ? 'לא מוכן' : 'לא סומן'} />
                      <span className={s.itemName}>
                        {it.name}
                        {it.undo && <span className={s.undo}>UNDO</span>}
                      </span>
                      <span className={s.itemTags}>
                        {who.map(a => (
                          <span key={a.party} className={s.mk} style={{ ['--c' as string]: partyColor(a.party) }} title={partyName(a.party)}>
                            {a.name}
                          </span>
                        ))}
                        <span className={s.kind}>{kindOf(it)}</span>
                      </span>
                    </button>
                    {expanded && (
                      <div className={s.detail}>
                        {it.essence && (<><div className={s.lbl}>מהות</div><div>{it.essence}</div></>)}
                        {it.missing && (<><div className={s.lbl}>מה חסר</div><div>{it.missing}</div></>)}
                        {it.notes && (<><div className={s.lbl}>הערות</div><div>{it.notes}</div></>)}
                        {!it.essence && !it.missing && !it.notes && !link && <div>אין פירוט נוסף.</div>}
                        {link && <a href={link} target="_blank" rel="noopener noreferrer">פתיחת המסמך ↗</a>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className={s.meta}>
        <span>מקור: אקסל מיפוי חברי הכנסת{updated && <> · עודכן <span dir="ltr">{updated}</span></>}</span>
        {isAdmin && (
          <button
            type="button" className={s.del} style={{ fontSize: 11.5 }}
            onClick={() => { try { localStorage.removeItem(KEY_STORE); } catch { /* ignore */ } setData(null); setKey(''); setPhase('nokey'); }}
          >
            החלפת מפתח
          </button>
        )}
      </div>
    </>
  );
}
