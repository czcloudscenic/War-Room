-- CID performance baseline schema — 2026-06-03
-- Apply: paste into Supabase SQL editor and run.

create table if not exists public.cid_performance (
  id                bigserial primary key,
  content_title     text,
  variation         text,
  predicted_score   numeric,
  actual_views      text,
  actual_engagement text,
  actual_saves      text,
  notes             text,
  created_at        timestamptz not null default now()
);

alter table public.cid_performance enable row level security;

create policy "admins manage cid_performance"
  on public.cid_performance
  for all
  to authenticated
  using (lower((auth.jwt() ->> 'email')) like '%@cloudscenic.com')
  with check (lower((auth.jwt() ->> 'email')) like '%@cloudscenic.com');
