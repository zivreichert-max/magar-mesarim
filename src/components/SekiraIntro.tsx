'use client';
import { useEffect, useRef } from 'react';
import { RECESS_TITLE, RECESS_UPDATED, ELECTION_LABEL, daysToElection } from '@/data/recess';
import { KnessetTab, GovTab, CourtTab, EventsTab } from './SekiraView';
import styles from './Sekira.module.css';

// First-entry onboarding overlay. Self-contained: sits above the app after the
// password gate. "כניסה"/"דלג" calls onEnter(). One slide per arena of the
// recess sekira, reusing the tab components from SekiraView.
export default function SekiraIntro({ onEnter }: { onEnter: () => void }) {
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

  const ARENAS = [
    { tag: 'זירה ראשונה', title: 'הכנסת — מה מותר ומה טעון אישור', desc: 'ועדת ההסכמות, החריגים, והחקיקה שעדיין אפשרית במליאה.', body: <KnessetTab />, bg: '#fff' },
    { tag: 'זירה שנייה', title: 'הממשלה — ממשלה יוצאת תחת חובת איפוק', desc: 'מכתב היועמ"שית והחלטות ישיבת הממשלה האחרונה.', body: <GovTab />, bg: '#f9fafb' },
    { tag: 'זירה שלישית', title: 'בג"ץ — גורל חקיקת סוף המושב', desc: 'מעקב אחר העתירות וההקפאות של חוקי סוף המושב.', body: <CourtTab />, bg: '#fff' },
    { tag: 'זירה רביעית', title: 'לוח אירועים — השבועיים הקרובים', desc: 'התאריכים שקובעים את קצב התקופה.', body: <EventsTab />, bg: '#f9fafb' },
  ];

  return (
    <div className={styles.intro} ref={introRef}>
      <button type="button" className={styles.btnSkip} onClick={onEnter}>דלג ←</button>

      {/* Hero */}
      <section className={`${styles.introSection} ${styles.introHero}`}>
        <div className={styles.logoBox}>בונים<br />מחדש</div>
        <h1 className={styles.heroH1}>{RECESS_TITLE}</h1>
        <div className={styles.heroSub}>בחירות 2026 · בונים מחדש</div>
        <div className={styles.heroWeek}>{RECESS_UPDATED}</div>
        <div className={styles.heroCountNum}>{daysToElection()}</div>
        <div className={styles.heroCountLbl}>{ELECTION_LABEL}</div>
        <div className={styles.scrollHint} onClick={() => goToSection(1)} style={{ cursor: 'pointer' }}>
          <span>גלול או הקש חיצים</span><span style={{ fontSize: 18 }}>↓</span>
        </div>
      </section>

      {ARENAS.map((a, i) => (
        <section key={i} className={styles.introSection} style={{ background: a.bg }}>
          <div className={styles.introContent}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <span className={styles.arenaTag}>{a.tag}</span>
              <div className={styles.arenaTitle}>{a.title}</div>
              <div className={styles.arenaDesc} style={{ margin: '0 auto' }}>{a.desc}</div>
            </div>
            <div className={styles.wrap}>{a.body}</div>
            {i === ARENAS.length - 1 && (
              <div className={styles.introContinue}>
                <button type="button" className={styles.btnContinue} onClick={onEnter}>כניסה לאתר ←</button>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
