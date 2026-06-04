# Node Catalog

> Regenerated 2026-06-04. `★` = on a critical path. `☠` = dead code. Grouped by cluster.

## Contents
- [Client](#client) · [Routes](#routes) · [UI / Apps](#ui--apps) · [Core / Services](#core--services) · [Server](#server-netlify-functions) · [Data](#data-supabase) · [External](#external-apis)

---

## Client
### main.jsx
`src/main.jsx:1` — Vite entry stub; imports App.jsx (which self-mounts).
### ★ App.jsx
`src/App.jsx:44` — Root: auth gate, session/role state, multi-tenant roster, realtime subs, nav routing. Mounts the Idea Engine route (`:1299`). **Note:** `content_changes` realtime channel is NOT client-scoped (`:490`).

## Routes
### DashboardRoute.jsx
`src/ui/routes/DashboardRoute.jsx:56` — Home dashboard composition.
### ContentRoute.jsx
`src/ui/routes/ContentRoute.jsx:18` — Platform-tabbed pipeline boards.
### AgentsRoute.jsx
`src/ui/routes/AgentsRoute.jsx:4` — Pass-through to AgentChatPage.
### ★ AnalyticsRoute.jsx
`src/ui/routes/AnalyticsRoute.jsx:81` — Reads `account_posts`/`connected_accounts`, computes metrics/top performers, runs "Why these won" (`scrappy_analyze_performance` `:174`). **Bug:** ranks top set by engagement_rate while backend returns top-6 — scoping mismatch (`:262`).
### ★ IdeaEngineRoute.jsx (NEW)
`src/ui/routes/IdeaEngineRoute.jsx:13` — Two-stage Muse flow: `cook()` → `muse_idea_list` (`:39`) renders 6 concept tiles; `openIdea()` → `muse_film_brief` (`:53`) builds one full brief on open; `sendToPipeline()` inserts `content_items` via the sb client (`:83`). Setup box captures funnel/content-type/own-idea/creators (`:147`). **Bugs:** client-generated `Date.now()` id (`:73`), no brief timeout guard (`:48`), null-client insert (`:81`).
### SettingsPage.jsx
`src/ui/settings/SettingsPage.jsx:5` — Workspace config; AI toggles now persist, invite labeled "coming soon" (Fix #15). Hosts ConnectedAccountsCard.

## UI / Apps
- **CommandInput.jsx** `:23` — NL command box → routeTask.
- **ActivityFeed.jsx** `:61` — realtime `agent_events`.
- **AgentChatPage.jsx** `:166` — multi-agent chat (sonnet-4-6) + action buttons.
- **ContentPipelineBoard.jsx** `:16` — stage kanban; Muse caption/script buttons.
- **EditContentModal.jsx** `:11` — editor + Google Drive resumable upload.
- ★ **ConnectedAccountsCard.jsx** `:6` — OAuth connect/sync/disconnect.
- **AddClientModal.jsx** `:86` / **ClientTeamPanel.jsx** `:24` — client CRUD + invite/approve.
- **CIDPage.jsx** `src/apps/competitor-intel/CIDPage.jsx:73` — competitor intel; **writes now go through the sb client** (`:381,:434`) — the ReferenceError is fixed.
- **ArtgridScoutPage.jsx** `:26` / **AdROIHub.jsx** `:41` — footage briefs / ad ROI.
- ☠ **QuickActionsDashboard.jsx** `:26` — imported in App.jsx, never rendered. Dead.

## Core / Services
- ★ **apiFetch.js** `:17` — token-injecting fetch.
- **supabaseClient.js** `:15` — singleton `sb`; `DB_CONNECTED` hardcoded true (`:14`).
- **routeTask.js** `:9` — NL agent router (sonnet-4-6, serial).
- **agentRegistry.js** `:5` — 4 agents + prompts.
- **memory.js** `:51` — per-agent localStorage memory.
- **constants.js** `:5` — NAV (now includes Idea Engine, id `ideas`).

## Server (Netlify Functions)
### ★ requireUser.js
`netlify/functions/_lib/requireUser.js:58` — JWT + admin/approved-client gate; **CORS now 403s non-allowlisted origins** (`isForbiddenOrigin :39`, Fix #17).
### rateLimit.js
`_lib/rateLimit.js:34` — in-memory sliding window; **now wired into all 8 protected functions** (Fix #4).
### ★ agent-action.js
`netlify/functions/agent-action.js:1459` — single POST router for 15 actions. `ai()` now takes a model param (`:166`). **3-tier model split:** Haiku 4.5 (most) · Opus 4.8 (`muse_ig_ideas:1074`, `muse_idea_list:1236`, `muse_film_brief:1289`) · Sonnet 4.6 (frontend chat). Idea Engine helpers/constants `:1142-1345` (`getSyncedDigest:1321`, `_researchDigest:1158`, `WINNING_FORMULA`, `FUNNEL`, `CONTENT_TYPE`). **Bugs:** Opus/timeout risk, silent parse-failures, dead `muse_from_brief:669`, service-role getSyncedDigest.
### ★ chat.js
`netlify/functions/chat.js:45` — Anthropic proxy; **now validates model allowlist + clamps max_tokens 4096** (`:16-62`, Fix #8).
### notify.js
`netlify/functions/notify.js:56` — notifications + Resend/Slack/n8n fanout; rateLimit (Fix #4); **user fields HTML-escaped** via `escapeHtml` (`:24,:134`, Fix #7).
### apify-scrape.js / unsplash.js
`:10` / `:7` — proxies; rateLimit added (Fix #4). Apify needs current billing to function.
### ★ _lib/oauth.js
`netlify/functions/_lib/oauth.js:65` — CSRF state, account/token upserts (**now encrypted**), expired-state cleanup (Fix #14), `deleteConnectedAccountByPlatformId` for revoke.
### _lib/crypto.js (NEW)
`netlify/functions/_lib/crypto.js:16` — AES-256-GCM encrypt/decrypt for tokens at rest, keyed by `TOKEN_ENC_KEY`. `v1:iv:tag:cipher` format; legacy plaintext decrypts unchanged; degrades + warns if key unset (Fix #6).
### oauth-*-start.js / oauth-*-callback.js
`:43` / `:52` — connect + token exchange (tokens stored encrypted).
### oauth-*-deauth / data-deletion
`netlify/functions/oauth-instagram-data-deletion.js:18` — **now real:** Meta `signed_request` verified, account+token deleted, `data_deletion_requests` row written; `oauth-data-deletion-status.js` serves the status URL (Fix #5).
### ★ sync-{ig,tt,yt}.js
`netlify/functions/sync-youtube.js:108` — pull posts + metrics, **decrypt tokens on read** (Fix #6), rateLimit (Fix #4); sync-instagram insight loop now timeout + concurrency-capped (Fix #12).

## Data (Supabase)
| Table | Defined | Notes |
|---|---|---|
| `clients` | `20260523_clients_multitenant.sql:13` | VitalLyfe seed moved to `supabase/seed/dev_seed.sql` (Fix #16) |
| `profiles` | `002_profiles.sql:4` | wide-open policy **dropped** (Fix #10) |
| `client_users` | `20260525_client_users_allowlist.sql:25` | invite allowlist; realtime |
| `content_items` | `20260526_content_items_baseline.sql:24` | text PK; Idea Engine + App mint ids client-side |
| `agent_events` | `20260523_agent_events.sql:8` | service-role writes; realtime |
| `notifications` | `20260523_notifications.sql:7` | realtime, client-scoped |
| `connected_accounts` | `20260601_connected_accounts.sql:13` | admin + user-self CRUD |
| `connected_account_tokens` | `20260601_connected_accounts.sql:66` | **tokens AES-256-GCM encrypted** (Fix #6); service-role only |
| ★ `account_posts` | `20260601_connected_accounts.sql:80` | read by Analytics + scrappy_analyze + Idea Engine |
| `oauth_states` | `20260601_connected_accounts.sql:124` | service-role only; **expiry cleanup** (Fix #14) |
| `data_deletion_requests` (NEW) | `20260604_data_deletion_requests.sql:4` | OAuth deletion audit; confirmation_code PK; service-role only (Fix #5) |
| `cid_library` | `20260603_cid_library_baseline.sql:4` | **migration added** (Fix #2); admin-only RLS |
| `cid_performance` | `20260603_cid_performance.sql:4` | **migration added** (Fix #1/#2); admin-only RLS |

## External APIs
| Service | Used by | Notes |
|---|---|---|
| Anthropic | agent-action `:166`, chat | **3-tier:** Haiku / Opus 4.8 / Sonnet 4.6 |
| Tavily | agent-action `:281` | Scrappy research + Idea Engine creator research |
| Apify | apify-scrape `:34` | billing must be current |
| Unsplash | unsplash `:7` | stock photos |
| Resend | notify `:12` | email (fields escaped) |
| Slack / n8n | notify, agent-action | per-client webhooks |
| Meta / IG | sync-instagram `:108` | 60-day token; signed_request on deauth |
| TikTok | sync-tiktok `:123` | refresh tokens |
| Google / YouTube | sync-youtube `:108` | consent screen in Testing mode |
| Google Drive | EditContentModal `:67` | client-side resumable upload |
