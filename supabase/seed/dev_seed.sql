-- Development seed data for local/non-prod Supabase projects.
-- Live rows are already present in production; this file is organizational.

insert into public.clients (slug, name, brand_color, primary_email, slack_channel_id, brand_voice_md)
values (
  'vitallyfe',
  'VitalLyfe',
  '#2AABFF',
  'natalia@vitallyfe.com',
  'C0AM0UU4G4R',  -- #vitallyfe-war-room
  'Calm, confident, purposeful. Never corporate. Movement, not product. Avoid generic wellness language, overclaiming, stock-feeling visuals.'
)
on conflict (slug) do nothing;

update public.clients
set brand_voice_md = $voice$Brand voice: cinematic, calm, purposeful. Key phrases: abundance, access, built for beyond.

AVOID: revolutionary, game-changing, exclamation points, generic corporate content.

Brand: wellness/hydration technology. Mission: abundance → access.
Content pillars: Abundance, Access, Innovation, Startup Diaries, Tierra Bomba, Product Launch, Meet the Makers
Target audience: health-conscious consumers, sustainability advocates, startup/innovation crowd, outdoor/travel lifestyle
Platforms: Instagram (Reels/Carousels), TikTok, YouTube, X/Threads
Aesthetic: cinematic, calm, water in motion, warm naturals, real human moments. No corporate, no fake smiles.$voice$
where slug = 'vitallyfe'
   or lower(name) = 'vitallyfe';

select id, slug, name, length(brand_voice_md) as voice_len
from public.clients
where slug = 'vitallyfe' or lower(name) = 'vitallyfe';
