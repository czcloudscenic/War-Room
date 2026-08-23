// siteAudit.js — deterministic marketing audit of a prospect's website.
// No AI, no credits: fetch a few pages, read the HTML for the signals that
// decide whether a local business can be marketed at all (pixels, analytics,
// schema, mobile, CTA, socials, staleness, builder), and turn every gap into
// a finding with evidence + a plain-English pitch line. The AI brief writer
// (growth_brief) narrates these; it never invents its own.

const UA = "Mozilla/5.0 (compatible; VantusGrowth/1.0; marketing audit)";
const PAGES = ["", "/about", "/contact", "/services"];
const PAGE_TIMEOUT_MS = 7000;
const MAX_BYTES = 600_000;

function normalizeUrl(input) {
  let u = String(input || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const url = new URL(u);
    url.hash = ""; url.search = "";
    return { origin: url.origin, host: url.hostname.replace(/^www\./i, "").toLowerCase(), href: url.href };
  } catch { return null; }
}

async function fetchPage(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "follow", signal: ctl.signal });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok || !ct.includes("html")) return { ok: false, status: res.status, html: "" };
    const text = (await res.text()).slice(0, MAX_BYTES);
    return { ok: true, status: res.status, html: text, finalUrl: res.url };
  } catch (e) {
    return { ok: false, status: 0, html: "", error: e.name === "AbortError" ? "timeout" : e.message };
  } finally { clearTimeout(t); }
}

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

