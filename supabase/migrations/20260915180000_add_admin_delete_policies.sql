-- Migration: Add Admin Delete Policies for Feedback and Contact Messages
-- Ensures only active admins and moderators can delete feedback and contact messages,
-- while public/anon visitors and normal authenticated users are forbidden from deletion.

-- 1. Drop existing duplicate or legacy delete policies if any
drop policy if exists feedback_admin_delete on public.feedback;
drop policy if exists contact_messages_admin_delete on public.contact_messages;
drop policy if exists feedback_delete on public.feedback;
drop policy if exists contact_delete on public.contact_messages;

-- 2. Ensure Row Level Security is explicitly enabled on both tables
alter table public.feedback enable row level security;
alter table public.contact_messages enable row level security;

-- 3. Create Delete Policy for public.feedback
-- Only active administrators or moderators can permanently delete feedback entries
create policy feedback_admin_delete
on public.feedback
for delete
to authenticated
using (
  public.is_admin_or_moderator()
);

-- 4. Create Delete Policy for public.contact_messages
-- Only active administrators or moderators can permanently delete contact messages
create policy contact_messages_admin_delete
on public.contact_messages
for delete
to authenticated
using (
  public.is_admin_or_moderator()
);

-- 5. Storage RLS policy for deleting feedback attachments
-- Ensures admins can delete feedback attachments from feedback-images bucket if needed
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects'
  ) then
    drop policy if exists "Admin delete feedback images" on storage.objects;
    create policy "Admin delete feedback images"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'feedback-images' and public.is_admin_or_moderator()
    );
  end if;
end $$;
