// Apify scraper — supports two modes:
// 1. POST with {query, platform, limit} → starts actor, returns {runId}
// 2. POST with {runId, platform} → checks if run is done, returns results
// This two-step approach avoids Netlify function timeout limits.

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) return { statusCode: 500, headers, body: JSON.stringify({ error: "APIFY_API_TOKEN not configured" }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  // ── MODE 2: Poll for results ──
  if (body.runId) {
    return await pollResults(body.runId, body.platform, APIFY_TOKEN, headers, body.limit || 8);
  }

  // ── MODE 1: Start scrape ──
  const { query, platform = "instagram", limit = 8 } = body;
  if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing query" }) };

  const ACTORS = {
    instagram: { id: "apify/google-search-scraper", input: (q, n) => ({ queries: `site:instagram.com/reel ${q} viral`, maxPagesPerQuery: 1, resultsPerPage: n }) },
    tiktok: { id: "clockworks/free-tiktok-scraper", input: (q, n) => ({ searchQueries: [q], resultsPerPage: n, shouldDownloadVideos: false }) },
    youtube: { id: "apify/google-search-scraper", input: (q, n) => ({ queries: `site:youtube.com ${q} viral`, maxPagesPerQuery: 1, resultsPerPage: n }) },
    linkedin: { id: "apify/google-search-scraper", input: (q, n) => ({ queries: `site:linkedin.com/posts ${q}`, maxPagesPerQuery: 1, resultsPerPage: n }) },
    reddit: { id: "apify/google-search-scraper", input: (q, n) => ({ queries: `site:reddit.com ${q} best top`, maxPagesPerQuery: 1, resultsPerPage: n }) },
  };

  const actor = ACTORS[platform];
  if (!actor) return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown platform: ${platform}` }) };

  try {
    // Reddit: try public JSON API first, fall back to Google search
    if (platform === "reddit") {
      try {
        const redditRes = await fetch(`https://old.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=top&t=year&limit=${limit}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Vantus/1.0; +https://cloudscenic.com)", "Accept": "application/json" },
        });
        if (redditRes.ok) {
          const redditData = await redditRes.json();
          const posts = (redditData?.data?.children || []).map(c => c.data).filter(Boolean);
          if (posts.length > 0) {
            const results = posts.map(normalizeRedditNative).filter(Boolean)
              .sort((a, b) => parseMetric(b.views) - parseMetric(a.views));
            return { statusCode: 200, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "done", results, total: results.length }) };
          }
        }
      } catch (e) { console.log("Reddit API failed, falling back to Google:", e.message); }
      // Fall through to Google search below
    }

    const actorPath = actor.id.replace("/", "~");
    const startUrl = `https://api.apify.com/v2/acts/${actorPath}/runs?token=${APIFY_TOKEN}`;
    const res = await fetch(startUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actor.input(query, limit)),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { statusCode: 200, headers, body: JSON.stringify({ error: `Failed to start: ${errText.slice(0, 200)}` }) };
    }

    const data = await res.json();
    const runId = data?.data?.id;

    // For TikTok (fast actor), try to wait and return results immediately
    if (platform === "tiktok" && runId) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
        if (!pollRes.ok) break;
        const pollData = await pollRes.json();
        const status = pollData?.data?.status;
        if (status === "SUCCEEDED") {
          const dsId = pollData?.data?.defaultDatasetId;
          const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&limit=${limit}`);
          const items = await itemsRes.json();
          if (Array.isArray(items) && items.length > 0) {
            const results = items.map(i => normalizeTikTok(i)).filter(Boolean)
              .sort((a, b) => parseMetric(b.views) - parseMetric(a.views));
            return { statusCode: 200, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "done", results, total: results.length }) };
          }
        }
        if (status === "FAILED" || status === "TIMED-OUT" || status === "ABORTED") break;
      }
    }

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "started", runId, platform }),
    };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function pollResults(runId, platform, token, headers, limit) {
  try {
    const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    if (!pollRes.ok) return { statusCode: 200, headers, body: JSON.stringify({ status: "error", error: "Failed to check run" }) };

    const pollData = await pollRes.json();
    const status = pollData?.data?.status;

    if (status === "RUNNING" || status === "READY") {
      return { statusCode: 200, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "running" }) };
    }

    if (status === "FAILED" || status === "TIMED-OUT" || status === "ABORTED") {
      return { statusCode: 200, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "failed", error: `Run ${status}` }) };
    }

    if (status === "SUCCEEDED") {
      const dsId = pollData?.data?.defaultDatasetId;
      const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${token}&limit=${limit}`);
      const items = await itemsRes.json();

      if (!Array.isArray(items)) return { statusCode: 200, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "done", results: [], total: 0 }) };

      // Google search results have organicResults nested — flatten them
      let flat = items;
      if (items[0]?.organicResults) {
        flat = items.flatMap(i => i.organicResults || []);
      }

      const normalize = { instagram: normalizeIG, tiktok: normalizeTikTok, youtube: normalizeYT, linkedin: normalizeLinkedIn, reddit: normalizeReddit };
      const fn = normalize[platform] || normalizeIG;
      const results = flat.slice(0, limit).map(fn).filter(Boolean)
        .sort((a, b) => parseMetric(b.views) - parseMetric(a.views));

      return { statusCode: 200, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "done", results, total: results.length }) };
    }

    return { statusCode: 200, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "unknown", rawStatus: status }) };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ status: "error", error: err.message }) };
  }
}

