create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'teacher')),
  grade smallint not null check (grade between 1 and 6),
  class_number smallint not null check (class_number between 1 and 20),
  student_number smallint,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint profiles_student_number_check check (
    (role = 'student' and student_number between 1 and 50)
    or (role = 'teacher' and student_number is null)
  )
);

create unique index if not exists profiles_student_seat_unique
  on public.profiles (grade, class_number, student_number)
  where role = 'student';

create table if not exists public.classroom_learning_settings (
  grade smallint not null check (grade between 1 and 6),
  class_number smallint not null check (class_number between 1 and 20),
  machine_lab_open boolean not null default false,
  missions_per_session smallint not null default 1 check (missions_per_session between 1 and 4),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (grade, class_number)
);
alter table public.classroom_learning_settings
  add column if not exists missions_per_session smallint not null default 1;
alter table public.classroom_learning_settings drop constraint if exists classroom_learning_settings_missions_per_session_check;
alter table public.classroom_learning_settings add constraint classroom_learning_settings_missions_per_session_check
  check (missions_per_session between 1 and 4);
alter table public.classroom_learning_settings enable row level security;
revoke all on public.classroom_learning_settings from anon, authenticated;
grant all on public.classroom_learning_settings to service_role;

create or replace function public.teacher_can_view_class(target_grade smallint, target_class smallint)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
      and p.grade = target_grade and p.class_number = target_class
  );
$$;

create or replace function public.student_owns_class(target_grade smallint, target_class smallint, target_number smallint default null)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
      and p.grade = target_grade and p.class_number = target_class
      and (target_number is null or p.student_number = target_number)
  );
$$;

revoke all on function public.teacher_can_view_class(smallint, smallint) from public;
revoke all on function public.student_owns_class(smallint, smallint, smallint) from public;
grant execute on function public.teacher_can_view_class(smallint, smallint) to authenticated;
grant execute on function public.student_owns_class(smallint, smallint, smallint) to authenticated;

