const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const COOKIES_DIR = path.join(__dirname, "..", "cookies");

async function launchBrowser(headed = false) {
  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 80 : 0 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-US",
  });
  return { browser, context };
}

async function loadCookies(context, platform) {
  const cookiePath = path.join(COOKIES_DIR, `${platform}.json`);
  if (fs.existsSync(cookiePath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf8"));
    await context.addCookies(cookies);
    console.log(`   🍪 Loaded ${cookies.length} cookies for ${platform}`);
    return true;
  }
  return false;
}

async function saveCookies(context, platform) {
  const cookies = await context.cookies();
  const cookiePath = path.join(COOKIES_DIR, `${platform}.json`);
  fs.mkdirSync(COOKIES_DIR, { recursive: true });
  fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
  console.log(`   💾 Saved ${cookies.length} cookies for ${platform}`);
}

module.exports = { launchBrowser, loadCookies, saveCookies };
