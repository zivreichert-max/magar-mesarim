'use client';
import { useState, useMemo } from 'react';
import {
  EDU_OUTCOMES, EDU_METRICS, EDU_NATIONAL, EduMetricKey, EduLocalityOutcome,
} from '@/data/eduOutcomes';

const ACCENT = '#2077BB';

function f1(v: number) { return v.toFixed(1); }

interface RankedRow {
  name: string;
  y2022: number;
  y2024: number;
  diff: number;
}

function rankedFor(metric: EduMetricKey): RankedRow[] {
  return EDU_OUTCOMES
    .filter(l => l.metrics[metric].y2022 != null && l.metrics[metric].y2024 != null)
    .map(l => {
      const a = l.metrics[metric].y2022 as number;
      const b = l.metrics[metric].y2024 as number;
      return { name: l.name, y2022: a, y2024: b, diff: Math.round((b - a) * 10) / 10 };
    });
}

export default function EduOutcomesCalc() {
  const [metricKey, setMetricKey] = useState<EduMetricKey>('bagrut');
  const [mode, setMode] = useState<'drops' | 'rises'>('drops');
  const [query, setQuery] = useState('');

  const metric = EDU_METRICS.find(m => m.key === metricKey)!;
  const nat = EDU_NATIONAL[metricKey];

  const ranked = useMemo(() => rankedFor(metricKey), [metricKey]);

  // Default lists: biggest movers in the selected direction
  const movers = useMemo(() => {
    const sorted = [...ranked].sort((a, b) => mode === 'drops' ? a.diff - b.diff : b.diff - a.diff);
    return sorted.slice(0, 5);
  }, [ranked, mode]);

  // Search results across all localities (any with data for this metric)
  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return EDU_OUTCOMES
      .filter(l => l.name.includes(q))
      .map(l => ({
        name: l.name,
        y2022: l.metrics[metricKey].y2022,
        y2024: l.metrics[metricKey].y2024,
        cluster: l.cluster,
      }))
      .slice(0, 30);
  }, [query, metricKey]);

  function MoverRow({ r, i }: { r: RankedRow; i: number }) {
    const dir = r.diff > 0 ? 'up' : r.diff < 0 ? 'down' : 'flat';
    const color = dir === 'up' ? '#15803d' : dir === 'down' ? '#b91c1c' : '#9ca3af';
    const sign = r.diff > 0 ? '▲ +' : r.diff < 0 ? '▼ ' : '= ';
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 52px 52px 64px', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
        <span style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center' }}>{i + 1}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
        <span style={{ fontSize: 12.5, color: '#9ca3af', textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{f1(r.y2022)}</span>
        <span style={{ fontSize: 13, color: '#1e3a7b', fontWeight: 700, textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{f1(r.y2024)}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color, textAlign: 'left', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{sign}{Math.abs(r.diff).toFixed(1)}</span>
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif", background: '#f9fafb', minHeight: '100%', paddingBottom: 80 }}>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>

          {/* Header */}
          <div style={{ padding: '16px 18px 12px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 3 }}>
              הישגים בחינוך — השוואת 2022 ↔ 2024
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
              בחרו מדד · {EDU_OUTCOMES.length} רשויות · השינוי מוצג בנקודות אחוז (נ״א)
            </div>
          </div>

          {/* Metric pills */}
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb' }}>
            {EDU_METRICS.map(m => {
              const on = m.key === metricKey;
              return (
                <button key={m.key} type="button" onClick={() => setMetricKey(m.key)}
                  style={{ padding: '6px 14px', borderRadius: 16, border: `1px solid ${on ? ACCENT : '#e5e7eb'}`, background: on ? ACCENT : '#fff', color: on ? '#fff' : '#6b7280', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* National-average banner — always visible */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', background: '#f0f6fc', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0c447c' }}>
              ממוצע הרשויות — {metric.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>{nat.y2022 != null ? `${f1(nat.y2022)}%` : '—'}</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>→</span>
              <span style={{ fontSize: 16, color: '#0c447c', fontWeight: 800 }}>{nat.y2024 != null ? `${f1(nat.y2024)}%` : '—'}</span>
              {nat.y2022 != null && nat.y2024 != null && (
                <span style={{ fontSize: 12, fontWeight: 800, color: nat.y2024 - nat.y2022 >= 0 ? '#15803d' : '#b91c1c' }}>
                  ({nat.y2024 - nat.y2022 >= 0 ? '+' : ''}{(nat.y2024 - nat.y2022).toFixed(1)})
                </span>
              )}
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '14px 18px 6px' }}>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 חיפוש רשות..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontFamily: 'inherit', fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box', direction: 'rtl' }} />
          </div>

          {/* Search results OR default movers */}
          <div style={{ padding: '6px 18px 16px' }}>
            {query.trim() ? (
              searchResults.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>לא נמצאה רשות בשם זה</div>
              ) : (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                  {searchResults.map(r => {
                    const a = r.y2022, b = r.y2024;
                    const hasBoth = a != null && b != null;
                    const diff = hasBoth ? (b as number) - (a as number) : null;
                    const color = diff == null ? '#9ca3af' : diff >= 0 ? '#15803d' : '#b91c1c';
                    const vsNat = b != null && nat.y2024 != null ? (b as number) - nat.y2024 : null;
                    return (
                      <div key={r.name} style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.name}</div>
                            <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 2 }}>
                              {r.cluster != null ? `אשכול סוציו-אקונומי ${r.cluster} · ` : ''}
                              {vsNat != null ? `${vsNat >= 0 ? 'מעל' : 'מתחת ל'}ממוצע (${vsNat >= 0 ? '+' : ''}${vsNat.toFixed(1)} נ״א)` : 'אין נתון 2024'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>{a != null ? `${f1(a)}%` : '—'}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>→</span>
                            <span style={{ fontSize: 16, color: ACCENT, fontWeight: 800 }}>{b != null ? `${f1(b)}%` : '—'}</span>
                            {diff != null && (
                              <span style={{ fontSize: 12.5, fontWeight: 800, color }}>{diff >= 0 ? '+' : ''}{diff.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <>
                {/* Drops / rises toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {([['drops', 'הירידות החדות ביותר'], ['rises', 'העליות הגדולות ביותר']] as const).map(([k, label]) => {
                    const on = mode === k;
                    return (
                      <button key={k} type="button" onClick={() => setMode(k)}
                        style={{ padding: '5px 12px', borderRadius: 14, border: `1px solid ${on ? (k === 'drops' ? '#b91c1c' : '#15803d') : '#e5e7eb'}`, background: on ? (k === 'drops' ? '#b91c1c' : '#15803d') : '#fff', color: on ? '#fff' : '#6b7280', fontFamily: 'inherit', fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: mode === 'drops' ? '#b91c1c' : '#15803d', marginBottom: 8 }}>
                  5 הרשויות עם {mode === 'drops' ? 'הירידה החדה' : 'העלייה הגדולה'} ביותר ב{metric.label}
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 52px 52px 64px', gap: 8, padding: '6px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
                    <span style={{ textAlign: 'center' }}>#</span>
                    <span>רשות</span>
                    <span style={{ textAlign: 'center' }}>2022</span>
                    <span style={{ textAlign: 'center' }}>2024</span>
                    <span style={{ textAlign: 'left', direction: 'ltr' }}>שינוי</span>
                  </div>
                  {movers.map((r, i) => <MoverRow key={r.name} r={r} i={i} />)}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid #f3f4f6', background: '#fafbfc', fontSize: 10, color: '#9ca3af', lineHeight: 1.7 }}>
            המדדים: שיעור הזכאים מתוך הלומדים בכל רשות. &quot;ממוצע הרשויות&quot; = ממוצע לא-משוקלל על פני הרשויות בעלות נתונים. מקור: משרד החינוך — דוח תמונה חינוכית רשותי / שקיפות בחינוך, תשפ&quot;ב (2022) ו-תשפ&quot;ד (2024).
          </div>
        </div>
      </div>
    </div>
  );
}
