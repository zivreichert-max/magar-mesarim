'use client';
import { useEffect, useState } from 'react';
import { getCbsPriceData, CbsPriceRow } from '@/lib/supabase';

// Tab → DB categories. Two data sources live in cbs_price_data:
// Excel average prices (codes 16xxxx, with ₪ prices) and CPI sub-indices
// (codes 12xxxx, % only). The מזון tab shows priced products only, because
// the CPI food sub-indices (קפה, קקאו...) duplicate the Excel products.
const TABS: { label: string; cats: string[]; pricedOnly?: boolean }[] = [
  { label: 'מוצרי מזון',          cats: ['מזון'], pricedOnly: true },
  { label: 'ירקות ופירות',        cats: ['ירקות ופירות'] },
  { label: 'הוצאה על תחבורה',     cats: ['דלק ותחבורה', 'תחבורה'] },
  { label: 'הוצאה על דיור וחשמל', cats: ['דיור / חשמל'] },
  { label: 'הוצאה על בריאות',     cats: ['בריאות'] },
];

// "אפריל/2026" → "אפר׳ 26" for the compact table column header
const MONTH_SHORT: Record<string, string> = {
  'ינואר': 'ינו׳', 'פברואר': 'פבר׳', 'מרס': 'מרס', 'אפריל': 'אפר׳',
  'מאי': 'מאי', 'יוני': 'יוני', 'יולי': 'יולי', 'אוגוסט': 'אוג׳',
  'ספטמבר': 'ספט׳', 'אוקטובר': 'אוק׳', 'נובמבר': 'נוב׳', 'דצמבר': 'דצמ׳',
};
function shortPeriod(p: string): string {
  const [m, y] = p.split('/');
  return `${MONTH_SHORT[m] ?? m} ${y ? y.slice(2) : ''}`.trim();
}

const BASE_PERIOD = 'דצמבר/2022';

// מחולל מחירים ומדדי מחירים — מכסה גם מחירים ממוצעים וגם מדד המחירים לצרכן
const CBS_SOURCE_URL = 'https://www.cbs.gov.il/he/Statistics/Pages/%D7%9E%D7%97%D7%95%D7%9C%D7%9C%D7%99%D7%9D/%D7%9E%D7%97%D7%95%D7%9C%D7%9C-%D7%9E%D7%97%D7%99%D7%A8%D7%99%D7%9D.aspx';

function changeColor(pct: number): string {
  if (pct >= 50) return '#7f1d1d';
  if (pct >= 25) return '#991b1b';
  if (pct >= 15) return '#b91c1c';
  if (pct >= 8)  return '#c2410c';
  if (pct >= 0)  return '#374151';
  return '#15803d';
}

