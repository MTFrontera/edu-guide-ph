import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jzauofptejizjjnckgql.supabase.co'
const supabaseAnonKey = 'sb_publishable_fuP-SFBEKn-NmXh6hfAC7g_AoVXmavc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types (move these to a .d.ts or .ts file if needed)