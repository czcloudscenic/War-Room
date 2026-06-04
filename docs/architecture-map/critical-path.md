# Critical Path — the Idea Engine + Agent-Action Spine

Two seams matter in Vantus. The **agent-action spine** is the trunk every AI feature flows through; the **Idea Engine flow** is the newest, highest-value path and the current frontier.

> Citations are `file:line`. Operation kind tagged per step.

## Spine A — Idea Engine (the new headline flow)

| # | Step | Where | Kind |
|---|---|---|---|
| 1 | User opens **Idea Engine**, picks funnel stage (TOF/MOF/BOF) + content type + optional own-idea in the setup box | `src/ui/routes/IdeaEngineRoute.jsx:147` | UI |
| 2 | `cook()` → `POST /api/agent-action` `{action:'muse_idea_list', funnelStage, contentType, userIdea, inspiration}` | `IdeaEngineRoute.jsx:39` → `agent-action.js:1459` | `[HTTP]` |
| 3 | Auth + rate-limit gate | `_lib/requireUser.js:58`, `_lib/rateLimit.js:34` | `[AUTH]` |
| 4 | `muse_idea_list` pulls the account's real top performers + voice samples | `agent-action.js:1185` → `getSyncedDigest:1321` (reads `connected_accounts`, `account_posts`) | `[DB]` |
| 5 | Optional Tavily creator research (when a creator is named) | `agent-action.js:1158` (`_researchDigest`) → Tavily | `[API]` |
| 6 | Prompt assembled with WINNING_FORMULA + funnel + content-type + levers; one **Opus 4.8** call → 6 concept tiles | `agent-action.js:1236` | `[LLM]` |
| 7 | Tiles render; user clicks one → `openIdea()` → `POST muse_film_brief` `{title,hook,lever,format,funnelStage}` | `IdeaEngineRoute.jsx:53` → `agent-action.js:1247` | `[HTTP]` |
| 8 | `muse_film_brief` generates one full shootable brief on **Opus 4.8** (story-sequence aware structure) | `agent-action.js:1289` | `[LLM]` |
| 9 | User hits "Send to pipeline" → insert `content_items` directly via the sb client | `IdeaEngineRoute.jsx:83` | `[DB]` |

**Why two stages:** generating six full briefs at once on Opus would blow the 26s function timeout, so the list is cheap and each brief is generated on demand (step 7-8). Open risk: even one brief + stacked research can still approach the cap (Fix #2), and the brief call has no client-side timeout guard (Fix #4).

---

## Spine B — Agent Action (the trunk)

Every AI button (write content, research, analyze, ideate) flows through one authenticated router.

| # | Step | Where | Kind |
|---|---|---|---|
| 1 | UI action → token-injecting fetch | `src/services/apiFetch.js:17` | — |
| 2 | Fresh access token from the Supabase session | `apiFetch.js:18` → `supabaseClient.js:15` | `[AUTH]` |
| 3 | `POST /api/agent-action` `{action, payload, client_id}` + Bearer | `agent-action.js:1459` | `[HTTP]` |
| 4 | Auth gate (JWT + admin/approved-client) | `_lib/requireUser.js:58` | `[AUTH]` |
| 5 | Rate limit `agent-action:<user.id>` 60/min | `_lib/rateLimit.js:34` | `[RL]` |
| 6 | Per-client brand voice from `clients.brand_voice_md` | `agent-action.js:122` | `[DB]` |
| 7 | Switch dispatches to one of 15 handlers | `agent-action.js:1459-1474` | — |
| 8 | Claude call via shared `ai()` — model per caller (Haiku default; Opus 4.8 for the 3 Muse-creative actions) | `agent-action.js:166` | `[LLM]` |
| 9 | Result written back (content_items / cid_library) or returned (insights/ideas) | various | `[DB]` |
| 10 | Every invocation logged to `agent_events` | `agent-action.js:74` | `[DB]` |
| 11 | Mapped actions mirrored to Slack | `agent-action.js:146` | `[API]` |

---

## Spine C — Connect → Sync → (analyze / ideate)

The data pipeline both Analytics and the Idea Engine depend on.

| # | Step | Where | Kind |
|---|---|---|---|
| 1 | "Connect" → `POST /api/oauth/<p>/start` → mint CSRF state, return authorize URL | `ConnectedAccountsCard.jsx:71` → `oauth-*-start.js` → `_lib/oauth.js:65` | `[DB]` |
| 2 | Platform consent → callback exchanges code, fetches profile, upserts account + **encrypted** token | `oauth-*-callback.js` → `_lib/oauth.js` → `_lib/crypto.js:16` | `[API]`/`[DB]` |
| 3 | "Sync now" → `POST /api/sync/<p>` → decrypt token, pull posts + metrics, upsert `account_posts` | `sync-youtube.js:108` → `_lib/crypto.js` | `[API]`/`[DB]` |
| 4 | `account_posts` feeds AnalyticsRoute (charts/top performers) AND the Idea Engine (`getSyncedDigest`) | `AnalyticsRoute.jsx:104`, `agent-action.js:1321` | `[DB]` |
| 5 | Platform revoke → deauth/data-deletion webhook verifies `signed_request`, deletes account+token, logs `data_deletion_requests` | `oauth-*-data-deletion.js:18` → `_lib/oauth.js` | `[API]`/`[DB]` |
