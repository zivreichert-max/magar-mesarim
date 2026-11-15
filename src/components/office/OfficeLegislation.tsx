'use client';

import { useEffect, useMemo, useState } from 'react';
import { getOfficeData, setOfficeAssignment, OfficeData, OfficeItem, OfficeMk } from '@/lib/supabase';
import { safeUrl } from '@/lib/urls';
import BotAsk from './BotAsk';
import { lawQuestions } from './botQuestions';
import s from './Office.module.css';

// רמזור חקיקה — the organization's products (bills, gov decisions, other) as
// headlines grouped by chapter: readiness light, type, and which MKs received
// each one. Products come from the Excel workbook (update-legislation.py);
// the assignment of products to MKs is made HERE, on the site.
//
// There is no separate prompt: whoever is logged in passes their own
// credential as `accessKey` (the admin password, or an MK's personal code) and
// the database decides what they may see — everything, or only their products.

type Assignee = { name: string; party: string };

// Party → chip color. Accepts both the Hebrew party names of the MK directory
// and the legacy party ids. Order matters: "ישראל ביתנו" must match before "ישר".
const PARTY_COLORS: [RegExp, string][] = [
  [/דמוקרט|democrats/, '#dc2626'],
  [/ביחד|beyahad/, '#16a34a'],
  [/ביתנו|yisrael-b/, '#1d4ed8'],
  [/^ישר|yashar/, '#6b7280'],
];
const partyColor = (party: string) => PARTY_COLORS.find(([re]) => re.test(party))?.[1] ?? '#9ca3af';

// v1 fallback (before the database update): assignments came as Excel columns
const LEGACY_COLS = [
  { col: 'mk_yashar', party: 'yashar' },
  { col: 'mk_beyahad', party: 'beyahad' },
  { col: 'mk_democrats', party: 'democrats' },
  { col: 'mk_beitenu', party: 'yisrael-b' },
] as const;

function assignees(it: OfficeItem): Assignee[] {
  if (it.assigned) return it.assigned;
  return LEGACY_COLS
    .map(p => ({ name: (it[p.col] ?? '').trim(), party: p.party }))
    .filter(a => a.name);
}

const lightOf = (it: OfficeItem) => (it.ready === 'כן' ? s.lgreen : it.ready === 'לא' ? s.lred : s.lgray);
const kindOf = (it: OfficeItem) => it.kind || 'אחר';

// MKs grouped by party for the "assign" menu — the partner bloc first
const BLOC_ORDER = ['גוש השינוי', 'המפלגות הערביות', 'גוש נתניהו'];
function groupMks(mks: OfficeMk[]): { party: string; mks: OfficeMk[] }[] {
  const groups: { party: string; bloc: string; mks: OfficeMk[] }[] = [];
  for (const m of mks) {
    let g = groups.find(x => x.party === m.party);
    if (!g) { g = { party: m.party, bloc: m.bloc ?? '', mks: [] }; groups.push(g); }
    g.mks.push(m);
  }
  const rank = (bloc: string) => { const i = BLOC_ORDER.indexOf(bloc); return i < 0 ? BLOC_ORDER.length : i; };
  return groups.sort((a, b) => rank(a.bloc) - rank(b.bloc));
}

type StatusFilter = 'all' | 'ready' | 'notready' | 'assigned';
type Phase = 'loading' | 'ready' | 'denied' | 'setup' | 'error';

