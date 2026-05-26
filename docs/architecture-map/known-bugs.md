# Known Bugs & Risks

Ranked by severity. Each entry cites the file (and line when possible) where the issue lives.

## ✅ Closed 2026-05-26 (Move 1 + Fix #15)

| Bug | Closed by |
|---|---|
| agent-action.js — 12 hardcoded VitalLyfe brand prompts | `getBrandContext()` + `clients.brand_voice_md` reads per request (Move 1) |
| memory.js — hardcoded Muse pre-seed | `seedMuseMemory()` removed entirely (zero callers) |
| `#VitalLyfe` hashtag templates in 3 JSON schemas | Dynamic `#${brand.name}` interpolation |
| AgentChatPage missing `currentClient` prop | `client_id` now reaches `/api/agent-action`; chat path also gets brand voice injected |
| 9 frontend call sites on retired model IDs | `claude-sonnet-4-20250514` → `claude-sonnet-4-6` (8 sites) and `claude-3-haiku-20240307` → `claude-haiku-4-5-20251001` (1 site) |
| supabase-js auth-lock deadlock | stuckGuard now clears `sb-*-auth-token` keys + reloads (Fix #15); one-shot `sessionStorage` flag prevents reload loops |
| content_items had no migration file (Fix #10) | `20260526_content_items_baseline.sql` captures 25 cols + RLS |
| content_items wide-open `"Allow all for now"` anon policy (Fix #10.1) | Scoped SELECT+UPDATE for `client_users` added; legacy policy dropped via `20260526_content_items_client_rls.sql` |
| notify.js per-client n8n routing missing (Fix #7) | `notify.js` pulls `slack_webhook_url` + `n8n_webhook_url` together in one Supabase fetch; each falls back to global env |

Test: Muse caption generation against VitalLyfe produces correct voice/structure verified in dev + prod 2026-05-26. Auth-lock recovery verified by manual reproduction.

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

### agent-action.js · L1302 · monolith
1,302 lines, 16 action handlers + Anthropic wrapper + Supabase helpers + Slack notifier + agent_events logger + new `getBrandContext` helper all in one file. Editing one action means scrolling past walls of unrelated code.

### OpsBoard.jsx · tasks in memory only
Refresh resets the board. Multi-user can't share a task list. Needs a DB table.

_(none open — Fix #10.1 closed this 2026-05-26 by adding scoped client policies + dropping "Allow all for now". See known-bugs § Closed.)_

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
| App.jsx | MED | 1,646-line monolith (auth-lock auto-recovery shipped 2026-05-26) |
| agent-action.js | MED | Monolith |
| OpsBoard.jsx | MED | In-memory tasks |
| cid_posts | LOW | RLS probe returns 404 |
| briefgen | LOW | pdfjs bundle bloat |
| src/agents/ | LOW | Dead code (8 files) |
| higgsfield (UI + fn) | LOW | Untracked WIP |
| every function | LOW | CORS `*` · no rate limits · CSP/HSTS missing |
