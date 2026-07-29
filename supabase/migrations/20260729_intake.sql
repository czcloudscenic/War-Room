-- ────────────────────────────────────────────────────────────────────────────
-- Public client intake (M7): per-client intake tokens + staged requests.
--
-- Why: clients send new-work requests over text/email today. The public intake
-- form (/intake.html?t=<token>) posts to /api/intake, which writes a STAGED
-- row here — never directly into content_items — so junk can't pollute the
-- pipeline. Admins triage in Operations: Promote (creates the real content
-- item with the admin session) or Dismiss.
--
-- The token is the gate: an unguessable per-client secret in the URL. Rotating
-- it (regenerate the column) kills every previously shared link.
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor BEFORE
-- deploying the matching app code.
-- ────────────────────────────────────────────────────────────────────────────

-- ── Per-client intake token (backfilled for existing clients) ──
alter table public.clients add column if not exists intake_token text;

update public.clients
   set intake_token = gen_random_uuid()::text
 where intake_token is null;

-- Partial unique index instead of a column constraint so future rows created
-- before the app assigns a token (null) don't collide.
create unique index if not exists clients_intake_token_idx
  on public.clients (intake_token)
  where intake_token is not null;

-- ── Staged intake requests ──
create table if not exists public.intake_requests (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  submitter_name   text,
  submitter_email  text,
  request_type     text,              -- mirrors the Ledger format vocabulary (Reel, Flyer, ...)
  title            text,
  description      text,
  target_date      text,              -- free text on purpose; promoted item gets a real due_date
  links            jsonb default '[]'::jsonb,
  status           text not null default 'new' check (status in ('new', 'promoted', 'dismissed')),
  promoted_item_id text,              -- content_items.id once promoted
  created_at       timestamptz not null default now()
);

create index if not exists intake_requests_status_idx
  on public.intake_requests (status, created_at desc);

alter table public.intake_requests enable row level security;

-- Admin-only: the public form writes via the SERVICE_KEY function; clients and
-- anon read zero rows.
drop policy if exists "admins full access" on public.intake_requests;
create policy "admins full access"
  on public.intake_requests
  for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- Sanity checks (run after applying):
-- select name, intake_token from public.clients order by name;
-- select * from public.intake_requests;
