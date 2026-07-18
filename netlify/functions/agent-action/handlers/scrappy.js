const { SERVICE_KEY, ANTHROPIC_KEY, TAVILY_KEY, SB_HEADERS, REST, sbGet, ai } = require("../_shared");

async function tavilySearch(query, searchDepth = "advanced", maxResults = 8) {
  if (!TAVILY_KEY) throw new Error("TAVILY_API_KEY not set");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query,
      search_depth: searchDepth,
      include_answer: true,
      include_raw_content: false,
      max_results: maxResults,
    }),
  });
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
  return res.json();
}

async function scrappySearchContext(topic, brand) {
  const brandTopic = topic || brand.name || "content trends";
  const queries = [
    `${brandTopic} trends 2026`,
    `${brandTopic} content marketing trends`,
    `${brandTopic} viral content`,
    `${brandTopic} TikTok Instagram trends this month`,
  ];

  const searchResults = await Promise.allSettled(
    queries.map(q => tavilySearch(q, "basic", 5))
  );

  const allResults = [];
  const seenUrls = new Set();
  searchResults.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.results) {
      r.value.results.forEach(result => {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          allResults.push({
            query: queries[i],
            title: result.title,
            url: result.url,
            content: result.content?.slice(0, 240),
            score: result.score,
          });
        }
      });
      if (r.value.answer) {
        allResults.push({ query: queries[i], title: "Tavily Answer", content: String(r.value.answer).slice(0, 600), score: 1, url: "" });
      }
    }
  });

  allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  const topResults = allResults.slice(0, 18);
  const dataContext = `
TOPIC: ${topic}
LIVE SEARCH DATA (${topResults.length} results from Tavily):

${topResults.map((r, i) => `[${i + 1}] "${r.title}"
  Query: ${r.query}
  ${r.content || ""}
  ${r.url ? `Source: ${r.url}` : ""}`).join("\n\n")}
`;
  return { brandTopic, queries, topResults, dataContext };
}

async function scrappy_research(payload, brand) {
  const { topic = "" } = payload;

  if (!TAVILY_KEY) {
    return {
      success: false,
      agent: "Scrappy",
      action: "scrappy_research",
      message: "❌ TAVILY_API_KEY not configured — add it in Netlify environment variables",
    };
  }

  const { queries, topResults, dataContext } = await scrappySearchContext(topic, brand);

  const systemPrompt = `You are Scrappy, ${brand.name}'s Trend Scout agent for Cloud Scenic's Vantus.
You scour the internet for content trends, viral topics, and fresh angles — then report back with gems for Muse to work with.

${brand.name} context:
${brand.voice || "(No brand voice configured — work from the search results alone.)"}

Your job: Analyze the live internet data below (fresh Tavily search results). Extract trends, angles, hooks, and content opportunities ${brand.name} could own.
Be a scout, not an analyst — cut the fluff, surface the gems. Think like a creative director who just did deep research.

Return a structured JSON object:
{
  "trendPulse": "1-2 sentence read on where the conversation is right now",
  "topTrends": [
    {
      "trend": "trend name",
      "why": "why it matters for ${brand.name} specifically",
      "pillar": "which content pillar it maps to",
      "hookIdea": "one-line hook ${brand.name} could use",
      "heat": "🔥🔥🔥|🔥🔥|🔥"
    }
  ],
  "contentAngles": [
    { "angle": "fresh specific angle or idea", "format": "Reel|Carousel|Thread|Short", "platform": "IG|TT|YT|X", "urgency": "high|medium|low" }
  ],
  "competitorMoves": "what's working in ${brand.name}'s space right now",
  "avoidZones": ["oversaturated or off-brand topics to skip"],
  "museHandoff": "direct brief to Muse — what to create this month based on this research"
}

Return ONLY the JSON object.`;

  const rawResult = await ai(systemPrompt, `Analyze and generate research brief:\n${dataContext}`, 1600);

  let report = null;
  try {
    const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
    report = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) { report = null; }

  if (!report) {
    return {
      success: false,
      agent: "Scrappy",
      action: "scrappy_research",
      message: "❌ Research parse failed",
      raw: rawResult,
    };
  }

  const trendCount = report.topTrends?.length || 0;
  const angleCount = report.contentAngles?.length || 0;

  return {
    success: true,
    agent: "Scrappy",
    action: "scrappy_research",
    report,
    dataPoints: { sources: topResults.length, queries: queries.length },
    trendPulse: report.trendPulse,
    museHandoff: report.museHandoff,
    message: `🕵️ Research complete — ${topResults.length} live sources scoured → ${trendCount} trends, ${angleCount} content angles surfaced`,
    summary: (report.topTrends || []).map(t =>
      `${t.heat} [${t.pillar}] ${t.trend}\n   Hook: "${t.hookIdea}"`
    ).join("\n") + (report.museHandoff ? `\n\n📬 Muse Handoff:\n${report.museHandoff}` : ""),
  };
}

