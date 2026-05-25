-- ────────────────────────────────────────────────────────────────────────────
-- Drop temporary anon RLS policies (tail of Fix #1: Re-enable Google OAuth)
-- ────────────────────────────────────────────────────────────────────────────
-- When the auth gate in App.jsx was bypassed, these anon policies were added
-- as a safety net so the live site kept working without a logged-in user.
--
-- Now that:
--   1. Google OAuth is verified working (2026-05-25, cz@cloudscenic.com + 2nd account)
--   2. The auth gate is restored in commit 8e5095e
--   3. Authenticated-admin policies are in place (20260525_admin_rls_for_oauth.sql)
--
-- …these anon policies are pure security debt. Anyone with the anon key (which
-- ships in the client bundle) can currently read agent_events, notifications,
-- clients, and write to client-logos. This migration closes that hole.
--
-- After this runs, ALL access to these tables/buckets requires a valid
-- authenticated session with an @cloudscenic.com email.
-- ────────────────────────────────────────────────────────────────────────────

-- agent_events ───────────────────────────────────────────────────────────────
drop policy if exists "anon read while auth bypassed (TODO remove)" on public.agent_events;

-- notifications ──────────────────────────────────────────────────────────────
drop policy if exists "anon read while auth bypassed (TODO remove)" on public.notifications;
drop policy if exists "anon update while auth bypassed (TODO remove)" on public.notifications;

-- clients ────────────────────────────────────────────────────────────────────
drop policy if exists "anon read clients (TODO remove)" on public.clients;
drop policy if exists "anon write clients (TODO remove)" on public.clients;

-- storage.objects (client-logos bucket) ──────────────────────────────────────
-- Public read policy is kept — logos are meant to be publicly visible.
-- Write policies are now admin-only via 20260525_admin_rls_for_oauth.sql.
drop policy if exists "Anon upload client-logos (TODO restrict to admins when auth back)" on storage.objects;
drop policy if exists "Anon update client-logos (TODO restrict to admins when auth back)" on storage.objects;
drop policy if exists "Anon delete client-logos (TODO restrict to admins when auth back)" on storage.objects;

-- ────────────────────────────────────────────────────────────────────────────
-- After this migration, remaining policies on these tables/buckets:
--
--   public.agent_events:
--     • "admins read all" (auth.jwt() email like '%@cloudscenic.com')
--     (service_role bypasses RLS for inserts from netlify functions)
--
--   public.notifications:
--     • "admins read all"
--     • "admins update own"
--     (service_role bypasses RLS for inserts)
--
--   public.clients:
--     • "admins read clients"
--     • "admins write clients"
--
--   storage.objects (client-logos):
--     • "Public read client-logos"     (kept — logos are public)
--     • "Admins upload client-logos"   (from 20260525_admin_rls_for_oauth.sql)
--     • "Admins update client-logos"
--     • "Admins delete client-logos"
-- ────────────────────────────────────────────────────────────────────────────