function extractSignals(pages, norm) {
  const all = pages.map(p => p.html).join("\n");
  const home = pages[0]?.html || "";
  const lower = all.toLowerCase();
  const text = strip(all);

  const emails = uniq((all.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(e => e.toLowerCase()))
    .filter(e => !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(e) && !/sentry|wixpress|example\.com|domain\.com/i.test(e)).slice(0, 5);
  const phones = uniq((all.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || [])).slice(0, 3);
  const social = (re) => { const m = all.match(re); return m ? m[0].replace(/["'<>)]+$/, "") : null; };
  const socials = {
    instagram: social(/https?:\/\/(?:www\.)?instagram\.com\/[a-z0-9_.]+/i),
    facebook:  social(/https?:\/\/(?:www\.)?facebook\.com\/[a-z0-9_.\-/]+/i),
    tiktok:    social(/https?:\/\/(?:www\.)?tiktok\.com\/@[a-z0-9_.]+/i),
    youtube:   social(/https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)[a-z0-9_.\-]+/i),
    linkedin:  social(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-z0-9_.\-]+/i),
    yelp:      social(/https?:\/\/(?:www\.)?yelp\.com\/biz\/[a-z0-9_.\-]+/i),
  };
  for (const k of Object.keys(socials)) if (!socials[k]) delete socials[k];

  const title = (home.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1].replace(/\s+/g, " ").trim().slice(0, 160);
  const metaDesc = (home.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || home.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) || [, ""])[1].trim().slice(0, 300);
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(home);
  const h1Count = (home.match(/<h1[\s>]/gi) || []).length;
  const copyrightYears = (all.match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi) || []).map(m => Number((m.match(/(20\d{2})/) || [])[1])).filter(Boolean);
  const latestCopyright = copyrightYears.length ? Math.max(...copyrightYears) : null;

  const pixels = {
    meta: /fbq\(|connect\.facebook\.net\/[a-z_]+\/fbevents|facebook\.com\/tr\?/i.test(all),
    ga: /googletagmanager\.com\/gtag|google-analytics\.com|gtag\(|googletagmanager\.com\/gtm\.js|G-[A-Z0-9]{6,}/.test(all),
    tiktok: /analytics\.tiktok\.com|ttq\.load/i.test(all),
    hotjar: /hotjar\.com|hj\(/i.test(all),
  };
  const schemaBlocks = all.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const schemaTypes = uniq(schemaBlocks.flatMap(b => (b.match(/"@type"\s*:\s*"([A-Za-z]+)"/g) || []).map(m => m.replace(/.*"([A-Za-z]+)"$/, "$1"))));
  const hasLocalSchema = schemaTypes.some(t => /LocalBusiness|Organization|Restaurant|Store|Dentist|Plumber|Roofing|HomeAndConstruction|MedicalBusiness|AutoRepair|BeautySalon|HealthAndBeauty|LegalService|ProfessionalService/i.test(t));

  const ctaLinks = uniq((all.match(/href=["']([^"']*(?:calendly|book|booking|schedule|appointment|quote|estimate|consult|reserve|order)[^"']*)["']/gi) || []).map(m => m.replace(/^href=["']|["']$/g, ""))).slice(0, 5);
  const hasTel = /href=["']tel:/i.test(all);
  const hasForm = /<form[\s>]/i.test(all);
  const builder = /wix\.com|wixstatic|_wix/i.test(lower) ? "Wix"
    : /squarespace/i.test(lower) ? "Squarespace"
    : /wp-content|wp-includes/i.test(lower) ? "WordPress"
    : /godaddy|secureserver/i.test(lower) ? "GoDaddy"
    : /shopify/i.test(lower) ? "Shopify"
    : /weebly/i.test(lower) ? "Weebly"
    : /webflow/i.test(lower) ? "Webflow"
    : null;
  const imgCount = (home.match(/<img[\s>]/gi) || []).length;
  const wordCount = strip(home).split(/\s+/).filter(Boolean).length;
  const https = norm.href.startsWith("https://");
  const reachedPages = pages.filter(p => p.ok).map(p => p.path);

  return { title, metaDesc, emails, phones, socials, hasViewport, h1Count, latestCopyright, pixels, schemaTypes, hasLocalSchema, ctaLinks, hasTel, hasForm, builder, imgCount, wordCount, https, reachedPages, textSample: text.slice(0, 1500) };
}

// Findings: each gap is a sales conversation. severity: high | med | low.
function audit(sig) {
  const f = [];
  const now = new Date().getFullYear();
  if (!sig.pixels.meta) f.push({ key: "no_meta_pixel", severity: "high", label: "No Meta pixel", evidence: "no fbq()/fbevents.js on the site", pitch: "Every visitor is lost the moment they leave, no retargeting audience is being built, so paid social starts from zero every time." });
  if (!sig.pixels.ga) f.push({ key: "no_analytics", severity: "high", label: "No analytics", evidence: "no gtag/GA/GTM tag found", pitch: "Nobody knows where the traffic comes from or what it does, marketing decisions are guesses." });
  if (!sig.hasLocalSchema) f.push({ key: "no_local_schema", severity: "med", label: "No local-business schema", evidence: sig.schemaTypes.length ? `schema present but only: ${sig.schemaTypes.join(", ")}` : "no JSON-LD structured data", pitch: "Google can't read the business details, so the site is missing from the rich local results competitors show up in." });
  if (!sig.hasViewport) f.push({ key: "not_mobile", severity: "high", label: "Not mobile-optimized", evidence: "no viewport meta tag", pitch: "Most local searches happen on phones, this site is pinching-and-zooming its best leads away." });
  if (!sig.ctaLinks.length && !sig.hasTel && !sig.hasForm) f.push({ key: "no_cta", severity: "high", label: "No clear next step", evidence: "no booking/quote link, tel: link, or form found", pitch: "A visitor who is ready to buy has nowhere to click, the site informs but never converts." });
  else if (!sig.ctaLinks.length) f.push({ key: "weak_cta", severity: "low", label: "No booking/quote path", evidence: `contact exists (${sig.hasTel ? "tel" : ""}${sig.hasTel && sig.hasForm ? " + " : ""}${sig.hasForm ? "form" : ""}) but no book/quote/schedule link`, pitch: "Turning the contact form into a one-click booking or instant quote is the fastest conversion lift available." });
  const socialCount = Object.keys(sig.socials).length;
  if (!socialCount) f.push({ key: "no_socials", severity: "med", label: "No social presence linked", evidence: "no Instagram/Facebook/TikTok/YouTube links on the site", pitch: "There's no content engine feeding the brand, no proof of life between the moment someone hears the name and the moment they decide." });
  else if (!sig.socials.instagram && !sig.socials.tiktok) f.push({ key: "no_short_form", severity: "med", label: "No Instagram / TikTok", evidence: `linked: ${Object.keys(sig.socials).join(", ")}`, pitch: "The platforms where local discovery actually happens today aren't in the mix." });
  if (sig.latestCopyright && sig.latestCopyright <= now - 2) f.push({ key: "stale_site", severity: "med", label: `Site reads abandoned (© ${sig.latestCopyright})`, evidence: `latest copyright year on page: ${sig.latestCopyright}`, pitch: "A footer stuck in the past tells visitors the business might be too." });
  if (sig.builder && /Wix|GoDaddy|Weebly/.test(sig.builder)) f.push({ key: "template_builder", severity: "low", label: `${sig.builder} template site`, evidence: `${sig.builder} markers in source`, pitch: "Template builders cap speed, SEO, and design, the site looks like a thousand others." });
  if (!sig.metaDesc) f.push({ key: "no_meta_desc", severity: "low", label: "No meta description", evidence: "homepage has no description tag", pitch: "Search results show a random sentence instead of a pitch." });
  if (sig.h1Count === 0) f.push({ key: "no_h1", severity: "low", label: "No H1 headline", evidence: "homepage has no <h1>", pitch: "The page never states what the business does in the one place search engines weigh most." });
  if (!sig.https) f.push({ key: "no_https", severity: "high", label: "Not secure (HTTP)", evidence: "site served without HTTPS", pitch: "Browsers label the site 'Not secure', trust evaporates before the pitch starts." });
  if (sig.wordCount < 120) f.push({ key: "thin_content", severity: "low", label: "Thin homepage", evidence: `~${sig.wordCount} words on the homepage`, pitch: "There's almost nothing for search engines, or a nervous buyer, to read." });
  const rank = { high: 0, med: 1, low: 2 };
  return f.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// Tiny pages that just bounce the browser elsewhere (window.location / meta
// refresh) — follow once so the audit reads the real site, not the trampoline.
function clientRedirect(html, base) {
  if (!html || html.length > 4000) return null;
  const m = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i)
    || html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+url=([^"'>\s]+)/i);
  if (!m) return null;
  try { return new URL(m[1], base).href; } catch { return null; }
}

async function scanSite(input) {
  let norm = normalizeUrl(input);
  if (!norm) throw new Error("invalid website URL");
  const pages = [];
  let redirectedFrom = null;
  for (const path of PAGES) {
    let r = await fetchPage(norm.origin + path);
    if (path === "" && r.ok) {
      const hop = clientRedirect(r.html, norm.origin);
      if (hop) {
        const r2 = await fetchPage(hop);
        if (r2.ok) { redirectedFrom = norm.href; r = r2; const n2 = normalizeUrl(hop); if (n2 && n2.host !== norm.host) norm = n2; }
      }
    }
    pages.push({ path: path || "/", ...r });
    if (path === "" && !r.ok) break; // homepage unreachable — don't hammer
  }
  if (!pages[0]?.ok) {
    return { ok: false, norm, error: `homepage unreachable (${pages[0]?.error || pages[0]?.status})`, pages: pages.map(p => ({ path: p.path, ok: p.ok, status: p.status })) };
  }
  const signals = extractSignals(pages, norm);
  signals.redirectedFrom = redirectedFrom;
  // JS-rendered shell: almost no text but script bundles present. Content
  // findings would be false positives; keep only the raw-HTML-safe ones and
  // say so. (Pixels/viewport/schema live in the shell's <head> for SPAs.)
  signals.jsShell = signals.wordCount < 30 && /<script[^>]+src=/i.test(pages[0].html);
  let findings = audit(signals);
  if (signals.jsShell) {
    const rawSafe = new Set(["no_meta_pixel", "no_analytics", "no_local_schema", "not_mobile", "no_https", "template_builder"]);
    findings = findings.filter(f => rawSafe.has(f.key));
    findings.push({ key: "js_rendered", severity: "low", label: "JavaScript-rendered site", evidence: `~${signals.wordCount} words in raw HTML, script bundles present`, pitch: "Content, contact paths and socials need a rendered scan (Apify) to audit, the items above are what the raw page shows." });
  }
  return { ok: true, norm, signals, findings, pages: pages.map(p => ({ path: p.path, ok: p.ok, status: p.status })) };
}

// Templated brief: the zero-credit path to "send them a brief with pain points".
function templateBrief({ leadName, contactName, findings, fromName = "Christian", agency = "Cloud Scenic" }) {
  const top = findings.slice(0, 4);
  const greet = contactName ? `Hi ${contactName.split(" ")[0]},` : "Hi there,";
  const clean = (x) => String(x).replace(/\s*[—–]\s*/g, ", ");
  const lines = top.map((f, i) => `${i + 1}. ${clean(f.label)}. ${clean(f.pitch)}`);
  const subject = top.length
    ? `${leadName}: ${top.length} thing${top.length === 1 ? "" : "s"} quietly costing you customers`
    : `${leadName}: a quick note from ${agency}`;
  const body = [
    greet,
    "",
    `I took a look at ${leadName}'s online presence this week. Not a sales pitch yet, just what I found:`,
    "",
    ...lines,
    "",
    top.length
      ? "None of these are hard fixes. Together they're the difference between a site that informs and one that brings in customers on its own."
      : "Honestly, the fundamentals are in good shape. The upside now is in content and paid reach.",
    "",
    `If it's useful, I can walk you through what we'd change in 15 minutes. No deck, just the plan.`,
    "",
    fromName,
    agency,
  ].join("\n");
  return { subject: clean(subject), body_md: clean(body) };
}

module.exports = { normalizeUrl, scanSite, audit, extractSignals, templateBrief };