// ── Normalizers ──

function normalizeIG(item) {
  // Google search result shape: { title, url, description }
  const url = item.url || "";
  const title = (item.title || "").replace(/ \| Instagram$/, "").replace(/ on Instagram:.*/, "");
  const desc = item.description || "";
  // Extract creator: look for @username in title/desc, or get from URL path (skip "reel" and "p")
  const atMatch = (title + " " + desc).match(/@([\w.]+)/);
  const pathMatch = url.match(/instagram\.com\/(?!reel\/|p\/|explore\/)([^\/]+)/);
  const creator = atMatch ? atMatch[1] : (pathMatch ? pathMatch[1] : "unknown");
  // Extract likes/views from Google snippet if present
  const likesMatch = desc.match(/([\d,.]+[KkMm]?)\s*likes?/i);
  const viewsMatch = desc.match(/([\d,.]+[KkMm]?)\s*views?/i);
  const likes = likesMatch ? likesMatch[1] : "";
  const views = viewsMatch ? viewsMatch[1] : likes || "Viral";
  return {
    id: url || String(Date.now() + Math.random()),
    platform: "instagram", creator: creator.startsWith("@") ? creator : `@${creator}`,
    title: title.slice(0, 80) || desc.slice(0, 80) || "Instagram Reel",
    thumbnail: "", views, engagement: likes ? `${likes} likes` : "---",
    hook: extractHook(desc || title), voiceHook: "", textHook: extractHook(desc || title).toUpperCase(),
    voiceBody: "", textBody: "", voiceCta: "", textCta: "",
    format: url.includes("/reel/") ? "Reel" : "Post", url: url || "https://instagram.com",
    trigger: "---", analysis: desc.slice(0, 200) || title, variation: "",
  };
}

function normalizeTikTok(item) {
  const views = item.playCount || item.stats?.playCount || 0;
  const likes = item.diggCount || item.stats?.diggCount || 0;
  const comments = item.commentCount || item.stats?.commentCount || 0;
  const engagement = views > 0 ? ((likes + comments) / views * 100).toFixed(1) + "%" : "---";
  return {
    id: item.id || String(Date.now() + Math.random()),
    platform: "tiktok", creator: item.authorMeta?.name ? `@${item.authorMeta.name}` : "Unknown",
    title: (item.text || item.desc || "").split("\n")[0]?.slice(0, 80) || "TikTok Video",
    thumbnail: item.videoMeta?.coverUrl || item.covers?.default || "",
    views: formatNumber(views), engagement,
    hook: extractHook(item.text || item.desc), voiceHook: "", textHook: extractHook(item.text || item.desc).toUpperCase(),
    voiceBody: "", textBody: "", voiceCta: "", textCta: "",
    format: "Short", url: item.webVideoUrl || "https://tiktok.com",
    trigger: "---", analysis: `${formatNumber(views)} plays, ${formatNumber(likes)} likes, ${formatNumber(comments)} comments.`, variation: "",
  };
}

function normalizeYT(item) {
  const url = item.url || "";
  const title = (item.title || "").replace(/ - YouTube$/, "");
  const desc = item.description || "";
  const viewsMatch = desc.match(/([\d,.]+[KkMm]?)\s*views?/i);
  const views = viewsMatch ? viewsMatch[1] : "---";
  // Extract channel from title or URL
  const channel = title.match(/by\s+(.+)/)?.[1] || desc.match(/^([^·—\n]+)/)?.[1]?.trim()?.slice(0, 30) || "YouTube";
  return {
    id: url || String(Date.now() + Math.random()),
    platform: "youtube", creator: channel,
    title: title.slice(0, 80) || "YouTube Video",
    thumbnail: "", views, engagement: "---",
    hook: extractHook(title), voiceHook: "", textHook: extractHook(title).toUpperCase(),
    voiceBody: "", textBody: "", voiceCta: "", textCta: "",
    format: "YouTube", url: url || "https://youtube.com",
    trigger: "---", analysis: desc.slice(0, 200) || title, variation: "",
  };
}

