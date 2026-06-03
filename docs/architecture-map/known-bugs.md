# Known Bugs & Risks

> Regenerated 2026-06-03. Every entry cites `file:line`. Cross-references numbered fixes in [roadmap.md](roadmap.md) and checkboxes in [open-items.md](open-items.md).

## 🔴 HIGH

### H1 — CID write path throws `ReferenceError` (and writes via anon key)
`src/apps/competitor-intel/CIDPage.jsx:381,442` reference `SUPABASE_URL` / `SUPABASE_KEY`, but the file only imports `apiFetch` and `ReactDOM` (`:1-3`). Clicking **"Send to Content Tracker"** or **"Log Results"** throws `ReferenceError: SUPABASE_URL is not defined` — both the content-tracker insert and the performance-log save fail (only surfaced via `alert`/`console.error`). Even if imported, the write uses the browser anon key directly instead of the user's authenticated session. → **Fix #1.**

### H2 — `cid_library` has no CREATE TABLE migration
`netlify/functions/agent-action.js:822` POSTs to `cid_library`, but the only migration referencing it (`20260526_cid_library_rename_adaptation.sql:17`) merely renames a column. The table's schema exists solely as a code comment (`agent-action.js:759-763`). Live prod has it; the repo can't recreate it. → **Fix #2.**

### H3 — `cid_performance` has no migration + is written from the browser
`src/apps/competitor-intel/CIDPage.jsx:442-459` inserts using the anon key as both `apikey` and `Bearer`. For this to ever succeed live, an **unmanaged anon-writable RLS policy** must exist off-repo — an unauthenticated write surface with no schema in version control. → **Fixes #1, #2.**

---

## 🟡 MED

### M1 — "Why these won" analysis scope/ranking (operator-flagged)
`scrappy_analyze_performance` (`agent-action.js:1087`) returns reasons for the top 6 posts per platform; `AnalyticsRoute.jsx:262` independently ranks the displayed top set by `engagement_rate`. The result: reasons surface across multiple cards and the highlighted "winner" tracks raw views rather than one consistent metric. Should be scoped to the true top performer(s) with a single agreed ranking metric shared by front and back end. → **Fix #3.**

### M2 — Rate-limit gap on credit-spending / fanout functions
`apify-scrape.js:16`, `unsplash.js:13`, `sync-instagram.js:115`, `sync-tiktok.js:130`, `sync-youtube.js:115`, `notify.js:61` all call `requireUser` but never `rateLimit` (only `chat.js` and `agent-action.js` do). Any authenticated user — including an approved external client — can loop these freely: `apify-scrape` burns Apify credits, sync hammers paid platform APIs, notify fans out email/Slack/n8n. → **Fix #4.**

### M3 — OAuth deauthorize/data-deletion webhooks are unverified no-ops
All six stubs (e.g. `oauth-instagram-deauthorize.js:11`, `oauth-instagram-data-deletion.js:13`) accept any POST, verify no `signed_request` signature, and never delete tokens or account rows. A user who revokes access on the platform leaves their (plaintext) token live in `connected_account_tokens` indefinitely; data-deletion returns a fabricated confirmation code (compliance gap). → **Fix #5.**

