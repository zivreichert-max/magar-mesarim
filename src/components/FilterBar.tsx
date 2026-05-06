'use client';

import { useState, useEffect } from 'react';
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
  const [isMobile, setIsMobile] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 640);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Desktop: sticky bar (unchanged) ─────────────────────────────────────────
  if (!isMobile) {
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

  // ── Mobile: fixed bottom button + slide-up panel ─────────────────────────────
  const hasActiveFilter = activeFilter !== 'הכל' || search.trim().length > 0;

  return (
    <>
      {/* Fixed filter button */}
      <button
        onClick={() => setPanelOpen(true)}
        style={{
          position: 'fixed', bottom: 20, left: '50%',
          transform: 'translateX(-50%)',
          background: '#0075C4', color: '#fff',
          border: 'none', borderRadius: 24,
          padding: '12px 24px', fontSize: 15, fontWeight: 700,
          zIndex: 500, touchAction: 'manipulation',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,117,196,0.35)',
          display: 'flex', alignItems: 'center', gap: 8,
          whiteSpace: 'nowrap',
        }}
      >
        🔍 סינון וחיפוש
        {hasActiveFilter && (
          <span style={{
            width: 8, height: 8,
            background: '#fff', borderRadius: '50%',
            display: 'inline-block', flexShrink: 0,
          }} />
        )}
      </button>

      {panelOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setPanelOpen(false)}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 998,
            }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed', top: 'auto', bottom: 0, left: 0, right: 0,
            background: '#fff',
            borderRadius: '16px 16px 0 0',
            padding: 20,
            zIndex: 999,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          }}>
            {/* Drag handle */}
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: '#e5e7eb', margin: '0 auto 18px',
            }} />

            {/* Search input */}
            <input
              type="text"
              placeholder="חיפוש חופשי..."
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid #e5e7eb', borderRadius: 8,
                fontFamily: 'inherit', fontSize: 15,
                direction: 'rtl', outline: 'none',
                boxSizing: 'border-box', marginBottom: 14,
              }}
            />

            {/* Topic chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_FILTERS.map(filter => (
                <button
                  key={filter}
                  onClick={() => {
                    onFilterChange(filter);
                    setPanelOpen(false);
                  }}
                  style={{
                    padding: '7px 16px',
                    border: '1px solid #0075C4',
                    background: activeFilter === filter ? '#0075C4' : 'transparent',
                    color: activeFilter === filter ? '#fff' : '#0075C4',
                    fontFamily: 'inherit', fontSize: 13,
                    fontWeight: 600, whiteSpace: 'nowrap',
                    cursor: 'pointer', borderRadius: 20,
                    touchAction: 'manipulation',
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Close button */}
            <button
              onClick={() => setPanelOpen(false)}
              style={{
                width: '100%', marginTop: 16,
                padding: 12, border: 'none',
                background: '#f8fafc', color: '#555',
                fontFamily: 'inherit', fontSize: 14,
                borderRadius: 8, cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              סגור
            </button>
          </div>
        </>
      )}
    </>
  );
}