async function scrappy_muse_collab(payload, brand) {
  if (!TAVILY_KEY) {
    return {
      success: false,
      agent: "Scrappy × Muse",
      action: "scrappy_muse_collab",
      message: "❌ TAVILY_API_KEY not configured — collaboration aborted",
    };
  }

  const [searchCtx, existingItems] = await Promise.all([
    scrappySearchContext(payload.topic || "", brand),
    sbGet("content_items", "?order=id&limit=5"),
  ]);
  const existingTitles = existingItems.map(i => i.title).join(", ");

  const systemPrompt = `You are Scrappy × Muse for ${brand.name} via Cloud Scenic Vantus.
Scrappy scouts live internet signals. Muse turns the sharpest signals into concrete, on-brand content pieces.

${brand.voice}

Caption structure: poetic statement → expand metaphor → bridge to brand → soft CTA "Join us (Link in bio)".

Existing content (don't repeat): ${existingTitles}

Return ONLY one JSON object:
{
  "report": {
    "trendPulse": "1-2 sentence read on where the conversation is right now",
    "topTrends": [
      { "trend": "trend name", "why": "why it matters for ${brand.name} specifically", "pillar": "which content pillar it maps to", "hookIdea": "one-line hook ${brand.name} could use", "heat": "🔥🔥🔥|🔥🔥|🔥" }
    ],
    "contentAngles": [
      { "angle": "fresh specific angle or idea", "format": "Reel|Carousel|Thread|Short", "platform": "IG|TT|YT|X", "urgency": "high|medium|low" }
    ],
    "competitorMoves": "what's working in ${brand.name}'s space right now",
    "avoidZones": ["oversaturated or off-brand topics to skip"],
    "museHandoff": "direct brief to Muse — what to create this month based on this research"
  },
  "contentIdeas": [
    {
      "title": "cinematic content title",
      "pillar": "content pillar",
      "format": "Reel|Carousel|Thread|Graphics (IMG)|Short",
      "platform": "IG|TT|YT|X|TH",
      "hook": "opening hook line",
      "angle": "the specific trend/angle from Scrappy's research this taps into",
      "caption": "full draft caption (poetic, on-brand)",
      "cta": "soft CTA",
      "urgency": "high|medium|low",
      "trendSignal": "why this is timely right now"
    }
  ]
}`;

  const userPrompt = `Live research data:
${searchCtx.dataContext}

Generate the research report and 6-8 content ideas in one pass. Be specific, on-brand, and timely.`;

  const rawMuse = await ai(systemPrompt, userPrompt, 2400);

  let report = null;
  let contentIdeas = [];
  try {
    const jsonMatch = rawMuse.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    report = parsed?.report || null;
    contentIdeas = Array.isArray(parsed?.contentIdeas) ? parsed.contentIdeas : [];
  } catch (e) { report = null; contentIdeas = []; }

  if (!report) {
    return { success: false, agent: "Scrappy × Muse", action: "scrappy_muse_collab", message: "❌ Research phase failed — collaboration aborted" };
  }

  const highPriority = contentIdeas.filter(i => i.urgency === "high");

  return {
    success: true,
    agent: "Scrappy × Muse",
    action: "scrappy_muse_collab",
    trendPulse: report.trendPulse,
    dataPoints: { sources: searchCtx.topResults.length, queries: searchCtx.queries.length },
    contentIdeas,
    highPriorityCount: highPriority.length,
    message: `🕵️✍️ Scrappy × Muse collab complete — ${contentIdeas.length} fresh ideas generated from live internet research`,
    summary: contentIdeas.map(i =>
      `${i.urgency === "high" ? "🔥" : "·"} [${i.pillar}] "${i.title}" — ${i.format} for ${i.platform}\n   Angle: ${i.angle}`
    ).join("\n"),
  };
}


