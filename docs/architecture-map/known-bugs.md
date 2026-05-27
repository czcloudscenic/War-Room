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
| src/agents/ 8-file dead code folder (Fix #8) | `rm -rf src/agents/` — confirmed zero importers, build passed |
| pdfjs-dist eager-loaded bundle bloat (Fix #11) | Already shipped — `BriefGenPage.jsx:7` does `await import('pdfjs-dist')`; pdfjs lives in its own 405 KB chunk |
| cid_library.vitallyfe_adaptation last hardcoded VL reference (Fix #3.1) | Column renamed → `client_adaptation` via `20260526_cid_library_rename_adaptation.sql`; 3 code sites updated |
| Fix #2 — App.jsx 1,676-line monolith | Codex extracted 6 route components to `src/ui/routes/`; App.jsx down to 1,342 lines |
| Security sweep — CORS `*`, rate limits, CSP/HSTS/Referrer-Policy | CORS allowlist via `_lib/requireUser.js cors(event)`; `_lib/rateLimit.js` wired into chat (30/min) + agent-action (60/min); `netlify.toml` adds HSTS + Referrer-Policy + Permissions-Policy + tight CSP |
| Fix #9 — Higgsfield WIP files in inconsistent state | `HiggsfieldStudio.jsx` + `higgsfield.js` removed from working tree (closed by removal). `apps.config.js` + `constants.js` clean. Future Higgsfield ship is a fresh commit, not a recovered orphan. |

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

### App.jsx · L1342 · still owns all state
1,342 lines after the Fix #2 route split (Codex, 2026-05-26). Six route components now live in `src/ui/routes/` — they're pure presentation receiving state/setters/handlers as props. App.jsx remains the single owner of every piece of state in the app. Deeper extraction (state hooks, context providers) is the next refactor, lower urgency than the agent-action.js split.

### agent-action.js · L1317 · monolith
1,317 lines, 16 action handlers + Anthropic wrapper + Supabase helpers + Slack notifier + agent_events logger + `getBrandContext` helper + rate-limit gate all in one file. Editing one action means scrolling past walls of unrelated code. Same shape as the App.jsx split Codex just landed — perfect Codex candidate. Fix #4.

### OpsBoard.jsx · tasks in memory only
Refresh resets the board. Multi-user can't share a task list. Needs a DB table. Fix #12.

---

## 🟢 LOW — track, no urgency

### cid_posts table · 404 on REST count probe
Table may exist but with stricter RLS than other tables. Verify in Supabase dashboard.

---

## Summary by node (post 2026-05-26 PM)

| Node | Severity | Issue |
|---|---|---|
| App.jsx | MED | 1,342-line state owner (route split shipped) |
| agent-action.js | MED | 1,317-line monolith — Fix #4 (Codex candidate) |
| OpsBoard.jsx | MED | In-memory tasks — Fix #12 |
| cid_posts | LOW | RLS probe returns 404 |
