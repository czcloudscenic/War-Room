// CID Scrape API — reads scraped posts from Supabase
// Protected by bearer token
// GET /api/cid-scrape?platform=tiktok&query=water&limit=30
// Header: Authorization: Bearer <CID_BEARER_TOKEN>

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  // ── Auth ──
  const BEARER = process.env.CID_BEARER_TOKEN;
  if (BEARER) {
    const auth = event.headers?.authorization || event.headers?.Authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token !== BEARER) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized — invalid bearer token" }) };
    }
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not configured" }) };
  }

  const params = event.queryStringParameters || {};
  const platform = params.platform || "all";
  const query = params.query || "";
  const limit = Math.min(parseInt(params.limit) || 50, 100);
  const sort = params.sort || "views";

  try {
    // Build Supabase REST API URL
    let url = `${SUPABASE_URL}/rest/v1/cid_posts?select=*&order=${sort}.desc.nullslast&limit=${limit}`;
    if (platform && platform !== "all") {
      url += `&platform=eq.${platform}`;
    }
    if (query) {
      url += `&or=(search_query.ilike.*${encodeURIComponent(query)}*,title.ilike.*${encodeURIComponent(query)}*,caption.ilike.*${encodeURIComponent(query)}*)`;
    }

    const res = await fetch(url, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, headers, body: JSON.stringify({ error: text }) };
    }

    const posts = await res.json();
    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ posts, total: posts.length }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
