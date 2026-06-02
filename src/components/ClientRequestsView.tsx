'use client';

import { useCallback, useEffect, useState } from 'react';
import { getClientRequests, updateRequestStatus, deleteClientRequest, ClientRequest } from '@/lib/supabase';
import { CLIENTS, Client } from '@/data/clients';

const STATUS_LABELS: Record<string, string> = {
  new: 'חדש',
  in_progress: 'בטיפול',
  done: 'הושלם',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#6b7280',
  in_progress: '#d97706',
  done: '#16a34a',
};

function getClient(clientId: string): Client | undefined {
  return CLIENTS.find(c => c.id === clientId);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

interface RequestCardProps {
  request: ClientRequest;
  onClick: () => void;
  onDelete: () => void;
}

function RequestCard({ request, onClick, onDelete }: RequestCardProps) {
  const client = getClient(request.client_id);
  const clientColor = client?.color ?? '#6b7280';
  const clientName = client?.name ?? request.client_id;
  const statusColor = STATUS_COLORS[request.status] ?? '#6b7280';
  const statusLabel = STATUS_LABELS[request.status] ?? request.status;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        borderRight: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        borderLeft: `3px solid ${clientColor}`,
        borderRadius: 0,
        padding: 20,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        position: 'relative',
        boxSizing: 'border-box',
        textAlign: 'right',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {/* Delete button */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="מחק בקשה"
        style={{
          position: 'absolute', top: 8, left: 8,
          width: 22, height: 22, borderRadius: '50%',
          border: 'none', background: '#f3f4f6', color: '#9ca3af',
          cursor: 'pointer', fontSize: 14, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af'; }}
      >×</button>

      {/* Client badge */}
      <div>
        <span
          style={{
            display: 'inline-block',
            background: clientColor + '20',
            color: clientColor,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
            padding: '2px 8px',
            borderRadius: 2,
          }}
        >
          {clientName}
        </span>
      </div>

      {/* Subtopic / title */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.5,
          color: '#111111',
          direction: 'rtl',
          textAlign: 'right',
        }}
      >
        {request.subtopic}
      </div>

      {/* Description preview */}
      {request.description && (
        <div
          style={{
            fontSize: 12,
            color: '#555555',
            lineHeight: 1.6,
            flex: 1,
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          {request.description.length > 110
            ? request.description.slice(0, 110) + '…'
            : request.description}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 11, color: '#999' }}>
          {formatDate(request.created_at)}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: statusColor,
            background: statusColor + '18',
            padding: '2px 8px',
            borderRadius: 10,
          }}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

interface RequestDetailPanelProps {
  request: ClientRequest;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}

function RequestDetailPanel({ request, onClose, onStatusChange }: RequestDetailPanelProps) {
  const client = getClient(request.client_id);
  const clientColor = client?.color ?? '#6b7280';
  const clientName = client?.name ?? request.client_id;
  const [status, setStatus] = useState(request.status);
  const [saving, setSaving] = useState(false);

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    setStatus(newStatus);
    await updateRequestStatus(request.id, newStatus);
    setSaving(false);
    onStatusChange(request.id, newStatus);
  }

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
        height: '75vh',
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

        {/* Client name */}
        <div style={{ marginBottom: 8 }}>
          <span
            style={{
              display: 'inline-block',
              background: clientColor + '20',
              color: clientColor,
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 2,
            }}
          >
            {clientName}
          </span>
        </div>

        {/* Subtopic */}
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 16px', color: '#111' }}>
          {request.subtopic}
        </h2>

        {/* Description */}
        {request.description && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#0075C4', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
              פירוט
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: '#222', margin: 0, direction: 'rtl', textAlign: 'right' }}>
              {request.description}
            </p>
          </div>
        )}

        {/* Source */}
        {request.source && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
            <span style={{ fontWeight: 600, color: '#555', marginLeft: 6 }}>מקור:</span>
            {/^https?:\/\//.test(request.source) ? (
              <a
                href={request.source}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#60a5fa', textDecoration: 'underline', wordBreak: 'break-all' }}
              >
                {request.source}
              </a>
            ) : (
              request.source
            )}
          </div>
        )}

        {/* Date */}
        <div style={{ fontSize: 12, color: '#999', marginBottom: 20 }}>
          {formatDate(request.created_at)}
        </div>

        {/* Status */}
        <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#0075C4', marginBottom: 10 }}>
            סטטוס
          </div>
          <select
            value={status}
            onChange={e => handleStatusChange(e.target.value)}
            disabled={saving}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#111',
              fontFamily: 'inherit',
              fontSize: 14,
              outline: 'none',
              direction: 'rtl',
              cursor: 'pointer',
            }}
          >
            <option value="new">חדש</option>
            <option value="in_progress">בטיפול</option>
            <option value="done">הושלם</option>
          </select>
        </div>
      </div>
    </>
  );
}

export default function ClientRequestsView() {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const data = await getClientRequests();
      setRequests(data);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'שגיאה בטעינת הבקשות');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function handleStatusChange(id: string, status: string) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (selectedRequest?.id === id) {
      setSelectedRequest(prev => prev ? { ...prev, status } : null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteClientRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
      if (selectedRequest?.id === id) setSelectedRequest(null);
    } catch {
      // silent — user stays in place
    }
  }

  const filtered = clientFilter === 'all'
    ? requests
    : requests.filter(r => r.client_id === clientFilter);

  const pillBase: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Filter pills */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', gap: 8, flexWrap: 'wrap', direction: 'rtl' }}>
        <button
          type="button"
          onClick={() => setClientFilter('all')}
          style={{
            ...pillBase,
            background: clientFilter === 'all' ? '#111' : '#f3f4f6',
            color: clientFilter === 'all' ? '#fff' : '#374151',
          }}
        >
          הכל
        </button>
        {CLIENTS.map(client => (
          <button
            key={client.id}
            type="button"
            onClick={() => setClientFilter(client.id)}
            style={{
              ...pillBase,
              background: clientFilter === client.id ? client.color : client.color + '18',
              color: clientFilter === client.id ? '#fff' : client.color,
            }}
          >
            {client.name}
          </button>
        ))}
      </div>

      <main style={{ flex: 1, padding: '28px 32px' }}>
        {fetchError ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#ef4444', fontSize: 14 }}>
            <div style={{ marginBottom: 8 }}>⚠️ שגיאה בטעינת הבקשות</div>
            <div style={{ fontSize: 12, color: '#999', direction: 'ltr' }}>{fetchError}</div>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#999', fontSize: 14 }}>
            טוען...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#999', fontSize: 14 }}>
            אין בקשות עדיין
          </div>
        ) : (
          <div
            className="cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }}
          >
            {filtered.map(req => (
              <RequestCard
                key={req.id}
                request={req}
                onClick={() => setSelectedRequest(req)}
                onDelete={() => handleDelete(req.id)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedRequest && (
        <RequestDetailPanel
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
