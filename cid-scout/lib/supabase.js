const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

let sb = null;

function getClient() {
  if (!sb) {
    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_KEY === "your-service-role-key-here") {
      console.error("❌ Set SUPABASE_SERVICE_KEY in cid-scout/.env (get it from Supabase dashboard → Settings → API → service_role)");
      process.exit(1);
    }
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return sb;
}

async function upsertPosts(posts) {
  const client = getClient();
  const rows = posts.map(p => ({
    platform: p.platform,
    search_query: p.search_query,
    post_url: p.post_url,
    creator: p.creator,
    title: p.title,
    caption: p.caption,
    thumbnail_url: p.thumbnail_url,
    views: p.views || 0,
    likes: p.likes || 0,
    comments: p.comments || 0,
    engagement_rate: p.engagement_rate || null,
    format: p.format,
    hook: p.hook,
    trigger_type: p.trigger_type || null,
    raw_data: p.raw_data || null,
  }));

  const { data, error } = await client
    .from("cid_posts")
    .upsert(rows, { onConflict: "post_url", ignoreDuplicates: false });

  if (error) {
    console.error("❌ Supabase upsert failed:", error.message);
    return 0;
  }
  return rows.length;
}

module.exports = { getClient, upsertPosts };
