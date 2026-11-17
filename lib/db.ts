import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function db() {
  if (!client) {
    client = createClient((process.env.SUPABASE_URL || '').trim(), (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(), {
      auth: { persistSession: false },
    });
  }
  return client;
}

export async function kvGet(key: string) {
  const { data } = await db().from('kv').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}

export async function kvSet(key: string, value: string) {
  await db().from('kv').upsert({ key, value, updated_at: new Date().toISOString() });
}
