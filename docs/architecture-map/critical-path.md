# Critical Path — the Agent Action Spine

The single most important code path in Vantus: **a user clicks an agent action button → Claude responds → DB is updated → live UI reflects it.**

If this path breaks, the product is broken. Every other code path is decoration around this one.

```
User
 │
 ▼
[1] src/App.jsx           ← handleMuseWrite / handleIgIdeas / quick-action button
 │   fetch('/api/agent-action', { action, payload, client_id })
 ▼
[2] netlify/functions/agent-action.js  (exports.handler)
 │   ↳ parse → switch(action) → call specific handler (e.g. muse_write_content)
 ▼
[3] ai(systemPrompt, userPrompt)  ← agent-action.js:113
 │   POST https://api.anthropic.com/v1/messages
 │   { model: 'claude-haiku-4-5-20251001', system, messages }
 ▼
[4] Anthropic API responds with generated text
 │
 ▼
[5] sbPatch('content_items', `id=eq.${itemId}`, { [field]: text })
 │   PATCH https://wjcstqqihtebkpyuacop.supabase.co/rest/v1/content_items
 ▼
[6] logAgentEvent({ agent_name, action_key, payload, result_status, ... })
 │   POST /rest/v1/agent_events   ← Move 2 history
 ▼
[7] postToSlack(label, msg)
 │   → SLACK_WEBHOOK_URL → #vitallyfe-war-room
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
| 1 | App.jsx | `src/App.jsx` | Holds the entire fetch + state + realtime subscription logic. 1,471 lines. |
| 1 | AgentChatPage | `src/ui/agents/AgentChatPage.jsx` | Alternate entry into the same `/api/agent-action` endpoint. |
| 2 | agent-action.js | `netlify/functions/agent-action.js` | All 16 actions route through this monolith. |
| 3 | `ai()` helper | `netlify/functions/agent-action.js:113-131` | Single point of contact with Anthropic API. |
| 5 | content_items table | live Supabase (no migration file!) | Backing store for every content piece. |
| 6 | agent_events table | `supabase/migrations/20260523_agent_events.sql` | The brain — every agent decision logged here. |
| 8 | supabaseClient.js | `src/services/supabaseClient.js` | Throws at module-load if VITE env vars missing → whole app crashes. |
| 9 | ActivityFeed.jsx | `src/ui/dashboard/ActivityFeed.jsx` | Live consumer of the agent_events stream. |

## Critical-path edges (color = red in HTML map)

```
main.jsx          ──render──▶          App.jsx
App.jsx           ──POST /api/agent-action──▶  /api/agent-action
AgentChatPage     ──POST · quick action──▶    /api/agent-action
/api/agent-action ──messages──▶               Anthropic (claude-haiku-4-5)
/api/agent-action ──PATCH · save result──▶    content_items
/api/agent-action ──INSERT · log event──▶     agent_events
agent_events      ──realtime INSERT──▶        ActivityFeed
content_items     ──realtime UPDATE──▶        App.jsx
```

## What happens if any of these break

| If this breaks | Symptom |
|---|---|
| `App.jsx` auth check / state | White screen or wrong route |
| `/api/agent-action` 5xx | Agent buttons hang or show error toasts |
| Anthropic API down / model name wrong | `result_status: "error"` in agent_events; chat returns nothing |
| `content_items` write fails | Action "succeeds" but tracker doesn't update; user retries until duplicate |
| `agent_events` write fails | Action works but activity feed stays stale (log is best-effort, not blocking) |
| Realtime subscription drops | UI shows stale data until manual refresh |
| `supabaseClient.js` env var missing | App crashes at mount with thrown Error |

## Recent failures on this path (closed, but worth remembering)

1. **Anthropic model deprecation** (commit `54870ae`) — `claude-3-haiku-20240307` started returning errors; every agent invocation failed silently. Fixed by upgrading to `claude-haiku-4-5-20251001`. *Move 2's agent_events logging is what surfaced this — pre-Move-2 it was hidden by fake ACTIVITY_POOL theater.*
2. **Broken Higgsfield import in App.jsx** (commit `5d5300b`) — caused CI builds to fail with `UNRESOLVED_IMPORT`. Local builds worked because the untracked file was on disk; CI didn't have it.
3. **`createPortal` import path bug** (commit `587db1d`) — was importing from `react-dom/client` (no `createPortal` export). Notification panel silently failed to render for weeks.
