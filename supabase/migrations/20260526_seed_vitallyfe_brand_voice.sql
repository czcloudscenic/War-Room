-- Move 1 — Brain Cortex wiring step 1 of 2.
--
-- Seed clients.brand_voice_md for VitalLyfe with the exact text currently
-- hardcoded across 8 prompt sites in netlify/functions/agent-action.js.
-- After this lands + the agent-action.js refactor lands, prompts read this
-- column at runtime instead of inlining VitalLyfe-specific copy.
--
-- Behavior parity test: generate content for VitalLyfe before vs after this
-- migration. Output should read the same (same voice, same forbidden words,
-- same pillars). Different clients can override by writing their own
-- brand_voice_md via the AddClient modal.

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

-- Sanity check — should return one row
select id, slug, name, length(brand_voice_md) as voice_len
from public.clients
where slug = 'vitallyfe' or lower(name) = 'vitallyfe';
