'use client';
import { useEffect, useRef, useState } from 'react';
import {
  RECESS_TITLE, RECESS_UPDATED, ELECTION_LABEL, daysToElection,
  KNESSET_BLOCKS, GOV_CARDS, COURT_INTRO, COURT_ROWS, TIMELINE, SOURCES,
  RPara, RCard, RExpandable, Tag, TagKind, PermList,
} from '@/data/recess';
import { READY_SECOND_THIRD, PLENUM_AS_OF } from '@/data/plenumReady';
import styles from './Sekira.module.css';

const TAG_STYLE: Record<TagKind, string> = {
  ok: styles.tagOk,
  need: styles.tagNeed,
  frozen: styles.tagFrozen,
  pending: styles.tagPending,
  info: styles.tagInfo,
};

export function TagChip({ tag }: { tag: Tag }) {
  return <span className={`${styles.tag} ${TAG_STYLE[tag.kind]}`}>{tag.label}</span>;
}

// Inline marker in data text: **bold**
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p
      )}
    </>
  );
}

function Links({ links }: { links?: { label: string; url: string }[] }) {
  if (!links?.length) return null;
  return (
    <>
      {links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noreferrer" className={styles.topicLink}>
          {l.label} ↗
        </a>
      ))}
    </>
  );
}

function ParaView({ p }: { p: RPara }) {
  return (
    <div className={`${styles.rPara} ${p.muted ? styles.rMuted : ''}`}>
      {p.head && <span className={styles.rParaHead}>{p.head} — </span>}
      <Rich text={p.text} />
      <Links links={p.links} />
    </div>
  );
}

// Tier-1 list of the "מוכן למליאה" calculator, rendered live from its data —
// single source of truth with the calculator itself.
function PlenumReadyTeaser({ onOpenCalculator }: { onOpenCalculator?: () => void }) {
  return (
    <>
      {READY_SECOND_THIRD.map(b => (
        <div key={b.symbol} className={styles.rPara}>
          {b.name}
          <TagChip tag={{ label: b.category, kind: 'pending' }} />
        </div>
      ))}
      <div className={`${styles.rPara} ${styles.rMuted}`}>נכון ל-{PLENUM_AS_OF}</div>
      {onOpenCalculator && (
        <button type="button" className={styles.calcLink} onClick={onOpenCalculator}>
          למחשבון המלא ←
        </button>
      )}
    </>
  );
}

function ExpView({ exp, onOpenCalculator, printMode }: { exp: RExpandable; onOpenCalculator?: () => void; printMode?: boolean }) {
  return (
    <details className={styles.exp} open={printMode || undefined}>
      <summary className={styles.expSum}>
        <span>{exp.summary}</span>
        {exp.dynamic === 'plenumReady'
          ? <TagChip tag={{ label: `${READY_SECOND_THIRD.length} הצעות`, kind: 'need' }} />
          : exp.tag && <TagChip tag={exp.tag} />}
      </summary>
      <div className={styles.expBody}>
        {exp.dynamic === 'plenumReady'
          ? <PlenumReadyTeaser onOpenCalculator={onOpenCalculator} />
          : exp.paras.map((p, i) => <ParaView key={i} p={p} />)}
      </div>
    </details>
  );
}

function CardView({ card, onOpenCalculator, printMode }: { card: RCard; onOpenCalculator?: () => void; printMode?: boolean }) {
  return (
    <div className={styles.topicBlock}>
      <div className={styles.topicName}>
        {card.title}
        {card.tag && <TagChip tag={card.tag} />}
      </div>
      {card.paras.map((p, i) => <ParaView key={i} p={p} />)}
      {card.expandables?.map((e, i) => <ExpView key={i} exp={e} onOpenCalculator={onOpenCalculator} printMode={printMode} />)}
    </div>
  );
}

