'use client';
import { useState } from 'react';
import PriceCalc from './PriceCalc';
import EduBudgetCalc from './EduBudgetCalc';
import EduOutcomesCalc from './EduOutcomesCalc';
import CrimeCalc from './CrimeCalc';
import ExternalLinks from './ExternalLinks';

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
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>
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
