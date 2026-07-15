import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { anchorSunday, localIso } from './scheduleUtils';

// Lazy singleton – prevents module-level instantiation during SSR/static pre-render
let _instance: SupabaseClient | null = null;

function getInstance(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _instance;
}

// Proxy so call sites keep using `supabase.from(...)` unchanged
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string) {
    return (getInstance() as unknown as Record<string, unknown>)[prop];
  },
});

export interface Comment {
  id: string;
  card_id: number;
  author_name: string;
  body: string;
  created_at: string;
}

export interface Suggestion {
  id: string;
  topic: string;
  subtopic: string;
  description: string;
  source: string;
  author_name: string;
  created_at: string;
  status: string;
}

export interface MessageShare {
  id: string;
  message_id: number;
  client_id: string;
  created_at: string;
}

export interface ClientRequest {
  id: string;
  client_id: string;
  client_name: string;
  subtopic: string;
  description: string;
  source: string;
  created_at: string;
  status: string;
}

// ─── message_shares helpers ───────────────────────────────────────────────────

export async function getSharesForMessage(messageId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('message_shares')
    .select('client_id')
    .eq('message_id', messageId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { client_id: string }) => row.client_id);
}

export async function getSharedMessageIds(clientId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('message_shares')
    .select('message_id')
    .eq('client_id', clientId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { message_id: number }) => row.message_id);
}

export async function addShare(messageId: number, clientId: string): Promise<void> {
  const { error } = await supabase
    .from('message_shares')
    .insert({ message_id: messageId, client_id: clientId });
  if (error) throw new Error(error.message);
}

export async function removeShare(messageId: number, clientId: string): Promise<void> {
  const { error } = await supabase
    .from('message_shares')
    .delete()
    .eq('message_id', messageId)
    .eq('client_id', clientId);
  if (error) throw new Error(error.message);
}

// ─── paper_shares helpers ─────────────────────────────────────────────────────

export async function getSharesForPaper(paperId: number): Promise<string[]> {
  const { data } = await supabase
    .from('paper_shares')
    .select('client_id')
    .eq('paper_id', paperId);
  return (data ?? []).map((row: { client_id: string }) => row.client_id);
}

export async function getSharedPaperIds(clientId: string): Promise<number[]> {
  const { data } = await supabase
    .from('paper_shares')
    .select('paper_id')
    .eq('client_id', clientId);
  return (data ?? []).map((row: { paper_id: number }) => row.paper_id);
}

export async function addPaperShare(paperId: number, clientId: string): Promise<void> {
  const { error } = await supabase
    .from('paper_shares')
    .insert({ paper_id: paperId, client_id: clientId });
  if (error) throw new Error(error.message);
}

export async function removePaperShare(paperId: number, clientId: string): Promise<void> {
  const { error } = await supabase
    .from('paper_shares')
    .delete()
    .eq('paper_id', paperId)
    .eq('client_id', clientId);
  if (error) throw new Error(error.message);
}

// ─── workplan_shares helpers (תכניות עבודה) ───────────────────────────────────

export async function getSharesForWorkplan(planId: number): Promise<string[]> {
  const { data } = await supabase
    .from('workplan_shares')
    .select('client_id')
    .eq('plan_id', planId);
  return (data ?? []).map((row: { client_id: string }) => row.client_id);
}

export async function getSharedWorkplanIds(clientId: string): Promise<number[]> {
  const { data } = await supabase
    .from('workplan_shares')
    .select('plan_id')
    .eq('client_id', clientId);
  return (data ?? []).map((row: { plan_id: number }) => row.plan_id);
}

export async function addWorkplanShare(planId: number, clientId: string): Promise<void> {
  const { error } = await supabase
    .from('workplan_shares')
    .insert({ plan_id: planId, client_id: clientId });
  if (error) throw new Error(error.message);
}

export async function removeWorkplanShare(planId: number, clientId: string): Promise<void> {
  const { error } = await supabase
    .from('workplan_shares')
    .delete()
    .eq('plan_id', planId)
    .eq('client_id', clientId);
  if (error) throw new Error(error.message);
}

