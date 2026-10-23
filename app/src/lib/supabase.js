import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dgzfabwvyzmtygmfsbfx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nH9qXrhFmi0_1m_CY8cgnA_9EuVTpy4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export function makeTempClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey: 'nn_temp_' + Date.now(), persistSession: false },
  });
}
