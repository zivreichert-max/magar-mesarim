'use client';
import { useState } from 'react';
import { SCHEDULE, WEEK_TITLE, ScheduleEvent } from '@/data/schedule';

const CATS = [
  { id: 'all', label: 'הכל', color: '#6b7280' },
  { id: 'bgz', label: 'בג"ץ', color: '#0075C4' },
  { id: 'gov', label: 'ממשלה', color: '#16a34a' },
  { id: 'ministers', label: 'ועדת שרים', color: '#d97706' },
  { id: 'knesset', label: 'ועדות כנסת', color: '#6b7280' },
];

const DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי'];

export default function ScheduleView() {
  const [activeCat, setActiveCat] = useState('all');
  const [openEvent, setOpenEvent] = useState<number | null>(null);

  const filtered = SCHEDULE.filter(e =>
    activeCat === 'all' || e.category === activeCat
  );

  const byDay = DAYS.map(day => ({
    day,
    events: filtered.filter(e => e.day.startsWith(day)),
  })).filter(d => d.events.length > 0);

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>
      {/* Sticky header with week title + category filter */}
      <div style={{
        background: '#fff', borderBottom: '0.5px solid #e5e7eb',
        padding: '10px 24px', position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ fontSize: 12, color: '#0075C4', fontWeight: 600, marginBottom: 8 }}>
          {WEEK_TITLE}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATS.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCat(cat.id)}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 600,
                border: `1px solid ${cat.color}`,
                background: activeCat === cat.id ? cat.color : 'transparent',
                color: activeCat === cat.id ? '#fff' : cat.color,
                borderRadius: 2, cursor: 'pointer',
                fontFamily: 'inherit', touchAction: 'manipulation',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events list */}
      <div style={{ padding: '16px 24px 80px' }}>
        {byDay.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            אין אירועים בסינון זה
          </div>
        )}
        {byDay.map(({ day, events }) => (
          <div key={day} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 14, fontWeight: 700,
              borderBottom: '0.5px solid #e5e7eb',
              paddingBottom: 6, marginBottom: 6,
            }}>
              {day}
            </div>
            {events.map((ev) => {
              const globalIdx = SCHEDULE.indexOf(ev);
              const isOpen = openEvent === globalIdx;
              const hasDetail = !!(ev.summary || ev.detail);
              return (
                <div
                  key={globalIdx}
                  style={{
                    background: '#fff',
                    border: '0.5px solid #e5e7eb',
                    borderRight: `3px solid ${ev.color}`,
                    borderRadius: 4,
                    marginBottom: 5,
                    overflow: 'hidden',
                    cursor: hasDetail ? 'pointer' : 'default',
                  }}
                  onClick={() => hasDetail && setOpenEvent(isOpen ? null : globalIdx)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px' }}>
                    {ev.time && (
                      <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 38, paddingTop: 2, flexShrink: 0 }}>
                        {ev.time}
                      </span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'inline-block', fontSize: 9, fontWeight: 700,
                        padding: '1px 7px', borderRadius: 2, marginBottom: 4,
                        background: ev.color + '20', color: ev.color,
                      }}>
                        {CATS.find(c => c.id === ev.category)?.label}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
                        {ev.title}
                      </div>
                    </div>
                    {hasDetail && (
                      <span style={{
                        color: '#0075C4', fontSize: 16,
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s', flexShrink: 0,
                      }}>›</span>
                    )}
                  </div>
                  {isOpen && hasDetail && (
                    <div style={{
                      borderTop: '0.5px solid #e5e7eb',
                      padding: '10px 14px',
                      background: '#fafbff',
                    }}>
                      {ev.summary && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#0075C4', marginBottom: 4, letterSpacing: '0.06em' }}>תקציר</div>
                          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>{ev.summary}</div>
                        </div>
                      )}
                      {ev.detail && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#0075C4', marginBottom: 4, letterSpacing: '0.06em' }}>הרחבה</div>
                          <div style={{ fontSize: 12, lineHeight: 1.75, color: '#555' }}>{ev.detail}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
