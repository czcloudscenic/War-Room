# Analytics Page — extracted from Vantus (2026-07-01)

The social-content analytics page, pulled out intact so it can be dropped into
another project. It shows content metrics (reach, engagement, posts) across
connected platforms with a weekly area chart, top performers, and per-platform
sync.

## Files here
- `AnalyticsRoute.jsx` — the page component (default export `AnalyticsRoute`, no props).
- `supabaseClient.js` — the `sb` Supabase client singleton it imports.
- `apiFetch.js` — the auth wrapper it uses for the sync/analysis endpoints.

## To wire it up in the new home

### 1. npm deps
- `react` (18/19)
- `@supabase/supabase-js`

### 2. Import paths
In `AnalyticsRoute.jsx` the two imports are:
```js
import { sb } from '../../services/supabaseClient.js';
import { apiFetch } from '../../services/apiFetch.js';
```
Point these at wherever you drop `supabaseClient.js` / `apiFetch.js`.

### 3. Env vars (used by supabaseClient.js)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 4. Supabase tables it reads
- **`connected_accounts`** — `id, platform, handle, display_name, avatar_url, fetched_at` (the linked IG/TikTok/YouTube accounts).
- **`account_posts`** — `account_id, metrics (jsonb: reach, likes, comments, saved, shares, engagement_rate, …), caption, permalink, posted_at, thumbnail_url`.

Bring these tables (or equivalents) or adapt the queries near the top of the component.

### 5. Backend endpoints it calls (via `apiFetch`)
- `POST /api/sync/instagram`, `/api/sync/tiktok`, `/api/sync/youtube` — refresh each platform's posts into `account_posts`.
- `POST /api/agent-action` with `{ action: "...analysis..." }` — the "Analyze" button (AI performance read). Optional — the page renders without it.

If the new project has no sync/agent backend, the page still loads and reads
whatever is already in `account_posts`; the sync/analyze buttons just no-op or error.

## Fonts / styling
Pure inline styles (no CSS files). Uses `'Instrument Serif'`, `'Geist Mono'`, and
`Inter` — load those fonts in the host app or the type falls back to system.

## Notes
- Self-contained: one component file + two service singletons. No shared UI-kit imports.
- Originally lived at `src/ui/routes/AnalyticsRoute.jsx`. Removed from Vantus on 2026-07-01;
  full history is in the Vantus git repo if you need earlier versions.
