interface HeaderProps {
  count: number;
  total: number;
}

export default function Header({ count, total }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between"
      style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "'Frank Ruhl Libre', serif",
            fontSize: 20,
            fontWeight: 900,
            color: 'var(--text)',
          }}
        >
          מאגר מסרים
        </div>
        <div style={{ fontWeight: 300, fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
          בחירות 2026 · בונים מחדש
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'left' }}>
        <span style={{ color: 'var(--text)', fontSize: 18, fontWeight: 800 }}>{count}</span>
        {count !== total && (
          <span> / {total}</span>
        )}
        {' '}מסרים
      </div>
    </header>
  );
}
