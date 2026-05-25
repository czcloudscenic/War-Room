# Node Catalog

Every significant file, function, table, and external service in Vantus — grouped by cluster.

★ = on the critical path
✕ = dead code / not deployed

---

## ☁️ Client UI (`src/`)

### ★ `main.jsx` — mount point
- **Path:** `src/main.jsx` (1 line)
- **Role:** React 19 `createRoot` mount; renders `<App />`.
- **Plain English:** The very first line of code that runs when you open the site. Connects React to the page.

### ★ `App.jsx` — root + state + auth gate
- **Path:** `src/App.jsx` (1,471 lines)
- **Role:** Root React tree: auth bypass, `currentClient` state, content/notifications/clients fetch + realtime subs, layout shell, every nav route handler.
- **Plain English:** The big brain of the frontend. Checks if you're logged in, picks the active client, loads all the data, decides which page to show based on the sidebar item you clicked.
- **Notes:**
  - L116-117: AUTH BYPASS — `if(!session)` commented; admin fallback user
  - L143-159: 8 useState calls + currentClient/clientPickerOpen/editingClient
  - L196-271: Vantus useEffect — content fetch + content_changes realtime
  - L278-312: clients useEffect — fetch + realtime; sets currentClient
  - L315-359: notifications useEffect — scoped fetch + INSERT/UPDATE realtime
  - L1025-1380: giant route switch (one ternary per nav id)

### `LoginScreen.jsx` — Google OAuth button
- **Path:** `src/ui/layout/LoginScreen.jsx`
- **Role:** "Continue with Google" button calling `sb.auth.signInWithOAuth` + URL-error display.
- **Plain English:** The login page. Currently never shown because auth is bypassed in App.jsx.

### `AddClientModal.jsx` — create + edit + archive
- **Path:** `src/ui/clients/AddClientModal.jsx`
- **Role:** Multi-purpose modal for client onboarding/edit/archive; handles logo upload to Supabase Storage.
- **Plain English:** The form to add a new client (or edit one). Lets you upload their logo, set brand voice, contact email, etc.
- **Notes:**
  - Toggles edit vs create via `editingClient` prop
  - Uploads to `client-logos` bucket via `sb.storage.from(...)`
  - `fontSize:16` on inputs to dodge iOS auto-zoom
  - Archive action: `status=archived` (soft delete)

### ★ `AgentChatPage.jsx` — chat UI for 7 agents
- **Path:** `src/ui/agents/AgentChatPage.jsx`
- **Role:** Per-agent chat panel: prompt builder, message thread, quick-action buttons, agent-action invoker.
- **Plain English:** Where you click on an agent (Sean, Muse, etc.) and chat with them. Calls Claude through /api/agent-action for quick actions.
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
- **Role:** Competitor Intel dashboard: search query → scrape via /api/cid-scrape + /api/apify-scrape → cid_posts.
- **Plain English:** Where you type a creator name and Vantus scrapes their recent posts to study what works.

### `BriefGenPage.jsx` — PDF brief → generated content
- **Path:** `src/apps/brief-gen/BriefGenPage.jsx`
- **Role:** Drag-PDF zone → pdfjs extract text → /api/agent-action `muse_from_brief` → batch INSERT content_items.
- **Plain English:** Drop a PDF brief and Muse reads it, generates Reels + Stories, adds them to the tracker.
- **Notes:** Uses `pdfjs-dist` (the 405KB bundle bloat).

### ✕ `HiggsfieldStudio.jsx` — WIP, untracked
- **Path:** `src/apps/higgsfield/HiggsfieldStudio.jsx` (NOT IN GIT)
- **Role:** Half-built Higgsfield AI image/video gen UI.
- **Notes:** File exists on disk but never committed. Live `/api/higgsfield` returns 404.

### Smaller pages (not detailed)
`AppsPage`, `SettingsPage`, `ICPPage`, `TeamBroadcast`, `ReferencesPage`, `SkillsPage`, `AdROIHub`, `ArtgridScoutPage`, `HeroGeneratorPage`, `ShotRefScout`, `QuickActionsDashboard`, `AgentCard`, `AgentAvatar`, `MetricCard`, `Card`, `PlaceholderPage`, `TypingTask`, `AppPlaceholder`.

---

## 🛣️ API Routes (`netlify/functions/`)

### ★ `/api/agent-action` — agent-action.js
- **Path:** `netlify/functions/agent-action.js` (**1,255 lines — monolith**)
- **Role:** 16-action switch over `POST {action,payload,client_id}`; routes to muse_/sean_/lacey_/sam_/overseer_/artgrid_/scrappy_/cid_ handlers, logs to `agent_events`, posts to Slack.
- **Plain English:** The single endpoint every agent action goes through. The user clicks a button, Vantus POSTs `{action: "muse_write_content"}` here, and this file figures out what to do, calls Claude, writes the result to the database, tells Slack.
- **Notes:**
  - L122: `model = claude-haiku-4-5-20251001` (upgraded from deprecated haiku-3)
  - L1106-1252: `exports.handler` with switch + try/catch/finally for logging
  - L63-80: `logAgentEvent` wrapper for agent_events table
  - L14-27: `SLACK_AGENT_LABELS` for per-action post formatting
  - Holds 16 different handler functions inline — splitting deferred

