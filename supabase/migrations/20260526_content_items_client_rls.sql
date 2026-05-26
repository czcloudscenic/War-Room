-- Fix #10.1 — close the content_items security gap surfaced by Fix #10.
--
-- Before: a legacy "Allow all for now" policy on content_items granted
-- using=true for ALL commands to role=public. Anonymous callers with the
-- anon key could read AND write the table. The cleanup of temp anon
-- policies on 2026-05-25 (commit 852d915) missed this one because
-- content_items had no migration file to be touched.
--
-- After: external approved clients get RLS-scoped SELECT + UPDATE on
-- only the rows belonging to their client_id(s). Admins keep their full
-- read+write policy. The wide-open policy is dropped.
--
-- RLS check pattern matches client_users own policy: case-insensitive
-- email lookup, status='approved' required.
--
-- ⚠️ TEST AFTER APPLYING (in this order):
--   1. Sign in as admin (@cloudscenic.com) → verify the content tracker
--      still loads + edits + creates new content as normal.
--   2. Sign in as an approved external client (e.g. Natalia at VitalLyfe)
--      → verify her ClientView still shows VitalLyfe content and the
--      Approve / Needs Revisions buttons still persist a status change.
--   3. Open a private/incognito tab without logging in and try to load
--      https://wjcstqqihtebkpyuacop.supabase.co/rest/v1/content_items
--      with just the anon key as apikey → should now return 0 rows
--      (previously returned all rows).

-- ── Scoped SELECT for approved external clients ──
-- "I can read content_items rows whose client_id is on a row in
--  client_users that has my email and status='approved'."
drop policy if exists "clients read scoped content_items" on public.content_items;
create policy "clients read scoped content_items"
  on public.content_items for select
  using (
    exists (
      select 1
      from public.client_users cu
      where lower(cu.email) = lower(auth.jwt() ->> 'email')
        and cu.status = 'approved'
        and cu.client_id = content_items.client_id
    )
  );

-- ── Scoped UPDATE for approved external clients ──
-- Same row qualifier; with_check prevents a malicious client from
-- re-parenting a row to a different client_id (i.e. they can update the
-- row's status/client_note/etc., but they can't change client_id to
-- escape their scope).
drop policy if exists "clients update scoped content_items" on public.content_items;
create policy "clients update scoped content_items"
  on public.content_items for update
  using (
    exists (
      select 1
      from public.client_users cu
      where lower(cu.email) = lower(auth.jwt() ->> 'email')
        and cu.status = 'approved'
        and cu.client_id = content_items.client_id
    )
  )
  with check (
    exists (
      select 1
      from public.client_users cu
      where lower(cu.email) = lower(auth.jwt() ->> 'email')
        and cu.status = 'approved'
        and cu.client_id = content_items.client_id
    )
  );

-- INSERT and DELETE remain admin-only. If the external-client UI ever
-- needs to add content (it currently doesn't — only approve/reject),
-- add a similar "clients insert scoped" policy then.

-- ── DROP THE WIDE-OPEN POLICY ──
-- After this lands, anon + unauthenticated requests return zero rows.
drop policy if exists "Allow all for now" on public.content_items;

-- Sanity check — should list only admin policies + the two new client
-- policies. (Run after the migration.)
-- select policyname, cmd, roles from pg_policies
-- where schemaname = 'public' and tablename = 'content_items'
-- order by policyname;
