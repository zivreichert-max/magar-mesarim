'use client';
import { useState, useMemo } from 'react';
import {
  CRIME_METRICS, CRIME_DATA, CRIME_YEARS, CrimeMetricKey,
} from '@/data/crime';

const ACCENT = '#b91c1c';

interface MoverRow { name: string; v: number[]; first: number; last: number; delta: number; }

// Year-by-year mini bar chart for one locality.
function YearBars({ v, partial }: { v: number[]; partial: number[] }) {
  const max = Math.max(...v, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56, direction: 'ltr' }}>
      {CRIME_YEARS.map((y, i) => {
        const isPartial = partial.includes(y);
        const h = Math.round((v[i] / max) * 44) + 2;
        return (
          <div key={y} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{v[i]}</span>
            <div title={isPartial ? 'שנה חלקית' : ''} style={{
              width: '100%', maxWidth: 26, height: h, borderRadius: '3px 3px 0 0',
              background: isPartial ? 'repeating-linear-gradient(45deg,#fca5a5,#fca5a5 3px,#fecaca 3px,#fecaca 6px)' : '#b91c1c',
            }} />
            <span style={{ fontSize: 9.5, color: isPartial ? '#9ca3af' : '#6b7280' }}>{`'${String(y).slice(2)}`}{isPartial ? '*' : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ v }: { v: number[] }) {
  const max = Math.max(...v, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22, direction: 'ltr' }}>
      {v.map((n, i) => (
        <div key={i} style={{ width: 5, height: Math.round((n / max) * 18) + 2, background: '#d1a3a3', borderRadius: 1 }} />
      ))}
    </div>
  );
}

export default function CrimeCalc() {
  const [metricKey, setMetricKey] = useState<CrimeMetricKey>('murder');
  const [mode, setMode] = useState<'rise' | 'fall'>('rise');
  const [query, setQuery] = useState('');

  const metric = CRIME_METRICS.find(m => m.key === metricKey)!;
  const rows = CRIME_DATA[metricKey];

  // Complete-year window (exclude partial years from the trend computation)
  const { firstIdx, lastIdx, firstYear, lastYear } = useMemo(() => {
    const complete = CRIME_YEARS.map((y, i) => ({ y, i })).filter(o => !metric.partialYears.includes(o.y));
    const fi = complete[0], li = complete[complete.length - 1];
    return { firstIdx: fi.i, lastIdx: li.i, firstYear: fi.y, lastYear: li.y };
  }, [metric]);

  const movers = useMemo<MoverRow[]>(() => {
    const list = rows.map(r => ({
      name: r.name, v: r.v, first: r.v[firstIdx], last: r.v[lastIdx],
      delta: r.v[lastIdx] - r.v[firstIdx],
    }));
    list.sort((a, b) => mode === 'rise'
      ? (b.delta - a.delta) || (b.last - a.last)
      : (a.delta - b.delta) || (b.first - a.first));
    return list.slice(0, 5);
  }, [rows, mode, firstIdx, lastIdx]);

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return rows.filter(r => r.name.includes(q)).slice(0, 20);
  }, [rows, query]);

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif", background: '#f9fafb', minHeight: '100%', paddingBottom: 80 }}>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>

          {/* Header */}
          <div style={{ padding: '16px 18px 12px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 3 }}>
              פשיעה ורצח לפי רשות — 2021–2025
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
              בחרו סוג עבירה · ארצי {metric.label}: {metric.national[firstIdx].toLocaleString('he-IL')} ({firstYear}) → {metric.national[lastIdx].toLocaleString('he-IL')} ({lastYear})
            </div>
          </div>

          {/* Metric pills */}
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb' }}>
            {CRIME_METRICS.map(m => {
              const on = m.key === metricKey;
              return (
                <button key={m.key} type="button" onClick={() => { setMetricKey(m.key); }}
                  style={{ padding: '6px 13px', borderRadius: 16, border: `1px solid ${on ? ACCENT : '#e5e7eb'}`, background: on ? ACCENT : '#fff', color: on ? '#fff' : '#6b7280', fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ padding: '14px 18px 6px' }}>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 חיפוש רשות..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontFamily: 'inherit', fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box', direction: 'rtl' }} />
          </div>

          <div style={{ padding: '6px 18px 16px' }}>
            {query.trim() ? (
              searchResults.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>לא נמצאה רשות בשם זה</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {searchResults.map(r => {
                    const delta = r.v[lastIdx] - r.v[firstIdx];
                    const color = delta > 0 ? '#b91c1c' : delta < 0 ? '#15803d' : '#9ca3af';
                    return (
                      <div key={r.name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700, color: '#111827' }}>{r.name}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color, direction: 'ltr' }}>
                            {firstYear}→{lastYear}: {delta >= 0 ? '+' : ''}{delta}
                          </span>
                        </div>
                        <YearBars v={r.v} partial={metric.partialYears} />
                      </div>
                    );
                  })}
                  {metric.partialYears.length > 0 && (
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>* {metric.partialYears.join(', ')} — שנה חלקית (נתונים חלקיים), לא נכללת בחישוב המגמה.</div>
                  )}
                </div>
              )
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {([['rise', 'הגידול החד ביותר'], ['fall', 'הירידה החדה ביותר']] as const).map(([k, label]) => {
                    const on = mode === k;
                    const c = k === 'rise' ? '#b91c1c' : '#15803d';
                    return (
                      <button key={k} type="button" onClick={() => setMode(k)}
                        style={{ padding: '5px 12px', borderRadius: 14, border: `1px solid ${on ? c : '#e5e7eb'}`, background: on ? c : '#fff', color: on ? '#fff' : '#6b7280', fontFamily: 'inherit', fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: mode === 'rise' ? '#b91c1c' : '#15803d', marginBottom: 8 }}>
                  5 הרשויות עם {mode === 'rise' ? 'הגידול החד' : 'הירידה החדה'} ביותר ב{metric.label} ({firstYear}→{lastYear})
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto 44px 44px 56px', gap: 8, padding: '6px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 10, color: '#9ca3af', fontWeight: 600, alignItems: 'center' }}>
                    <span style={{ textAlign: 'center' }}>#</span><span>רשות</span><span style={{ textAlign: 'center' }}>מגמה</span>
                    <span style={{ textAlign: 'center' }}>{firstYear}</span><span style={{ textAlign: 'center' }}>{lastYear}</span>
                    <span style={{ textAlign: 'left', direction: 'ltr' }}>שינוי</span>
                  </div>
                  {movers.map((r, i) => {
                    const color = r.delta > 0 ? '#b91c1c' : r.delta < 0 ? '#15803d' : '#9ca3af';
                    const sign = r.delta > 0 ? '▲ +' : r.delta < 0 ? '▼ ' : '= ';
                    return (
                      <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto 44px 44px 56px', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center' }}>{i + 1}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                        <Sparkline v={r.v} />
                        <span style={{ fontSize: 12.5, color: '#9ca3af', textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{r.first}</span>
                        <span style={{ fontSize: 13, color: '#111827', fontWeight: 700, textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{r.last}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color, textAlign: 'left', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{sign}{Math.abs(r.delta)}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10.5, color: '#6b7280', marginTop: 10 }}>
                  חפשו רשות למעלה כדי לראות את מספר המקרים בכל שנה.
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid #f3f4f6', background: '#fafbfc', fontSize: 10, color: '#9ca3af', lineHeight: 1.7 }}>
            רצח: מספר קורבנות לפי שנה (שנים מלאות 2021–2025). שאר העבירות: סך תיקים לפי שנה; 2025 חלקי ואינו נכלל בחישוב המגמה. מקור: נתוני משטרה / איסוף עצמאי.
          </div>
        </div>
      </div>
    </div>
  );
}