async function scrappy_hook_analysis(brand) {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const prompt = `You are Scrappy, a trend scout for ${brand.name} via Cloud Scenic Vantus.

${brand.name} brand context:
${brand.voice || "(No brand voice configured — base analysis on the content concept alone.)"}

Analyze the top 20 performing content pieces in this brand's space and identify the best performing hooks, body copy patterns, and CTAs.

Return ONLY valid JSON (no markdown) in this exact format:
{
  "hooks": [
    { "rank": 1, "text": "combined hook summary", "voice_hook": "exact words spoken in first 3 seconds", "text_hook": "ON-SCREEN TEXT IN CAPS", "platform": "TikTok", "views": "4.2M", "engagement": "11.4%", "why": "Sentence one about psychology. Sentence two about format. Sentence three about why it stops the scroll.", "adaptation": "${brand.name} version of this hook" },
    { "rank": 2, "text": "combined hook summary", "voice_hook": "spoken hook text", "text_hook": "ON-SCREEN TEXT", "platform": "Instagram", "views": "2.1M", "engagement": "8.7%", "why": "Why it worked.", "adaptation": "${brand.name} version" },
    { "rank": 3, "text": "combined hook summary", "voice_hook": "spoken hook text", "text_hook": "ON-SCREEN TEXT", "platform": "TikTok", "views": "1.8M", "engagement": "7.2%", "why": "Why it worked.", "adaptation": "${brand.name} version" }
  ],
  "bodies": [
    { "rank": 1, "text": "body copy summary", "voice_body": "what they actually say in the body", "text_body": "KEY STAT OR TEXT SHOWN ON SCREEN", "platform": "Instagram", "views": "3.1M", "engagement": "9.2%", "why": "Why this body copy structure works in 2-3 sentences.", "adaptation": "${brand.name} version" },
    { "rank": 2, "text": "body copy summary", "voice_body": "spoken body copy", "text_body": "ON-SCREEN TEXT", "platform": "TikTok", "views": "2.4M", "engagement": "8.1%", "why": "Why it worked.", "adaptation": "${brand.name} version" },
    { "rank": 3, "text": "body copy summary", "voice_body": "spoken body copy", "text_body": "ON-SCREEN TEXT", "platform": "YouTube", "views": "1.2M", "engagement": "6.3%", "why": "Why it worked.", "adaptation": "${brand.name} version" }
  ],
  "ctas": [
    { "rank": 1, "text": "CTA summary", "voice_cta": "what they say for the CTA", "text_cta": "ON-SCREEN CTA TEXT 👇", "platform": "TikTok", "views": "5.1M", "engagement": "12.1%", "why": "Why this CTA converts in 2-3 sentences.", "adaptation": "${brand.name} version" },
    { "rank": 2, "text": "CTA summary", "voice_cta": "spoken CTA", "text_cta": "ON-SCREEN CTA", "platform": "Instagram", "views": "2.8M", "engagement": "9.4%", "why": "Why it worked.", "adaptation": "${brand.name} version" },
    { "rank": 3, "text": "CTA summary", "voice_cta": "spoken CTA", "text_cta": "ON-SCREEN CTA", "platform": "Instagram", "views": "1.9M", "engagement": "7.8%", "why": "Why it worked.", "adaptation": "${brand.name} version" }
  ],
  "message": "🎣 Hook analysis complete — top 3 hooks, body copy, and CTAs surfaced from 20 competitor posts"
}

Base your analysis on real patterns that perform well in this brand's space and target audience. Make the ${brand.name} adaptations specific and immediately usable.`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
  });
  const aiData = await aiRes.json();
  const raw = aiData.content?.[0]?.text || "{}";

  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    throw new Error("Failed to parse hook analysis JSON");
  }

  // Save to Supabase cid_library table
  const SERVICE_KEY_VAL = SERVICE_KEY;
  if (SERVICE_KEY_VAL) {
    const items = [
      ...(parsed.hooks || []).map(h => ({ type: "hook", text: h.text, score: 100 - (h.rank-1)*10, platform: h.platform, views: h.views, engagement: h.engagement, why_it_works: h.why, client_adaptation: h.adaptation })),
      ...(parsed.bodies || []).map(b => ({ type: "body", text: b.text, score: 100 - (b.rank-1)*10, platform: b.platform, views: b.views, engagement: b.engagement, why_it_works: b.why, client_adaptation: b.adaptation })),
      ...(parsed.ctas || []).map(c => ({ type: "cta", text: c.text, score: 100 - (c.rank-1)*10, platform: c.platform, views: c.views, engagement: c.engagement, why_it_works: c.why, client_adaptation: c.adaptation })),
    ];
    try {
      await fetch(`${REST}/cid_library`, {
        method: "POST",
        headers: { ...SB_HEADERS(), Prefer: "return=minimal" },
        body: JSON.stringify(items),
      });
    } catch(e) {
      console.error("cid_library save failed:", e.message);
    }
  }

  return {
    success: true,
    agent: "Scrappy",
    action: "scrappy_hook_analysis",
    hooks: parsed.hooks || [],
    bodies: parsed.bodies || [],
    ctas: parsed.ctas || [],
    message: parsed.message || "🎣 Hook analysis complete",
  };
}

