-- Colour App: production schema, roles, RLS, indexes, and audit automation
create extension if not exists pgcrypto;

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.color_visibility as enum ('public', 'private', 'unlisted');
create type public.feedback_status as enum ('new', 'in_review', 'resolved', 'closed');
create type public.contact_status as enum ('new', 'in_progress', 'resolved', 'spam');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  role public.user_role not null default 'user',
  is_active boolean not null default true,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.color_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  hex_code text not null check (hex_code ~ '^#[0-9A-Fa-f]{6}$'),
  rgb jsonb not null default '{}'::jsonb,
  hsl jsonb not null default '{}'::jsonb,
  cmyk jsonb not null default '{}'::jsonb,
  description text,
  category_id uuid references public.color_categories(id) on delete set null,
  visibility public.color_visibility not null default 'public',
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_colors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  color_id uuid not null references public.colors(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, color_id)
);

create table public.palettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  visibility public.color_visibility not null default 'private',
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.palette_colors (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  color_id uuid not null references public.colors(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (palette_id, color_id)
);

create table public.color_mix_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  input_colors jsonb not null default '[]'::jsonb,
  output_color jsonb not null default '{}'::jsonb,
  name text,
  created_at timestamptz not null default now()
);

create table public.gradients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text not null default 'linear' check (type in ('linear', 'radial', 'conic')),
  angle numeric not null default 90,
  color_stops jsonb not null default '[]'::jsonb,
  css_value text,
  visibility public.color_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  page_url text,
  rating integer check (rating between 1 and 5),
  message text not null,
  status public.feedback_status not null default 'new',
  admin_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status public.contact_status not null default 'new',
  admin_note text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null check (permission in ('manage_users', 'manage_colors', 'manage_palettes', 'manage_feedback', 'manage_contacts', 'manage_settings', 'view_analytics')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, permission)
);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin_or_moderator()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator') and is_active = true);
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active = true);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','color_categories','colors','palettes','gradients','feedback','contact_messages'] loop
    execute format('create trigger set_%s_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  end loop;
end $$;

create index colors_category_id_idx on public.colors(category_id);
create index colors_visibility_active_idx on public.colors(visibility, is_active);
create index saved_colors_user_id_idx on public.saved_colors(user_id);
create index palettes_user_id_idx on public.palettes(user_id);
create index palette_colors_palette_id_idx on public.palette_colors(palette_id);
create index mix_sessions_user_id_idx on public.color_mix_sessions(user_id);
create index gradients_user_id_idx on public.gradients(user_id);
create index feedback_status_idx on public.feedback(status);
create index contact_status_idx on public.contact_messages(status);
create index notifications_user_read_idx on public.notifications(user_id, is_read);
create index activity_logs_user_created_idx on public.activity_logs(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.color_categories enable row level security;
alter table public.colors enable row level security;
alter table public.saved_colors enable row level security;
alter table public.palettes enable row level security;
alter table public.palette_colors enable row level security;
alter table public.color_mix_sessions enable row level security;
alter table public.gradients enable row level security;
alter table public.feedback enable row level security;
alter table public.contact_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.site_settings enable row level security;

create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin_or_moderator());
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy categories_public_read on public.color_categories for select using (is_active = true or public.is_admin_or_moderator());
create policy categories_admin_manage on public.color_categories for all using (public.is_admin_or_moderator()) with check (public.is_admin_or_moderator());

create policy colors_public_read on public.colors for select using ((visibility = 'public' and is_active = true) or created_by = auth.uid() or public.is_admin_or_moderator());
create policy colors_user_create on public.colors for insert with check (created_by = auth.uid() and visibility <> 'public');
create policy colors_owner_update on public.colors for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy colors_admin_manage on public.colors for all using (public.is_admin_or_moderator()) with check (public.is_admin_or_moderator());

create policy saved_colors_owner_all on public.saved_colors for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy palettes_read on public.palettes for select using (user_id = auth.uid() or visibility = 'public' or public.is_admin_or_moderator());
create policy palettes_owner_manage on public.palettes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy palette_colors_read on public.palette_colors for select using (exists (select 1 from public.palettes p where p.id = palette_id and (p.user_id = auth.uid() or p.visibility = 'public' or public.is_admin_or_moderator())));
create policy palette_colors_owner_manage on public.palette_colors for all using (exists (select 1 from public.palettes p where p.id = palette_id and p.user_id = auth.uid())) with check (exists (select 1 from public.palettes p where p.id = palette_id and p.user_id = auth.uid()));

create policy mix_owner_read_write on public.color_mix_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gradients_read on public.gradients for select using (user_id = auth.uid() or visibility = 'public' or public.is_admin_or_moderator());
create policy gradients_owner_manage on public.gradients for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy feedback_submit on public.feedback for insert with check (user_id = auth.uid() or user_id is null);
create policy feedback_owner_read on public.feedback for select using (user_id = auth.uid() or public.is_admin_or_moderator());
create policy feedback_admin_manage on public.feedback for update using (public.is_admin_or_moderator()) with check (public.is_admin_or_moderator());

create policy contact_submit on public.contact_messages for insert with check (user_id = auth.uid() or user_id is null);
create policy contact_owner_read on public.contact_messages for select using (user_id = auth.uid() or public.is_admin_or_moderator());
create policy contact_admin_manage on public.contact_messages for update using (public.is_admin_or_moderator()) with check (public.is_admin_or_moderator());

create policy notifications_owner_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_owner_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_admin_create on public.notifications for insert with check (public.is_admin_or_moderator());
create policy notifications_admin_delete on public.notifications for delete using (public.is_admin_or_moderator());

create policy activity_owner_read on public.activity_logs for select using (user_id = auth.uid() or public.is_admin_or_moderator());
create policy activity_owner_insert on public.activity_logs for insert with check (user_id = auth.uid() or public.is_admin_or_moderator());

create policy permissions_admin_read on public.admin_permissions for select using (user_id = auth.uid() or public.is_admin());
create policy permissions_admin_manage on public.admin_permissions for all using (public.is_admin()) with check (public.is_admin());
create policy settings_public_read on public.site_settings for select using (true);
create policy settings_admin_manage on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (key, value, description) values
('app_name', '"Colour App"'::jsonb, 'Application name'),
('maintenance_mode', 'false'::jsonb, 'Enable maintenance mode'),
('default_color_visibility', '"public"'::jsonb, 'Default visibility for admin-created colours')
on conflict (key) do nothing;