### `/api/chat` — chat.js
- **Path:** `netlify/functions/chat.js` (60 lines)
- **Role:** Thin proxy: parses request body, forwards to Anthropic Messages API server-side.
- **Plain English:** A pass-through that keeps the Anthropic API key on the server. The frontend never sees the key.

### `/api/notify` — notify.js
- **Path:** `netlify/functions/notify.js`
- **Role:** Fires when client UPDATEs `content_items` status to Approved/Needs Revisions: persists to `notifications` + email (Resend) + Slack + n8n.
- **Plain English:** When a client approves or rejects a piece, this sends the email, posts to Slack, and saves the notification to the database so it survives a page refresh.
- **Notes:**
  - L17-44: `insertNotification` helper for notifications table (Move 3)
  - `Prefer:resolution=ignore-duplicates` → unique index dedupes multi-tab POSTs
  - Per-client routing TODO: still uses global `SLACK_WEBHOOK_URL`, not `client.slack_channel_id`

### `/api/cid-scrape` — cid-scrape.js
- **Path:** `netlify/functions/cid-scrape.js`
- **Role:** Only auth-gated function: requires Bearer token; scrapes IG/TikTok/Reddit posts → `cid_posts`.
- **Plain English:** Goes out to social platforms and pulls down competitor posts. The only endpoint that requires a password.

### `/api/apify-scrape` — apify-scrape.js
- **Path:** `netlify/functions/apify-scrape.js`
- **Role:** Calls Apify actors for scraping (alternate path to cid-scrape).
- **Plain English:** Another scraping option using Apify (a scraping service).

### `/api/unsplash` — unsplash.js
- **Path:** `netlify/functions/unsplash.js` (51 lines)
- **Role:** Proxy to Unsplash search API for stock image references.
- **Plain English:** Lets you search Unsplash for reference photos. Called from the Shot Reference page.

### ✕ `/api/higgsfield` — NOT DEPLOYED
- **Path:** `netlify/functions/higgsfield.js` (UNTRACKED)
- **Role:** Higgsfield AI proxy — file exists locally but is untracked.
- **Notes:** Live `/api/higgsfield` → 404. UI references would fail if Higgsfield UI were ever wired.

---

## ⚙️ Core Services (`src/core/`, `src/services/`, `src/utils/`, `src/data/`)