// ─── CID: BUILD BRIEF ─────────────────────────────────────────────────────────


function _median(nums) {
  const a = nums.filter(n => typeof n === "number" && !isNaN(n)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
function _engagementScore(m) {
  if (!m) return 0;
  if (typeof m.engagement_rate === "number") return m.engagement_rate;
  const eng = (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saved || 0);
  const base = m.reach || m.views || 0;
  return base > 0 ? eng / base : eng;
}

// Pull a brand's own top-performing synced posts for a platform so Muse can
// ground ideas in what is actually working on the account (not generic trends).
// Returns null when nothing is connected/synced yet, so callers fall back to
// brand-voice-only generation. Reads via service role (sees all rows); fine for
// the current single-tenant (Cloud Scenic) setup — scope by user_id when going multi-tenant.
async function getSyncedDigest(platform, n = 8) {
  let accounts = [];
  try { accounts = await sbGet("connected_accounts", `?select=id,handle&platform=eq.${platform}`); }
  catch (e) { return null; }
  if (!accounts.length) return null;
  const ids = accounts.map(a => a.id);
  let posts = [];
  try { posts = await sbGet("account_posts", `?select=caption,media_type,metrics,posted_at&account_id=in.(${ids.join(",")})&order=posted_at.desc&limit=200`); }
  catch (e) { return null; }
  if (posts.length < 3) return null;
  const top = posts.map(p => ({ ...p, _s: _engagementScore(p.metrics) }))
                   .sort((a, b) => b._s - a._s).slice(0, n);
  const digest = top.map((p, i) => {
    const m = p.metrics || {};
    const er = typeof m.engagement_rate === "number" ? (m.engagement_rate * 100).toFixed(1) + "%" : "n/a";
    const reach = m.reach ?? m.views ?? "—";
    return `${i + 1}. [${p.media_type || "post"}] ER ${er}, ${reach} reach — "${(p.caption || "(no caption)").slice(0, 200).replace(/\s+/g, " ")}"`;
  }).join("\n");
  // Real captions verbatim — the strongest possible anti-AI-tone anchor.
  const voiceSamples = top.slice(0, 5)
    .map(p => (p.caption || "").replace(/\s+/g, " ").trim().slice(0, 340))
    .filter(c => c.length > 12)
    .map((c, i) => `${i + 1}. "${c}"`).join("\n");
  return { handle: accounts[0].handle || null, sampleSize: posts.length, digest, voiceSamples };
}

async function scrappy_analyze_performance(payload = {}, brand) {
  const [accounts, posts] = await Promise.all([
    sbGet("connected_accounts", "?select=id,platform,handle"),
    sbGet("account_posts", "?select=id,account_id,posted_at,media_type,caption,metrics&order=posted_at.desc&limit=500"),
  ]);
  const platformOf = {};
  for (const a of accounts) platformOf[a.id] = a.platform;

  const byPlatform = {};
  for (const p of posts) {
    const plat = platformOf[p.account_id];
    if (!plat) continue;
    (byPlatform[plat] ||= []).push(p);
  }

  const PLATFORM_LABEL = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn" };
  const insights = {};
  const reasons = {};
  const lossReasons = {};
  let analyzedCount = 0;

  await Promise.all(Object.entries(byPlatform).map(async ([plat, plist]) => {
    if (plist.length < 3) {
      insights[plat] = { insufficient: true, sampleSize: plist.length, patterns: [] };
      return;
    }
    const scored = plist.map(p => ({ ...p, _score: _engagementScore(p.metrics) }))
                        .sort((a, b) => b._score - a._score);
    const baseline = _median(scored.map(s => s._score));
    const top = scored.slice(0, 6);
    const bottom = scored.length >= 10 ? scored.slice(-4) : [];

    const fmt = (p, tag) => {
      const m = p.metrics || {};
      const er = typeof m.engagement_rate === "number" ? (m.engagement_rate * 100).toFixed(1) + "%" : "n/a";
      const headline = m.reach != null ? `${m.reach} reach` : m.views != null ? `${m.views} views` : "—";
      return `[${p.id}]${tag} ${p.media_type || "post"} · ER ${er} · ${headline} · ${m.likes ?? 0} likes / ${m.comments ?? 0} comments / ${m.shares ?? m.saved ?? 0} shares\n  caption: ${(p.caption || "(no caption)").slice(0, 200).replace(/\s+/g, " ")}`;
    };
    const winnersDigest = top.map(p => fmt(p, " [WINNER]")).join("\n\n");
    const contrastDigest = bottom.length ? "\n\nFor CONTRAST — lower performers on the same account:\n" + bottom.map(p => fmt(p, " [low]")).join("\n\n") : "";

    const label = PLATFORM_LABEL[plat] || plat;
    const system = `You're an elite social performance analyst — the one creators pay to tell them WHY their content actually wins. You diagnose the real, specific, often non-obvious mechanic behind a win by comparing the winners to everything else. No generic advice, no "post consistently" fluff — cite what's literally in the captions and numbers.${brand.voice ? `\n\nBrand context: ${String(brand.voice).slice(0, 200).replace(/\s+/g, " ")}` : ""}`;

    const user = `${label} · median engagement rate ${(baseline * 100).toFixed(1)}%.
${winnersDigest}${contrastDigest}

Diagnose what actually drove the winners${bottom.length ? ", AND why the lower performers flopped" : ""} — the specific lever, not a platitude. Return ONLY JSON (no markdown):
{
  "patterns": ["3-5 specific, non-obvious patterns separating the winners — name the exact hook move, format, topic, length, or framing you see in the data"],
  "posts": [{ "id": "the number in [brackets]", "reason": "one sharp sentence: the specific reason THIS [WINNER] won, citing the real detail from its caption/metrics" }]${bottom.length ? `,
  "lostPosts": [{ "id": "the number in [brackets]", "reason": "one sharp sentence: the specific reason THIS [low] post underperformed — what it lacked or got wrong vs the winners" }]` : ""}
}
One posts entry per WINNER${bottom.length ? ", one lostPosts entry per [low] post" : ""}. Be specific or say nothing.`;

    let parsed = { patterns: [], posts: [], lostPosts: [] };
    try {
      const raw = await ai(system, user, 1300, "claude-opus-4-8");
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch (e) {
      parsed = { patterns: [], posts: [] };
    }
    for (const pr of (parsed.posts || [])) {
      if (pr && pr.id != null && pr.reason) reasons[String(pr.id)] = String(pr.reason);
    }
    for (const pr of (parsed.lostPosts || [])) {
      if (pr && pr.id != null && pr.reason) lossReasons[String(pr.id)] = String(pr.reason);
    }
    insights[plat] = {
      sampleSize: plist.length,
      baselineEngagementRate: baseline,
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns.slice(0, 5) : [],
    };
    analyzedCount += top.length;
  }));

  const analyzed = Object.keys(insights).filter(p => !insights[p].insufficient);
  return {
    success: true,
    agent: "Scrappy",
    action: "scrappy_analyze_performance",
    insights,
    reasons,
    lossReasons,
    message: analyzed.length
      ? `📊 Scrappy analyzed ${analyzedCount} top posts across ${analyzed.map(p => PLATFORM_LABEL[p] || p).join(", ")}`
      : "Not enough synced posts to analyze yet — sync more content first.",
  };
}

// AI Operations Manager — parse a raw task dump, score priority, and assign each
// task to the best-fit team member by skill (the capability matrix).

module.exports = { scrappy_research, scrappy_muse_collab, scrappy_hook_analysis, scrappy_analyze_performance };
