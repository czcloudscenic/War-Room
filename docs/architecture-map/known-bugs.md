# Known Bugs & Risks

Ranked by severity. Each entry cites the file (and line when possible) where the issue lives.

## 🔴 HIGH — fix soon

### App.jsx · L116-117 · AUTH BYPASS
**Anonymous visitors get admin access.** `if(!session)` is commented out, falls through to admin fallback user. Intentional + documented but a real risk if anyone discovers the URL. Reversal blocked on Google OAuth debugging.
```js
// src/App.jsx:116-117
// AUTH BYPASS (temporary — Google OAuth debug pending).
// if (!session) return <LoginScreen />;
```

### agent-action.js · no caller auth
Anyone on internet can POST to `/api/agent-action` and either burn Anthropic budget OR write to Supabase via SERVICE_KEY (which bypasses RLS). Only `cid-scrape.js` requires a bearer token.

### chat.js · no caller auth + no rate limit
Anonymous burn of Anthropic key. `chat.js` forwards any POST body to Anthropic without authentication.

### notify.js · no caller auth
Anyone can spam notifications + trigger emails to `ADMIN_EMAILS` via Resend.

---

## 🟡 MED — fix when planning the next refactor

### App.jsx · 1,471-line component
Cognitive load + harder to test in isolation. Phase 3.x of `docs/REFACTOR_PLAN.md` was meant to split this; never done. The `Vantus` shell component alone is ~1,040 lines.

### agent-action.js · L1255 · monolith
1,255 lines, 16 action handlers + Anthropic wrapper + Supabase helpers + Slack notifier + event logger all in one file. Editing one action means scrolling past walls of unrelated code.

### agent-action.js · L138-144 · hardcoded brand voice
`muse_write_content` system prompt mentions "VitalLyfe", "cinematic, calm, purposeful" inline. Wrong for any non-VitalLyfe client. This is what Brain Move 1 was supposed to fix (per-client `brand_voice_md` lookup).
```js
// netlify/functions/agent-action.js:138-144
const systemPrompt = `You are Muse, Content Ideation Agent for the VitalLyfe Vantus by Cloud Scenic.
Write captions for the VitalLyfe brand.
Brand voice: cinematic, calm, purposeful. Key phrases: abundance, access, built for beyond.
AVOID: revolutionary, game-changing, exclamation points.
...`;
```

### memory.js · L75-81 · hardcoded Muse pre-seed
```js
// src/core/memory.js:75-81
if (!getMemory('Muse').brand) {
  setMemory('Muse', {
    brand: 'VitalLyfe',
    tone: 'cinematic calm purposeful never corporate',
    campaigns: ['Drip Campaign', 'Meet the Makers', 'Product Launch'],
    pillars: ['Abundance', 'Access', 'Innovation', ...],
  });
}
```
Blocks multi-tenancy. Should pull from `clients.brand_voice_md` instead.

### notify.js · global SLACK_WEBHOOK_URL ignored per-client
All notifications go to `#vitallyfe-war-room` regardless of which client triggered. The `clients.slack_channel_id` column exists but isn't consumed. Same gap for `n8n_webhook_url`.

### OpsBoard.jsx · tasks in memory only
Refresh resets the board. Multi-user can't share a task list. Needs a DB table.

### content_items · no migration file
Schema lives only in live Supabase. Drift risk between local dev expectations and prod. All other tables have proper migration files.

### google-oauth · exchange fails
"Unable to exchange external code" — likely client_secret mismatch between Supabase and Google. Auth flow can't complete. Pull Supabase auth-logs to diagnose.

---

## 🟢 LOW — track, no urgency

### cid_posts table · 404 on REST count probe
Table may exist but with stricter RLS than other tables. Verify in Supabase dashboard.

### briefgen · 405 KB bundle bloat
`pdfjs-dist` loaded eagerly even when this page is never opened. Dynamic import would save 405 KB for ~95% of users.

### dead-agents · `src/agents/*.agent.js`
8 files, 96 lines, zero importers. Discovered by `grep -rn "from.*agents/" src/`. Safe to delete the entire directory.

### higgsfield · WIP files inconsistent state
`HiggsfieldStudio.jsx` + `higgsfield.js` are both untracked. Broke CI when commit/uncommit got out of sync. Either ship together or delete.

### /api/higgsfield · 404 in production
Function not deployed (file untracked). Any UI references to it would fail.

### Temp anon RLS policies (5 places)
Marked with TODO comments — must drop when OAuth comes back:
- `agent_events.sql:34` — "anon read while auth bypassed (TODO remove)"
- `notifications.sql:44-49` — "anon read/update while auth bypassed (TODO remove)"
- `clients_multitenant.sql:44-46` — "anon read/write clients (TODO remove)"
- `client_logos_bucket.sql:16,20,24` — "Anon upload/update/delete client-logos (TODO restrict to admins)"

---

## Summary by node

| Node | Severity | Issue |
|---|---|---|
| App.jsx | HIGH + MED | Auth bypass · 1471-line monolith |
| agent-action.js | HIGH + MED + MED | No caller auth · monolith · hardcoded brand voice |
| chat.js | HIGH | No caller auth |
| notify.js | HIGH + MED | No caller auth · global Slack only |
| memory.js | MED | Hardcoded Muse pre-seed |
| OpsBoard.jsx | MED | In-memory tasks |
| content_items | MED | No migration file |
| google-oauth | MED | Exchange fails |
| cid_posts | LOW | RLS probe returns 404 |
| briefgen | LOW | pdfjs bundle bloat |
| src/agents/ | LOW | Dead code |
| higgsfield (UI + fn) | LOW | Untracked WIP |
| events_tbl, notifs_tbl, clients_tbl, logos_bucket | LOW | Temp anon RLS policies |
