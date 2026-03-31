// Reddit scraper — uses old.reddit.com for stable DOM
async function scrape(page, query, limit) {
  console.log(`\n🟠 Reddit — searching "${query}" (limit: ${limit})`);

  await page.goto(`https://old.reddit.com/search?q=${encodeURIComponent(query)}&sort=top&t=year&limit=${Math.min(limit, 25)}`, {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.waitForTimeout(2000);

  const posts = await page.evaluate((max) => {
    const results = [];
    const items = document.querySelectorAll('.search-result, .thing[data-fullname]');

    for (const item of items) {
      if (results.length >= max) break;

      // Title + URL
      const titleLink = item.querySelector('a.search-title, a.title, a[class*="title"]');
      const title = titleLink?.innerText?.trim() || "";
      const url = titleLink?.href || "";

      // Subreddit
      const subEl = item.querySelector('a.search-subreddit-link, a[href*="/r/"]');
      const subreddit = subEl?.innerText?.trim()?.replace(/^\/r\//, "r/") || "";

      // Score / upvotes
      const scoreEl = item.querySelector('.search-score, .score, .score.unvoted');
      const scoreText = scoreEl?.innerText?.trim() || "";

      // Comments
      const commentsEl = item.querySelector('a.search-comments, a[class*="comments"]');
      const commentsText = commentsEl?.innerText?.trim() || "";

      // Thumbnail
      const thumbEl = item.querySelector('a.search-link img, .thumbnail img');
      const thumbnail = thumbEl?.src || "";

      // Author
      const authorEl = item.querySelector('a.author');
      const author = authorEl?.innerText?.trim() || "";

      // Timestamp
      const timeEl = item.querySelector('time');
      const time = timeEl?.getAttribute("datetime") || "";

      results.push({ title, url, subreddit, scoreText, commentsText, thumbnail, author, time });
    }
    return results;
  }, limit);

  console.log(`   📊 Found ${posts.length} posts`);

  return posts.map(p => {
    const upvotes = parseCount(p.scoreText);
    const comments = parseCount(p.commentsText);
    const hook = p.title?.split(/[.!?]/)[0]?.trim()?.slice(0, 80) || p.title?.slice(0, 80) || "";
    return {
      platform: "reddit",
      search_query: query,
      post_url: p.url,
      creator: p.subreddit || (p.author ? `u/${p.author}` : "Unknown"),
      title: p.title?.slice(0, 80) || "Reddit Post",
      caption: p.title || "",
      thumbnail_url: p.thumbnail,
      views: upvotes,
      likes: upvotes,
      comments,
      engagement_rate: upvotes > 0 ? Math.round(comments / upvotes * 10000) / 100 : null,
      format: p.thumbnail ? "Media Post" : "Text Post",
      hook,
      trigger_type: null,
      raw_data: p,
    };
  });
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

module.exports = { scrape };
