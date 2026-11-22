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

// ─── office weekly schedule: manual events for ANY week ──────────────────────
// The לשכה tab lets the admin add events the official feeds don't carry
// (cabinet meetings, reported plenum votes). Same table as the old weekly
// לו"ז manual events, but addressed by an explicit week id (Sunday ISO date)
// so the "next week" view can hold its own rows.

export async function getManualEventsForWeek(weekId: string): Promise<ManualScheduleEvent[]> {
  const { data, error } = await supabase
    .from('manual_schedule_events')
    .select('*')
    .eq('week_id', weekId);
  if (error) {
    console.error('getManualEventsForWeek failed:', error.message);
    return [];
  }
  return (data ?? []) as ManualScheduleEvent[];
}

export async function addManualEventForWeek(
  weekId: string,
  ev: Omit<ManualScheduleEvent, 'id' | 'week_id'>
): Promise<ManualScheduleEvent> {
  const { data, error } = await supabase
    .from('manual_schedule_events')
    .insert({ ...ev, week_id: weekId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ManualScheduleEvent;
}

export async function deleteManualEvent(id: string): Promise<void> {
  const { error } = await supabase.from('manual_schedule_events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── office (לשכה) protected data ────────────────────────────────────────────
// The legislation tracker lives in tables the anon key cannot read. All access
// goes through the office_get() Postgres function, which checks an access key
// (admin key or an MK's personal code) against hashes stored in the DB.
// Nothing sensitive is in this repo — it is public.

export interface OfficeItem {
  id: number;
  name: string;
  essence: string;
  chapter: string;
  kind: string;
  ready: string;
  undo: boolean;
  link: string;
  // admin-only fields
  assigned?: { name: string; party: string }[]; // v2: edited on the site
  mk_yashar?: string;                            // v1 (Excel columns) — legacy fallback
  mk_beyahad?: string;
  mk_democrats?: string;
  mk_beitenu?: string;
  missing?: string;
  notes?: string;
}

export interface OfficeMk {
  name: string;
  party: string;
  bloc?: string;
}

export interface OfficeData {
  role: 'admin' | 'mk';
  v: number;            // 2 once supabase-office-v2.sql has been run
  updated: string | null;
  items: OfficeItem[];
  mks?: OfficeMk[];     // admin
  name?: string;                             // mk
  party?: string;                            // mk
}

export type OfficeResult =
  | { status: 'ok'; data: OfficeData }
  | { status: 'badkey' }
  | { status: 'setup' }   // the one-time SQL setup has not been run yet
  | { status: 'error'; message: string };

/** Resolves within 15s no matter what — a stuck request becomes an error
 *  the UI can show (with a retry), never an endless spinner. */
export function getOfficeData(key: string): Promise<OfficeResult> {
  const timeout = new Promise<OfficeResult>(resolve =>
    setTimeout(() => resolve({ status: 'error', message: 'הטעינה נמשכה יותר מדי זמן' }), 15_000)
  );
  const run = fetchOfficeData(key).catch(
    (e: unknown): OfficeResult => ({ status: 'error', message: e instanceof Error ? e.message : 'שגיאת רשת' })
  );
  return Promise.race([run, timeout]);
}

async function fetchOfficeData(key: string): Promise<OfficeResult> {
  const { data, error } = await supabase.rpc('office_get', { p_key: key });
  if (error) {
    // PGRST202 = function not found in the schema cache → setup not run
    if (error.code === 'PGRST202' || /office_get/.test(error.message)) return { status: 'setup' };
    return { status: 'error', message: error.message };
  }
  const d = data as ({ ok: boolean } & Partial<OfficeData>) | null;
  if (!d || !d.ok) return { status: 'badkey' };
  return {
    status: 'ok',
    data: {
      role: d.role as OfficeData['role'], v: d.v ?? 1, updated: d.updated ?? null, items: d.items ?? [],
      mks: d.mks, name: d.name, party: d.party,
    },
  };
}

/** Attach (on) or detach (off) an MK to a product. Admin only. */
export async function setOfficeAssignment(key: string, item: string, mk: string, on: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('office_assign_set', { p_key: key, p_item: item, p_mk: mk, p_on: on });
  return !error && !!(data as { ok?: boolean } | null)?.ok;
}

/** Position-paper links of the weekly schedule: row key → url.
 *  null = the feature is not available (v2 setup not run, or no access). */
export async function getOfficePapers(key: string): Promise<Record<string, string> | null> {
  const { data, error } = await supabase.rpc('office_papers_get', { p_key: key });
  const d = data as { ok?: boolean; papers?: Record<string, string> } | null;
  if (error || !d?.ok) return null;
  return d.papers ?? {};
}

/** Save a position-paper link for a schedule row; an empty url removes it. */
export async function setOfficePaper(key: string, rowKey: string, url: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('office_paper_set', { p_key: key, p_row: rowKey, p_url: url });
  return !error && !!(data as { ok?: boolean } | null)?.ok;
}

// ─── office: budget requests with analysis (פניות תקציב) ──────────────────────
// One row per request on the Finance Committee's table: `auto` is the automatic
// analysis (written by sync-budget.mjs on the admin's PC), `edits` is the
// admin's own text per field and always wins. Protected like the tracker —
// the analysis holds recommendations to the committee chair.

export interface BudgetAnalysis {
  key: string;
  number: string;
  codes: string;
  ministry: string;
  pdf_url: string;
  pending: boolean;
  status: 'new' | 'queued' | 'done' | 'error';
  error: string | null;
  auto: Record<string, string>;
  edits: Record<string, string>;
  rec_ok: boolean;            // the admin approved the recommendation
  analyzed_at: string | null;
  analyzed_pdf: string | null;
  model: string | null;
  pages: number | null;
}

export type BudgetAnalysisResult =
  | { status: 'ok'; rows: BudgetAnalysis[]; run: string | null }
  | { status: 'setup' }     // supabase-office-v3.sql has not been run yet
  | { status: 'badkey' }
  | { status: 'error'; message: string };

export async function getOfficeBudget(key: string): Promise<BudgetAnalysisResult> {
  try {
    const { data, error } = await supabase.rpc('office_budget_get', { p_key: key });
    if (error) {
      if (error.code === 'PGRST202' || /office_budget_get/.test(error.message)) return { status: 'setup' };
      return { status: 'error', message: error.message };
    }
    const d = data as { ok?: boolean; rows?: BudgetAnalysis[]; run?: string | null } | null;
    if (!d?.ok) return { status: 'badkey' };
    return {
      status: 'ok',
      run: d.run ?? null,
      rows: (d.rows ?? []).map(r => ({ ...r, auto: r.auto ?? {}, edits: r.edits ?? {} })),
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'שגיאת רשת' };
  }
}

export interface BudgetRequestMeta {
  number: string;
  codes: string;
  ministry: string;
  pdf_url: string;
}

/** One admin write. field '_queue' asks for a (new) analysis, '_rec_ok' takes
 *  'true' / 'false'; any other field stores the admin's text, null = back to
 *  the automatic text. */
export async function setOfficeBudget(
  key: string, reqKey: string, meta: BudgetRequestMeta, field: string, value: string | null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('office_budget_set', {
    p_key: key, p_req: reqKey, p_meta: meta, p_field: field, p_value: value,
  });
  return !error && !!(data as { ok?: boolean } | null)?.ok;
}
