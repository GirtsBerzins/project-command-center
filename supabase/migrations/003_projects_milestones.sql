-- ============================================================
-- PROJECTS & MILESTONES LAYER
-- ============================================================

-- Projects table
create table if not exists projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  owner_id    uuid references profiles(id),
  start_date  date,
  end_date    date,
  status      text default 'planned'
                check (status in ('planned','active','delayed','completed')),
  created_at  timestamptz default now()
);

-- Milestones table
create table if not exists milestones (
  id             uuid primary key default uuid_generate_v4(),
  stream_id      uuid references streams(id) on delete cascade,
  project_id     uuid references projects(id) on delete cascade,
  title          text not null,
  weight_percent int check (weight_percent between 1 and 100),
  status         text default 'planned'
                   check (status in ('planned','active','completed')),
  due_date       date,
  completed_at   timestamptz,
  created_at     timestamptz default now()
);

-- Add project_id to streams (nullable for backward compatibility)
alter table streams
  add column if not exists project_id uuid
    references projects(id) on delete set null;

-- Add sprint <-> streams many-to-many
create table if not exists sprint_streams (
  sprint_id  uuid references sprints(id) on delete cascade,
  stream_id  uuid references streams(id) on delete cascade,
  primary key (sprint_id, stream_id)
);

-- ============================================================
-- RLS FOR NEW TABLES
-- ============================================================

alter table projects       enable row level security;
alter table milestones     enable row level security;
alter table sprint_streams enable row level security;

-- Helper wrapper to align with requested policies
create or replace function get_user_role(user_id uuid)
returns text
language sql
security definer
stable
as $$
  select role from profiles where id = user_id
$$;

-- Projects policies
create policy "projects_select"
  on projects for select
  using (auth.uid() is not null);

create policy "projects_insert"
  on projects for insert
  with check (get_user_role(auth.uid()) in ('owner','manager'));

create policy "projects_update"
  on projects for update
  using (get_user_role(auth.uid()) in ('owner','manager'));

create policy "projects_delete"
  on projects for delete
  using (get_user_role(auth.uid()) = 'owner');

-- Milestones policies
create policy "milestones_select"
  on milestones for select
  using (auth.uid() is not null);

create policy "milestones_insert"
  on milestones for insert
  with check (get_user_role(auth.uid()) in ('owner','manager'));

create policy "milestones_update"
  on milestones for update
  using (get_user_role(auth.uid()) in ('owner','manager'));

create policy "milestones_delete"
  on milestones for delete
  using (get_user_role(auth.uid()) in ('owner','manager'));

-- Sprint_streams policies
create policy "sprint_streams_select"
  on sprint_streams for select
  using (auth.uid() is not null);

create policy "sprint_streams_insert"
  on sprint_streams for insert
  with check (get_user_role(auth.uid()) in ('owner','manager'));

create policy "sprint_streams_delete"
  on sprint_streams for delete
  using (get_user_role(auth.uid()) in ('owner','manager'));

-- ============================================================
-- AUTO-STATUS FUNCTION FOR PROJECTS
-- ============================================================

create or replace function calculate_project_status(proj_id uuid)
returns text
language plpgsql
security definer
stable
as $$
declare
  total_milestones     int;
  completed_milestones int;
  delayed_milestones   int;
begin
  select count(*) into total_milestones
  from milestones
  where project_id = proj_id;

  select count(*) into completed_milestones
  from milestones
  where project_id = proj_id
    and status = 'completed';

  select count(*) into delayed_milestones
  from milestones
  where project_id = proj_id
    and status <> 'completed'
    and due_date < current_date;

  if total_milestones = 0 then
    return 'planned';
  end if;

  if completed_milestones = total_milestones then
    return 'completed';
  end if;

  if delayed_milestones > 0 then
    return 'delayed';
  end if;

  if completed_milestones > 0 then
    return 'active';
  end if;

  return 'planned';
end;
$$;

-- ============================================================
-- DEFAULT PROJECT & BACKFILL
-- ============================================================

insert into projects (id, name, description, status)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Sociālais tīkls',
  'Noklusētais projekts — esošās straumes',
  'active'
)
on conflict (id) do nothing;

update streams
set project_id = 'aaaaaaaa-0000-0000-0000-000000000001'
where project_id is null;

-- Delete obvious test data from streams
delete from streams
where name ilike '%test%'
   or name ilike '%sadsd%'
   or name ilike '%asdsd%';

