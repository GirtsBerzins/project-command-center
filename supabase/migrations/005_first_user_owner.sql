-- ============================================================
-- FIRST USER IS OWNER
-- ============================================================

-- Keep signup trigger aligned and make bootstrap ownership deterministic.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  has_owner boolean;
begin
  select exists(select 1 from public.profiles where role = 'owner') into has_owner;

  insert into public.profiles (id, full_name, avatar_url, email, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    case when has_owner then 'member' else 'owner' end
  );

  return new;
end;
$$;

-- One-time backfill: if environment has no owner yet, promote the earliest profile.
with first_profile as (
  select id
  from public.profiles
  order by created_at asc
  limit 1
)
update public.profiles
set role = 'owner'
where id in (select id from first_profile)
  and not exists (select 1 from public.profiles where role = 'owner');
