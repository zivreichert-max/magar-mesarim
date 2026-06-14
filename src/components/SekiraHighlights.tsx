'use client';
import { useState } from 'react';
import { SEKIRA_HIGHLIGHTS } from '@/data/sekira';
import styles from './Sekira.module.css';

// Notable events in a לו"ז-style table: date | category | event, expandable to
// the full detail + source. Shared by the סקירה tab and the intro overlay.
export default function SekiraHighlights() {
  const [open, setOpen] = useState<number | null>(null);

  if (SEKIRA_HIGHLIGHTS.length === 0) {
    return <div style={{ fontSize: 12, color: '#cbd5e1', padding: '20px 0', textAlign: 'center' }}>אין אירועים בולטים השבוע</div>;
  }

  return (
    <div className={styles.hlTable}>
      <div className={styles.hlHead}><div>תאריך</div><div>סוג</div><div>אירוע</div><div /></div>
      {SEKIRA_HIGHLIGHTS.map((h, i) => {
        const isOpen = open === i;
        const hasDetail = !!h.detail;
        return (
          <div
            key={i}
            className={`${styles.hlRow} ${isOpen ? styles.hlOpen : ''} ${hasDetail ? '' : styles.hlNoexp}`}
            onClick={() => hasDetail && setOpen(isOpen ? null : i)}
          >
            <div className={styles.hlDate}>{h.date}</div>
            <div className={styles.hlCat}>{h.category}</div>
            <div className={styles.hlMain}>
              <div className={styles.hlTitle}>{h.title}</div>
              {h.detail && <div className={styles.hlSnippet}>{h.detail}</div>}
            </div>
            <div className={styles.hlX}><span className={styles.hlChev}>›</span></div>

            {hasDetail && (
              <div className={styles.hlPanel}><div><div className={styles.hlPanelIn}>
                <p>{h.detail}</p>
                {h.url && (
                  <a href={h.url} target="_blank" rel="noreferrer" className={styles.hlLink} onClick={e => e.stopPropagation()}>
                    מקור ↗
                  </a>
                )}
              </div></div></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
