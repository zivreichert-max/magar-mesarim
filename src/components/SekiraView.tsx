'use client';
import { useState } from 'react';
import { SEKIRA_WEEK, SEKIRA_PARLIAMENTARY, SEKIRA_MEDIA, SekiraEvent } from '@/data/sekira';
import { Paper } from '@/data/papers';
import { findPaperForText } from './sekiraMatch';
import SekiraHighlights from './SekiraHighlights';
import styles from './Sekira.module.css';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

// Per-day date labels derived from SEKIRA_WEEK, e.g. "14–18 ביוני 2026" → 14.6, 15.6…
function weekDates(): string[] {
  const m = SEKIRA_WEEK.match(/(\d{1,2})\s*[–-]\s*\d{1,2}\s+ב?(\S+)\s+(\d{4})/);
  if (!m) return [];
  const startDay = parseInt(m[1]);
  const monthIdx = MONTHS.indexOf(m[2]);
  const year = parseInt(m[3]);
  if (monthIdx < 0) return [];
  return SEKIRA_PARLIAMENTARY.map((_, i) => {
    const d = new Date(year, monthIdx, startDay + i);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  });
}

// Paper to open for a hasPaper parliamentary event: the matched one, or an empty
// placeholder (title only) when the paper hasn't been written yet.
export function paperForEvent(ev: SekiraEvent): Paper {
  return findPaperForText(`${ev.committee} ${ev.topic}`) ?? {
    id: 0, title: ev.topic, tag: ev.committee, summary: '', sections: [], bottomLine: '',
  };
}

export default function SekiraView({ onOpenPaper }: { onOpenPaper: (p: Paper) => void }) {
  const [arena, setArena] = useState<'parl' | 'events' | 'media'>('parl');
  const dates = weekDates();

  // Pad the 3-column grid so the last row stays aligned
  const fillers = (3 - (SEKIRA_PARLIAMENTARY.length % 3)) % 3;

  return (
    <div className={styles.wrap} style={{ padding: '24px', maxWidth: 1080, margin: '0 auto' }}>
      <div className={styles.heading}>
        <h1>סקירה שבועית</h1>
        <div className={styles.headingSub}>בחירות 2026 · בונים מחדש · {SEKIRA_WEEK}</div>
      </div>

      <div className={styles.subTabs}>
        <button type="button" className={`${styles.subTab} ${arena === 'parl' ? styles.active : ''}`} onClick={() => setArena('parl')}>
          זירה פרלמנטרית
        </button>
        <button type="button" className={`${styles.subTab} ${arena === 'events' ? styles.active : ''}`} onClick={() => setArena('events')}>
          אירועים בולטים
        </button>
        <button type="button" className={`${styles.subTab} ${arena === 'media' ? styles.active : ''}`} onClick={() => setArena('media')}>
          זירה תקשורתית
        </button>
      </div>

      {arena === 'parl' ? (
        <>
          <div className={styles.sectionIntro}>מה צפוי השבוע בוועדות הכנסת. לחיצה על נושא עם נייר עמדה מובילה לנייר שלנו.</div>
          <div className={styles.sharpGrid}>
            {SEKIRA_PARLIAMENTARY.map((d, di) => (
              <div key={d.day} className={styles.sharpCol}>
                <div className={styles.sharpDay}>
                  <div className={styles.sharpDayName}>{d.day}</div>
                  {dates[di] && <div className={styles.sharpDayDate}>{dates[di]}</div>}
                </div>
                <div className={styles.sharpSub}>בוועדות הכנסת:</div>
                {d.events.length === 0 ? (
                  <div className={styles.sharpEmpty}>אין דיונים</div>
                ) : d.events.map((ev, ei) => (
                  <div key={ei} className={styles.sharpItem}>
                    <div className={styles.sharpItemHead}>
                      {ev.time && <span className="time">{ev.time}</span>}{ev.time ? ' · ' : ''}{ev.committee}
                    </div>
                    <div className={styles.sharpItemTopic}>{ev.topic}</div>
                    {ev.hasPaper ? (
                      <button type="button" className={styles.sharpPaper} onClick={() => onOpenPaper(paperForEvent(ev))}>
                        נייר עמדה ↗
                      </button>
                    ) : (
                      <span className={`${styles.sharpPaper} ${styles.empty}`}>טרם הוכן</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {Array.from({ length: fillers }).map((_, i) => (
              <div key={`f${i}`} className={`${styles.sharpCol} ${styles.sharpFiller}`} />
            ))}
          </div>
        </>
      ) : arena === 'events' ? (
        <>
          <div className={styles.sectionIntro}>האירועים הבולטים על ציר הזמן השבוע — ימי שנה, אירועים גאופוליטיים וכלכליים.</div>
          <SekiraHighlights onOpenPaper={onOpenPaper} />
        </>
      ) : (
        <>
          <div className={styles.sectionIntro}>הסיפורים המרכזיים על סדר היום הציבורי — מחולק לפי נושאים.</div>
          {SEKIRA_MEDIA.filter(t => t.points.length > 0).map((t, i) => (
            <div key={i} className={styles.topicBlock}>
              <div className={styles.topicName}>{t.topic}</div>
              {t.points.map((p, j) => (
                <div key={j} className={styles.topicPoint}>
                  {p.heading && <span className={styles.topicHeading}>{p.heading}: </span>}
                  {p.text}
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer" className={styles.topicLink}>לכתבה ↗</a>}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
