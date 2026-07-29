-- ────────────────────────────────────────────────────────────────────────────
-- One-click approval tokens (client portal / email-approval pack, M0).
--
-- Why: approval-request emails carry two links (Approve / Request changes).
-- Each link holds an opaque single-use token bound to one item, one decision,
-- one recipient, and one revision round — modeled on the oauth_states pattern
-- (DB-backed, consumed once). The approval-decision function validates and
-- consumes these with the SERVICE_KEY.
--
-- RLS is enabled with ZERO policies on purpose: no session (admin, client, or
-- anon) can ever read a token row. Only the service key touches this table.
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor
-- (project wjcstqqihtebkpyuacop) BEFORE deploying the matching app code.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.approval_tokens (
  id              uuid primary key default gen_random_uuid(),
  token           text unique not null,          -- crypto.randomUUID() from the function
  content_item_id text not null references public.content_items(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete cascade,
  stage           text not null check (stage in ('copy', 'content')),
  decision        text not null check (decision in ('approved', 'revision_requested')),
  email           text not null,                 -- the recipient this token was issued to
  revision_round  integer not null default 0,    -- item.revision_count at issue time; stale rounds refuse
  expires_at      timestamptz not null,
  used_at         timestamptz,                   -- set on consume; siblings invalidated together
  created_at      timestamptz not null default now()
);

create index if not exists approval_tokens_item_idx
  on public.approval_tokens (content_item_id, revision_round);

alter table public.approval_tokens enable row level security;
-- No policies: service-key only. (RLS on + zero policies = invisible to every session.)

-- Sanity check (run after applying):
-- select count(*) from public.approval_tokens;                       -- as admin session: ERROR/0 via RLS
-- select policyname from pg_policies where tablename='approval_tokens'; -- should return zero rows
