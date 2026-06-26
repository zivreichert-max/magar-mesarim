'use client';
import { SEKIRA_WEEK, SEKIRA_HIGHLIGHTS } from '@/data/sekira';
import { findPaperForText } from './sekiraMatch';
import { Paper } from '@/data/papers';
import styles from './Sekira.module.css';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const DAY_ORDER = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'];

// Date label per weekday, derived from SEKIRA_WEEK. Handles single-month
// ("14–18 ביוני 2026") and cross-month ("28 ביוני – 2 ביולי 2026") forms.
function dayDates(): Record<string, string> {
  let start = NaN, monIdx = -1, year = NaN;
  let m = SEKIRA_WEEK.match(/(\d{1,2})\s+ב?(\S+?)\s*[–-]\s*\d{1,2}\s+ב?\S+?\s+(\d{4})/);
  if (m) { start = parseInt(m[1]); monIdx = MONTHS.indexOf(m[2]); year = parseInt(m[3]); }
  else {
    m = SEKIRA_WEEK.match(/(\d{1,2})\s*[–-]\s*\d{1,2}\s+ב?(\S+)\s+(\d{4})/);
    if (m) { start = parseInt(m[1]); monIdx = MONTHS.indexOf(m[2]); year = parseInt(m[3]); }
  }
  if (monIdx < 0 || isNaN(start)) return {};
  const map: Record<string, string> = {};
  DAY_ORDER.forEach((d, i) => {
    const dt = new Date(year, monIdx, start + i);
    map[d] = `${dt.getDate()}.${dt.getMonth() + 1}`;
  });
  return map;
}

// Notable events as a day grid — same "sharp" squares as the parliamentary arena.
export default function SekiraHighlights({ onOpenPaper }: { onOpenPaper?: (p: Paper) => void }) {
  const dates = dayDates();
  const byDay = DAY_ORDER
    .map(day => ({ day, items: SEKIRA_HIGHLIGHTS.filter(h => h.day === day) }))
    .filter(d => d.items.length > 0);

  if (byDay.length === 0) {
    return <div style={{ fontSize: 12, color: '#cbd5e1', padding: '20px 0', textAlign: 'center' }}>אין אירועים בולטים השבוע</div>;
  }

  const fillers = (3 - (byDay.length % 3)) % 3;

  return (
    <div className={styles.sharpGrid}>
      {byDay.map(({ day, items }) => (
        <div key={day} className={styles.sharpCol}>
          <div className={styles.sharpDay}>
            <div className={styles.sharpDayName}>{day}</div>
            {dates[day] && <div className={styles.sharpDayDate}>{dates[day]}</div>}
          </div>
          {items.map((h, i) => {
            const isWindow = h.date.includes('–');
            const paper = onOpenPaper ? findPaperForText(`${h.category} ${h.title}`) : null;
            return (
              <div key={i} className={styles.sharpItem}>
                <div className={styles.sharpItemHead}>
                  {h.category}
                  {isWindow && <span style={{ fontWeight: 400, color: '#9ca3af' }}> · {h.date}</span>}
                </div>
                <div className={styles.evTitle} style={{ marginBottom: h.detail ? 4 : 6 }}>{h.title}</div>
                {h.detail && <div className={`${styles.sharpItemTopic} ${styles.hlClamp}`}>{h.detail}</div>}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  {paper && (
                    <button type="button" className={styles.sharpPaper} onClick={() => onOpenPaper!(paper)}>
                      נייר עמדה ↗
                    </button>
                  )}
                  {h.url && (
                    <a className={styles.sharpPaper} href={h.url} target="_blank" rel="noreferrer">מקור ↗</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {Array.from({ length: fillers }).map((_, i) => (
        <div key={`f${i}`} className={`${styles.sharpCol} ${styles.sharpFiller}`} />
      ))}
    </div>
  );
}
