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
      className="sticky z-30 flex flex-wrap gap-2.5 items-center"
      style={{
        top: 73,
        padding: '14px 32px',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
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
            color: 'var(--muted)',
            fontSize: 15,
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
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg3)',
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 14,
            outline: 'none',
            direction: 'rtl',
          }}
        />
      </div>

      {/* Topic chips */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_FILTERS.map(filter => {
          const isActive = filter === activeFilter;
          const color = filter === 'הכל' ? undefined : TOPICS[filter as Topic]?.color;

          return (
            <button
              key={filter}
              onClick={() => onFilterChange(filter)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: isActive && filter !== 'הכל' ? 'transparent' : isActive ? 'rgba(255,255,255,0.2)' : 'var(--border)',
                background: isActive
                  ? filter === 'הכל'
                    ? 'rgba(255,255,255,0.12)'
                    : color
                  : 'transparent',
                color: isActive
                  ? filter === 'הכל'
                    ? 'var(--text)'
                    : '#0f1117'
                  : 'var(--muted)',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
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
