-- Migration: Create admin_users table, RLS policies, trigger and seed initial admins
-- Part 1: admin_users Table

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique index on lowercase email
create unique index if not exists admin_users_email_lower_idx
on public.admin_users (lower(email));

-- Enable RLS
alter table public.admin_users enable row level security;

-- Helper security definer function for admin checking (prevents recursive RLS)
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  ) or exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;

-- RLS Policies
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read
on public.admin_users
for select
using (
  (lower(email) = lower(coalesce(auth.jwt()->>'email', '')) and is_active = true)
  or user_id = auth.uid()
);

drop policy if exists admin_users_admin_manage on public.admin_users;
create policy admin_users_admin_manage
on public.admin_users
for all
using (public.is_admin())
with check (public.is_admin());

-- Auto set updated_at trigger
drop trigger if exists set_admin_users_updated_at on public.admin_users;
create trigger set_admin_users_updated_at
before update on public.admin_users
for each row execute procedure public.set_updated_at();

-- Part 2: Seed Initial Admins from auth.users and profiles
insert into public.admin_users (user_id, email, display_name, is_active)
select
  u.id,
  lower(u.email),
  coalesce(
    nullif(p.display_name, ''),
    nullif(u.raw_user_meta_data->>'display_name', ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    split_part(lower(u.email), '@', 1)
  ),
  true
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) in (
  'asik.devhub@gmail.com',
  'ayatulsekh3037@gmail.com',
  'asikikbal@gmail.com'
)
on conflict (email) do update set
  user_id = coalesce(excluded.user_id, admin_users.user_id),
  updated_at = now();

-- Ensure all 3 admin emails exist even if not yet in auth.users
insert into public.admin_users (email, display_name, is_active)
values
  ('asik.devhub@gmail.com', 'Asik Devhub', true),
  ('ayatulsekh3037@gmail.com', 'Ayatul Sekh', true),
  ('asikikbal@gmail.com', 'Asik Ikbal', true)
on conflict (email) do nothing;

-- Ensure profiles for these admins have role = 'admin'
update public.profiles
set role = 'admin', updated_at = now()
where lower("Gmail") in (
  'asik.devhub@gmail.com',
  'ayatulsekh3037@gmail.com',
  'asikikbal@gmail.com'
) or id in (
  select user_id from public.admin_users where user_id is not null
);

-- Part 10: Updated handle_new_user trigger to preserve display_name and handle admin role safely
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  raw_name text;
  is_admin_email boolean;
begin
  raw_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );

  is_admin_email := lower(new.email) in (
    'asik.devhub@gmail.com',
    'ayatulsekh3037@gmail.com',
    'asikikbal@gmail.com'
  );

  insert into public.profiles (id, "Gmail", display_name, avatar_url, role, is_active)
  values (
    new.id,
    new.email,
    raw_name,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    case when is_admin_email then 'admin'::public.user_role else 'user'::public.user_role end,
    true
  )
  on conflict (id) do update set
    "Gmail" = excluded."Gmail",
    display_name = coalesce(nullif(profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(profiles.avatar_url, excluded.avatar_url),
    role = case when is_admin_email then 'admin'::public.user_role else profiles.role end,
    updated_at = now();

  -- If user is admin, link user_id in admin_users
  if is_admin_email then
    insert into public.admin_users (user_id, email, display_name, is_active)
    values (new.id, lower(new.email), raw_name, true)
    on conflict (email) do update set
      user_id = excluded.user_id,
      updated_at = now();
  end if;

  return new;
end;
$$;
