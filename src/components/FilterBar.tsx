'use client';

import { TOPICS, Topic } from '@/data/messages';

interface FilterBarProps {
  activeFilter: Topic | 'הכל';
  search: string;
  onFilterChange: (f: Topic | 'הכל') => void;
  onSearchChange: (s: string) => void;
}

const ALL_FILTERS: (Topic | 'הכל')[] = [
  'הכל',
  ...Object.keys(TOPICS) as Topic[],
];

export default function FilterBar({
  activeFilter,
  search,
  onFilterChange,
  onSearchChange,
}: FilterBarProps) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: '#f8fafc', borderBottom: '1px solid #e5e7eb',
      padding: '10px 16px', display: 'flex',
      flexDirection: 'column', gap: 8,
    }}>
      <input
        type="text"
        placeholder="חיפוש חופשי..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        style={{
          width: '100%', padding: '8px 12px',
          border: '1px solid #e5e7eb', borderRadius: 2,
          fontFamily: 'inherit', fontSize: 14,
          direction: 'rtl', outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div style={{
        display: 'flex', flexDirection: 'row',
        gap: 6, overflowX: 'scroll',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 2,
      } as React.CSSProperties}>
        {ALL_FILTERS.map(filter => (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            style={{
              flexShrink: 0,
              padding: '5px 12px',
              border: '1px solid #0075C4',
              background: activeFilter === filter ? '#0075C4' : 'transparent',
              color: activeFilter === filter ? '#fff' : '#0075C4',
              fontFamily: 'inherit', fontSize: 12,
              fontWeight: 600, whiteSpace: 'nowrap',
              cursor: 'pointer', borderRadius: 2,
              touchAction: 'manipulation',
            }}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
}
