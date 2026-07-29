-- ────────────────────────────────────────────────────────────────────────────
-- Revision caps + server-side revision counting (M0).
--
-- Two fixes and one feature:
--
--   1. FEATURE — clients.included_revisions: how many revision rounds per item
--      the retainer includes (Timeliner-style cap). The app flags at/over cap
--      (amber badge, "additional rounds may be billed" copy, admin notify) but
--      never hard-blocks a kickback.
--
--   2. FIX — revision_count moves server-side. Today src/core/approvals.js does
--      a read-modify-write from the browser (race-prone) and manual status
--      edits bypass it entirely. Now an AFTER INSERT trigger on approvals bumps
--      the counter atomically, no matter who wrote the row (admin session or
--      the service-key approval-decision function).
--
--   3. FIX — content_items.updated_at gets a touch trigger so it's a
--      trustworthy staleness signal for the stuck-item cron (M5). It only
--      auto-touches when the caller didn't explicitly change updated_at, so
--      deliberate writes (and SQL-editor backdating during tests) still win.
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor BEFORE
-- deploying the matching app code (the app-side counter increment is removed
-- in the same commit that ships with this migration).
-- ────────────────────────────────────────────────────────────────────────────

-- ── 1. The cap (numeric like posts_per_week; null = no cap configured) ──
alter table public.clients add column if not exists included_revisions numeric default 2;

-- ── 2. Atomic revision counter ──
create or replace function public.bump_revision_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.content_items
     set revision_count = coalesce(revision_count, 0) + 1
   where id = new.content_item_id;
  return new;
end;
$$;

drop trigger if exists approvals_bump_revision on public.approvals;
create trigger approvals_bump_revision
  after insert on public.approvals
  for each row
  when (new.decision = 'revision_requested')
  execute function public.bump_revision_count();

-- ── 3. updated_at touch trigger ──
-- Only fills updated_at when the write didn't set it itself: app writes that
-- pass an explicit timestamp keep theirs; direct SQL/PostgREST patches that
-- omit it stop looking artificially stale/fresh.
create or replace function public.touch_content_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists content_items_touch_updated_at on public.content_items;
create trigger content_items_touch_updated_at
  before update on public.content_items
  for each row
  execute function public.touch_content_items_updated_at();

-- Sanity checks (run after applying):
-- insert a 'revision_requested' approvals row for a test item, then:
--   select revision_count, updated_at from public.content_items where id='<test-item-id>';
-- select tgname from pg_trigger where tgrelid in ('public.approvals'::regclass, 'public.content_items'::regclass) and not tgisinternal;