### M4 — OAuth tokens stored in plaintext
`_lib/oauth.js:122-135` writes `access_token`/`refresh_token` unencrypted into `connected_account_tokens`; sync functions read them back raw. Combined with M3 (never deleted on revoke), this widens blast radius if the DB or service key leaks. (The table's service-role-only RLS is correct — the issue is at-rest encryption.) → **Fix #6.**

### M5 — Stored/email HTML injection in notify.js
`notify.js:138-144` interpolates `item.title`, `item.campaign`, `item.platform`, `item.pillar`, and `item.client_note` straight into the Resend email HTML with no escaping (`:123` likewise). These fields are client-editable, so a crafted `client_note` renders arbitrary HTML/links in admins' inboxes (phishing/spoof vector). → **Fix #7.**

### M6 — `content_items` realtime + initial load are not client-scoped
`App.jsx:134` (admin initial load) and `:489` (realtime subscription) pull all `content_items` with `event:"*"`; scoping happens only at render (`:807`). Every browser holds the full multi-tenant set in memory and receives realtime events for clients not on screen — fine for admins, but a leak risk if an external client role reaches the main shell (the comment at `:353` notes approved external clients now land there). → **Fix #9.**

### M7 — `profiles` "Service role full access" is wide open
`002_profiles.sql:20` is `FOR ALL USING(true)` with no role restriction, so it applies to `public`/anon too (service role already bypasses RLS and doesn't need it). → **Fix #10.**

### M8 — CORS fail-open on writes for unknown origins
`_lib/requireUser.js:26` returns a fallback origin for non-allowlisted callers but the function still executes and writes. The browser blocks the response read, but a token-bearing non-browser caller is unaffected — CORS provides no real write protection (auth + RLS are the actual gate). → **Fix #17.**

---

## 🟢 LOW

### L1 — `chat.js` forwards an unvalidated client body
`chat.js:43-52` passes the parsed body straight to Anthropic with no `max_tokens` cap or model allowlist; the 30/min limit bounds call count but not per-call cost. → **Fix #8.**

### L2 — Dead handler `muse_from_brief`
`agent-action.js:669` is fully wired into the switch (`:1202`) but has zero frontend callers — appears only as a display label in `ActivityFeed.jsx:27`. → **Fix #11.**

### L3 — Dead components / imports
`QuickActionsDashboard` (`App.jsx:20`), `TypingTask` (`:32`), `PlaceholderPage` (`:33`) imported but never rendered; `OPS_INIT` imported (`:12`) but unused in App. → **Fix #11.**

### L4 — sync-instagram serial loop + unused timeout
`sync-instagram.js:18` declares `INSIGHTS_TIMEOUT_MS=8000` but never uses it; the handler awaits up to 30 per-media insight calls **serially** (`:197`), risking the 26s function timeout for full accounts. → **Fix #12.**

### L5 — stuckGuard comment/value drift
`App.jsx:238` comment says the guard fires at 4s, but the actual timeout is 8000ms (`:269`) — anyone tuning the recovery window trusts a stale number. → **Fix #13.**

### L6 — `oauth_states` has no expiry cleanup
`20260601_connected_accounts.sql:124` sets `expires_at` but nothing deletes expired rows. → **Fix #14.**

### L7 — SettingsPage toggles/invite are display-only
`SettingsPage.jsx:154-157,297` — AI toggles + "Invite Team Member" have no persistence/backend (invite just toasts); misleading UI. → **Fix #15.**

### L8 — `content_items` PK is text with no default
`20260526_content_items_baseline.sql:25` — app-supplied string IDs, no DB generation/format constraint; drift vs UUID/bigserial tables. Combined with `CIDPage.jsx:368` using `id:Date.now()`.

### L9 — VitalLyfe seeded into canonical migrations
`20260523_clients_multitenant.sql:53` + `20260526_seed_vitallyfe_brand_voice.sql:13` hardcode one tenant's voice/email into the migration set. → **Fix #16.**

### L10 — `DB_CONNECTED` hardcoded true
`supabaseClient.js:14` — the UI's offline indicator (`App.jsx:454`) can never show. Design quirk, not a defect.

### L11 — Agent-count copy inconsistency
`TeamBroadcast.jsx:76` says "all 8 agents", `AgentChatPage.jsx:216` shows "7 Agents", `SkillsPage.jsx:44` "8 agents" — only 4 agent personas exist. → **Fix #17 (cosmetic bucket).**

### L12 — `vite.config.js:12` dev proxy hardcoded
Dev `/api` proxy points at `majestic-cassata-aa16e9.netlify.app`; renaming the site silently breaks local dev. → **Fix #16.**