create table if not exists public.student_roster (
  id uuid primary key default gen_random_uuid(),
  grade smallint not null check (grade between 1 and 6),
  class_number smallint not null check (class_number between 1 and 20),
  student_number smallint not null check (student_number between 1 and 50),
  display_name text not null,
  created_by uuid not null references public.profiles(id),
  activation_code_hash text not null,
  code_expires_at timestamptz not null,
  auth_user_id uuid unique references auth.users(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (grade, class_number, student_number)
);
alter table public.student_roster enable row level security;
revoke all on public.student_roster from anon, authenticated;
grant all on public.student_roster to service_role;

create table if not exists public.student_skill_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  unit_id text not null default 'decimals',
  grade smallint not null,
  class_number smallint not null,
  skill text not null check (skill ~ '^[a-z][a-z0-9_]*$'),
  attempts integer not null default 0 check (attempts >= 0),
  correct integer not null default 0 check (correct between 0 and attempts),
  consecutive_correct integer not null default 0 check (consecutive_correct >= 0),
  hint_count integer not null default 0 check (hint_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (student_id, skill)
);
alter table public.student_skill_progress
  add column if not exists unit_id text not null default 'decimals';
alter table public.student_skill_progress drop constraint if exists student_skill_progress_skill_check;
alter table public.student_skill_progress add constraint student_skill_progress_skill_check
  check (skill ~ '^[a-z][a-z0-9_]*$');
create index if not exists student_skill_progress_class
  on public.student_skill_progress (grade, class_number, skill);
alter table public.student_skill_progress enable row level security;
revoke all on public.student_skill_progress from anon, authenticated;
grant select on public.student_skill_progress to authenticated;
grant all on public.student_skill_progress to service_role;

drop policy if exists skill_progress_read_self_or_class_teacher on public.student_skill_progress;
create policy skill_progress_read_self_or_class_teacher on public.student_skill_progress
  for select to authenticated
  using (student_id = auth.uid() or public.teacher_can_view_class(grade, class_number));

create table if not exists public.student_learning_path (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  lesson_index smallint not null default 0 check (lesson_index between 0 and 100),
  session_start_index smallint not null default 0 check (session_start_index between 0 and 100),
  session_mission_count smallint not null default 1 check (session_mission_count between 1 and 4),
  attempts smallint not null default 0 check (attempts between 0 and 20),
  completed_at timestamptz,
  completed_correctly boolean,
  updated_at timestamptz not null default now(),
  check ((completed_at is null and completed_correctly is null) or completed_at is not null)
);
alter table public.student_learning_path
  add column if not exists student_id uuid references public.profiles(id) on delete cascade,
  add column if not exists lesson_index smallint not null default 0,
  add column if not exists session_start_index smallint not null default 0,
  add column if not exists session_mission_count smallint not null default 1,
  add column if not exists attempts smallint not null default 0,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_correctly boolean,
  add column if not exists updated_at timestamptz not null default now();
alter table public.student_learning_path drop constraint if exists student_learning_path_lesson_index_check;
alter table public.student_learning_path add constraint student_learning_path_lesson_index_check
  check (lesson_index between 0 and 100);
alter table public.student_learning_path drop constraint if exists student_learning_path_session_start_index_check;
alter table public.student_learning_path add constraint student_learning_path_session_start_index_check
  check (session_start_index between 0 and 100);
alter table public.student_learning_path drop constraint if exists student_learning_path_session_mission_count_check;
alter table public.student_learning_path add constraint student_learning_path_session_mission_count_check
  check (session_mission_count between 1 and 4);
update public.student_learning_path
set session_start_index = lesson_index
where session_mission_count = 1 and session_start_index < lesson_index;
create unique index if not exists student_learning_path_student_id
  on public.student_learning_path (student_id);
alter table public.student_learning_path enable row level security;
revoke all on public.student_learning_path from anon, authenticated;
grant all on public.student_learning_path to service_role;

create table if not exists public.student_activity (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  grade smallint not null,
  class_number smallint not null,
  current_view text not null,
  activity text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  grade smallint not null,
  class_number smallint not null,
  student_number smallint not null,
  unit_id text not null default 'decimals',
  question text not null,
  mode text not null check (mode in ('concept', 'stuck', 'check', 'teach', 'battle')),
  messages jsonb not null default '[]'::jsonb,
  flagged boolean not null default false,
  flag_reason text,
  flagged_context text,
  result text,
  practice_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conversation_logs
  add column if not exists unit_id text not null default 'decimals';
alter table public.conversation_logs drop constraint if exists conversation_logs_mode_check;
alter table public.conversation_logs add constraint conversation_logs_mode_check
  check (mode in ('concept', 'stuck', 'check', 'teach', 'battle'));

create index if not exists conversation_logs_class_recent
  on public.conversation_logs (grade, class_number, created_at desc);

alter table public.profiles enable row level security;
alter table public.student_activity enable row level security;
alter table public.conversation_logs enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.student_activity from anon, authenticated;
revoke all on public.conversation_logs from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.student_activity to authenticated;
grant select on public.conversation_logs to authenticated;
grant all on public.conversation_logs to service_role;

drop policy if exists profiles_read_self_or_class_teacher on public.profiles;
create policy profiles_read_self_or_class_teacher on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.teacher_can_view_class(grade, class_number));

drop policy if exists activity_read_self_or_class_teacher on public.student_activity;
create policy activity_read_self_or_class_teacher on public.student_activity
  for select to authenticated
  using (student_id = auth.uid() or public.teacher_can_view_class(grade, class_number));

drop policy if exists activity_insert_student_self on public.student_activity;
create policy activity_insert_student_self on public.student_activity
  for insert to authenticated
  with check (student_id = auth.uid() and public.student_owns_class(grade, class_number));

drop policy if exists activity_update_student_self on public.student_activity;
create policy activity_update_student_self on public.student_activity
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and public.student_owns_class(grade, class_number));

drop policy if exists activity_delete_student_self on public.student_activity;
create policy activity_delete_student_self on public.student_activity
  for delete to authenticated
  using (student_id = auth.uid());

drop policy if exists logs_read_self_or_class_teacher on public.conversation_logs;
create policy logs_read_self_or_class_teacher on public.conversation_logs
  for select to authenticated
  using (student_id = auth.uid() or public.teacher_can_view_class(grade, class_number));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'student_activity') then
      execute 'alter publication supabase_realtime add table public.student_activity';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_logs') then
      execute 'alter publication supabase_realtime add table public.conversation_logs';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'student_skill_progress') then
      execute 'alter publication supabase_realtime add table public.student_skill_progress';
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
