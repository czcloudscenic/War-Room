# Vantus

Content operations dashboard for **VitalLyfe**. Internally named "warroom" (per `package.json`).

**Live:** https://usevantus.com
**Fallback:** https://majestic-cassata-aa16e9.netlify.app
**Repo:** https://github.com/czcloudscenic/War-Room.git — `main` auto-deploys via Netlify
**Local dev:** `npm run dev` → http://localhost:5173

## Where things live

| You need… | Look in |
| --- | --- |
| The actual React app | `src/` |
| The deployed entry | `index.html` (Vite mounts React here) |
| Serverless endpoints (agent actions, chat, scrapers) | `netlify/functions/` |
| Shared function helpers (auth gate, etc.) | `netlify/functions/_lib/` |
| Database schema | `supabase/migrations/` |
| n8n workflow JSON exports | `n8n/` |
| Architecture / agent / app / UI rules | `docs/` |
| Interactive system map + bug punch-list | `architecture-map.html` + `docs/architecture-map/` |
| Standalone sub-utilities (own node_modules) | `tools/artgrid-scout/`, `tools/cid-scout/` |
| Old UI experiments parked for reuse | `(experimental)/` |
| Current session context (read first) | `HANDOFF.md` |
| Agent persona + working rules | `CLAUDE.md` |

## Slash commands

- `/feature {description}` — implement one feature end-to-end
- `/agent-action {key}` — add a new action to `netlify/functions/agent-action.js`
- `/handoff` — append a session summary to `HANDOFF.md`
- `/health` — sanity check (build, console.logs, secrets, git state) + opens `architecture-map.html`. Does NOT push.
- `/architecture-map` — regenerate the interactive codebase dashboard + portable markdown bundle

## Deploy

`git push origin main` → Netlify auto-deploys. **Founder pushes manually after review. Agent never pushes.**
