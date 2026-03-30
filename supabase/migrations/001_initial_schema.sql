-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  role        text not null default 'member'
                check (role in ('owner', 'manager', 'member', 'viewer')),
  created_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- STREAMS
-- ============================================================
create table if not exists streams (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  owner_id    uuid references profiles(id) on delete set null,
  goal        text,
  status      text not null default 'active'
                check (status in ('active', 'on_hold', 'completed', 'cancelled')),
  progress    integer not null default 0 check (progress between 0 and 100),
  deadline    date,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- SPRINTS
-- ============================================================
create table if not exists sprints (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  goals       text,
  status      text not null default 'planned'
                check (status in ('planned', 'active', 'completed')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists tasks (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  description     text,
  stream_id       uuid references streams(id) on delete set null,
  assignee_id     uuid references profiles(id) on delete set null,
  priority        text not null default 'medium'
                    check (priority in ('low', 'medium', 'high', 'critical')),
  status          text not null default 'todo'
                    check (status in ('todo', 'in_progress', 'review', 'done')),
  due_date        date,
  estimate_hours  numeric(6,2),
  actual_hours    numeric(6,2),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- TASK-SPRINT JOIN
-- ============================================================
create table if not exists task_sprint (
  task_id   uuid not null references tasks(id) on delete cascade,
  sprint_id uuid not null references sprints(id) on delete cascade,
  primary key (task_id, sprint_id)
);

-- ============================================================
-- KPIs
-- ============================================================
create table if not exists kpis (
  id        uuid primary key default uuid_generate_v4(),
  name      text not null,
  target    numeric(12,4) not null,
  current   numeric(12,4) not null default 0,
  unit      text,
  trend     text not null default 'stable'
              check (trend in ('up', 'down', 'stable')),
  owner_id  uuid references profiles(id) on delete set null,
  period    text,
  created_at timestamptz not null default now()
);

create table if not exists kpi_values (
  id          uuid primary key default uuid_generate_v4(),
  kpi_id      uuid not null references kpis(id) on delete cascade,
  value       numeric(12,4) not null,
  recorded_at timestamptz not null default now()
);

-- ============================================================
-- RISKS
-- ============================================================
create table if not exists risks (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  impact      text not null default 'medium'
                check (impact in ('low', 'medium', 'high')),
  probability text not null default 'medium'
                check (probability in ('low', 'medium', 'high')),
  severity    text,
  mitigation  text,
  owner_id    uuid references profiles(id) on delete set null,
  due_date    date,
  status      text not null default 'open'
                check (status in ('open', 'mitigated', 'closed')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- WEEKLY REPORTS
-- ============================================================
create table if not exists weekly_reports (
  id          uuid primary key default uuid_generate_v4(),
  week_start  date not null,
  week_end    date not null,
  content_md  text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
create table if not exists activity_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- Index for activity timeline queries
create index if not exists activity_logs_created_at_idx on activity_logs(created_at desc);
create index if not exists activity_logs_user_id_idx on activity_logs(user_id);
