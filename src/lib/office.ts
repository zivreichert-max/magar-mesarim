import { supabase } from './supabase';

// ─── office (לשכה) protected data ────────────────────────────────────────────
// The legislation tracker, the exposures, the position-paper links and the
// budget analysis live in tables the public key cannot read. All access goes
// through Postgres functions that check the SIGNED-IN user and their role
// (office_users: 'admin' or 'office'). Nothing sensitive is in this repo — it
// is public. (The shared password and the MK personal codes that used to open
// these functions were switched off on 24.11.2026.)

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
  role: 'admin' | 'office';
  v: number;            // 2 once supabase-office-v2.sql has been run, 4 with accounts
  updated: string | null;
  items: OfficeItem[];
  mks?: OfficeMk[];     // the MK directory
  name?: string;        // office: the MK the office belongs to
  party?: string;
}

export type OfficeResult =
  | { status: 'ok'; data: OfficeData }
  | { status: 'badkey' }
  | { status: 'setup' }   // the one-time SQL setup has not been run yet
  | { status: 'error'; message: string };

/** Resolves within 15s no matter what — a stuck request becomes an error
 *  the UI can show (with a retry), never an endless spinner. */
export function getOfficeData(): Promise<OfficeResult> {
  const timeout = new Promise<OfficeResult>(resolve =>
    setTimeout(() => resolve({ status: 'error', message: 'הטעינה נמשכה יותר מדי זמן' }), 15_000)
  );
  const run = fetchOfficeData().catch(
    (e: unknown): OfficeResult => ({ status: 'error', message: e instanceof Error ? e.message : 'שגיאת רשת' })
  );
  return Promise.race([run, timeout]);
}

async function fetchOfficeData(): Promise<OfficeResult> {
  const { data, error } = await supabase.rpc('office_get');
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

const rpcOk = (r: { data: unknown; error: unknown }) => !r.error && !!(r.data as { ok?: boolean } | null)?.ok;

/** Expose (on) or un-expose (off) a product to an MK. Admin only. */
export async function setOfficeAssignment(item: string, mk: string, on: boolean): Promise<boolean> {
  return rpcOk(await supabase.rpc('office_assign_set', { p_item: item, p_mk: mk, p_on: on }));
}

/** Position-paper links of the weekly schedule: row key → url. Admin only.
 *  null = not available to this user. */
export async function getOfficePapers(): Promise<Record<string, string> | null> {
  const { data, error } = await supabase.rpc('office_papers_get');
  const d = data as { ok?: boolean; papers?: Record<string, string> } | null;
  if (error || !d?.ok) return null;
  return d.papers ?? {};
}

/** Save a position-paper link for a schedule row; an empty url removes it. */
export async function setOfficePaper(rowKey: string, url: string): Promise<boolean> {
  return rpcOk(await supabase.rpc('office_paper_set', { p_row: rowKey, p_url: url }));
}

// ─── budget requests with analysis (פניות תקציב) ──────────────────────────────
// One row per request on the Finance Committee's table: `auto` is the automatic
// analysis (written by sync-budget.mjs on the admin's PC), `edits` is the
// admin's own text per field and always wins. Admins only — the analysis holds
// recommendations to the committee chair.

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

export async function getOfficeBudget(): Promise<BudgetAnalysisResult> {
  try {
    const { data, error } = await supabase.rpc('office_budget_get');
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
  reqKey: string, meta: BudgetRequestMeta, field: string, value: string | null,
): Promise<boolean> {
  return rpcOk(await supabase.rpc('office_budget_set', { p_req: reqKey, p_meta: meta, p_field: field, p_value: value }));
}

// ─── accounts (Supabase Auth + office_users) ──────────────────────────────────
// Sign-in is email + password. There is no self sign-up and no mail service:
// an admin creates the account in "ניהול משתמשים" and passes on a one-time
// link, with which the user sets (or resets) their own password.

export interface OfficeUser {
  role: 'admin' | 'office';
  name: string;
  email: string;
  mk: string | null;      // office: the MK the office belongs to
  party: string | null;
}

/** The signed-in user's record, or null when nobody is signed in / the
 *  account is not (or no longer) registered in the office. */
export async function getOfficeMe(): Promise<OfficeUser | null> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  const { data, error } = await supabase.rpc('office_me');
  const d = data as ({ ok?: boolean } & Partial<OfficeUser>) | null;
  if (error || !d?.ok) return null;
  return {
    role: d.role === 'admin' ? 'admin' : 'office',
    name: d.name ?? '', email: d.email ?? '', mk: d.mk ?? null, party: d.party ?? null,
  };
}

export async function officeSignIn(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return !error;
}

export async function officeSignOut(): Promise<void> {
  await supabase.auth.signOut().catch(() => {});
}

export type LinkKind = 'invite' | 'reset';

/** Step 1 of a one-time link: exchange its token for a session. */
export async function officeOpenLink(kind: LinkKind, token: string): Promise<boolean> {
  const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: kind === 'invite' ? 'invite' : 'recovery' });
  return !error;
}

