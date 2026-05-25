-- ────────────────────────────────────────────────────────────────────────────
-- client_users — external client login allowlist + invite flow foundation
-- ────────────────────────────────────────────────────────────────────────────
-- Before this: only @cloudscenic.com users could log in (Google OAuth Internal audience).
-- After this: agency-team @cloudscenic.com users still get admin access; external
-- client people (e.g. natalia@vitallyfe.com) can be invited per-client and
-- given gated access to their client's data.
--
-- Login flow:
--   1. Admin adds row to client_users (email, client_id, status='pending')
--   2. Client tries to OAuth/sign in with that email
--   3. requireUser (server) + App.jsx (client) check this table:
--        - status='approved'  → in (as role='client', scoped to their client_id)
--        - status='pending'   → blocked with "awaiting approval" screen,
--                               first-login event fires Slack/email to admins
--        - status='rejected'  → blocked
--        - not in table       → blocked (no invite)
--   4. Admin clicks "Approve" in Clients page or Slack → status='approved'
--   5. Client refreshes → in
--
-- Admins are NOT in this table — they're identified by @cloudscenic.com email
-- directly (matches the existing pattern in admin RLS policies).
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,                         -- lowercased on insert by app
  client_id       uuid not null references public.clients(id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  invited_by      uuid references auth.users(id) on delete set null,
  invited_at      timestamptz not null default now(),
  first_login_at  timestamptz,                           -- set on first OAuth attempt
  approved_by     uuid references auth.users(id) on delete set null,
  approved_at     timestamptz,
  rejected_at     timestamptz,
  notes           text,
  unique (email, client_id)                              -- same email can belong to multiple clients
);

create index if not exists client_users_email_idx  on public.client_users (lower(email));
create index if not exists client_users_status_idx on public.client_users (status);

alter table public.client_users enable row level security;

-- Admins: full read/write
drop policy if exists "admins read client_users" on public.client_users;
create policy "admins read client_users"
  on public.client_users for select
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com');

drop policy if exists "admins write client_users" on public.client_users;
create policy "admins write client_users"
  on public.client_users for all
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com')
  with check (auth.jwt() ->> 'email' like '%@cloudscenic.com');

-- Approved external clients: can read their own row(s) only
-- (so the app can show them what client(s) they belong to)
drop policy if exists "approved clients read own row" on public.client_users;
create policy "approved clients read own row"
  on public.client_users for select
  using (
    status = 'approved'
    and lower(email) = lower(auth.jwt() ->> 'email')
  );

-- Realtime so the approval status flips live (admin clicks approve → client's
-- "awaiting approval" screen auto-flips to dashboard without refresh)
alter publication supabase_realtime add table public.client_users;
