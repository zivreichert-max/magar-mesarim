import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { officeCaller, serviceClient } from '@/lib/officeServer';

// User management of הלשכה: create an account, make a fresh one-time link,
// remove an account. These need the Supabase service key, which exists only as
// a server environment variable (SUPABASE_SERVICE_ROLE_KEY) — never in the
// repo or in the browser.
//
// Who may call:
//   · a signed-in ADMIN (access token in the Authorization header), or
//   · the machine key from the admin's own PC — only for `admin-link`: a fresh
//     link for an existing admin, or the creation of the first admin whose
//     address was registered in the database (office_meta.first_admin).
//
// There is no mail service: the link is returned to the caller, who passes it
// on. To add automatic email later, send `link` from `issueLink` to a mail API.

export const dynamic = 'force-dynamic';

const EXPOSE_BLOCS = ['גוש השינוי', 'המפלגות הערביות'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

type AuthUser = { id: string; email?: string; email_confirmed_at?: string | null; created_at?: string };

/** A one-time link to the site's own set-password screen. The token sits in
 *  the URL fragment, so it is never sent to a server or written to a log, and
 *  a link preview (WhatsApp, mail scanners) cannot use it up: it is spent only
 *  when the user submits a new password. */
async function issueLink(
  db: SupabaseClient, origin: string, email: string, kind: 'invite' | 'recovery',
): Promise<{ link: string; user: AuthUser } | { error: string }> {
  const { data, error } = await db.auth.admin.generateLink({ type: kind, email });
  const token = data?.properties?.hashed_token;
  if (error || !token || !data.user) return { error: error?.message ?? 'no link' };
  return { link: `${origin}/#${kind === 'invite' ? 'invite' : 'reset'}=${token}`, user: data.user as AuthUser };
}

/** The link for a NEW office account. An account with the same address may
 *  already exist in Supabase Auth from the days when self sign-up was open —
 *  whatever password it carries must not survive, or whoever registered it
 *  could enter once the address is granted access. */
async function freshAccountLink(
  db: SupabaseClient, origin: string, email: string,
): Promise<{ link: string; user: AuthUser } | { error: string }> {
  let kind: 'invite' | 'recovery' = 'invite';
  let out = await issueLink(db, origin, email, 'invite');
  if ('error' in out) {
    if (!/already|registered|exists/i.test(out.error)) return out;
    kind = 'recovery';                      // a confirmed account with this address exists
    out = await issueLink(db, origin, email, 'recovery');
    if ('error' in out) return out;
  }
  const age = Date.now() - Date.parse(out.user.created_at ?? '');
  if (kind === 'recovery' || !(age < 60_000)) {
    const { error } = await db.auth.admin.updateUserById(out.user.id, { password: randomBytes(32).toString('base64url') });
    if (error) return { error: error.message };
    out = await issueLink(db, origin, email, kind);   // a password change voids earlier links
  }
  return out;
}

async function findAuthUser(db: SupabaseClient, id: string): Promise<AuthUser | null> {
  const { data, error } = await db.auth.admin.getUserById(id);
  return error || !data.user ? null : (data.user as AuthUser);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail(400, 'בקשה לא תקינה'); }
  const action = String(body.action ?? '');
  const origin = new URL(req.url).origin;

  const db = serviceClient();

  // ── the machine key (the admin's PC): first admin / locked-out admin ──────
  if (action === 'admin-link') {
    if (!db) return fail(503, 'חסר מפתח שירות בשרת (SUPABASE_SERVICE_ROLE_KEY)');
    const secret = String(body.secret ?? '');
    if (secret.length < 20) return fail(401, 'אין הרשאה');
    const hash = createHash('sha256').update(secret, 'utf8').digest('hex');
    const { data: key } = await db.from('office_keys').select('role').eq('key_hash', hash).eq('role', 'sync').maybeSingle();
    if (!key) return fail(401, 'אין הרשאה');

    const email = String(body.email ?? '').trim().toLowerCase();
    const { data: existing } = await db.from('office_users').select('user_id, role').eq('email', email).maybeSingle();
    if (existing) {
      if (existing.role !== 'admin') return fail(403, 'הכתובת אינה של מנהל');
      const user = await findAuthUser(db, existing.user_id);
      if (!user) return fail(500, 'המשתמש לא נמצא');
      const out = await issueLink(db, origin, email, user.email_confirmed_at ? 'recovery' : 'invite');
      return 'error' in out ? fail(500, out.error) : NextResponse.json({ ok: true, link: out.link });
    }
    const { data: first } = await db.from('office_meta').select('mval').eq('mkey', 'first_admin').maybeSingle();
    if (!first?.mval || first.mval.trim().toLowerCase() !== email) return fail(403, 'הכתובת אינה רשומה כמנהל');
    const out = await freshAccountLink(db, origin, email);
    if ('error' in out) return fail(500, out.error);
    const { error: insErr } = await db.from('office_users').insert({
      user_id: out.user.id, email, role: 'admin', display_name: String(body.name ?? '').trim().slice(0, 80),
    });
    if (insErr) return fail(500, insErr.message);
    return NextResponse.json({ ok: true, link: out.link });
  }

  // ── everything else: a signed-in admin ────────────────────────────────────
  const caller = await officeCaller(req);
  if (!caller || caller.role !== 'admin') return fail(401, 'אין הרשאה');
  if (!db) return fail(503, 'חסר מפתח שירות בשרת (SUPABASE_SERVICE_ROLE_KEY)');
  const { data: me } = await db.auth.getUser(caller.token);
  const myId = me.user?.id ?? null;

  if (action === 'invite') {
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim().slice(0, 80);
    const role = body.role === 'admin' ? 'admin' : body.role === 'office' ? 'office' : null;
    if (!role) return fail(400, 'תפקיד לא תקין');
    if (!EMAIL_RE.test(email) || email.length > 200) return fail(400, 'כתובת המייל לא תקינה');
    if (!name) return fail(400, 'חסר שם');
    let mk: string | null = null;
    if (role === 'office') {
      mk = String(body.mk ?? '').trim();
      const { data: row } = await db.from('office_mks').select('name, bloc').eq('name', mk).maybeSingle();
      if (!row) return fail(400, 'הח"כ לא נמצא ברשימה');
      if (row.bloc && !EXPOSE_BLOCS.includes(row.bloc)) return fail(400, 'אפשר לפתוח לשכה רק לח"כים של גוש השינוי והמפלגות הערביות');
    }
    const { data: taken } = await db.from('office_users').select('user_id').eq('email', email).maybeSingle();
    if (taken) return fail(409, 'כבר קיים משתמש עם המייל הזה');

    const out = await freshAccountLink(db, origin, email);
    if ('error' in out) {
      return fail(500, `יצירת המשתמש נכשלה: ${out.error}`);
    }
    const { error: insErr } = await db.from('office_users').insert({
      user_id: out.user.id, email, role, mk_name: mk, display_name: name, created_by: myId,
    });
    if (insErr) {
      await db.auth.admin.deleteUser(out.user.id).catch(() => {});
      return fail(500, `שמירת המשתמש נכשלה: ${insErr.message}`);
    }
    return NextResponse.json({ ok: true, link: out.link });
  }

  if (action === 'link' || action === 'remove') {
    const id = String(body.id ?? '');
    const { data: target } = await db.from('office_users').select('user_id, email, role').eq('user_id', id).maybeSingle();
    if (!target) return fail(404, 'המשתמש לא נמצא');

    if (action === 'link') {
      const user = await findAuthUser(db, target.user_id);
      if (!user) return fail(500, 'המשתמש לא נמצא');
      const out = await issueLink(db, origin, target.email, user.email_confirmed_at ? 'recovery' : 'invite');
      return 'error' in out ? fail(500, `יצירת הקישור נכשלה: ${out.error}`) : NextResponse.json({ ok: true, link: out.link });
    }

    if (target.user_id === myId) return fail(400, 'אי אפשר להסיר את עצמך');
    // The role row goes first: access ends at once, even if the next step fails
    const { error: delErr } = await db.from('office_users').delete().eq('user_id', target.user_id);
    if (delErr) return fail(500, delErr.message);
    const { error: authErr } = await db.auth.admin.deleteUser(target.user_id);
    if (authErr) return fail(500, `הגישה בוטלה, אך מחיקת החשבון נכשלה: ${authErr.message}`);
    return NextResponse.json({ ok: true });
  }

  return fail(400, 'פעולה לא מוכרת');
}
