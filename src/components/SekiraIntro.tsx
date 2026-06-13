'use client';
import { SEKIRA_WEEK, SEKIRA_PARLIAMENTARY, SEKIRA_MEDIA } from '@/data/sekira';
import styles from './Sekira.module.css';

// First-entry onboarding overlay. Self-contained: sits above the app after the
// password gate; "כניסה"/"דלג" calls onEnter() which removes it. Paper links
// here are visual only — linking lives in the in-app סקירה tab.
export default function SekiraIntro({ onEnter }: { onEnter: () => void }) {
  return (
    <div className={styles.intro}>
      <button type="button" className={styles.btnSkip} onClick={onEnter}>דלג ←</button>

      {/* Hero */}
      <section className={`${styles.introSection} ${styles.introHero}`}>
        <div className={styles.logoBox}>בונים<br />מחדש</div>
        <h1 className={styles.heroH1}>סקירה שבועית</h1>
        <div className={styles.heroSub}>בחירות 2026 · בונים מחדש</div>
        <div className={styles.heroWeek}>{SEKIRA_WEEK}</div>
        <div className={styles.scrollHint}><span>גלול למטה</span><span style={{ fontSize: 18 }}>↓</span></div>
      </section>

      {/* Parliamentary — calendar grid */}
      <section className={styles.introSection} style={{ background: '#fff' }}>
        <div className={styles.introContent}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span className={styles.arenaTag}>חלק א&apos;</span>
            <div className={styles.arenaTitle}>הזירה הפרלמנטרית</div>
            <div className={styles.arenaDesc} style={{ margin: '0 auto' }}>
              מה צפוי השבוע בוועדות הכנסת. בתוך האתר, לחיצה על כל נושא מובילה לנייר העמדה שלנו.
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
                    <div key={ei} className={styles.calItem}>
                      <div className={styles.calTime}>{ev.time || '—'}</div>
                      <div className={styles.calCommittee}>{ev.committee}</div>
                      <div className={styles.calTopic}>{ev.topic}</div>
                      <div className={`${styles.calPaper} ${ev.hasPaper ? '' : styles.empty}`}>
                        {ev.hasPaper ? 'נייר עמדה ↗' : 'טרם הוכן'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Media — topic blocks */}
      <section className={styles.introSection} style={{ background: '#f9fafb' }}>
        <div className={`${styles.introContent} ${styles.narrow}`}>
          <span className={styles.arenaTag} style={{ color: '#2077BB', borderColor: '#2077BB' }}>חלק ב&apos;</span>
          <div className={styles.arenaTitle}>הזירה התקשורתית</div>
          <div className={styles.arenaDesc}>הסיפורים המרכזיים על סדר היום הציבורי — מחולק לפי נושאים.</div>

          {SEKIRA_MEDIA.map((t, i) => (
            <div key={i} className={styles.topicBlock}>
              <div className={styles.topicName}>{t.topic}</div>
              {t.points.length === 0 ? (
                <div className={styles.topicEmpty}>יתעדכן בהמשך</div>
              ) : t.points.map((p, j) => (
                <div key={j} className={styles.topicPoint}>{p}</div>
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
