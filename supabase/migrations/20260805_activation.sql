-- ── Phase A (v3 spec) — activation data model ────────────────────────────────
-- Everything else the activation checklist reads already exists (retainer_amount,
-- cadence/posts_per_week, approval_rule, client_facts, report_schedule,
-- assigned_to/due_date). Three genuine gaps:
--
-- 1. clients.report_recipients — the spec's "missing report recipients" check
--    had nothing to read: only primary_email exists. primary_email stays the
--    default recipient; this jsonb array of emails is the explicit override.
-- 2. clients.owner_team_member_id — per-client ACCOUNT owner ("missing owners").
--    Deliverable-level owners already exist (content_items.assigned_to).
-- 3. skill_briefs — DB home for agent skill briefs. SkillsPage stored briefs in
--    browser localStorage (key: vantus_skill_briefs), so "agents without skills"
--    was uncheckable and the 17 curated briefs had no landing spot in the system.
--    SkillsPage now reads/writes this table and imports any localStorage briefs
--    on first load after deploy.
--
-- Apply in the Supabase SQL editor (project wjcs…) BEFORE pushing the matching
-- app code — main auto-deploys and the activation queries 400 without these.
-- Idempotent: safe to re-run.

alter table public.clients
  add column if not exists report_recipients jsonb default '[]'::jsonb;

alter table public.clients
  add column if not exists owner_team_member_id uuid references public.team_members(id) on delete set null;

create table if not exists public.skill_briefs (
  id          uuid primary key default gen_random_uuid(),
  agent_name  text not null,               -- 'Sean' | 'Muse' | 'Scrappy' | 'All Agents' (matches AGENTS_BASE names)
  title       text not null,
  description text,                        -- one-line summary shown in the briefs log
  content     text,                        -- the brief body (markdown)
  client_id   uuid references public.clients(id) on delete cascade,  -- null = global brief
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists skill_briefs_agent_idx on public.skill_briefs (agent_name);

alter table public.skill_briefs enable row level security;

drop policy if exists "admins all skill_briefs" on public.skill_briefs;
create policy "admins all skill_briefs" on public.skill_briefs for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');
