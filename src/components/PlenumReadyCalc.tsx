'use client';
import { useMemo, useState } from 'react';
import {
  PLENUM_AS_OF, PLENUM_SOURCE, READY_SECOND_THIRD, AWAITING_FIRST,
  BLOCKED_FROZEN_COUNT, PLENUM_CATEGORIES, PlenumBill,
} from '@/data/plenumReady';

// "מוכן למליאה" — which mapped judicial-overhaul / harmful bills can pass the
// plenum during the election recess, and at which rung of the risk ladder.

const TIER_COLORS = {
  ready: { fg: '#b91c1c', bg: '#fef2f2', border: '#ecc3c0' },
  first: { fg: '#b45309', bg: '#fffbeb', border: '#e8d3a8' },
  frozen: { fg: '#475569', bg: '#f1f5f9', border: '#d7dde5' },
};

function TierTag({ tier }: { tier: 'ready' | 'first' }) {
  const c = TIER_COLORS[tier];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '1px 9px', borderRadius: 4, whiteSpace: 'nowrap',
      color: c.fg, background: c.bg, border: `1px solid ${c.border}`,
    }}>
      {tier === 'ready' ? 'עביר בכל רגע' : 'קריאה ראשונה בלבד'}
    </span>
  );
}

function BillRow({ bill, tier }: { bill: PlenumBill; tier: 'ready' | 'first' }) {
  return (
    <details style={{
      background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 6,
      marginBottom: 8, overflow: 'hidden',
    }}>
      <summary style={{
        cursor: 'pointer', padding: '11px 14px', listStyle: 'none',
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', flex: '1 1 260px', lineHeight: 1.5 }}>
          {bill.name}
        </span>
        <TierTag tier={tier} />
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#1e3a7b', background: '#eff6ff',
          border: '1px solid #c6d3e8', borderRadius: 4, padding: '1px 9px', whiteSpace: 'nowrap',
        }}>
          {bill.category}
        </span>
      </summary>
      <div style={{ padding: '11px 14px', borderTop: '1px solid #e5e7eb', fontSize: 13, lineHeight: 1.7, color: '#374151' }}>
        <div style={{ marginBottom: 6, fontSize: 12, color: '#6b7280' }}>
          {bill.symbol} · הצעה {bill.billType}
          {bill.committee ? ` · ${bill.committee}` : ''}
          {bill.initiators ? ` · יוזמים: ${bill.initiators}` : ''}
        </div>
        <div style={{ marginBottom: 6 }}>
          <strong>המשמעות (לפי פורום המדענים): </strong>{bill.meaning}
        </div>
        {bill.officialSecondThirdTitle && (
          <div style={{ marginBottom: 6 }}>
            <strong>כותרת הנוסח שהונח: </strong>{bill.officialSecondThirdTitle}
          </div>
        )}
        <div style={{ marginBottom: 6, fontSize: 12, color: '#6b7280' }}>
          סטטוס רשמי: {bill.officialStatus}
          {bill.note ? ` · ${bill.note}` : ''}
        </div>
        <a href={bill.mappingUrl} target="_blank" rel="noreferrer"
          style={{ fontSize: 12, fontWeight: 700, color: '#0075C4', textDecoration: 'none', marginInlineEnd: 12 }}>
          המיפוי המלא (OSF) ↗
        </a>
        <a href={bill.knessetUrl} target="_blank" rel="noreferrer"
          style={{ fontSize: 12, fontWeight: 700, color: '#0075C4', textDecoration: 'none' }}>
          מאגר החקיקה של הכנסת ↗
        </a>
      </div>
    </details>
  );
}

function TierHeader({ num, title, desc, color, count }: {
  num: string; title: string; desc: string; color: { fg: string; bg: string; border: string }; count: number;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
      borderRight: `4px solid ${color.fg}`, background: color.bg,
      border: `1px solid ${color.border}`, borderRightWidth: 4, borderRightColor: color.fg,
      borderRadius: 6, padding: '10px 14px', margin: '20px 0 10px',
    }}>
      <span style={{ fontSize: 12, fontWeight: 900, color: color.fg }}>מדרגה {num}</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: '#111827' }}>{title}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: color.fg }}>{count} הצעות</span>
      <span style={{ fontSize: 12, color: '#6b7280', flexBasis: '100%', lineHeight: 1.6 }}>{desc}</span>
    </div>
  );
}

