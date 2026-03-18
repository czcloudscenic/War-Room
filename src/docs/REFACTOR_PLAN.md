# Vantus — Refactor Plan

## Guiding Principle

Restructure for maintainability. Preserve every feature. Change zero pixels.

## Pre-Requisite: Build System

The current app is a single `index.html` using React CDN + Babel standalone (no build step). To support `import`/`export` across files, we need a bundler.

**Action**: Add Vite as the build tool.
- Vite supports JSX natively (no Babel CDN needed)
- Hot module replacement for fast dev
- Outputs a single bundle for production (Netlify-compatible)
- Migration: move `<script type="text/babel">` content into `.jsx` files

**Netlify config update**: Point `publish` to `dist/` after build.

---

## Phase 0 — Build System (must happen first)

| Step | What | Why |
|------|------|-----|
| 0.1 | `npm init`, install `vite`, `react`, `react-dom` | Enable module imports |
| 0.2 | Create `vite.config.js` | Configure build |
| 0.3 | Create `src/main.jsx` as entry point | Replace CDN script tag |
| 0.4 | Move all inline JS from `index.html` into `src/main.jsx` | First extraction — no behavior change |
| 0.5 | Update `netlify.toml` to build with Vite | Deploy pipeline |
| 0.6 | Verify: login, dashboard, agents, pipeline, client portal all work | Smoke test |

**Risk**: Medium. This is the riskiest step. Everything after is safe file moves.
**Mitigation**: Keep old `index.html` as `index.html.bak` until verified.

---

## Phase 1 — Extract Data & Config

| Step | Extract From | Extract To | Lines Saved |
|------|-------------|-----------|-------------|
| 1.1 | `CONTENT_SEED` (lines 410-481) | `src/data/seed.content.js` | ~70 |
| 1.2 | `AGENTS_BASE`, `AGENT_TASKS`, `ACTION_COLORS`, `ACTIVITY_POOL` | `src/data/seed.agents.js` | ~40 |
| 1.3 | `OPS_INIT` | `src/data/seed.ops.js` | ~15 |
| 1.4 | `NAV`, `STATUS_COLOR`, `STAGE_SHORT`, `STATUSES`, `FORMATS`, `PILLARS_LIST`, `PLATFORMS_LIST` | `src/utils/constants.js` | ~35 |
| 1.5 | `DEFAULT_APPS` | `src/apps/apps.config.js` | ~10 |
| 1.6 | `ROUTE_PROMPTS`, `AGENT_KEYWORDS` | `src/core/agentRegistry.js` | ~25 |

**Estimated reduction**: ~195 lines from index.html

---

## Phase 2 — Extract Core Logic

| Step | Extract From | Extract To |
|------|-------------|-----------|
| 2.1 | `getMemory`, `setMemory`, `buildSystemPrompt`, `updateAgentMemory` | `src/core/memory.js` |
| 2.2 | `routeTask` function | `src/core/routeTask.js` |
| 2.3 | Agent prompt definitions (PROMPTS in AgentChatPage) | `src/agents/*.agent.js` |
| 2.4 | Supabase client init | `src/services/supabaseClient.js` |
| 2.5 | `useInterval`, `useIsMobile`, `getIsMobile` | `src/utils/hooks.js` |

---

## Phase 3 — Extract UI Components

| Step | Component | Extract To |
|------|-----------|-----------|
| 3.1 | `LoginScreen` | `src/ui/layout/loginScreen.jsx` |
| 3.2 | `CommandInput` | `src/ui/dashboard/commandInput.jsx` |
| 3.3 | `QuickActionsDashboard` | `src/ui/dashboard/quickActions.jsx` |
| 3.4 | `AgentChatPage` | `src/ui/agents/agentChatPanel.jsx` |
| 3.5 | `EditContentModal` | `src/ui/pipeline/editContentDrawer.jsx` |
| 3.6 | `CIDPage` | `src/apps/competitor-intel/index.jsx` |
| 3.7 | `ArtgridScoutPage` | `src/apps/artgrid/index.jsx` |
| 3.8 | `AdROIHub` | `src/apps/ad-roi/index.jsx` |
| 3.9 | `TeamBroadcast` | `src/ui/agents/teamBroadcastGrid.jsx` |
| 3.10 | `ReferencesPage` | `src/apps/references/index.jsx` |
| 3.11 | `SkillsPage` | `src/apps/skills/index.jsx` |
| 3.12 | `AppsPage` | `src/ui/apps/appsPage.jsx` |
| 3.13 | `ClientView` | `src/ui/client/clientPortal.jsx` |
| 3.14 | `MetricCard`, `AgentCard`, `AgentAvatar`, `Card` | `src/ui/shared/*.jsx` |
| 3.15 | Sidebar rendering | `src/ui/layout/sidebar.jsx` |

---

## Phase 4 — Extract Services & State

| Step | What | Extract To |
|------|------|-----------|
| 4.1 | Supabase realtime subscription logic | `src/services/realtimeService.js` |
| 4.2 | Google Drive upload logic | `src/services/driveUploadService.js` |
| 4.3 | Agent action fetch calls | `src/services/apiService.js` |
| 4.4 | Content state (useState + Supabase sync) | `src/state/pipelineState.js` |
| 4.5 | App toggle state | `src/state/appsState.js` |
| 4.6 | AI enabled / kill switch state | `src/state/appState.js` |

---

## Phase 5 — Extract Styles

| Step | What | Extract To |
|------|------|-----------|
| 5.1 | CSS variables / design tokens | `src/styles/tokens.css` |
| 5.2 | Global resets, scrollbar, animations | `src/styles/globals.css` |
| 5.3 | Layout (sidebar, main area) | `src/styles/layout.css` |

Note: Most styling in V1 is inline React styles. Only extract what's currently in `<style>` tags. Do NOT convert inline styles to CSS classes — that changes the architecture unnecessarily.

---

## End State

After all phases, `index.html` (or `src/App.jsx`) should be:
- ~50-100 lines
- Import all components
- Render the app shell
- No business logic
- No data definitions
- No inline component definitions

Total file count: ~50-60 focused files instead of 1 monolith.

---

## Verification Checklist (run after every phase)

- [ ] Login works (admin + client)
- [ ] Dashboard loads with metrics, command input, agent grid
- [ ] Agent chat works (send message, get response)
- [ ] Content pipeline loads from Supabase
- [ ] Edit content modal opens, saves, syncs
- [ ] Client portal shows content for review
- [ ] Apps page toggles modules on/off
- [ ] Sidebar updates when apps toggled
- [ ] AI kill switch works
- [ ] Muse write (caption/script) works
- [ ] Quick actions fire correctly
- [ ] Notifications appear on client approval
- [ ] Google Drive upload works
- [ ] CID page loads with mock data
- [ ] Artgrid scout returns keywords
- [ ] Team broadcast sends to all agents
- [ ] Mobile layout works
