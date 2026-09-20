-- EduGuide PH - student sections + teacher section rosters
-- The live EduGuide PH Supabase project has already received this upgrade.

begin;

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  grade_year text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint sections_name_length_check check (char_length(trim(name)) between 1 and 120)
);

create unique index if not exists sections_school_name_unique_idx
  on public.sections(school_id, lower(name));

create index if not exists sections_school_active_idx
  on public.sections(school_id, active, name);

alter table public.profiles
  add column if not exists section_id uuid,
  add column if not exists section_onboarding_complete boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_section_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_section_id_fkey
      foreign key (section_id) references public.sections(id)
      on delete set null;
  end if;
end
$$;

create index if not exists profiles_section_id_idx
  on public.profiles(section_id);

create table if not exists public.teacher_section_assignments (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (teacher_id, section_id)
);

create index if not exists teacher_section_assignments_section_idx
  on public.teacher_section_assignments(section_id, teacher_id);

alter table public.sections enable row level security;
alter table public.teacher_section_assignments enable row level security;

revoke all on table public.sections from anon, authenticated;
grant select on table public.sections to authenticated;

revoke all on table public.teacher_section_assignments from anon, authenticated;
grant select on table public.teacher_section_assignments to authenticated;

drop policy if exists "Authenticated users can view active sections" on public.sections;
create policy "Authenticated users can view active sections"
on public.sections
for select
to authenticated
using (active = true);

drop policy if exists "Teachers can view own section assignments" on public.teacher_section_assignments;
create policy "Teachers can view own section assignments"
on public.teacher_section_assignments
for select
to authenticated
using (
  teacher_id = (select auth.uid())
  or public.eduguide_is_current_user_admin()
);

create or replace function public.set_my_section(
  p_section_id uuid default null,
  p_skip_selection boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  profile_row public.profiles%rowtype;
  section_row public.sections%rowtype;
begin
  if requester is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into profile_row
  from public.profiles
  where id = requester
  for update;

  if profile_row.id is null or profile_row.account_type <> 'student' then
    raise exception 'Only student accounts can choose a section'
      using errcode = '42501';
  end if;

  if p_section_id is null then
    update public.profiles
    set section_id = null,
        section_onboarding_complete = true
    where id = requester;

    return jsonb_build_object(
      'sectionId', null,
      'sectionName', null,
      'onboardingComplete', true
    );
  end if;

  select *
  into section_row
  from public.sections
  where id = p_section_id
    and active = true;

  if section_row.id is null then
    raise exception 'Selected section is not available'
      using errcode = '22023';
  end if;

  if profile_row.school_id is null or section_row.school_id <> profile_row.school_id then
    raise exception 'Selected section does not belong to your school'
      using errcode = '42501';
  end if;

  update public.profiles
  set section_id = section_row.id,
      section_onboarding_complete = true,
      grade_year = coalesce(section_row.grade_year, grade_year)
  where id = requester;

  return jsonb_build_object(
    'sectionId', section_row.id,
    'sectionName', section_row.name,
    'gradeYear', section_row.grade_year,
    'onboardingComplete', true
  );
end;
$$;

revoke execute on function public.set_my_section(uuid, boolean) from public, anon;
grant execute on function public.set_my_section(uuid, boolean) to authenticated;

create or replace function public.teacher_my_sections()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  requester_role text;
  result jsonb;
begin
  select role
  into requester_role
  from public.profiles
  where id = requester;

  if requester_role <> 'teacher' then
    raise exception 'Teacher access is required'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(section_item order by section_name), '[]'::jsonb)
  into result
  from (
    select
      s.name as section_name,
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'gradeYear', s.grade_year,
        'studentCount', count(p.id),
        'students', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'name', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
              'gradeYear', p.grade_year
            )
            order by p.last_name nulls last, p.first_name nulls last
          ) filter (where p.id is not null),
          '[]'::jsonb
        )
      ) as section_item
    from public.teacher_section_assignments tsa
    join public.sections s
      on s.id = tsa.section_id
     and s.active = true
    left join public.profiles p
      on p.section_id = s.id
     and p.account_type = 'student'
    where tsa.teacher_id = requester
    group by s.id, s.name, s.grade_year
  ) q;

  return coalesce(result, '[]'::jsonb);
end;
$$;

revoke execute on function public.teacher_my_sections() from public, anon;
grant execute on function public.teacher_my_sections() to authenticated;

create or replace function public.admin_section_management()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.eduguide_is_current_user_admin() then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'sections',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'schoolId', s.school_id,
            'schoolName', sc.name,
            'name', s.name,
            'gradeYear', s.grade_year,
            'active', s.active,
            'teachers', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', p.id,
                    'name', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
                    'email', p.email
                  )
                  order by p.last_name nulls last, p.first_name nulls last
                )
                from public.teacher_section_assignments tsa
                join public.profiles p on p.id = tsa.teacher_id
                where tsa.section_id = s.id
              ),
              '[]'::jsonb
            ),
            'studentCount', (
              select count(*)
              from public.profiles sp
              where sp.section_id = s.id
                and sp.account_type = 'student'
            )
          )
          order by sc.name, s.grade_year nulls last, s.name
        )
        from public.sections s
        join public.schools sc on sc.id = s.school_id
        where s.active = true
      ),
      '[]'::jsonb
    ),
    'teachers',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
            'email', p.email,
            'schoolId', p.school_id
          )
          order by p.last_name nulls last, p.first_name nulls last
        )
        from public.profiles p
        where p.role = 'teacher'
      ),
      '[]'::jsonb
    ),
    'schools',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'shortName', s.short_name
          )
          order by s.name
        )
        from public.schools s
        where s.active = true
      ),
      '[]'::jsonb
    )
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.admin_section_management() from public, anon;
grant execute on function public.admin_section_management() to authenticated;

create or replace function public.admin_create_section(
  p_school_id uuid,
  p_name text,
  p_grade_year text default null
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
    select 1 from public.schools s
    where s.id = p_school_id and s.active = true
  ) then
    raise exception 'School not found' using errcode = '22023';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 1 then
    raise exception 'Section name is required' using errcode = '22023';
  end if;

  insert into public.sections (school_id, name, grade_year)
  values (
    p_school_id,
    trim(p_name),
    nullif(trim(coalesce(p_grade_year, '')), '')
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.admin_create_section(uuid, text, text) from public, anon;
grant execute on function public.admin_create_section(uuid, text, text) to authenticated;

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
