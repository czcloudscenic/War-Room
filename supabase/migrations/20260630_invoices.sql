-- Billing & Invoices — built Stripe-ready.
--
-- Manual invoice tracking now; the stripe_* columns + stripe_customers table are
-- present but unused, so wiring Stripe later is a flip (add key + package + sync),
-- not a schema change. Admin-only (internal billing). Apply in the Vantus SQL editor.

create table if not exists public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  number             text unique,                    -- INV-2026-001
  client_id          uuid references public.clients(id) on delete set null,
  amount             numeric not null default 0,
  currency           text default 'usd',
  status             text default 'draft' check (status in ('draft','sent','paid','overdue','void')),
  due_date           date,
  issued_at          date,
  sent_at            timestamptz,
  paid_at            timestamptz,
  line_items         jsonb default '[]'::jsonb,       -- [{description, qty, amount}]
  notes              text,
  stripe_invoice_id  text,                            -- populated when Stripe is wired
  stripe_customer_id text,                            -- populated when Stripe is wired
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists invoices_client_idx on public.invoices (client_id);
create index if not exists invoices_status_idx on public.invoices (status);

alter table public.invoices enable row level security;
drop policy if exists "admins all invoices" on public.invoices;
create policy "admins all invoices" on public.invoices for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- Stripe customer mapping — filled in when Stripe is wired (client ↔ Stripe customer).
create table if not exists public.stripe_customers (
  client_id          uuid primary key references public.clients(id) on delete cascade,
  stripe_customer_id text not null,
  created_at         timestamptz default now()
);

alter table public.stripe_customers enable row level security;
drop policy if exists "admins all stripe_customers" on public.stripe_customers;
create policy "admins all stripe_customers" on public.stripe_customers for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');
