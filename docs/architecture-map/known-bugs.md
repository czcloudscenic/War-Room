# Known Bugs & Risks

Ranked by severity. Each entry cites the file (and line when possible) where the issue lives.

## ✅ Closed 2026-05-26 (Move 1)

| Bug | Closed by |
|---|---|
| agent-action.js — 12 hardcoded VitalLyfe brand prompts | `getBrandContext()` + `clients.brand_voice_md` reads per request |
| memory.js — hardcoded Muse pre-seed | `seedMuseMemory()` removed entirely (zero callers) |
| `#VitalLyfe` hashtag templates in 3 JSON schemas | Dynamic `#${brand.name}` interpolation |

Test: Muse caption generation against VitalLyfe produces identical voice/structure pre vs post — verified in dev 2026-05-26.

Open leftover: `cid_library.vitallyfe_adaptation` column name (Fix #3.1).

## ✅ Closed 2026-05-25 (kept for history)

The full week-of-work shipped 2026-05-25. These HIGH-severity bugs all closed:

| Bug | Closed by |
|---|---|
| App.jsx — AUTH BYPASS | Commit `8e5095e` (gate restored) + hotfix `d0acec3` (stuckGuard) + `307b64f` (dedupe setupSession) |
| agent-action.js — no caller auth | Commit `2a9c9c1` (`_lib/requireUser.js` gate) |
| chat.js — no caller auth | Commit `2a9c9c1` |
| notify.js — no caller auth | Commit `2a9c9c1` |
| apify-scrape.js — no caller auth | Commit `2a9c9c1` |
| unsplash.js — no caller auth | Commit `2a9c9c1` |
| google-oauth — exchange fails | Client_secret rotated in Supabase + Google Console in lockstep |

MED-severity closures: `notify.js` global Slack only → per-client routing (commit `702f867`).

LOW-severity closures: 5 temp anon RLS policies on `agent_events` / `notifications` / `clients` / `client-logos` bucket — all dropped (commit `852d915`, file `20260525_drop_temp_anon_policies.sql`). Replaced with admin-only via `auth.jwt()->>'email' like '%@cloudscenic.com'`.

## 🔴 HIGH — fix soon

_(none open as of 2026-05-26)_

---

## 🟡 MED — fix when planning the next refactor

### App.jsx · 1,646-line component
Cognitive load + harder to test in isolation. Phase 3.x of `docs/REFACTOR_PLAN.md` was meant to split this; never done. Suggested extraction: one component per nav route handler, keep App.jsx as a router shell.

### App.jsx · L204 — supabase-js auth-lock contention
Multi-tab usevantus.com or stale localStorage causes `sb.auth.getSession()` / `signOut()` / DB queries to deadlock on `navigator.locks` indefinitely. Mitigated by a 4s `stuckGuard` timeout that forces `checking=false` (`App.jsx:204`), but the underlying queries still error. Workaround: `localStorage.clear(); location.reload();`. Real fix would be auto-recovery in `setupSession`.

### agent-action.js · L1302 · monolith
1,302 lines, 16 action handlers + Anthropic wrapper + Supabase helpers + Slack notifier + agent_events logger + new `getBrandContext` helper all in one file. Editing one action means scrolling past walls of unrelated code.

### notify.js · per-client n8n routing still missing
Slack per-client routing landed 2026-05-25 (`clients.slack_webhook_url`, commit `702f867`). `n8n_webhook_url` per-client routing is still TODO — every notification triggers the global env var's webhook. Same one-block pattern as the Slack fix would close it.

### OpsBoard.jsx · tasks in memory only
Refresh resets the board. Multi-user can't share a task list. Needs a DB table.

### content_items · no migration file
Schema lives only in live Supabase. Drift risk between local dev expectations and prod. All other tables (`clients`, `agent_events`, `notifications`, `profiles`, `cid_posts`, `client_users`, `client-logos` bucket) have proper migration files.

---

## 🟢 LOW — track, no urgency

### cid_posts table · 404 on REST count probe
Table may exist but with stricter RLS than other tables. Verify in Supabase dashboard.

### briefgen · 405 KB bundle bloat
`pdfjs-dist` loaded eagerly even when this page is never opened. Dynamic import would save 405 KB for ~95% of users.

### dead-agents · `src/agents/*.agent.js`
8 files, 96 lines, zero importers. Discovered by `grep -rn "from.*agents/" src/` (matches only `src/ui/agents/`, never bare `agents/`). Safe to delete the entire directory.

### higgsfield · WIP files inconsistent state
`src/apps/higgsfield/HiggsfieldStudio.jsx` + `netlify/functions/higgsfield.js` are both untracked. Dirty edits also pending in `src/apps/apps.config.js` and `src/utils/constants.js`. Broke CI last time when commit/uncommit got out of sync. Either ship all 4 changes in one commit or delete the lot.

### /api/higgsfield · 404 in production
Function not deployed (file untracked). UI references would fail. Resolved either way by Fix #9.

### CORS still `*` on every function
Auth gate stops anonymous abuse, but tightening origin to `https://usevantus.com` would reduce surface area for credential-replay attacks.

### Rate limits absent
Authenticated misuse is uncapped. One user could hammer `/api/chat` to burn Anthropic budget. Lower urgency now that anonymous abuse is blocked but worth a `Retry-After` middleware.

### CSP / HSTS / Referrer-Policy headers missing
Not set in `netlify.toml`. Lower urgency since auth is JWT-bound + no inline-script eval.

---

## Summary by node (post 2026-05-26)

| Node | Severity | Issue |
|---|---|---|
| App.jsx | MED + MED | 1,646-line monolith · supabase-js auth-lock contention |
| agent-action.js | MED | Monolith |
| notify.js | MED | Per-client n8n routing still missing |
| OpsBoard.jsx | MED | In-memory tasks |
| content_items | MED | No migration file |
| cid_posts | LOW | RLS probe returns 404 |
| briefgen | LOW | pdfjs bundle bloat |
| src/agents/ | LOW | Dead code (8 files) |
| higgsfield (UI + fn) | LOW | Untracked WIP |
| every function | LOW | CORS `*` · no rate limits · CSP/HSTS missing |
