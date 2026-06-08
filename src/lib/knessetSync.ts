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
  marked_in_schedule?: boolean;
}

interface StoredSession {
  id: string;
  committee: string;
  title: string;
  day_name: string;
  date: string;
  time: string;
  url: string;
  status: string;
}

export async function syncKnessetSessions(): Promise<KnessetUpdate[]> {
  const all = await fetchKnessetWeeklySessions();
  const liveActive    = all.filter(s => !s.cancelled);
  const liveCancelled = all.filter(s => s.cancelled);

  const { data: stored } = await supabase.from('knesset_sessions').select('*');
  const storedMap = new Map(((stored ?? []) as StoredSession[]).map(s => [s.id, s]));

  // Load existing updates so we don't create duplicates
  const { data: existingUpdates } = await supabase
    .from('knesset_updates')
    .select('session_id, update_type');
  const alreadyCancelled = new Set(
    (existingUpdates ?? [])
      .filter((u: { update_type: string }) => u.update_type === 'cancel')
      .map((u: { session_id: string }) => u.session_id)
  );

  const isFirstRun = (stored ?? []).length === 0;
  const newUpdates: Omit<KnessetUpdate, 'id' | 'created_at'>[] = [];

  // ── ALL currently-cancelled sessions → ensure a cancel update exists ────────
  for (const session of liveCancelled) {
    if (!alreadyCancelled.has(session.id)) {
      const prev = storedMap.get(session.id);
      newUpdates.push({
        session_id: session.id,
        update_type: 'cancel',
        committee: session.committee,
        title: session.title,
        day_name: session.dayName,
        date: session.date,
        time_before: prev?.time ?? session.time,
        time_after: '',
        url: session.url,
        change_desc: 'הישיבה בוטלה',
      });
    }
  }

  // ── Active sessions: detect NEW and TIME CHANGES — skip on first run ────────
  if (!isFirstRun) for (const session of liveActive) {
    const prev = storedMap.get(session.id);
    if (!prev || prev.status === 'cancelled') {
      // New or reactivated — only report if not seen as "new" before
      const alreadyNew = (existingUpdates ?? []).some(
        (u: { session_id: string; update_type: string }) =>
          u.session_id === session.id && u.update_type === 'new'
      );
      if (!alreadyNew) {
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
          change_desc: prev?.status === 'cancelled'
            ? 'ישיבה שהוחזרה ללו"ז לאחר ביטול'
            : 'ישיבה חדשה נוספה ללו"ז',
        });
      }
    } else if (prev.time !== session.time) {
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

export async function getAllKnessetUpdates(): Promise<KnessetUpdate[]> {
  const { data } = await supabase
    .from('knesset_updates')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as KnessetUpdate[];
}
