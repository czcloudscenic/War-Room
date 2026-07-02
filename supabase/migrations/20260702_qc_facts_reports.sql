-- QC Agent + Facts of Record + Monthly Report (Vantus upgrade, spec 2026-07-02).
--
-- Three pieces, one migration:
--   1. QC fields on content_items — the AI gate's result (status/issues/timestamp).
--      qc_status is a PARALLEL field, not a new pipeline status, so existing
--      status groupings keep working. 'blocked' hard-stops scheduling in the UI.
--   2. Facts of Record on clients — the per-client source of truth QC checks
--      facts against (hours/locations/prices/offers/operational). Owner: Sebastian.
--   3. client_reports + a private storage bucket — the monthly Sprout PDF flow:
--      PDF gets dropped in, the send-monthly-reports cron emails it on the 1st.
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor
-- (project wjcstqqihtebkpyuacop) BEFORE deploying the matching app code.

-- ── 1. QC fields on content_items ─────────────────────────────────────────────
alter table public.content_items add column if not exists qc_status text default 'not_run'
  check (qc_status in ('not_run', 'pass', 'flagged', 'blocked'));
alter table public.content_items add column if not exists qc_issues jsonb default '[]'::jsonb;
  -- [{ layer: 'facts'|'copy'|'brand', severity: 'blocker'|'warning', description, location }]
alter table public.content_items add column if not exists qc_ran_at timestamptz;

-- ── 2. Facts of Record on clients ─────────────────────────────────────────────
alter table public.clients add column if not exists client_facts jsonb default '{}'::jsonb;
  -- { hours: {mon..sun, exceptions[]}, locations: [{address, phone}],
  --   prices: [{item, price, updated}], offers: [{name, valid_from, valid_to}],
  --   operational_facts: [text] }   (brand lives in the existing Brand Manager fields)
alter table public.clients add column if not exists facts_updated_at timestamptz;
alter table public.clients add column if not exists facts_owner text default 'Sebastian';
alter table public.clients add column if not exists report_schedule text
  check (report_schedule is null or report_schedule in ('monthly_1st'));

-- ── 3. client_reports table ───────────────────────────────────────────────────
create table if not exists public.client_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  month text not null,                    -- 'YYYY-MM' — the month the report covers
  pdf_path text not null,                 -- path inside the client-reports bucket
  uploaded_by text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_to text,
  send_error text,
  unique (client_id, month)
);

alter table public.client_reports enable row level security;

-- Admin full access (same shape as the 6/30 lockdown migrations).
drop policy if exists "admins full access" on public.client_reports;
create policy "admins full access" on public.client_reports
  for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- Approved client users can read their own reports (portal parity with invoices).
drop policy if exists "clients read own reports" on public.client_reports;
create policy "clients read own reports" on public.client_reports
  for select
  using (exists (
    select 1 from public.client_users cu
    where lower(cu.email) = lower(auth.jwt() ->> 'email')
      and cu.status = 'approved'
      and cu.client_id = client_reports.client_id
  ));

-- ── 3b. Private storage bucket for the PDFs ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('client-reports', 'client-reports', false)
on conflict (id) do nothing;

-- Admins manage report PDFs; nobody else touches the bucket (cron uses service key).
drop policy if exists "admins manage client reports" on storage.objects;
create policy "admins manage client reports" on storage.objects
  for all
  using (bucket_id = 'client-reports' and (auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check (bucket_id = 'client-reports' and (auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- ── 4. Per-client config seed (spec section 6) ────────────────────────────────
-- Sets the scope/cadence/approval values from the spec. Matches by name; creates
-- the client only if it doesn't exist yet. Does NOT touch retainer amounts,
-- brand fields, or anything already configured beyond the spec's own values.

do $$
begin
  -- Dynasty — Tier B recurring, 2x/day Mon-Fri, partial approval, monthly report.
  if not exists (select 1 from public.clients where name ilike '%dynasty%') then
    insert into public.clients (slug, name, status) values ('dynasty', 'Dynasty', 'active');
  end if;
  update public.clients set
    lane = 'recurring',
    cadence = '2 posts/day Mon-Fri (10/wk) · 1 iPhone shoot/mo',
    approval_rule = 'internal',              -- "partial approval" → internal gate
    report_schedule = 'monthly_1st',
    service_scope = case when service_scope is null or service_scope = '[]'::jsonb
      then '["Content Strategy","Reels","Static Posts","Reporting"]'::jsonb else service_scope end
  where name ilike '%dynasty%';

  -- Parlour Bar — Tier C recurring, 2 videos + 2 flyers/wk, pre-approved (flyers get factual QC).
  if not exists (select 1 from public.clients where name ilike '%parlour%') then
    insert into public.clients (slug, name, status) values ('parlour-bar', 'Parlour Bar', 'active');
  end if;
  update public.clients set
    lane = 'recurring',
    cadence = '2 videos + 2 flyers/wk · 1 shoot/mo',
    approval_rule = 'auto',                  -- pre-approved posting
    service_scope = case when service_scope is null or service_scope = '[]'::jsonb
      then '["Reels","Graphics & Flyers"]'::jsonb else service_scope end
  where name ilike '%parlour%';

  -- Vital Lyfe — Tier A project-based, per brief, full approval.
  update public.clients set
    lane = 'brief',
    cadence = 'Per brief — no weekly cadence',
    approval_rule = 'client'                 -- full approval
  where name ilike '%vital%';
end $$;

-- Sanity checks (run after applying):
-- select name, lane, cadence, approval_rule, report_schedule from public.clients;
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='content_items' and column_name like 'qc%';
-- select id, public from storage.buckets where id = 'client-reports';
