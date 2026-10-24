import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables! Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in .env');
}

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

export function makeTempClient() {
  return createClient(SUPABASE_URL || '', SUPABASE_KEY || '', {
    auth: { storageKey: 'nn_temp_' + Date.now(), persistSession: false },
  });
}
