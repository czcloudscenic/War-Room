-- ────────────────────────────────────────────────────────────────────────────
-- notifications — durable client-action notifications
-- Replaces in-memory App.jsx setNotifications array. Refresh-safe, multi-tab safe.
-- Written by netlify/functions/notify.js via SUPABASE_SERVICE_KEY.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id               bigserial primary key,
  ts               timestamptz not null default now(),
  recipient_email  text,                          -- null = broadcast to all admins
  type             text not null,                 -- 'approved' | 'revision_requested'
  content_item_id  text,                          -- the content row that triggered it
  payload          jsonb,                         -- full item + message at trigger time
  read             boolean not null default false
);

-- Unique constraint prevents duplicate notifications when multiple admin
-- clients are online and all fire /api/notify for the same state change.
-- (One notification per (type, content_item_id) is enough; first writer wins.)
create unique index if not exists notifications_item_type_idx
  on public.notifications (type, content_item_id);

create index if not exists notifications_recipient_ts_idx
  on public.notifications (recipient_email, ts desc);

create index if not exists notifications_unread_idx
  on public.notifications (read) where read = false;

alter table public.notifications enable row level security;

-- Production policy: admins can read all notifications
-- (recipient_email scoping is up to the client — broadcast rows show to everyone).
create policy "admins read all"
  on public.notifications
  for select
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com');

create policy "admins update own"
  on public.notifications
  for update
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com');

-- TEMPORARY policies while Google OAuth is bypassed. DROP THESE when auth restored.
create policy "anon read while auth bypassed (TODO remove)"
  on public.notifications
  for select
  using (true);

create policy "anon update while auth bypassed (TODO remove)"
  on public.notifications
  for update
  using (true);

-- Writes happen via SUPABASE_SERVICE_KEY (notify.js function) which bypasses RLS.

-- Enable Supabase Realtime on this table so the bell badge updates live.
alter publication supabase_realtime add table public.notifications;
