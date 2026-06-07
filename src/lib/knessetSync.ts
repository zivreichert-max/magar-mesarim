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
  status: string;
}

export async function syncKnessetSessions(): Promise<KnessetUpdate[]> {
  const live = await fetchKnessetWeeklySessions();

  const { data: stored } = await supabase
    .from('knesset_sessions')
    .select('*');

  const storedMap = new Map((stored ?? []).map((s: StoredSession) => [s.id, s]));
  const liveMap = new Map(live.map((s: KnessetSession) => [s.id, s]));

  const newUpdates: Omit<KnessetUpdate, 'id' | 'created_at'>[] = [];

  for (const session of live) {
    const prev = storedMap.get(session.id) as StoredSession | undefined;
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

  for (const prev of ((stored ?? []) as StoredSession[])) {
    if (!liveMap.has(prev.id) && prev.status === 'active') {
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
        change_desc: 'הישיבה בוטלה',
      });
    }
  }

  if (live.length > 0) {
    await supabase.from('knesset_sessions').upsert(
      live.map((s: KnessetSession) => ({
        id: s.id,
        committee: s.committee,
        title: s.title,
        day_name: s.dayName,
        date: s.date,
        time: s.time,
        url: s.url,
        status: 'active',
        last_seen: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );

    const liveIds = live.map((s: KnessetSession) => s.id);
    await supabase
      .from('knesset_sessions')
      .update({ status: 'cancelled' })
      .not('id', 'in', `(${liveIds.map(id => `'${id}'`).join(',')})`)
      .eq('status', 'active');
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
    .limit(20);
  return (data ?? []) as KnessetUpdate[];
}
