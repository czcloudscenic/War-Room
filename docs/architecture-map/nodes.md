# Node Catalog

Every significant file, function, table, and external service in Vantus — grouped by cluster.

★ = on the critical path
✕ = dead code / not deployed
⚙ NEW = added 2026-05-25 in the auth-restore session

---

## ☁️ Client UI (`src/`)

### ★ `main.jsx` — mount point
- **Path:** `src/main.jsx` (1 line)
- **Role:** React 19 `createRoot` mount; renders `<App />`.
- **Plain English:** The very first line of code that runs when you open the site. Connects React to the page.

### ★ `App.jsx` — root + state + auth gate
- **Path:** `src/App.jsx` (1,646 lines)
- **Role:** Root React tree: 4-way auth gate (admin / approved client / pending invite / unknown), `currentClient` state, content/notifications/clients fetch + realtime subs, layout shell, every nav route handler.
- **Plain English:** The big brain of the frontend. Checks who is logged in, picks the active client, loads all the data, decides which page to show based on the sidebar item you clicked.
- **Notes:**
  - L51: `ADMIN_EMAILS = ["cz@cloudscenic.com","dv@cloudscenic.com","ss@cloudscenic.com"]`
  - L72: `setupSession` — branches on @cloudscenic.com (admin) vs `client_users` allowlist (external)
  - PendingApprovalScreen renders when status='pending'; auto-unlocks via realtime when admin approves
  - L204: 4s `stuckGuard` timeout forces `checking=false` to survive supabase-js auth-lock hangs
  - L1200+: giant render switch (one block per nav id)

### `LoginScreen.jsx` — Google OAuth button
- **Path:** `src/ui/layout/LoginScreen.jsx`
- **Role:** "Continue with Google" button calling `sb.auth.signInWithOAuth` + URL-error display.
- **Plain English:** The login page. Shown to anyone without a session. Admins (@cloudscenic.com) land on full Vantus; approved external clients land on ClientView; pending invites land on PendingApprovalScreen.
- **Notes:** Renders `sb.auth.signInWithOAuth` with `hd: cloudscenic.com` hint for admin path. External clients sign in with the same Google button — gated by `client_users` allowlist. Parses URL `?error=` params for surfaced auth failures.

### `AddClientModal.jsx` — create + edit + team
- **Path:** `src/ui/clients/AddClientModal.jsx`
- **Role:** Multi-purpose modal for client onboarding/edit/archive; embeds `ClientTeamPanel` in edit mode for invite/approve/reject flow; handles logo upload to Supabase Storage.
- **Plain English:** The form to add a new client (or edit one). In edit mode it also shows the Team Access panel where admins invite client teammates and approve their login requests.
- **Notes:**
  - Edit mode embeds `ClientTeamPanel.jsx` (added 2026-05-25, commit `19b6235`)
  - New `slack_webhook_url` field for per-client Slack routing (2026-05-25, commit `702f867`)
  - Uploads to `client-logos` bucket via `sb.storage.from(...)`
  - `fontSize:16` on inputs to dodge iOS auto-zoom

### ⚙ NEW `ClientTeamPanel.jsx` — invite/approve/reject
- **Path:** `src/ui/clients/ClientTeamPanel.jsx`
- **Role:** Embedded inside Edit Client modal. Lets admins invite an external email, then approve or reject when that email signs in.
- **Plain English:** The "Team Access" tab inside Edit Client. You type Natalia's email here, she logs in with Google, you click Approve, her dashboard unlocks without her refreshing.
- **Notes:** Reads/writes `client_users` rows. Realtime channel keeps both sides in sync.

### ★ `AgentChatPage.jsx` — chat UI for 7 agents
- **Path:** `src/ui/agents/AgentChatPage.jsx`
- **Role:** Per-agent chat panel: prompt builder, message thread, quick-action buttons, agent-action invoker.
- **Plain English:** Where you click on an agent (Sean, Muse, etc.) and chat with them. Calls Claude through `/api/agent-action` for quick actions.
- **Notes:** Holds the actual agent persona prompts inline (~L35-130). Stores chat history in localStorage.

