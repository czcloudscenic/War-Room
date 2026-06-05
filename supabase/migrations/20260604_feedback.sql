-- Feedback inbox for admin page

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  user_email text,
  message    text not null,
  created_at timestamptz not null default now(),
  status     text not null default 'new'
               check (status in ('new', 'resolved'))
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status);
create index if not exists feedback_user_email_idx on public.feedback (lower(user_email));

alter table public.feedback enable row level security;

drop policy if exists "users insert own feedback" on public.feedback;
create policy "users insert own feedback"
  on public.feedback for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and lower(user_email) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists "admins read feedback" on public.feedback;
create policy "admins read feedback"
  on public.feedback for select
  to authenticated
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com');

drop policy if exists "admins update feedback" on public.feedback;
create policy "admins update feedback"
  on public.feedback for update
  to authenticated
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com')
  with check (auth.jwt() ->> 'email' like '%@cloudscenic.com');
