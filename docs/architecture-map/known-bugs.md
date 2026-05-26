# Known Bugs & Risks

Ranked by severity. Each entry cites the file (and line when possible) where the issue lives.

## ✅ Closed 2026-05-25

The following HIGH-severity bugs all closed in today's session:

| Bug | Closed by |
|---|---|
| App.jsx — AUTH BYPASS | Commit `8e5095e` (gate restored) + hotfix `d0acec3` |
| agent-action.js — no caller auth | Commit `2a9c9c1` (requireUser gate) |
| chat.js — no caller auth | Commit `2a9c9c1` |
| notify.js — no caller auth | Commit `2a9c9c1` |
| google-oauth — exchange fails | Client_secret rotated + verified |

MED-severity closures: `notify.js` global Slack only → per-client routing (commit `702f867`). LOW-severity: 5 temp anon RLS policies on agent_events / notifications / clients / client-logos — all dropped (commit `852d915`).

## 🔴 HIGH — fix soon

_(none open — all closed 2026-05-25)_

---

## 🟡 MED — fix when planning the next refactor

### App.jsx · 1,500+ line component
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

### notify.js · per-client n8n routing still missing
Slack per-client routing landed 2026-05-25 (`clients.slack_webhook_url`). `n8n_webhook_url` per-client routing still TODO — every notification still falls back to the global env var.

### OpsBoard.jsx · tasks in memory only
Refresh resets the board. Multi-user can't share a task list. Needs a DB table.

### content_items · no migration file
Schema lives only in live Supabase. Drift risk between local dev expectations and prod. All other tables have proper migration files.

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

### ~~Temp anon RLS policies (5 places)~~ ✅ DROPPED 2026-05-25
All temp anon policies dropped in commit `852d915` (`20260525_drop_temp_anon_policies.sql`). Admin-only access enforced everywhere.

### App.jsx · supabase-js auth lock contention
Multi-tab usevantus.com or stale localStorage hangs `sb.auth.getSession()` / `signOut()` / DB queries indefinitely. Mitigated by 4s `stuckGuard` timeout that forces `checking=false`, but the underlying queries still error. Workaround: `localStorage.clear(); location.reload();`. Real fix would be an auto-recovery loop in setupSession.

---

## Summary by node (post 2026-05-25)

| Node | Severity | Issue |
|---|---|---|
| App.jsx | MED + LOW | 1500+-line monolith · supabase-js auth lock contention |
| agent-action.js | MED + MED | Monolith · hardcoded brand voice |
| notify.js | MED | Per-client n8n routing still missing |
| memory.js | MED | Hardcoded Muse pre-seed |
| OpsBoard.jsx | MED | In-memory tasks |
| content_items | MED | No migration file |
| cid_posts | LOW | RLS probe returns 404 |
| briefgen | LOW | pdfjs bundle bloat |
| src/agents/ | LOW | Dead code |
| higgsfield (UI + fn) | LOW | Untracked WIP |
