-- Rights clock (v3 spec Phase E.3) — expiry dates on licenses/releases/offers
-- with lead-time warnings. Serves the VitalLyfe licensing model: usage terms
-- become renewal invoices. Idempotent + additive; the UI feature-detects this
-- table, so deploy order is flexible.

create table if not exists public.asset_rights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,                         -- what the right covers
  kind text not null default 'license'
    check (kind in ('license','release','offer','other')),
  expires_on date not null,
  lead_days integer not null default 30 check (lead_days >= 0),
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists asset_rights_client_idx
  on public.asset_rights (client_id, expires_on);

alter table public.asset_rights enable row level security;
drop policy if exists "admins read asset_rights" on public.asset_rights;
create policy "admins read asset_rights" on public.asset_rights for select
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com');
drop policy if exists "admins write asset_rights" on public.asset_rights;
create policy "admins write asset_rights" on public.asset_rights for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- Verify: select count(*) from public.asset_rights;
