-- Migration: Add avatar_url column to admin_users and sync admin profile data
-- PART 1: Alter admin_users table to add avatar_url

alter table public.admin_users
add column if not exists avatar_url text;

-- Add check constraint for avatar_url format if provided
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_users_avatar_url_check'
  ) then
    alter table public.admin_users
    add constraint admin_users_avatar_url_check
    check (avatar_url is null or avatar_url ~* '^https?://');
  end if;
end $$;

-- Enable RLS (ensured)
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

-- RLS Policies for admin_users
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read
on public.admin_users
for select
using (
  (lower(email) = lower(coalesce(auth.jwt()->>'email', '')) and is_active = true)
  or user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists admin_users_self_update on public.admin_users;
create policy admin_users_self_update
on public.admin_users
for update
using (
  (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email', '')))
  and is_active = true
)
with check (
  (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email', '')))
  and is_active = true
);

drop policy if exists admin_users_admin_manage on public.admin_users;
create policy admin_users_admin_manage
on public.admin_users
for all
using (public.is_admin())
with check (public.is_admin());

-- PART 2: Sync existing admins without overwriting existing custom values

-- 1. Sync from auth.users & profiles for current admin emails
insert into public.admin_users (user_id, email, display_name, avatar_url, is_active)
select
  u.id,
  lower(u.email),
  coalesce(
    nullif(p.display_name, ''),
    nullif(u.raw_user_meta_data->>'display_name', ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(lower(u.email), '@', 1)
  ),
  coalesce(
    nullif(p.avatar_url, ''),
    nullif(u.raw_user_meta_data->>'avatar_url', ''),
    nullif(u.raw_user_meta_data->>'picture', '')
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
  display_name = coalesce(nullif(admin_users.display_name, ''), excluded.display_name),
  avatar_url = coalesce(nullif(admin_users.avatar_url, ''), excluded.avatar_url),
  updated_at = now();

-- 2. Seed fallback entries for any admin not yet registered in auth.users
insert into public.admin_users (email, display_name, is_active)
values
  ('asik.devhub@gmail.com', 'Asik Devhub', true),
  ('ayatulsekh3037@gmail.com', 'Ayatul Sekh', true),
  ('asikikbal@gmail.com', 'Asik Ikbal', true)
on conflict (email) do update set
  display_name = coalesce(nullif(admin_users.display_name, ''), excluded.display_name),
  updated_at = now();

-- 3. Backfill avatar_url and display_name from profiles if admin_users fields are empty
update public.admin_users a
set
  user_id = coalesce(a.user_id, p.id),
  display_name = coalesce(nullif(a.display_name, ''), nullif(p.display_name, ''), split_part(a.email, '@', 1)),
  avatar_url = coalesce(nullif(a.avatar_url, ''), nullif(p.avatar_url, '')),
  updated_at = now()
from public.profiles p
where (a.user_id = p.id or lower(a.email) = lower(p."Gmail"))
  and (a.avatar_url is null or a.display_name is null or a.display_name = '');

-- 4. Update trigger function to sync avatar_url on new admin signups
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  raw_name text;
  raw_avatar text;
  is_admin_email boolean;
begin
  raw_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );

  raw_avatar := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'picture', '')
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
    raw_avatar,
    case when is_admin_email then 'admin'::public.user_role else 'user'::public.user_role end,
    true
  )
  on conflict (id) do update set
    "Gmail" = excluded."Gmail",
    display_name = coalesce(nullif(profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(nullif(profiles.avatar_url, ''), excluded.avatar_url),
    role = case when is_admin_email then 'admin'::public.user_role else profiles.role end,
    updated_at = now();

  -- If user is admin, link user_id & initial metadata in admin_users without clobbering existing custom values
  if is_admin_email then
    insert into public.admin_users (user_id, email, display_name, avatar_url, is_active)
    values (new.id, lower(new.email), raw_name, raw_avatar, true)
    on conflict (email) do update set
      user_id = excluded.user_id,
      display_name = coalesce(nullif(admin_users.display_name, ''), excluded.display_name),
      avatar_url = coalesce(nullif(admin_users.avatar_url, ''), excluded.avatar_url),
      updated_at = now();
  end if;

  return new;
end;
$$;
