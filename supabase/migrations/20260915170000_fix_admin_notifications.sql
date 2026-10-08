-- Migration: Fix Admin Notifications schema, indexes and RLS policies
-- Date: 2026-09-15

-- 1. Ensure table exists with all required columns
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

-- Ensure all columns exist if table was already created
alter table public.notifications
add column if not exists type text not null default 'info';

alter table public.notifications
add column if not exists is_read boolean not null default false;

alter table public.notifications
add column if not exists created_at timestamptz not null default now();

alter table public.notifications
add column if not exists entity_type text;

alter table public.notifications
add column if not exists entity_id uuid;

alter table public.notifications
add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2. Indexes for fast query and duplicate prevention
create unique index if not exists notifications_unique_entity_per_user
on public.notifications(user_id, entity_type, entity_id, type)
where entity_id is not null;

create index if not exists notifications_user_unread_idx
on public.notifications(user_id, is_read, created_at desc);

create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

-- 3. Enable RLS and define strict Admin policies
alter table public.notifications enable row level security;

drop policy if exists notifications_admin_read on public.notifications;
drop policy if exists notifications_admin_update on public.notifications;
drop policy if exists notifications_admin_delete on public.notifications;
drop policy if exists notifications_admin_insert on public.notifications;
drop policy if exists "Users can read their own notifications" on public.notifications;
drop policy if exists "Users can update their own notifications" on public.notifications;

-- Active admin can read their own notifications
create policy notifications_admin_read
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  )
);

-- Active admin can update their own notification read status
create policy notifications_admin_update
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  )
)
with check (
  user_id = auth.uid()
);

-- Active admin can delete their own notifications
create policy notifications_admin_delete
on public.notifications
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  )
);

-- Ensure Realtime is enabled for notifications table
alter publication supabase_realtime add table public.notifications;