function normalizeLinkedIn(item) {
  const url = item.url || "";
  const title = (item.title || "").replace(/ \| LinkedIn$/, "");
  const desc = item.description || "";
  const creator = title.match(/^([^—–\-:]+)/)?.[1]?.trim()?.slice(0, 40) || "LinkedIn";
  const likesMatch = desc.match(/([\d,.]+)\s*(?:likes?|reactions?)/i);
  const likes = likesMatch ? likesMatch[1] : "";
  return {
    id: url || String(Date.now() + Math.random()),
    platform: "linkedin", creator,
    title: (desc || title).slice(0, 80) || "LinkedIn Post",
    thumbnail: "", views: likes ? `${likes} reactions` : "---", engagement: "---",
    hook: extractHook(desc || title), voiceHook: "", textHook: extractHook(desc || title).toUpperCase(),
    voiceBody: "", textBody: "", voiceCta: "", textCta: "",
    format: "Text Post", url: url || "https://linkedin.com",
    trigger: "---", analysis: desc.slice(0, 200) || title, variation: "",
  };
}

// Google fallback for Reddit
function normalizeReddit(item) {
  const url = item.url || "";
  const title = (item.title || "").replace(/ : r\/\w+$/, "").replace(/ - Reddit$/, "");
  const desc = item.description || "";
  const sub = url.match(/reddit\.com\/r\/([^\/]+)/)?.[1] || "unknown";
  return {
    id: url || String(Date.now() + Math.random()),
    platform: "reddit", creator: `r/${sub}`,
    title: title.slice(0, 80) || "Reddit Post",
    thumbnail: "", views: "---", engagement: "---",
    hook: extractHook(title), voiceHook: "", textHook: extractHook(title).toUpperCase(),
    voiceBody: "", textBody: "", voiceCta: "", textCta: "",
    format: "Text Post", url: url || "https://reddit.com",
    trigger: "---", analysis: desc.slice(0, 200) || title, variation: "",
  };
}

// Native Reddit API — full engagement data
function normalizeRedditNative(post) {
  const ups = post.ups || post.score || 0;
  const comments = post.num_comments || 0;
  const ratio = post.upvote_ratio ? `${Math.round(post.upvote_ratio * 100)}% upvoted` : "";
  const engagement = comments > 0 ? `${formatNumber(comments)} comments` : "---";
  const thumb = (post.thumbnail && post.thumbnail !== "self" && post.thumbnail !== "default" && post.thumbnail !== "nsfw")
    ? post.thumbnail : (post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, "&") || "");
  const hasMedia = post.is_video || post.post_hint === "image" || post.post_hint === "hosted:video" || post.post_hint === "rich:video";
  return {
    id: post.id || String(Date.now() + Math.random()),
    platform: "reddit",
    creator: `r/${post.subreddit || "unknown"}`,
    title: (post.title || "").slice(0, 80),
    thumbnail: thumb,
    views: `${formatNumber(ups)} upvotes`,
    engagement,
    hook: extractHook(post.title),
    voiceHook: "", textHook: extractHook(post.title).toUpperCase(),
    voiceBody: "", textBody: "", voiceCta: "", textCta: "",
    format: hasMedia ? "Media Post" : "Text Post",
    url: post.permalink ? `https://reddit.com${post.permalink}` : "https://reddit.com",
    trigger: ratio || "---",
    analysis: `${formatNumber(ups)} upvotes, ${formatNumber(comments)} comments in r/${post.subreddit}. ${ratio}. ${post.selftext?.slice(0, 100) || ""}`,
    variation: "",
  };
}

function parseMetric(str) {
  if (!str || str === "---") return 0;
  const s = String(str).replace(/[^0-9.KMkm]/g, "");
  const num = parseFloat(s) || 0;
  if (/m/i.test(str)) return num * 1000000;
  if (/k/i.test(str)) return num * 1000;
  return num;
}

function extractHook(text) {
  if (!text) return "---";
  const first = text.split(/[.!?\n]/)[0]?.trim();
  return first ? (first.length > 80 ? first.slice(0, 80) + "..." : first) : text.slice(0, 80);
}

function formatNumber(n) {
  const num = parseInt(n) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
}