export default function PlenumReadyCalc() {
  const [category, setCategory] = useState<string>('הכל');

  const ready = useMemo(
    () => READY_SECOND_THIRD.filter(b => category === 'הכל' || b.category === category),
    [category],
  );
  const first = useMemo(
    () => AWAITING_FIRST.filter(b => category === 'הכל' || b.category === category),
    [category],
  );

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', direction: 'rtl' }}>
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0c447c', marginBottom: 4 }}>
          מוכן למליאה — חקיקת ההפיכה המשפטית בפגרת הבחירות
        </h2>
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7, maxWidth: 640, margin: '0 auto' }}>
          המליאה אינה כפופה לוועדת ההסכמות: הממשלה רשאית להביא הצעות חוק לקריאה ראשונה
          ולקריאה שנייה ושלישית גם בפגרה. המחשבון עוקב אחר הצעות החוק שבמיפוי חקיקת
          ההפיכה המשפטית והחקיקה הפוגענית בלבד — לא בכלל החקיקה התלויה בכנסת.
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#111827', margin: '12px 0 4px' }}>
        <span style={{ color: TIER_COLORS.ready.fg }}>{READY_SECOND_THIRD.length} הצעות עבירוֹת בכל רגע</span>
        {' · '}
        <span style={{ color: TIER_COLORS.first.fg }}>{AWAITING_FIRST.length} בהמתנה לקריאה ראשונה</span>
        {' · '}
        <span style={{ color: TIER_COLORS.frozen.fg }}>{BLOCKED_FROZEN_COUNT} קפואות ללא הסכמות</span>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>
        נכון ל-{PLENUM_AS_OF}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 4 }}>
        {['הכל', ...PLENUM_CATEGORIES].map(c => {
          const isActive = category === c;
          return (
            <button key={c} type="button" onClick={() => setCategory(c)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: isActive ? 700 : 500,
                border: `1px solid ${isActive ? '#2077BB' : '#e5e7eb'}`,
                background: isActive ? '#2077BB' : '#fff',
                color: isActive ? '#fff' : '#6b7280', transition: 'all 0.15s',
              }}>
              {c}
            </button>
          );
        })}
      </div>

      <TierHeader
        num="1" title="עביר בכל רגע" count={ready.length} color={TIER_COLORS.ready}
        desc='הונחו על שולחן הכנסת לקריאה שנייה ושלישית. עבודת הוועדה הסתיימה; נדרשת רק החלטת ממשלה להעלות למליאה — ללא שום מסננת של ועדת ההסכמות.'
      />
      {ready.length === 0
        ? <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', padding: '4px 14px' }}>אין הצעות בקטגוריה שנבחרה</div>
        : ready.map(b => <BillRow key={b.symbol} bill={b} tier="ready" />)}

      <TierHeader
        num="2" title="קריאה ראשונה בלבד" count={first.length} color={TIER_COLORS.first}
        desc='הונחו לקריאה ראשונה. הממשלה יכולה להעבירן קריאה ראשונה בפגרה, אך ההכנה לקריאה שנייה-שלישית דורשת ועדה — וּועדה דורשת אישור ועדת ההסכמות.'
      />
      {first.length === 0
        ? <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', padding: '4px 14px' }}>אין הצעות בקטגוריה שנבחרה</div>
        : first.map(b => <BillRow key={b.symbol} bill={b} tier="first" />)}

      <TierHeader
        num="3" title="קפוא ללא הסכמות" count={BLOCKED_FROZEN_COUNT} color={TIER_COLORS.frozen}
        desc='כל שאר ההצעות במיפוי — דיון מוקדם, הכנה בוועדה, הוסרו או מוזגו. לא ניתן לקדמן ללא אישור ועדת ההסכמות.'
      />

      <div style={{
        marginTop: 24, paddingTop: 12, borderTop: '1px solid #e5e7eb',
        fontSize: 11, color: '#9ca3af', lineHeight: 1.8,
      }}>
        מקור: {PLENUM_SOURCE} ·{' '}
        <a href="https://osf.io/9ewst/?view_only=479cc15ff81b40b799537c881ac0c391" target="_blank" rel="noreferrer"
          style={{ color: '#0075C4', textDecoration: 'none' }}>
          המיפוי המלא ↗
        </a>
      </div>
    </div>
  );
}
