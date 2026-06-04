// ── Supabase Client ──
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
    "Set them in .env.local for local dev, and in Netlify env vars for production."
  );
}

export const DB_CONNECTED = true;
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Pass-through lock: bypass supabase-js's default navigator.locks-based lock.
    // That lock stalls getSession()/refresh on some reloads (notably hard refresh,
    // Cmd-Shift-R) — which made apiFetch fail to attach a token ("token didn't
    // work") and the session fail to restore (sign-out). This trades cross-tab
    // refresh serialization (a rare race) for not deadlocking. Root-cause fix for
    // the hard-refresh sign-out + API token failures.
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
});
