#!/usr/bin/env node
// ── CID Scout — Playwright Competitor Intel Scraper ──
// Usage:
//   node cid-scout.js "water purification" --platform tiktok --limit 20
//   node cid-scout.js "van life" --platform all --limit 15
//   node cid-scout.js --login instagram     (headed mode, save cookies)
//   node cid-scout.js "hydrogen water" --headed  (watch the browser)

require("./env-loader");
const { launchBrowser, loadCookies, saveCookies } = require("./lib/browser");
const { upsertPosts } = require("./lib/supabase");
const tiktokApify = require("./platforms/tiktok-apify");
const instagram = require("./platforms/instagram");
const reddit = require("./platforms/reddit");

// TikTok uses Apify (Playwright gets blocked), IG + Reddit use Playwright
const PLAYWRIGHT_PLATFORMS = { instagram, reddit };
const APIFY_PLATFORMS = { tiktok: tiktokApify };
const ALL_PLATFORM_NAMES = ["tiktok", "instagram", "reddit"];

// ── Parse args ──
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { query: "", platform: "all", limit: 20, headed: false, login: null, noDb: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--platform" && args[i + 1]) { opts.platform = args[++i]; }
    else if (arg === "--limit" && args[i + 1]) { opts.limit = parseInt(args[++i]) || 20; }
    else if (arg === "--headed") { opts.headed = true; }
    else if (arg === "--login" && args[i + 1]) { opts.login = args[++i]; opts.headed = true; }
    else if (arg === "--no-db") { opts.noDb = true; }
    else if (!arg.startsWith("--")) { opts.query = arg; }
  }
  return opts;
}

// ── Login mode ──
async function loginMode(platform) {
  console.log(`\n🔐 Login mode for ${platform}`);
  console.log(`   Opening browser — log in manually, then close the browser.\n`);

  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();

  const urls = {
    instagram: "https://www.instagram.com/accounts/login/",
    tiktok: "https://www.tiktok.com/login",
    reddit: "https://www.reddit.com/login",
  };

  const url = urls[platform];
  if (!url) { console.error(`Unknown platform: ${platform}`); process.exit(1); }

  await page.goto(url, { waitUntil: "networkidle" });
  console.log("   ✋ Log in now. When you're done, press Enter here...\n");

  await new Promise(resolve => {
    process.stdin.once("data", resolve);
  });

  await saveCookies(context, platform);
  await browser.close();
  console.log(`\n✅ Cookies saved for ${platform}. You can now scrape.\n`);
}

// ── Main scrape ──
async function main() {
  const opts = parseArgs();

  if (opts.login) {
    return loginMode(opts.login);
  }

  if (!opts.query) {
    console.log(`
🕵️  CID Scout — Competitor Intel Scraper

Usage:
  node cid-scout.js "search query" [options]

Options:
  --platform <name>   instagram, tiktok, reddit, or all (default: all)
  --limit <n>         Max posts per platform (default: 20)
  --headed            Show the browser window
  --no-db             Skip Supabase, print results only
  --login <platform>  Open browser for manual login + cookie save

Examples:
  node cid-scout.js "water purification" --platform tiktok --limit 30
  node cid-scout.js "van life camping" --platform all
  node cid-scout.js --login instagram
`);
    process.exit(0);
  }

  const targets = opts.platform === "all"
    ? ALL_PLATFORM_NAMES
    : [opts.platform];

  console.log(`\n🕵️  CID Scout — VitalLyfe Vantus`);
  console.log(`🔍  Query: "${opts.query}"`);
  console.log(`📱  Platforms: ${targets.join(", ")}`);
  console.log(`📊  Limit: ${opts.limit} per platform`);
  console.log(`💾  Database: ${opts.noDb ? "OFF" : "ON"}\n`);

  const allResults = [];

  for (const platName of targets) {
    // Apify-based platforms (TikTok)
    if (APIFY_PLATFORMS[platName]) {
      try {
        const posts = await APIFY_PLATFORMS[platName].scrape(opts.query, opts.limit);
        allResults.push(...posts);
        console.log(`   ✅ ${posts.length} posts scraped from ${platName}`);
        if (!opts.noDb && posts.length > 0) {
          const saved = await upsertPosts(posts);
          console.log(`   💾 ${saved} posts saved to Supabase`);
        }
      } catch (err) {
        console.error(`   ❌ ${platName} failed: ${err.message}`);
      }
      continue;
    }

    // Playwright-based platforms (Instagram, Reddit)
    const platModule = PLAYWRIGHT_PLATFORMS[platName];
    if (!platModule) {
      console.log(`⚠️  Unknown platform: ${platName} — skipping`);
      continue;
    }

    const { browser, context } = await launchBrowser(opts.headed);
    const page = await context.newPage();

    const hasCookies = await loadCookies(context, platName);
    if (!hasCookies && platName === "instagram") {
      console.log(`   ⚠️  No cookies for ${platName}. Run: node cid-scout.js --login ${platName}`);
    }

    try {
      const posts = await platModule.scrape(page, opts.query, opts.limit);
      allResults.push(...posts);
      console.log(`   ✅ ${posts.length} posts scraped from ${platName}`);
      if (!opts.noDb && posts.length > 0) {
        const saved = await upsertPosts(posts);
        console.log(`   💾 ${saved} posts saved to Supabase`);
      }
    } catch (err) {
      console.error(`   ❌ ${platName} failed: ${err.message}`);
    }

    await browser.close();
  }

  // Summary
  console.log(`\n${"─".repeat(50)}`);
  console.log(`🕵️  CID Scout Complete`);
  console.log(`✅  ${allResults.length} total posts scraped`);
  console.log(`${"─".repeat(50)}\n`);

  // Print top results
  const sorted = allResults.sort((a, b) => (b.views || 0) - (a.views || 0));
  sorted.slice(0, 10).forEach((p, i) => {
    const views = p.views >= 1000000 ? (p.views / 1000000).toFixed(1) + "M"
      : p.views >= 1000 ? (p.views / 1000).toFixed(1) + "K"
      : String(p.views || 0);
    console.log(`${i + 1}. [${p.platform}] ${p.creator} — ${views} views`);
    console.log(`   ${p.title}`);
    console.log(`   ${p.post_url}\n`);
  });
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