// ─── site_sessions (usage analytics) ─────────────────────────────────────────

export interface SiteSession {
  id: string;
  client_id: string | null;
  client_name: string | null;
  role: string;
  user_label: string;
  started_at: string;
  last_active: string;
  user_agent: string | null;
}

export async function startSession(s: {
  client_id: string | null;
  client_name: string | null;
  role: string;
  user_label: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('site_sessions')
    .insert({
      ...s,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    .select('id')
    .single();
  if (error) return null;
  return (data as { id: string }).id;
}

export async function pingSession(id: string): Promise<void> {
  await supabase
    .from('site_sessions')
    .update({ last_active: new Date().toISOString() })
    .eq('id', id);
}

// Best-effort final ping on tab close — keepalive fetch survives unload where a
// normal supabase-js request would be cancelled.
export function pingSessionBeacon(id: string): void {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!base || !key) return;
    fetch(`${base}/rest/v1/site_sessions?id=eq.${id}`, {
      method: 'PATCH',
      keepalive: true,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ last_active: new Date().toISOString() }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function getSiteSessions(): Promise<SiteSession[]> {
  const { data, error } = await supabase
    .from('site_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(2000);
  if (error) {
    console.error('getSiteSessions failed:', error.message);
    return [];
  }
  return (data ?? []) as SiteSession[];
}

// ─── client_requests helpers ──────────────────────────────────────────────────

export async function submitClientRequest(data: {
  client_id: string;
  client_name: string;
  subtopic: string;
  description: string;
  source: string;
}): Promise<void> {
  const { error } = await supabase.from('client_requests').insert({
    ...data,
    status: 'new',
  });
  if (error) throw new Error(error.message);
}

export async function getClientRequests(): Promise<ClientRequest[]> {
  const { data, error } = await supabase
    .from('client_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateRequestStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('client_requests')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteClientRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('client_requests')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── intake_queue (הזנה מהירה — תוכן גולמי לעיבוד לקלפים) ─────────────────────

export interface IntakeItem {
  id: string;
  raw_text: string;
  topic_hint: string | null;
  image_url: string | null;
  author_name: string | null;
  status: string; // pending / processed / rejected
  processed_note: string | null;
  created_at: string;
}

export async function submitIntake(data: {
  raw_text: string;
  topic_hint: string | null;
  author_name: string;
  image?: File | null;
}): Promise<void> {
  let image_url: string | null = null;
  if (data.image) {
    const ext = (data.image.name.split('.').pop() || 'png').toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('intake')
      .upload(path, data.image, { contentType: data.image.type || 'image/png' });
    if (upErr) throw new Error(`העלאת התמונה נכשלה: ${upErr.message}`);
    image_url = supabase.storage.from('intake').getPublicUrl(path).data.publicUrl;
  }
  const { error } = await supabase.from('intake_queue').insert({
    raw_text: data.raw_text,
    topic_hint: data.topic_hint,
    author_name: data.author_name,
    image_url,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function getIntakeQueue(): Promise<IntakeItem[]> {
  const { data, error } = await supabase
    .from('intake_queue')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as IntakeItem[];
}

export async function updateIntakeStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('intake_queue')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── manual_schedule_events ───────────────────────────────────────────────────

export interface ManualScheduleEvent {
  id: string;
  week_id: string;
  day: string;
  time: string;
  title: string;
  summary: string;
  detail: string;
  source: string;
  category: string;
  color: string;
}

export function getCurrentWeekId(): string {
  // Manual schedule events belong to the anchored week (matches the docx
  // rollover and KnessetUpdates week anchoring via the same shared helper)
  return localIso(anchorSunday(new Date()));
}

export async function addManualScheduleEvent(
  ev: Omit<ManualScheduleEvent, 'id' | 'week_id'>
): Promise<ManualScheduleEvent> {
  const { data, error } = await supabase
    .from('manual_schedule_events')
    .insert({ ...ev, week_id: getCurrentWeekId() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ManualScheduleEvent;
}

export async function getManualScheduleEvents(): Promise<ManualScheduleEvent[]> {
  const { data, error } = await supabase
    .from('manual_schedule_events')
    .select('*')
    .eq('week_id', getCurrentWeekId());
  if (error) {
    console.error('getManualScheduleEvents failed:', error.message);
    return [];
  }
  return (data ?? []) as ManualScheduleEvent[];
}

// ─── cbs_price_data ──────────────────────────────────────────────────────────

export interface CbsPriceRow {
  code_id: number;
  name: string;
  category: string;
  cumulative_change: number;
  latest_period: string;
  updated_at: string;
  price_base?: number;
  price_latest?: number;
  unit?: string;
}

export async function getCbsPriceData(): Promise<CbsPriceRow[]> {
  const { data, error } = await supabase.from('cbs_price_data').select('*');
  if (error) {
    console.error('getCbsPriceData failed:', error.message);
    return [];
  }
  return (data ?? []) as CbsPriceRow[];
}

// ─── knesset_sessions ─────────────────────────────────────────────────────────

export interface KnessetSessionRow {
  id: string;
  committee: string;
  title: string;
  day_name: string;
  date: string;
  time: string;
  url: string;
  status: string;
  session_type?: string;
  last_seen?: string;
}

export async function getWeeklyKnessetSessions(): Promise<KnessetSessionRow[]> {
  const { data, error } = await supabase.from('knesset_sessions').select('*');
  if (error) {
    console.error('getWeeklyKnessetSessions failed:', error.message);
    return [];
  }
  return (data ?? []) as KnessetSessionRow[];
}

// ─── schedule cancellations (knesset_updates.marked_in_schedule) ──────────────

export async function markKnessetUpdateInSchedule(id: string, marked: boolean): Promise<void> {
  const { error } = await supabase
    .from('knesset_updates')
    .update({ marked_in_schedule: marked })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export interface ScheduleCancellation {
  committee: string;
  day_name: string;
  time_before: string;
}

export async function getScheduleCancellations(): Promise<ScheduleCancellation[]> {
  const { data, error } = await supabase
    .from('knesset_updates')
    .select('committee, day_name, time_before')
    .eq('update_type', 'cancel')
    .eq('marked_in_schedule', true);
  if (error) {
    console.error('getScheduleCancellations failed:', error.message);
    return [];
  }
  return (data ?? []) as ScheduleCancellation[];
}

// ─── poll tracker (מגמת הסקרים) ───────────────────────────────────────────────

export interface PollParty {
  slug: string;
  name_he: string;
  color: string;
  bloc: 'coalition' | 'opposition' | 'arab' | 'other';
  active_from: string | null;
  active_to: string | null;
}

export interface PollRow {
  id: number;
  published_at: string;
  broadcaster: 'ch12' | 'ch13' | 'election';
  pollster: string | null;
  sample_size: number | null;
  notes: string | null;
}

export interface PollResultRow {
  poll_id: number;
  party_slug: string;
  seats: number | null;  // null = לא נמדדה / מתחת לאחוז החסימה — לא אפס
}

export interface PollEventRow {
  id: number;
  date: string;
  label_he: string;
  description: string | null;
  emphasis: 'major' | 'minor';
}

export interface PollTrackerData {
  parties: PollParty[];
  polls: PollRow[];
  results: PollResultRow[];
  events: PollEventRow[];
}

export async function getPollTrackerData(): Promise<PollTrackerData> {
  const [parties, polls, results, events] = await Promise.all([
    supabase.from('parties').select('*'),
    supabase.from('polls').select('*').order('published_at'),
    supabase.from('poll_results').select('*'),
    supabase.from('events').select('*').order('date'),
  ]);
  for (const r of [parties, polls, results, events]) {
    if (r.error) {
      console.error('getPollTrackerData failed:', r.error.message);
      return { parties: [], polls: [], results: [], events: [] };
    }
  }
  return {
    parties: (parties.data ?? []) as PollParty[],
    polls: (polls.data ?? []) as PollRow[],
    results: (results.data ?? []) as PollResultRow[],
    events: (events.data ?? []) as PollEventRow[],
  };
}
