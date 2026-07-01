-- Close the agent_events anon-read leak (same class as the clients roster leak).
--
-- agent_events still carries "anon read while auth bypassed (TODO remove)" using(true),
-- so all agent activity (per client) is readable with just the anon key. Drop it;
-- admins keep full read, and an approved external client can read only its own
-- client's events.
--
-- ⚠️ TEST AFTER APPLYING: the live activity feed still populates for an admin
--    (it reads agent_events with the admin JWT, so the admin policy covers it).

drop policy if exists "anon read while auth bypassed (TODO remove)" on public.agent_events;

drop policy if exists "clients read scoped agent_events" on public.agent_events;
create policy "clients read scoped agent_events"
  on public.agent_events for select
  using (
    exists (
      select 1 from public.client_users cu
      where lower(cu.email) = lower(auth.jwt() ->> 'email')
        and cu.status = 'approved'
        and cu.client_id = agent_events.client_id
    )
  );

-- (The "admins read all" policy from 20260523_agent_events.sql remains — @cloudscenic.com
--  keeps full access. Writes come from the agent-action function via the service key,
--  which bypasses RLS, so this doesn't affect agent output.)
