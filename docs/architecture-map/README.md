# Vantus Architecture Map

> Portable, markdown-only snapshot of the Vantus codebase architecture.
> Mirrors the interactive `architecture-map.html` at the repo root.
> Drop this entire folder into any wiki / knowledge base — no rendering deps.

**Snapshot date:** 2026-05-25 (updated after Fix #1, #2, #4 + invite flow shipped)
**Live URL:** https://usevantus.com
**Repo:** https://github.com/czcloudscenic/War-Room

## What changed 2026-05-25

- **Auth** — Google OAuth restored. Auth bypass removed (`src/App.jsx:262`). Every 5 protected functions now require a valid Supabase JWT via shared `netlify/functions/_lib/requireUser.js`.
- **Invite flow** — New `client_users` allowlist table. Admins can invite external client teammates from the Edit Client modal's Team Access panel. Approved emails get into ClientView; pending shows an "awaiting approval" screen that auto-unlocks via realtime.
- **Per-client Slack** — New `clients.slack_webhook_url` column. `notify.js` now uses the per-client URL when available, falls back to global env.
- **Closed temp policies** — 5 anon RLS policies dropped (agent_events, notifications, clients, client-logos). Replaced with admin-only via `auth.jwt()->>'email' like '%@cloudscenic.com'`.

## Stack at a glance

```
React 19 + Vite 8  ──▶  Netlify Functions  ──▶  Supabase (DB + Auth + Storage + Realtime)
                                              ──▶  Anthropic (claude-haiku-4-5)
                                              ──▶  Resend · Slack · n8n · Tavily
```

## Files in this folder

| File | What's inside |
|---|---|
| [critical-path.md](./critical-path.md) | The 9-step spine from button-click to live activity feed. Read this first. |
| [nodes.md](./nodes.md) | Catalog of every significant file/table/service, grouped by cluster, with plain-English descriptions. |
| [known-bugs.md](./known-bugs.md) | Severity-ranked list of real bugs (each with file:line where possible). |
| [roadmap.md](./roadmap.md) | Numbered fixes — what to do to close the gaps. |

---

## Notable findings (read these first)

### 1. `src/agents/` is entirely dead code
**8 files, 96 lines, zero importers.** Real agent personas live in `src/core/agentRegistry.js` + `src/core/memory.js` + hardcoded inline inside `netlify/functions/agent-action.js`. The folder was created during a Phase 2 refactor (per `docs/REFACTOR_PLAN.md`) but never wired up.

```bash
$ grep -rn "from.*agents/" src/   # → zero hits
```

### 2. `agent-action.js` is a 1,255-line monolith
A single file holds 16 action handlers + the Anthropic wrapper + Supabase REST helpers + Slack notifier + the new `agent_events` logger. Splitting is documented in `docs/REFACTOR_PLAN.md` but never executed.

### 3. ~~Authentication is currently BYPASSED~~ ✅ FIXED 2026-05-25
~~`src/App.jsx:116-117` — `if(!session)` is commented out.~~ Auth gate is back. `App.jsx` now distinguishes admin / approved-client / pending-invite / unknown paths. Google OAuth working after client_secret rotation.

### 4. Brain Move 1 is half-done
The `clients.brand_voice_md` column exists and AddClient modal lets you write it, but `agent-action.js` ignores it. All agent prompts still use hardcoded VitalLyfe voice. (`slack_webhook_url` per-client routing IS now done — commit 702f867. `n8n_webhook_url` still global.)

### 5. ~~Functions are unauthenticated~~ ✅ FIXED 2026-05-25
~~Only `/api/cid-scrape` requires a bearer token. The other 5 functions accept anonymous POSTs.~~ All 5 (`chat`, `agent-action`, `notify`, `apify-scrape`, `unsplash`) now require a valid Supabase JWT via shared `netlify/functions/_lib/requireUser.js`. Either an @cloudscenic.com admin OR an email approved in `client_users`.

### 6. Main JS bundle is 777 KB (gzip 199 KB)
The bulk is `pdfjs-dist` (405 KB on disk) which is only used by Brief→Content. Dynamic-importing it would cut the bundle in half for the ~95% of users who never open that page.

### 7. `content_items` has no migration file
Schema lives only in live Supabase. Drift risk between local dev expectations and production. Other tables (`clients`, `agent_events`, `notifications`, `profiles`, `cid_posts`) all have proper migration files.

---

## Cluster map

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Client UI   │  │ API Routes  │  │ Core Svcs   │  │ Data Layer  │  │ External    │
├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤
│ main.jsx    │  │ agent-      │  │ supabase-   │  │ clients     │  │ Anthropic   │
│ App.jsx ★   │  │  action ★   │  │  Client ★   │  │ content     │  │  ★          │
│ LoginScreen │  │ chat        │  │ apiFetch ★  │  │ agent_      │  │ Supabase ★  │
│ AddClient   │  │ notify      │  │  ⚙ NEW      │  │  events ★   │  │ Resend      │
│ AgentChat ★ │  │ cid-scrape  │  │ memory      │  │ notifs      │  │ Slack       │
│ Activity-   │  │ apify-      │  │ routeTask   │  │ profiles    │  │ n8n         │
│  Feed ★     │  │  scrape     │  │ agent-      │  │ cid_posts   │  │ Tavily      │
│ OpsBoard    │  │ unsplash    │  │  Registry   │  │ logos       │  │ Google OAuth│
│ PipelineBd  │  │ require-    │  │ constants   │  │  bucket     │  │ Apify       │
│ EditModal   │  │  User ★ NEW │  │ apps-config │  │ client_     │  │ Netlify     │
│ ClientView  │  │ higgsfield  │  │ hooks       │  │  users ⚙ NEW│  │             │
│ CIDPage     │  │  (404 ✕)    │  │ seed.*      │  │             │  │             │
│ BriefGen    │  │             │  │ agents/ ✕   │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
                     ★ = on critical path     ✕ = dead/not deployed
                     ⚙ NEW = added 2026-05-25 (Fix #1+#2 bundle)
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
2. **Triage** → [known-bugs.md](./known-bugs.md) is severity-ranked. Top of the file = act now.
3. **Planning** → [roadmap.md](./roadmap.md) is the punch-list of every documented fix.
4. **Dropping into another repo / wiki** → copy the whole `architecture-map/` folder. No external deps.

## Companion file

The interactive HTML version (`architecture-map.html` at the repo root) shows the same data with pan/zoom, click-to-detail sidebar, filters, and badges. Generate it from the same source data; this folder is the human-readable export.
