-- EduGuide PH - per-school admin email + school IDs
-- The live EduGuide PH Supabase project has already received this upgrade.

begin;

alter table public.schools
  add column if not exists admin_email text;

update public.schools
set admin_email = 'duckytorpedo@gmail.com'
where name = 'Amigo School of Calinan, Inc.';

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('student', 'teacher', 'admin', 'guidance'));

alter table public.profiles
  add column if not exists student_id text,
  add column if not exists employee_id text;

create unique index if not exists profiles_school_student_id_unique_idx
  on public.profiles(school_id, lower(student_id))
  where student_id is not null;

create unique index if not exists profiles_school_employee_id_unique_idx
  on public.profiles(school_id, lower(employee_id))
  where employee_id is not null;

alter table public.teacher_verification_requests
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_error text;

-- New account metadata copies the appropriate school ID into profiles.
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
    role, account_type, school_id, student_id, employee_id
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
    selected_school,
    case
      when requested_type = 'student'
        then nullif(trim(new.raw_user_meta_data ->> 'student_id'), '')
      else null
    end,
    case
      when requested_type = 'teacher'
        then nullif(trim(new.raw_user_meta_data ->> 'employee_id'), '')
      else null
    end
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
    school_id = coalesce(excluded.school_id, public.profiles.school_id),
    student_id = coalesce(excluded.student_id, public.profiles.student_id),
    employee_id = coalesce(excluded.employee_id, public.profiles.employee_id);

  return new;
end;
$$;

create or replace function public.admin_update_school_admin_email(
  p_school_id uuid,
  p_admin_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eduguide_is_current_user_admin() then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;

  if p_admin_email is null
     or p_admin_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'A valid admin email is required' using errcode = '22023';
  end if;

  update public.schools
  set admin_email = lower(trim(p_admin_email)),
      updated_at = timezone('utc'::text, now())
  where id = p_school_id
    and active = true;

  if not found then
    raise exception 'School not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke execute on function public.admin_update_school_admin_email(uuid, text)
  from public, anon;
grant execute on function public.admin_update_school_admin_email(uuid, text)
  to authenticated;

-- The admin login for the initial ASCI deployment.
update public.profiles p
set
  role = 'admin',
  account_type = 'admin',
  school_id = s.id,
  section_onboarding_complete = true
from public.schools s
where lower(p.email) = lower('duckytorpedo@gmail.com')
  and s.name = 'Amigo School of Calinan, Inc.';

commit;
