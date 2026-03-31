// Unsplash image search proxy — keeps API key server-side
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers, body: "Method Not Allowed" };

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
