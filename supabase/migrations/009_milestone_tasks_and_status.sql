-- Milestone ↔ task links, description, status model (planned | reached | missed), sync trigger.

create table if not exists milestone_tasks (
  milestone_id uuid not null references milestones(id) on delete cascade,
  task_id      uuid not null references tasks(id) on delete cascade,
  primary key (milestone_id, task_id)
);

create index if not exists milestone_tasks_task_id_idx on milestone_tasks (task_id);

alter table milestone_tasks enable row level security;

create policy "milestone_tasks: owner/manager full access"
  on milestone_tasks for all
  using (get_my_role() in ('owner', 'manager'));

create policy "milestone_tasks: member/viewer select"
  on milestone_tasks for select
  using (get_my_role() in ('member', 'viewer'));

alter table milestones add column if not exists description text;

alter table milestones drop constraint if exists milestones_status_check;

update milestones set status = 'reached' where status = 'completed';
update milestones set status = 'planned' where status = 'active';

alter table milestones add constraint milestones_status_check
  check (status in ('planned', 'reached', 'missed'));

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
    and status = 'reached';

  select count(*) into delayed_milestones
  from milestones
  where project_id = proj_id
    and status not in ('reached')
    and due_date is not null
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

create or replace function sync_milestones_after_task()
returns trigger
language plpgsql
security definer
as $$
declare
  tid uuid := coalesce(new.id, old.id);
begin
  update milestones m
  set status = 'reached',
      completed_at = coalesce(m.completed_at, now())
  where m.id in (select milestone_id from milestone_tasks where task_id = tid)
    and exists (select 1 from milestone_tasks mt where mt.milestone_id = m.id)
    and not exists (
      select 1 from milestone_tasks mt
      join tasks t on t.id = mt.task_id
      where mt.milestone_id = m.id and t.status <> 'done'
    )
    and m.status in ('planned', 'missed');
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_milestones_tasks on tasks;
create trigger trg_sync_milestones_tasks
  after insert or update of status on tasks
  for each row execute function sync_milestones_after_task();
