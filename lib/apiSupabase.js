import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jzauofptejizjjnckgql.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fuP-SFBEKn-NmXh6hfAC7g_AoVXmavc';

// Create a client for server-side API routes that respects RLS policies
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

// Create a client with auth token for RLS-protected operations
export function createSupabaseClientWithAuth(authToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    },
    auth: {
      persistSession: false
    }
  });
}
