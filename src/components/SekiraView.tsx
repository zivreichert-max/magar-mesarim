'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  RECESS_TITLE, RECESS_UPDATED, ELECTION_LABEL, daysToElection,
  SEKIRA_TABS, COURT_INTRO, COURT_ROWS, COURT_EXPANDABLES, SOURCES,
  RPara, RCard, RExpandable, Tag, TagKind, PermList, SekiraTab,
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

// Inline markers in data text: **bold** and [label](url)
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <a key={i} href={link[2]} target="_blank" rel="noreferrer" className={styles.inlineLink}>
              {link[1]}
            </a>
          );
        }
        return p;
      })}
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
      {p.todo && <TagChip tag={{ label: '[TODO קישור]', kind: 'need' }} />}
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

// One renderer for every tab — the tab strip, the print version and the intro
// carousel all walk SEKIRA_TABS, so adding a tab (e.g. restoring כנסת after the
// 26th Knesset convenes) is a data edit in recess.ts, not a code change.
export function TabBody({ tab, onOpenCalculator, printMode }: {
  tab: SekiraTab;
  onOpenCalculator?: () => void;
  printMode?: boolean;
}) {
  return (
    <>
      {tab.blocks.map((b, i) =>
        b.type === 'card' ? <CardView key={i} card={b.card} onOpenCalculator={onOpenCalculator} printMode={printMode} />
        : b.type === 'permGrid' ? (
          <div key={i} className={styles.permGrid}>
            <PermBox list={b.green} kind="green" />
            <PermBox list={b.amber} kind="amber" />
          </div>
        )
        : b.type === 'courtTable' ? <CourtTab key={i} printMode={printMode} />
        : <ExpView key={i} exp={b.exp} printMode={printMode} />
      )}
    </>
  );
}

export function CourtTab({ printMode }: { printMode?: boolean }) {
  return (
    <>
      <div className={styles.sectionIntro}>{COURT_INTRO}</div>
      <div className={styles.courtTable}>
        <div className={styles.courtHead}>
          <div>ההליך</div><div>סטטוס</div><div>מצב משפטי</div><div>תאריך מפתח</div>
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
      {COURT_EXPANDABLES.map((e, i) => <ExpView key={i} exp={e} printMode={printMode} />)}
    </>
  );
}

/* ───── WhatsApp export ───── */

// Strip data markers ( **bold**, [label](url) ) and squeeze whitespace
function waClean(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
// Title (WhatsApp-bolded) + the hand-written brief when one exists — the
// brief is a complete sentence and is NEVER auto-truncated; without one,
// the title stands alone.
function waItem(title: string, brief?: string): string {
  const t = `*${waClean(title)}*`;
  return brief ? `- ${t}: ${waClean(brief)}` : `- ${t}`;
}

// Message is built from the live sekira data at open time; snippets come from
// the curated `brief` fields in recess.ts. No per-item links (the single site
// link goes at the end).
function buildWhatsappMessage(): string {
  const now = new Date();
  const dateStr = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;

  // One section per tab, in SEKIRA_TABS order; the בג"ץ tab contributes its
  // tracking-table rows instead of cards.
  const sections: string[] = [];
  for (const t of SEKIRA_TABS) {
    const lines: string[] = [];
    for (const b of t.blocks) {
      if (b.type === 'card') lines.push(waItem(b.card.title, b.card.brief));
      else if (b.type === 'expandable') lines.push(waItem(b.exp.summary, b.exp.brief));
      else if (b.type === 'courtTable') {
        COURT_ROWS.forEach(r => lines.push(waItem(`${r.law} — ${r.status.label}`, r.brief)));
      }
      // permGrid — covered by the card title above it
    }
    if (!lines.length) continue;
    sections.push(`*${t.label}*`, ...lines, '');
  }

  const site = typeof window !== 'undefined' ? window.location.origin : '';
  return [
    `*סקירה שבועית — זמן בחירות* · ${dateStr}`,
    `${daysToElection()} ימים ליום הבחירות (27.10.2026)`,
    '',
    ...sections,
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

// The tab strip is the data in recess.ts — no hardcoded list here.
export type RecessTabId = string;

export default function SekiraView({ onOpenCalculator, externalTab, onExternalConsumed }: {
  onOpenCalculator?: () => void;
  // Deep-link from another tab (e.g. a schedule arena's "לסקירה המלאה"):
  // open on this sekira tab, then let the parent clear the request.
  externalTab?: RecessTabId | null;
  onExternalConsumed?: () => void;
}) {
  const [tab, setTab] = useState<RecessTabId>(externalTab ?? SEKIRA_TABS[0].id);
  const [shareOpen, setShareOpen] = useState(false);
  // Portal target for the print-only version — rendered as a direct child of
  // <body> so print CSS can display:none everything else (no blank pages)
  const [printHost, setPrintHost] = useState<HTMLElement | null>(null);
  useEffect(() => setPrintHost(document.body), []);

  useEffect(() => {
    if (externalTab) {
      setTab(externalTab);
      onExternalConsumed?.();
    }
  }, [externalTab, onExternalConsumed]);

  // The browser uses document.title as the PDF filename and page header —
  // swap it for the print, restore afterwards
  function printPdf() {
    const prev = document.title;
    document.title = `זמן בחירות - סקירה - ${daysToElection()} יום לבחירות`;
    const restore = () => {
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 2000);
  }

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
        <button type="button" className={styles.pdfBtn} onClick={printPdf}>
          הורדת PDF
        </button>
      </div>

      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}

      {/* Full print version — portaled to <body> and hidden on screen;
          window.print() renders ONLY it (clean Hebrew RTL, no blank pages) */}
      {printHost && createPortal(
        <div className={`sekira-print-root ${styles.wrap}`}>
          <div className={styles.heading}>
            <h1>זמן בחירות — סקירה</h1>
            <div className={styles.headingSub}>
              {RECESS_UPDATED} · {daysToElection()} {ELECTION_LABEL}
            </div>
          </div>
          {SEKIRA_TABS.map(t => (
            <div key={t.id} className="sekira-print-section">
              <div className={styles.printArena}>{t.label}</div>
              <TabBody tab={t} printMode />
            </div>
          ))}
          <Sources />
        </div>,
        printHost
      )}

      <div className={styles.subTabs} style={{ maxWidth: 640, margin: '0 auto 22px' }}>
        {SEKIRA_TABS.map(t => (
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

      {(() => {
        const cur = SEKIRA_TABS.find(t => t.id === tab) ?? SEKIRA_TABS[0];
        return (
          <>
            {cur.intro && <div className={styles.sectionIntro}>{cur.intro}</div>}
            <TabBody tab={cur} onOpenCalculator={onOpenCalculator} />
          </>
        );
      })()}

      <Sources />
    </div>
  );
}
