'use client';

import { useEffect, useMemo, useState } from 'react';
import { safeUrl } from '@/lib/urls';
import { BudgetAnalysis, BudgetRequestMeta, getOfficeBudget, setOfficeBudget } from '@/lib/office';
import BotAsk from './BotAsk';
import { budgetQuestions } from './botQuestions';
import {
  BudgetField, DETAIL_FIELDS, RECOMMENDATIONS,
  changeShare, fieldValue, isEdited, requestKey, showAmount, showShare, toSheetCsv,
} from './budgetFields';
import s from './Office.module.css';

// פניות תקציב — budget-change requests on the Finance Committee's table, in the
// format of the organization's own worksheet.
//   • The list is fetched LIVE from the Knesset website's API, straight from
//     the browser (the API allows any origin) — always current, no sync.
//   • The analysis of each request (essence, source, red flags, questions, a
//     proposed recommendation to the chair…) comes from a protected table. It
//     is written by sync-budget.mjs on the admin's PC, which reads the full
//     request PDF; every field can be edited here and the edit always wins.
// Default view: the requests still waiting for a committee discussion.

const API = 'https://www.knesset.gov.il/WebSiteApi/knessetapi/CommitteeReports/GetCommitteePortalsBudget';
const KNESSET_PAGE = 'https://main.knesset.gov.il/apps/committees/2213/budget?BT=2';

// requestStatus in the Knesset API: 2 = on the committee's table, 1 = approved
type View = 'pending' | 'approved';
const VIEW_STATUS: Record<View, number> = { pending: 2, approved: 1 };
const VIEW_ROWS: Record<View, number> = { pending: 300, approved: 30 };

interface RawRequest {
  RequestType?: string;
  RequestNumber?: string;       // "206 עד 213"
  RequestNumberRange?: string;  // "18-011,06-206,…"
  Description?: string;
  ApprovedDate?: string | null;
  GovMinistryName?: string;
  ReportUrl?: string;
  TotalCount?: string;
}

interface BudgetRequest {
  key: string;        // row key in this list
  reqKey: string;     // the request's stable id — joins the row with its analysis
  type: string;
  number: string;     // "206–213"
  first: number;      // sort key — lower numbers were submitted earlier
  codes: string;
  ministry: string;
  summary: string;
  description: string;
  approved: string;   // "25.10" or ''
  pdf: string | null;
}

/** The opening paragraph of the request's explanation — everything before the
 *  per-programme breakdown. Verbatim text from the Knesset, only re-flowed:
 *  the source is PDF-extracted, so it carries hard line breaks. */
function summarize(desc: string): string {
  let t = desc.replace(/\r/g, '');
  const breakdown = t.search(/עיקרי\s+הפני?יה(\s+התקציבית)?\s+בחלוקה/);
  if (breakdown > 0) {
    t = t.slice(0, breakdown);
  } else {
    const programme = t.search(/\n\s*(תו?כנית\s*:?\s*\d|\d{5,6}\s*[-–:])/);
    if (programme > 0) t = t.slice(0, programme);
  }
  t = t.replace(/^\s*ה?בקשה דנה בסעיף תקציבי:[^\n]*\n/, '');
  t = t.replace(/^\s*עיקרי\s+הפני?יה\s*:/, '');
  return t.replace(/\s*\n\s*/g, ' ').replace(/\s\.\s/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function toRequest(r: RawRequest, i: number): BudgetRequest {
  const rawNumber = (r.RequestNumber ?? '').trim();
  const number = rawNumber.replace(/\s*עד\s*/, '–');
  const description = (r.Description ?? '').replace(/\r/g, '').trim();
  const d = r.ApprovedDate && r.ApprovedDate !== 'None' ? new Date(r.ApprovedDate) : null;
  return {
    key: `${rawNumber}|${i}`,
    reqKey: requestKey(r.ReportUrl, number),
    type: (r.RequestType ?? '').trim() || 'פנייה',
    number,
    first: Number(rawNumber.match(/\d+/)?.[0] ?? 0),
    codes: (r.RequestNumberRange ?? '').split(',').map(x => x.trim()).filter(Boolean).join(' · '),
    ministry: (r.GovMinistryName ?? '').trim() || 'לא צוין',
    summary: summarize(description),
    description,
    approved: d && !Number.isNaN(d.getTime()) ? `${d.getDate()}.${d.getMonth() + 1}` : '',
    pdf: safeUrl(r.ReportUrl),
  };
}

async function fetchRequests(view: View): Promise<{ rows: BudgetRequest[]; total: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ FromDate: null, ToDate: null, requestStatus: VIEW_STATUS[view], RowsPerPage: VIEW_ROWS[view] }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as RawRequest[];
    if (!Array.isArray(raw)) throw new Error('תשובה לא צפויה מאתר הכנסת');
    return { rows: raw.map(toRequest), total: Number(raw[0]?.TotalCount ?? raw.length) || raw.length };
  } finally {
    clearTimeout(timer);
  }
}

