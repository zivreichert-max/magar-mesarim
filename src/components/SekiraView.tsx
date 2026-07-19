'use client';
import { useEffect, useState } from 'react';
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

function ExpView({ exp, onOpenCalculator }: { exp: RExpandable; onOpenCalculator?: () => void }) {
  return (
    <details className={styles.exp}>
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

function CardView({ card, onOpenCalculator }: { card: RCard; onOpenCalculator?: () => void }) {
  return (
    <div className={styles.topicBlock}>
      <div className={styles.topicName}>
        {card.title}
        {card.tag && <TagChip tag={card.tag} />}
      </div>
      {card.paras.map((p, i) => <ParaView key={i} p={p} />)}
      {card.expandables?.map((e, i) => <ExpView key={i} exp={e} onOpenCalculator={onOpenCalculator} />)}
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

export function KnessetTab({ onOpenCalculator }: { onOpenCalculator?: () => void }) {
  return (
    <>
      {KNESSET_BLOCKS.map((b, i) =>
        b.type === 'card' ? <CardView key={i} card={b.card} onOpenCalculator={onOpenCalculator} />
        : b.type === 'permGrid' ? (
          <div key={i} className={styles.permGrid}>
            <PermBox list={b.green} kind="green" />
            <PermBox list={b.amber} kind="amber" />
          </div>
        )
        : <ExpView key={i} exp={b.exp} />
      )}
    </>
  );
}

export function GovTab() {
  return <>{GOV_CARDS.map((c, i) => <CardView key={i} card={c} />)}</>;
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

export function EventsTab() {
  return (
    <div className={styles.topicBlock}>
      <ul className={styles.tl}>
        {TIMELINE.map((t, i) => (
          <li key={i} className={t.milestone ? styles.tlMilestone : ''}>
            <span className={styles.tlDate}>{t.date}</span>
            {' · '}
            <Rich text={t.text} />
            <Links links={t.links} />
          </li>
        ))}
      </ul>
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
