# Analytics Page — Live Data Plan (updated 2026-07-01)

Goal: get the extracted Analytics page reading real Instagram data (reach,
engagement, posts) instead of empty states. TikTok and YouTube come later.

## Correction to the earlier plan (important)

The earlier plan proposed reusing the **Social Media Manager agent's** IG pipeline
as the shortcut. That does not hold:
- The SMM agent (`~/Desktop/Social Media Manager Agent`) has NO built IG pull. Its
  only code is `daemon/heartbeat.js`, which explicitly does not touch any social API.
- Its token is unverified (its own Step Zero is "verify the token first").
- Its IG scope is comment read/reply, a different Graph endpoint/permission than the
  post reach/engagement metrics this page needs.

So there is nothing to reuse there. Do not go down that path.

## The real reusable asset: Vantus's own IG stack

The Analytics page was built inside Vantus and already has a proven IG ingest:
- `netlify/functions/sync-instagram.js` (283 lines): pulls `/me/media` +
  `/{media-id}/insights` from Meta Graph, builds the exact `metrics` jsonb the page
  reads (reach, likes, comments, saved, shares, total_interactions, views,
  engagement_rate), upserts into `account_posts`, reads the token from
  `connected_accounts`.
- `netlify/functions/oauth-instagram-{start,callback,deauthorize}.js`: the full
  connect flow that stores an encrypted long-lived token in `connected_accounts`.
- A working Meta app already sits behind these.

This IS the ingest the page expects. Reuse it instead of building new.

## Two routes (pick when you resume)

**Route A — share Vantus's Supabase (simplest).**
Point the new project's Analytics page at Vantus's Supabase (`VITE_SUPABASE_URL` +
anon key). It reads `connected_accounts` + `account_posts` directly. Zero new ingest.
Only viable if you're OK with the page reading Vantus's data.

**Route B — port the proven code into the new project.**
1. Run the table SQL (the create for `connected_accounts` + `account_posts`).
2. Port `sync-instagram.js` + `oauth-instagram-*` + the token `decrypt` helper.
   The new project is a static SPA with no `/api`, so translate these from Netlify
   functions to **Supabase Edge Functions (Deno)** — the logic ports directly
   (Graph calls, metric mapping, upsert); it is a translation, not a rebuild.
3. Reuse Vantus's existing **Meta app credentials** (App ID/secret, IG business
   account, long-lived Graph token) so you skip a fresh app review. Place secrets in
   Supabase function secrets, never in chat/repo.
4. Connect an IG account via the ported OAuth flow (or seed a `connected_accounts`
   row with the token directly for a first pull).

## 30-second proof (do first, either route)

Seed one row into `account_posts` (any account_id + a `metrics` jsonb with a few
numbers) and confirm the page renders the chart + stat cards + top performers. This
proves the read/render path before any ingest work.

## Freshness + Analyze (optional, later)

- Scheduler to re-pull every few hours: Supabase `pg_cron` calling the sync Edge
  Function, or a launchd job like the engine's harvest worker.
- The page's "Analyze" button hits `/api/agent-action` (a Claude call). Decide what
  it should do (e.g. "turn my top performers into content briefs") before wiring it.

## Platform status

- Instagram: doable now via the reused Vantus stack. Needs a Meta app with insights
  permission (Vantus's app already has it) + an IG Business/Creator account linked to
  a FB Page.
- TikTok: gated (app approval). Vantus has `sync-tiktok.js` scaffolded for when it clears.
- YouTube: Data API v3 (API key + OAuth). Vantus has `sync-youtube.js`. Later.

## Bottom line

Shortest path to live IG data: run the SQL, then reuse Vantus's `sync-instagram.js`
(+ OAuth + Meta app), not the SMM agent. Seed a test row first to prove render.
