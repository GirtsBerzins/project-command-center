-- ============================================================
-- SEED DATA — Project Command Center Demo
-- NOTE: Run after creating auth users via Supabase dashboard
--       or replace UUIDs with real user UUIDs from auth.users
-- ============================================================

-- Demo users (these are placeholder UUIDs — replace with real ones after auth setup)
do $$
declare
  owner_id   uuid := '11111111-1111-1111-1111-111111111111';
  manager_id uuid := '22222222-2222-2222-2222-222222222222';
  member1_id uuid := '33333333-3333-3333-3333-333333333333';
  member2_id uuid := '44444444-4444-4444-4444-444444444444';

  -- Stream IDs
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid;

  -- Sprint IDs
  sp1 uuid; sp2 uuid;

  -- Task IDs (20)
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid;
  t6 uuid; t7 uuid; t8 uuid; t9 uuid; t10 uuid;
  t11 uuid; t12 uuid; t13 uuid; t14 uuid; t15 uuid;
  t16 uuid; t17 uuid; t18 uuid; t19 uuid; t20 uuid;

  -- KPI IDs
  k1 uuid; k2 uuid; k3 uuid; k4 uuid; k5 uuid;

  -- Risk IDs
  r1 uuid; r2 uuid; r3 uuid; r4 uuid;
begin

-- ============================================================
-- PROFILES
-- ============================================================
insert into profiles (id, full_name, avatar_url, role) values
  (owner_id,   'Alex Morgan',   null, 'owner'),
  (manager_id, 'Jamie Rivera',  null, 'manager'),
  (member1_id, 'Taylor Chen',   null, 'member'),
  (member2_id, 'Morgan Davis',  null, 'member')
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

-- ============================================================
-- STREAMS (6)
-- ============================================================
insert into streams (id, name, owner_id, goal, status, progress, deadline) values
  (gen_random_uuid(), 'Platform Modernisation', owner_id,   'Migrate monolith to microservices',           'active',    68, '2026-06-30'),
  (gen_random_uuid(), 'Mobile App v2',          manager_id, 'Launch iOS & Android 2.0',                    'active',    42, '2026-05-15'),
  (gen_random_uuid(), 'Data Platform',          owner_id,   'Build real-time analytics pipeline',          'active',    55, '2026-07-31'),
  (gen_random_uuid(), 'Security Hardening',     manager_id, 'Achieve SOC 2 Type II compliance',            'active',    30, '2026-04-30'),
  (gen_random_uuid(), 'Customer Portal',        member1_id, 'Self-service portal for enterprise clients',  'on_hold',   15, '2026-08-31'),
  (gen_random_uuid(), 'ML Recommendations',     owner_id,   'Deploy personalisation engine to production', 'active',    80, '2026-04-15')
returning id into s1;

-- Grab IDs individually for task assignment
select id into s1 from streams where name = 'Platform Modernisation' limit 1;
select id into s2 from streams where name = 'Mobile App v2' limit 1;
select id into s3 from streams where name = 'Data Platform' limit 1;
select id into s4 from streams where name = 'Security Hardening' limit 1;
select id into s5 from streams where name = 'Customer Portal' limit 1;
select id into s6 from streams where name = 'ML Recommendations' limit 1;

-- ============================================================
-- SPRINTS (2)
-- ============================================================
insert into sprints (id, name, start_date, end_date, goals, status) values
  (gen_random_uuid(), 'Sprint 14 — Foundation', '2026-03-17', '2026-03-30',
   'Complete auth service, data pipeline schema, security audit prep', 'active'),
  (gen_random_uuid(), 'Sprint 15 — Acceleration', '2026-03-31', '2026-04-13',
   'Mobile beta release, ML model deployment, SOC 2 evidence collection', 'planned')
returning id into sp1;

select id into sp1 from sprints where name like 'Sprint 14%' limit 1;
select id into sp2 from sprints where name like 'Sprint 15%' limit 1;

