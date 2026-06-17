import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jzauofptejizjjnckgql.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fuP-SFBEKn-NmXh6hfAC7g_AoVXmavc';

export async function getAuthenticatedUser(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { user: null, error: 'Missing access token' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: 'Unauthorized' };
  }

  return { user: data.user, error: null };
}
