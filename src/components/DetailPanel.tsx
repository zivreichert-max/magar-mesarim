'use client';

import { useEffect } from 'react';
import { Message, TOPICS } from '@/data/messages';
import CommentsSection from '@/components/CommentsSection';

interface DetailPanelProps {
  message: Message | null;
  onClose: () => void;
  authorName: string;
}

// ─── Source rendering ────────────────────────────────────────────────────────

const linkStyle: React.CSSProperties = {
  color: '#60a5fa',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  wordBreak: 'break-all',
};

/** Parse a single source segment for an embedded URL. */
function parseSourceSegment(segment: string): React.ReactNode {
  const s = segment.trim();

  // "label - https://..." or "label – https://..."
  const labeled = s.match(/^(.+?)\s*[-–]\s*(https?:\/\/\S+)$/);
  if (labeled) {
    return (
      <a href={labeled[2]} target="_blank" rel="noopener noreferrer" style={linkStyle}>
        {labeled[1].trim()}
      </a>
    );
  }

  // Bare URL
  if (/^https?:\/\/\S+$/.test(s)) {
    return (
      <a href={s} target="_blank" rel="noopener noreferrer" style={linkStyle}>
        {s}
      </a>
    );
  }

  // Inline URL somewhere in the text
  const inlineUrl = s.match(/^(.*?)(https?:\/\/\S+)(.*)$/);
  if (inlineUrl) {
    return (
      <>
        {inlineUrl[1]}
        <a href={inlineUrl[2]} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          {inlineUrl[2]}
        </a>
        {inlineUrl[3]}
      </>
    );
  }

  return s;
}

/** Render the source field, with clickable links where URLs are detected. */
function renderSource(source: string, sourceUrl?: string): React.ReactNode {
  // Explicit sourceUrl: wrap the entire source text as a single link
  if (sourceUrl) {
    return (
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
        {source}
      </a>
    );
  }

  // Split by " | " to handle multi-source strings
  const segments = source.split('|').map(s => s.trim()).filter(Boolean);
  return segments.map((seg, i) => (
    <span key={i}>
      {i > 0 && <span style={{ color: '#555555', margin: '0 6px' }}>·</span>}
      {parseSourceSegment(seg)}
    </span>
  ));
}

// ─── Detail rendering (plain text + table support) ───────────────────────────

/** Check whether a line looks like a table row (contains a pipe character). */
function isPipeRow(line: string) {
  return line.includes('|');
}

/** Markdown separator lines like |---|---| — skip these. */
function isSeparatorRow(line: string) {
  return /^[\s|:\-]+$/.test(line);
}

function renderDetailTable(rows: string[][], key: number) {
  return (
    <div key={`tbl-${key}`} style={{ overflowX: 'auto', marginTop: 6, marginBottom: 6 }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          lineHeight: 1.6,
          direction: 'rtl',
        }}
      >
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ background: ri % 2 === 0 ? '#ffffff' : '#f8fafc' }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #e5e7eb',
                    color: '#111111',
                    fontWeight: ci === 0 ? 600 : 400,
                    opacity: ci === 0 ? 1 : 0.75,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render detail text with inline table detection. */