-- ============================================================
-- TASKS (20)
-- ============================================================
insert into tasks (id, title, stream_id, assignee_id, priority, status, due_date, estimate_hours, actual_hours) values
  -- Platform Modernisation (s1)
  (gen_random_uuid(), 'Design auth service API contract',          s1, member1_id, 'high',     'done',        '2026-03-25', 8,  7.5),
  (gen_random_uuid(), 'Implement JWT token rotation',              s1, member1_id, 'high',     'in_progress', '2026-03-30', 12, 6),
  (gen_random_uuid(), 'Extract user service from monolith',        s1, member2_id, 'critical', 'in_progress', '2026-04-05', 24, 10),
  (gen_random_uuid(), 'Write integration tests for auth service',  s1, member1_id, 'medium',   'todo',        '2026-04-08', 8,  null),
  (gen_random_uuid(), 'Set up service mesh with Istio',            s1, member2_id, 'high',     'todo',        '2026-04-10', 16, null),

  -- Mobile App v2 (s2)
  (gen_random_uuid(), 'Redesign onboarding flow',                  s2, member2_id, 'high',     'done',        '2026-03-22', 10, 9),
  (gen_random_uuid(), 'Implement push notifications',              s2, member1_id, 'medium',   'in_progress', '2026-03-31', 8,  4),
  (gen_random_uuid(), 'Fix biometric auth on Android 14',          s2, member2_id, 'critical', 'review',      '2026-03-28', 6,  7),
  (gen_random_uuid(), 'Beta TestFlight build',                     s2, manager_id, 'high',     'todo',        '2026-04-01', 4,  null),
  (gen_random_uuid(), 'Accessibility audit (WCAG 2.2)',            s2, member1_id, 'medium',   'todo',        '2026-04-07', 12, null),

  -- Data Platform (s3)
  (gen_random_uuid(), 'Schema design for events table',            s3, member2_id, 'high',     'done',        '2026-03-20', 6,  5),
  (gen_random_uuid(), 'Set up Kafka cluster on GKE',               s3, member1_id, 'high',     'in_progress', '2026-04-02', 20, 8),
  (gen_random_uuid(), 'Build Flink streaming job prototype',       s3, member2_id, 'medium',   'todo',        '2026-04-09', 16, null),

  -- Security Hardening (s4)
  (gen_random_uuid(), 'Complete vendor risk assessments',          s4, manager_id, 'high',     'in_progress', '2026-03-29', 12, 5),
  (gen_random_uuid(), 'Penetration test scope document',           s4, owner_id,   'medium',   'done',        '2026-03-21', 4,  3),
  (gen_random_uuid(), 'Enable MFA for all admin accounts',         s4, member2_id, 'critical', 'done',        '2026-03-19', 2,  2),
  (gen_random_uuid(), 'Patch CVE-2024-1234 in base images',        s4, member1_id, 'critical', 'review',      '2026-03-27', 4,  5),

  -- ML Recommendations (s6)
  (gen_random_uuid(), 'A/B test recommendation model v3',          s6, owner_id,   'high',     'done',        '2026-03-24', 8,  8),
  (gen_random_uuid(), 'Shadow-deploy model to 10% traffic',        s6, member1_id, 'high',     'in_progress', '2026-03-31', 6,  2),
  (gen_random_uuid(), 'Create model monitoring dashboard',         s6, member2_id, 'medium',   'todo',        '2026-04-06', 10, null)
returning id into t1;

