'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import BotAsk from './BotAsk';
import { plenumQuestions } from './botQuestions';
import { safeUrl } from '@/lib/urls';
import s from './Office.module.css';

// מליאה — pick a date and see which bills come up in that plenum sitting and at
// which stage; once the sitting has taken place, what became of each bill.
// Fetched LIVE from the Knesset website's own API, straight from the browser
// (the API allows any origin): no sync and no table, so a sitting appears here
// the moment the Knesset enters it — including the PLANNED agenda, which the
// Knesset's public page hides until it is final.
//
// Nothing here is guessed. The stage is the heading the Knesset files the bill
// under. The result is read from the bill's own record on the Knesset site: a
// short label is shown only when that record leaves no doubt, otherwise the
// Knesset's status is shown word for word, and "לא ידוע" when there is none.

const API = 'https://www.knesset.gov.il/WebSiteApi/knessetapi/';
const AGENDA_PAGE = 'https://main.knesset.gov.il/apps/plenum';
const WEEKLY_PAGE = 'https://main.knesset.gov.il/Activity/plenum/Pages/WeeklyAgenda.aspx';
const BILL_PAGE = 'https://main.knesset.gov.il/apps/legislation/main/bills/';
const BILL_TYPE = 2; // the Knesset's item type of a bill

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

interface RawDate { StartTime?: string; FK_ItemID?: number; IsPublished?: boolean; IsDraft?: boolean }
interface RawTitle { FK_ItemID?: number; TitleId?: number; Title?: string; Ordinal?: number; FinishTime?: string | null }
interface RawItem {
  TitleId?: number; FK_ItemID?: number; ItemName?: string; LU_ItemType?: number; Ext1?: string;
  Initiators?: string; Summery?: string; CommitteeName?: string; SecretaryNotes?: string;
  DocPath?: string; IsActive?: boolean;
}
interface RawStep { FkItemId?: string | number; StepTitle?: string; RowOrigin?: string; StartDate?: string; ProtocolUrl?: string }
interface RawBill {
  general?: { Status?: string; ImageAlt?: string; CommitteeName?: string; Initiators?: string };
  sessionAndDocs?: { Sessions?: RawStep[] };
}

interface Sitting { id: number; iso: string; time: string; published: boolean }
type Stage = 'טרומית' | 'ראשונה' | 'שנייה-שלישית' | '';
interface Bill {
  id: number; name: string; number: string; stage: Stage; heading: string;
  initiators: string; summary: string; notes: string; doc: string | null; active: boolean;
}
interface Other { heading: string; items: { name: string; active: boolean }[] }
interface Agenda { ended: boolean; bills: Bill[]; others: Other[]; empty: boolean }
type BillInfo = RawBill | 'err';

const clean = (t?: string | null) => (t ?? '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const showDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}.${m}.${y}`; };
const dayName = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };
/** Today's date in Israel, whatever the computer's clock zone is. */
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
/** The Knesset's file links come with backslashes and a doubled slash. */
const fileUrl = (path?: string) => safeUrl(clean(path).replace(/\\/g, '/').replace(/([^:])\/\/+/g, '$1/'));

