// artgrid-scout.js — VitalLyfe War Room
// Logs into Artgrid.io as you, runs search queries, screenshots results for review.
// Usage:
//   node scout.js                         → default VitalLyfe queries
//   node scout.js "slow motion water"     → single custom query
//   node scout.js --file queries.json     → queries from JSON file

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// ── Load .env ────────────────────────────────────────────────────────────────
require("./env-loader");
const EMAIL    = process.env.ARTGRID_EMAIL;
const PASSWORD = process.env.ARTGRID_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("❌ Missing ARTGRID_EMAIL or ARTGRID_PASSWORD in .env");
  process.exit(1);
}

// ── Parse queries ────────────────────────────────────────────────────────────
function getQueries() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    const fp = path.resolve(args[fileIdx + 1]);
    const data = JSON.parse(fs.readFileSync(fp, "utf8"));
    return Array.isArray(data)
      ? data.map(q => typeof q === "string" ? { query: q, use: "", priority: "MED" } : q)
      : [];
  }
  if (args.length > 0 && !args[0].startsWith("--")) {
    // Each arg is its own query
    return args.map(q => ({ query: q, use: "custom", priority: "HIGH" }));
  }
  // Default VitalLyfe queries
  return [
    { query: "slow motion water droplet hitting calm surface sunrise",      use: "Hero opening shot",           priority: "HIGH" },
    { query: "aerial ocean waves cinematic wide landscape",                 use: "Abundance reel opener",       priority: "HIGH" },
    { query: "person drinking water outdoor natural light lifestyle",       use: "Human connection b-roll",     priority: "HIGH" },
    { query: "water flowing river forest macro close up",                   use: "Access metaphor b-roll",      priority: "HIGH" },
    { query: "engineer hands working prototype clean minimal workspace",    use: "Innovation / startup diaries",priority: "MED"  },
    { query: "tropical island coastline aerial Colombia",                   use: "Tierra Bomba campaign",       priority: "MED"  },
    { query: "water bottle condensation minimal product cinematic",         use: "Product launch hero",         priority: "HIGH" },
    { query: "rainfall macro slow motion dark background cinematic",        use: "Transition / mood shot",      priority: "MED"  },
  ];
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function scout() {
  const queries = getQueries();
  const date    = new Date().toISOString().slice(0, 10);
  const outDir  = path.join(__dirname, "screenshots", date);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n🕵️  Artgrid Scout — VitalLyfe War Room`);
  console.log(`📅  ${date}`);
  console.log(`🔍  ${queries.length} queries`);
  console.log(`📁  ${outDir}\n`);

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page    = await context.newPage();

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  console.log("🔐 Logging into Artgrid...");
  await page.goto("https://artgrid.io", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  // Dismiss cookie banner — Artgrid uses "ACCEPT" in all caps
  try {
    await page.click('#cookiescript_accept, #cookiescript_accept_all, button:has-text("ACCEPT"), button:has-text("Accept All"), button:has-text("Accept")', { timeout: 4000 });
    await page.waitForTimeout(1200);
    console.log("   🍪 Cookie banner dismissed");
  } catch (_) {}

  // Wait for Sign In button to be visible, then click
  try {
    await page.locator(".art-sign-in-btn").first().click({ timeout: 20000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    // Screenshot what we see for debugging
    await page.screenshot({ path: path.join(outDir, "_debug-homepage.png") });
    console.error("❌ Could not find Sign In button:", e.message);
    await browser.close();
    process.exit(1);
  }

  // Wait for modal with email input
  try {
    await page.waitForSelector(
      'input[type="email"], input[formcontrolname="email"], input[placeholder*="mail" i]',
      { timeout: 8000 }
    );
  } catch (e) {
    console.error("❌ Login modal did not appear:", e.message);
    await page.screenshot({ path: path.join(outDir, "_debug-modal.png") });
    await browser.close();
    process.exit(1);
  }

  // Fill credentials
  await page.fill('input[type="email"], input[formcontrolname="email"], input[placeholder*="mail" i]', EMAIL);
  await page.waitForTimeout(500);
  await page.fill('input[type="password"], input[formcontrolname="password"]', PASSWORD);
  await page.waitForTimeout(500);

  // Click the Sign In submit button explicitly (not Enter — more reliable)
  try {
    await page.click('button[type="submit"]:has-text("Sign In"), button[type="submit"]:has-text("Sign in"), button[type="submit"]:has-text("Log in"), .art-auth-modal button[type="submit"], form button[type="submit"]', { timeout: 5000 });
  } catch (_) {
    // Fallback to Enter key
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(5000); // Wait for auth redirect

  // Quick sanity check — screenshot login state
  await page.screenshot({ path: path.join(outDir, "_00-login-state.png") });
  const postLoginUrl = page.url();
  const isLoggedIn = !postLoginUrl.includes("/login") && !postLoginUrl.includes("/signin");
  console.log(isLoggedIn ? "✅ Logged in — proceeding to searches\n" : "⚠️  Login uncertain — proceeding anyway\n");

  // ── SEARCH RUNS ────────────────────────────────────────────────────────────
  const results = [];

  for (let i = 0; i < queries.length; i++) {
    const { query, use, priority } = queries[i];
    const icon  = priority === "HIGH" ? "🔥" : "⚡";
    console.log(`[${i + 1}/${queries.length}] ${icon} "${query}"`);

    try {
      const url = `https://artgrid.io/search?q=${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(3000);

      // Dismiss any overlays
      try {
        await page.click('[class*="close"], [aria-label="Close"], button:has-text("×")', { timeout: 1500 });
        await page.waitForTimeout(500);
      } catch (_) {}

      // Screenshot
      const slug     = query.replace(/[^a-z0-9]+/gi, "-").slice(0, 50).toLowerCase();
      const filename = `${String(i + 1).padStart(2, "0")}-${slug}.png`;
      const filepath = path.join(outDir, filename);
      await page.screenshot({ path: filepath, fullPage: false });

      // Grab visible clip titles
      const clipTitles = await page.evaluate(() => {
        const selectors = [
          '[class*="clip-title"]', '[class*="asset-title"]', '[class*="footage-title"]',
          '[class*="card-title"]', '[class*="item-title"]', 'h3', 'h4',
        ];
        const els = document.querySelectorAll(selectors.join(", "));
        return Array.from(els)
          .map(el => el.innerText?.trim())
          .filter(t => t && t.length > 2 && t.length < 100)
          .slice(0, 12);
      });

      results.push({ query, use, priority, filename, url, clipTitles, success: true });
      console.log(`   ✓ ${filename}${clipTitles.length ? ` · ${clipTitles.length} clips` : ""}`);
    } catch (err) {
      console.error(`   ❌ ${err.message}`);
      results.push({ query, use, priority, filename: null, url: null, clipTitles: [], success: false, error: err.message });
    }

    if (i < queries.length - 1) await page.waitForTimeout(1200);
  }

  await browser.close();

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  const summary = {
    date,
    totalQueries: queries.length,
    successful: results.filter(r => r.success).length,
    outputDir: outDir,
    results,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

  console.log(`\n${"─".repeat(54)}`);
  console.log(`🕵️  Scout Complete`);
  console.log(`✅  ${summary.successful}/${summary.totalQueries} searches captured`);
  console.log(`📁  Open: ${outDir}`);
  console.log(`${"─".repeat(54)}\n`);

  results.forEach(r => {
    const icon = r.success ? (r.priority === "HIGH" ? "🔥" : "⚡") : "❌";
    console.log(`${icon} "${r.query}"`);
    if (r.use) console.log(`   → ${r.use}`);
    if (r.clipTitles?.length) console.log(`   Clips: ${r.clipTitles.slice(0, 3).join(" · ")}`);
    console.log();
  });

  // Open folder in Finder
  try { require("child_process").execSync(`open "${outDir}"`); } catch (_) {}
}

scout().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