-- Grab task IDs
select id into t1  from tasks where title = 'Design auth service API contract' limit 1;
select id into t2  from tasks where title = 'Implement JWT token rotation' limit 1;
select id into t3  from tasks where title = 'Extract user service from monolith' limit 1;
select id into t4  from tasks where title = 'Write integration tests for auth service' limit 1;
select id into t5  from tasks where title = 'Set up service mesh with Istio' limit 1;
select id into t6  from tasks where title = 'Redesign onboarding flow' limit 1;
select id into t7  from tasks where title = 'Implement push notifications' limit 1;
select id into t8  from tasks where title = 'Fix biometric auth on Android 14' limit 1;
select id into t9  from tasks where title = 'Beta TestFlight build' limit 1;
select id into t10 from tasks where title = 'Accessibility audit (WCAG 2.2)' limit 1;
select id into t11 from tasks where title = 'Schema design for events table' limit 1;
select id into t12 from tasks where title = 'Set up Kafka cluster on GKE' limit 1;
select id into t13 from tasks where title = 'Build Flink streaming job prototype' limit 1;
select id into t14 from tasks where title = 'Complete vendor risk assessments' limit 1;
select id into t15 from tasks where title = 'Penetration test scope document' limit 1;
select id into t16 from tasks where title = 'Enable MFA for all admin accounts' limit 1;
select id into t17 from tasks where title = 'Patch CVE-2024-1234 in base images' limit 1;
select id into t18 from tasks where title = 'A/B test recommendation model v3' limit 1;
select id into t19 from tasks where title = 'Shadow-deploy model to 10% traffic' limit 1;
select id into t20 from tasks where title = 'Create model monitoring dashboard' limit 1;

-- ============================================================
-- TASK_SPRINT assignments
-- ============================================================
insert into task_sprint (task_id, sprint_id) values
  (t1,  sp1), (t2,  sp1), (t3,  sp1), (t6,  sp1), (t7,  sp1),
  (t8,  sp1), (t11, sp1), (t14, sp1), (t15, sp1), (t16, sp1),
  (t17, sp1), (t18, sp1),
  (t4,  sp2), (t5,  sp2), (t9,  sp2), (t10, sp2), (t12, sp2),
  (t13, sp2), (t19, sp2), (t20, sp2)
on conflict do nothing;

-- ============================================================
-- KPIs (5)
-- ============================================================
insert into kpis (id, name, target, current, unit, trend, owner_id, period) values
  (gen_random_uuid(), 'Sprint Velocity',          80,   72,   'points',  'up',     manager_id, 'Q1 2026'),
  (gen_random_uuid(), 'Defect Escape Rate',        2,    3.4,  '%',       'down',   owner_id,   'Q1 2026'),
  (gen_random_uuid(), 'Deployment Frequency',      10,   8,    '/week',   'up',     member1_id, 'Q1 2026'),
  (gen_random_uuid(), 'Mean Time to Recovery',     30,   45,   'minutes', 'down',   owner_id,   'Q1 2026'),
  (gen_random_uuid(), 'Customer Satisfaction',     4.5,  4.2,  '/5',      'stable', manager_id, 'Q1 2026')
returning id into k1;

select id into k1 from kpis where name = 'Sprint Velocity' limit 1;
select id into k2 from kpis where name = 'Defect Escape Rate' limit 1;
select id into k3 from kpis where name = 'Deployment Frequency' limit 1;
select id into k4 from kpis where name = 'Mean Time to Recovery' limit 1;
select id into k5 from kpis where name = 'Customer Satisfaction' limit 1;

-- KPI historical values (last 7 days each)
insert into kpi_values (kpi_id, value, recorded_at) values
  (k1, 58, now() - interval '6 days'), (k1, 62, now() - interval '5 days'),
  (k1, 65, now() - interval '4 days'), (k1, 68, now() - interval '3 days'),
  (k1, 70, now() - interval '2 days'), (k1, 71, now() - interval '1 day'),
  (k1, 72, now()),

  (k2, 4.1, now() - interval '6 days'), (k2, 3.9, now() - interval '5 days'),
  (k2, 4.2, now() - interval '4 days'), (k2, 3.7, now() - interval '3 days'),
  (k2, 3.5, now() - interval '2 days'), (k2, 3.4, now() - interval '1 day'),
  (k2, 3.4, now()),

  (k3, 6, now() - interval '6 days'), (k3, 7, now() - interval '5 days'),
  (k3, 6, now() - interval '4 days'), (k3, 8, now() - interval '3 days'),
  (k3, 9, now() - interval '2 days'), (k3, 8, now() - interval '1 day'),
  (k3, 8, now()),

  (k4, 60, now() - interval '6 days'), (k4, 55, now() - interval '5 days'),
  (k4, 50, now() - interval '4 days'), (k4, 48, now() - interval '3 days'),
  (k4, 47, now() - interval '2 days'), (k4, 46, now() - interval '1 day'),
  (k4, 45, now()),

  (k5, 4.0, now() - interval '6 days'), (k5, 4.1, now() - interval '5 days'),
  (k5, 4.2, now() - interval '4 days'), (k5, 4.1, now() - interval '3 days'),
  (k5, 4.2, now() - interval '2 days'), (k5, 4.2, now() - interval '1 day'),
  (k5, 4.2, now());

