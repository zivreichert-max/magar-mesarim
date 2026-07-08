'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import ExternalLinks from './ExternalLinks';

// Each calculator carries its own large generated data file (crime.ts alone is
// ~2,300 lines) — loaded on demand so none of it ships in the main bundle
const calcLoading = () => (
  <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>טוען…</div>
);
const PriceCalc = dynamic(() => import('./PriceCalc'), { loading: calcLoading });
const EduBudgetCalc = dynamic(() => import('./EduBudgetCalc'), { loading: calcLoading });
const EduOutcomesCalc = dynamic(() => import('./EduOutcomesCalc'), { loading: calcLoading });
const CrimeCalc = dynamic(() => import('./CrimeCalc'), { loading: calcLoading });

type CalcId = 'prices' | 'edu' | 'eduOutcomes' | 'crime' | 'external';

const CALCS: { id: CalcId; label: string }[] = [
  { id: 'prices', label: 'התייקרויות' },
  { id: 'edu', label: 'הוצאה על תלמיד' },
  { id: 'eduOutcomes', label: 'הישגים בחינוך' },
  { id: 'crime', label: 'פשיעה ורצח' },
  { id: 'external', label: 'מחשבונים חיצוניים' },
];

const EXTERNAL_CALCS = [
  { label: 'התגייסות, קצונה ושירות קרבי', url: 'https://recruitment-data.vercel.app/he', desc: 'נתוני גיוס, קצונה ושירות קרבי לאורך השנים' },
  { label: 'מעקב חוקי ההפיכה המשפטית', url: 'https://www.demonitor.org.il/', desc: 'דמוקרטים — מעקב אחר חקיקת המהפכה המשפטית' },
];

export default function CalculatorsHub() {
  const [active, setActive] = useState<CalcId>('prices');

  return (
    <div style={{ direction: 'rtl', fontFamily: "var(--font-heebo), sans-serif" }}>
      {/* Calculator selector */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 24px 0', background: '#f9fafb', flexWrap: 'wrap' }}>
        {CALCS.map(c => {
          const isActive = active === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              style={{
                padding: '8px 18px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: isActive ? '#2077BB' : '#e5e7eb',
                background: isActive ? '#2077BB' : '#fff',
                color: isActive ? '#fff' : '#6b7280',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {active === 'prices' && <PriceCalc />}
      {active === 'edu' && <EduBudgetCalc />}
      {active === 'eduOutcomes' && <EduOutcomesCalc />}
      {active === 'crime' && <CrimeCalc />}
      {active === 'external' && (
        <div style={{ padding: '24px', maxWidth: 640 }}>
          <ExternalLinks links={EXTERNAL_CALCS} />
        </div>
      )}
    </div>
  );
}
