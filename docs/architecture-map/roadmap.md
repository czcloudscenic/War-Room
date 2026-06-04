# Roadmap — Numbered Fixes

> Regenerated 2026-06-04. Numbering matches the FIXES badges in `architecture-map.html`, [known-bugs.md](known-bugs.md), and [open-items.md](open-items.md). The 2026-06-03/04 security batch is shipped (see [open-items.md Done](open-items.md)); these are what's left.

### #1 — Scope "Why these won" to the true top performer(s) + one ranking metric
**Touches:** `src/ui/routes/AnalyticsRoute.jsx:262`, `netlify/functions/agent-action.js:1347`
- Agree one metric (engagement_rate, not raw views) and use it in both the backend `top` selection and the frontend `topPerformers` sort.
- Limit per-post "why it won" reasons to the genuine top N (e.g. top 3), not a broad set.
- Confirm `reasons[p.id]` keys line up with the displayed cards.
- **Operator-flagged; highest-visibility quick win.**

### #2 — Guard Opus generation against the 26s timeout
**Touches:** `agent-action.js` (`muse_idea_list:1185`, `muse_film_brief:1247`, `muse_ig_ideas:981`)
- Move the Tavily research off the synchronous generation path (pre-fetch, cache, or a separate call), or drop it from the Opus request when not needed.
- Trim `max_tokens` / split work so a single Opus call comfortably fits 26s on cold start.
- Add a server-side timeout + graceful error so a slow run returns a real message, not a 502.

### #3 — Idea Engine: server-side ids + block null-client sends
**Touches:** `src/ui/routes/IdeaEngineRoute.jsx:73,81`
- Drop the client-generated `Date.now()` id; let Postgres generate it (or route the insert through a service-role function).
- Disable "Send to pipeline" (or hard-error) when `clientId` is null so no orphan rows are written.

### #4 — Idea Engine: timeout/abort on the brief call
**Touches:** `src/ui/routes/IdeaEngineRoute.jsx:48`
- Wrap `openIdea`'s `muse_film_brief` fetch in an `AbortController` with a sane timeout; on timeout, show a retry state instead of an infinite spinner. (Also nice on `cook()`.)

### #5 — Surface silent parse failures as errors
**Touches:** `agent-action.js:621,486,552,1402`
- When the model-JSON parse fails, return `success:false` with a clear message instead of `success:true` + empty array/object, so the UI can show "try again" rather than a silent zero-result.

### #6 — Scope content_items realtime + initial load by client
**Touches:** `src/App.jsx:490` (and the admin initial load)
- Add `filter: client_id=eq.<id>` to the content channel (re-subscribe on `currentClient.id` change) and scope the initial select — mirror the notifications channel.

### #7 — Remove dead code
**Touches:** `agent-action.js:669` (`muse_from_brief`) + dispatch `:1462`; `src/App.jsx` import + `src/ui/dashboard/QuickActionsDashboard.jsx`
- Delete the unused handler + dispatch case and the unused component/import.

### #8 — Fix stuckGuard comment drift
**Touches:** `src/App.jsx`
- Update the comment to 8s, or lower the timeout to the documented intent.

### #9 — Scope getSyncedDigest by user_id (multi-tenant prep)
**Touches:** `agent-action.js:1320`
- Filter `connected_accounts`/`account_posts` by the requesting user/client so one tenant's ideas can't ground on another's synced posts. Required before onboarding a second client.

### #10 — Document the content_items text-PK convention
**Touches:** `supabase/migrations/20260526_content_items_baseline.sql:25`
- Add a default/format check or document the id convention so client-minted ids stay consistent (low urgency; established shape).

### #11 — Reuse `_researchDigest` in muse_ig_ideas
**Touches:** `agent-action.js:994`
- Replace the inline Tavily block with a call to the existing `_researchDigest` helper to remove divergence risk.

---

## Suggested attack order
See [open-items.md](open-items.md#suggested-attack-order). Short version: **#1 first** (operator-flagged, contained), then **#2 + #4** (the Opus-timeout/modal-hang pair that makes the Idea Engine reliable), then **#3** (data integrity), then the carryover hygiene (#5–#11).
