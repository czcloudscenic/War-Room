# Node Catalog

Every node from the map, grouped by cluster. `★` = on the critical path. `☠` = dead code / schema drift.

## Contents
- [Client](#client)
- [Routes](#routes)
- [UI / Apps](#ui--apps)
- [Core / Services](#core--services)
- [Server (Netlify Functions)](#server-netlify-functions)
- [Data (Supabase)](#data-supabase)
- [External APIs](#external-apis)

---

## Client

### main.jsx
`src/main.jsx:1` — Vite entry stub.
- **Plain:** The app's front door; does almost nothing but hand off to the big main file.
- Single line `import './App.jsx'`; the real ReactDOM mount is at the bottom of App.jsx (`:1342`) — unusual.

### ★ App.jsx
`src/App.jsx:44` — Root: auth gate, session/role state, multi-tenant client roster, all realtime subscriptions, nav-based route switching.
- **Plain:** The brain of the app — logs you in, decides what you can see, keeps the client list live, shows whichever screen the menu points at.
- Two components in one file: `App` (gate, `:44`) + `Vantus` (shell, `:390`). `ADMIN_EMAILS` + `cloudscenic.com` allowlist `:41`.
- Realtime on `content_items` / `clients` / `notifications` / `client_users`. stuckGuard auth-lock recovery `:241-277`.

---

## Routes

### DashboardRoute.jsx
`src/ui/routes/DashboardRoute.jsx:56` — Composes the home dashboard (metrics, CommandInput, agent grid, ActivityFeed, OpsBoard). Presentational.

### ContentRoute.jsx
`src/ui/routes/ContentRoute.jsx:18` — Platform-tabbed (IG/TikTok/YouTube) container rendering ContentPipelineBoard(s). 8-stage array `:18`; IG renders two boards. Data/handlers are props from App.

### AgentsRoute.jsx
`src/ui/routes/AgentsRoute.jsx:4` — 6-line pass-through to AgentChatPage.

### ★ AnalyticsRoute.jsx
`src/ui/routes/AnalyticsRoute.jsx:81` — Reads `connected_accounts` + `account_posts`, computes per-platform metrics/top performers, runs the AI "why these won" analysis.
- **Plain:** The analytics page — how your posts performed and why the best ones did well.
- account_posts limit 500 `:104`, realtime `:128`. "Why these won" → `scrappy_analyze_performance` `:171`. topPerformers ranks by engagement_rate `:262`. Per-card aspect ratio `:565`; Insights panel `:501`; per-card "Why it won" `:596`.

### SettingsPage.jsx
`src/ui/settings/SettingsPage.jsx:5` — Workspace config (localStorage), display-only AI toggles, static team list; hosts ConnectedAccountsCard `:258`.

---

## UI / Apps

### CommandInput.jsx
`src/ui/dashboard/CommandInput.jsx:23` — NL command box dispatching through `core/routeTask.js`.

### ActivityFeed.jsx
`src/ui/dashboard/ActivityFeed.jsx:61` — Realtime feed of `agent_events` for the current client.

### AgentChatPage.jsx
`src/ui/agents/AgentChatPage.jsx:166` — Multi-agent chat; free chat → `/api/chat` (sonnet-4-6) `:171`; action buttons → `/api/agent-action` `:291-313`. History in `localStorage vantus_agent_hists`.

### ContentPipelineBoard.jsx
`src/ui/pipeline/ContentPipelineBoard.jsx:16` — Stage-column kanban with Muse caption/script quick-buttons → `muse_write_content`.

### EditContentModal.jsx
`src/ui/pipeline/EditContentModal.jsx:11` — Content editor with SOP gates `:11-32` + a client-side Google Drive resumable upload (hardcoded `GDRIVE_CLIENT_ID` `:42`).

### ★ ConnectedAccountsCard.jsx
`src/ui/settings/ConnectedAccountsCard.jsx:6` — Per-platform OAuth connect/sync/disconnect; generic `*_connected`/`*_oauth_error` toast handler `:45`. Connect → `/api/oauth/<p>/start` `:71`; Sync → `/api/sync/<p>` `:109`; disconnect deletes `connected_accounts` `:92`.

### AddClientModal.jsx
`src/ui/clients/AddClientModal.jsx:86` — Create/edit/archive a `clients` row; logo → Storage `client-logos`; embeds ClientTeamPanel.

### ClientTeamPanel.jsx
`src/ui/clients/ClientTeamPanel.jsx:24` — Invite/approve/reject/remove on `client_users` with realtime; approval unlocks the pending-invite screen.

### CIDPage.jsx
`src/apps/competitor-intel/CIDPage.jsx:73` — Competitor intel: Apify scrape `:73`, AI adaptation, briefs, A/B, hook lab. Actions `cid_build_brief` `:272`, `cid_ab_variations` `:287`, `scrappy_hook_analysis` `:688`. **BROKEN write path** at `:381,:442` (see bugs).

### ArtgridScoutPage.jsx
`src/apps/artgrid/ArtgridScoutPage.jsx:26` — Footage briefs: bulk → `artgrid_scout`; single → `/api/chat` (haiku-4-5) `:72`.

### AdROIHub.jsx
`src/apps/ad-roi/AdROIHub.jsx:41` — Local ad ROI tracker + AI analysis (`/api/chat` sonnet-4-6). localStorage only.

### ☠ QuickActionsDashboard.jsx
`src/ui/dashboard/QuickActionsDashboard.jsx:26` — **DEAD.** Imported `App.jsx:20`, zero JSX usages. Superseded by CommandInput.

> Also dead (shared): `TypingTask.jsx`, `PlaceholderPage.jsx` (imported `App.jsx:32,33`, never rendered).

---

## Core / Services

### ★ apiFetch.js
`src/services/apiFetch.js:17` — fetch() wrapper injecting `Authorization: Bearer` from the session. Calls `getSession()` per request `:18`.

### supabaseClient.js
`src/services/supabaseClient.js:15` — Singleton `sb` client from Vite env vars (throws at import if missing). `DB_CONNECTED` hardcoded `true` `:14`.

### routeTask.js
`src/core/routeTask.js:9` — Keyword-scores agents, then sequentially calls `/api/chat` per agent (sonnet-4-6, max_tokens 400 `:34`). Serial await loop.

### agentRegistry.js
`src/core/agentRegistry.js:5` — Four agents (Sean, Muse, Scrappy, Artgrid) + routing keywords + short/full prompts. Brand voice injected per-request.

### memory.js
`src/core/memory.js:51` — Per-agent localStorage memory (`vantus_mem_<agent>`, `vantus_icps`) folded into system prompts.

### constants.js
`src/utils/constants.js:3` — NAV structure, pipeline status colors, format/platform/pillar lists (placeholders).

---

## Server (Netlify Functions)

### ★ requireUser.js
`netlify/functions/_lib/requireUser.js:58` — JWT verify via `/auth/v1/user` `:70`; authorizes `@cloudscenic.com` admins (email-suffix, `:83`) or approved `client_users`. CORS allowlist regex `:26` (fail-open on write — bug).

### rateLimit.js
`netlify/functions/_lib/rateLimit.js:34` — In-memory sliding window (default 30/60s). Per-warm-Lambda; not distributed. Only `chat.js` + `agent-action.js` use it.

### ★ agent-action.js
`netlify/functions/agent-action.js:1199` — Single POST router for 13 AI actions; gated by requireUser + rateLimit(60/min), loads brand voice `:122`, dispatches, logs to `agent_events` `:72`, mirrors to Slack `:143`. `ai()` → `claude-haiku-4-5-20251001` `:166`. `scrappy_analyze_performance` `:1087`. **Dead handler:** `muse_from_brief` `:669`. Three handlers inline a duplicate Anthropic fetch (`:800,:902,:966`).

### ★ chat.js
`netlify/functions/chat.js:45` — Authenticated pass-through to Anthropic; forwards client body (model chosen client-side). rateLimit(30/min). No max_tokens/model validation (bug).

### notify.js
`netlify/functions/notify.js:56` — Writes `notifications`, fans out Resend + Slack + n8n (per-client URLs). No rateLimit; user fields unescaped into email HTML `:138-144` (bug).

### apify-scrape.js
`netlify/functions/apify-scrape.js:10` — Two-mode Apify proxy (start → poll). No rateLimit (burns credits). Returns 200 on errors.

### unsplash.js
`netlify/functions/unsplash.js:7` — GET proxy to Unsplash search. No rateLimit.

### ★ _lib/oauth.js
`netlify/functions/_lib/oauth.js:65` — CSRF state create/consume in `oauth_states`; upserts `connected_accounts` + `connected_account_tokens`. Tokens stored **plaintext** `:122` (bug).

### oauth-*-start.js
`netlify/functions/oauth-youtube-start.js:43` — Authenticated POST (IG/TikTok/YouTube): mint state, return authorize URL. YT adds `access_type=offline&prompt=consent` `:63`.

### ★ oauth-*-callback.js
`netlify/functions/oauth-youtube-callback.js:52` — GET callbacks (no bearer; state-secured): exchange code, fetch profile, upsert, 302. IG = 2-step, no refresh token; TT/YT = refresh tokens.

### ☠ oauth-*-deauthorize / data-deletion (×6)
`netlify/functions/oauth-instagram-data-deletion.js:13` — Unverified logging stubs; never verify signatures or delete data (bug).

### ★ sync-{ig,tt,yt}.js
`netlify/functions/sync-youtube.js:108` — Pull recent posts + metrics, upsert `account_posts` (conflict `account_id,platform_post_id`). TT/YT auto-refresh tokens; IG none. No rateLimit; sync-instagram serial 30-call loop + unused declared timeout (`sync-instagram.js:18`).

---

## Data (Supabase)

| Table | Defined / referenced | Role | RLS posture |
|---|---|---|---|
| `clients` | `20260523_clients_multitenant.sql:13` | Tenant registry (brand voice, webhooks) | Admin r/w; VitalLyfe seeded (bug) |
| `profiles` | `002_profiles.sql:4` | auth.users → role map | Self-read + admins-read-all + **wide-open `USING(true)`** `:20` (bug) |
| `client_users` | `20260525_client_users_allowlist.sql:25` | External-login allowlist + approval | Admin r/w; approved self-read; realtime |
| `content_items` | `20260526_content_items_baseline.sql:24` | Content pipeline rows | Scoped client SELECT/UPDATE; PK is **text** `:25` (drift) |
| `agent_events` | `20260523_agent_events.sql:8` | Agent audit log | Admin read; service-role writes; realtime |
| `notifications` | `20260523_notifications.sql:7` | Durable client alerts | Admin r/u; dedupe index; realtime |
| ★ `connected_accounts` | `20260601_connected_accounts.sql:13` | Linked social metadata | Admin + user-self CRUD |
| `connected_account_tokens` | `20260601_connected_accounts.sql:66` | OAuth secrets, 1:1 | **RLS enabled, zero policies → service-role only (correct)**; tokens plaintext (bug) |
| ★ `account_posts` | `20260601_connected_accounts.sql:80` | Synced posts + metrics | Admin + user-own-account read; engagement_rate index |
| `oauth_states` | `20260601_connected_accounts.sql:124` | CSRF state, 10-min | Service-role only; no cleanup job (bug) |
| ☠ `cid_library` | ref `agent-action.js:822` | Hook/CTA library | **No CREATE TABLE migration** (drift) |
| ☠ `cid_performance` | ref `CIDPage.jsx:442` | Post-publish perf log | **No migration + browser anon write** (drift/bug) |

---

## External APIs

| Service | Used by | Notes |
|---|---|---|
| Anthropic | agent-action `:166`, chat | haiku-4-5 server-side; sonnet-4-6 client chat |
| Tavily | agent-action `:297` | Scrappy research/collab |
| Apify | apify-scrape `:34` | clockworks/free-tiktok-scraper + google-search-scraper |
| Unsplash | unsplash `:7` | stock photo search |
| Resend | notify `:12` | email to hardcoded ADMIN_EMAILS |
| Slack | agent-action `:143`, notify | per-client webhook + global fallback |
| n8n | notify `:56` | per-client webhook |
| Meta / IG Graph | sync-instagram `:108` | 60-day token, no refresh |
| TikTok | sync-tiktok `:123` | access + refresh tokens |
| Google / YouTube | sync-youtube `:108` | separate from Supabase Google sign-in |
| Google Drive | EditContentModal `:67` | client-side resumable upload |
