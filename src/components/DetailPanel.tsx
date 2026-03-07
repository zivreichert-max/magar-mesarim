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
      {i > 0 && <span style={{ color: 'var(--muted)', margin: '0 6px' }}>·</span>}
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
              style={{ background: ri % 2 === 0 ? 'var(--bg)' : 'var(--bg3)' }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '7px 12px',
                    border: '1px solid var(--border)',
                    color: ci === 0 ? 'var(--text)' : 'rgba(232,230,224,0.75)',
                    fontWeight: ci === 0 ? 600 : 400,
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
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (isPipeRow(trimmed) && !isSeparatorRow(trimmed)) {
      // Collect consecutive pipe rows into a table
      const tableLines: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t) { i++; break; }
        if (isPipeRow(t) && !isSeparatorRow(t)) {
          tableLines.push(t);
          i++;
        } else if (isSeparatorRow(t)) {
          i++; // skip markdown separator rows
        } else {
          break;
        }
      }
      const rows = tableLines.map(l =>
        l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
      );
      if (rows.length >= 2) {
        nodes.push(renderDetailTable(rows, nodes.length));
      } else if (rows.length === 1) {
        // Single pipe-row: render as plain text
        nodes.push(
          <p key={nodes.length} style={{ fontSize: 14, lineHeight: 1.9, color: 'rgba(232,230,224,0.8)', margin: 0 }}>
            {tableLines[0]}
          </p>
        );
      }
    } else {
      nodes.push(
        <p key={nodes.length} style={{ fontSize: 14, lineHeight: 1.9, color: 'rgba(232,230,224,0.8)', margin: 0 }}>
          {trimmed}
        </p>
      );
      i++;
    }
  }

  // No newlines → whole string is a single paragraph (most existing items)
  if (nodes.length === 0) {
    return (
      <p style={{ fontSize: 14, lineHeight: 1.9, color: 'rgba(232,230,224,0.8)', margin: 0 }}>
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
        color: 'var(--muted)',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)',
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
          zIndex: 100,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity 0.25s',
          backdropFilter: isOpen ? 'blur(4px)' : 'none',
        }}
      />

      {/* Panel – slides in from left (RTL) */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 520,
          maxWidth: '100vw',
          background: 'var(--bg2)',
          borderRight: '1px solid var(--border)',
          zIndex: 101,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {message && (
          <>
            {/* Panel Header */}
            <div
              style={{
                padding: '24px 24px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color }}>
                    {message.topic}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    color: 'var(--text)',
                  }}
                >
                  {message.title}
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 18,
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
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
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              {/* Summary */}
              {message.summary && (
                <section>
                  <SectionHeading>תקציר</SectionHeading>
                  <p style={{ fontSize: 15, lineHeight: 1.85, color: 'rgba(232,230,224,0.9)', margin: 0 }}>
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

              {/* Visual placeholder */}
              {message.visual && (
                <section>
                  <SectionHeading>ויזואליה</SectionHeading>
                  <div
                    style={{
                      border: '1px dashed rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      padding: '20px 18px',
                      background: 'rgba(255,255,255,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: 28 }}>📊</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--muted)',
                        letterSpacing: 0.5,
                      }}
                    >
                      ויזואליה בפיתוח
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(122,125,138,0.8)', lineHeight: 1.5 }}>
                      {message.visual}
                    </span>
                  </div>
                </section>
              )}

              {/* Source – with clickable URL support */}
              {message.source && (
                <section>
                  <div
                    style={{
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
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
                        color: 'var(--text)',
                      }}
                    >
                      מקורות ועדכניות
                    </strong>
                    <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                      {renderSource(message.source, message.sourceUrl)}
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
                    color: 'var(--muted)',
                    fontSize: 13,
                  }}
                >
                  תוכן בפיתוח – יתווסף בקרוב
                </div>
              )}

              {/* Divider before comments */}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }} />

              {/* Comments */}
              <CommentsSection cardId={message.id} authorName={authorName} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
