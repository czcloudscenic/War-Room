-- ────────────────────────────────────────────────────────────────────────────
-- team_members.monthly_cost — the cost basis for the per-client net-margin
-- view (M6). Margin = client retainer − each member's monthly cost allocated
-- across the clients they delivered for (proportional to delivered items in
-- the window). Entered on the Setup page team roster editor.
--
-- Privacy: team_members RLS is already admin-only (20260630_operations.sql) —
-- clients and anon read zero rows, so pay data never leaves the admin session.
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor BEFORE
-- deploying the matching app code.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.team_members add column if not exists monthly_cost numeric;

-- Sanity check (run after applying):
-- select name, monthly_cost from public.team_members order by name;
