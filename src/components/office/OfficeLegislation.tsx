'use client';

import { useEffect, useMemo, useState } from 'react';
import { getOfficeData, setOfficeAssignment, OfficeData, OfficeItem } from '@/lib/office';
import { exposureParties, partyColor } from './parties';
import { safeUrl } from '@/lib/urls';
import BotAsk from './BotAsk';
import { lawQuestions } from './botQuestions';
import s from './Office.module.css';

// רמזור חקיקה — the organization's products (bills, gov decisions, other) as
// headlines grouped by chapter: readiness light, type, and which MKs received
// each one. Products come from the Excel workbook (update-legislation.py);
// the EXPOSURE of products to MKs is decided HERE, on the site: pick a party
// (the change-bloc parties and the Arab parties only), then an MK from its
// list. The office users of an exposed MK see that product.
//
// There is no separate prompt: the database looks at the signed-in user and
// decides what they may see — an admin everything, an office only the
// products exposed to its MK ("החוקים שלנו", read-only).

type Assignee = { name: string; party: string };

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

type StatusFilter = 'all' | 'ready' | 'notready' | 'assigned';
type Phase = 'loading' | 'ready' | 'denied' | 'setup' | 'error';

export default function OfficeLegislation() {
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
  const [pickParty, setPickParty] = useState(''); // step 1 of exposing the open product

  useEffect(() => {
    let cancelled = false;
    // getOfficeData never hangs: it resolves with an error after a timeout
    getOfficeData().then(res => {
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
  }, [attempt]);

  const retry = () => { setPhase('loading'); setAttempt(a => a + 1); };

  const isAdmin = data?.role === 'admin';
  const canAssign = isAdmin && (data?.v ?? 1) >= 2;
  const items = useMemo(() => data?.items ?? [], [data]);
  const parties = useMemo(() => exposureParties(data?.mks ?? []), [data]);

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
    const ok = await setOfficeAssignment(it.name, mkName, on);
    if (!ok) {
      apply(!on);
      setAssignErr('החשיפה לא נשמרה. נסו שוב.');
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
          החשבון שאיתו נכנסת אינו רשום בלשכה. פונים למנהל/ת הלשכה.
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
        <h1>{isAdmin ? 'רמזור חקיקה' : 'החוקים שלנו'}</h1>
        {!isAdmin && data.name && <span className={s.mastDate}>{data.name}</span>}
        <div className={`${s.mastTools} ${s.stats}`}>
          <span><b>{items.length}</b> תוצרים</span>
          <span><span className={`${s.light} ${s.lgreen}`} /> <b>{readyCount}</b> מוכנים</span>
          {isAdmin && <span><b>{assignedCount}</b> נחשפו לח&quot;כים</span>}
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
            <option value="assigned">נחשף לח&quot;כ</option>
          </select>
          <select value={mk} onChange={e => setMk(e.target.value)} aria-label='ח"כ'>
            <option value="">כל הח&quot;כים</option>
            {assignedMks.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      <div className={s.tbl}>
        {chapters.length === 0 && (
          <div className={s.none}>{isAdmin ? 'אין תוצרים תואמים' : 'עדיין לא שותפו חוקים עם הלשכה'}</div>
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
                    <button type="button" className={s.item} onClick={() => { setAssignErr(''); setPickParty(''); setOpenItem(expanded ? null : it.id); }}>
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
                            <div className={s.lbl}>חשיפה לח&quot;כים</div>
                            {who.length > 0 && (
                              <div className={s.assignRow}>
                                {who.map(a => (
                                  <span key={a.name} className={s.mk} style={{ ['--c' as string]: partyColor(a.party) }} title={a.party}>
                                    {a.name}
                                    {canAssign && (
                                      <button type="button" aria-label={`הסרת ${a.name}`} title="הסרה" onClick={() => setAssigned(it, a.name, false)}>×</button>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                            {canAssign ? (
                              <>
                                <div className={s.assignRow}>
                                  {parties.map(p => (
                                    <button
                                      key={p.party} type="button"
                                      className={`${s.pChip} ${pickParty === p.party ? s.pChipOn : ''}`}
                                      style={{ ['--c' as string]: partyColor(p.party) }}
                                      aria-pressed={pickParty === p.party}
                                      onClick={() => setPickParty(pickParty === p.party ? '' : p.party)}
                                    >
                                      {p.party}
                                    </button>
                                  ))}
                                </div>
                                {pickParty && (
                                  <div className={s.inline}>
                                    <select
                                      value="" aria-label={`בחירת ח"כ מתוך ${pickParty}`}
                                      onChange={e => { if (e.target.value) setAssigned(it, e.target.value, true); }}
                                    >
                                      <option value="">בחירת ח&quot;כ מתוך {pickParty}</option>
                                      {(parties.find(p => p.party === pickParty)?.mks ?? [])
                                        .filter(m => !who.some(a => a.name === m.name))
                                        .map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                    </select>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div>בחירת הח&quot;כים מהאתר תיפתח אחרי עדכון חד-פעמי של מסד הנתונים.</div>
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
        <span>{isAdmin ? 'תוצרים: אקסל מיפוי חברי הכנסת' : 'תוצרים של בונים מחדש'}{updated && <> · עודכן <span dir="ltr">{updated}</span></>}</span>
        {isAdmin && <span>חשיפה לח&quot;כים: נקבעת כאן באתר</span>}
      </div>
    </>
  );
}
