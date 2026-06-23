'use client';
import { useState, useMemo } from 'react';
import {
  EDU_OUTCOMES, EDU_METRICS, EDU_CLUSTER_TRENDS, EDU_NATIONAL_TREND, EduMetricKey,
} from '@/data/eduOutcomes';

const ACCENT = '#2077BB';
const f1 = (v: number) => v.toFixed(1);

type ViewId = 'localities' | 'clusters' | 'national';

interface RankedRow { name: string; cluster: number | null; y2022: number; y2024: number; diff: number; }

const CLUSTERS: number[] = Array.from(
  new Set(EDU_OUTCOMES.map(l => l.cluster).filter((c): c is number => c != null))
).sort((a, b) => a - b);

function natValue(metric: EduMetricKey, year: number): number | null {
  return EDU_NATIONAL_TREND.find(n => n.year === year)?.metrics[metric] ?? null;
}

export default function EduOutcomesCalc() {
  const [view, setView] = useState<ViewId>('localities');
  const [metricKey, setMetricKey] = useState<EduMetricKey>('bagrut');
  const [mode, setMode] = useState<'drops' | 'rises'>('drops');
  const [cluster, setCluster] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');

  const metric = EDU_METRICS.find(m => m.key === metricKey)!;

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
              {EDU_OUTCOMES.length} רשויות · נתוני שקיפות בחינוך · השינוי בנקודות אחוז (נ״א)
            </div>
          </div>

          {/* View switch */}
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', flexWrap: 'wrap' }}>
            {([['localities', 'לפי רשות'], ['clusters', 'לפי אשכול'], ['national', 'מגמה ארצית']] as const).map(([id, label]) => {
              const on = view === id;
              return (
                <button key={id} type="button" onClick={() => setView(id)}
                  style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${on ? '#1e3a7b' : '#e5e7eb'}`, background: on ? '#1e3a7b' : '#fff', color: on ? '#fff' : '#6b7280', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Metric pills (shared) */}
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

          {view === 'localities' && (
            <LocalitiesView metricKey={metricKey} metricLabel={metric.label}
              mode={mode} setMode={setMode} cluster={cluster} setCluster={setCluster} query={query} setQuery={setQuery} />
          )}
          {view === 'clusters' && <ClustersView metricKey={metricKey} metricLabel={metric.label} />}
          {view === 'national' && <NationalView metricKey={metricKey} metricLabel={metric.label} />}

          {/* Footer */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid #f3f4f6', background: '#fafbfc', fontSize: 10, color: '#9ca3af', lineHeight: 1.7 }}>
            {view === 'clusters'
              ? 'ממוצעי האשכול משוקללים לפי מספר תלמידי י״ב (מאומת מול הנתון הארצי הרשמי). אשכול 1 = חלש · 10 = חזק.'
              : view === 'national'
              ? 'נתונים ארציים רשמיים לפי שנת לימודים. מקור: משרד החינוך — שקיפות בחינוך.'
              : 'האשכול הסוציו-אקונומי (1–10) מאפשר השוואה בין רשויות במעמד חברתי-כלכלי דומה.'}
            {' '}מקור: משרד החינוך — דוח תמונה חינוכית רשותי / שקיפות בחינוך, תשפ&quot;ב (2022) ו-תשפ&quot;ד (2024).
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Localities view ───────────── */
function ClusterTag({ c }: { c: number | null }) {
  if (c == null) return null;
  return <span style={{ fontSize: 9.5, fontWeight: 700, color: '#0c447c', background: '#e6f0f9', borderRadius: 3, padding: '1px 6px', whiteSpace: 'nowrap' }}>אשכול {c}</span>;
}

function LocalitiesView({ metricKey, metricLabel, mode, setMode, cluster, setCluster, query, setQuery }: {
  metricKey: EduMetricKey; metricLabel: string;
  mode: 'drops' | 'rises'; setMode: (m: 'drops' | 'rises') => void;
  cluster: number | 'all'; setCluster: (c: number | 'all') => void;
  query: string; setQuery: (q: string) => void;
}) {
  const ranked = useMemo<RankedRow[]>(() => EDU_OUTCOMES
    .filter(l => l.metrics[metricKey].y2022 != null && l.metrics[metricKey].y2024 != null)
    .filter(l => cluster === 'all' || l.cluster === cluster)
    .map(l => {
      const a = l.metrics[metricKey].y2022 as number, b = l.metrics[metricKey].y2024 as number;
      return { name: l.name, cluster: l.cluster, y2022: a, y2024: b, diff: Math.round((b - a) * 10) / 10 };
    }), [metricKey, cluster]);

  const movers = useMemo(() => [...ranked]
    .sort((a, b) => mode === 'drops' ? a.diff - b.diff : b.diff - a.diff).slice(0, 5), [ranked, mode]);

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return EDU_OUTCOMES.filter(l => l.name.includes(q))
      .map(l => ({ name: l.name, cluster: l.cluster, y2022: l.metrics[metricKey].y2022, y2024: l.metrics[metricKey].y2024 }))
      .slice(0, 30);
  }, [query, metricKey]);

  const clusterNote = cluster === 'all' ? '' : ` · אשכול ${cluster}`;

  return (
    <>
      {/* Cluster filter */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
          אשכול סוציו-אקונומי <span style={{ fontWeight: 400, color: '#9ca3af' }}>(1 = נמוך · 10 = גבוה)</span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {(['all', ...CLUSTERS] as const).map(c => {
            const on = cluster === c;
            return (
              <button key={String(c)} type="button" onClick={() => setCluster(c as number | 'all')}
                style={{ padding: '4px 11px', borderRadius: 14, border: `1px solid ${on ? '#0c447c' : '#e5e7eb'}`, background: on ? '#0c447c' : '#fff', color: on ? '#fff' : '#6b7280', fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 500, cursor: 'pointer', minWidth: c === 'all' ? 'auto' : 30 }}>
                {c === 'all' ? 'הכל' : c}
              </button>
            );
          })}
        </div>
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
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              {searchResults.map(r => {
                const a = r.y2022, b = r.y2024, hasBoth = a != null && b != null;
                const diff = hasBoth ? (b as number) - (a as number) : null;
                const color = diff == null ? '#9ca3af' : diff >= 0 ? '#15803d' : '#b91c1c';
                return (
                  <div key={r.name} style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.name}</span>
                          <ClusterTag c={r.cluster} />
                        </div>
                        {!hasBoth && <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 2 }}>אין נתון מלא לשתי השנים</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>{a != null ? `${f1(a)}%` : '—'}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>→</span>
                        <span style={{ fontSize: 16, color: ACCENT, fontWeight: 800 }}>{b != null ? `${f1(b)}%` : '—'}</span>
                        {diff != null && <span style={{ fontSize: 12.5, fontWeight: 800, color }}>{diff >= 0 ? '+' : ''}{diff.toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <>
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
              {movers.length} הרשויות עם {mode === 'drops' ? 'הירידה החדה' : 'העלייה הגדולה'} ביותר ב{metricLabel}{clusterNote}
            </div>
            {movers.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>אין רשויות עם נתונים מלאים באשכול זה</div>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 52px 52px 64px', gap: 8, padding: '6px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
                  <span style={{ textAlign: 'center' }}>#</span><span>רשות</span>
                  <span style={{ textAlign: 'center' }}>2022</span><span style={{ textAlign: 'center' }}>2024</span>
                  <span style={{ textAlign: 'left', direction: 'ltr' }}>שינוי</span>
                </div>
                {movers.map((r, i) => {
                  const color = r.diff > 0 ? '#15803d' : r.diff < 0 ? '#b91c1c' : '#9ca3af';
                  const sign = r.diff > 0 ? '▲ +' : r.diff < 0 ? '▼ ' : '= ';
                  return (
                    <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 52px 52px 64px', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center' }}>{i + 1}</span>
                      <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                        <ClusterTag c={r.cluster} />
                      </span>
                      <span style={{ fontSize: 12.5, color: '#9ca3af', textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{f1(r.y2022)}</span>
                      <span style={{ fontSize: 13, color: '#1e3a7b', fontWeight: 700, textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{f1(r.y2024)}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color, textAlign: 'left', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{sign}{Math.abs(r.diff).toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ───────────── Clusters view ───────────── */
function ClustersView({ metricKey, metricLabel }: { metricKey: EduMetricKey; metricLabel: string }) {
  const nat2024 = natValue(metricKey, 2024);
  const rows = EDU_CLUSTER_TRENDS
    .filter(c => c.metrics[metricKey].y2024 != null)
    .map(c => ({
      cluster: c.cluster, localities: c.localities,
      y2022: c.metrics[metricKey].y2022, y2024: c.metrics[metricKey].y2024 as number,
      diff: c.metrics[metricKey].y2022 != null
        ? Math.round((c.metrics[metricKey].y2024! - c.metrics[metricKey].y2022!) * 10) / 10 : null,
    }));

  return (
    <div style={{ padding: '14px 18px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a7b', marginBottom: 4 }}>
        מגמת האשכולות הסוציו-אקונומיים — {metricLabel}
      </div>
      <div style={{ fontSize: 10.5, color: '#9ca3af', marginBottom: 12 }}>
        ממוצע משוקלל לכל אשכול, 2022 → 2024.{nat2024 != null && <> הקו המקווקו = הנתון הארצי 2024 ({f1(nat2024)}%).</>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(r => {
          const color = r.diff == null ? '#9ca3af' : r.diff >= 0 ? '#15803d' : '#b91c1c';
          return (
            <div key={r.cluster} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 96px', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid #f6f7f8' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0c447c' }}>אשכול {r.cluster}</div>
                <div style={{ fontSize: 9.5, color: '#9ca3af' }}>{r.localities} רשויות</div>
              </div>
              {/* Bar track 0–100% with year dots + national reference */}
              <div style={{ position: 'relative', height: 22 }}>
                <div style={{ position: 'absolute', top: 10, right: 0, left: 0, height: 6, background: '#f1f3f5', borderRadius: 3 }} />
                <div style={{ position: 'absolute', top: 10, right: 0, height: 6, width: `${r.y2024}%`, background: '#1e3a7b', borderRadius: 3 }} />
                {r.y2022 != null && (
                  <div title={`2022: ${f1(r.y2022)}%`} style={{ position: 'absolute', top: 6, right: `${r.y2022}%`, width: 2, height: 14, background: '#9ca3af', transform: 'translateX(50%)' }} />
                )}
                {nat2024 != null && (
                  <div style={{ position: 'absolute', top: 2, right: `${nat2024}%`, width: 0, height: 18, borderRight: '1.5px dashed #c2410c', transform: 'translateX(50%)' }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, direction: 'ltr', justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#1e3a7b' }}>{f1(r.y2024)}%</span>
                {r.diff != null && <span style={{ fontSize: 11.5, fontWeight: 800, color }}>{r.diff >= 0 ? '+' : ''}{r.diff.toFixed(1)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── National trend view ───────────── */
function NationalView({ metricKey, metricLabel }: { metricKey: EduMetricKey; metricLabel: string }) {
  const series = EDU_NATIONAL_TREND.filter(n => n.metrics[metricKey] != null)
    .map(n => ({ label: n.label, year: n.year, v: n.metrics[metricKey] as number }));
  const max = Math.max(...series.map(s => s.v), 1);

  return (
    <div style={{ padding: '14px 18px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a7b', marginBottom: 4 }}>
        מגמה ארצית — {metricLabel}
      </div>
      <div style={{ fontSize: 10.5, color: '#9ca3af', marginBottom: 12 }}>
        נתון ארצי רשמי לפי שנת לימודים, {series[0]?.label} → {series[series.length - 1]?.label}.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {series.map((s, i) => {
          const isLast = i === series.length - 1;
          const prev = i > 0 ? series[i - 1].v : null;
          const d = prev != null ? Math.round((s.v - prev) * 10) / 10 : null;
          return (
            <div key={s.year} style={{ display: 'grid', gridTemplateColumns: '54px 1fr 86px', alignItems: 'center', gap: 10, padding: '5px 2px' }}>
              <span style={{ fontSize: 11.5, color: isLast ? '#1e3a7b' : '#6b7280', fontWeight: isLast ? 800 : 500 }}>{s.label}</span>
              <div style={{ height: 16, background: '#f1f3f5', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${(s.v / max) * 100}%`, background: isLast ? '#1e3a7b' : '#9db8d6', borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, direction: 'ltr', justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 13, fontWeight: isLast ? 800 : 600, color: isLast ? '#1e3a7b' : '#374151' }}>{f1(s.v)}%</span>
                {d != null && <span style={{ fontSize: 10.5, fontWeight: 700, color: d >= 0 ? '#15803d' : '#b91c1c' }}>{d >= 0 ? '+' : ''}{d.toFixed(1)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
