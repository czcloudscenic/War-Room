// TikTok scraper via Apify — Playwright gets blocked by TikTok's bot detection
// Uses the clockworks/free-tiktok-scraper actor which returns real data

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;

async function scrape(query, limit) {
  console.log(`\n🎵 TikTok (Apify) — searching "${query}" (limit: ${limit})`);

  if (!APIFY_TOKEN) {
    console.log("   ⚠️  No APIFY_API_TOKEN set — skipping TikTok");
    return [];
  }

  const actorPath = "clockworks~free-tiktok-scraper";
  const input = { searchQueries: [query], resultsPerPage: limit, shouldDownloadVideos: false };

  // Start the actor run
  const startRes = await fetch(`https://api.apify.com/v2/acts/${actorPath}/runs?token=${APIFY_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Failed to start TikTok actor: ${err.slice(0, 200)}`);
  }

  const runData = await startRes.json();
  const runId = runData?.data?.id;
  if (!runId) throw new Error("No run ID returned");

  console.log(`   ⏳ Run started: ${runId}`);

  // Poll for completion
  let status = "READY";
  let datasetId = null;
  const deadline = Date.now() + 60000; // 60s max

  while ((status === "READY" || status === "RUNNING") && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const pollData = await pollRes.json();
    status = pollData?.data?.status;
    datasetId = pollData?.data?.defaultDatasetId;
    process.stdout.write(`   ⏳ ${status}...\r`);
  }

  console.log(`   📊 Status: ${status}`);

  if (status !== "SUCCEEDED" || !datasetId) {
    console.log(`   ⚠️  TikTok run ended with status: ${status}`);
    return [];
  }

  // Fetch results
  const dataRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}`);
  const items = await dataRes.json();

  if (!Array.isArray(items)) return [];

  return items.map(item => {
    const views = item.playCount || item.stats?.playCount || 0;
    const likes = item.diggCount || item.stats?.diggCount || 0;
    const comments = item.commentCount || item.stats?.commentCount || 0;
    const shares = item.shareCount || item.stats?.shareCount || 0;
    const creator = item.authorMeta?.name || item.author?.uniqueId || "unknown";
    const caption = item.text || item.desc || "";
    const hook = caption.split(/[.\n]/)[0]?.trim()?.slice(0, 80) || "";

    return {
      platform: "tiktok",
      search_query: query,
      post_url: item.webVideoUrl || `https://tiktok.com/@${creator}/video/${item.id}`,
      creator: `@${creator}`,
      title: caption.split("\n")[0]?.slice(0, 80) || "TikTok Video",
      caption,
      thumbnail_url: item.videoMeta?.coverUrl || item.covers?.default || "",
      views,
      likes,
      comments,
      engagement_rate: views > 0 ? Math.round((likes + comments + shares) / views * 10000) / 100 : null,
      format: "Short",
      hook,
      trigger_type: null,
      raw_data: { id: item.id, authorMeta: item.authorMeta, hashtags: item.hashtags },
    };
  }).sort((a, b) => b.views - a.views);
}

module.exports = { scrape };
