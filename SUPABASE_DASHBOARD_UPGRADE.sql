-- EduGuide PH - dashboard + role-based access upgrade
-- Apply this only to an existing EduGuide database that already has:
-- public.profiles, public.chat_sessions, and public.chat_messages.
--
-- Staff roles are NOT self-assignable. New users always default to "student".
-- Dashboard RPCs expose aggregate counts and limited activity metadata only;
-- they do not return chat message contents.

begin;

alter table public.profiles
  add column if not exists role text not null default 'student';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('student', 'teacher', 'guidance', 'admin'));
  end if;
end
$$;

create index if not exists profiles_role_idx
  on public.profiles(role);

create index if not exists chat_sessions_user_updated_idx
  on public.chat_sessions(user_id, updated_at desc);

create index if not exists chat_messages_user_created_idx
  on public.chat_messages(user_id, created_at desc);

create index if not exists chat_messages_session_created_idx
  on public.chat_messages(session_id, created_at);

-- Keep signup metadata in the public profile, but never accept a role from
-- user-controlled signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    age,
    gender,
    grade_year,
    role
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
    nullif(new.raw_user_meta_data ->> 'grade_year', ''),
    'student'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    age = coalesce(public.profiles.age, excluded.age),
    gender = coalesce(public.profiles.gender, excluded.gender),
    grade_year = coalesce(public.profiles.grade_year, excluded.grade_year);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Prevent ordinary users from promoting themselves by removing table-level
-- UPDATE and granting only editable profile fields.
revoke update on table public.profiles from authenticated;
grant update (email, first_name, last_name, age, gender, grade_year)
  on table public.profiles to authenticated;

create or replace function public.eduguide_is_staff(
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role in ('teacher', 'guidance', 'admin')
      from public.profiles p
      where p.id = check_user_id
    ),
    false
  );
$$;

revoke execute on function public.eduguide_is_staff(uuid)
  from public, anon, authenticated;

create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.eduguide_is_staff(auth.uid()) then
    raise exception 'Not authorized to view the staff dashboard'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totalStudents', (
      select count(*)
      from public.profiles p
      where p.role = 'student'
    ),
    'totalSessions', (
      select count(*) from public.chat_sessions
    ),
    'totalMessages', (
      select count(*) from public.chat_messages
    ),
    'activeStudents7d', (
      select count(distinct cs.user_id)
      from public.chat_sessions cs
      join public.profiles p on p.id = cs.user_id
      where p.role = 'student'
        and cs.updated_at >= now() - interval '7 days'
    )
  )
  into result;

  return result;
end;
$$;

create or replace function public.dashboard_recent_activity(
  p_limit integer default 12
)
returns table (
  user_id uuid,
  student_name text,
  grade_year text,
  session_count bigint,
  message_count bigint,
  last_active timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eduguide_is_staff(auth.uid()) then
    raise exception 'Not authorized to view the staff dashboard'
      using errcode = '42501';
  end if;

  return query
  with session_stats as (
    select
      cs.user_id as uid,
      count(*)::bigint as sessions,
      max(cs.updated_at) as last_session_activity
    from public.chat_sessions cs
    group by cs.user_id
  ),
  message_stats as (
    select
      cm.user_id as uid,
      count(*)::bigint as messages,
      max(cm.created_at) as last_message_activity
    from public.chat_messages cm
    group by cm.user_id
  )
  select
    p.id,
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') as student_name,
    p.grade_year,
    coalesce(ss.sessions, 0)::bigint,
    coalesce(ms.messages, 0)::bigint,
    greatest(ss.last_session_activity, ms.last_message_activity) as last_active
  from public.profiles p
  left join session_stats ss on ss.uid = p.id
  left join message_stats ms on ms.uid = p.id
  where p.role = 'student'
  order by
    greatest(ss.last_session_activity, ms.last_message_activity) desc nulls last,
    p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
end;
$$;

create or replace function public.dashboard_usage_last_7_days()
returns table (
  activity_day date,
  message_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eduguide_is_staff(auth.uid()) then
    raise exception 'Not authorized to view the staff dashboard'
      using errcode = '42501';
  end if;

  return query
  with days as (
    select generate_series(
      current_date - interval '6 days',
      current_date,
      interval '1 day'
    )::date as day
  )
  select
    d.day,
    count(cm.id)::bigint
  from days d
  left join public.chat_messages cm
    on cm.created_at >= d.day::timestamptz
   and cm.created_at < (d.day + 1)::timestamptz
  group by d.day
  order by d.day;
end;
$$;

revoke execute on function public.dashboard_summary() from public, anon;
revoke execute on function public.dashboard_recent_activity(integer) from public, anon;
revoke execute on function public.dashboard_usage_last_7_days() from public, anon;

grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.dashboard_recent_activity(integer) to authenticated;
grant execute on function public.dashboard_usage_last_7_days() to authenticated;

commit;

-- Promote staff only through a trusted database/admin operation, for example:
--
-- update public.profiles
-- set role = 'admin'
-- where email = 'staff@example.com';
--
-- Allowed roles: student, teacher, guidance, admin.
