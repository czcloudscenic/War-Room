-- ── PROFILES TABLE ────────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'client',
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Service role can do everything (used by setup.js)
CREATE POLICY "Service role full access"
  ON profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant access
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;