export default function PriceCalc() {
  const [rows, setRows] = useState<CbsPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(TABS[0].label);

  useEffect(() => {
    getCbsPriceData().then(data => { setRows(data); setLoading(false); });
  }, []);

  const tab = TABS.find(t => t.label === selectedTab) ?? TABS[0];
  const catRows = rows
    .filter(r =>
      tab.cats.includes(r.category) &&
      (!tab.pricedOnly || r.price_base != null) &&
      // a row whose latest data IS the Dec-2022 base has nothing to compare —
      // it would show a misleading +0.0%
      r.latest_period !== BASE_PERIOD
    )
    .sort((a, b) => b.cumulative_change - a.cumulative_change);

  const top10  = catRows.filter(r => r.cumulative_change >= 0).slice(0, 10);
  const drops  = catRows.filter(r => r.cumulative_change < 0).sort((a, b) => a.cumulative_change - b.cumulative_change);
  const maxPct = Math.max(...top10.map(r => r.cumulative_change), 1);

  const indexOnly = catRows.length > 0 && catRows.every(r => r.price_base == null);

  // The latest CBS publication period shown in this tab (most common one);
  // rows lagging behind it get a per-row period label
  const periodCounts = new Map<string, number>();
  for (const r of catRows) {
    if (r.latest_period) periodCounts.set(r.latest_period, (periodCounts.get(r.latest_period) ?? 0) + 1);
  }
  const latestPeriod = [...periodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const updatedDate  = catRows.reduce<string>((max, r) => (r.updated_at > max ? r.updated_at : max), '');
  const updatedStr   = updatedDate ? new Date(updatedDate).toLocaleDateString('he-IL') : '';

  if (loading) return (
    <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontFamily: "'Heebo', sans-serif" }}>
      טוען נתונים...
    </div>
  );

  if (rows.length === 0) return (
    <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontFamily: "'Heebo', sans-serif", fontSize: 13 }}>
      אין נתונים — הרץ את סקריפט הסנכרון תחילה
    </div>
  );

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif", background: '#f9fafb', minHeight: '100%', paddingBottom: 80 }}>
      <div style={{ padding: '20px 24px' }}>

        {/* ── מחשבון ההתייקרויות ─────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>

          {/* Box header */}
          <div style={{ padding: '16px 18px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 3 }}>
              מחשבון ההתייקרויות
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
              שינוי מחיר מצטבר — דצמבר 2022{latestPeriod ? ` לעומת ${latestPeriod} (פרסום הלמ״ס האחרון)` : ''}
            </div>
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #e5e7eb', padding: '0 10px', marginTop: 10 }}>
            {TABS.map(({ label }) => {
              const isSel = selectedTab === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedTab(label)}
                  style={{
                    padding: '10px 14px',
                    border: 'none',
                    borderBottom: isSel ? '2px solid #2077BB' : '2px solid transparent',
                    marginBottom: -1,
                    background: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: isSel ? 700 : 400,
                    color: isSel ? '#2077BB' : '#6b7280',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Table — immediately under the tabs */}
          <div style={{ padding: '14px 18px 16px' }}>
            {indexOnly && (
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>
                קטגוריה זו מבוססת על מדד המחירים לצרכן — מוצג אחוז שינוי בלבד, ללא מחיר ממוצע בש&quot;ח
              </div>
            )}

            {top10.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af', padding: '16px 0', textAlign: 'center' }}>
                אין נתוני התייקרות בקטגוריה זו
              </div>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 90px 60px 70px',
                  padding: '7px 14px',
                  background: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: 10, fontWeight: 600, color: '#9ca3af',
                }}>
                  <span style={{ textAlign: 'center' }}>#</span>
                  <span>מוצר</span>
                  <span style={{ textAlign: 'center' }}>דצמ׳ 22</span>
                  <span style={{ textAlign: 'center' }}>{latestPeriod ? shortPeriod(latestPeriod) : 'אחרון'}</span>
                  <span style={{ textAlign: 'left', direction: 'ltr' }}>שינוי</span>
                </div>

                {top10.map((row, i) => {
                  const pct      = row.cumulative_change;
                  const barWidth = (pct / maxPct) * 100;
                  const color    = changeColor(pct);
                  const base     = row.price_base;
                  const latest   = row.price_latest;

                  return (
                    <div
                      key={row.code_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 1fr 90px 60px 70px',
                        alignItems: 'center',
                        padding: '9px 14px',
                        borderBottom: i < top10.length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <span style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                        {i + 1}
                      </span>
                      <div style={{ paddingLeft: 8 }}>
                        <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.3 }}>{row.name}</div>
                        {/* Bar under name */}
                        <div style={{ marginTop: 4, height: 3, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barWidth}%`, background: '#1e3a7b', borderRadius: 2 }} />
                        </div>
                      </div>
                      <span style={{
                        fontSize: 12, color: '#6b7280', textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums', direction: 'ltr',
                      }}>
                        {base != null ? `${base}₪` : '—'}
                      </span>
                      <span style={{
                        fontSize: 12, color: '#374151', textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums', direction: 'ltr',
                      }}>
                        {latest != null ? `${latest}₪` : '—'}
                        {row.latest_period && row.latest_period !== latestPeriod && (
                          <span style={{ display: 'block', fontSize: 9, color: '#9ca3af', direction: 'rtl' }}>
                            נכון ל{shortPeriod(row.latest_period)}
                          </span>
                        )}
                      </span>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color,
                        direction: 'ltr', textAlign: 'left',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        +{pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Drops */}
            {drops.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '16px 0 8px', letterSpacing: '0.03em' }}>
                  הוזלות
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                  {drops.map((row, i) => (
                    <div
                      key={row.code_id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 14px',
                        borderBottom: i < drops.length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 13, color: '#374151' }}>{row.name}</span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {row.price_base != null && row.price_latest != null && (
                          <span style={{ fontSize: 11, color: '#9ca3af', direction: 'ltr' }}>
                            {row.price_base}₪ → {row.price_latest}₪
                          </span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
                          {row.cumulative_change.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Box footer: last updated + CBS source */}
          <div style={{
            padding: '10px 18px', borderTop: '1px solid #f3f4f6', background: '#fafbfc',
            fontSize: 10, color: '#9ca3af', lineHeight: 1.7,
          }}>
            {updatedStr && <span>עודכן לאחרונה: {updatedStr} · </span>}
            <a
              href={CBS_SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#2077BB', textDecoration: 'none', fontWeight: 600 }}
            >
              למקור בלמ&quot;ס — מחולל מחירים ומדדי מחירים ↗
            </a>
          </div>
        </div>

        {/* Methodology footer */}
        <div style={{ marginTop: 18, fontSize: 10, color: '#9ca3af', lineHeight: 1.8 }}>
          שיטה: מזון, ירקות ופירות ודלקים — השוואת מחיר ממוצע לצרכן (₪) בין דצמבר 2022 לחודש האחרון הזמין;
          תחבורה ציבורית, דיור וחשמל ובריאות — שינוי מצטבר במדד המחירים לצרכן מאותה תקופה. מקור: הלמ&quot;ס.
        </div>
      </div>
    </div>
  );
}