### ★ `supabaseClient.js` — `sb` singleton
- **Path:** `src/services/supabaseClient.js` (15 lines)
- **Role:** Reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` from env, exports `sb` (createClient). Throws on missing env.
- **Plain English:** The connection to Supabase that every database query uses on the frontend.
- **⚠️** Throws at module-load if env vars missing — would crash the whole app.

### `memory.js` — agent memory store
- **Path:** `src/core/memory.js` (86 lines)
- **Role:** localStorage-backed per-agent memory + `buildSystemPrompt` composer + `updateAgentMemory` hook.
- **Plain English:** Where each agent's "memory" is stored in the browser. Builds the prompt sent to Claude.
- **⚠️ L75-81:** Muse pre-seed (`brand:VitalLyfe, tone:cinematic calm purposeful...`) is hardcoded — blocks Move 1 (per-client agent voice).

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

### `hooks.js` — useIsMobile + useInterval
- **Path:** `src/utils/hooks.js` (32 lines)
- **Role:** Two shared hooks: `useIsMobile` (window.innerWidth<768 + resize listener), `useInterval` (setInterval ref-stable wrapper).
- **Note:** Mobile breakpoint: <768px.

### `seed.content.js` — static fallback content
- **Path:** `src/data/seed.content.js` (53 lines)
- **Role:** `INITIAL_CONTENT` + `VITAL_LYFE_SOP` — VitalLyfe-specific seed used as fallback when content_items is empty.
- **Note:** Tightly coupled to VitalLyfe — needs replacement for multi-tenant.

### `seed.agents.js` — agent identity + colors
- **Path:** `src/data/seed.agents.js` (46 lines)
- **Role:** `AGENTS_BASE` (8 agents) + `AGENT_TASKS` + `ACTION_COLORS`. Drives sidebar agent grid + activity feed colors.
- **Note:** Agent prompts NOT here — those live in agentRegistry.js + agent-action.js. `ACTIVITY_POOL` export was removed in Move 2 (fake theater gone).

### `seed.ops.js` — OpsBoard initial tasks
- **Path:** `src/data/seed.ops.js` (18 lines)

### ✕ `src/agents/` — DEAD CODE
- **Path:** `src/agents/*.agent.js` (8 files, 96 lines total)
- **Role:** sean/lacey/muse/overseer/sam/artgrid/scrappy/ali.agent.js — each 12 lines, never imported by anything.
- **Why dead:** `grep -rn "from.*agents/" src/` → zero hits.
- **History:** Phase 2.3 of `docs/REFACTOR_PLAN.md` was meant to extract agents here. Real persona prompts live in `agentRegistry.js` + `agent-action.js` inline.
- **Fix:** Safe to delete the entire `src/agents/` directory.

---

## 🗄️ Data Layer (`supabase/migrations/`)

### ★ `clients` table — multi-tenant root
- **Migration:** `supabase/migrations/20260523_clients_multitenant.sql`
- **Columns:** `id, slug, name, brand_voice_md, brand_color, logo_url, primary_email, slack_channel_id, n8n_webhook_url, status, archived_at`
- **Plain English:** The list of all clients. Every other data table points back to a row here via `client_id`.
- **Notes:** RLS: admins read/write (+ temp anon while auth bypassed). Public realtime via `supabase_realtime` publication. Seeded with VitalLyfe automatically.

### ★ `content_items` table — pipeline rows
- **Migration:** ⚠️ **NO MIGRATION FILE** (schema lives only in live Supabase)
- **Columns:** Content pieces (Reels, Posts, Stories) scoped by `client_id`. Stages: Ready For Copy Creation → Scheduled.
- **Note:** Schema NOT in version control — drift risk. `client_id` added in 20260523 multitenant migration.

### ★ `agent_events` table — brain Move 2
- **Migration:** `supabase/migrations/20260523_agent_events.sql`
- **Columns:** `agent_name, action_key, content_item_id, payload, result_status, result_summary, client_id`
- **Plain English:** A real history of everything every agent has done. Powers the live Dashboard feed.
- **Notes:** Indexes: `ts desc`, `agent_name`, `action_key`, `(client_id, ts desc)`. Written exclusively via SERVICE_KEY from agent-action.js.

### `notifications` table — brain Move 3
- **Migration:** `supabase/migrations/20260523_notifications.sql`
- **Columns:** Durable client-action notifications. `UNIQUE(type, content_item_id)` dedupes multi-tab fires.
- **Plain English:** Bell-icon notifications that survive a page refresh.

### `profiles` table — role per user
- **Migration:** `supabase/migrations/002_profiles.sql`
- **Columns:** `role (admin|client), email` — FK to `auth.users.id`.
- **Plain English:** Tells the app which users are admins and which are clients.
- **Note:** Currently bypassed (auth off). Admin email allowlist baked in `App.jsx` `ADMIN_EMAILS`.

### `cid_posts` table — competitor intel scrapes
- **Migration:** `supabase/migrations/003_cid_posts.sql`
- **Columns:** Scraped competitor posts: `platform, post_url, creator, engagement, hook, trigger_type, variation, analysis`.

### `client-logos` bucket — Supabase Storage
- **Migration:** `supabase/migrations/20260524_client_logos_bucket.sql`
- **Role:** Public storage bucket for client logo uploads from AddClientModal.
- **Note:** `public:true`. Anon upload allowed (TODO: restrict when auth restored).

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
- **Webhook:** `SLACK_WEBHOOK_URL` → `#vitallyfe-war-room` as "VitalLyfe War Room" bot
- **Plain English:** Slack notifications go here.
- **⚠️** Currently global — does NOT use `client.slack_channel_id` yet.

### n8n cloud — automation webhook
- **URL:** `cloudscenic.app.n8n.cloud` webhook
- **Workflow:** "VitalLyfe Vantus — Content Sync"
- **Notes:** Triggered by `lacey_trigger_n8n` action + notify.js. Per-client URL TODO.

### Tavily — web search API
- **URL:** `api.tavily.com/search`
- **Plain English:** A search API for fresh web data. Used by the Scrappy agent for trend research.

### Google OAuth — Workspace SSO (broken)
- **URL:** `accounts.google.com`
- **Audience:** Internal — for `@cloudscenic.com` Workspace
- **⚠️ Status:** Last error "Unable to exchange external code" — likely client_secret mismatch. Bypassed in App.jsx currently.

### Apify — scraping actors
- **URL:** `api.apify.com`
- **Notes:** Called from apify-scrape function. `APIFY_API_KEY` env var.

### Netlify — hosting + Functions
- **Site ID:** `6d97835e-1874-43d7-9465-f93afd68c6fb`
- **URL:** `https://usevantus.com`
- **Notes:** Auto-deploy on push to main. SSL via Let's Encrypt.
