-- Migration: Add subject to feedback table and ensure notifications columns exist
-- Date: 2026-09-16

alter table public.feedback
add column if not exists subject text;

alter table public.notifications
add column if not exists entity_type text;

alter table public.notifications
add column if not exists entity_id uuid;

alter table public.notifications
add column if not exists metadata jsonb not null default '{}'::jsonb;
