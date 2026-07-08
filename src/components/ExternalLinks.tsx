'use client';

export interface ExternalLink { label: string; url: string; desc?: string; }

// Reusable external-resources list — card rows that open in a new tab.
// Used both as a standalone "מחשבונים חיצוניים" tab and nested under a calculator.
export default function ExternalLinks({ title, links }: { title?: string; links: ExternalLink[] }) {
  return (
    <div style={{ direction: 'rtl', fontFamily: "var(--font-heebo), sans-serif" }}>
      {title && (
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 10, letterSpacing: '0.03em' }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {links.map(({ label, url, desc }) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px', background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 6, textDecoration: 'none', color: '#111827',
              fontSize: 13, fontWeight: 500,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2077BB'; e.currentTarget.style.background = '#f8faff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>{label}</span>
              {desc && <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>{desc}</span>}
            </span>
            <span style={{ fontSize: 13, color: '#9ca3af', flexShrink: 0, marginRight: 8 }}>↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
