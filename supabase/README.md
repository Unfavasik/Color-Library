# Colour App Supabase Database

This directory contains the production database schema for Colour App.

## Access model

- **Public visitors** can read active public colours, categories, public palettes and public gradients, and can submit feedback/contact messages.
- **Authenticated users** can manage only their own profile, saved colours, private palettes, palette items, mix sessions, gradients, notifications and activity records.
- **Moderators** can manage colour catalogues and review feedback/contact messages.
- **Admins** can manage users, all catalogue/content records, permissions, settings, notifications and audit visibility.
- All application tables have **Row Level Security enabled**. Privilege checks are enforced through database functions and policies, not only through the UI.

The migration is also applied to Supabase project `arehjyrgvbzlxiivwuix` in region `ap-south-1`.
