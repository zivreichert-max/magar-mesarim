interface HeaderProps {
  count: number;
  total: number;
}

export default function Header({ count, total }: HeaderProps) {
  return (
    <header
      className="site-header sticky top-0 z-40 flex items-center justify-between"
      style={{
        padding: '16px 32px',
        borderBottom: '2px solid #0075C4',
        background: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Logo square */}
        <div
          style={{
            width: 44,
            height: 44,
            border: '2px solid #111111',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Heebo', sans-serif",
              fontSize: 11,
              fontWeight: 900,
              color: '#111111',
              lineHeight: 1.2,
              textAlign: 'center',
              whiteSpace: 'pre-line',
            }}
          >
            {'בונים\nמחדש'}
          </span>
        </div>

        <div>
          <div
            className="site-header-title"
            style={{
              fontFamily: "'Heebo', sans-serif",
              fontSize: 20,
              fontWeight: 900,
              color: '#111111',
            }}
          >
            זמן בחירות
          </div>
          <div style={{ fontWeight: 400, fontSize: 12, color: '#0075C4', marginTop: 1 }}>
            בחירות 2026 · בונים מחדש
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#555555', textAlign: 'left' }}>
        <span style={{ color: '#111111', fontSize: 18, fontWeight: 800 }}>{count}</span>
        {count !== total && (
          <span> / {total}</span>
        )}
        {' '}מסרים
      </div>
    </header>
  );
}