### ★ `ActivityFeed.jsx` — live agent_events feed
- **Path:** `src/ui/dashboard/ActivityFeed.jsx`
- **Role:** Self-fetches last 60 `agent_events` for `currentClient` + subscribes to INSERT realtime.
- **Plain English:** The "Live Activity" panel on the Dashboard. Shows real agent events as they happen, not fake theater.
- **Notes:** Filter: `client_id=eq.${clientId}`. Pre-Move-2 this used a fake 2.2s loop pulling random items.

### `OpsBoard.jsx` — Task Board kanban
- **Path:** `src/ui/dashboard/OpsBoard.jsx`
- **Role:** In-memory kanban (Backlog/InProgress/Completed) with edit + delete + auto-advance intervals.
- **Plain English:** The Task Board where you add and track tasks. Currently just lives in memory — refresh and tasks reset.

### `ContentPipelineBoard.jsx` — kanban for content_items
- **Path:** `src/ui/pipeline/ContentPipelineBoard.jsx`
- **Role:** Stage-column kanban view rendering content_items by status.
- **Plain English:** The horizontal kanban view where each content piece lives in a column based on its status.

### `EditContentModal.jsx` — edit a content piece
- **Path:** `src/ui/pipeline/EditContentModal.jsx`
- **Role:** Drawer modal to edit a content_items row (title, status, caption, script, files, client_note).
- **Plain English:** The form that opens when you click a content card. Lets you edit the piece end-to-end.

### `ClientView.jsx` — client-facing portal
- **Path:** `src/ui/client/ClientView.jsx`
- **Role:** Read/approve view shown to clients (role=client) when they log in.
- **Plain English:** The simpler version of the dashboard that the agency's clients see when they log in.

### `CIDPage.jsx` — Competitor Intel
- **Path:** `src/apps/competitor-intel/CIDPage.jsx`
- **Role:** Competitor Intel dashboard: search query → scrape via `/api/cid-scrape` + `/api/apify-scrape` → `cid_posts`.
- **Plain English:** Where you type a creator name and Vantus scrapes their recent posts to study what works.

