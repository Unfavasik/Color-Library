-- Migration: Add email and type columns to public.feedback
alter table public.feedback
  add column if not exists email text,
  add column if not exists type text default 'general';