const REC_CLASS: Record<string, string> = {
  'לאשר': s.recYes, 'לאשר בתנאי': s.recCond, 'לא לאשר': s.recNo, 'לפצל': s.recSplit,
};

/** "2026-10-20" → "20.10.2026"; anything else is shown as written */
function showDate(text: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : text;
}

/** A timestamp → "22.11 08:00" */
function showStamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function showField(f: BudgetField, a: BudgetAnalysis | undefined): string {
  const v = fieldValue(a, f.key);
  if (f.key === 'amount' || f.key === 'coalition_amount') return showAmount(v);
  if (f.key === 'original_budget') {
    const share = showShare(changeShare(a));
    return share ? `${showAmount(v)} · השינוי הוא ${share} מהמקורי` : showAmount(v);
  }
  if (f.key === 'request_date') return showDate(v);
  return v;
}

type SaveField = (field: string, value: string | null) => Promise<boolean>;

/** One field of the analysis: its text, and an inline editor on demand */
function Field({ f, a, onSave }: { f: BudgetField; a: BudgetAnalysis | undefined; onSave: SaveField }) {
  const [draft, setDraft] = useState<string | null>(null); // null = not editing
  const [busy, setBusy] = useState(false);
  const edited = isEdited(a, f.key);
  const shown = showField(f, a);

  async function save(value: string | null) {
    setBusy(true);
    const ok = await onSave(f.key, value);
    setBusy(false);
    if (ok) setDraft(null);
  }

  return (
    <div className={s.baField}>
      <div className={s.baLabel}>
        {f.label}
        {edited && <span className={s.tag} style={{ marginInlineStart: 6 }}>נערך</span>}
        {draft === null && (
          <button type="button" className={s.baPen} aria-label={`עריכת ${f.label}`} title="עריכה" onClick={() => setDraft(fieldValue(a, f.key))}>✎</button>
        )}
      </div>
      {draft === null ? (
        <div className={`${s.baValue} ${shown ? '' : s.baEmpty}`}>{shown || (f.manual ? 'טרם נקבע' : 'אין נתון')}</div>
      ) : (
        <div className={s.baEdit}>
          {f.rows
            ? <textarea rows={f.rows} value={draft} onChange={e => setDraft(e.target.value)} autoFocus />
            : <input type="text" value={draft} onChange={e => setDraft(e.target.value)} autoFocus />}
          <div className={s.inline}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy} onClick={() => save(draft.trim())}>שמור</button>
            <button type="button" className={s.btn} disabled={busy} onClick={() => setDraft(null)}>ביטול</button>
            {edited && !f.manual && (
              <button type="button" className={s.cLink} disabled={busy} onClick={() => save(null)}>חזרה לנוסח האוטומטי</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const REASON_FIELD: BudgetField = { key: 'rec_reason', label: 'נימוק ההמלצה', rows: 3 };

/** The analysis part of an open row */
function Analysis({ r, a, onSave }: { r: BudgetRequest; a: BudgetAnalysis | undefined; onSave: SaveField }) {
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const empty = !a || (Object.keys(a.auto).length === 0 && Object.keys(a.edits).length === 0);
  const rec = fieldValue(a, 'recommendation');
  const status = a?.status ?? 'new';
  const stale = status === 'done' && !!a?.analyzed_pdf && !!r.pdf && a.analyzed_pdf !== r.pdf;

  async function run(steps: [string, string | null][]) {
    setBusy(true);
    for (const [field, value] of steps) {
      if (!(await onSave(field, value))) break;
    }
    setBusy(false);
  }

  return (
    <>
      <div className={s.baBar}>
        {status === 'done' && (
          <span>נותח אוטומטית {showStamp(a?.analyzed_at ?? null)}{a?.pages ? ` · ${a.pages} עמודים` : ''}</span>
        )}
        {status === 'new' && <span>עדיין לא נותחה. תנותח בריצה הבאה של המחשב.</span>}
        {status === 'queued' && <span>בתור לניתוח: בריצה הבאה של המחשב (עד שעתיים).</span>}
        {status === 'error' && <span className={s.err} style={{ marginTop: 0 }}>הניתוח נכשל: {a?.error || 'שגיאה לא ידועה'}</span>}
        {stale && <span className={s.tag}>המסמך עודכן מאז הניתוח</span>}
        {status !== 'queued' && (
          <button type="button" className={s.btn} disabled={busy} onClick={() => run([['_queue', null]])}>
            {status === 'done' ? 'נתח מחדש' : 'נתח עכשיו'}
          </button>
        )}
      </div>

      {empty && !manual && (
        <button type="button" className={s.cLink} style={{ display: 'block', marginTop: 8 }} onClick={() => setManual(true)}>
          מילוי ידני של השדות
        </button>
      )}

      {(!empty || manual) && (
        <div className={s.baRecBox}>
          <div className={s.lbl} style={{ marginTop: 0 }}>
            המלצה ליו&quot;ר
            <span className={s.tag} style={{ marginInlineStart: 6 }}>{a?.rec_ok ? 'אושרה' : rec ? 'הצעה אוטומטית' : 'טרם נקבעה'}</span>
          </div>
          <div className={s.inline}>
            <select
              value={rec} disabled={busy} aria-label='המלצה ליו"ר'
              onChange={e => { if (e.target.value) run([['recommendation', e.target.value], ['_rec_ok', 'true']]); }}
            >
              {!rec && <option value="">בחירה…</option>}
              {RECOMMENDATIONS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            {rec && !a?.rec_ok && (
              // Approving freezes the text: a later automatic analysis will not change it
              <button
                type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy}
                onClick={() => run([['recommendation', rec], ['rec_reason', fieldValue(a, 'rec_reason')], ['_rec_ok', 'true']])}
              >
                אשר המלצה
              </button>
            )}
            {a?.rec_ok && (
              <button type="button" className={s.cLink} disabled={busy} onClick={() => run([['_rec_ok', 'false']])}>בטל אישור</button>
            )}
          </div>
          <Field f={REASON_FIELD} a={a} onSave={onSave} />
        </div>
      )}

      {(!empty || manual) && (
        <div className={s.baFields}>
          {DETAIL_FIELDS.map(f => <Field key={f.key} f={f} a={a} onSave={onSave} />)}
        </div>
      )}
    </>
  );
}

type SortBy = 'number' | 'ministry';
type Setup = 'loading' | 'ok' | 'setup' | 'off';

export default function OfficeBudget() {
  const [view, setView] = useState<View>('pending');
  const [sortBy, setSortBy] = useState<SortBy>('number');
  const [state, setState] = useState<{ view: View; rows: BudgetRequest[]; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // The analysis, by request id. Absent = the request has not been analysed yet
  const [analysis, setAnalysis] = useState<Record<string, BudgetAnalysis>>({});
  const [setup, setSetup] = useState<Setup>('loading');
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRequests(view)
      .then(r => { if (!cancelled) { setState({ view, ...r }); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [view, attempt]);

  useEffect(() => {
    let cancelled = false;
    getOfficeBudget().then(res => {
      if (cancelled) return;
      if (res.status === 'ok') {
        setAnalysis(Object.fromEntries(res.rows.map(a => [a.key, a])));
        setLastRun(res.run);
        setSetup('ok');
      } else {
        setSetup(res.status === 'setup' ? 'setup' : 'off');
      }
    });
    return () => { cancelled = true; };
  }, [attempt]);

  const loading = !failed && state?.view !== view;
  const withAnalysis = setup === 'ok';

  const rows = useMemo(() => {
    const list = [...(state?.rows ?? [])];
    if (state?.view === 'approved') return list; // keep the Knesset's order: latest approvals first
    return sortBy === 'ministry'
      ? list.sort((a, b) => a.ministry.localeCompare(b.ministry, 'he') || a.first - b.first)
      : list.sort((a, b) => a.first - b.first);
  }, [state, sortBy]);

  const analysed = rows.filter(r => analysis[r.reqKey]?.status === 'done').length;

  function switchView(v: View) {
    if (v === view) return;
    setOpen(null);
    setFailed(false);
    setView(v);
  }

  /** One admin write, then the same change on screen */
  async function save(r: BudgetRequest, field: string, value: string | null): Promise<boolean> {
    const meta: BudgetRequestMeta = { number: r.number, codes: r.codes, ministry: r.ministry, pdf_url: r.pdf ?? '' };
    const ok = await setOfficeBudget(r.reqKey, meta, field, value);
    setSaveError(!ok);
    if (!ok) return false;
    setAnalysis(prev => {
      const a: BudgetAnalysis = prev[r.reqKey] ?? {
        key: r.reqKey, ...meta, pending: true, status: 'new', error: null, auto: {}, edits: {}, rec_ok: false,
        analyzed_at: null, analyzed_pdf: null, model: null, pages: null,
      };
      let next: BudgetAnalysis;
      if (field === '_queue') {
        next = { ...a, status: 'queued', error: null };
      } else if (field === '_rec_ok') {
        next = { ...a, rec_ok: value === 'true' };
      } else {
        const edits = { ...a.edits };
        if (value === null) delete edits[field]; else edits[field] = value;
        next = { ...a, edits };
      }
      return { ...prev, [r.reqKey]: next };
    });
    return true;
  }

  async function copyWhatsapp() {
    const lines = [`💰 *פניות תקציב הממתינות בוועדת הכספים* (${rows.length})`, ''];
    for (const r of rows) lines.push(`• *${r.ministry}* (${r.type} ${r.number}): ${r.summary}`);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — nothing to do */ }
  }

  function downloadSheet() {
    const csv = toSheetCsv(rows.map(r => ({ number: r.number, codes: r.codes, ministry: r.ministry, analysis: analysis[r.reqKey] })));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    const d = new Date();
    link.href = url;
    link.download = `פניות-תקציב-${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const isPending = view === 'pending';
  const count = !loading && !failed && state
    ? ` · ${isPending ? `${state.total} ממתינות` : `${state.total} אושרו`}${withAnalysis && isPending && rows.length > 0 ? ` · ${analysed} נותחו` : ''}`
    : '';

  return (
    <>
      <div className={s.mast}>
        <h1>פניות תקציב</h1>
        <span className={s.mastDate}>ועדת הכספים{count}</span>
        <div className={s.mastTools}>
          <div className={s.seg}>
            <button type="button" className={isPending ? s.on : ''} onClick={() => switchView('pending')}>ממתינות</button>
            <button type="button" className={!isPending ? s.on : ''} onClick={() => switchView('approved')}>אושרו לאחרונה</button>
          </div>
          {isPending && (
            <div className={s.seg}>
              <button type="button" className={sortBy === 'number' ? s.on : ''} onClick={() => setSortBy('number')}>לפי מספר</button>
              <button type="button" className={sortBy === 'ministry' ? s.on : ''} onClick={() => setSortBy('ministry')}>לפי משרד</button>
            </div>
          )}
          {withAnalysis && rows.length > 0 && !loading && (
            <button type="button" className={s.btn} onClick={downloadSheet}>הורד כאקסל</button>
          )}
          {isPending && rows.length > 0 && !loading && (
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={copyWhatsapp}>
              {copied ? 'הועתק ✓' : 'העתק לוואטסאפ'}
            </button>
          )}
        </div>
      </div>

      {saveError && <div className={s.err}>השמירה נכשלה. נסו שוב.</div>}

      <div className={s.tbl}>
        {withAnalysis ? (
          <div className={`${s.bHead} ${s.ba}`}>
            <div>מס&apos; פנייה</div><div>משרד / תכנית</div><div>סכום (אלש&quot;ח)</div><div>המלצה</div><div>דגלים אדומים</div><div>{isPending ? 'מסמך' : 'אושר'}</div>
          </div>
        ) : (
          <div className={s.bHead}>
            <div>מס&apos; פנייה</div><div>משרד</div><div>עיקר הפנייה</div><div>{isPending ? 'מסמך' : 'אושר'}</div>
          </div>
        )}
        {loading && <div className={s.none}>טוען מאתר הכנסת…</div>}
        {failed && (
          <div className={s.none}>
            לא ניתן לטעון כרגע מאתר הכנסת.{' '}
            <button type="button" className={s.btn} onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>נסה שוב</button>{' '}
            <a href={KNESSET_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: '#0075C4', fontWeight: 700 }}>לעמוד באתר הכנסת ↗</a>
          </div>
        )}
        {!loading && !failed && rows.length === 0 && (
          <div className={s.none}>{isPending ? 'אין פניות ממתינות על שולחן הוועדה' : 'לא נמצאו פניות'}</div>
        )}
        {!loading && !failed && rows.map(r => {
          const expanded = open === r.key;
          const a = analysis[r.reqKey];
          const done = a?.status === 'done';
          const rec = fieldValue(a, 'recommendation');
          const flags = fieldValue(a, 'red_flags');
          const end = (
            <span className={s.bEnd}>
              {isPending
                ? (r.pdf && <a href={r.pdf} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>PDF ↗</a>)
                : <span dir="ltr">{r.approved}</span>}
            </span>
          );
          return (
            <div key={r.key}>
              <div
                className={`${s.bRow} ${withAnalysis ? s.ba : ''}`} role="button" tabIndex={0} aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : r.key)}
                onKeyDown={e => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(expanded ? null : r.key); }
                }}
              >
                <span className={s.bNum} dir="ltr">{r.number}</span>
                <span className={`${s.bMin} ${withAnalysis && !expanded ? s.clamp3 : ''}`}>
                  {(withAnalysis && fieldValue(a, 'program')) || r.ministry}
                  {r.type !== 'פנייה' && <span className={s.tag} style={{ marginInlineStart: 6 }}>{r.type}</span>}
                </span>
                {withAnalysis && (
                  <>
                    <span className={s.baAmt} dir="ltr">{showAmount(fieldValue(a, 'amount')) || '—'}</span>
                    <span className={s.baRec}>
                      {rec ? (
                        <>
                          <span className={`${s.rec} ${REC_CLASS[rec] ?? ''} ${a?.rec_ok ? '' : s.recDraft}`}>{rec}</span>
                          {!a?.rec_ok && <span className={s.recNote}>הצעה, ממתינה לאישורך</span>}
                        </>
                      ) : (
                        <span className={s.baStatus}>
                          {a?.status === 'queued' ? 'בתור לניתוח' : a?.status === 'error' ? 'הניתוח נכשל' : isPending ? 'ממתינה לניתוח' : 'לא נותחה'}
                        </span>
                      )}
                    </span>
                  </>
                )}
                <span className={`${s.bSum} ${expanded && !(withAnalysis && flags) ? '' : s.clamp2}`}>
                  {(withAnalysis && flags) || r.summary || 'אין תקציר — לחצו לפירוט'}
                </span>
                {end}
              </div>
              {expanded && (
                <div className={s.detail}>
                  {withAnalysis && <Analysis r={r} a={a} onSave={(field, value) => save(r, field, value)} />}
                  {r.codes && (<><div className={s.lbl}>מספרי בקשות האוצר</div><div dir="ltr" style={{ textAlign: 'right' }}>{r.codes}</div></>)}
                  <details open={!withAnalysis || !done} className={s.baSource}>
                    <summary>דברי ההסבר מאתר הכנסת</summary>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{r.description || 'לא פורסמו דברי הסבר.'}</div>
                  </details>
                  {r.pdf && <a href={r.pdf} target="_blank" rel="noopener noreferrer">הפנייה המלאה ב-PDF ↗</a>}
                  <BotAsk questions={budgetQuestions(r, new Date().getFullYear())} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={s.meta}>
        <span>רשימת הפניות: אתר הכנסת, בזמן אמת</span>
        {withAnalysis && (
          <span>ניתוח אוטומטי של קובץ הפנייה המלא, כל שעתיים מהמחשב של המנהל{lastRun ? ` · ריצה אחרונה ${showStamp(lastRun)}` : ''}</span>
        )}
        {setup === 'setup' && <span>ניתוח הפניות יופיע אחרי הרצה חד-פעמית של supabase-office-v3.sql</span>}
        {setup === 'off' && <span>הניתוח אינו זמין כרגע</span>}
        {!loading && !failed && state && state.total > state.rows.length && (
          <span>מוצגות {state.rows.length} האחרונות מתוך {state.total}</span>
        )}
        <a href={KNESSET_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: '#0075C4' }}>לעמוד באתר הכנסת ↗</a>
      </div>
    </>
  );
}
