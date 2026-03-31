-- ============================================================
-- ADD EMAIL TO PROFILES
-- ============================================================

alter table profiles
  add column if not exists email text;

create index if not exists profiles_email_idx on profiles(email);

-- Keep signup trigger aligned with current schema
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  return new;
end;
$$;

-- Backfill email for existing users
update profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email <> u.email);