function renderDetail(detail: string): React.ReactNode {
  const lines = detail.split('\n');
  const nonEmptyLines = lines.map(l => l.trim()).filter(Boolean);

  // If ANY line contains ' | ', collect all pipe-lines as a table and non-pipe as paragraphs
  const hasAnyPipe = nonEmptyLines.some(l => l.includes(' | ') && !isSeparatorRow(l));

  if (hasAnyPipe) {
    const tableRows: string[][] = [];
    const paraNodes: React.ReactNode[] = [];
    const nodes: React.ReactNode[] = [];
    let tableKey = 0;

    for (const trimmed of nonEmptyLines) {
      if (isSeparatorRow(trimmed)) continue;
      if (trimmed.includes(' | ')) {
        tableRows.push(
          trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
        );
      } else {
        // Flush pending table rows before adding paragraph
        if (tableRows.length > 0) {
          nodes.push(renderDetailTable([...tableRows], tableKey++));
          tableRows.length = 0;
        }
        nodes.push(
          <p key={`p-${nodes.length}`} style={{ fontSize: 14, lineHeight: 1.75, color: '#333333', margin: 0, direction: 'rtl', textAlign: 'right' }}>
            {trimmed}
          </p>
        );
      }
    }
    // Flush remaining table rows
    if (tableRows.length > 0) {
      nodes.push(renderDetailTable([...tableRows], tableKey++));
    }

    return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{nodes}</div>;
  }

  // No pipe rows — render each non-empty line as a paragraph
  const nodes: React.ReactNode[] = [];
  for (const trimmed of nonEmptyLines) {
    nodes.push(
      <p key={nodes.length} style={{ fontSize: 14, lineHeight: 1.75, color: '#333333', margin: 0, direction: 'rtl', textAlign: 'right' }}>
        {trimmed}
      </p>
    );
  }

  if (nodes.length === 0) {
    return (
      <p style={{ fontSize: 14, lineHeight: 1.75, color: '#333333', margin: 0, direction: 'rtl', textAlign: 'right' }}>
        {detail}
      </p>
    );
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{nodes}</div>;
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        color: '#0075C4',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      {children}
    </h3>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DetailPanel({ message, onClose, authorName }: DetailPanelProps) {
  const isOpen = !!message;
  const color = message ? (TOPICS[message.topic]?.color ?? '#fff') : '#fff';

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9998,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity 0.25s',
          backdropFilter: isOpen ? 'blur(4px)' : 'none',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '100vw',
          zIndex: 9999,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#f8fafc',
        }}
      >
        {message && (
          <>
            {/* Panel Header */}
            <div
              style={{
                padding: '24px 24px 20px',
                background: '#0075C4',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      background: 'rgba(255,255,255,0.2)',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 2,
                    }}
                  >
                    {message.topic}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Heebo', sans-serif",
                    fontSize: 20,
                    fontWeight: 900,
                    lineHeight: 1.4,
                    color: '#ffffff',
                    direction: 'rtl',
                    textAlign: 'right',
                  }}
                >
                  {message.title}
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 2,
                  padding: '8px 10px',
                  fontSize: 18,
                  cursor: 'pointer',
                  color: '#ffffff',
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              >
                ✕
              </button>
            </div>

            {/* Panel Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 24,
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              {/* Summary */}
              {message.summary && (
                <section>
                  <SectionHeading>תקציר</SectionHeading>
                  <p style={{ fontSize: 15, lineHeight: 1.85, color: '#111111', margin: 0, direction: 'rtl', textAlign: 'right' }}>
                    {message.summary}
                  </p>
                </section>
              )}

              {/* Detail – with table support */}
              {message.detail && message.detail.trim() && (
                <section>
                  <SectionHeading>הרחבה</SectionHeading>
                  {renderDetail(message.detail)}
                </section>
              )}

              {/* ── ויזואליה ── */}
              {message.visual && (
                <section style={{ marginTop: 16 }}>
                  {message.visual.startsWith('/visuals/') ? (
                    <img
                      src={message.visual}
                      alt="ויזואליה"
                      style={{ width: '100%', borderRadius: 8, display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      minHeight: 120,
                      background: '#f8fafc',
                      border: '1px dashed #e5e7eb',
                      borderRadius: 10,
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: 0.3 }}>
                        📊 ויזואליה
                      </div>
                      <div style={{ fontSize: 13, color: '#555555', lineHeight: 1.6 }}>
                        {message.visual}
                      </div>
                      <div style={{ fontSize: 11, color: '#555555', opacity: 0.6 }}>
                        גרף / תמונה יצורפו בקרוב
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Source – with clickable URL support */}
              {message.source && (
                <section>
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 2,
                      padding: '12px 16px',
                    }}
                  >
                    <strong
                      style={{
                        display: 'block',
                        marginBottom: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        color: '#0075C4',
                      }}
                    >
                      מקורות ועדכניות
                    </strong>
                    <span style={{ fontSize: 12, color: '#555555', lineHeight: 1.7 }}>
                      {renderSource(message.source)}
                    </span>
                  </div>
                </section>
              )}

              {/* Empty state */}
              {!message.summary && !message.detail && !message.source && !message.visual && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#555555',
                    fontSize: 13,
                  }}
                >
                  תוכן בפיתוח – יתווסף בקרוב
                </div>
              )}

              {/* Divider before comments */}
              <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 4 }} />

              {/* Comments */}
              <CommentsSection cardId={message.id} authorName={authorName} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
