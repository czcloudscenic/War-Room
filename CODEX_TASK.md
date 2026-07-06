# CODEX TASK — Content Runway UI (2026-07-06)

Branch: `codex/grunt-2026-07-06` (branch off latest `main` — `git fetch` first).
Mission: 4 self-contained UI pieces for the Content Runway Tracker. The math,
schema, cron, and app wiring are OWNED BY COUNSEL and already exist or land in
parallel — you build components to the contracts below, nothing else.

## Hard rules
- DO NOT touch: `src/App.jsx`, `src/utils/constants.js`, `netlify.toml`,
  `netlify/functions/*`, `supabase/migrations/*`, `src/utils/runway.mjs`.
  (Counsel owns these — this is the merge-conflict firewall.)
- DO NOT reimplement any runway math. Import from `../../utils/runway.mjs`
  (exports: `clientRunway`, `READY_STATUSES`, `CRITICAL_DAYS`). It is frozen
  and test-proven; if something feels missing, leave a TODO comment instead of
  computing locally.
- No new npm deps. No Tailwind, no CSS files — inline style objects only
  (house style). Dark theme: page `#0d0907`, cards `#0f0d0e`, borders
  `rgba(255,255,255,0.08)`. Fonts: Instrument Serif (italic headings),
  Geist Mono (all numerals), Inter (body). Accent `#2AABFF`.
  Status colors: green `#30d158`, amber `#ff9f0a`, red `#ff453a`.
- Supabase writes: import `sb` from `src/services/supabaseClient.js` and write
  payloads with **snake_case column names ONLY** (camelCase keys caused the
  PGRST204 bug — known trap).
- `npm run build` must pass before every commit.

## Severity → color mapping (use everywhere)
`null` + configured → green · `"warning"` → amber · `"critical"`/`"empty"` → red
· unconfigured (`snap.configured === false`) → dim gray + "set cadence" flag.

## 1. `src/ui/routes/RunwayRoute.jsx`
`export default function RunwayRoute({ clients, content, isMobile })`
- Presentational only — NO data fetching. `clients`/`content` arrive as props
  (App.jsx passes them; realtime keeps them fresh, so recompute on prop change).
- For each client with `content_tracking_enabled`, compute
  `clientRunway(client, itemsForClient, { now: Date.now() })` where
  `itemsForClient = content.filter(i => i.client_id === client.id)`.
  (Sprout opts arrive in a later pass — do not wire them.)
- Top row: `SummaryStat`-style tiles (copy the visual pattern from
  `ClientsRoute.jsx`, do not import its internals): Tracked / Warning / Critical+Empty counts.
- Main: worst-first table (severity rank empty > critical > warning > green;
  unconfigured pinned last). Columns: client (brand_color dot + name) ·
  pieces ready · in production · burn (`/day`, 1 decimal, + tiny source tag
  `sprout|posted|cadence`) · runway days (1 decimal under 10 else integer;
  `—` unconfigured) · book by (`snap.bookBy`) · last shoot (`snap.lastShoot` or `—`).
- Row severity dot + row tint for critical/empty (subtle, e.g. 6% red bg).
- Header button **“Log shoot”** → opens `LogShootModal` (own state here).
- Mobile (`isMobile`): stack as cards instead of the table.

## 2. `src/ui/pipeline/LogShootModal.jsx`
`export default function LogShootModal({ clients, defaultClientId, onClose })`
- Copy the shell of `src/ui/clients/AddClientModal.jsx`: fixed overlay
  `position:fixed; inset:0`, backdrop, click-propagation stopped, controlled
  inputs, `fontSize:16` on inputs (iOS zoom), Esc/backdrop close.
- Fields: client select (default `defaultClientId`) · shoot date (default
  today, `<input type="date">`) · piece count N (number, 1–100) · optional note.
- Submit: bulk insert N stub rows into `content_items` in ONE
  `sb.from("content_items").insert(rows)` call:
```js
const stamp = Date.now();
const rows = Array.from({ length: n }, (_, i) => ({
  id: `${client.slug}-shoot-${stamp}-${i + 1}`,
  title: `Shoot ${dateStr} — piece ${i + 1}/${n}`,
  status: "Ready For Copy Creation",        // start of pipeline
  campaign: `Shoot ${dateStr}`,             // EXACT format — runway.mjs lastShootDate() parses "Shoot YYYY-MM-DD"
  client_id: client.id,
  notes: note || null,
}));
```
- On success: `onClose()` — realtime brings the rows into App state, no
  callback needed. On error: inline error text, keep modal open.
- Success also shows a one-line confirm before close if trivial to do
  (optional, don't gold-plate).

## 3. Runway badge on `src/ui/routes/ClientsRoute.jsx`
- You MAY edit this file (only this one shared file — keep the diff surgical).
- On each client card/row where `content_tracking_enabled`, add a small badge:
  colored dot + `{runwayDays}d` (or "set cadence" when unconfigured), using
  `clientRunway(...)` with that client's items — `content` is already available
  in the route's props (verify; if it is not passed, add the prop and note it
  in your handoff so Counsel wires the pass in App.jsx).
- Match the existing card badge visual language (see the health dot + Flag pill
  already in the file).

## 4. Runway config fields in the client editor
- `src/ui/clients/AddClientModal.jsx` (edit mode) — add a "Content runway"
  field group: posts/week (number), shoot lead time days (number, default 14),
  tracking enabled (toggle/checkbox). Include in the insert/update payload as
  `posts_per_week`, `shoot_lead_time_days`, `content_tracking_enabled`.
- Keep layout consistent with existing `labelStyle`/`inputStyle` objects.

## Handoff
- Commit per component, message prefix `runway-ui:`.
- Push the branch, then write a 5-line summary of what was built + any TODOs
  into `CODEX_NOTES.md` (append, do not overwrite).
- Counsel merges + wires the route into NAV/App.jsx — do not attempt the wiring.
