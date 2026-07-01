-- Close the last anon-read leak: notifications.
--
-- notifications still carries the legacy "anon read/update while auth bypassed
-- (TODO remove)" policies (both using(true)) from 20260523_notifications.sql —
-- 20260525_drop_temp_anon_policies.sql dropped these for agent_events/clients but
-- missed this table, so notification content is readable with just the anon key.
--
-- notifications is admin-facing only (no client_id, internal alerts), and the
-- "admins read all" / "admins update own" policies already exist — so this is
-- purely dropping the leak. Writes come from notify.js via the service key
-- (bypasses RLS), so the bell/notifications keep working.
--
-- ⚠️ TEST AFTER APPLYING: signed-in admin still sees the notification bell populate.

drop policy if exists "anon read while auth bypassed (TODO remove)"   on public.notifications;
drop policy if exists "anon update while auth bypassed (TODO remove)" on public.notifications;

-- Verify: select policyname, cmd from pg_policies where tablename='notifications';
--   → should list only "admins read all" + "admins update own".
