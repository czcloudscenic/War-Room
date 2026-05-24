-- ────────────────────────────────────────────────────────────────────────────
-- Storage bucket for client logos uploaded via the Add Client modal.
-- Public-read so logos render in the sidebar picker without signed URLs.
-- ────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do update set public = excluded.public;

-- Anyone can view logos (bucket is public anyway, this is the RLS gate)
create policy "Public read client-logos"
  on storage.objects for select
  using (bucket_id = 'client-logos');

-- Admins (or anon while OAuth bypassed) can upload
create policy "Anon upload client-logos (TODO restrict to admins when auth back)"
  on storage.objects for insert
  with check (bucket_id = 'client-logos');

create policy "Anon update client-logos (TODO restrict to admins when auth back)"
  on storage.objects for update
  using (bucket_id = 'client-logos');

create policy "Anon delete client-logos (TODO restrict to admins when auth back)"
  on storage.objects for delete
  using (bucket_id = 'client-logos');
