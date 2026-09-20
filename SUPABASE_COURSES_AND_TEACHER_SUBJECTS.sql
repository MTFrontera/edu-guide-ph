-- EduGuide PH - school course catalog + teacher course selections
-- The live EduGuide PH Supabase project has already received this upgrade.

begin;

drop function if exists public.admin_set_teacher_section(uuid, uuid, boolean, text);

alter table public.teacher_section_assignments
  drop constraint if exists teacher_section_assignments_course_label_check;

alter table public.teacher_section_assignments
  drop column if exists course_label;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint courses_name_length_check
    check (char_length(trim(name)) between 1 and 120)
);

create unique index if not exists courses_school_name_unique_idx
  on public.courses(school_id, lower(name));

create index if not exists courses_school_active_idx
  on public.courses(school_id, active, name);

create table if not exists public.teacher_course_assignments (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (teacher_id, course_id)
);

create index if not exists teacher_course_assignments_course_idx
  on public.teacher_course_assignments(course_id, teacher_id);

alter table public.courses enable row level security;
alter table public.teacher_course_assignments enable row level security;

revoke all on table public.courses from anon, authenticated;
grant select on table public.courses to authenticated;

revoke all on table public.teacher_course_assignments from anon, authenticated;
grant select on table public.teacher_course_assignments to authenticated;

drop policy if exists "Authenticated users can view active courses" on public.courses;
create policy "Authenticated users can view active courses"
on public.courses
for select
to authenticated
using (active = true);

drop policy if exists "Teachers can view own course selections" on public.teacher_course_assignments;
create policy "Teachers can view own course selections"
on public.teacher_course_assignments
for select
to authenticated
using (
  teacher_id = (select auth.uid())
  or public.eduguide_is_current_user_admin()
);

create or replace function public.teacher_course_catalog()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  requester_role text;
  requester_school uuid;
  result jsonb;
begin
  select role, school_id
  into requester_role, requester_school
  from public.profiles
  where id = requester;

  if requester_role <> 'teacher' then
    raise exception 'Teacher access is required'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'selected', exists (
          select 1
          from public.teacher_course_assignments tca
          where tca.teacher_id = requester
            and tca.course_id = c.id
        )
      )
      order by c.name
    ),
    '[]'::jsonb
  )
  into result
  from public.courses c
  where c.school_id = requester_school
    and c.active = true;

  return result;
end;
$$;

revoke execute on function public.teacher_course_catalog() from public, anon;
grant execute on function public.teacher_course_catalog() to authenticated;

create or replace function public.teacher_set_course(
  p_course_id uuid,
  p_selected boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  requester_role text;
  requester_school uuid;
  course_school uuid;
begin
  select role, school_id
  into requester_role, requester_school
  from public.profiles
  where id = requester;

  if requester_role <> 'teacher' then
    raise exception 'Teacher access is required'
      using errcode = '42501';
  end if;

  select school_id
  into course_school
  from public.courses
  where id = p_course_id
    and active = true;

  if course_school is null then
    raise exception 'Course not found' using errcode = '22023';
  end if;

  if requester_school is distinct from course_school then
    raise exception 'Course does not belong to your school'
      using errcode = '42501';
  end if;

  if p_selected then
    insert into public.teacher_course_assignments (teacher_id, course_id)
    values (requester, p_course_id)
    on conflict do nothing;
  else
    delete from public.teacher_course_assignments
    where teacher_id = requester
      and course_id = p_course_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.teacher_set_course(uuid, boolean) from public, anon;
grant execute on function public.teacher_set_course(uuid, boolean) to authenticated;

create or replace function public.admin_create_course(
  p_school_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.eduguide_is_current_user_admin() then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.schools s
    where s.id = p_school_id
      and s.active = true
  ) then
    raise exception 'School not found' using errcode = '22023';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 1 then
    raise exception 'Course or subject name is required'
      using errcode = '22023';
  end if;

  insert into public.courses (school_id, name)
  values (p_school_id, trim(p_name))
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.admin_create_course(uuid, text) from public, anon;
grant execute on function public.admin_create_course(uuid, text) to authenticated;

create or replace function public.admin_set_teacher_section(
  p_teacher_id uuid,
  p_section_id uuid,
  p_assigned boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  teacher_school uuid;
  teacher_role text;
  section_school uuid;
begin
  if not public.eduguide_is_current_user_admin() then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;

  select p.role, p.school_id
  into teacher_role, teacher_school
  from public.profiles p
  where p.id = p_teacher_id;

  if teacher_role <> 'teacher' then
    raise exception 'Selected account is not an approved teacher'
      using errcode = '22023';
  end if;

  select s.school_id
  into section_school
  from public.sections s
  where s.id = p_section_id
    and s.active = true;

  if section_school is null then
    raise exception 'Section not found' using errcode = '22023';
  end if;

  if teacher_school is distinct from section_school then
    raise exception 'Teacher and section must belong to the same school'
      using errcode = '42501';
  end if;

  if p_assigned then
    insert into public.teacher_section_assignments (teacher_id, section_id)
    values (p_teacher_id, p_section_id)
    on conflict do nothing;
  else
    delete from public.teacher_section_assignments
    where teacher_id = p_teacher_id
      and section_id = p_section_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.admin_set_teacher_section(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_set_teacher_section(uuid, uuid, boolean) to authenticated;

commit;
