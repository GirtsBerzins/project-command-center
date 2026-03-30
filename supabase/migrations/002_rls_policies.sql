-- ============================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================
alter table profiles       enable row level security;
alter table streams        enable row level security;
alter table tasks          enable row level security;
alter table sprints        enable row level security;
alter table task_sprint    enable row level security;
alter table kpis           enable row level security;
alter table kpi_values     enable row level security;
alter table risks          enable row level security;
alter table weekly_reports enable row level security;
alter table activity_logs  enable row level security;

-- ============================================================
-- HELPER FUNCTION: get current user's role
-- ============================================================
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
create policy "profiles: owner/manager full access"
  on profiles for all
  using (get_my_role() in ('owner', 'manager'));

create policy "profiles: member/viewer can read"
  on profiles for select
  using (get_my_role() in ('member', 'viewer'));

create policy "profiles: users can update own profile"
  on profiles for update
  using (id = auth.uid());

-- ============================================================
-- STREAMS POLICIES
-- ============================================================
create policy "streams: owner/manager full access"
  on streams for all
  using (get_my_role() in ('owner', 'manager'));

create policy "streams: member/viewer can read"
  on streams for select
  using (get_my_role() in ('member', 'viewer'));

-- ============================================================
-- TASKS POLICIES
-- ============================================================
create policy "tasks: owner/manager full access"
  on tasks for all
  using (get_my_role() in ('owner', 'manager'));

create policy "tasks: member can read all"
  on tasks for select
  using (get_my_role() = 'member');

create policy "tasks: member can update own tasks"
  on tasks for update
  using (get_my_role() = 'member' and assignee_id = auth.uid());

create policy "tasks: viewer can read"
  on tasks for select
  using (get_my_role() = 'viewer');

-- ============================================================
-- SPRINTS POLICIES
-- ============================================================
create policy "sprints: owner/manager full access"
  on sprints for all
  using (get_my_role() in ('owner', 'manager'));

create policy "sprints: member/viewer can read"
  on sprints for select
  using (get_my_role() in ('member', 'viewer'));

-- ============================================================
-- TASK_SPRINT POLICIES
-- ============================================================
create policy "task_sprint: owner/manager full access"
  on task_sprint for all
  using (get_my_role() in ('owner', 'manager'));

create policy "task_sprint: member/viewer can read"
  on task_sprint for select
  using (get_my_role() in ('member', 'viewer'));

-- ============================================================
-- KPIs POLICIES
-- ============================================================
create policy "kpis: owner/manager full access"
  on kpis for all
  using (get_my_role() in ('owner', 'manager'));

create policy "kpis: member/viewer can read"
  on kpis for select
  using (get_my_role() in ('member', 'viewer'));

-- ============================================================
-- KPI_VALUES POLICIES
-- ============================================================
create policy "kpi_values: owner/manager full access"
  on kpi_values for all
  using (get_my_role() in ('owner', 'manager'));

create policy "kpi_values: member/viewer can read"
  on kpi_values for select
  using (get_my_role() in ('member', 'viewer'));

-- ============================================================
-- RISKS POLICIES
-- ============================================================
create policy "risks: owner/manager full access"
  on risks for all
  using (get_my_role() in ('owner', 'manager'));

create policy "risks: member/viewer can read"
  on risks for select
  using (get_my_role() in ('member', 'viewer'));

-- ============================================================
-- WEEKLY_REPORTS POLICIES
-- ============================================================
create policy "weekly_reports: owner/manager full access"
  on weekly_reports for all
  using (get_my_role() in ('owner', 'manager'));

create policy "weekly_reports: member/viewer can read"
  on weekly_reports for select
  using (get_my_role() in ('member', 'viewer'));

-- ============================================================
-- ACTIVITY_LOGS POLICIES
-- ============================================================
create policy "activity_logs: owner/manager full access"
  on activity_logs for all
  using (get_my_role() in ('owner', 'manager'));

create policy "activity_logs: member can read all, insert own"
  on activity_logs for select
  using (get_my_role() = 'member');

create policy "activity_logs: member can insert own"
  on activity_logs for insert
  with check (get_my_role() = 'member' and user_id = auth.uid());

create policy "activity_logs: viewer can read"
  on activity_logs for select
  using (get_my_role() = 'viewer');
