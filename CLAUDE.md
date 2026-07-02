# Vantus (internally "warroom")

**Agency fulfillment + billing OS** for Cloud Scenic — multi-tenant (a client book, not a single-client dashboard). Runs client delivery end to end: CRM, content pipeline with approvals, deliverables ledger, delivery KPIs, operations/tasks, client analytics, and Stripe-wired billing. Production React/Vite app on Netlify, auto-deploys on push to `main`.

## Current app surface (nav)

- **COMMAND:** Dashboard · Clients · Setup · Ledger · Reports · Client Analytics · Operations · Agents
- **CONTENT:** Idea Engine · Pipeline
- **FINANCE:** Billing (Stripe wired — `netlify/functions/billing-stripe.js`)
- **APPS:** Apps (Skills real; Scraping Ops + Automation Center are placeholders) · Settings

Agent team is **Sean / Muse / Scrappy** (Artgrid removed 2026-07-01). Removed pages (2026-07-01): Ad ROI Hub, References, ArtGrid, Cost Governance, Ideal Customer, Competitor Intel, Analytics (Analytics extracted to `ripped out features/analytics-page/`).

## Agent persona

This project is driven by the **Vantus Build Companion** agent.

**Full persona spec:** `~/Desktop/Agent Personas/Vantus Build Companion/CLAUDE.md`

Before doing any work in this codebase, read that spec. It defines:
- The full stack (React 19 + Vite + Supabase + Netlify Functions + n8n)
- Env vars (set in Netlify, not in repo)
- All 10 existing agent actions
- Client context (VitalLyfe — Natalia, Jon, Danny)
- Deploy guardrails (NEVER push without founder review — main auto-deploys)
- Repo layout conventions

## Always read on session start

- `START HERE.md` — quick orient: live URL, deploy, where everything lives
- `HANDOFF.md` — latest session context, updated each working session

## Source-of-truth files

- `index.html` + `src/` — the React app (Vite entry)
- `netlify/functions/` — serverless endpoints (agent actions, chat, scrapers)
- `supabase/` — schema / migrations
- `n8n/` — workflow JSON exports
- `docs/ARCHITECTURE.md` — system architecture
- `docs/AGENT_RULES.md` — agent behavior rules
- `docs/APPS_RULES.md` — app conventions
- `docs/UI_RULES.md` — UI conventions
- `docs/REFACTOR_PLAN.md` — refactor roadmap

## Folder map

- `src/` — React app (the real code)
- `netlify/functions/` — serverless
- `public/` `supabase/` `n8n/` — assets / schema / workflows
- `docs/` — architecture, rules, refactor plan
- `(experimental)/` — UI experiments parked for reuse, NOT in the build
- `ripped out features/` — removed code kept for reference/reuse (e.g. `analytics-page/`, `client-view/`)

## Business context (read before any user-facing copy)

Read order:

1. `~/.openclaw/workspace/CLAUDE.md` — canonical Cloud Scenic brain (team, brand voice rules, VitalLyfe voice, the 8 agents, Round 2 roadmap)
2. `~/.openclaw/workspace/MEMORY.md` — long-term memory
3. `~/Desktop/Agent Cortex/wiki/icp-ai-services-v1.md` — only if wiring features for the AI services product line

VitalLyfe brand voice (from canonical brain): calm, confident, purposeful, never corporate, movement not product.

## Slash commands available in this repo

- `/feature {description}` — implement one feature end-to-end (read → propose → edit → suggest commit)
- `/agent-action {key}` — add a new action to `netlify/functions/agent-action.js`
- `/handoff` — append a session summary to `HANDOFF.md`
- `/health` — sanity check (build, console.logs, secrets, git state, npm audit, live-site probe) + opens `architecture-map.html` in the browser so you can see red zones visually. Does NOT push.
- `/architecture-map` — regenerate the interactive codebase dashboard. Output: `docs/architecture-map.html` + portable `docs/architecture-map/` markdown folder (README, critical-path, nodes, known-bugs, roadmap).

## Deploy

`git push origin main` → Netlify auto-deploys. **Founder pushes manually after review. Agent never pushes.**

Local dev:
```bash
npm run dev      # vite
npm run build    # to dist/
npm run preview  # serve dist/
```

## Sister project

Cloud Scenic OS (separate codebase) lives at `~/Desktop/Software builds/Cloud Scenic OS/` with its own Portal Build Companion agent. Don't mix the two — different stacks, different scopes.