function PermBox({ list, kind }: { list: PermList; kind: 'green' | 'amber' }) {
  return (
    <div className={styles.perm}>
      <div className={`${styles.permHead} ${kind === 'green' ? styles.permHeadGreen : styles.permHeadAmber}`}>
        {list.title}
      </div>
      <ul className={styles.permList}>
        {list.items.map((it, i) => (
          <li key={i}>
            <Rich text={it.text} />
            {it.cond && <span className={styles.permCond}> · {it.cond}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───── tab bodies (also reused by SekiraIntro) ───── */

export function KnessetTab({ onOpenCalculator, printMode }: { onOpenCalculator?: () => void; printMode?: boolean }) {
  return (
    <>
      {KNESSET_BLOCKS.map((b, i) =>
        b.type === 'card' ? <CardView key={i} card={b.card} onOpenCalculator={onOpenCalculator} printMode={printMode} />
        : b.type === 'permGrid' ? (
          <div key={i} className={styles.permGrid}>
            <PermBox list={b.green} kind="green" />
            <PermBox list={b.amber} kind="amber" />
          </div>
        )
        : <ExpView key={i} exp={b.exp} printMode={printMode} />
      )}
    </>
  );
}

export function GovTab({ printMode }: { printMode?: boolean }) {
  return <>{GOV_CARDS.map((c, i) => <CardView key={i} card={c} printMode={printMode} />)}</>;
}

export function CourtTab() {
  return (
    <>
      <div className={styles.sectionIntro}>{COURT_INTRO}</div>
      <div className={styles.courtTable}>
        <div className={styles.courtHead}>
          <div>החוק</div><div>סטטוס</div><div>מצב משפטי</div><div>תאריך מפתח</div>
        </div>
        {COURT_ROWS.map((r, i) => (
          <div key={i} className={styles.courtRow}>
            <div className={styles.courtLaw}>{r.law}</div>
            <div className={styles.courtStatus}><TagChip tag={r.status} /></div>
            <div className={styles.courtLegal}>
              <Rich text={r.legal} />
              <Links links={r.links} />
            </div>
            <div className={styles.courtDate}>{r.date}</div>
          </div>
        ))}
      </div>
    </>
  );
}

const HEB_DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

function parseTlDate(d: string): Date | null {
  const m = d.match(/(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  return new Date(new Date().getFullYear(), parseInt(m[2]) - 1, parseInt(m[1]));
}

export function EventsTab() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const items = TIMELINE.map(t => ({ t, time: parseTlDate(t.date)?.getTime() ?? null }));
  const hasTodayItem = items.some(x => x.time === today);
  // Where the "we are here" marker slots in when no event falls on today:
  // before the first future event (or after everything if all are past)
  let markerIdx = items.findIndex(x => x.time !== null && x.time > today);
  if (markerIdx === -1) markerIdx = items.length;

  const todayLabel = `היום · ${HEB_DAYS[now.getDay()]}, ${now.getDate()}.${now.getMonth() + 1}`;
  const marker = (
    <li key="now" className={styles.tlNow}>
      <span className={styles.tlNowLbl}>{todayLabel}</span>
    </li>
  );

  return (
    <div className={styles.topicBlock}>
      <ul className={styles.tl}>
        {items.flatMap((x, i) => [
          ...(!hasTodayItem && i === markerIdx ? [marker] : []),
          <li
            key={i}
            className={[
              x.t.milestone ? styles.tlMilestone : '',
              x.time !== null && x.time < today ? styles.tlPast : '',
              x.time === today ? styles.tlToday : '',
            ].filter(Boolean).join(' ')}
          >
            <span className={styles.tlDate}>{x.t.date}</span>
            {x.time === today && <span className={styles.tlTodayChip}>היום</span>}
            {' · '}
            <Rich text={x.t.text} />
            <Links links={x.t.links} />
          </li>,
        ])}
        {!hasTodayItem && markerIdx === items.length && marker}
      </ul>
    </div>
  );
}

/* ───── WhatsApp export ───── */

// Strip data markers and squeeze whitespace for one-line message items
function waClean(s: string): string {
  return s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}
function waShort(s: string, maxWords = 12): string {
  const words = waClean(s).split(' ');
  return words.length <= maxWords ? waClean(s) : words.slice(0, maxWords).join(' ') + '…';
}

// Message is built from the live sekira data at open time — titles only, no
// per-item links; the single site link goes at the end.
function buildWhatsappMessage(): string {
  const now = new Date();
  const dateStr = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const knesset: string[] = [];
  for (const b of KNESSET_BLOCKS) {
    if (b.type === 'card') knesset.push(waShort(b.card.title));
    else if (b.type === 'expandable') knesset.push(waShort(b.exp.summary));
    // permGrid — covered by the ועדת ההסכמות card title
  }

  // Gov: the news items are the expandables; a card without them contributes its title
  const gov: string[] = [];
  for (const c of GOV_CARDS) {
    if (c.expandables?.length) c.expandables.forEach(e => gov.push(waShort(e.summary)));
    else gov.push(waShort(c.title));
  }

  const court = COURT_ROWS.map(r => `${waClean(r.law)} — ${r.status.label}`);

  // Events: today onward only — the message is forward-looking
  const events = TIMELINE
    .filter(t => { const d = parseTlDate(t.date); return !d || d.getTime() >= today; })
    .map(t => `${t.date} · ${waShort(t.text)}`);

  const site = typeof window !== 'undefined' ? window.location.origin : '';
  return [
    `*סקירה שבועית — זמן בחירות* · ${dateStr}`,
    `${daysToElection()} ימים ליום הבחירות (27.10.2026)`,
    '',
    '*כנסת*',
    ...knesset.map(l => `- ${l}`),
    '',
    '*ממשלה*',
    ...gov.map(l => `- ${l}`),
    '',
    '*בג"ץ*',
    ...court.map(l => `- ${l}`),
    '',
    '*אירועים בולטים*',
    ...events.map(l => `- ${l}`),
    '',
    `לסקירה המלאה: ${site}`,
  ].join('\n');
}

function ShareModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(buildWhatsappMessage);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Fallback for browsers without the async clipboard API (older mobile)
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        ta.select();
        try { document.execCommand('copy'); setCopied(true); } catch { /* ignore */ }
      }
    }
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className={styles.shareOverlay} onClick={onClose}>
      <div className={styles.shareModal} onClick={e => e.stopPropagation()}>
        <div className={styles.shareTitle}>שיתוף הסקירה בוואטסאפ</div>
        <div className={styles.shareHint}>אפשר לערוך את הטקסט לפני ההעתקה או השליחה.</div>
        <textarea
          ref={taRef}
          className={styles.shareTa}
          dir="rtl"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className={styles.shareBtns}>
          <button type="button" className={styles.shareCopy} onClick={copy}>
            {copied ? 'הועתק ✓' : 'העתקה'}
          </button>
          <a
            className={styles.shareWa}
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
          >
            פתיחה בוואטסאפ
          </a>
          <button type="button" className={styles.shareCancel} onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

export function Countdown() {
  // Computed at render time (so each visit shows the current count) and
  // re-checked hourly, so a tab left open across midnight ticks down too.
  const [days, setDays] = useState(daysToElection);
  useEffect(() => {
    const id = setInterval(() => setDays(daysToElection()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={styles.countBox}>
      <span className={styles.countNum}>{days}</span>
      <span className={styles.countLbl}>{ELECTION_LABEL}</span>
    </div>
  );
}

function Sources() {
  return (
    <div className={styles.srcFoot}>
      מקורות:{' '}
      {SOURCES.map((s, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {s.url
            ? <a href={s.url} target="_blank" rel="noreferrer" className={styles.srcLink}>{s.text} ↗</a>
            : s.text}
        </span>
      ))}
    </div>
  );
}

const RECESS_TABS = [
  { id: 'knesset', label: 'כנסת', intro: 'מה מותר ומה טעון אישור בתקופת הפגרה.' },
  { id: 'gov', label: 'ממשלה', intro: 'ממשלה יוצאת — חובת איפוק, מסננת משפטית, והחלטות הרגע האחרון.' },
  { id: 'court', label: 'בג"ץ', intro: '' },
  { id: 'events', label: 'אירועים בולטים', intro: 'לוח האירועים של השבועיים הקרובים.' },
] as const;

export type RecessTabId = typeof RECESS_TABS[number]['id'];

export default function SekiraView({ onOpenCalculator, externalTab, onExternalConsumed }: {
  onOpenCalculator?: () => void;
  // Deep-link from another tab (e.g. a schedule arena's "לסקירה המלאה"):
  // open on this sekira tab, then let the parent clear the request.
  externalTab?: RecessTabId | null;
  onExternalConsumed?: () => void;
}) {
  const [tab, setTab] = useState<RecessTabId>(externalTab ?? 'knesset');
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (externalTab) {
      setTab(externalTab);
      onExternalConsumed?.();
    }
  }, [externalTab, onExternalConsumed]);

  return (
    <div className={styles.wrap} style={{ padding: '24px', maxWidth: 1080, margin: '0 auto', width: '100%' }}>
      <div className={styles.heading}>
        <h1>{RECESS_TITLE}</h1>
        <div className={styles.headingSub}>{RECESS_UPDATED}</div>
      </div>

      <Countdown />

      <div className={styles.exportRow}>
        <button type="button" className={styles.waBtn} onClick={() => setShareOpen(true)}>
          שיתוף בוואטסאפ
        </button>
        <button type="button" className={styles.pdfBtn} onClick={() => window.print()}>
          הורדת PDF
        </button>
      </div>

      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}

      {/* Full print version — hidden on screen; window.print() renders it and
          the user saves as PDF from the browser dialog (clean Hebrew RTL) */}
      <div className="sekira-print-root">
        <div className={styles.heading}>
          <h1>{RECESS_TITLE}</h1>
          <div className={styles.headingSub}>
            {RECESS_UPDATED} · {daysToElection()} {ELECTION_LABEL}
          </div>
        </div>
        <div className="sekira-print-section"><div className={styles.printArena}>כנסת</div><KnessetTab printMode /></div>
        <div className="sekira-print-section"><div className={styles.printArena}>ממשלה</div><GovTab printMode /></div>
        <div className="sekira-print-section"><div className={styles.printArena}>בג"ץ</div><CourtTab /></div>
        <div className="sekira-print-section"><div className={styles.printArena}>אירועים בולטים</div><EventsTab /></div>
        <Sources />
      </div>

      <div className={styles.subTabs} style={{ maxWidth: 640, margin: '0 auto 22px' }}>
        {RECESS_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`${styles.subTab} ${tab === t.id ? styles.active : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {RECESS_TABS.find(t => t.id === tab)?.intro && (
        <div className={styles.sectionIntro}>{RECESS_TABS.find(t => t.id === tab)!.intro}</div>
      )}

      {tab === 'knesset' && <KnessetTab onOpenCalculator={onOpenCalculator} />}
      {tab === 'gov' && <GovTab />}
      {tab === 'court' && <CourtTab />}
      {tab === 'events' && <EventsTab />}

      <Sources />
    </div>
  );
}
