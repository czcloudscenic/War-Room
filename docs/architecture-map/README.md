# Vantus Architecture Map

> Portable, markdown-only snapshot of the Vantus codebase architecture.
> Mirrors the interactive `architecture-map.html` at the repo root.
> Drop this entire folder into any wiki / knowledge base — no rendering deps.

**Snapshot date:** 2026-05-26 (post Move 1 + Fix #15)
**Live URL:** https://usevantus.com
**Repo:** https://github.com/czcloudscenic/War-Room (auto-deploys on push to `main`)

## What changed since the 2026-05-23 snapshot

Five days of session work shipped these in production:

- **Auth restored end-to-end** (commits `307b64f`, `8e5095e`, `d0acec3`). Google OAuth working. `App.jsx` `setupSession` (L72) branches four ways: admin (@cloudscenic.com) → full Vantus · approved external client → ClientView scoped to their `client_id` · pending invite → `PendingApprovalScreen` (realtime unlock when admin approves) · unknown email → blocked.
- **Caller auth on every protected function** (commit `2a9c9c1`). Shared helper at `netlify/functions/_lib/requireUser.js` validates Supabase JWT for `chat`, `agent-action`, `notify`, `apify-scrape`, `unsplash`. `cid-scrape` keeps its pre-existing bearer-token gate.
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

### 1. `src/agents/` is entirely dead code
**8 files, 96 lines, zero importers.** Real agent personas live in `src/core/agentRegistry.js` + `src/core/memory.js` + hardcoded inline inside `netlify/functions/agent-action.js`. The folder was created during a Phase 2 refactor (per `docs/REFACTOR_PLAN.md`) but never wired up.

```bash
$ grep -rn "from.*agents/" src/   # → only matches src/ui/agents/, never bare agents/
```

### 2. `agent-action.js` is a 1,263-line monolith
A single file holds 16 action handlers + the Anthropic wrapper + Supabase REST helpers + Slack notifier + `agent_events` logger. Splitting is documented in `docs/REFACTOR_PLAN.md` but never executed.

### 3. Auth is LIVE and four-way
Far from the "anyone gets admin access" finding in the previous snapshot. `App.jsx:72` `setupSession` distinguishes admin / approved client / pending invite (with realtime unlock) / unknown blocked. Every protected serverless function rejects callers without a valid JWT.

### 4. Brain Move 1 (Cortex wiring) — SHIPPED 2026-05-26
`getBrandContext(client_id)` at `agent-action.js:94` now fetches `clients.name` + `clients.brand_voice_md` per request. 12 prompt sites refactored to interpolate `${brand.name}` and `${brand.voice}`. Dead `seedMuseMemory()` removed from `memory.js`. VitalLyfe seeded via `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql`. Multi-tenancy at the agent layer is now real — any new client added via AddClient modal with their own `brand_voice_md` gets their voice in generated content automatically. *Leftover: `cid_library.vitallyfe_adaptation` column rename tracked as Fix #3.1.*

### 5. Per-client Slack done, per-client n8n still pending
Both columns exist on `clients` (`slack_webhook_url`, `n8n_webhook_url`). Only Slack reads from the per-client value (`notify.js:157-162`). n8n is still global. Same one-block change would close Fix #7.

### 6. `content_items` has no migration file
Schema lives only in live Supabase. Drift risk between local dev expectations and prod. Every other table (`clients`, `agent_events`, `notifications`, `profiles`, `cid_posts`, `client_users`) has a proper migration file.

### 7. Auth-lock contention auto-recovers — Fix #15 SHIPPED 2026-05-26
When the 4s `stuckGuard` in `App.jsx` fires, it now clears just the `sb-*-auth-token` localStorage keys (preserving agent histories + apps prefs) and reloads. A one-shot `sessionStorage` flag prevents reload loops. The manual `localStorage.clear(); reload()` workaround is retired.

### 8. Main JS bundle is 777 KB (gzip 199 KB)
The bulk is `pdfjs-dist` (405 KB on disk) which is only used by Brief→Content. Dynamic-importing it would cut the bundle in half for ~95% of users who never open that page.

### 9. Higgsfield Studio still untracked
`src/apps/higgsfield/HiggsfieldStudio.jsx` + `netlify/functions/higgsfield.js` + dirty edits to `apps.config.js` + `constants.js` all sit in the working tree. Must ship in one commit (broke CI last time when split) or be deleted together.

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
│ AgentChat ★ │  │ cid-scrape  │  │ routeTask   │  │  events ★   │  │ n8n         │
│ Activity-   │  │ apify-      │  │ agent-      │  │ notifs      │  │ Tavily      │
│  Feed ★     │  │  scrape     │  │  Registry   │  │ profiles    │  │ Google OAuth│
│ OpsBoard    │  │ unsplash    │  │ constants   │  │ cid_posts   │  │ Apify       │
│ PipelineBd  │  │ require-    │  │ apps-config │  │ logos       │  │ Netlify     │
│ EditModal   │  │  User ★     │  │ hooks       │  │  bucket     │  │             │
│ ClientView  │  │ higgsfield  │  │ seed.*      │  │ client_     │  │             │
│ CIDPage     │  │  (404 ✕)    │  │ agents/ ✕   │  │  users      │  │             │
│ BriefGen    │  │             │  │             │  │             │  │             │
│ Higgsfield  │  │             │  │             │  │             │  │             │
│  Studio ✕   │  │             │  │             │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
                     ★ = on critical path     ✕ = dead/untracked
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
