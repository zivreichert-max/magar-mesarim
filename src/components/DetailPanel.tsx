'use client';

import { useEffect, useState } from 'react';
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
          <p key={`p-${nodes.length}`} style={{ fontSize: 15, lineHeight: 1.8, color: '#222', margin: 0, direction: 'rtl', textAlign: 'right' }}>
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
      <p key={nodes.length} style={{ fontSize: 15, lineHeight: 1.8, color: '#222', margin: 0, direction: 'rtl', textAlign: 'right' }}>
        {trimmed}
      </p>
    );
  }

  if (nodes.length === 0) {
    return (
      <p style={{ fontSize: 15, lineHeight: 1.8, color: '#222', margin: 0, direction: 'rtl', textAlign: 'right' }}>
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
  const color = message ? (TOPICS[message.topic]?.color ?? '#fff') : '#fff';
  const [imgZoomed, setImgZoomed] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (message) {
      window.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [message, onClose]);

  if (!message) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
        }}
      />
      <div style={{
        position: 'fixed',
        top: 'auto', bottom: 0, left: 0, right: 0,
        height: '85vh',
        background: '#fff',
        zIndex: 9999,
        overflowY: 'auto',
        borderRadius: '12px 12px 0 0',
        padding: '20px',
        direction: 'rtl',
      }}>
        <button
          onClick={onClose}
          type="button"
          style={{
            fontSize: 16, fontWeight: 700,
            color: '#0075C4', background: 'none',
            border: 'none', cursor: 'pointer',
            marginBottom: 16, display: 'block',
          }}
        >
          ✕ סגור
        </button>
        <div style={{fontSize: 11, color: '#0075C4', fontWeight: 700, marginBottom: 8}}>
          {message.topic}
        </div>
        <h2 style={{fontSize: 20, fontWeight: 900, margin: '0 0 16px', color: '#111'}}>
          {message.title}
        </h2>
        {message.summary && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeading>תקציר</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.85, color: '#222', margin: 0, direction: 'rtl', textAlign: 'right' }}>
              {message.summary}
            </p>
          </div>
        )}
        {message.visual && message.visual.startsWith('/visuals/') && (
          <>
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <img
                src={message.visual}
                onClick={() => setImgZoomed(true)}
                style={{ maxWidth: '100%', maxHeight: '40vh', borderRadius: 8, objectFit: 'contain', display: 'inline-block', cursor: 'zoom-in' }}
                alt=""
                title="לחץ להגדלה"
              />
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>לחץ על התמונה להגדלה</div>
            </div>
            {imgZoomed && (
              <div
                onClick={() => setImgZoomed(false)}
                style={{
                  position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
                  background: 'rgba(0,0,0,0.85)',
                  zIndex: 19999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'zoom-out',
                }}
              >
                <img
                  src={message.visual}
                  style={{ maxWidth: '95vw', maxHeight: '92vh', borderRadius: 8, objectFit: 'contain' }}
                  alt=""
                />
                <div style={{ position: 'absolute', top: 16, left: 16, color: '#fff', fontSize: 24, cursor: 'pointer', fontWeight: 700 }}>✕</div>
              </div>
            )}
          </>
        )}
        {message.detail && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeading>הרחבה</SectionHeading>
            {renderDetail(message.detail)}
          </div>
        )}
        {message.source && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 8, borderTop: '1px solid #eee', paddingTop: 12 }}>
            <span style={{ fontWeight: 600, color: '#555', marginLeft: 6 }}>מקור:</span>
            {renderSource(message.source)}
          </div>
        )}
        <div style={{borderTop: '1px solid #eee', marginTop: 20, paddingTop: 16}}>
          <CommentsSection cardId={message.id} authorName={authorName} />
        </div>
      </div>
    </>
  );
}
