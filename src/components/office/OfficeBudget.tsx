'use client';

import { useEffect, useMemo, useState } from 'react';
import { safeUrl } from '@/lib/urls';
import s from './Office.module.css';

// פניות תקציב — budget-change requests on the Finance Committee's table.
// Fetched LIVE from the Knesset website's own API, straight from the browser
// (the API allows any origin), so the list is always current and needs no sync.
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
  key: string;
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
  const description = (r.Description ?? '').replace(/\r/g, '').trim();
  const d = r.ApprovedDate && r.ApprovedDate !== 'None' ? new Date(r.ApprovedDate) : null;
  return {
    key: `${rawNumber}|${i}`,
    type: (r.RequestType ?? '').trim() || 'פנייה',
    number: rawNumber.replace(/\s*עד\s*/, '–'),
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

type SortBy = 'number' | 'ministry';

export default function OfficeBudget() {
  const [view, setView] = useState<View>('pending');
  const [sortBy, setSortBy] = useState<SortBy>('number');
  const [state, setState] = useState<{ view: View; rows: BudgetRequest[]; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRequests(view)
      .then(r => { if (!cancelled) { setState({ view, ...r }); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [view, attempt]);

  const loading = !failed && state?.view !== view;

  const rows = useMemo(() => {
    const list = [...(state?.rows ?? [])];
    if (state?.view === 'approved') return list; // keep the Knesset's order: latest approvals first
    return sortBy === 'ministry'
      ? list.sort((a, b) => a.ministry.localeCompare(b.ministry, 'he') || a.first - b.first)
      : list.sort((a, b) => a.first - b.first);
  }, [state, sortBy]);

  function switchView(v: View) {
    if (v === view) return;
    setOpen(null);
    setFailed(false);
    setView(v);
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

  const isPending = view === 'pending';

  return (
    <>
      <div className={s.mast}>
        <h1>פניות תקציב</h1>
        <span className={s.mastDate}>
          ועדת הכספים{!loading && !failed && state ? ` · ${isPending ? `${state.total} ממתינות` : `${state.total} אושרו`}` : ''}
        </span>
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
          {isPending && rows.length > 0 && !loading && (
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={copyWhatsapp}>
              {copied ? 'הועתק ✓' : 'העתק לוואטסאפ'}
            </button>
          )}
        </div>
      </div>

      <div className={s.tbl}>
        <div className={s.bHead}>
          <div>מס&apos; פנייה</div><div>משרד</div><div>עיקר הפנייה</div><div>{isPending ? 'מסמך' : 'אושר'}</div>
        </div>
        {loading && <div className={s.none}>טוען מאתר הכנסת…</div>}
        {failed && (
          <div className={s.none}>
            לא ניתן לטעון כרגע מאתר הכנסת.{' '}
            <button type="button" className={s.btn} onClick={() => { setFailed(false); setAttempt(a => a + 1); }}>נסה שוב</button>{' '}
            <a href={KNESSET_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: '#0075C4', fontWeight: 700 }}>לעמוד באתר הכנסת ↗</a>
          </div>
        )}
        {!loading && !failed && rows.length === 0 && (
          <div className={s.none}>{isPending ? 'אין פניות ממתינות על שולחן הוועדה' : 'לא נמצאו פניות'}</div>
        )}
        {!loading && !failed && rows.map(r => {
          const expanded = open === r.key;
          return (
            <div key={r.key}>
              <div
                className={s.bRow} role="button" tabIndex={0} aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : r.key)}
                onKeyDown={e => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(expanded ? null : r.key); }
                }}
              >
                <span className={s.bNum} dir="ltr">{r.number}</span>
                <span className={s.bMin}>
                  {r.ministry}
                  {r.type !== 'פנייה' && <span className={s.tag} style={{ marginInlineStart: 6 }}>{r.type}</span>}
                </span>
                <span className={`${s.bSum} ${expanded ? '' : s.clamp2}`}>{r.summary || 'אין תקציר — לחצו לפירוט'}</span>
                <span className={s.bEnd}>
                  {isPending
                    ? (r.pdf && <a href={r.pdf} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>PDF ↗</a>)
                    : <span dir="ltr">{r.approved}</span>}
                </span>
              </div>
              {expanded && (
                <div className={s.detail}>
                  {r.codes && (<><div className={s.lbl}>מספרי בקשות</div><div dir="ltr" style={{ textAlign: 'right' }}>{r.codes}</div></>)}
                  <div className={s.lbl}>דברי הסבר</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{r.description || 'לא פורסמו דברי הסבר.'}</div>
                  {r.pdf && <a href={r.pdf} target="_blank" rel="noopener noreferrer">הפנייה המלאה ב-PDF ↗</a>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={s.meta}>
        <span>מקור: אתר הכנסת, בזמן אמת</span>
        {!loading && !failed && state && state.total > state.rows.length && (
          <span>מוצגות {state.rows.length} האחרונות מתוך {state.total}</span>
        )}
        <a href={KNESSET_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: '#0075C4' }}>לעמוד באתר הכנסת ↗</a>
      </div>
    </>
  );
}
