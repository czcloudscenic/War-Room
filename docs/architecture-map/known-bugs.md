# Known Bugs & Risks

> Regenerated 2026-06-04. Every entry cites `file:line`. Cross-references fixes in [roadmap.md](roadmap.md) and checkboxes in [open-items.md](open-items.md). **0 HIGH · 7 MED · 7 LOW.**

## ✅ Recently fixed (shipped 2026-06-03/04 — no longer open)
The Codex security/OAuth batch closed these: rate limits on all 6 ungated functions (#4), notify HTML-escaping (#7), chat model/max_tokens validation (#8), sync-instagram timeout + concurrency (#12), CID write `ReferenceError` repair (#1), `cid_library`/`cid_performance` migrations (#2), **OAuth token encryption at rest** (#6), **real OAuth deauthorize/data-deletion + signed-request verification** (#5), dropped the wide-open `profiles` policy (#10), CORS 403 on bad origins (#17), `oauth_states` cleanup (#14), SettingsPage honesty (#15), seed/dev-proxy de-coupling (#16). These are kept in [open-items.md](open-items.md#done) as Done.

---

## 🟡 MED

### M1 — "Why these won" analysis scope/ranking (operator-flagged)
`src/ui/routes/AnalyticsRoute.jsx:262` ranks the displayed top set by `engagement_rate` while `scrappy_analyze_performance` (`agent-action.js:1347`) returns reasons for the top 6 per platform — so reasons surface across multiple cards and the highlighted "winner" tracks raw views, not one consistent metric. → **Fix #1.**

### M2 — Opus 4.8 generation vs the 26s function timeout
`netlify/functions/agent-action.js:1236` (`muse_idea_list`), `:1289` (`muse_film_brief`), `:1074` (`muse_ig_ideas`) all generate on Opus 4.8. `muse_idea_list`/`muse_ig_ideas` also run `getSyncedDigest` (2 Supabase reads) + serial Tavily *advanced* searches on the same request before the model call. Stacked latency can exceed Netlify's 26s cap → 502. The two-stage design comment claims to dodge this, but the research/synced fetch is still synchronous. → **Fix #2.**

### M3 — Silent JSON parse-failure reported as success
`agent-action.js:621` (`muse_generate_calendar`), `:486` (`scrappy_muse_collab`), `:552` (`artgrid_scout`), `:1402` (`scrappy_analyze_performance`) all `catch` a bad model-JSON parse and return `success:true` with an empty array/object. A model error looks identical to a genuine empty result — silent data loss / confusing UX. → **Fix #5.**

### M4 — Idea Engine inserts content_items with a client-generated id
`src/ui/routes/IdeaEngineRoute.jsx:73` sets `id: \`${slug||'ig'}-idea-${Date.now()}\`` and inserts via the sb client. `Date.now()` collides on rapid double-send, and if the column type ever changes this type-errors; it also bypasses any DB default. → **Fix #3.**

### M5 — Idea Engine film-brief call has no timeout guard
`src/ui/routes/IdeaEngineRoute.jsx:48` (`openIdea`) awaits `muse_film_brief` with no AbortController/timeout. A slow Opus brief leaves `briefLoading=true` and the modal stuck on the "Building the full brief…" spinner with no escape but closing the modal. → **Fix #4.**

### M6 — Idea Engine null-client insert orphans rows
`src/ui/routes/IdeaEngineRoute.jsx:81` spreads in `client_id` only when truthy; `clientId` (`:31`) falls back to localStorage and can be null. A null-client send writes a `content_items` row with no `client_id`, orphaning it / leaking it across client views depending on RLS. No guard blocks the send. → **Fix #3.**

### M7 — content_items realtime + initial load not client-scoped
`src/App.jsx:490` subscribes to ALL `content_items` (`event:"*"`, no `filter:`); scoping happens only at render. Every browser holds the full multi-tenant set and receives realtime events for off-screen clients — fine for admins, a leak risk if an external client role reaches the main shell. → **Fix #6.**

---

## 🟢 LOW

### L1 — Dead handler `muse_from_brief`
`agent-action.js:669` fully wired + dispatched (`:1462`) but zero frontend callers (only the label string `ActivityFeed.jsx:27`). → **Fix #7.**

### L2 — `getSyncedDigest` reads all rows via service role
`agent-action.js:1320` — reads every `connected_accounts`/`account_posts` row. Fine single-tenant; a latent multi-tenant leak (one client's ideas grounded on another's posts) once `user_id` scoping is missing. → **Fix #9.**

### L3 — `muse_ig_ideas` duplicates the Tavily research block inline
`agent-action.js:994` reimplements `_researchDigest` (`:1158`) inline — divergence risk + extra latency on the Opus path. → **Fix #11.**

### L4 — stuckGuard comment/value drift
`src/App.jsx` — the comment says the auth-lock guard fires at 4s, but the timeout is 8000ms. → **Fix #8.**

### L5 — `content_items` PK is text with no default
`supabase/migrations/20260526_content_items_baseline.sql:25` — app-supplied string ids, no DB generation/format constraint; both `App.jsx` and the Idea Engine mint ids client-side. → **Fix #10.**

### L6 — `DB_CONNECTED` hardcoded true
`src/services/supabaseClient.js:14` — the UI's offline indicator can never show. Design quirk, not a defect.

### L7 — Dead component `QuickActionsDashboard`
`src/ui/dashboard/QuickActionsDashboard.jsx:26` — imported in `App.jsx`, never rendered. → **Fix #7.**

---

## Notes / watch-items (not bugs)
- **CID tables are admin-only RLS** (`@cloudscenic.com`) — fine for agency-internal data; no per-client isolation.
- **Apify account billing must be current** — competitor scraping (CIDPage) is dead while invoices are outstanding.
- **YouTube OAuth consent screen still in Testing mode** — 7-day token expiry; publish before opening to other users.
