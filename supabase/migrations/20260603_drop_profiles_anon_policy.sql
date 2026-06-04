-- Drop overly broad profiles RLS policy — 2026-06-03
-- Apply: paste into Supabase SQL editor and run.

drop policy if exists "Service role full access" on public.profiles;
