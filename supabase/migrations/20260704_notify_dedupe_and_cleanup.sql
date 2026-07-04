-- ────────────────────────────────────────────────────────────────────────────
-- 2026-07-04 — notification dedupe fix + deprecated-column cleanup.
--
-- Problem: notifications dedupe on unique(type, content_item_id) is PERMANENT.
-- An item approved → kicked back → re-approved never re-notifies, because the
-- second "approved" row collides with the first. That killed the bell (since
-- May) and, after the 7/3 dedupe gate, Slack/email too.
--
-- Fix: dedupe on a `dedupe_key` that includes the approval CYCLE (revision_count),
-- so two tabs firing the SAME approval still collapse to one row, but a genuine
-- re-approval after a revision is a distinct event. notify.js computes the key.
--
-- Idempotent + additive.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. New dedupe column.
alter table public.notifications add column if not exists dedupe_key text;

-- 2. Backfill existing rows. Rows with a NULL content_item_id were distinct under
--    the old index (NULLs distinct in a unique index); use the PK to keep them
--    distinct here too so the new unique index doesn't collide on backfill.
update public.notifications
   set dedupe_key = type || ':' || coalesce(content_item_id, 'row-' || id::text)
 where dedupe_key is null;

-- 3. Swap the unique index: drop the (type, content_item_id) one, add (dedupe_key).
drop index if exists public.notifications_item_type_idx;
create unique index if not exists notifications_dedupe_idx
  on public.notifications (dedupe_key);

-- ── Deprecated-column cleanup (map Fix #6) ──────────────────────────────────
-- clients.slack_channel_id was superseded by slack_webhook_url and is no longer
-- read anywhere; the AddClient modal field that wrote it was removed in the same
-- commit. Safe to drop.
alter table public.clients drop column if exists slack_channel_id;
