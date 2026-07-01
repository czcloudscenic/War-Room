-- Lock the client roster to Cloud Scenic only.
--
-- The clients table still carries the legacy wide-open policies from when OAuth was
-- bypassed — "anon read/write clients (TODO remove)", both using(true) — which let
-- ANYONE with the anon key read and write EVERY client. OAuth is live now, so these
-- are pure security debt and a roster leak.
--
-- After this: admins (@cloudscenic.com) read + write all clients; an approved
-- external client can read ONLY its own client row (for branding); everyone else
-- sees nothing. The full roster is Cloud-Scenic-only.
--
-- ⚠️ TEST AFTER APPLYING: sign in as admin → Clients still loads, Add/Edit still
-- works. (If admin access breaks, the JWT email claim isn't landing — re-check auth.)

drop policy if exists "anon read clients (TODO remove)"  on public.clients;
drop policy if exists "anon write clients (TODO remove)" on public.clients;

-- Approved external client may read ONLY its own client row — never the roster.
drop policy if exists "clients read own row" on public.clients;
create policy "clients read own row"
  on public.clients for select
  using (
    exists (
      select 1 from public.client_users cu
      where lower(cu.email) = lower(auth.jwt() ->> 'email')
        and cu.status = 'approved'
        and cu.client_id = clients.id
    )
  );

-- (The "admins read clients" + "admins write clients" policies from
--  20260523_clients_multitenant.sql remain in force — @cloudscenic.com full access.)

-- Verify:
-- select policyname, cmd from pg_policies where schemaname='public' and tablename='clients' order by policyname;
