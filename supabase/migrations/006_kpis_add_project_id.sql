-- ============================================================
-- KPI PROJECT SCOPING
-- ============================================================

alter table kpis
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists kpis_project_id_idx on kpis(project_id);

-- Backfill existing KPI rows to default project to avoid mixed global dashboards.
update kpis
set project_id = 'aaaaaaaa-0000-0000-0000-000000000001'
where project_id is null;
