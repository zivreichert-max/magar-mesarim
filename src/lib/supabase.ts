import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  const { data } = await supabase
    .from('message_shares')
    .select('client_id')
    .eq('message_id', messageId);
  return (data ?? []).map((row: { client_id: string }) => row.client_id);
}

export async function getSharedMessageIds(clientId: string): Promise<number[]> {
  const { data } = await supabase
    .from('message_shares')
    .select('message_id')
    .eq('client_id', clientId);
  return (data ?? []).map((row: { message_id: number }) => row.message_id);
}

export async function addShare(messageId: number, clientId: string): Promise<void> {
  await supabase
    .from('message_shares')
    .insert({ message_id: messageId, client_id: clientId });
}

export async function removeShare(messageId: number, clientId: string): Promise<void> {
  await supabase
    .from('message_shares')
    .delete()
    .eq('message_id', messageId)
    .eq('client_id', clientId);
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
  await supabase
    .from('client_requests')
    .update({ status })
    .eq('id', id);
}

export async function deleteClientRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('client_requests')
    .delete()
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
  const now = new Date();
  const sunday = new Date(now);
  // From Friday the work week is over — manual schedule events belong to the
  // upcoming week (matches the docx rollover and KnessetUpdates week anchoring)
  sunday.setDate(now.getDate() - now.getDay() + (now.getDay() >= 5 ? 7 : 0));
  // Local date parts — toISOString() is UTC and would shift the week key
  // back a day when called between midnight and ~03:00 Israel time
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
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

export async function updateManualScheduleEvent(
  id: string,
  fields: Partial<Pick<ManualScheduleEvent, 'title' | 'summary' | 'detail' | 'source'>>
): Promise<void> {
  const { error } = await supabase.from('manual_schedule_events').update(fields).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getManualScheduleEvents(): Promise<ManualScheduleEvent[]> {
  const { data, error } = await supabase
    .from('manual_schedule_events')
    .select('*')
    .eq('week_id', getCurrentWeekId());
  if (error) return [];
  return (data ?? []) as ManualScheduleEvent[];
}

export async function clearOldManualEvents(): Promise<void> {
  const { error } = await supabase
    .from('manual_schedule_events')
    .delete()
    .neq('week_id', getCurrentWeekId());
  if (error) throw new Error(error.message);
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
  if (error) return [];
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
  const { data } = await supabase.from('knesset_sessions').select('*');
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
  if (error) return [];
  return (data ?? []) as ScheduleCancellation[];
}
