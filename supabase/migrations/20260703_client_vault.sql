-- ────────────────────────────────────────────────────────────────────────────
-- client_vault — per-client billing profile + card-on-file reference.
--
-- Card numbers are NEVER stored here. Cards are entered on Stripe's hosted
-- Checkout page (mode=setup) and live in Stripe's vault; this table keeps only
-- the display reference (brand / last4 / expiry) and the Stripe ids needed to
-- charge later. Everything else is manual-input billing/contact data.
--
-- RLS: admins (@cloudscenic.com) only. No client_users policy on purpose —
-- external portal users must see ZERO rows here. Anon must see zero rows.
--
-- Idempotent — safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_vault (
  client_id                 uuid primary key references public.clients(id) on delete cascade,

  -- manual-input billing profile
  legal_name                text,
  billing_contact           text,
  billing_email             text,
  billing_phone             text,
  address_line1             text,
  address_line2             text,
  city                      text,
  state                     text,
  zip                       text,
  country                   text default 'US',
  tax_id                    text,
  notes                     text,

  -- Stripe card-on-file reference (vaulted at Stripe, display-only here)
  stripe_customer_id        text,
  stripe_payment_method_id  text,
  card_brand                text,
  card_last4                text,
  card_exp_month            integer,
  card_exp_year             integer,
  card_synced_at            timestamptz,

  updated_at                timestamptz default now()
);

alter table public.client_vault enable row level security;

drop policy if exists "admins full access" on public.client_vault;
create policy "admins full access"
  on public.client_vault
  for all
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com')
  with check (auth.jwt() ->> 'email' like '%@cloudscenic.com');

-- No client_users policy, no anon policy: portal + anon read zero rows.
