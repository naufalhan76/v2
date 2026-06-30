import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const lines = readFileSync('.env.test.local', 'utf-8').split('\n');
const env = Object.fromEntries(
  lines
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim().replace(/^[\"']|[\"']$/g, '')];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function cleanup() {
  const { data, error } = await sb.from('customers').select('customer_id, phone_number').ilike('phone_number', '+62811%');
  console.log('found:', data?.length, 'err:', error?.message);

  for (const r of (data ?? [])) {
    const { data: locs } = await sb.from('locations').select('location_id').eq('customer_id', r.customer_id);
    const locIds = locs?.map(l => l.location_id) ?? [];

    if (locIds.length > 0) {
      await sb.from('ac_units').delete().in('location_id', locIds);
    }

    await sb.from('locations').delete().eq('customer_id', r.customer_id);
    const { error: e3 } = await sb.from('customers').delete().eq('customer_id', r.customer_id);

    if (e3) console.log('del err:', r.customer_id, e3.message);
  }
  console.log('done');
}

cleanup();
