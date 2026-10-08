-- Migration: Add image_url column to public.feedback and configure feedback-images storage bucket
alter table public.feedback
  add column if not exists image_url text;

-- Storage Bucket setup reference:
-- Bucket: feedback-images (public: true, max_file_size: 5242880, allowed_mime_types: {'image/jpeg','image/png','image/webp'})
-- Storage RLS policy:
-- 1. Users can upload to their own folder: (bucket_id = 'feedback-images' AND auth.uid()::text = (storage.foldername(name))[1])
-- 2. Public read access for feedback-images: (bucket_id = 'feedback-images')
