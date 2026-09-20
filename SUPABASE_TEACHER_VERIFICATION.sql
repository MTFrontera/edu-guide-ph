-- EduGuide PH - school-aware signup + teacher verification
-- This migration assumes the dashboard/RBAC schema already exists.
-- The live EduGuide PH Supabase project has already received this upgrade.

begin;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

insert into public.schools (name, short_name, active)
values ('Amigo School of Calinan, Inc.', 'ASCI', true)
on conflict (name) do update
set short_name = excluded.short_name,
    active = true;

alter table public.profiles
  add column if not exists account_type text not null default 'student',
  add column if not exists school_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_type_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_type_check
      check (account_type in ('student', 'teacher'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_school_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_school_id_fkey
      foreign key (school_id) references public.schools(id)
      on delete set null;
  end if;
end
$$;

create index if not exists profiles_account_type_idx on public.profiles(account_type);
create index if not exists profiles_school_id_idx on public.profiles(school_id);

create table if not exists public.teacher_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  employee_id text not null,
  document_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  submitted_at timestamptz not null default timezone('utc'::text, now()),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint teacher_verification_employee_id_check
    check (char_length(trim(employee_id)) between 2 and 100)
);

create index if not exists teacher_verification_status_idx
  on public.teacher_verification_requests(status, submitted_at desc);
create index if not exists teacher_verification_school_id_idx
  on public.teacher_verification_requests(school_id);
create index if not exists teacher_verification_reviewed_by_idx
  on public.teacher_verification_requests(reviewed_by);

alter table public.schools enable row level security;
alter table public.teacher_verification_requests enable row level security;

revoke all on table public.schools from anon, authenticated;
grant select on table public.schools to anon, authenticated;

revoke all on table public.teacher_verification_requests from anon, authenticated;
grant select on table public.teacher_verification_requests to authenticated;

drop policy if exists "Anyone can view active schools" on public.schools;
create policy "Anyone can view active schools"
on public.schools
for select
to anon, authenticated
using (active = true);

create or replace function public.eduguide_is_current_user_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $
  select coalesce(
    (
      select p.role = 'admin'
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$;

grant execute on function public.eduguide_is_current_user_admin() to authenticated;

drop policy if exists "Users can view own teacher verification" on public.teacher_verification_requests;
create policy "Users can view own teacher verification"
on public.teacher_verification_requests
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.eduguide_is_current_user_admin()
);

-- Signup metadata may request a teacher account, but can never self-assign
-- the protected teacher role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_type text;
  selected_school uuid;
begin
  requested_type :=
    case
      when new.raw_user_meta_data ->> 'account_type' = 'teacher' then 'teacher'
      else 'student'
    end;

  select s.id
  into selected_school
  from public.schools s
  where s.active = true
    and s.id::text = nullif(new.raw_user_meta_data ->> 'school_id', '')
  limit 1;

  insert into public.profiles (
    id, email, first_name, last_name, age, gender, grade_year,
    role, account_type, school_id
  )
  values (
    new.id,
    coalesce(new.email, new.id::text || '@local.invalid'),
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    case
      when (new.raw_user_meta_data ->> 'age') ~ '^[0-9]+$'
        then (new.raw_user_meta_data ->> 'age')::integer
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'gender', ''),
    case
      when requested_type = 'student'
        then nullif(new.raw_user_meta_data ->> 'grade_year', '')
      else null
    end,
    'student',
    requested_type,
    selected_school
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    age = coalesce(public.profiles.age, excluded.age),
    gender = coalesce(public.profiles.gender, excluded.gender),
    grade_year = coalesce(public.profiles.grade_year, excluded.grade_year),
    account_type = excluded.account_type,
    school_id = coalesce(excluded.school_id, public.profiles.school_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke update on table public.profiles from authenticated;
grant update (email, first_name, last_name, age, gender, grade_year, school_id)
  on table public.profiles to authenticated;

create or replace function public.submit_teacher_verification(
  p_school_id uuid,
  p_employee_id text,
  p_document_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  request_id uuid;
  current_role text;
begin
  if requester is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role
  into current_role
  from public.profiles p
  where p.id = requester
    and p.account_type = 'teacher';

  if current_role is null then
    raise exception 'This account is not registered as a teacher'
      using errcode = '42501';
  end if;

  if current_role = 'teacher' then
    raise exception 'This teacher account is already approved'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.schools s
    where s.id = p_school_id and s.active = true
  ) then
    raise exception 'Selected school is not available'
      using errcode = '22023';
  end if;

  if char_length(trim(coalesce(p_employee_id, ''))) < 2 then
    raise exception 'Teacher or employee ID is required'
      using errcode = '22023';
  end if;

  if p_document_path is null
     or p_document_path not like requester::text || '/%' then
    raise exception 'Verification document path is invalid'
      using errcode = '22023';
  end if;

  update public.profiles
  set school_id = p_school_id
  where id = requester;

  insert into public.teacher_verification_requests (
    user_id, school_id, employee_id, document_path, status,
    admin_notes, submitted_at, reviewed_at, reviewed_by, updated_at
  )
  values (
    requester, p_school_id, trim(p_employee_id), p_document_path, 'pending',
    null, timezone('utc'::text, now()), null, null, timezone('utc'::text, now())
  )
  on conflict (user_id) do update
  set
    school_id = excluded.school_id,
    employee_id = excluded.employee_id,
    document_path = excluded.document_path,
    status = 'pending',
    admin_notes = null,
    submitted_at = timezone('utc'::text, now()),
    reviewed_at = null,
    reviewed_by = null,
    updated_at = timezone('utc'::text, now())
  returning id into request_id;

  return request_id;
end;
$$;

revoke execute on function public.submit_teacher_verification(uuid, text, text)
  from public, anon;
grant execute on function public.submit_teacher_verification(uuid, text, text)
  to authenticated;

create or replace function public.admin_teacher_verification_queue()
returns table (
  request_id uuid,
  user_id uuid,
  teacher_name text,
  email text,
  school_name text,
  employee_id text,
  document_path text,
  status text,
  admin_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eduguide_is_current_user_admin() then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.user_id,
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
    p.email,
    s.name,
    r.employee_id,
    r.document_path,
    r.status,
    r.admin_notes,
    r.submitted_at,
    r.reviewed_at
  from public.teacher_verification_requests r
  join public.profiles p on p.id = r.user_id
  join public.schools s on s.id = r.school_id
  order by
    case r.status when 'pending' then 0 when 'rejected' then 1 else 2 end,
    r.submitted_at desc
  limit 50;
end;
$$;

revoke execute on function public.admin_teacher_verification_queue()
  from public, anon;
grant execute on function public.admin_teacher_verification_queue()
  to authenticated;

create or replace function public.admin_review_teacher_verification(
  p_request_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.teacher_verification_requests%rowtype;
begin
  if not public.eduguide_is_current_user_admin() then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected'
      using errcode = '22023';
  end if;

  select *
  into req
  from public.teacher_verification_requests
  where id = p_request_id
  for update;

  if req.id is null then
    raise exception 'Verification request not found'
      using errcode = 'P0002';
  end if;

  update public.teacher_verification_requests
  set
    status = p_decision,
    admin_notes = nullif(trim(coalesce(p_notes, '')), ''),
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = auth.uid(),
    updated_at = timezone('utc'::text, now())
  where id = p_request_id;

  if p_decision = 'approved' then
    update public.profiles
    set role = 'teacher',
        account_type = 'teacher',
        school_id = req.school_id
    where id = req.user_id;
  else
    update public.profiles
    set role = 'student'
    where id = req.user_id
      and role = 'teacher';
  end if;

  return jsonb_build_object(
    'requestId', p_request_id,
    'userId', req.user_id,
    'status', p_decision
  );
end;
$$;

revoke execute on function public.admin_review_teacher_verification(uuid, text, text)
  from public, anon;
grant execute on function public.admin_review_teacher_verification(uuid, text, text)
  to authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'teacher-verifications',
  'teacher-verifications',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Teachers can upload own verification files" on storage.objects;
create policy "Teachers can upload own verification files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'teacher-verifications'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'teacher'
      and p.role <> 'teacher'
  )
);

drop policy if exists "Verification files visible to owner or admin" on storage.objects;
create policy "Verification files visible to owner or admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'teacher-verifications'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.eduguide_is_current_user_admin()
  )
);

commit;
