# Fix Server Configuration Error

## Issue
The app shows "Server configuration error" when loading sessions because `SUPABASE_SERVICE_ROLE_KEY` is not set.

## Root Cause
API routes in `app/api/chat/sessions/route.js` and `app/api/chat/messages/route.js` require `SUPABASE_SERVICE_ROLE_KEY` to be set.

## Solution
Modify API routes to use the anon key with RLS (Row Level Security) policies instead of service role key.

## Tasks
- [ ] 1. Create shared Supabase client utility for API routes
- [ ] 2. Update `app/api/chat/sessions/route.js` to use shared client
- [ ] 3. Update `app/api/chat/messages/route.js` to use shared client
- [ ] 4. Verify the fix works
