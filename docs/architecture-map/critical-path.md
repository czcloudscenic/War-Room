# Critical Path — the Agent Action Spine

The single most important code path in Vantus: **a user clicks an agent action button → request is authenticated → Claude responds → DB is updated → live UI reflects it.**

If this path breaks, the product is broken. Every other code path is decoration around this one.

```
User
 │
 ▼
[1] src/App.jsx (or AgentChatPage.jsx) ← quick-action button
 │   apiFetch('/api/agent-action', { method:'POST', body:{ action, payload, client_id } })
 │   ↳ services/apiFetch.js wraps fetch + attaches Authorization: Bearer <access_token>
 ▼
[2] netlify/functions/agent-action.js  (exports.handler · L1160)
 │   ↳ requireUser(event) — reject if no valid Supabase JWT
 │   ↳ parse → switch(action) at L1189 → call specific handler (e.g. muse_write_content)
 ▼
[3] ai(systemPrompt, userPrompt)  ← agent-action.js:113
 │   POST https://api.anthropic.com/v1/messages
 │   { model: 'claude-haiku-4-5-20251001', system, messages }   ← L127
 ▼
[4] Anthropic API responds with generated text
 │
 ▼
[5] sbPatch('content_items', `id=eq.${itemId}`, { [field]: text })
 │   PATCH https://wjcstqqihtebkpyuacop.supabase.co/rest/v1/content_items
 │   (uses SUPABASE_SERVICE_KEY → bypasses RLS server-side)
 ▼
[6] logAgentEvent({ agent_name, action_key, payload, result_status, ... })  ← L67
 │   POST /rest/v1/agent_events   ← Move 2 history
 ▼
[7] postToSlack(label, msg)
 │   → SLACK_WEBHOOK_URL → #vitallyfe-war-room (global; per-client routing only on /api/notify)
 ▼
[8] Return JSON to client
 │
 ▼ ┌──────────────────────────────────────────────────┐
   │ Supabase Realtime fires on both tables:          │
   │  • content_items channel → App.jsx setContent    │
   │  • agent_events channel → ActivityFeed prepends  │
   └──────────────────────────────────────────────────┘
 │
 ▼
[9] UI updates live without page refresh
```

---

## Critical nodes (every one of these is load-bearing)

| Step | Node | File | Why critical |
|---|---|---|---|
| 1 | App.jsx | `src/App.jsx` (1,342 lines, post Fix #2) | Holds the entire fetch + state + realtime subscription logic + 4-way auth gate. Routes are dumb props consumers under `src/ui/routes/`. |
| 1 | AgentChatPage | `src/ui/agents/AgentChatPage.jsx` | Alternate entry into the same `/api/agent-action` endpoint. |
| 1 | apiFetch | `src/services/apiFetch.js` (25 lines) | Stamps `Authorization: Bearer <token>` on every protected call. Without it: 401 on every action. |
| 2 | requireUser | `netlify/functions/_lib/requireUser.js` (124 lines) | Validates JWT against `/auth/v1/user` + checks @cloudscenic.com admin OR `client_users` allowlist; also exports `cors(event)` for per-request CORS headers. |
| 2 | agent-action.js | `netlify/functions/agent-action.js` (1,317 lines) | All 16 actions route through this monolith. |
| 3 | `ai()` helper | `netlify/functions/agent-action.js:113-131` | Single point of contact with Anthropic API. |
| 5 | content_items table | live Supabase (no migration file!) | Backing store for every content piece. |
| 6 | agent_events table | `supabase/migrations/20260523_agent_events.sql` | The brain — every agent decision logged here. |
| 8 | supabaseClient.js | `src/services/supabaseClient.js` | Throws at module-load if VITE env vars missing → whole app crashes. |
| 9 | ActivityFeed.jsx | `src/ui/dashboard/ActivityFeed.jsx` | Live consumer of the agent_events stream. |

## Critical-path edges (color = red in HTML map)

```
main.jsx          ──render──▶          App.jsx
App.jsx           ──apiFetch wrapper──▶ services/apiFetch.js
apiFetch          ──Bearer <token>──▶  /api/agent-action
AgentChatPage     ──POST · quick action──▶    /api/agent-action
/api/agent-action ──verify──▶                 _lib/requireUser.js
requireUser       ──check allowlist──▶        client_users table
/api/agent-action ──messages──▶               Anthropic (claude-haiku-4-5)
/api/agent-action ──PATCH · save result──▶    content_items
/api/agent-action ──INSERT · log event──▶     agent_events
agent_events      ──realtime INSERT──▶        ActivityFeed
content_items     ──realtime UPDATE──▶        App.jsx
```

## What happens if any of these break

| If this breaks | Symptom |
|---|---|
| `App.jsx` setupSession auth check | Stuck on "Checking session..." indefinitely (mitigated by 4s stuckGuard) |
| `services/apiFetch.js` not used | 401 from every protected function — `chat`, `agent-action`, `notify`, `apify-scrape`, `unsplash` |
| `requireUser` returns `{ ok:false }` | Function returns 401 — UI sees a network error toast |
| `/api/agent-action` 5xx | Agent buttons hang or show error toasts |
| Anthropic API down / model name wrong | `result_status: "error"` in agent_events; chat returns nothing |
| `content_items` write fails | Action "succeeds" but tracker doesn't update; user retries until duplicate |
| `agent_events` write fails | Action works but activity feed stays stale (log is best-effort, not blocking) |
| Realtime subscription drops | UI shows stale data until manual refresh |
| `supabaseClient.js` env var missing | App crashes at mount with thrown Error |

## Recent failures on this path (closed, but worth remembering)

1. **Anthropic model deprecation** (commit `54870ae`) — `claude-3-haiku-20240307` started returning errors; every agent invocation failed silently. Fixed by upgrading to `claude-haiku-4-5-20251001`. *Move 2's agent_events logging is what surfaced this — pre-Move-2 it was hidden by fake ACTIVITY_POOL theater.*
2. **Broken Higgsfield import in App.jsx** (commit `5d5300b`) — caused CI builds to fail with `UNRESOLVED_IMPORT`. Local builds worked because the untracked file was on disk; CI didn't have it. *Closed 2026-05-26 PM by removing the Higgsfield WIP files entirely — Fix #9 closed by removal. If Higgsfield ships later, it has to be a fresh atomic commit, not a recovered orphan.*
3. **`createPortal` import path bug** (commit `587db1d`) — was importing from `react-dom/client` (no `createPortal` export). Notification panel silently failed to render for weeks.
4. **Auth gate flicker / stuck-checking** (commit `307b64f` + hotfix `d0acec3`) — duplicate `setupSession()` runs caused `checking` state to stay true forever. Fixed with a dedupe ref + 4s `stuckGuard` that forces `checking=false` when supabase-js `navigator.locks` deadlocks.
