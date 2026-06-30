-- Deliverables Ledger — the accountability + proof layer (Fulfillment OS, Phase 1).
--
-- content_items already has the pipeline shell (status, stage, files, publish_date,
-- client_id). What's missing is the "who owes what, to whom, by when, and whether it
-- actually posted" layer — plus an audit trail of who approved/rejected what, when,
-- with what feedback. This migration adds exactly that.
--
-- Idempotent + additive: safe against the live prod DB (which already has
-- content_items) and a fresh dev DB. Non-destructive — only ADD COLUMN / CREATE TABLE.
--
-- ⚠️ TEST AFTER APPLYING:
--   1. Admin (@cloudscenic.com): content tracker still loads/edits/creates as normal.
--   2. Approved external client (e.g. Natalia / VitalLyfe): ClientView still scoped;
--      can read approvals for their own client only.
--   3. Anon (no login): zero rows from /rest/v1/approvals.

-- ────────────────────────────────────────────────────────────────────────
-- 1. content_items — accountability + proof columns
-- ────────────────────────────────────────────────────────────────────────
alter table public.content_items add column if not exists assigned_to      uuid references public.profiles(id);
alter table public.content_items add column if not exists due_date         date;          -- production deadline (distinct from publish_date = go-live)
alter table public.content_items add column if not exists billable         boolean default true;
alter table public.content_items add column if not exists in_scope         boolean default true;  -- counts against this client's contract scope
alter table public.content_items add column if not exists approval_mode    text default 'internal'
  check (approval_mode in ('auto', 'internal', 'client'));
alter table public.content_items add column if not exists posted_at        timestamptz;   -- proof of publication (the Friday "did it post?" check)
alter table public.content_items add column if not exists platform_post_id text;          -- the live post id, once published
alter table public.content_items add column if not exists revision_count   integer default 0;

create index if not exists content_items_assigned_idx on public.content_items (assigned_to);
create index if not exists content_items_due_idx       on public.content_items (due_date);

-- ────────────────────────────────────────────────────────────────────────
-- 2. approvals — audit trail (who decided what, when, with what feedback)
--    content_items.status only holds the *current* state; this holds the *history*.
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.approvals (
  id              uuid primary key default gen_random_uuid(),
  content_item_id text not null references public.content_items(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete cascade,
  approver_id     uuid references public.profiles(id),
  approver_email  text,                       -- denormalized for display without a join
  decision        text not null check (decision in ('approved', 'rejected', 'revision_requested')),
  stage           text,                       -- which gate: 'copy' | 'content' | 'client'
  feedback        text,
  created_at      timestamptz default now()
);

create index if not exists approvals_item_idx   on public.approvals (content_item_id, created_at desc);
create index if not exists approvals_client_idx on public.approvals (client_id);

alter table public.approvals enable row level security;

-- ── Admin full access (mirrors content_items admin policy) ──
drop policy if exists "admins all approvals" on public.approvals;
create policy "admins all approvals"
  on public.approvals for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- ── Approved external clients read approvals for their own client_id only ──
--    (same row qualifier used in 20260526_content_items_client_rls.sql)
drop policy if exists "clients read scoped approvals" on public.approvals;
create policy "clients read scoped approvals"
  on public.approvals for select
  using (
    exists (
      select 1
      from public.client_users cu
      where lower(cu.email) = lower(auth.jwt() ->> 'email')
        and cu.status = 'approved'
        and cu.client_id = approvals.client_id
    )
  );

-- INSERT/UPDATE/DELETE on approvals stay admin-only (writes happen via the app /
-- agent-action with the admin session, never the external client).

-- Sanity check (run after applying):
-- select policyname, cmd from pg_policies where schemaname='public' and tablename='approvals';
