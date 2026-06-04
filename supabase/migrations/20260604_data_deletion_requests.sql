-- OAuth data deletion request audit table — 2026-06-04
-- Apply: paste into Supabase SQL editor and run.

create table if not exists public.data_deletion_requests (
  confirmation_code text primary key,
  platform text not null,
  platform_account_id text,
  status text not null default 'completed',
  raw_payload jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists data_deletion_requests_platform_account_idx
  on public.data_deletion_requests(platform, platform_account_id);

alter table public.data_deletion_requests enable row level security;
-- no policies: service-role Netlify functions write/read status by code.