-- ============================================================
-- RISKS (4)
-- ============================================================
insert into risks (id, title, impact, probability, severity, mitigation, owner_id, due_date, status) values
  (gen_random_uuid(),
   'Third-party payment provider outage',
   'high', 'medium',
   'Critical — revenue impact',
   'Implement fallback to secondary provider; auto-failover tested quarterly',
   owner_id, '2026-04-15', 'open'),

  (gen_random_uuid(),
   'Key engineer attrition — platform team',
   'high', 'low',
   'High — delivery risk',
   'Knowledge transfer sessions scheduled; cross-train two engineers on critical paths',
   manager_id, '2026-04-30', 'open'),

  (gen_random_uuid(),
   'SOC 2 audit finding: logging gaps',
   'medium', 'high',
   'Medium — compliance risk',
   'Centralised logging deployed to all services; evidence collected for auditor',
   owner_id, '2026-03-31', 'mitigated'),

  (gen_random_uuid(),
   'ML model bias in recommendation engine',
   'medium', 'medium',
   'Medium — reputational risk',
   'Fairness metrics added to model card; red-team review scheduled for Sprint 15',
   member1_id, '2026-04-13', 'open');

-- ============================================================
-- ACTIVITY LOGS (7-day demo activity)
-- ============================================================
insert into activity_logs (user_id, action, entity_type, entity_id, metadata, created_at) values
  (member1_id, 'task.updated',  'task',   t1,  '{"status":"done"}',                     now() - interval '6 days' + interval '9 hours'),
  (member2_id, 'task.created',  'task',   t3,  '{"title":"Extract user service"}',       now() - interval '6 days' + interval '10 hours'),
  (owner_id,   'stream.updated','stream', s6,  '{"progress":75}',                        now() - interval '5 days' + interval '11 hours'),
  (manager_id, 'risk.created',  'risk',   null,'{"title":"Key engineer attrition"}',     now() - interval '5 days' + interval '14 hours'),
  (member1_id, 'task.updated',  'task',   t16, '{"status":"done"}',                     now() - interval '4 days' + interval '9 hours'),
  (member2_id, 'task.updated',  'task',   t8,  '{"status":"review"}',                   now() - interval '4 days' + interval '16 hours'),
  (owner_id,   'kpi.updated',   'kpi',    k1,  '{"current":70}',                         now() - interval '3 days' + interval '10 hours'),
  (manager_id, 'task.created',  'task',   t9,  '{"title":"Beta TestFlight build"}',      now() - interval '3 days' + interval '13 hours'),
  (member1_id, 'task.updated',  'task',   t17, '{"status":"review"}',                   now() - interval '2 days' + interval '9 hours'),
  (member2_id, 'stream.updated','stream', s1,  '{"progress":68}',                        now() - interval '2 days' + interval '15 hours'),
  (owner_id,   'risk.updated',  'risk',   null,'{"status":"mitigated"}',                 now() - interval '1 day'  + interval '10 hours'),
  (member1_id, 'task.updated',  'task',   t18, '{"status":"done"}',                     now() - interval '1 day'  + interval '11 hours'),
  (manager_id, 'sprint.created','sprint', sp2, '{"name":"Sprint 15"}',                   now() - interval '12 hours'),
  (member2_id, 'task.updated',  'task',   t11, '{"status":"done"}',                     now() - interval '8 hours'),
  (owner_id,   'kpi.updated',   'kpi',    k3,  '{"current":8}',                          now() - interval '2 hours');

end $$;
