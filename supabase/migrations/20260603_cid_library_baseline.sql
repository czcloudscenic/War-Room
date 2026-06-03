-- CID library baseline schema — 2026-06-03
-- Apply: paste into Supabase SQL editor and run.

create table if not exists public.cid_library (
  id                bigserial primary key,
  type              text,
  text              text,
  score             numeric,
  platform          text,
  views             bigint,
  engagement        numeric,
  why_it_works      text,
  client_adaptation text,
  created_at        timestamptz not null default now()
);

alter table public.cid_library enable row level security;

create policy "admins manage cid_library"
  on public.cid_library
  for all
  to authenticated
  using (lower((auth.jwt() ->> 'email')) like '%@cloudscenic.com')
  with check (lower((auth.jwt() ->> 'email')) like '%@cloudscenic.com');
