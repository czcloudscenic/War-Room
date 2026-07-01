-- Operations layer: team_members (capability matrix) + tasks (work board).
--
-- Powers the AI Operations Manager (dump a task list → AI scores + assigns by skill
-- → chases), the Tasks Kanban, and the Team roster. Internal-only (admins); external
-- clients never see ops data. Additive + idempotent. Apply in the Vantus SQL editor.

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,
  email      text,
  skills     jsonb default '[]'::jsonb,     -- ["video-edit","paid-media",...] — the capability matrix
  status     text default 'offline' check (status in ('online','busy','away','offline')),
  color      text default '#2AABFF',
  active     boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text default 'backlog'  check (status in ('backlog','in_progress','review','done')),
  priority    text default 'medium'   check (priority in ('low','medium','high','urgent')),
  score       integer default 0,                                  -- AI-assigned priority score 0–100
  assignee_id uuid references public.team_members(id) on delete set null,
  client_id   uuid references public.clients(id) on delete set null,
  due_date    date,
  source      text default 'manual'   check (source in ('manual','ai_ops')),
  reason      text,                                               -- why the AI assigned it this way
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists tasks_status_idx   on public.tasks (status);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_client_idx   on public.tasks (client_id);

alter table public.team_members enable row level security;
alter table public.tasks        enable row level security;

drop policy if exists "admins all team_members" on public.team_members;
create policy "admins all team_members" on public.team_members for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

drop policy if exists "admins all tasks" on public.tasks;
create policy "admins all tasks" on public.tasks for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- Seed the roster from the ops mockup — EDITABLE (rename/delete in the Team tab).
-- Runs once (only when the table is empty) so re-applying is safe.
do $$
begin
  if not exists (select 1 from public.team_members) then
    insert into public.team_members (name, role, email, skills, status, color) values
      ('Christian Z.', 'Operator',        null, '["paid-media","meta-ads","crm","strategy"]',    'online', '#2AABFF'),
      ('Danny V.',     'Owner',           null, '["strategy","pricing","contracts","sales"]',    'busy',   '#ff375f'),
      ('Jordan L.',    'Designer',        null, '["design","figma","moodboard","branding"]',     'online', '#ffd60a'),
      ('Maya R.',      'Editor',          null, '["video-edit","reels","color"]',                'busy',   '#5e5ce6'),
      ('Aisha K.',     'Account Manager', null, '["project-mgmt","scheduling","logistics"]',     'online', '#30d158'),
      ('Sofia C.',     'Strategist',      null, '["copywriting","sales","outbound"]',            'online', '#ff9f0a'),
      ('Reza M.',      'Developer',       null, '["code","api","automation"]',                   'away',   '#64d2ff');
  end if;
end $$;
