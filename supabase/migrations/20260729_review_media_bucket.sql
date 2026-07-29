-- ────────────────────────────────────────────────────────────────────────────
-- review-media bucket + content_items.review_video_path (review pack, M0).
--
-- Why: Drive can't serve first-party video — webViewLink is an HTML page and
-- the /preview iframe is CSP-blocked AND gives no currentTime, so timestamped
-- comments are impossible on it. Review cuts live in Supabase Storage (already
-- allowed by the prod CSP media-src) and play in a first-party <video>.
--
-- Public-read is a deliberate trade-off: paths are unguessable
-- (${itemId}/${uuid}.mp4) and the CSP already treats the Supabase host as a
-- media origin. If client footage ever needs stricter privacy, flip the app to
-- createSignedUrl — no schema change required.
--
-- Uploads/updates/deletes: admin sessions only (tighter than the older
-- client-logos bucket, which predates restored auth).
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor BEFORE
-- deploying the matching app code.
-- ────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('review-media', 'review-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read review-media" on storage.objects;
create policy "Public read review-media"
  on storage.objects for select
  using (bucket_id = 'review-media');

drop policy if exists "Admins upload review-media" on storage.objects;
create policy "Admins upload review-media"
  on storage.objects for insert
  with check (
    bucket_id = 'review-media'
    and (auth.jwt() ->> 'email') like '%@cloudscenic.com'
  );

drop policy if exists "Admins update review-media" on storage.objects;
create policy "Admins update review-media"
  on storage.objects for update
  using (
    bucket_id = 'review-media'
    and (auth.jwt() ->> 'email') like '%@cloudscenic.com'
  );

drop policy if exists "Admins delete review-media" on storage.objects;
create policy "Admins delete review-media"
  on storage.objects for delete
  using (
    bucket_id = 'review-media'
    and (auth.jwt() ->> 'email') like '%@cloudscenic.com'
  );

-- Where the item's current review cut lives (bucket-relative path).
alter table public.content_items add column if not exists review_video_path text;

-- Sanity check (run after applying):
-- select id, public from storage.buckets where id='review-media';
