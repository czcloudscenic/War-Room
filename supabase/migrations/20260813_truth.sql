-- Phase B — TRUTH (v3 spec, 2026-08-13)
-- Make every state provable: version lineage, publish verification, decision
-- log, exception engine, generalized audit trail, source-of-truth registry,
-- facts freshness, backup discipline.
-- Additive + idempotent. Safe to re-run. Apply in the Supabase SQL editor
-- BEFORE pushing the matching app commit (a push IS a prod deploy).

-- ============================================================
-- 1. CONTENT VERSIONS — immutable lineage on content_items
-- ============================================================
create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id text not null references public.content_items(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  version_no integer not null,
  -- creative snapshot at the moment of capture
  title text,
  caption text,
  script text,
  cta text,
  hashtags text,
  files jsonb not null default '[]',
  review_video_path text,
  snapshot jsonb not null default '{}',      -- full raw field snapshot (source of truth for drift checks)
  source text not null default 'save' check (source in ('save','approval','system')),
  created_by text,                            -- email of the human/agent that produced this version
  -- approval stamp (set at insert when the version is captured BY an approval)
  approved_stage text check (approved_stage is null or approved_stage in ('copy','content','client')),
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (content_item_id, version_no)
);

create index if not exists content_versions_item_idx
  on public.content_versions (content_item_id, version_no desc);

-- Immutable: version rows are never edited. (DELETE stays open so the
-- content_items ON DELETE CASCADE can clean up.)
create or replace function public.content_versions_no_update()
returns trigger language plpgsql as $$
begin
  raise exception 'content_versions rows are immutable';
end $$;

drop trigger if exists content_versions_immutable on public.content_versions;
create trigger content_versions_immutable
  before update on public.content_versions
  for each row execute function public.content_versions_no_update();

alter table public.content_versions enable row level security;
drop policy if exists "admins all content_versions" on public.content_versions;
create policy "admins all content_versions" on public.content_versions for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- pointer to the approved (only schedulable) version
alter table public.content_items add column if not exists approved_version_id uuid
  references public.content_versions(id) on delete set null;

-- ============================================================
-- 2. PUBLISH VERIFICATION — receipts on content_items
-- ============================================================
alter table public.content_items add column if not exists verification_status text
  not null default 'unverified'
  check (verification_status in ('unverified','awaiting','verified','failed','wrong_asset'));
alter table public.content_items add column if not exists live_url text;
alter table public.content_items add column if not exists verified_at timestamptz;
alter table public.content_items add column if not exists verification_source text
  check (verification_source is null or verification_source in ('manual','account_posts','agent'));

create index if not exists content_items_verification_idx
  on public.content_items (verification_status)
  where verification_status in ('awaiting','failed','wrong_asset');

-- ============================================================
-- 3. EXCEPTION ENGINE — block reasons on content_items + tasks
-- ============================================================
alter table public.content_items add column if not exists block_reason text
  check (block_reason is null or block_reason in
    ('internal_delay','client_approval','missing_info','missing_asset','platform_failure','payment'));
alter table public.content_items add column if not exists blocked_since timestamptz;
alter table public.content_items add column if not exists block_owner text;
alter table public.content_items add column if not exists block_external boolean not null default false;
alter table public.content_items add column if not exists block_escalation_date date;

alter table public.tasks add column if not exists block_reason text
  check (block_reason is null or block_reason in
    ('internal_delay','client_approval','missing_info','missing_asset','platform_failure','payment'));
alter table public.tasks add column if not exists blocked_since timestamptz;
alter table public.tasks add column if not exists block_owner text;
alter table public.tasks add column if not exists block_external boolean not null default false;
alter table public.tasks add column if not exists block_escalation_date date;

create index if not exists content_items_blocked_idx
  on public.content_items (block_reason) where block_reason is not null;

-- ============================================================
-- 4. CLIENT DECISION LOG + DECISION DEBT
-- ============================================================
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,   -- null = book-level
  entity_type text check (entity_type is null or entity_type in
    ('client','campaign','deliverable','fact','invoice')),
  entity_id text,
  question text not null,
  decision text,
  status text not null default 'open' check (status in ('open','decided')),
  decided_at timestamptz,
  decider text,
  source text,
  evidence_url text,
  affected text,
  follow_up_owner text,
  blocks_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decisions_debt_idx
  on public.decisions (status, blocks_count desc, created_at asc);
