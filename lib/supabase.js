import { createClient } from '@supabase/supabase-js'

// Read Supabase credentials from environment variables. This keeps secrets
// out of source control. Defaults are provided for convenience if env vars
// are not set locally.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wikmzracopmsxrffbwsp.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_JKYn--y9sFzZPUqp0b-yNQ_bGqFsCzn'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Note: For server-side admin operations use a service role key stored in
// SUPABASE_SERVICE_ROLE_KEY and create a separate admin client when needed.