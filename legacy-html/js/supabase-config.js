// ============================================================
// NAGAR NIGAM — Supabase Configuration
// Project: crosstech-attendence
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://dgzfabwvyzmtygmfsbfx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nH9qXrhFmi0_1m_CY8cgnA_9EuVTpy4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper to make a temp client (used when creating staff accounts
// from admin without disturbing the admin's own session)
export function makeTempClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey: 'nn_temp_' + Date.now(), persistSession: false }
  });
}
