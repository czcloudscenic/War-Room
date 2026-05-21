# Vantus

Content operations dashboard for **VitalLyfe**. Internally named "warroom" (per `package.json`).

**Live:** https://majestic-cassata-aa16e9.netlify.app
**Repo:** https://github.com/czcloudscenic/Vantus.git — `main` auto-deploys via Netlify
**Local dev:** `npm run dev` → http://localhost:5173

## Where things live

| You need… | Look in |
| --- | --- |
| The actual React app | `src/` |
| The deployed entry | `index.html` (Vite mounts React here) |
| Serverless endpoints (agent actions, chat, scrapers) | `netlify/functions/` |
| Database schema | `supabase/` |
| n8n workflow JSON exports | `n8n/` |
| Architecture / agent / app / UI rules | `docs/` |
| Standalone sub-utilities (own node_modules) | `tools/artgrid-scout/`, `tools/cid-scout/` |
| Old UI experiments parked for reuse | `(experimental)/` |
| Current session context (read first) | `HANDOFF.md` |
| Agent persona + working rules | `CLAUDE.md` |

## Slash commands

- `/feature {description}` — implement one feature end-to-end
- `/agent-action {key}` — add a new action to `netlify/functions/agent-action.js`
- `/handoff` — append a session summary to `HANDOFF.md`
- `/health` — sanity check (build, console.logs, secrets, git state). Does NOT push.

## Deploy

`git push origin main` → Netlify auto-deploys. **Founder pushes manually after review. Agent never pushes.**
