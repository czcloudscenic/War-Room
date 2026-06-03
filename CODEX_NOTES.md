# CODEX_NOTES - Security + HIGH-drift batch

Branch: `codex/grunt-2026-06-03`
Date: 2026-06-03

## Summary

Completed the requested static security/drift batch:

- Added baseline migrations for `cid_library` and `cid_performance`.
- Repaired CID writes to use the authenticated Supabase client instead of undefined raw REST credentials.
- Added per-user rate limits to the six ungated authenticated functions.
- Escaped user-supplied notify fields before email HTML and Slack text output.
- Validated and clamped the chat proxy payload before forwarding to Anthropic.
- Added timeout-backed, concurrency-capped Instagram insight fetching.

No remote push was run.

## Files touched and line counts

- `supabase/migrations/20260603_cid_library_baseline.sql` - 24 lines
- `supabase/migrations/20260603_cid_performance.sql` - 23 lines
- `src/apps/competitor-intel/CIDPage.jsx` - 832 lines
- `netlify/functions/apify-scrape.js` - 315 lines
- `netlify/functions/unsplash.js` - 62 lines
- `netlify/functions/sync-instagram.js` - 282 lines
- `netlify/functions/sync-tiktok.js` - 306 lines
- `netlify/functions/sync-youtube.js` - 299 lines
- `netlify/functions/notify.js` - 257 lines
- `netlify/functions/chat.js` - 88 lines
- `CODEX_NOTES.md` - 80 lines, overwritten with this report

## Commits made

- `7371239` Add cid_library baseline migration
- `52647f3` Add cid_performance baseline migration
- `9e263c1` Repair CID Supabase writes
- `2c97744` Rate limit Apify scrape function
- `c643e85` Rate limit Unsplash function
- `00e963a` Rate limit Instagram sync function
- `46c0cee` Rate limit TikTok sync function
- `8574a2f` Rate limit YouTube sync function
- `4db54df` Rate limit notify function
- `5467b5d` Escape notify email and Slack fields
- `9754c10` Validate Anthropic chat payload
- `822f9ca` Cap Instagram insight fetch concurrency

## Validation results

Build:

- `npm run build` passed after every scoped file change.
- Final `npm run build` passed.
- Vite emitted the existing chunk-size warning: one generated JS chunk is larger than 500 kB after minification.

Function syntax checks:

- `node --check netlify/functions/apify-scrape.js` passed.
- `node --check netlify/functions/chat.js` passed.
- `node --check netlify/functions/notify.js` passed.
- `node --check netlify/functions/unsplash.js` passed.
- `node --check netlify/functions/sync-instagram.js` passed.
- `node --check netlify/functions/sync-tiktok.js` passed.
- `node --check netlify/functions/sync-youtube.js` passed.

Live API/OAuth/sync calls were not run, per brief.

## Founder follow-up

Founder must apply both new Supabase migrations to live Supabase manually, by pasting them into the Supabase SQL editor:

- `supabase/migrations/20260603_cid_library_baseline.sql`
- `supabase/migrations/20260603_cid_performance.sql`

## Anything punted or skipped

- No live Apify, Unsplash, Meta, TikTok, YouTube, Resend, Slack, n8n, Anthropic, OAuth, or Supabase production calls were run.
- `netlify/functions/agent-action.js`, `src/ui/routes/AnalyticsRoute.jsx`, `src/App.jsx`, `architecture-map.html`, and `docs/architecture-map/**` were not edited by this task.
- A concurrent/uncommitted change to reserved `netlify/functions/agent-action.js` appeared during the session and was left unstaged and untouched.
- Existing/pre-existing dirty files under `.netlify/`, plus untracked `Videos/` and `sprint-recap.html`, were left untouched.
