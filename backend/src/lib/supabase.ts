import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
}

// Service-role client — bypasses RLS. Never expose this key to the client.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  // Provide a Node.js WebSocket implementation for Supabase Realtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realtime: { transport: WebSocket as any },
});
