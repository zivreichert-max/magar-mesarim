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
