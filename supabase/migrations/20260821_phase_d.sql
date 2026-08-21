-- Phase D (ECONOMICS) — Scope Sentinel + Vault credentials + Profitability Lite
-- Idempotent + additive. Apply in the Supabase SQL editor BEFORE the code push.
-- Spec: VANTUS-V3-BUILD-SPEC.md §3.D (2026-07-31, frozen).

-- ============================================================
-- 1. SCOPE SENTINEL — scope_requests (D1)
--    Every new ask gets classified; nothing absorbed silently.
--    Rows with classification 'absorbed_intentionally' + status 'confirmed'
--    ARE the absorbed-value register; the monthly roll-up is computed in UI.
-- ============================================================
create table if not exists public.scope_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  content_item_id text,                        -- optional link, no FK (survives item deletion)
  request_source text not null default 'manual'
    check (request_source in ('manual','intake','comment','email')),
  request_text text not null,
  classification text
    check (classification in (
      'included','included_with_clarification','swap_required',
      'priced_addition','out_of_scope','decline_recommended','absorbed_intentionally')),
  rationale text,                              -- sentinel's reasoning, shown to the human
  clarification text,                          -- the question to ask when unclear (never defaults to included)
  est_value numeric,                           -- dollar value of the ask (absorbed register roll-up)
  status text not null default 'draft'
    check (status in ('draft','confirmed','dismissed')),
  created_by text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scope_requests_client_idx
  on public.scope_requests (client_id, created_at desc);
create index if not exists scope_requests_class_idx
  on public.scope_requests (classification, status, created_at desc);

alter table public.scope_requests enable row level security;
drop policy if exists "admins read scope_requests" on public.scope_requests;
create policy "admins read scope_requests" on public.scope_requests for select
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com');
drop policy if exists "admins write scope_requests" on public.scope_requests;
create policy "admins write scope_requests" on public.scope_requests for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- ============================================================
-- 2. PROFITABILITY LITE — client_costs (D4)
--    Hard costs only (contractor, shoot, software). Labor allocation stays
--    deferred per the cut list: fake precision is worse than no number.
-- ============================================================
create table if not exists public.client_costs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,
  category text not null default 'other'
    check (category in ('contractor','shoot','software','other')),
  amount numeric not null check (amount >= 0),
  incurred_on date not null default current_date,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists client_costs_client_idx
  on public.client_costs (client_id, incurred_on desc);

alter table public.client_costs enable row level security;
drop policy if exists "admins read client_costs" on public.client_costs;
create policy "admins read client_costs" on public.client_costs for select
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com');
drop policy if exists "admins write client_costs" on public.client_costs;
create policy "admins write client_costs" on public.client_costs for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- ============================================================
-- 3. VAULT HARDENING — vault_secrets (D3)
--    Keys/logins, AES-256-GCM encrypted at rest (TOKEN_ENC_KEY, same contract
--    as connected-account tokens). RLS ON with ZERO policies = service-key
--    only, same pattern as approval_tokens: the browser NEVER touches this
--    table directly — every read/write goes through /api/vault-secrets, which
--    masks by default and writes a view-audit row on reveal.
-- ============================================================
create table if not exists public.vault_secrets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,  -- null = agency-level
  label text not null,
  username text,
  secret_enc text not null,                    -- v1:<iv>:<tag>:<ciphertext> (base64 parts)
  notes text,
  created_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists vault_secrets_client_idx
  on public.vault_secrets (client_id, label);

alter table public.vault_secrets enable row level security;
-- deliberately NO policies: anon/session access is fully blocked.

-- ============================================================
-- Verify (run after): all three should return 0 rows, not errors.
--   select count(*) from public.scope_requests;
--   select count(*) from public.client_costs;
--   select count(*) from public.vault_secrets;  -- errors for non-service roles: expected
-- ============================================================