### `BriefGenPage.jsx` — PDF brief → generated content
- **Path:** `src/apps/brief-gen/BriefGenPage.jsx`
- **Role:** Drag-PDF zone → pdfjs extract text → `/api/agent-action muse_from_brief` → batch INSERT content_items.
- **Plain English:** Drop a PDF brief and Muse reads it, generates Reels + Stories, adds them to the tracker.
- **Notes:** Uses `pdfjs-dist` (the 405KB bundle bloat — Fix #11 dynamic-imports it).

### ✕ `HiggsfieldStudio.jsx` — WIP, untracked
- **Path:** `src/apps/higgsfield/HiggsfieldStudio.jsx` (NOT IN GIT)
- **Role:** Half-built Higgsfield AI image/video gen UI.
- **Notes:** File exists on disk but never committed. Live `/api/higgsfield` returns 404. Must ship together with `netlify/functions/higgsfield.js` + the dirty `apps.config.js` + `constants.js` edits in one commit, or be deleted.

### Smaller pages (not detailed)
`AppsPage`, `SettingsPage`, `ICPPage`, `TeamBroadcast`, `ReferencesPage`, `SkillsPage`, `AdROIHub`, `ArtgridScoutPage`, `HeroGeneratorPage`, `ShotRefScout`, `QuickActionsDashboard`, `AgentCard`, `AgentAvatar`, `MetricCard`, `Card`, `PlaceholderPage`, `TypingTask`, `AppPlaceholder`, `PendingApprovalScreen`.

---

## 🛣️ API Routes (`netlify/functions/`)

### ★ `/api/agent-action` — agent-action.js
- **Path:** `netlify/functions/agent-action.js` (**1,302 lines — monolith**)
- **Role:** 16-action switch over `POST {action,payload,client_id}`; routes to muse_/sean_/lacey_/sam_/overseer_/artgrid_/scrappy_/cid_ handlers, logs to `agent_events`, posts to Slack. Per-client brand voice loaded from `clients.brand_voice_md` at request time.
- **Plain English:** The single endpoint every agent action goes through. The user clicks a button, Vantus POSTs `{action: "muse_write_content"}` here, and this file looks up the client's brand voice from Supabase, figures out what to do, calls Claude with the right voice baked into the prompt, writes the result to the database, tells Slack.
- **Notes:**
  - L18: `SLACK_AGENT_LABELS` for per-action post formatting
  - L67: `logAgentEvent` wrapper for agent_events table
  - L94: `getBrandContext(client_id)` — fetches `clients.name` + `clients.brand_voice_md`; falls back gracefully (Move 1, 2026-05-26)
  - L127: `model = claude-haiku-4-5-20251001` (upgraded from deprecated haiku-3)
  - 12 handler prompts interpolate `${brand.name}` + `${brand.voice}` (was hardcoded VitalLyfe before Move 1)
  - L1198: `exports.handler` with `requireUser` gate + `getBrandContext` call + switch at L1227 + try/catch/finally for logging
  - Holds 16 different handler functions inline — splitting deferred (Fix #4)

### `/api/chat` — chat.js
- **Path:** `netlify/functions/chat.js`
- **Role:** Thin proxy: parses request body, forwards to Anthropic Messages API server-side. Now gated by `requireUser`.
- **Plain English:** A pass-through that keeps the Anthropic API key on the server. The frontend never sees the key. Rejects anonymous callers.

### `/api/notify` — notify.js
- **Path:** `netlify/functions/notify.js` (227 lines)
- **Role:** Fires when client UPDATEs `content_items` status to Approved/Needs Revisions: persists to `notifications` + email (Resend) + Slack + n8n.
- **Plain English:** When a client approves or rejects a piece, this sends the email, posts to Slack, and saves the notification to the database so it survives a page refresh.
- **Notes:**
  - L8: `requireUser` import (loosened to accept any authenticated user with matching client_id)
  - L28: `insertNotification` helper for notifications table (Move 3)
  - L61: `requireUser(event)` gate
  - Per-client Slack + n8n routing: one Supabase fetch pulls both `slack_webhook_url` and `n8n_webhook_url` from the clients row; each falls back to its global env var (Fix #6 commit `702f867` for Slack; Fix #7 2026-05-26 added n8n in the same fetch)
  - `Prefer:resolution=ignore-duplicates` → unique index dedupes multi-tab POSTs

### `/api/cid-scrape` — cid-scrape.js
- **Path:** `netlify/functions/cid-scrape.js`
- **Role:** Bearer-token-gated function: requires `CID_BEARER_TOKEN`; scrapes IG/TikTok/Reddit posts → `cid_posts`.
- **Plain English:** Goes out to social platforms and pulls down competitor posts. Pre-existing bearer-token gate (not the new requireUser pattern).

### `/api/apify-scrape` — apify-scrape.js
- **Path:** `netlify/functions/apify-scrape.js`
- **Role:** Calls Apify actors for scraping (alternate path to cid-scrape). Now gated by `requireUser`.
- **Plain English:** Another scraping option using Apify (a scraping service).

### `/api/unsplash` — unsplash.js
- **Path:** `netlify/functions/unsplash.js`
- **Role:** Proxy to Unsplash search API for stock image references. Now gated by `requireUser`.
- **Plain English:** Lets you search Unsplash for reference photos. Called from the Shot Reference page.

### ✕ `/api/higgsfield` — NOT DEPLOYED
- **Path:** `netlify/functions/higgsfield.js` (UNTRACKED)
- **Role:** Higgsfield AI proxy — file exists locally but is untracked.
- **Notes:** Live `/api/higgsfield` → 404. UI references would fail if Higgsfield UI were ever wired.

### ★ ⚙ NEW `_lib/requireUser.js` — shared auth gate
- **Path:** `netlify/functions/_lib/requireUser.js` (100 lines)
- **Role:** Shared helper used by `chat`, `agent-action`, `notify`, `apify-scrape`, `unsplash`. Validates Supabase JWT via `/auth/v1/user`. Allows @cloudscenic.com admins OR emails approved in `client_users`.
- **Plain English:** The bouncer that every locked-down endpoint calls before doing any work. Either you are a Cloud Scenic admin, or your email has been approved in the invite list — otherwise the request gets a 401.
- **Notes:**
  - Added 2026-05-25 for Fix #5 (commit `2a9c9c1`)
  - Returns `{ ok, user: { id, email, role, client_ids } }` or `{ ok:false, reason }`
  - Uses `SUPABASE_SERVICE_KEY` as `apikey` for both `/auth/v1/user` lookup and `client_users` SELECT

---

## ⚙️ Core Services (`src/core/`, `src/services/`, `src/utils/`, `src/data/`)

### ★ `supabaseClient.js` — `sb` singleton
- **Path:** `src/services/supabaseClient.js` (15 lines)
- **Role:** Reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` from env, exports `sb` (createClient). Throws on missing env.
- **Plain English:** The connection to Supabase that every database query uses on the frontend.
- **⚠️** Throws at module-load if env vars missing — would crash the whole app.

### ★ ⚙ NEW `apiFetch.js` — auth header wrapper
- **Path:** `src/services/apiFetch.js` (25 lines)
- **Role:** Thin wrapper around `fetch()` that injects `Authorization: Bearer <access_token>` from the current Supabase session. Used by every call to the 5 gated functions.
- **Plain English:** A helper that automatically adds your login token to every request to the protected endpoints. Without it, the server returns 401.
- **Notes:**
  - Added 2026-05-25 for Fix #5 — 26 call sites across 11 files now use it
  - Calls `sb.auth.getSession()` inline; safe to call when not signed in (request goes out tokenless and the server returns 401)

### `memory.js` — agent memory store
- **Path:** `src/core/memory.js` (79 lines)
- **Role:** localStorage-backed per-agent memory + `buildSystemPrompt` composer + `updateAgentMemory` hook.
- **Plain English:** Where each agent's "memory" is stored in the browser. Builds the prompt sent to Claude.
- **Move 1 (2026-05-26):** Hardcoded VitalLyfe `seedMuseMemory()` removed (zero callers anyway). Per-client brand voice now flows server-side from `clients.brand_voice_md` via `agent-action.js:94 getBrandContext()`.

### `routeTask.js` — keyword → agent routing
- **Path:** `src/core/routeTask.js` (51 lines)
- **Role:** Dispatches command-input text to a specific agent via keyword match against `AGENT_KEYWORDS`.

### `agentRegistry.js` — agent prompts + keywords
- **Path:** `src/core/agentRegistry.js` (36 lines)
- **Role:** `AGENT_KEYWORDS` + `ROUTE_PROMPTS` — the actual agent persona seeds used in chat.
- **Note:** THIS is where agent prompts live (NOT `src/agents/*.agent.js` which is dead code).

### `constants.js` — NAV + status colors
- **Path:** `src/utils/constants.js` (37 lines)
- **Role:** Sidebar NAV array, `STATUS_COLOR` map, `FORMATS`/`PILLARS`/`PLATFORMS` dropdown options.
- **Note:** Dirty in working tree (Higgsfield CREATIVE entry uncommitted).

### `apps.config.js` — toggleable Apps registry
- **Path:** `src/apps/apps.config.js` (43 lines)
- **Role:** `DEFAULT_APPS` list + localStorage persistence (`loadApps`/`saveApps`/`isAppEnabled`).
- **Note:** Dirty in working tree (Higgsfield entry uncommitted).

### `hooks.js` — useIsMobile + useInterval
- **Path:** `src/utils/hooks.js` (32 lines)
- **Role:** Two shared hooks: `useIsMobile` (window.innerWidth<768 + resize listener), `useInterval` (setInterval ref-stable wrapper).
- **Note:** Mobile breakpoint: <768px.

### `seed.content.js` — static fallback content
- **Path:** `src/data/seed.content.js` (53 lines)
- **Role:** `INITIAL_CONTENT` + `VITAL_LYFE_SOP` — VitalLyfe-specific seed used as fallback when content_items is empty.
- **Note:** Tightly coupled to VitalLyfe — needs replacement for multi-tenant (Fix #14).

### `seed.agents.js` — agent identity + colors
- **Path:** `src/data/seed.agents.js` (46 lines)
- **Role:** `AGENTS_BASE` (8 agents) + `AGENT_TASKS` + `ACTION_COLORS`. Drives sidebar agent grid + activity feed colors.
- **Note:** Agent prompts NOT here — those live in agentRegistry.js + agent-action.js. `ACTIVITY_POOL` export was removed in Move 2 (fake theater gone).

### `seed.ops.js` — OpsBoard initial tasks
- **Path:** `src/data/seed.ops.js` (18 lines)

_(Removed 2026-05-26 — Fix #8 deleted `src/agents/`. Real agent personas live in `agentRegistry.js` + `agent-action.js`'s per-handler prompts.)_

---

## 🗄️ Data Layer (`supabase/migrations/`)

### ★ `clients` table — multi-tenant root
- **Migration:** `supabase/migrations/20260523_clients_multitenant.sql` (+ `20260525_clients_slack_webhook.sql`)
- **Columns:** `id, slug, name, brand_voice_md, brand_color, logo_url, primary_email, slack_channel_id, slack_webhook_url, n8n_webhook_url, status, archived_at`
- **Plain English:** The list of all clients. Every other data table points back to a row here via `client_id`.
- **Notes:** RLS: admin-only via `auth.jwt()->>'email' like '%@cloudscenic.com'`. Temp anon policies dropped 2026-05-25 (commit `852d915`). Public realtime via `supabase_realtime` publication. Seeded with VitalLyfe automatically.

### ★ `content_items` table — pipeline rows
- **Migration:** `supabase/migrations/20260526_content_items_baseline.sql` (Fix #10, 2026-05-26)
- **Columns (25):** `id text pk, title text not null, description, campaign, platform, type, format, stage, status, pillar, platforms text[], script, caption, cta, hashtags, seo_keywords, notes, start_week int, duration int, created_at timestamptz default now(), updated_at timestamptz default now(), files jsonb default '[]', publish_date, client_note, client_id uuid FK clients(id) ON DELETE CASCADE`
- **Indexes:** `content_items_pkey` (PK on id), `content_items_client_idx` (btree on client_id)
- **RLS policies (post-Fix-#10.1):** `admins read content_items` (SELECT @cloudscenic.com), `admins write content_items` (ALL @cloudscenic.com), `clients read scoped content_items` (SELECT — approved client_users matching row's client_id), `clients update scoped content_items` (UPDATE — same row qualifier + with_check prevents re-parenting). Anon callers get zero rows.
- **Note:** Stages: Ready For Copy Creation → Need Copy Approval → Ready For Content Creation → Need Content Approval → Needs Revisions → Approved → Ready For Schedule → Scheduled.

### ★ `agent_events` table — brain Move 2
- **Migration:** `supabase/migrations/20260523_agent_events.sql`
- **Columns:** `agent_name, action_key, content_item_id, payload, result_status, result_summary, client_id`
- **Plain English:** A real history of everything every agent has done. Powers the live Dashboard feed.
- **Notes:** Indexes: `ts desc`, `agent_name`, `action_key`, `(client_id, ts desc)`. Written exclusively via SERVICE_KEY from agent-action.js. Admin-only RLS.

### `notifications` table — brain Move 3
- **Migration:** `supabase/migrations/20260523_notifications.sql`
- **Columns:** Durable client-action notifications. `UNIQUE(type, content_item_id)` dedupes multi-tab fires.
- **Plain English:** Bell-icon notifications that survive a page refresh.

### `profiles` table — role per user
- **Migration:** `supabase/migrations/002_profiles.sql`
- **Columns:** `role (admin|client), email` — FK to `auth.users.id`.
- **Plain English:** Tells the app which users are admins and which are clients.
- **Note:** Active — referenced by App.jsx admin path. Admin email allowlist hardcoded at `App.jsx:51` `ADMIN_EMAILS` (cz/dv/ss @ cloudscenic.com).

### `cid_posts` table — competitor intel scrapes
- **Migration:** `supabase/migrations/003_cid_posts.sql`
- **Columns:** Scraped competitor posts: `platform, post_url, creator, engagement, hook, trigger_type, variation, analysis`.

### `client-logos` bucket — Supabase Storage
- **Migration:** `supabase/migrations/20260524_client_logos_bucket.sql`
- **Role:** Public storage bucket for client logo uploads from AddClientModal.
- **Note:** `public:true`. Anon write policies dropped 2026-05-25 (commit `852d915`); admin-only via `20260525_admin_rls_for_oauth.sql`.

### ⚙ NEW `client_users` table — invite/allowlist
- **Migration:** `supabase/migrations/20260525_client_users_allowlist.sql`
- **Columns:** `(email, client_id, status, invited_at, first_login_at, approved_at)`. Status: `pending` / `approved` / `rejected`.
- **Plain English:** List of external client teammates (like Natalia at VitalLyfe) who can log in. Admins invite them, they get a "pending" row, admin clicks Approve, status flips to "approved" and they can use the app.
- **Notes:**
  - Added 2026-05-25 for the invite flow (commits `2a9c9c1` + `19b6235`)
  - RLS: admins full read/write; approved clients can read their own row(s)
  - Realtime enabled — admin approving a row instantly unlocks the client's PendingApprovalScreen

---

## 🌍 External APIs

### ★ Anthropic API — claude-haiku-4-5
- **URL:** `https://api.anthropic.com/v1/messages`
- **Model:** `claude-haiku-4-5-20251001`
- **Plain English:** Claude AI. Every time Muse writes a caption or Sean does a briefing, it goes through here.
- **Notes:** Model upgrade history: `haiku-20240307` → `5-haiku-20241022` (rejected) → `haiku-4-5-20251001` (works). Called from `agent-action.js` (4 sites) + `chat.js`. Key: `ANTHROPIC_API_KEY` Netlify env.

### ★ Supabase — DB + Auth + Storage + Realtime
- **URL:** `https://wjcstqqihtebkpyuacop.supabase.co`
- **Plain English:** Database, file storage, real-time pub/sub, and authentication — all in one external service.
- **Notes:** Frontend uses anon key (`VITE_SUPABASE_ANON_KEY`). Server uses service key (bypasses RLS) from agent-action/notify. Realtime via `wss://...supabase.co/realtime/v1`.

### Resend — transactional email
- **URL:** `api.resend.com/emails`
- **Plain English:** The email-sending service. When a client approves/rejects content, this sends the email to the team.
- **Notes:** Only called from notify.js. Falls through silently if `RESEND_API_KEY` missing.

### Slack — incoming webhook
- **Webhook:** `SLACK_WEBHOOK_URL` (global) + per-client `clients.slack_webhook_url` (notify.js only)
- **Plain English:** Slack notifications go here.
- **Notes:** `notify.js` L157-162 prefers per-client webhook when `client_id` is on payload, falls back to global env (commit `702f867`). `agent-action.js` still uses the global webhook for every action — per-client routing TODO there too.

### n8n cloud — automation webhook
- **URL:** `cloudscenic.app.n8n.cloud` webhook (global fallback via `N8N_WEBHOOK_URL` env)
- **Workflow:** "VitalLyfe Vantus — Content Sync"
- **Notes:** Triggered by `lacey_trigger_n8n` action + notify.js. Per-client routing live (Fix #7, 2026-05-26): `notify.js` reads `clients.n8n_webhook_url` for the event's client, falls back to global env when unset.

### Tavily — web search API
- **URL:** `api.tavily.com/search`
- **Plain English:** A search API for fresh web data. Used by the Scrappy agent for trend research.

### Google OAuth — Workspace SSO
- **URL:** `accounts.google.com`
- **Audience:** Internal — for `@cloudscenic.com` Workspace
- **Status:** LIVE as of 2026-05-25 after client_secret rotation. Admins (@cloudscenic.com) and approved external clients both sign in here.
- **Notes:** Configured in Supabase Auth Providers + Google Cloud Console. To allow non-@cloudscenic.com Google accounts, would need to switch to External audience (Google verification required) — current workaround is the `client_users` allowlist on the same OAuth.

### Apify — scraping actors
- **URL:** `api.apify.com`
- **Notes:** Called from apify-scrape function. `APIFY_API_KEY` env var.

### Netlify — hosting + Functions
- **Site ID:** `6d97835e-1874-43d7-9465-f93afd68c6fb`
- **URL:** `https://usevantus.com`
- **Notes:** Auto-deploy on push to main. SSL via Let's Encrypt.
