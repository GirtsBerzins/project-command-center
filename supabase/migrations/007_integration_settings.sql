create table if not exists public.integration_settings (
  id integer primary key default 1 check (id = 1),
  settings_json jsonb not null default '{}'::jsonb,
  encrypted_fields text[] not null default '{}'::text[],
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.integration_settings enable row level security;

drop policy if exists "integration_settings_select_owner_manager" on public.integration_settings;
create policy "integration_settings_select_owner_manager"
on public.integration_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'manager')
  )
);

drop policy if exists "integration_settings_insert_owner_manager" on public.integration_settings;
create policy "integration_settings_insert_owner_manager"
on public.integration_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'manager')
  )
);

drop policy if exists "integration_settings_update_owner_manager" on public.integration_settings;
create policy "integration_settings_update_owner_manager"
on public.integration_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'manager')
  )
);
