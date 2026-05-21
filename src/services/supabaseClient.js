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
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