export default function OfficeLegislation({ accessKey }: { accessKey: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<OfficeData | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [attempt, setAttempt] = useState(0); // bumped by "נסה שוב"
  const [assignErr, setAssignErr] = useState('');

  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [mk, setMk] = useState('');
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [openItem, setOpenItem] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // getOfficeData never hangs: it resolves with an error after a timeout
    getOfficeData(accessKey).then(res => {
      if (cancelled) return;
      if (res.status === 'ok') {
        setData(res.data);
        setPhase('ready');
      } else if (res.status === 'badkey') {
        setPhase('denied');
      } else if (res.status === 'setup') {
        setPhase('setup');
      } else {
        setErrMsg(res.message);
        setPhase('error');
      }
    });
    return () => { cancelled = true; };
  }, [accessKey, attempt]);

  const retry = () => { setPhase('loading'); setAttempt(a => a + 1); };

  const isAdmin = data?.role === 'admin';
  const canAssign = isAdmin && (data?.v ?? 1) >= 2;
  const items = useMemo(() => data?.items ?? [], [data]);
  const mkGroups = useMemo(() => groupMks(data?.mks ?? []), [data]);

  // MKs that already hold at least one product — the filter menu
  const assignedMks = useMemo(() => {
    const names = new Set<string>();
    for (const it of items) for (const a of assignees(it)) names.add(a.name);
    return [...names].sort((a, b) => a.localeCompare(b, 'he'));
  }, [items]);

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

  // Attach / detach an MK: update the screen at once, then save; roll back
  // if the save fails so the screen never shows something that was not stored
  async function setAssigned(it: OfficeItem, mkName: string, on: boolean) {
    setAssignErr('');
    const party = data?.mks?.find(m => m.name === mkName)?.party ?? '';
    const apply = (add: boolean) => setData(prev => prev && {
      ...prev,
      items: prev.items.map(x => {
        if (x.id !== it.id) return x;
        const cur = assignees(x).filter(a => a.name !== mkName);
        return { ...x, assigned: add ? [...cur, { name: mkName, party }] : cur };
      }),
    });
    apply(on);
    const ok = await setOfficeAssignment(accessKey, it.name, mkName, on);
    if (!ok) {
      apply(!on);
      setAssignErr('השיוך לא נשמר. נסו שוב.');
    }
  }

  // Any active filter (or the short MK view) opens every chapter
  const filtering = !!(search.trim() || kind !== 'all' || status !== 'all' || mk);
  const allOpen = filtering || !isAdmin;

  if (phase === 'loading') return <div className={s.none}>טוען…</div>;

  if (phase === 'setup') {
    return (
      <div className={s.notice}>
        <h2>נדרשת הגדרה חד-פעמית</h2>
        <p>
          רמזור החקיקה נשמר במסד נתונים מוגן. כדי להפעיל אותו: להריץ פעם אחת ב-Supabase (SQL editor) את הקובץ{' '}
          <span className={s.code}>supabase-office.sql</span>, ואז להריץ{' '}
          <span className={s.code}>py update-legislation.py</span>.
        </p>
      </div>
    );
  }

  if (phase === 'denied') {
    return (
      <div className={s.notice}>
        <h2>הרמזור לא זמין בכניסה הזו</h2>
        <p>
          הסיסמה שאיתה נכנסת לא מחוברת לרמזור. כדי לחבר את סיסמת המנהל יש להריץ{' '}
          <span className={s.code}>py update-legislation.py</span>.
        </p>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={retry}>נסה שוב</button>
      </div>
    );
  }

  if (phase === 'error' || !data) {
    return (
      <div className={s.notice}>
        <h2>הרמזור לא נטען</h2>
        <p>{errMsg || 'שגיאה לא צפויה'}</p>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={retry}>נסה שוב</button>
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
            {assignedMks.map(n => <option key={n} value={n}>{n}</option>)}
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
            <div key={chapter} className={s.chapWrap}>
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
                    <button type="button" className={s.item} onClick={() => { setAssignErr(''); setOpenItem(expanded ? null : it.id); }}>
                      <span className={`${s.light} ${lightOf(it)}`} title={it.ready === 'כן' ? 'מוכן להנחה' : it.ready === 'לא' ? 'לא מוכן' : 'לא סומן'} />
                      <span className={s.itemName}>
                        {it.name}
                        {it.undo && <span className={s.undo}>UNDO</span>}
                      </span>
                      <span className={s.itemTags}>
                        {who.map(a => (
                          <span key={a.name} className={s.mk} style={{ ['--c' as string]: partyColor(a.party) }} title={a.party}>
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

                        {isAdmin && (
                          <>
                            <div className={s.lbl}>שיוך לח&quot;כ</div>
                            {canAssign ? (
                              <div className={`${s.assignRow} ${s.inline}`}>
                                {who.map(a => (
                                  <span key={a.name} className={s.mk} style={{ ['--c' as string]: partyColor(a.party) }} title={a.party}>
                                    {a.name}
                                    <button type="button" aria-label={`הסרת ${a.name}`} title="הסרה" onClick={() => setAssigned(it, a.name, false)}>×</button>
                                  </span>
                                ))}
                                <select value="" aria-label='שיוך ח"כ' onChange={e => { if (e.target.value) setAssigned(it, e.target.value, true); }}>
                                  <option value="">+ שיוך ח&quot;כ</option>
                                  {mkGroups.map(grp => (
                                    <optgroup key={grp.party} label={grp.party}>
                                      {grp.mks.filter(m => !who.some(a => a.name === m.name)).map(m => (
                                        <option key={m.name} value={m.name}>{m.name}</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div>שיוך מהאתר ייפתח אחרי עדכון חד-פעמי של מסד הנתונים.</div>
                            )}
                            {assignErr && <div className={s.err}>{assignErr}</div>}
                          </>
                        )}

                        {link && <div style={{ marginTop: 10 }}><a href={link} target="_blank" rel="noopener noreferrer">פתיחת המסמך ↗</a></div>}
                        {isAdmin && <BotAsk questions={lawQuestions(it)} />}
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
        <span>תוצרים: אקסל מיפוי חברי הכנסת{updated && <> · עודכן <span dir="ltr">{updated}</span></>}</span>
        {isAdmin && <span>שיוך לח&quot;כים: נעשה כאן באתר</span>}
      </div>
    </>
  );
}