async function getJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(API + path, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Every sitting of a month. One call returns the week that holds the given date. */
async function loadMonth(y: number, m: number): Promise<Sitting[]> {
  const first = new Date(Date.UTC(y, m, 1, 12));
  const cursor = new Date(first);
  cursor.setUTCDate(1 - first.getUTCDay() + 2); // the Tuesday of the first week
  const calls: Promise<RawDate[]>[] = [];
  while (cursor.getUTCFullYear() < y || (cursor.getUTCFullYear() === y && cursor.getUTCMonth() <= m) || calls.length === 0) {
    calls.push(getJson<RawDate[]>(`Plenum/GetWeeklyDates?CurrentDate=${encodeURIComponent(cursor.toUTCString())}&Direction=&IsDraft=true`));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    if (calls.length > 6) break;
  }
  const seen = new Map<number, Sitting>();
  for (const week of await Promise.all(calls)) {
    for (const r of week ?? []) {
      // StartTime is Israel wall-clock time without a zone: read it as text
      const [iso, clock = ''] = String(r.StartTime ?? '').split('T');
      if (!r.FK_ItemID || !iso.startsWith(`${y}-${pad(m + 1)}`)) continue;
      seen.set(r.FK_ItemID, { id: r.FK_ItemID, iso, time: clock.slice(0, 5), published: r.IsPublished === true });
    }
  }
  return [...seen.values()].sort((a, b) => (a.iso + a.time).localeCompare(b.iso + b.time));
}

const stageOf = (heading: string): Stage =>
  /דיון מוקדם|טרומית/.test(heading) ? 'טרומית'
    : /קריאה ה?ראשונה/.test(heading) ? 'ראשונה'
      : /שנייה|שניה|שלישית/.test(heading) ? 'שנייה-שלישית' : '';

async function loadAgenda(sit: Sitting, today: string): Promise<Agenda> {
  const [titles, items] = await Promise.all([
    getJson<RawTitle[]>(`Plenum/GetAgendaPlenum?sessionDate=${sit.iso}T00:00:00.000Z&IsDraft=true`),
    getJson<RawItem[]>(`Plenum/GetSessionData?SessionId=${sit.id}`),
  ]);
  const mine = (titles ?? []).filter(t => t.FK_ItemID === sit.id).sort((a, b) => (a.Ordinal ?? 0) - (b.Ordinal ?? 0));
  const headingOf = new Map(mine.map(t => [t.TitleId, clean(t.Title)] as const));
  const bills: Bill[] = [];
  const others = new Map<string, Other>();
  for (const it of items ?? []) {
    const name = clean(it.ItemName);
    if (!name) continue;
    const heading = headingOf.get(it.TitleId) ?? '';
    const active = it.IsActive !== false;
    if (it.LU_ItemType === BILL_TYPE || /^הצעת חוק/.test(name)) {
      bills.push({
        id: it.FK_ItemID ?? 0, name, number: clean(it.Ext1).replace(/[\s-]+$/, ''), stage: stageOf(heading), heading,
        initiators: clean(it.Initiators).replace(/^של\s+/, ''), summary: clean(it.Summery), notes: clean(it.SecretaryNotes),
        doc: fileUrl(it.DocPath), active,
      });
    } else {
      const key = heading || name;
      if (!others.has(key)) others.set(key, { heading: key, items: [] });
      if (name !== key) others.get(key)!.items.push({ name, active });
    }
  }
  // Headings with no item under them (the sitting's standing items) still belong on the list
  for (const t of mine) {
    const h = clean(t.Title);
    if (h && !others.has(h) && !bills.some(b => b.heading === h)) others.set(h, { heading: h, items: [] });
  }
  return {
    ended: mine.some(t => !!t.FinishTime) || sit.iso < today,
    bills, others: [...others.values()], empty: mine.length === 0 && (items ?? []).length === 0,
  };
}

interface Outcome { kind: 'load' | 'unknown' | 'yes' | 'no' | 'status'; label: string; status: string; listed: boolean; protocol: string | null }

/** What the Knesset's record of the bill says happened, and nothing beyond it. */
function outcomeOf(bill: Bill, info: BillInfo | undefined, sit: Sitting): Outcome {
  const base = { label: '', status: '', listed: false, protocol: null };
  if (!info) return { ...base, kind: 'load' };
  if (info === 'err') return { ...base, kind: 'unknown' };
  const status = clean(info.general?.Status);
  const steps = (info.sessionAndDocs?.Sessions ?? []).filter(x => x.RowOrigin === 'PLM');
  const here = steps.find(x => String(x.FkItemId) === String(sit.id));
  const out = { ...base, status, listed: !!here, protocol: fileUrl(here?.ProtocolUrl) };
  if (!status) return { ...out, kind: 'unknown' };
  // A short label only when this sitting is on the bill's record and no later
  // plenum step exists that the status could be describing instead
  const start = here?.StartDate ?? '';
  const last = !!here && !steps.some(x => (x.StartDate ?? '') > start);
  const repeated = !!here && steps.some(x => (x.StartDate ?? '') > start && clean(x.StepTitle) === clean(here.StepTitle));
  if (last && /נדחתה|הוסרה מסדר|לא התקבלה|נפלה/.test(status)) return { ...out, kind: 'no', label: 'לא עברה' };
  if (last && bill.stage === 'שנייה-שלישית' && /התקבלה בקריאה ה?שלישית/.test(status)) return { ...out, kind: 'yes', label: 'התקבלה' };
  if (here && !repeated && !/נדחתה|הוסרה מסדר|לא התקבלה|נפלה|נעצרה/.test(status)) {
    if (bill.stage === 'טרומית' && !/דיון מוקדם/.test(status) && /ועדת הכנסת לקביעת|קריאה ה?ראשונה|שנייה|שניה|שלישית/.test(status)) {
      return { ...out, kind: 'yes', label: 'עברה בטרומית' };
    }
    if (bill.stage === 'ראשונה' && /שנייה|שניה|שלישית/.test(status)) return { ...out, kind: 'yes', label: 'עברה בראשונה' };
  }
  return { ...out, kind: 'status' };
}

export default function OfficePlenum() {
  const today = useMemo(todayIso, []);
  const [ym, setYm] = useState(() => { const [y, m] = today.split('-').map(Number); return { y, m: m - 1 }; });
  const [sittings, setSittings] = useState<Sitting[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [agendas, setAgendas] = useState<Record<number, Agenda | 'err'>>({});
  const [bills, setBills] = useState<Record<number, BillInfo>>({});
  const [open, setOpen] = useState<string | null>(null);
  const asked = useRef(new Set<number>());
  const monthKey = `${ym.y}-${ym.m}`;

  useEffect(() => {
    let cancelled = false;
    setSittings(null); setFailed(false);
    loadMonth(ym.y, ym.m).then(list => {
      if (cancelled) return;
      setSittings(list);
      // Open on the nearest sitting from today on; in a past month, on its last one
      setPicked((list.find(x => x.iso >= today) ?? list[list.length - 1])?.iso ?? null);
      setOpen(null);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, attempt]);

  const daySittings = useMemo(() => (sittings ?? []).filter(x => x.iso === picked), [sittings, picked]);

  useEffect(() => {
    let cancelled = false;
    for (const sit of daySittings) {
      if (agendas[sit.id] && agendas[sit.id] !== 'err') continue;
      loadAgenda(sit, today)
        .then(a => { if (!cancelled) setAgendas(prev => ({ ...prev, [sit.id]: a })); })
        .catch(() => { if (!cancelled) setAgendas(prev => ({ ...prev, [sit.id]: 'err' })); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daySittings, attempt]);

  function askBills(ids: number[]) {
    const todo = ids.filter(id => id && !asked.current.has(id));
    todo.forEach(id => asked.current.add(id));
    // A few at a time: a long sitting can carry dozens of bills
    (async () => {
      for (let i = 0; i < todo.length; i += 6) {
        const part = todo.slice(i, i + 6);
        const got = await Promise.all(part.map(id =>
          getJson<RawBill>(`LegislationItem/GetLegislationBillItem?ItemId=${id}`).catch(() => 'err' as const)));
        setBills(prev => ({ ...prev, ...Object.fromEntries(part.map((id, k) => [id, got[k] ?? 'err'])) }));
      }
    })();
  }

  // Once a sitting has taken place, fetch the record of each of its bills
  useEffect(() => {
    for (const sit of daySittings) {
      const a = agendas[sit.id];
      if (a && a !== 'err' && a.ended) askBills(a.bills.map(b => b.id));
    }
  }, [daySittings, agendas]);

  function shift(by: number) {
    setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + by, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  }
  function toggle(key: string, billId: number) {
    setOpen(o => (o === key ? null : key));
    askBills([billId]);
  }
  const onKey = (e: React.KeyboardEvent, run: () => void) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); }
  };

  const byDay = useMemo(() => {
    const map = new Map<string, Sitting[]>();
    for (const x of sittings ?? []) map.set(x.iso, [...(map.get(x.iso) ?? []), x]);
    return map;
  }, [sittings]);
  const lead = new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();

  return (
    <>
      <div className={s.mast}>
        <h1>מליאה</h1>
        <span className={s.mastDate}>
          {sittings ? (sittings.length === 0 ? 'אין ישיבות בחודש זה' : sittings.length === 1 ? 'ישיבה אחת בחודש' : `${sittings.length} ישיבות בחודש`) : 'הצעות חוק לפי ישיבה'}
        </span>
        <div className={s.mastTools}>
          <div className={s.seg}>
            <button type="button" aria-label="החודש הקודם" onClick={() => shift(-1)}>‹</button>
            <button type="button" className={s.plMonth} onClick={() => { const [y, m] = today.split('-').map(Number); setYm({ y, m: m - 1 }); }} title="חזרה לחודש הנוכחי">
              {MONTHS[ym.m]} {ym.y}
            </button>
            <button type="button" aria-label="החודש הבא" onClick={() => shift(1)}>›</button>
          </div>
        </div>
      </div>

      <div className={s.plCal} role="group" aria-label={`ישיבות המליאה ב${MONTHS[ym.m]} ${ym.y}`}>
        {DAY_LETTERS.map(d => <div key={d} className={s.plDow} aria-hidden="true">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} className={s.plDay} aria-hidden="true" />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = isoOf(ym.y, ym.m, i + 1);
          const list = byDay.get(iso);
          const cls = `${s.plDay} ${iso === today ? s.plToday : ''}`;
          if (!list) return <div key={iso} className={cls}><b>{i + 1}</b></div>;
          return (
            <button
              key={iso} type="button" className={`${cls} ${s.plSit} ${picked === iso ? s.plOn : ''} ${iso < today ? s.plPast : ''}`}
              aria-pressed={picked === iso} aria-label={`יום ${dayName(iso)} ${showDate(iso)}, ישיבת מליאה בשעה ${list.map(x => x.time).join(' ו-')}`}
              onClick={() => { setPicked(iso); setOpen(null); }}
            >
              <b>{i + 1}</b>
              <small>{list.map(x => x.time).join(' · ')}</small>
            </button>
          );
        })}
        {Array.from({ length: (7 - ((lead + daysInMonth) % 7)) % 7 }, (_, i) => <div key={`t${i}`} className={s.plDay} aria-hidden="true" />)}
      </div>

      {failed && (
        <div className={s.none}>
          לא ניתן לטעון כרגע מאתר הכנסת.{' '}
          <button type="button" className={s.btn} onClick={() => setAttempt(a => a + 1)}>נסה שוב</button>{' '}
          <a href={AGENDA_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: '#0075C4', fontWeight: 700 }}>לסדר היום באתר הכנסת ↗</a>
        </div>
      )}
      {!failed && !sittings && <div className={s.none}>טוען מאתר הכנסת…</div>}
      {sittings && sittings.length === 0 && (
        <div className={s.none}>הכנסת לא פרסמה ישיבות מליאה ל{MONTHS[ym.m]} {ym.y}.</div>
      )}

      {daySittings.map(sit => {
        const a = agendas[sit.id];
        const ready = a && a !== 'err' ? a : null;
        return (
          <Fragment key={sit.id}>
            <div className={s.plHead}>
              <h2 className={s.h2}>יום {dayName(sit.iso)}, {showDate(sit.iso)} · {sit.time}</h2>
              {ready?.ended && <span className={s.tag}>התקיימה</span>}
              {ready && !ready.ended && !sit.published && <span className={`${s.tag} ${s.plPlan}`}>מתוכנן, עשוי להשתנות</span>}
              {ready && !ready.ended && sit.published && <span className={s.tag}>סדר יום סופי</span>}
              <a
                href={sit.published ? `${AGENDA_PAGE}/agenda/${sit.iso.slice(8)}${sit.iso.slice(5, 7)}${sit.iso.slice(0, 4)}` : WEEKLY_PAGE}
                target="_blank" rel="noopener noreferrer"
              >
                {sit.published ? 'הישיבה באתר הכנסת ↗' : 'סדר היום השבועי באתר הכנסת ↗'}
              </a>
            </div>

            {!a && <div className={s.none}>טוען את סדר היום…</div>}
            {a === 'err' && (
              <div className={s.none}>
                לא ניתן לטעון את סדר היום של הישיבה.{' '}
                <button type="button" className={s.btn} onClick={() => setAttempt(x => x + 1)}>נסה שוב</button>
              </div>
            )}
            {ready && ready.empty && <div className={s.none}>הכנסת קבעה את מועד הישיבה, אך עוד לא פרסמה את סדר היום שלה.</div>}
            {ready && !ready.empty && ready.bills.length === 0 && <div className={s.none}>אין הצעות חוק על סדר היום של ישיבה זו.</div>}

            {ready && ready.bills.length > 0 && (
              <div className={s.tbl}>
                <div className={`${s.bHead} ${s.plGrid}`}>
                  <div>הצעת חוק</div><div>שלב</div><div>יוזמים</div><div>{ready.ended ? 'תוצאה' : 'מצב'}</div>
                </div>
                {ready.bills.map((b, i) => {
                  const key = `${sit.id}:${b.id}:${i}`;
                  const expanded = open === key;
                  const info = bills[b.id];
                  const o = outcomeOf(b, info, sit);
                  const billUrl = b.id ? `${BILL_PAGE}${b.id}` : null;
                  return (
                    <div key={key}>
                      <div
                        className={`${s.bRow} ${s.plGrid} ${b.active ? '' : s.plOff}`} role="button" tabIndex={0} aria-expanded={expanded}
                        onClick={() => toggle(key, b.id)} onKeyDown={e => onKey(e, () => toggle(key, b.id))}
                      >
                        <span className={s.cName}>
                          {b.name}
                          {b.number && <small>{b.number}</small>}
                        </span>
                        <span className={s.plStage}>
                          {b.stage
                            ? <span className={s.kind}>{b.stage}</span>
                            : <span className={s.topicNone}>{b.heading || 'לא ידוע'}</span>}
                        </span>
                        <span className={`${s.cChair} ${s.clamp2}`}>{b.initiators || <span className={s.topicNone}>—</span>}</span>
                        <span className={s.plRes}>
                          {!b.active ? <span className={s.tag}>מסומן כמבוטל באתר הכנסת</span>
                            : !ready.ended ? <span className={s.topicNone}>טרם נדונה</span>
                              : o.kind === 'load' ? <span className={s.topicNone}>טוען…</span>
                                : o.kind === 'unknown' ? <span className={s.topicNone}>לא ידוע</span>
                                  : o.kind === 'status' ? <span className={s.plStatus}>{o.status}</span>
                                    : <span className={`${s.rec} ${o.kind === 'yes' ? s.recYes : s.recNo}`}>{o.label}</span>}
                        </span>
                      </div>
                      {expanded && (
                        <div className={s.detail}>
                          {b.summary && (<><div className={s.lbl}>תקציר</div><div>{b.summary}</div></>)}
                          {!b.stage && b.heading && (<><div className={s.lbl}>הסעיף בסדר היום</div><div>{b.heading}</div></>)}
                          {b.notes && (<><div className={s.lbl}>הערת מזכירות הכנסת</div><div>{b.notes}</div></>)}
                          <div className={s.lbl}>מצב ההצעה היום, לפי אתר הכנסת</div>
                          <div>
                            {o.kind === 'load' ? 'טוען…' : o.status || 'לא ידוע'}
                            {info && info !== 'err' && clean(info.general?.CommitteeName) && <> · ועדה מטפלת: {clean(info.general?.CommitteeName)}</>}
                          </div>
                          {ready.ended && info && info !== 'err' && !o.listed && (
                            <div className={s.plNote}>הישיבה הזאת אינה מופיעה ברישום שלבי ההצעה באתר הכנסת, ולכן לא מוצגת תוצאה.</div>
                          )}
                          <div className={s.plLinks}>
                            {billUrl && <a href={billUrl} target="_blank" rel="noopener noreferrer">עמוד ההצעה באתר הכנסת ↗</a>}
                            {b.doc && <a href={b.doc} target="_blank" rel="noopener noreferrer">נוסח ההצעה ↗</a>}
                            {o.protocol && <a href={o.protocol} target="_blank" rel="noopener noreferrer">פרוטוקול הישיבה ↗</a>}
                          </div>
                          <BotAsk questions={plenumQuestions(b.name, sit.iso, ready.ended)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {ready && ready.others.length > 0 && (
              <>
                <div className={s.plMore}>עוד על סדר היום</div>
                <div className={s.list}>
                  {ready.others.map(g => (
                    <div key={g.heading} className={s.plOther}>
                      <b>{g.heading}</b>
                      {g.items.map((x, i) => <span key={i} className={x.active ? '' : s.plOff}>{x.name}</span>)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Fragment>
        );
      })}

      <div className={s.meta}>
        <span>מקור: אתר הכנסת, בזמן אמת</span>
        <span>השלב לפי הסעיף בסדר היום; התוצאה לפי רישום ההצעה באתר הכנסת</span>
        <a href={AGENDA_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: '#0075C4' }}>סדר היום באתר הכנסת ↗</a>
      </div>
    </>
  );
}
