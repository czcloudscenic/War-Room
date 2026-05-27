# Vantus Architecture Map

> Portable, markdown-only snapshot of the Vantus codebase architecture.
> Mirrors the interactive `architecture-map.html` at the repo root.
> Drop this entire folder into any wiki / knowledge base — no rendering deps.

**Snapshot date:** 2026-05-26 PM (cid_posts dead chain removed · email/password auth disabled · INITIAL_CONTENT cleanup · Higgsfield WIP cleared · post Move 1 · #15 · #10/10.1 · #7 · #3.1 · #8 · #11 · #2 App.jsx split · security sweep)
**Live URL:** https://usevantus.com
**Repo:** https://github.com/czcloudscenic/War-Room (auto-deploys on push to `main`)

## What changed since the 2026-05-23 snapshot

Five days of session work shipped these in production:

- **Auth restored end-to-end** (commits `307b64f`, `8e5095e`, `d0acec3`). Google OAuth working. `App.jsx` `setupSession` (L72) branches four ways: admin (@cloudscenic.com) → full Vantus · approved external client → ClientView scoped to their `client_id` · pending invite → `PendingApprovalScreen` (realtime unlock when admin approves) · unknown email → blocked.
- **Caller auth on every protected function** (commit `2a9c9c1`). Shared helper at `netlify/functions/_lib/requireUser.js` validates Supabase JWT for `chat`, `agent-action`, `notify`, `apify-scrape`, `unsplash`. (Note: `cid-scrape.js` was deleted 2026-05-26 PM in the closed-by-removal cleanup — was dead code querying a nonexistent table.)
- **Auth header injection client-side** (commit `2a9c9c1`). `src/services/apiFetch.js` wraps `fetch()` and stamps `Authorization: Bearer <access_token>` from the live session. 26 call sites across 11 files now use it.
- **External-client invite flow** (commit `19b6235`). New `client_users` allowlist table + `ClientTeamPanel.jsx` inside Edit Client modal. Admins invite → realtime status flip → external user unlocked without refresh.
- **Per-client Slack routing** (commit `702f867`). New `clients.slack_webhook_url` column. `notify.js` prefers it when `client_id` is in the payload; falls back to global `SLACK_WEBHOOK_URL`. n8n still uses the global webhook for every client (Fix #7).
- **Temp anon RLS policies dropped** (commit `852d915`). All five `(TODO remove when auth back)` policies on `agent_events`, `notifications`, `clients`, `client-logos` bucket removed. Admin-only RLS enforced everywhere.

## Stack at a glance

```
React 19 + Vite 8  ──▶  Netlify Functions  ──▶  Supabase (DB + Auth + Storage + Realtime)
                                              ──▶  Anthropic (claude-haiku-4-5-20251001)
                                              ──▶  Resend · Slack · n8n · Tavily · Apify
```

## Files in this folder

| File | What's inside |
|---|---|
| [critical-path.md](./critical-path.md) | The 9-step spine from button-click to live activity feed. Read this first. |
| [nodes.md](./nodes.md) | Catalog of every significant file/table/service, grouped by cluster, with plain-English descriptions. |
| [known-bugs.md](./known-bugs.md) | Severity-ranked list of real bugs (each with file:line). |
| [roadmap.md](./roadmap.md) | Numbered fixes — what to do to close the gaps. |
| [open-items.md](./open-items.md) | Working checkbox punch-list (the operator's daily doc). |

---

## Notable findings (read these first)

### 1. ~~`src/agents/` dead code~~ — DELETED 2026-05-26 (Fix #8)
8 files, 96 lines, zero importers. `rm -rf src/agents/` shipped. Real agent personas live in `src/core/agentRegistry.js` + `src/core/memory.js` + the per-handler prompts inside `netlify/functions/agent-action.js` (since Move 1, voice flows from `clients.brand_voice_md` per request).

### 2. `agent-action.js` is a 1,317-line monolith — Fix #4 still pending
A single file holds 16 action handlers + the Anthropic wrapper + Supabase REST helpers + Slack notifier + `agent_events` logger + new `getBrandContext` + rate-limit gate. Same shape as the App.jsx split Codex just landed — could pass to Codex next.

### 2a. App.jsx split SHIPPED 2026-05-26 (Fix #2 — Codex)
1,676 → 1,342 lines. Six route components extracted to `src/ui/routes/`: DashboardRoute (130), ContentRoute (104), TrackerRoute (117), SopsRoute (85), TaskboardRoute (12), AgentsRoute (6). App.jsx still owns state — routes are pure presentation. Highest prop count: TrackerRoute at 13. Build passed after every commit.

### 2b. Security hardening sweep SHIPPED 2026-05-26
- **CORS** locked from `*` to an allowlist regex in `_lib/requireUser.js cors(event)` covering usevantus.com + the Netlify subdomain + deploy previews. All 6 functions rewritten.
- **Rate limits** via new `_lib/rateLimit.js` (in-memory sliding window, per-instance). Wired into `/api/chat` (30/min/user) and `/api/agent-action` (60/min/user). Caps per-user Anthropic budget if a token leaks.
- **Security headers** added in `netlify.toml`: HSTS preload (1y), Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo denied), and a tight CSP whitelisting only the actual external origins (Anthropic, Supabase, Resend, Slack, n8n, Tavily, Apify, Unsplash images).

### 3. Auth is LIVE and four-way
Far from the "anyone gets admin access" finding in the previous snapshot. `App.jsx:72` `setupSession` distinguishes admin / approved client / pending invite (with realtime unlock) / unknown blocked. Every protected serverless function rejects callers without a valid JWT.

### 4. Brain Move 1 (Cortex wiring) — SHIPPED 2026-05-26
`getBrandContext(client_id)` at `agent-action.js:94` now fetches `clients.name` + `clients.brand_voice_md` per request. 12 prompt sites refactored to interpolate `${brand.name}` and `${brand.voice}`. Dead `seedMuseMemory()` removed from `memory.js`. VitalLyfe seeded via `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql`. Multi-tenancy at the agent layer is now real — any new client added via AddClient modal with their own `brand_voice_md` gets their voice in generated content automatically. *Leftover: `cid_library.vitallyfe_adaptation` column rename tracked as Fix #3.1.*

### 5. Per-client Slack + n8n routing complete — Fix #6 + #7 SHIPPED
`notify.js` pulls both `slack_webhook_url` and `n8n_webhook_url` from the clients row in one Supabase fetch (consolidated to a single roundtrip after Fix #6 originally shipped with a dedicated Slack lookup). Each URL falls back to its global env var when the client has no override.

### 6. `content_items` is fully in version control + RLS-locked — Fix #10 + #10.1 SHIPPED 2026-05-26
`supabase/migrations/20260526_content_items_baseline.sql` captures the 25-column schema with FK to `clients(id) ON DELETE CASCADE` and `content_items_client_idx`. Companion `20260526_content_items_client_rls.sql` closes a wide-open RLS hole that survived the 2026-05-25 anon-policy cleanup: scoped SELECT+UPDATE policies for approved `client_users` plus a DROP of the legacy `"Allow all for now"` policy. Anonymous callers with the anon key now return zero content_items rows. Verified live.

### 7. Auth-lock contention auto-recovers — Fix #15 SHIPPED 2026-05-26
When the 4s `stuckGuard` in `App.jsx` fires, it now clears just the `sb-*-auth-token` localStorage keys (preserving agent histories + apps prefs) and reloads. A one-shot `sessionStorage` flag prevents reload loops. The manual `localStorage.clear(); reload()` workaround is retired.

### 8. Main JS bundle ~796 KB (gzip 204 KB) — pdfjs already chunked separately
`pdfjs-dist` is already lazy-loaded (Fix #11 was already done — `BriefGenPage.jsx:7` uses `await import('pdfjs-dist')`). The remaining 796 KB is React + Supabase + the rest of the app surface. Further code-splitting would need Vite `manualChunks` config — separate task, not blocking.

### 9. Working tree fully clean — local HEAD = `origin/main` at `19e7f02`
The Higgsfield WIP files (`HiggsfieldStudio.jsx` + `higgsfield.js`) and the dormant `PasswordGate.jsx` that the previous snapshot flagged are no longer in the tree. `apps.config.js` and `constants.js` are clean — no CREATIVE section, no Higgsfield nav entry. Whatever ships next is a fresh commit on a real branch, not a recovered orphan. Fix #9 closed by removal.

---

## Cluster map

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Client UI   │  │ API Routes  │  │ Core Svcs   │  │ Data Layer  │  │ External    │
├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤
│ main.jsx    │  │ agent-      │  │ supabase-   │  │ clients     │  │ Anthropic ★ │
│ App.jsx ★   │  │  action ★   │  │  Client ★   │  │ content_    │  │ Supabase ★  │
│ LoginScreen │  │ chat        │  │ apiFetch ★  │  │  items ★    │  │ Resend      │
│ AddClient   │  │ notify      │  │ memory      │  │ agent_      │  │ Slack       │
│ AgentChat ★ │  │ apify-      │  │ routeTask   │  │  events ★   │  │ n8n         │
│ Activity-   │  │  scrape     │  │ agent-      │  │ notifs      │  │ Tavily      │
│  Feed ★     │  │ unsplash    │  │  Registry   │  │ profiles    │  │ Google OAuth│
│ OpsBoard    │  │ require-    │  │ constants   │  │ logos       │  │ Apify       │
│ PipelineBd  │  │  User ★     │  │ apps-config │  │  bucket     │  │ Netlify     │
│ EditModal   │  │ rate-limit  │  │ hooks       │  │ client_     │  │             │
│ ClientView  │  │             │  │ seed.*      │  │  users      │  │             │
│ CIDPage     │  │             │  │             │  │             │  │             │
│ BriefGen    │  │             │  │             │  │             │  │             │
│ routes/ (6) │  │             │  │             │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
                     ★ = on critical path
```

## Color legend (interactive HTML version)

| Cluster | Color |
|---|---|
| Client UI | Blue (`#4ea1ff`) |
| API Routes | Green (`#7bd389`) |
| Core Services | Purple (`#c792ea`) |
| Data Layer | Amber (`#ffb86b`) |
| External APIs | Pink (`#ff6b9d`) |
| Critical path (edges + node borders) | Red (`#ff3860`) |
| Dead code | Grey (`#5a5a5a`) |

---

## How to use this folder

1. **Onboarding a new engineer** → start with [critical-path.md](./critical-path.md), then skim [nodes.md](./nodes.md) for whichever cluster they'll touch first.
2. **Triage** → [open-items.md](./open-items.md) is the working punch-list. Severity-ranked. Top of the file = act now.
3. **Planning** → [roadmap.md](./roadmap.md) is the numbered registry of every documented fix.
4. **Bug context** → [known-bugs.md](./known-bugs.md) for severity rationale and file:line citations.
5. **Dropping into another repo / wiki** → copy the whole `architecture-map/` folder. No external deps.

## Companion file

The interactive HTML version (`architecture-map.html` at the repo root) shows the same data with pan/zoom, click-to-detail sidebar, filter chips, and badges. Generate it from the same source data; this folder is the human-readable export.
