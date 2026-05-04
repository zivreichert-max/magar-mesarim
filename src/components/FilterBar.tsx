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
    <div
      className="filter-bar sticky z-30 flex flex-wrap gap-2.5 items-center"
      style={{
        top: 78,
        padding: '14px 32px',
        background: '#f8fafc',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      {/* Search */}
      <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
        <span
          style={{
            position: 'absolute',
            right: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#555555',
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="חיפוש חופשי..."
          style={{
            width: '100%',
            padding: '9px 36px 9px 14px',
            border: '1px solid #e5e7eb',
            borderRadius: 2,
            background: '#ffffff',
            color: '#111111',
            fontFamily: 'inherit',
            fontSize: 14,
            outline: 'none',
            direction: 'rtl',
          }}
        />
      </div>

      {/* Topic chips */}
      <div className="filter-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, overflowX: 'auto' }}>
        {ALL_FILTERS.map(filter => {
          const isActive = filter === activeFilter;

          return (
            <button
              key={filter}
              onClick={() => onFilterChange(filter)}
              style={{
                padding: '5px 12px',
                borderRadius: 2,
                border: '1px solid #0075C4',
                background: isActive ? '#0075C4' : 'transparent',
                color: isActive ? '#ffffff' : '#0075C4',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                touchAction: 'manipulation',
                transition: 'all 0.15s',
              }}
            >
              {filter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
