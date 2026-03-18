// ── Supabase Client ──
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL  = "https://wjcstqqihtebkpyuacop.supabase.co";
export const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqY3N0cXFpaHRlYmtweXVhY29wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU1NTgsImV4cCI6MjA4ODQwMTU1OH0.JZV0r7LRQldTVJLz5BOnVx9M4GfW-Xz28PbBS30Vl4o";
export const DB_CONNECTED  = true;
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
