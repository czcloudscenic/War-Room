// Unsplash image search proxy — keeps API key server-side
//
// Requires a valid @cloudscenic.com Supabase session (Authorization: Bearer <access_token>).

const { requireUser, unauthorized, cors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");

const UNSPLASH_RATE_LIMIT_MAX = 60;
const UNSPLASH_RATE_LIMIT_WINDOW_MS = 60_000;

exports.handler = async (event) => {
  const headers = cors(event);

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers, body: "Method Not Allowed" };

  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);

  const rl = rateLimit("unsplash:" + auth.user.id, UNSPLASH_RATE_LIMIT_MAX, UNSPLASH_RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, headers);

  const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
  if (!UNSPLASH_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "UNSPLASH_ACCESS_KEY not configured" }) };
  }

  const q = event.queryStringParameters?.q;
  const perPage = event.queryStringParameters?.per_page || "9";
  if (!q) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing ?q= parameter" }) };

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${perPage}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, headers, body: JSON.stringify({ error: `Unsplash API error: ${text}` }) };
    }

    const data = await res.json();
    const photos = (data.results || []).map(p => ({
      id: p.id,
      thumb: p.urls?.small,
      full: p.urls?.regular,
      link: p.links?.html,
      alt: p.alt_description || p.description || q,
      photographer: p.user?.name,
      photographerUrl: p.user?.links?.html,
    }));

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
      body: JSON.stringify({ query: q, total: data.total, photos }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
