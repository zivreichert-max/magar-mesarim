'use client';

const NAVY = '#1e3a7b';
const URL = 'https://recruitment-data.vercel.app/he';

export default function RecruitmentLink() {
  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif", padding: '32px 24px', maxWidth: 720 }}>
      <div style={{
        border: '1px solid #e5e7eb', borderRadius: 16, background: '#fff',
        padding: '28px 28px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2077BB', marginBottom: 6 }}>
          מקור חיצוני
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: '0 0 12px' }}>
          התגייסות, קצונה ושירות קרבי
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: '#374151', margin: '0 0 22px' }}>
          אתר מחשבונים ייעודי המרכז נתונים על התגייסות לצה״ל, שיעורי קצונה ושירות קרבי
          לאורך השנים. האתר מאפשר לחתוך את הנתונים לפי מגזרים ומגמות, וכולל עמוד מקורות מפורט.
        </p>
        <a
          href={URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 22px', borderRadius: 24,
            background: '#2077BB', color: '#fff',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}
        >
          למעבר לאתר המחשבונים ←
        </a>
      </div>
    </div>
  );
}
