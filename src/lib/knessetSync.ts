import { supabase } from './supabase';
import { fetchKnessetWeeklySessions, KnessetSession } from './knesset';

export interface KnessetUpdate {
  id: string;
  session_id: string;
  update_type: 'new' | 'cancel' | 'change';
  committee: string;
  title: string;
  day_name: string;
  date: string;
  time_before: string;
  time_after: string;
  url: string;
  change_desc: string;
  created_at: string;
}

interface StoredSession {
  id: string;
  committee: string;
  title: string;
  day_name: string;
  date: string;
  time: string;
  url: string;
  status: string; // 'active' | 'cancelled'
}

export async function syncKnessetSessions(): Promise<KnessetUpdate[]> {
  const all = await fetchKnessetWeeklySessions();

  // Split into active and cancelled based on live API status
  const liveActive   = all.filter(s => !s.cancelled);
  const liveCancelled = all.filter(s => s.cancelled);

  const { data: stored } = await supabase.from('knesset_sessions').select('*');
  const storedMap = new Map(((stored ?? []) as StoredSession[]).map(s => [s.id, s]));

  const newUpdates: Omit<KnessetUpdate, 'id' | 'created_at'>[] = [];

  // ── Detect NEW sessions (active, not seen before) ─────────────────────────
  for (const session of liveActive) {
    const prev = storedMap.get(session.id);
    if (!prev) {
      newUpdates.push({
        session_id: session.id,
        update_type: 'new',
        committee: session.committee,
        title: session.title,
        day_name: session.dayName,
        date: session.date,
        time_before: '',
        time_after: session.time,
        url: session.url,
        change_desc: 'ישיבה חדשה נוספה ללו"ז',
      });
    } else if (prev.status === 'cancelled') {
      // Session was cancelled but is now active again
      newUpdates.push({
        session_id: session.id,
        update_type: 'new',
        committee: session.committee,
        title: session.title,
        day_name: session.dayName,
        date: session.date,
        time_before: '',
        time_after: session.time,
        url: session.url,
        change_desc: 'ישיבה שהוחזרה ללו"ז לאחר ביטול',
      });
    } else if (prev.time !== session.time) {
      // Time changed
      newUpdates.push({
        session_id: session.id,
        update_type: 'change',
        committee: session.committee,
        title: session.title,
        day_name: session.dayName,
        date: session.date,
        time_before: prev.time,
        time_after: session.time,
        url: session.url,
        change_desc: `השעה שונתה מ-${prev.time} ל-${session.time}`,
      });
    }
  }

  // ── Detect CANCELLATIONS ──────────────────────────────────────────────────
  // Case A: Session was stored as active, now API marks it cancelled
  for (const session of liveCancelled) {
    const prev = storedMap.get(session.id);
    if (prev && prev.status === 'active') {
      newUpdates.push({
        session_id: session.id,
        update_type: 'cancel',
        committee: session.committee,
        title: session.title,
        day_name: session.dayName,
        date: session.date,
        time_before: prev.time,
        time_after: '',
        url: session.url,
        change_desc: 'הישיבה בוטלה',
      });
    }
  }

  // Case B: Session was stored as active but disappeared from API entirely
  const allLiveIds = new Set(all.map(s => s.id));
  for (const prev of ((stored ?? []) as StoredSession[])) {
    if (!allLiveIds.has(prev.id) && prev.status === 'active') {
      newUpdates.push({
        session_id: prev.id,
        update_type: 'cancel',
        committee: prev.committee,
        title: prev.title,
        day_name: prev.day_name,
        date: prev.date,
        time_before: prev.time,
        time_after: '',
        url: prev.url,
        change_desc: 'הישיבה הוסרה מהלו"ז',
      });
    }
  }

  // ── Persist current state ─────────────────────────────────────────────────
  if (all.length > 0) {
    await supabase.from('knesset_sessions').upsert(
      all.map((s: KnessetSession) => ({
        id: s.id,
        committee: s.committee,
        title: s.title,
        day_name: s.dayName,
        date: s.date,
        time: s.time,
        url: s.url,
        status: s.cancelled ? 'cancelled' : 'active',
        last_seen: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );
  }

  if (newUpdates.length > 0) {
    await supabase.from('knesset_updates').insert(newUpdates);
  }

  return getRecentKnessetUpdates();
}

export async function getRecentKnessetUpdates(): Promise<KnessetUpdate[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('knesset_updates')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as KnessetUpdate[];
}
