'use client';
import { useEffect, useRef } from 'react';
import { SEKIRA_WEEK, SEKIRA_PARLIAMENTARY, SEKIRA_HIGHLIGHTS, SEKIRA_MEDIA } from '@/data/sekira';
import { paperForEvent } from './SekiraView';
import { Paper } from '@/data/papers';
import styles from './Sekira.module.css';

// First-entry onboarding overlay. Self-contained: sits above the app after the
// password gate. "כניסה"/"דלג" calls onEnter(); clicking a paper link enters the
// app and opens that paper via onOpenPaper.
export default function SekiraIntro({ onEnter, onOpenPaper }: {
  onEnter: () => void;
  onOpenPaper: (p: Paper) => void;
}) {
  const introRef = useRef<HTMLDivElement>(null);

  // Arrow keys / PageUp-Down move between slides (in addition to scroll-snap).
  // RTL: forward = Down/Left, back = Up/Right.
  useEffect(() => {
    const NEXT = ['ArrowDown', 'ArrowLeft', 'PageDown'];
    const PREV = ['ArrowUp', 'ArrowRight', 'PageUp'];
    function onKey(e: KeyboardEvent) {
      const el = introRef.current;
      if (!el) return;
      if (![...NEXT, ...PREV].includes(e.key)) return;
      e.preventDefault();
      const h = el.clientHeight;
      const total = el.querySelectorAll('section').length;
      const cur = Math.round(el.scrollTop / h);
      const target = NEXT.includes(e.key) ? Math.min(cur + 1, total - 1) : Math.max(cur - 1, 0);
      el.scrollTo({ top: target * h, behavior: 'smooth' });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function goToSection(i: number) {
    const el = introRef.current;
    if (el) el.scrollTo({ top: i * el.clientHeight, behavior: 'smooth' });
  }

  return (
    <div className={styles.intro} ref={introRef}>
      <button type="button" className={styles.btnSkip} onClick={onEnter}>דלג ←</button>

      {/* Hero */}
      <section className={`${styles.introSection} ${styles.introHero}`}>
        <div className={styles.logoBox}>בונים<br />מחדש</div>
        <h1 className={styles.heroH1}>סקירה שבועית</h1>
        <div className={styles.heroSub}>בחירות 2026 · בונים מחדש</div>
        <div className={styles.heroWeek}>{SEKIRA_WEEK}</div>
        <div className={styles.scrollHint} onClick={() => goToSection(1)} style={{ cursor: 'pointer' }}>
          <span>גלול או הקש חיצים</span><span style={{ fontSize: 18 }}>↓</span>
        </div>
      </section>

      {/* Parliamentary — calendar grid */}
      <section className={styles.introSection} style={{ background: '#fff' }}>
        <div className={styles.introContent}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span className={styles.arenaTag}>חלק א&apos;</span>
            <div className={styles.arenaTitle}>הזירה הפרלמנטרית</div>
            <div className={styles.arenaDesc} style={{ margin: '0 auto' }}>
              מה צפוי השבוע בוועדות הכנסת. לחיצה על נושא עם נייר עמדה מובילה לנייר שלנו.
            </div>
          </div>
          <div className={styles.calGrid}>
            {SEKIRA_PARLIAMENTARY.map(d => (
              <div key={d.day} className={styles.calCol}>
                <div className={styles.calHead}>{d.day.replace('יום ', '')}</div>
                <div className={styles.calBody}>
                  {d.events.length === 0 ? (
                    <div className={styles.calEmpty}>—</div>
                  ) : d.events.map((ev, ei) => (
                    <div
                      key={ei}
                      className={`${styles.calItem} ${ev.hasPaper ? styles.calItemClickable : ''}`}
                      onClick={ev.hasPaper ? () => onOpenPaper(paperForEvent(ev)) : undefined}
                    >
                      <div className={styles.calTime}>{ev.time || '—'}</div>
                      <div className={styles.calCommittee}>{ev.committee}</div>
                      <div className={styles.calTopic}>{ev.topic}</div>
                      {ev.hasPaper ? (
                        <button type="button" className={styles.calPaperBtn} onClick={() => onOpenPaper(paperForEvent(ev))}>
                          נייר עמדה ↗
                        </button>
                      ) : (
                        <div className={`${styles.calPaper} ${styles.empty}`}>טרם הוכן</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights — notable events */}
      <section className={styles.introSection} style={{ background: '#f9fafb' }}>
        <div className={styles.introContent}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span className={styles.arenaTag}>חלק ב&apos;</span>
            <div className={styles.arenaTitle}>אירועים בולטים</div>
            <div className={styles.arenaDesc} style={{ margin: '0 auto' }}>
              על ציר הזמן השבוע — ימי שנה, אירועים גאופוליטיים וכלכליים.
            </div>
          </div>
          <div className={styles.evGrid}>
            {SEKIRA_HIGHLIGHTS.map((h, i) => (
              <div key={i} className={styles.evCard}>
                {h.date && <div className={styles.evDate}>{h.date}</div>}
                <div className={styles.evTitle}>{h.title}</div>
                {h.detail && <div className={styles.evDetail}>{h.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Media — topic blocks */}
      <section className={styles.introSection} style={{ background: '#fff' }}>
        <div className={`${styles.introContent} ${styles.narrow}`}>
          <span className={styles.arenaTag} style={{ color: '#2077BB', borderColor: '#2077BB' }}>חלק ג&apos;</span>
          <div className={styles.arenaTitle}>הזירה התקשורתית</div>
          <div className={styles.arenaDesc}>הסיפורים המרכזיים על סדר היום הציבורי — מחולק לפי נושאים.</div>

          {SEKIRA_MEDIA.map((t, i) => (
            <div key={i} className={styles.topicBlock}>
              <div className={styles.topicName}>{t.topic}</div>
              {t.points.length === 0 ? (
                <div className={styles.topicEmpty}>יתעדכן בהמשך</div>
              ) : t.points.map((p, j) => (
                <div key={j} className={styles.topicPoint}>
                  {p.text}
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer" className={styles.topicLink}>צפו ↗</a>}
                </div>
              ))}
            </div>
          ))}

          <div className={styles.introContinue}>
            <button type="button" className={styles.btnContinue} onClick={onEnter}>כניסה לאתר ←</button>
          </div>
        </div>
      </section>
    </div>
  );
}
