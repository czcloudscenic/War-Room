# Ripped agents — 2026-06-01

Removed from Vantus to cut weight ahead of the IG-analyzer pivot. These agents existed in the VitalLyfe ops layer and serve no role in "log in to IG/TikTok/YT, analyze account, generate content ideas."

## What was ripped

| Agent | Role | Backend handlers ripped |
|---|---|---|
| **Lacey** | Runner / Executor | `lacey_advance`, `lacey_trigger_n8n` |
| **Ali** | Developer / Builder | (frontend chat-only — no backend handler) |
| **Sam** | Monitor / Security | `sam_health` |
| **Overseer** | SOP Guardian / Compliance | `overseer_scan` |

Sean was kept (Commander/Orchestrator). Muse, Scrappy, Artgrid kept.

## Files in this folder

- `ripped-handlers.js` — backend functions from `netlify/functions/agent-action.js`
- `ripped-registry.js` — entries from `src/core/agentRegistry.js` + `src/data/seed.agents.js`
- `ripped-ui-snippets.md` — AgentChatPage / TeamBroadcast / ActivityFeed / QuickActions sections

## Reviving one

1. Copy the function back into `netlify/functions/agent-action.js`.
2. Add the matching `case "<action>": result = await <handler>(payload, brand); break;` in the router switch (around line ~1244).
3. Add the Slack label in `SLACK_AGENT_LABELS` (top of agent-action.js).
4. Add the agent entry back to `src/data/seed.agents.js` (AGENTS_BASE + AGENT_TASKS + ACTIVITY_POOL) and `src/core/agentRegistry.js` (AGENT_KEYWORDS + ROUTE_PROMPTS + AGENT_PROMPTS).
5. Restore the AgentChatPage button + quick caps + description from `ripped-ui-snippets.md`.
