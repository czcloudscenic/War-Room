-- ────────────────────────────────────────────────────────────────────────────
-- Authenticated-admin RLS policies for OAuth re-enable
-- ────────────────────────────────────────────────────────────────────────────
-- When Google OAuth was bypassed, anon read/write policies covered the gap.
-- Now that auth is back, authenticated @cloudscenic.com users need explicit
-- read/write access to the data tables (otherwise existing 'auth.uid() = id'
-- style policies reject them).
--
-- This migration:
--   1. Adds "admins read/write all" policies for content_items + profiles
--      (matches the pattern already used on agent_events / notifications /
--      clients via auth.jwt() ->> 'email' like '%@cloudscenic.com')
--   2. Storage bucket policies same pattern
-- ────────────────────────────────────────────────────────────────────────────

-- content_items ───────────────────────────────────────────────────────────────
-- (Table exists in live Supabase without a migration file — we just add policies.)
alter table public.content_items enable row level security;

drop policy if exists "admins read content_items" on public.content_items;
create policy "admins read content_items"
  on public.content_items for select
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com');

drop policy if exists "admins write content_items" on public.content_items;
create policy "admins write content_items"
  on public.content_items for all
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com')
  with check (auth.jwt() ->> 'email' like '%@cloudscenic.com');

-- profiles ────────────────────────────────────────────────────────────────────
-- Existing 002_profiles.sql only lets users read their OWN row.
-- Admins need to read all profiles to populate the team view.
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles"
  on public.profiles for select
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com');

-- Storage: client-logos bucket ────────────────────────────────────────────────
-- Promote temp anon policies to authenticated-admin variants.
drop policy if exists "Admins upload client-logos" on storage.objects;
create policy "Admins upload client-logos"
  on storage.objects for insert
  with check (bucket_id = 'client-logos' and auth.jwt() ->> 'email' like '%@cloudscenic.com');

drop policy if exists "Admins update client-logos" on storage.objects;
create policy "Admins update client-logos"
  on storage.objects for update
  using (bucket_id = 'client-logos' and auth.jwt() ->> 'email' like '%@cloudscenic.com');

drop policy if exists "Admins delete client-logos" on storage.objects;
create policy "Admins delete client-logos"
  on storage.objects for delete
  using (bucket_id = 'client-logos' and auth.jwt() ->> 'email' like '%@cloudscenic.com');

-- ────────────────────────────────────────────────────────────────────────────
-- NB: The temporary anon policies on agent_events / notifications / clients /
-- client-logos / etc. are LEFT IN PLACE intentionally. The auth bypass in
-- App.jsx is still active (just removed); leaving anon policies as a safety
-- net during the transition.
--
-- Once auth is verified working for cz/dv/ss@cloudscenic.com in production,
-- run a separate migration to DROP all the "anon ... (TODO remove)" policies
-- (see docs/architecture-map/open-items.md → "Cross-cutting work").
-- ────────────────────────────────────────────────────────────────────────────
