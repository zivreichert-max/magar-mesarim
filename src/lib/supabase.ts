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
