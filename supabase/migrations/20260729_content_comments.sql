-- ────────────────────────────────────────────────────────────────────────────
-- content_comments — threaded review feedback, optionally pinned to a video
-- timecode (client portal / review pack, M0).
--
-- Why: feedback today is one overwritable textarea (client_note) + one line per
-- approval decision. This is the real thread: admins and approved clients
-- comment on an item; comments on a review video carry timecode_seconds so the
-- player can seek to the exact moment ("0:15 — logo too small").
--
-- Clients write DIRECTLY with their own session (unlike approvals, which stay
-- admin/service-key-only): the INSERT policy binds author_email to their JWT so
-- a client can never impersonate, and the row qualifier reuses the exact
-- content_items client-RLS pattern.
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor BEFORE
-- deploying the matching app code.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.content_comments (
  id               uuid primary key default gen_random_uuid(),
  content_item_id  text not null references public.content_items(id) on delete cascade,
  client_id        uuid references public.clients(id) on delete cascade,  -- denormalized for RLS + bell
  author_email     text not null,
  author_name      text,
  author_role      text not null default 'admin' check (author_role in ('admin', 'client')),
  body             text not null,
  timecode_seconds numeric,          -- null = general comment (copy items, no video)
  resolved_at      timestamptz,      -- admin marks handled; clients never update/delete
  created_at       timestamptz not null default now()
);

create index if not exists content_comments_item_idx
  on public.content_comments (content_item_id, created_at);

alter table public.content_comments enable row level security;

-- ── Admins: full access (mirrors content_items admin policy) ──
drop policy if exists "admins all content_comments" on public.content_comments;
create policy "admins all content_comments"
  on public.content_comments for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- ── Approved external clients: read their own client's threads ──
drop policy if exists "clients read scoped content_comments" on public.content_comments;
create policy "clients read scoped content_comments"
  on public.content_comments for select
  using (
    exists (
      select 1
      from public.client_users cu
      where lower(cu.email) = lower(auth.jwt() ->> 'email')
        and cu.status = 'approved'
        and cu.client_id = content_comments.client_id
    )
  );

-- ── Approved external clients: write into their own client's threads only,
--    and only as themselves (author fields bound to the JWT email). ──
drop policy if exists "clients insert scoped content_comments" on public.content_comments;
create policy "clients insert scoped content_comments"
  on public.content_comments for insert
  with check (
    author_role = 'client'
    and lower(author_email) = lower(auth.jwt() ->> 'email')
    and exists (
      select 1
      from public.client_users cu
      where lower(cu.email) = lower(auth.jwt() ->> 'email')
        and cu.status = 'approved'
        and cu.client_id = content_comments.client_id
    )
  );

-- No client UPDATE/DELETE: resolution is an admin action.

-- ── Realtime (live threads in the modal + portal) ──
-- Publication membership must be granted explicitly; wrapped so a re-run
-- doesn't fail on duplicate_object.
do $$
begin
  alter publication supabase_realtime add table public.content_comments;
exception
  when duplicate_object then null;
end $$;

-- Sanity checks (run after applying):
-- select policyname, cmd from pg_policies where tablename='content_comments' order by policyname;
-- select * from pg_publication_tables where pubname='supabase_realtime' and tablename='content_comments';
