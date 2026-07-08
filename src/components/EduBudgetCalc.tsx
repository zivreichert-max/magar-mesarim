'use client';
import { useState, useMemo } from 'react';
import { EDU_BUDGET, EDU_YEAR } from '@/data/eduBudget';

const NAVY = '#1e3a7b';

function fmt(n: number) {
  return n.toLocaleString('he-IL');
}

// EDU_BUDGET arrives sorted ascending by perStudent (lowest first).
// Static data → derived values are module constants, not per-render state
const total = EDU_BUDGET.length;
const maxPer = EDU_BUDGET[total - 1].perStudent;
const median = EDU_BUDGET[Math.floor(total / 2)].perStudent;
const lowest = EDU_BUDGET.slice(0, 5);                  // 5 lowest-spending
const highest = EDU_BUDGET.slice(-5).slice().reverse(); // 5 highest-spending

export default function EduBudgetCalc() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return EDU_BUDGET
      .map((x, i) => ({ ...x, rankHigh: total - i })) // 1 = highest spending
      .filter(x => x.name.includes(q))
      .sort((a, b) => b.perStudent - a.perStudent)
      .slice(0, 40);
  }, [query]);

  function Row({ name, perStudent, n }: { name: string; perStudent: number; n: number }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 78px', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid #f3f4f6' }}>
        <span style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ marginTop: 4, height: 3, background: '#f1f3f5', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(perStudent / maxPer) * 100}%`, background: NAVY, borderRadius: 2 }} />
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textAlign: 'left', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(perStudent)}₪
        </span>
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl', fontFamily: "var(--font-heebo), sans-serif", background: '#f9fafb', minHeight: '100%', paddingBottom: 80 }}>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>

          {/* Header */}
          <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 3 }}>
              הוצאה על תלמיד לפי רשות
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
              סך ההוצאה החינוכית של הרשות לתלמיד, {EDU_YEAR} · {total} רשויות · חציון ארצי {fmt(median)}₪
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '14px 18px' }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="חיפוש רשות"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #e5e7eb',
                background: '#f9fafb', fontFamily: 'inherit', fontSize: 14, color: '#111827',
                outline: 'none', boxSizing: 'border-box', direction: 'rtl',
              }}
            />

            {query.trim() && (
              <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                {results.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>לא נמצאה רשות בשם זה</div>
                ) : results.map((r, idx) => {
                  const diff = Math.round(((r.perStudent - median) / median) * 100);
                  const above = r.perStudent >= median;
                  return (
                    <div key={r.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', borderBottom: idx < results.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          מקום {r.rankHigh} מתוך {total} · {above ? 'מעל' : 'מתחת ל'}חציון ({above ? '+' : '−'}{Math.abs(diff)}%)
                        </div>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: NAVY, direction: 'ltr', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {fmt(r.perStudent)}₪
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top / bottom 5 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 0, borderTop: '1px solid #e5e7eb' }}>
            <div style={{ borderLeft: '1px solid #e5e7eb' }}>
              <div style={{ padding: '12px 14px 8px', fontSize: 12, fontWeight: 700, color: NAVY }}>
                5 הרשויות עם ההוצאה הנמוכה ביותר
              </div>
              {lowest.map((x, i) => <Row key={x.name} name={x.name} perStudent={x.perStudent} n={i + 1} />)}
            </div>
            <div>
              <div style={{ padding: '12px 14px 8px', fontSize: 12, fontWeight: 700, color: NAVY }}>
                5 הרשויות עם ההוצאה הגבוהה ביותר
              </div>
              {highest.map((x, i) => <Row key={x.name} name={x.name} perStudent={x.perStudent} n={i + 1} />)}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid #f3f4f6', background: '#fafbfc', fontSize: 10, color: '#9ca3af', lineHeight: 1.7 }}>
            מדד: סך ההוצאה על חינוך של הרשות חלקי מספר התלמידים ({EDU_YEAR}). מקור: הלמ&quot;ס / משרד הפנים — נתוני הוצאה על חינוך לפי רשות. אינו כולל את שכר המורים הממומן ישירות ע&quot;י משרד החינוך.
          </div>
        </div>
      </div>
    </div>
  );
}
