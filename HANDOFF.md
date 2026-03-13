# War Room Handoff Brief — March 12, 2026

## Project
Cloud Scenic × VitalLyfe "War Room" — content operations dashboard
Live at: https://majestic-cassata-aa16e9.netlify.app
GitHub: https://github.com/czcloudscenic/War-Room.git (auto-deploys on push to main)

## Stack
- Single file React 18 (CDN + Babel) — index.html (~2500 lines)
- Supabase backend: https://wjcstqqihtebkpyuacop.supabase.co
- Netlify Functions: /netlify/functions/agent-action.js + chat.js
- API routes: /api/chat → chat.js, /api/agent-action → agent-action.js

## Env Vars (Netlify)
- ANTHROPIC_API_KEY
- SUPABASE_SERVICE_KEY
- SUPABASE_URL
- TAVILY_API_KEY
- N8N_WEBHOOK_URL = https://cloudscenic.app.n8n.cloud/webhook/11138e92-248c-4562-be17-5e07b9da928c

## Nav Structure
- COMMAND: Dashboard, Agents
- CONTENT: Instagram, TikTok, YouTube, Content Tracker, Task Board
- BUSINESS: Ad ROI Hub, Team Broadcast
- OPERATIONS: ArtGrid Scout, References, Skills, SOPs

## Agent Actions (agent-action.js)
- muse_write_content — writes caption/script to Supabase
- overseer_scan — SOP compliance audit
- sean_briefing — morning briefing
- lacey_advance — advance pipeline items
- sam_health — health check
- muse_generate_calendar — generate content calendar
- artgrid_scout — scout footage
- scrappy_research — Tavily web research
- scrappy_muse_collab — research + content brief
- lacey_trigger_n8n — POST to n8n webhook (NEW)

## What Was Just Built (this session)
1. GitHub connected to Netlify — auto-deploys on git push
2. n8n webhook integration — lacey_trigger_n8n action + buttons in UI
3. N8N_WEBHOOK_URL env var set in Netlify (production URL)

## n8n Status — INCOMPLETE, NEEDS FINISHING
The War Room side is fully wired. The n8n workflow is PARTIALLY built.

### What exists in n8n
- Workflow imported at cloudscenic.app.n8n.cloud
- 4 nodes: War Room Webhook → Format Content Item → Insert to Supabase → Respond OK
- Workflow file: /Users/chrisz/.openclaw/workspace/warroom/n8n/warroom-trigger-workflow.json

### What still needs to happen
- Open n8n → Insert to Supabase node
- Replace BOTH instances of PASTE_SUPABASE_SERVICE_KEY_HERE with the actual Supabase secret key
  (Settings → API Keys → Secret keys → default → reveal)
- Save → Activate the workflow

### What this workflow does when finished
External source (any tool) POSTs to:
  https://cloudscenic.app.n8n.cloud/webhook/11138e92-248c-4562-be17-5e07b9da928c
with payload: { title, platform, status, pillar, format, description }
→ n8n formats it → INSERTs into Supabase content_items
→ War Room picks it up instantly via live Supabase subscription

## Key Files
- /Users/chrisz/.openclaw/workspace/warroom/index.html (main app)
- /Users/chrisz/.openclaw/workspace/warroom/netlify/functions/agent-action.js
- /Users/chrisz/.openclaw/workspace/warroom/netlify/functions/chat.js
- /Users/chrisz/.openclaw/workspace/warroom/n8n/warroom-trigger-workflow.json

## Strategic Context
- Client: VitalLyfe (Natalia = approver, Jon = JC, Danny = Cloud Scenic ops)
- Tierra Bomba campaign running at $100/day
- Influencer seeding active (~27-30 confirmed, boxes arriving March 13)
- Influencer tracker lives externally (SharePoint) — NOT in War Room
- No Slack access from assistant — user preference

## What's NOT Built Yet
- External tracker trigger (SharePoint/Airtable → n8n) — depends on what tool client uses
- War Room → n8n → Slack notification workflow
- n8n workflows for agents beyond lacey_trigger_n8n
