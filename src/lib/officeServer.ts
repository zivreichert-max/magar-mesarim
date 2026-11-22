import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only helpers for the site's own API routes. Never import this from a
// client component: the service key must not reach the browser.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Transition: visitors who entered with the old shared password have no
 *  account. While this is true, routes that only serve public data let them
 *  through. Set to false (and delete) at the cut-over. */
export const LEGACY_OPEN = true;

export type OfficeRole = 'admin' | 'office';

/** Who is calling: the role of the signed-in office user whose access token
 *  came in the Authorization header, or null. The database decides — the
 *  token is verified there and looked up in office_users (office_me). */
export async function officeCaller(req: Request): Promise<{ role: OfficeRole; token: string } | null> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  const token = m?.[1]?.trim();
  if (!token || !SUPABASE_URL || !ANON_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/office_me`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const d = await res.json() as { ok?: boolean; role?: string } | null;
    if (!d?.ok || (d.role !== 'admin' && d.role !== 'office')) return null;
    return { role: d.role, token };
  } catch {
    return null;
  }
}

/** The service-role client (full access, bypasses row security). Only for the
 *  user-management route. null when the key was not configured on the server. */
export function serviceClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !SUPABASE_URL) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
