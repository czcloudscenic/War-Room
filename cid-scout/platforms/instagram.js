// Instagram scraper — uses Explore search with cookies
async function scrape(page, query, limit) {
  console.log(`\n📸 Instagram — searching "${query}" (limit: ${limit})`);

  // Search via explore
  const hashtag = query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  await page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Check if logged in — if we see a login wall, warn
  const loginWall = await page.locator('input[name="username"], [class*="LoginForm"]').count();
  if (loginWall > 0) {
    console.log("   ⚠️  Login required. Run: node cid-scout.js --login instagram");
    return [];
  }

  // Wait for grid
  try {
    await page.waitForSelector('article a[href*="/p/"], article a[href*="/reel/"]', { timeout: 10000 });
  } catch {
    console.log("   ⚠️  No posts found for #" + hashtag);
    return [];
  }

  // Scroll to load more
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
  }

  // Get post links
  const postLinks = await page.evaluate((max) => {
    const links = document.querySelectorAll('article a[href*="/p/"], article a[href*="/reel/"]');
    const urls = [];
    const seen = new Set();
    for (const a of links) {
      const href = a.href;
      if (seen.has(href) || urls.length >= max) continue;
      seen.add(href);
      // Get thumbnail from the img inside the link
      const img = a.querySelector('img');
      urls.push({ url: href, thumb: img?.src || "" });
    }
    return urls;
  }, limit);

  console.log(`   🔗 Found ${postLinks.length} post links, scraping details...`);

  const posts = [];
  for (const link of postLinks.slice(0, limit)) {
    try {
      await page.goto(link.url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1500);

      const data = await page.evaluate(() => {
        // Creator
        const creatorEl = document.querySelector('header a[href*="/"] span, a[class*="user"] span');
        const creator = creatorEl?.innerText?.trim() || "";

        // Caption
        const captionEl = document.querySelector('[class*="Caption"] span, article span[class*="x1lliihq"]');
        const caption = captionEl?.innerText?.trim() || "";

        // Likes
        const likeEl = document.querySelector('section [class*="like"] span, button[class*="like"] span, a[href*="liked_by"] span');
        const likeText = likeEl?.innerText?.trim() || "";

        // Views (for Reels)
        const viewEl = document.querySelector('[class*="view"] span, span[class*="playCount"]');
        const viewText = viewEl?.innerText?.trim() || "";

        // Comments
        const commentEls = document.querySelectorAll('ul li[class*="comment"], [class*="Comment"]');
        const commentCount = commentEls.length;

        // Is Reel?
        const isReel = window.location.href.includes("/reel/");

        return { creator, caption, likeText, viewText, commentCount, isReel };
      });

      const views = parseCount(data.viewText) || parseCount(data.likeText);
      const likes = parseCount(data.likeText);
      const caption = data.caption || "";
      const hook = caption.split(/[.\n]/)[0]?.trim()?.slice(0, 80) || "";

      posts.push({
        platform: "instagram",
        search_query: query,
        post_url: link.url,
        creator: data.creator ? `@${data.creator}` : "Unknown",
        title: hook || "Instagram Post",
        caption,
        thumbnail_url: link.thumb,
        views,
        likes,
        comments: data.commentCount || 0,
        engagement_rate: views > 0 ? Math.round((likes + data.commentCount) / views * 10000) / 100 : null,
        format: data.isReel ? "Reel" : "Post",
        hook,
        trigger_type: null,
        raw_data: { ...data, thumb: link.thumb },
      });

      console.log(`   ✓ @${data.creator || "?"} — ${formatNum(views)} views`);
    } catch (err) {
      console.log(`   ✗ ${link.url.slice(-20)} — ${err.message}`);
    }

    // Rate limit
    await page.waitForTimeout(1500 + Math.random() * 1000);
  }

  return posts;
}

function parseCount(text) {
  if (!text) return 0;
  const clean = text.replace(/,/g, "").replace(/[^0-9.KMBkmb]/g, "");
  const num = parseFloat(clean) || 0;
  if (/[bB]/.test(text)) return Math.round(num * 1000000000);
  if (/[mM]/.test(text)) return Math.round(num * 1000000);
  if (/[kK]/.test(text)) return Math.round(num * 1000);
  return Math.round(num);
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

module.exports = { scrape };
