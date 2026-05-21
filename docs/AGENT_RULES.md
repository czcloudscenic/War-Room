# Agent Rules

## Agent Architecture

Each agent is defined in `/src/agents/{name}.agent.js` with:
- `name` — display name
- `role` — one-word role title
- `type` — category (Orchestrator, Executor, Builder, etc.)
- `color` — hex color for UI
- `grad` — gradient for card backgrounds
- `keywords` — trigger words for routeTask matching
- `prompt` — full system prompt for API calls
- `quickActions` — 4 quick action buttons in chat
- `desc` — one-line description

## Agent Roster

| Agent | Role | Color | Purpose |
|-------|------|-------|---------|
| Sean | Commander | #2AABFF | Orchestrates all agents, owns pipeline |
| Muse | Content Ideation | #ff375f | Hooks, captions, scripts, calendars |
| Scrappy | Trend Scout | #5e5ce6 | Internet research, viral signals |
| Overseer | SOP Guardian | #64d2ff | 7-step SOP compliance |
| Sam | Monitor | #ffd60a | System health, spend, security |
| Lacey | Runner | #ff9f0a | Workflows, automation, n8n |
| Ali | Developer | #0a84ff | Technical infrastructure, code |
| Artgrid | Footage Scout | #2AABFF | Artgrid.io footage sourcing |

## Routing Rules

- Sean always runs (even with 0 keyword matches)
- Other agents fire only if keyword score > 0
- Agents execute in sequence, highest score first
- Each agent gets `buildSystemPrompt()` with memory injected

## Memory Rules

- Memory is per-agent, stored in localStorage
- Keys: `vantus_mem_{AgentName}`
- Injected at the end of the system prompt
- Updated after every successful response
- Muse is pre-seeded with brand context on first load

## API Calls

- Chat: `POST /api/chat` (proxied to Anthropic)
- Actions: `POST /api/agent-action` (Supabase + AI)
- Model: `claude-sonnet-4-20250514`
- Max tokens: 400 (routeTask), 1000 (agent chat)
