-- Task dependency edges and scheduling columns for CPM-style dates.

create table if not exists task_dependencies (
  id                   uuid primary key default gen_random_uuid(),
  task_id              uuid not null references tasks(id) on delete cascade,
  depends_on_task_id   uuid not null references tasks(id) on delete cascade,
  type                 text not null
                         check (type in ('sequential', 'parallel')),
  created_at           timestamptz not null default now(),
  constraint task_dependencies_no_self check (task_id <> depends_on_task_id),
  constraint task_dependencies_unique_edge unique (task_id, depends_on_task_id)
);

create index if not exists task_dependencies_task_id_idx on task_dependencies (task_id);
create index if not exists task_dependencies_depends_on_idx on task_dependencies (depends_on_task_id);

alter table tasks
  add column if not exists start_date date,
  add column if not exists calculated_start_date date,
  add column if not exists calculated_end_date date,
  add column if not exists manual_override boolean not null default false;

alter table task_dependencies enable row level security;

create policy "task_dependencies: owner/manager full access"
  on task_dependencies for all
  using (get_my_role() in ('owner', 'manager'));

create policy "task_dependencies: member/viewer select"
  on task_dependencies for select
  using (get_my_role() in ('member', 'viewer'));

create policy "task_dependencies: member insert when assignee of task"
  on task_dependencies for insert
  with check (
    get_my_role() = 'member'
    and exists (select 1 from tasks where tasks.id = task_id and tasks.assignee_id = auth.uid())
  );

create policy "task_dependencies: member update when assignee of task"
  on task_dependencies for update
  using (
    get_my_role() = 'member'
    and exists (select 1 from tasks where tasks.id = task_id and tasks.assignee_id = auth.uid())
  );

create policy "task_dependencies: member delete when assignee of task"
  on task_dependencies for delete
  using (
    get_my_role() = 'member'
    and exists (select 1 from tasks where tasks.id = task_id and tasks.assignee_id = auth.uid())
  );