create index if not exists decisions_client_idx on public.decisions (client_id);

alter table public.decisions enable row level security;
drop policy if exists "admins all decisions" on public.decisions;
create policy "admins all decisions" on public.decisions for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- ============================================================
-- 5. GENERALIZED AUDIT LOG — who/what changed, old -> new
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,                              -- no FK: audit rows must survive client deletion
  entity_type text not null,                   -- 'content_item'|'client'|'fact'|'vault'|'invoice'|...
  entity_id text,
  field text,
  old_value text,
  new_value text,
  actor_kind text not null default 'human' check (actor_kind in ('human','agent','system')),
  actor_id uuid,
  actor_email text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_entity_idx
  on public.audit_log (entity_type, entity_id, created_at desc);
create index if not exists audit_log_client_idx
  on public.audit_log (client_id, created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists "admins read audit_log" on public.audit_log;
create policy "admins read audit_log" on public.audit_log for select
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com');
drop policy if exists "admins insert audit_log" on public.audit_log;
create policy "admins insert audit_log" on public.audit_log for insert
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');
-- deliberately NO update/delete policies: append-only from sessions.
-- (service key bypasses RLS for server-side writers.)

-- ============================================================
-- 6. SOURCE-OF-TRUTH REGISTRY (lightweight)
-- ============================================================
create table if not exists public.truth_registry (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,                 -- what data this row governs
  authoritative_system text not null,          -- who owns it
  external_ref text,
  sync_direction text not null default 'none'
    check (sync_direction in ('none','pull','push','two_way')),
  last_synced_at timestamptz,
  conflict_state text not null default 'clean'
    check (conflict_state in ('clean','conflict','unknown')),
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.truth_registry enable row level security;
drop policy if exists "admins all truth_registry" on public.truth_registry;
create policy "admins all truth_registry" on public.truth_registry for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

insert into public.truth_registry (domain, authoritative_system, sync_direction, notes) values
  ('publishing_schedule',       'Sprout',        'pull', 'Sprout owns when things actually go out; Vantus mirrors.'),
  ('platform_posts_metrics',    'Platform APIs', 'pull', 'account_posts sync (IG/TikTok/YouTube). Mirrored, read-only in Vantus.'),
  ('payment_status',            'Stripe',        'pull', 'Stripe is system of record for money state; Vantus displays.'),
  ('deliverable_approval_state','Vantus',        'none', 'Vantus owns approvals, versions, gates.'),
  ('client_facts',              'Vantus',        'none', 'Facts of Record live on clients.client_facts.'),
  ('client_credentials',        'Vantus',        'none', 'client_vault. Card data lives in Stripe only.')
on conflict (domain) do nothing;

-- ============================================================
-- 7. FACTS FRESHNESS — review cycle on critical client facts
-- ============================================================
alter table public.clients add column if not exists facts_review_frequency_days integer not null default 30;
alter table public.clients add column if not exists facts_last_reviewed_at timestamptz;

-- backfill: facts edited counts as reviewed at that moment
update public.clients
   set facts_last_reviewed_at = facts_updated_at
 where facts_last_reviewed_at is null and facts_updated_at is not null;

-- ============================================================
-- 8. BACKUP DISCIPLINE
-- ============================================================
create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'export' check (kind in ('export','restore_test')),
  status text not null default 'running' check (status in ('running','ok','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  location text,
  bytes bigint,
  tables_included text[],
  error text,
  notes text
);

create index if not exists backup_runs_started_idx on public.backup_runs (started_at desc);

alter table public.backup_runs enable row level security;
drop policy if exists "admins all backup_runs" on public.backup_runs;
create policy "admins all backup_runs" on public.backup_runs for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- private bucket for encrypted exports
insert into storage.buckets (id, name, public)
  values ('backups', 'backups', false)
on conflict (id) do nothing;

drop policy if exists "admins manage backups" on storage.objects;
create policy "admins manage backups" on storage.objects for all
  using (bucket_id = 'backups' and (auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check (bucket_id = 'backups' and (auth.jwt() ->> 'email') like '%@cloudscenic.com');
