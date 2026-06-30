-- Brand Manager (Fulfillment OS, Phase 4).
--
-- Today a client's brand lives as a single markdown blob (clients.brand_voice_md),
-- and agents heuristically parse pillars out of it (parsePillars in agent-action.js).
-- This promotes the brand to structured fields so every agent prompt gets clean
-- pillars + explicit do/don't rules — consistent on-brand output per client.
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor (wjcstqqihtebkpyuacop).

alter table public.clients add column if not exists brand_pillars jsonb default '[]'::jsonb;  -- ["Movement not product", "Calm authority", ...]
alter table public.clients add column if not exists brand_dos     jsonb default '[]'::jsonb;  -- ["Lead with the feeling", ...]
alter table public.clients add column if not exists brand_donts   jsonb default '[]'::jsonb;  -- ["Never sound corporate", "No generic wellness language", ...]