/** Step 2: the signed-in user sets their password. Returns an error text or null. */
export async function officeSetPassword(password: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return null;
  if (/different from the old/i.test(error.message)) return 'הסיסמה החדשה זהה לקודמת. בחרו סיסמה אחרת.';
  if (/weak|at least|characters/i.test(error.message)) return 'הסיסמה חלשה מדי. בחרו סיסמה ארוכה יותר.';
  return 'קביעת הסיסמה נכשלה. נסו שוב.';
}

export interface OfficeUserRow {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'office';
  mk: string | null;
  party: string | null;
  created_at: string;
  active: boolean;            // false = the link was not used yet
  last_sign_in: string | null;
}

/** Admin: everyone who may enter. null = not allowed / not available. */
export async function listOfficeUsers(): Promise<{ me: string; users: OfficeUserRow[] } | null> {
  const { data, error } = await supabase.rpc('office_users_list');
  const d = data as { ok?: boolean; me?: string; users?: OfficeUserRow[] } | null;
  if (error || !d?.ok) return null;
  return { me: d.me ?? '', users: d.users ?? [] };
}

export type ManageUsersRequest =
  | { action: 'invite'; role: 'admin'; email: string; name: string }
  | { action: 'invite'; role: 'office'; email: string; name: string; mk: string }
  | { action: 'link'; id: string }
  | { action: 'remove'; id: string };

/** Admin: create a user / a fresh one-time link / remove a user. These need
 *  the service key, so they go through the server route, which checks that
 *  the caller is a signed-in admin. */
export async function manageOfficeUsers(
  req: ManageUsersRequest,
): Promise<{ ok: true; link?: string } | { ok: false; error: string }> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return { ok: false, error: 'נדרשת כניסה מחדש' };
    const res = await fetch('/api/office-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(req),
    });
    const j = await res.json().catch(() => null) as { ok?: boolean; link?: string; error?: string } | null;
    if (!res.ok || !j?.ok) return { ok: false, error: j?.error || 'הפעולה נכשלה' };
    return { ok: true, link: j.link };
  } catch {
    return { ok: false, error: 'שגיאת רשת' };
  }
}

// ─── entry log (יומן כניסות) ─────────────────────────────────────────────────
// Who entered, when and for how long. Written by a heartbeat while the office
// is open on a personal account; read by admins only. The database takes the
// user from the signed-in account — the browser sends nothing but a visit id.

/** One sign of life. Returns the id of the visit it belongs to (a new one
 *  after a gap), or null when the log is not available. Never throws. */
export async function officeVisit(id: string | null): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('office_visit', { p_id: id });
    const d = data as { ok?: boolean; id?: string } | null;
    return error || !d?.ok ? null : d.id ?? null;
  } catch {
    return null;
  }
}

export interface OfficeVisitRow {
  id: string;
  start: string;
  last: string;           // the last sign of life — the visit's end, approximately
  name: string;
  email: string;
  role: 'admin' | 'office';
  mk: string | null;
  party: string | null;
}

export type OfficeVisitsResult =
  | { status: 'ok'; rows: OfficeVisitRow[]; since: string | null; keepDays: number }
  | { status: 'setup' }     // supabase-office-v5.sql has not been run yet
  | { status: 'denied' }
  | { status: 'error' };

/** Admin: the visits that started between two dates (YYYY-MM-DD, Israel time). */
export async function getOfficeVisits(from: string, to: string): Promise<OfficeVisitsResult> {
  try {
    const { data, error } = await supabase.rpc('office_visits_get', { p_from: from, p_to: to });
    if (error) return error.code === 'PGRST202' || /office_visits_get/.test(error.message) ? { status: 'setup' } : { status: 'error' };
    const d = data as { ok?: boolean; rows?: OfficeVisitRow[]; since?: string | null; keep_days?: string | null } | null;
    if (!d?.ok) return { status: 'denied' };
    return { status: 'ok', rows: d.rows ?? [], since: d.since ?? null, keepDays: Number(d.keep_days) || 365 };
  } catch {
    return { status: 'error' };
  }
}

/** fetch() to one of the site's own server routes, carrying the signed-in
 *  user's access token so the route can tell who is asking. */
export async function officeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await officeToken();
  if (!token) return fetch(url, init);
  return fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } });
}

/** A signed-in user's access token for the site's own server routes. */
export async function officeToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
