-- Client Scope / Fulfillment model (Fulfillment OS, Phase 3).
--
-- The clients table holds identity + brand voice. This adds the *scope* layer —
-- the "Service Library (ceiling) vs Fulfillment Engine (floor)" model: which
-- services a client actually pays for, their cadence, who approves, their retainer,
-- contacts, and health. This is what makes `in_scope` on a deliverable meaningful
-- and powers per-client fulfillment.
--
-- Additive + idempotent. Non-destructive — only ADD COLUMN. Apply in the Vantus
-- Supabase SQL editor (project wjcstqqihtebkpyuacop).

alter table public.clients add column if not exists lane                text default 'recurring'
  check (lane in ('recurring', 'brief'));                      -- recurring retainer vs project/brief-driven
alter table public.clients add column if not exists service_scope       jsonb default '[]'::jsonb;   -- ["Content","Reels","Stories","Graphics","Ads",...] — what they pay for
alter table public.clients add column if not exists cadence             text;                        -- e.g. "1 shoot/mo · 2 reels/wk · 2 stories/wk"
alter table public.clients add column if not exists approval_rule       text default 'internal'
  check (approval_rule in ('auto', 'internal', 'client'));     -- default approval mode for this client's deliverables
alter table public.clients add column if not exists retainer_amount     numeric;                     -- monthly retainer ($)
alter table public.clients add column if not exists retainer_status     text default 'active'
  check (retainer_status in ('active', 'pending', 'none'));
alter table public.clients add column if not exists contacts            jsonb default '[]'::jsonb;    -- [{name, role, email}] — beyond primary_email
alter table public.clients add column if not exists onboarding_progress integer;                     -- 0–100; ClientsRoute setupScore prefers this when set
alter table public.clients add column if not exists health              text default 'green'
  check (health in ('green', 'amber', 'red'));
alter table public.clients add column if not exists notes               text;

-- Sanity check (run after applying):
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='clients' order by ordinal_position;
