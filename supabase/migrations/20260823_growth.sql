-- GROWTH destination v1 (v3 spec §3.C.4, built 8/23 under the "Make Vantus work"
-- delegation): scrape a lead -> audit their marketing -> brief their pain points
-- -> pipeline -> convert to client. Idempotent + additive. UI/functions
-- feature-detect these tables, so deploy order is flexible.

-- 1. leads — one row per prospect (deduped by website host)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  host text,                                   -- normalized hostname for dedupe
  industry text,
  city text,
  phone text,
  email text,
  contact_name text,
  contact_title text,
  socials jsonb not null default '{}'::jsonb,  -- {instagram, facebook, tiktok, youtube, linkedin, yelp}
  source text not null default 'manual'
    check (source in ('manual','scan','import','referral')),
  stage text not null default 'new'
    check (stage in ('new','researched','briefed','contacted','replied','meeting','won','lost')),
  owner_team_member_id uuid,
  converted_client_id uuid references public.clients(id) on delete set null,
  notes text,
  created_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists leads_host_uidx on public.leads (host) where host is not null;
create index if not exists leads_stage_idx on public.leads (stage, updated_at desc);

-- 2. lead_research — every scan/audit run, raw + findings (append-only by convention)
create table if not exists public.lead_research (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null default 'site_scan'
    check (kind in ('site_scan','ai_research','manual')),
  raw jsonb not null default '{}'::jsonb,      -- extracted signals (pixels, schema, socials, pages…)
  findings jsonb not null default '[]'::jsonb, -- [{key, severity, label, evidence, pitch}]
  summary text,                                -- AI narrative when credits exist
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists lead_research_lead_idx on public.lead_research (lead_id, created_at desc);

-- 3. lead_briefs — the outreach brief per lead (draft -> approved -> sent)
create table if not exists public.lead_briefs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  subject text not null,
  body_md text not null,
  origin text not null default 'template'
    check (origin in ('template','ai','manual')),
  status text not null default 'draft'
    check (status in ('draft','approved','sent')),
  sent_to text,
  sent_at timestamptz,
  resend_id text,
  created_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists lead_briefs_lead_idx on public.lead_briefs (lead_id, created_at desc);

-- RLS: admin-domain on all three (portal users see nothing)
alter table public.leads enable row level security;
alter table public.lead_research enable row level security;
alter table public.lead_briefs enable row level security;
do $$ begin
  perform 1;
end $$;
drop policy if exists "admins all leads" on public.leads;
create policy "admins all leads" on public.leads for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');
drop policy if exists "admins all lead_research" on public.lead_research;
create policy "admins all lead_research" on public.lead_research for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');
drop policy if exists "admins all lead_briefs" on public.lead_briefs;
create policy "admins all lead_briefs" on public.lead_briefs for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- Verify: select count(*) from public.leads; select count(*) from public.lead_research; select count(*) from public.lead_briefs;
