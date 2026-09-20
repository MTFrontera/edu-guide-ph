# EduGuide PH Supabase Setup

EduGuide PH now uses a dedicated Supabase project.

## Current project

- Project name: `EduGuide PH`
- Project ref: `ucbvsvpzvdsyhorriefc`
- Project URL: `https://ucbvsvpzvdsyhorriefc.supabase.co`

The database already contains:

- `profiles`
- `chat_sessions`
- `chat_messages`
- Row Level Security policies
- automatic profile creation for new Auth users
- roles: `student`, `teacher`, `guidance`, `admin`
- staff dashboard RPCs
- indexes for chat/dashboard activity

New accounts default to the `student` role. Staff roles must be assigned through a trusted database/admin operation and are not accepted from signup metadata.

## Required environment variables

EduGuide no longer has hard-coded fallback Supabase projects. Configure these variables in local development and Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ucbvsvpzvdsyhorriefc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<EduGuide PH publishable key>
```

Use the publishable/anon key from the **EduGuide PH** Supabase project's API settings. Do not use a service-role/secret key in a `NEXT_PUBLIC_` variable.

For local development, put the variables in `.env.local`.

For Vercel, update the project's Environment Variables and redeploy so the deployment receives the new values.

## Database scripts

- `SUPABASE_DASHBOARD_UPGRADE.sql` upgrades an older EduGuide database with staff roles and dashboard support.
- `supabase-schema.sql` is the older baseline schema and should not be used by itself for the new EduGuide PH project.

The active **EduGuide PH** database has already been provisioned directly in Supabase, so you do not need to rerun the old setup instructions.

## Creating accounts

Users should register through EduGuide's normal registration page. The Supabase Auth signup trigger automatically creates the matching `profiles` row and copies supported signup metadata.

After a staff user has registered, promote that profile through a trusted database/admin action, for example:

```sql
update public.profiles
set role = 'admin'
where email = 'staff@example.com';
```

Allowed staff roles are `teacher`, `guidance`, and `admin`.
