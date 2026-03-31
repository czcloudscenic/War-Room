// TikTok scraper — search page shows play counts on video cards
async function scrape(page, query, limit) {
  console.log(`\n🎵 TikTok — searching "${query}" (limit: ${limit})`);

  await page.goto(`https://www.tiktok.com/search?q=${encodeURIComponent(query)}`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Dismiss cookie banner
  try {
    await page.click('button:has-text("Accept all"), button:has-text("Accept")', { timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch {}

  // Switch to "Top" tab for viral content
  try {
    const topTab = page.locator('[data-e2e="search_top-tab"], a:has-text("Top")').first();
    if (await topTab.isVisible()) {
      await topTab.click();
      await page.waitForTimeout(2000);
    }
  } catch {}

  // Scroll to load more results
  let prevHeight = 0;
  for (let i = 0; i < 5; i++) {
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === prevHeight) break;
    prevHeight = height;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
  }

  // Extract video cards
  const posts = await page.evaluate((maxItems) => {
    const cards = document.querySelectorAll('[data-e2e="search_top-item"], [class*="DivItemContainer"], [class*="video-feed-item"], a[href*="/video/"]');
    const results = [];
    const seen = new Set();

    for (const card of cards) {
      if (results.length >= maxItems) break;

      // Find the video link
      const link = card.tagName === "A" ? card : card.querySelector('a[href*="/video/"]');
      const url = link?.href;
      if (!url || seen.has(url)) continue;
      seen.add(url);

      // Thumbnail
      const img = card.querySelector('img');
      const thumbnail = img?.src || "";

      // Play count from the card overlay
      const playEl = card.querySelector('[data-e2e="video-views"], [class*="PlayCount"], [class*="video-count"]');
      let playText = playEl?.innerText?.trim() || "";

      // Creator
      const authorEl = card.querySelector('[data-e2e="search-card-user-unique-id"], [class*="author"], a[href*="/@"] span, p[class*="user"]');
      let creator = authorEl?.innerText?.trim() || "";
      if (!creator) {
        const match = url.match(/@([^\/]+)/);
        creator = match ? match[1] : "";
      }

      // Caption
      const captionEl = card.querySelector('[data-e2e="search-card-desc"], [class*="caption"], [class*="desc"]');
      const caption = captionEl?.innerText?.trim() || "";

      results.push({ url, thumbnail, playText, creator, caption });
    }
    return results;
  }, limit);

  console.log(`   📊 Found ${posts.length} videos`);

  return posts.map(p => {
    const views = parseCount(p.playText);
    const hook = p.caption?.split(/[.\n]/)[0]?.trim()?.slice(0, 80) || p.caption?.slice(0, 80) || "";
    return {
      platform: "tiktok",
      search_query: query,
      post_url: p.url,
      creator: p.creator ? `@${p.creator}` : "Unknown",
      title: p.caption?.split("\n")[0]?.slice(0, 80) || "TikTok Video",
      caption: p.caption || "",
      thumbnail_url: p.thumbnail,
      views,
      likes: 0,   // Need to click into video for this
      comments: 0,
      engagement_rate: null,
      format: "Short",
      hook,
      trigger_type: null,
      raw_data: p,
    };
  });
}

function parseCount(text) {
  if (!text) return 0;
  const clean = text.replace(/[^0-9.KMBkmb]/g, "");
  const num = parseFloat(clean) || 0;
  if (/[bB]/.test(text)) return Math.round(num * 1000000000);
  if (/[mM]/.test(text)) return Math.round(num * 1000000);
  if (/[kK]/.test(text)) return Math.round(num * 1000);
  return Math.round(num);
}

module.exports = { scrape };
