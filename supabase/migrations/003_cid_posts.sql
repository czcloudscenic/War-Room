-- CID Posts — competitor intel scraped content
CREATE TABLE IF NOT EXISTS cid_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  search_query TEXT NOT NULL,
  post_url TEXT NOT NULL UNIQUE,
  creator TEXT,
  title TEXT,
  caption TEXT,
  thumbnail_url TEXT,
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  engagement_rate NUMERIC(5,2),
  format TEXT,
  hook TEXT,
  trigger_type TEXT,
  variation TEXT,
  analysis TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

CREATE INDEX idx_cid_posts_platform ON cid_posts(platform);
CREATE INDEX idx_cid_posts_query ON cid_posts(search_query);
CREATE INDEX idx_cid_posts_scraped ON cid_posts(scraped_at DESC);
CREATE INDEX idx_cid_posts_views ON cid_posts(views DESC);

ALTER TABLE cid_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read cid_posts" ON cid_posts FOR SELECT USING (true);
CREATE POLICY "Service full access cid_posts" ON cid_posts FOR ALL USING (true) WITH CHECK (true);
