'use client';
import { useState, useMemo } from 'react';
import {
  CRIME_METRICS, CRIME_DATA, CRIME_YEARS, CrimeMetricKey,
} from '@/data/crime';

const NAVY = '#1e3a7b';
const UP = '#b0233a';   // increase (the adverse signal) — muted, used sparingly
const DOWN = '#1b7a43'; // decrease
const fmt = (n: number) => n.toLocaleString('he-IL');

type ViewId = 'localities' | 'national';
interface MoverRow { name: string; v: number[]; first: number; last: number; delta: number; }

function deltaColor(d: number) { return d > 0 ? UP : d < 0 ? DOWN : '#9ca3af'; }
function deltaText(d: number) { return `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}`; }

// Per-year column chart for one locality.
function YearBars({ v, partial }: { v: number[]; partial: number[] }) {
  const max = Math.max(...v, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 60, direction: 'ltr' }}>
      {CRIME_YEARS.map((y, i) => {
        const isPartial = partial.includes(y);
        const h = Math.round((v[i] / max) * 46) + 2;
        return (
          <div key={y} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{v[i]}</span>
            <div title={isPartial ? 'שנה חלקית' : ''} style={{
              width: '100%', maxWidth: 28, height: h, borderRadius: '2px 2px 0 0',
              background: isPartial ? '#cbd5e1' : NAVY, opacity: isPartial ? 0.7 : 1,
            }} />
            <span style={{ fontSize: 10, color: '#9ca3af' }}>{`'${String(y).slice(2)}`}{isPartial ? '*' : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ v, partial }: { v: number[]; partial: number[] }) {
  const max = Math.max(...v, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22, direction: 'ltr' }}>
      {CRIME_YEARS.map((y, i) => (
        <div key={y} style={{ width: 5, height: Math.round((v[i] / max) * 18) + 2, background: partial.includes(y) ? '#cbd5e1' : '#9fb0cf', borderRadius: 1 }} />
      ))}
    </div>
  );
}

export default function CrimeCalc() {
  const [view, setView] = useState<ViewId>('localities');
  const [metricKey, setMetricKey] = useState<CrimeMetricKey>('murder');
  const [mode, setMode] = useState<'rise' | 'fall'>('rise');
  const [query, setQuery] = useState('');

  const metric = CRIME_METRICS.find(m => m.key === metricKey)!;
  const rows = CRIME_DATA[metricKey];

  const { firstIdx, lastIdx, firstYear, lastYear } = useMemo(() => {
    const complete = CRIME_YEARS.map((y, i) => ({ y, i })).filter(o => !metric.partialYears.includes(o.y));
    const fi = complete[0], li = complete[complete.length - 1];
    return { firstIdx: fi.i, lastIdx: li.i, firstYear: fi.y, lastYear: li.y };
  }, [metric]);

  const movers = useMemo<MoverRow[]>(() => {
    const list = rows.map(r => ({
      name: r.name, v: r.v, first: r.v[firstIdx], last: r.v[lastIdx], delta: r.v[lastIdx] - r.v[firstIdx],
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

  const segBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: 7, border: `1px solid ${active ? NAVY : '#e5e7eb'}`,
    background: active ? NAVY : '#fff', color: active ? '#fff' : '#6b7280',
    fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
  });

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
              {metric.label} · ארצי {lastYear}: {fmt(metric.national[lastIdx])} · {firstYear}: {fmt(metric.national[firstIdx])}
            </div>
          </div>

          {/* View switch */}
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px' }}>
            <button type="button" onClick={() => setView('localities')} style={segBtn(view === 'localities')}>לפי רשות</button>
            <button type="button" onClick={() => setView('national')} style={segBtn(view === 'national')}>מגמה ארצית</button>
          </div>

          {/* Metric pills */}
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb' }}>
            {CRIME_METRICS.map(m => {
              const on = m.key === metricKey;
              return (
                <button key={m.key} type="button" onClick={() => setMetricKey(m.key)}
                  style={{ padding: '6px 13px', borderRadius: 16, border: `1px solid ${on ? NAVY : '#e5e7eb'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : '#6b7280', fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                  {m.label}
                </button>
              );
            })}
          </div>

          {view === 'national' ? (
            <NationalTrend metric={metric} firstIdx={firstIdx} lastIdx={lastIdx} firstYear={firstYear} lastYear={lastYear} />
          ) : (
            <>
              {/* Search */}
              <div style={{ padding: '14px 18px 6px' }}>
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש רשות"
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
                        return (
                          <div key={r.name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontSize: 14.5, fontWeight: 700, color: '#111827' }}>{r.name}</span>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: deltaColor(delta), direction: 'ltr' }}>
                                {firstYear}–{lastYear}: {deltaText(delta)}
                              </span>
                            </div>
                            <YearBars v={r.v} partial={metric.partialYears} />
                          </div>
                        );
                      })}
                      {metric.partialYears.length > 0 && (
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>* {metric.partialYears.join(', ')} — שנה חלקית, אינה נכללת בחישוב המגמה.</div>
                      )}
                    </div>
                  )
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <button type="button" onClick={() => setMode('rise')} style={segBtn(mode === 'rise')}>גידול חד</button>
                      <button type="button" onClick={() => setMode('fall')} style={segBtn(mode === 'fall')}>ירידה חדה</button>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
                      5 הרשויות עם {mode === 'rise' ? 'הגידול החד' : 'הירידה החדה'} ביותר ב{metric.label} ({firstYear}–{lastYear})
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto 44px 44px 52px', gap: 8, padding: '7px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 10.5, color: '#9ca3af', fontWeight: 600, alignItems: 'center' }}>
                        <span style={{ textAlign: 'center' }}>#</span><span>רשות</span><span style={{ textAlign: 'center' }}>מגמה</span>
                        <span style={{ textAlign: 'center' }}>{firstYear}</span><span style={{ textAlign: 'center' }}>{lastYear}</span>
                        <span style={{ textAlign: 'left', direction: 'ltr' }}>שינוי</span>
                      </div>
                      {movers.map((r, i) => (
                        <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto 44px 44px 52px', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: i < movers.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <span style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>{i + 1}</span>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                          <Sparkline v={r.v} partial={metric.partialYears} />
                          <span style={{ fontSize: 12.5, color: '#9ca3af', textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{r.first}</span>
                          <span style={{ fontSize: 13, color: '#111827', fontWeight: 700, textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{r.last}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: deltaColor(r.delta), textAlign: 'left', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{deltaText(r.delta)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 10 }}>
                      חפשו רשות למעלה כדי לראות את מספר המקרים בכל שנה.
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid #f3f4f6', background: '#fafbfc', fontSize: 10, color: '#9ca3af', lineHeight: 1.7 }}>
            רצח: מספר קורבנות לפי שנה (2021–2025, שנים מלאות). שאר העבירות: סך תיקים לפי שנה; 2025 חלקי ואינו נכלל בחישוב המגמה. הנתונים התקבלו מהתנועה לחופש המידע (נתוני משטרת ישראל).
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── National trend view ───────────── */
function NationalTrend({ metric, firstIdx, lastIdx, firstYear, lastYear }: {
  metric: typeof CRIME_METRICS[number]; firstIdx: number; lastIdx: number; firstYear: number; lastYear: number;
}) {
  const series = CRIME_YEARS.map((y, i) => ({ year: y, v: metric.national[i], partial: metric.partialYears.includes(y) }));
  const max = Math.max(...series.map(s => s.v), 1);
  const headDelta = metric.national[lastIdx] - metric.national[firstIdx];
  const headPct = metric.national[firstIdx] > 0 ? Math.round((headDelta / metric.national[firstIdx]) * 100) : null;

  return (
    <div style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 2 }}>מגמה ארצית — {metric.label}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        {firstYear} → {lastYear}:{' '}
        <span style={{ fontWeight: 700, color: deltaColor(headDelta) }}>
          {deltaText(headDelta)}{headPct != null ? ` (${headDelta >= 0 ? '+' : '−'}${Math.abs(headPct)}%)` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {series.map((s, i) => {
          const prev = i > 0 ? series[i - 1].v : null;
          const d = prev != null ? s.v - prev : null;
          return (
            <div key={s.year} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 96px', alignItems: 'center', gap: 10, padding: '5px 2px' }}>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{s.year}{s.partial ? '*' : ''}</span>
              <div style={{ height: 18, background: '#f1f3f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(s.v / max) * 100}%`, background: s.partial ? '#cbd5e1' : NAVY, borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr', justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{fmt(s.v)}</span>
                {d != null && !s.partial && <span style={{ fontSize: 10.5, fontWeight: 600, color: deltaColor(d) }}>{deltaText(d)}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {metric.partialYears.length > 0 && (
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 10 }}>* {metric.partialYears.join(', ')} — שנה חלקית.</div>
      )}
    </div>
  );
}
