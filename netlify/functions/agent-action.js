// agent-action.js — VitalLyfe Vantus Agent Action Engine
// Handles autonomous agent actions: read/write Supabase, AI generation

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "https://cloudscenic.app.n8n.cloud/webhook/11138e92-248c-4562-be17-5e07b9da928c";
// Production: https://cloudscenic.app.n8n.cloud/webhook/11138e92-248c-4562-be17-5e07b9da928c
// Test:       https://cloudscenic.app.n8n.cloud/webhook-test/11138e92-248c-4562-be17-5e07b9da928c

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const SLACK_AGENT_LABELS = {
  sean_briefing:          "📋 *Sean* — Morning Briefing",
  lacey_advance:          "⚡ *Lacey* — Pipeline Update",
  lacey_trigger_n8n:      "⚡ *Lacey* — n8n Trigger",
  sam_health:             "💊 *Sam* — Health Check",
  overseer_scan:          "🔍 *Overseer* — SOP Scan",
  muse_generate_calendar: "✍️ *Muse* — Content Calendar",
  muse_save_calendar:     "✍️ *Muse* — Calendar Saved",
  muse_write_content:     "✍️ *Muse* — Content Written",
  artgrid_scout:          "🎨 *Artgrid* — Scout Report",
  scrappy_research:       "📡 *Scrappy* — Trend Research",
  scrappy_muse_collab:    "📡 *Scrappy* × *Muse* — Collab",
};

const SB_HEADERS = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

const REST = `${SUPABASE_URL}/rest/v1`;

async function sbGet(table, params = "") {
  const res = await fetch(`${REST}/${table}${params}`, { headers: SB_HEADERS() });
  if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function postToSlack(label, text) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${label}\n${text}` }),
    });
  } catch (e) {
    console.error("Slack post failed:", e.message);
  }
}

async function sbPatch(table, match, body) {
  const res = await fetch(`${REST}/${table}?${match}`, {
    method: "PATCH",
    headers: SB_HEADERS(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ai(system, user, maxTokens = 1200) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`Anthropic: ${d.error?.message || res.status}`);
  return d.content?.[0]?.text || "";
}

// ─── ACTION HANDLERS ──────────────────────────────────────────────────────────

async function muse_write_content(payload) {
  const { itemId, itemTitle, pillar, format, description, fieldToUpdate = "caption" } = payload;

  const systemPrompt = `You are Muse, Content Ideation Agent for the VitalLyfe Vantus by Cloud Scenic. 
Write ${fieldToUpdate === "script" ? "video scripts" : "captions"} for the VitalLyfe brand.
Brand voice: cinematic, calm, purposeful. Key phrases: abundance, access, built for beyond.
AVOID: revolutionary, game-changing, exclamation points.
Caption structure: poetic statement then blank line then expand metaphor then blank line then bridge to brand then blank line then soft CTA like "Join us (Link in bio)".
For scripts: Opening Scene, Middle, Closing Frame format.
Write real copy, not descriptions.`;

  const userPrompt = `Write a ${fieldToUpdate} for this content piece:
Title: "${itemTitle}"
Content Pillar: ${pillar}
Format: ${format}
Description: ${description}

Write only the ${fieldToUpdate} content, nothing else.`;

  const copy = await ai(systemPrompt, userPrompt, 600);

  // Save to Supabase
  await sbPatch("content_items", `id=eq.${itemId}`, { [fieldToUpdate]: copy });

  return {
    success: true,
    agent: "Muse",
    action: "muse_write_content",
    itemId,
    itemTitle,
    fieldUpdated: fieldToUpdate,
    content: copy,
    message: `✍️ ${fieldToUpdate === "script" ? "Script" : "Caption"} generated and saved to "${itemTitle}"`,
  };
}

async function overseer_scan() {
  const items = await sbGet("content_items", "?order=id");

  const SOP_STEPS = [
    "Step 01 — Discovery: Ideation & Concept Alignment",
    "Step 02 — Planning: Content Tracker Build & Approval",
    "Step 03 — Pre-Production: Footage Scouting via Art Grid",
    "Step 04 — Production: Content Development & Post-Production",
    "Step 05 — Review: Content Review & Client Approval",
    "Step 06 — Distribution: Content Scheduling Across All Platforms",
    "Step 07 — Final Sign-Off: Scheduler Review & Final Confirmation",
  ];

  const summary = items.map(i => `ID:${i.id} | "${i.title}" | Status:${i.status} | Pillar:${i.pillar} | Format:${i.format} | Caption:${i.caption ? "YES" : "NO"} | Script:${i.script ? "YES" : "NO"}`).join("\n");

  const systemPrompt = `You are Overseer, SOP Guardian for VitalLyfe Vantus. 
Enforce this 7-step SOP:
${SOP_STEPS.join("\n")}

Review the content pipeline and identify items that may be violating or skipping SOP steps.
Flag items that: are stuck in wrong stages, missing copy when needed, not following proper approval flow.
Be precise, cite step numbers, be rigorous but not alarmist. Return JSON array.`;

  const userPrompt = `Review this content pipeline (${items.length} items) and return a JSON array of flagged items:
${summary}

Return JSON array like: [{"itemId":"vl-X","title":"...","violation":"Step 02 — missing caption before copy approval","severity":"high|medium|low"}]
Return empty array [] if everything looks compliant. Only return the JSON array, nothing else.`;

  const rawResult = await ai(systemPrompt, userPrompt, 1000);

  let flagged = [];
  try {
    const jsonMatch = rawResult.match(/\[[\s\S]*\]/);
    flagged = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (e) {
    flagged = [];
  }

  return {
    success: true,
    agent: "Overseer",
    action: "overseer_scan",
    totalItems: items.length,
    flaggedCount: flagged.length,
    flagged,
    message: flagged.length === 0
      ? `✅ SOP compliance check complete — all ${items.length} items in order`
      : `🔍 SOP scan complete — ${flagged.length} item(s) flagged across ${items.length} total`,
  };
}

async function sean_briefing() {
  const items = await sbGet("content_items", "?order=id");

  const byStatus = {};
  for (const item of items) {
    const s = item.status || "Unknown";
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push(item.title);
  }

  const blocked = items.filter(i => ["Needs Revisions", "Need Copy Approval", "Need Content Approval"].includes(i.status));
  const readyToSchedule = items.filter(i => i.status === "Ready For Schedule");
  const scheduled = items.filter(i => i.status === "Scheduled");
  const inCreation = items.filter(i => ["Ready For Copy Creation", "Ready For Content Creation"].includes(i.status));

  const systemPrompt = `You are Sean, Commander Agent for the VitalLyfe Vantus by Cloud Scenic. 
You orchestrate all 7 agents and own the content pipeline. 
Personality: decisive, calm, short punchy sentences. Military precision. Lead with what matters most.`;

  const userPrompt = `Generate a morning briefing for the team. Here's the pipeline status:

Total items: ${items.length}
Ready For Schedule: ${readyToSchedule.length} items — ${readyToSchedule.map(i => i.title).join(", ") || "none"}
Blocked/Needs Attention: ${blocked.length} items — ${blocked.map(i => `"${i.title}" (${i.status})`).join(", ") || "none"}
In Creation: ${inCreation.length} items — ${inCreation.map(i => i.title).join(", ") || "none"}
Scheduled: ${scheduled.length} items going out

By status: ${Object.entries(byStatus).map(([s,t]) => `${s}: ${t.length}`).join(" | ")}

Write a tight morning briefing: priorities, what's blocked, what needs immediate action. Under 200 words. Lead with the most urgent item.`;

  const briefing = await ai(systemPrompt, userPrompt, 400);

  return {
    success: true,
    agent: "Sean",
    action: "sean_briefing",
    stats: {
      total: items.length,
      readyToSchedule: readyToSchedule.length,
      blocked: blocked.length,
      inCreation: inCreation.length,
      scheduled: scheduled.length,
    },
    briefing,
    message: `📋 Morning briefing ready — ${items.length} items in pipeline`,
  };
}

async function lacey_advance() {
  const readyItems = await sbGet("content_items", "?status=eq.Ready For Schedule");

  if (readyItems.length === 0) {
    return {
      success: true,
      agent: "Lacey",
      action: "lacey_advance",
      advancedCount: 0,
      items: [],
      message: "⚡ No items ready to advance — pipeline is clean",
    };
  }

  const advanced = [];
  for (const item of readyItems) {
    await sbPatch("content_items", `id=eq.${item.id}`, {
      status: "Scheduled",
      stage: "Scheduled",
    });
    advanced.push({ id: item.id, title: item.title });
  }

  return {
    success: true,
    agent: "Lacey",
    action: "lacey_advance",
    advancedCount: advanced.length,
    items: advanced,
    message: `⚡ Advanced ${advanced.length} item(s) from "Ready For Schedule" → "Scheduled": ${advanced.map(i => i.title).join(", ")}`,
  };
}

async function sam_health() {
  const items = await sbGet("content_items", "?order=id");

  const statusCounts = {};
  for (const item of items) {
    const s = item.status || "Unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  // Items that might be "stuck" (no caption and past copy creation stage)
  const missingCopy = items.filter(i =>
    ["Ready For Content Creation", "Need Content Approval", "Approved", "Ready For Schedule", "Scheduled"].includes(i.status)
    && !i.caption && i.format !== "Reel"
  );

  const missingScript = items.filter(i =>
    ["Ready For Content Creation", "Need Content Approval", "Approved", "Ready For Schedule", "Scheduled"].includes(i.status)
    && !i.script && i.format === "Reel"
  );

  const systemPrompt = `You are Sam, Monitor Agent for VitalLyfe Vantus. You watch system health, pipeline metrics, and flag anomalies. Methodical, data-driven, brief.`;

  const userPrompt = `Generate a pipeline health report:

Total items: ${items.length}
Status breakdown: ${Object.entries(statusCounts).map(([s,n]) => `${s}: ${n}`).join(" | ")}
Items missing captions (past copy stage): ${missingCopy.length}
Reels missing scripts (past copy stage): ${missingScript.length}

Give a concise health report with: overall score (0-100), key risks, recommended actions. Under 150 words.`;

  const report = await ai(systemPrompt, userPrompt, 300);

  return {
    success: true,
    agent: "Sam",
    action: "sam_health",
    metrics: {
      total: items.length,
      byStatus: statusCounts,
      missingCopy: missingCopy.length,
      missingScript: missingScript.length,
    },
    report,
    message: `💊 Health check complete — ${items.length} items analyzed`,
  };
}

// ─── SCRAPPY: TREND SCOUT ─────────────────────────────────────────────────────

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

async function scrappy_research(payload) {
  const { topic = "wellness hydration water technology" } = payload;

  if (!TAVILY_KEY) {
    return {
      success: false,
      agent: "Scrappy",
      action: "scrappy_research",
      message: "❌ TAVILY_API_KEY not configured — add it in Netlify environment variables",
    };
  }

  // ── Run parallel Tavily searches across key angles ──────────────────────
  const queries = [
    `${topic} trends 2025 2026`,
    `hydration wellness content marketing trends`,
    `water technology startup viral content`,
    `wellness lifestyle TikTok Instagram trends this month`,
    `clean water access innovation news`,
  ];

  const searchResults = await Promise.allSettled(
    queries.map(q => tavilySearch(q, "advanced", 6))
  );

  // ── Flatten and dedupe results ──────────────────────────────────────────
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
            content: result.content?.slice(0, 300),
            score: result.score,
          });
        }
      });
      // Also grab Tavily's AI answer if available
      if (r.value.answer) {
        allResults.push({ query: queries[i], title: "Tavily Answer", content: r.value.answer, score: 1, url: "" });
      }
    }
  });

  // Sort by relevance score
  allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  const topResults = allResults.slice(0, 25);

  const systemPrompt = `You are Scrappy, VitalLyfe's Trend Scout agent for Cloud Scenic's Vantus.
You scour the internet for content trends, viral topics, and fresh angles — then report back with gems for Muse to work with.

VitalLyfe context:
- Brand: wellness/hydration technology. Mission: abundance → access.
- Content pillars: Abundance, Access, Innovation, Startup Diaries, Tierra Bomba, Product Launch, Meet the Makers
- Target audience: health-conscious consumers, sustainability advocates, startup/innovation crowd, outdoor/travel lifestyle
- Platforms: Instagram (Reels/Carousels), TikTok, YouTube, X/Threads

Your job: Analyze the live internet data below (fresh Tavily search results). Extract trends, angles, hooks, and content opportunities VitalLyfe could own.
Be a scout, not an analyst — cut the fluff, surface the gems. Think like a creative director who just did deep research.

Return a structured JSON object:
{
  "trendPulse": "1-2 sentence read on where the conversation is right now",
  "topTrends": [
    {
      "trend": "trend name",
      "why": "why it matters for VitalLyfe specifically",
      "pillar": "which content pillar it maps to",
      "hookIdea": "one-line hook VitalLyfe could use",
      "heat": "🔥🔥🔥|🔥🔥|🔥"
    }
  ],
  "contentAngles": [
    { "angle": "fresh specific angle or idea", "format": "Reel|Carousel|Thread|Short", "platform": "IG|TT|YT|X", "urgency": "high|medium|low" }
  ],
  "competitorMoves": "what's working in the wellness/hydration space right now",
  "avoidZones": ["oversaturated or off-brand topics to skip"],
  "museHandoff": "direct brief to Muse — what to create this month based on this research"
}

Return ONLY the JSON object.`;

  const dataContext = `
TOPIC: ${topic}
LIVE SEARCH DATA (${topResults.length} results from Tavily):

${topResults.map((r, i) => `[${i + 1}] "${r.title}"
  Query: ${r.query}
  ${r.content || ""}
  ${r.url ? `Source: ${r.url}` : ""}`).join("\n\n")}
`;

  const rawResult = await ai(systemPrompt, `Analyze and generate research brief:\n${dataContext}`, 2000);

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

async function scrappy_muse_collab(payload) {
  // Phase 1: Scrappy researches
  const research = await scrappy_research(payload);
  if (!research.success || !research.report) {
    return { ...research, action: "scrappy_muse_collab", message: "❌ Research phase failed — collaboration aborted" };
  }

  const { report } = research;

  // Phase 2: Muse generates content ideas from the research
  const existingItems = await sbGet("content_items", "?order=id&limit=5");
  const existingTitles = existingItems.map(i => i.title).join(", ");

  const museSystemPrompt = `You are Muse, Content Ideation Agent for VitalLyfe by Cloud Scenic.
Scrappy has just completed live internet research and handed you a trend brief. Your job is to turn those trends into concrete, on-brand content pieces.

Brand voice: cinematic, calm, purposeful. Key phrases: abundance, access, built for beyond.
AVOID: revolutionary, game-changing, exclamation points, generic corporate content.
Caption structure: poetic statement → expand metaphor → bridge to brand → soft CTA "Join us (Link in bio)".

Existing content (don't repeat): ${existingTitles}

Return a JSON array of 6-8 fresh content ideas:
[
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
Return ONLY the JSON array.`;

  const musePrompt = `Scrappy's research findings for this month:

Trend Pulse: ${report.trendPulse}

Top Trends:
${(report.topTrends || []).map(t => `• [${t.pillar}] ${t.trend} — ${t.why}\n  Hook idea: "${t.hookIdea}"`).join("\n")}

Fresh Angles:
${(report.contentAngles || []).map(a => `• ${a.angle} (${a.format}, ${a.platform}, urgency: ${a.urgency})`).join("\n")}

Competitor Context: ${report.competitorMoves || "—"}

Your brief: ${report.museHandoff || "Generate 6-8 fresh content ideas based on these trends."}

Now create the content ideas.`;

  const rawMuse = await ai(museSystemPrompt, musePrompt, 2000);

  let contentIdeas = [];
  try {
    const jsonMatch = rawMuse.match(/\[[\s\S]*\]/);
    contentIdeas = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (e) { contentIdeas = []; }

  const highPriority = contentIdeas.filter(i => i.urgency === "high");

  return {
    success: true,
    agent: "Scrappy × Muse",
    action: "scrappy_muse_collab",
    trendPulse: report.trendPulse,
    dataPoints: research.dataPoints,
    contentIdeas,
    highPriorityCount: highPriority.length,
    message: `🕵️✍️ Scrappy × Muse collab complete — ${contentIdeas.length} fresh ideas generated from live internet research`,
    summary: contentIdeas.map(i =>
      `${i.urgency === "high" ? "🔥" : "·"} [${i.pillar}] "${i.title}" — ${i.format} for ${i.platform}\n   Angle: ${i.angle}`
    ).join("\n"),
  };
}

async function artgrid_scout(payload) {
  const { itemId } = payload;

  let items = await sbGet("content_items", "?order=id");

  if (itemId) {
    items = items.filter(i => i.id === itemId);
  } else {
    items = items.filter(i =>
      ["Reel", "YouTube", "Short"].includes(i.format) &&
      !["Scheduled", "Scrapped"].includes(i.status)
    );
  }

  if (items.length === 0) {
    return {
      success: true,
      agent: "Artgrid",
      action: "artgrid_scout",
      itemCount: 0,
      results: [],
      message: "✦ No video items currently need footage scouting — pipeline clear",
    };
  }

  // Lean prompt — just keywords, no essays
  const systemPrompt = `You are Artgrid, footage scout for VitalLyfe (wellness/hydration brand). 
For each video item, return 5 Artgrid.io search keywords that will find the best matching cinematic footage.
VitalLyfe aesthetic: cinematic, calm, water in motion, warm naturals, real human moments. No corporate, no fake smiles.
CRITICAL — Artgrid search only works with SHORT queries (2-4 words max). Long phrases return zero results.
GOOD: "slow motion water", "sunrise landscape", "woman walking nature", "water droplet macro"
BAD: "slow motion water droplet hitting calm surface golden hour" — too long, returns nothing.
Return ONLY a JSON array: [{ "itemId": "vl-X", "title": "...", "keywords": ["2-4 word term", "2-4 word term", "2-4 word term", "2-4 word term", "2-4 word term"] }]`;

  const itemList = items.map(i =>
    `ID: ${i.id} | "${i.title}" | Pillar: ${i.pillar} | Format: ${i.format}${i.description ? ` | ${i.description}` : ""}`
  ).join("\n");

  const rawResult = await ai(systemPrompt, itemList, 600);

  let results = [];
  try {
    const jsonMatch = rawResult.match(/\[[\s\S]*\]/);
    results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (e) {
    results = [];
  }

  return {
    success: true,
    agent: "Artgrid",
    action: "artgrid_scout",
    itemCount: items.length,
    results,
    message: `✦ Keywords ready — ${results.length} item(s) scouted`,
    summary: results.map(r =>
      `• "${r.title}"\n  → ${(r.keywords || []).join(" | ")}`
    ).join("\n"),
  };
}

async function muse_generate_calendar() {
  const items = await sbGet("content_items", "?order=id&limit=10");
  const pillars = ["Abundance", "Access", "Innovation", "Tierra Bomba", "Startup Diaries", "Product Launch", "Meet the Makers"];
  const existing = items.map(i => i.title).join(", ");

  const systemPrompt = `You are Muse, Content Ideation Agent for VitalLyfe Vantus by Cloud Scenic.
Generate content calendar ideas. Brand voice: cinematic, calm, purposeful.
Content pillars: ${pillars.join(", ")}.
Platforms: Instagram (Reels, Graphics, Carousels), TikTok (Reels), YouTube (Shorts, Long-form), X/Threads.
AVOID: revolutionary, game-changing, exclamation points, generic corporate content.

Return a JSON array of content items only (no markdown, no backticks):
[
  {
    "title": "cinematic content title",
    "pillar": "one of the 7 pillars",
    "format": "Reel|Carousel|Graphics (IMG)|Thread|Short|YouTube",
    "platforms": ["IG"],
    "platform": "instagram|tiktok|youtube",
    "type": "reel|carousel|graphic|thread|short|youtube",
    "campaign": "Drip Campaign",
    "status": "Ready For Copy Creation",
    "stage": "Ready For Copy Creation",
    "description": "one sentence description",
    "caption": "",
    "script": "",
    "cta": "Join us (Link in bio)",
    "seoKeywords": "",
    "hashtags": "#VitalLyfe",
    "startWeek": 1,
    "duration": 1,
    "notes": ""
  }
]
Generate 12-16 items covering all 7 pillars across 4 weeks. Vary formats and platforms. Return ONLY the JSON array.`;

  const rawResult = await ai(systemPrompt, `Existing content (don't repeat): ${existing}\n\nGenerate the 4-week calendar now.`, 2800);

  let calendarItems = [];
  try {
    const jsonMatch = rawResult.match(/\[[\s\S]*\]/);
    calendarItems = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch(e) { calendarItems = []; }

  return {
    success: true,
    agent: "Muse",
    action: "muse_generate_calendar",
    items: calendarItems,
    itemCount: calendarItems.length,
    message: `✍️ ${calendarItems.length}-piece content calendar generated — ${pillars.length} pillars covered`,
    preview: calendarItems.map(i => `• [${i.pillar}] "${i.title}" — ${i.format}`).join("\n"),
  };
}

async function muse_save_calendar(payload) {
  const { items } = payload;
  if (!items || items.length === 0) {
    return { success: false, agent: "Muse", action: "muse_save_calendar", message: "❌ No items to save" };
  }

  const toInsert = items.map((item, idx) => ({
    ...item,
    id: `vl-cal-${Date.now()}-${idx}`,
  }));

  const res = await fetch(`${REST}/content_items`, {
    method: "POST",
    headers: { ...SB_HEADERS(), Prefer: "return=minimal" },
    body: JSON.stringify(toInsert),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${errText}`);
  }

  return {
    success: true,
    agent: "Muse",
    action: "muse_save_calendar",
    savedCount: toInsert.length,
    message: `✍️ ${toInsert.length} calendar items saved to tracker — they're live now`,
  };
}

// ─── MUSE FROM BRIEF ─────────────────────────────────────────────────────────

async function muse_from_brief(payload) {
  const { reels = 8, stories = 4, campaign = "Drip Campaign" } = payload;
  // Trim brief to 3000 chars — PDFs can dump a lot of noise
  const brief = (payload.brief || "").trim().slice(0, 3000);
  if (!brief || brief.length < 10) {
    return { success: false, agent: "Muse", action: "muse_from_brief", message: "❌ Brief is too short — add more detail" };
  }

  const systemPrompt = `You are Muse, Content Ideation Agent for VitalLyfe by Cloud Scenic.
You read creative briefs and generate specific, production-ready content ideas.
Brand: VitalLyfe — wellness/hydration technology. Cinematic, calm, purposeful.
AVOID: people, faces, corporate setups, fake smiles, text overlays, logos.
FORMAT RULES:
- Reels: vertical video, 15-60s, Instagram/TikTok
- Stories: vertical, 15s max, Instagram Stories

Return ONLY a valid JSON array (no markdown, no backticks, no explanation):
[
  {
    "title": "short cinematic title",
    "pillar": "Access|Abundance|Innovation|Tierra Bomba|Startup Diaries|Product Launch|Meet the Makers",
    "format": "Reel|Stories",
    "platforms": ["IG"],
    "platform": "instagram",
    "type": "reel|story",
    "campaign": "${campaign}",
    "status": "Ready For Copy Creation",
    "stage": "Ready For Copy Creation",
    "description": "one sentence visual description — what we see on screen",
    "caption": "",
    "script": "",
    "notes": "director notes — location, lighting, shot type",
    "cta": "Join us (Link in bio)",
    "seoKeywords": "",
    "hashtags": "#VitalLyfe",
    "startWeek": 1,
    "duration": 1
  }
]`;

  const userPrompt = `Creative brief from the team:\n\n${brief}\n\nGenerate exactly ${reels} Reels and ${stories} Stories based on this brief. Total: ${reels + stories} items.`;

  const rawResult = await ai(systemPrompt, userPrompt, 3200);

  let items = [];
  try {
    const jsonMatch = rawResult.match(/\[[\s\S]*\]/);
    items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch(e) { items = []; }

  if (items.length === 0) {
    return { success: false, agent: "Muse", action: "muse_from_brief", message: "❌ Muse couldn't parse the brief — try rephrasing it" };
  }

  // Save directly to Supabase
  const toInsert = items.map((item, idx) => ({
    ...item,
    id: `vl-brief-${Date.now()}-${idx}`,
  }));

  const res = await fetch(`${REST}/content_items`, {
    method: "POST",
    headers: { ...SB_HEADERS(), Prefer: "return=minimal" },
    body: JSON.stringify(toInsert),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${errText}`);
  }

  const reelItems = items.filter(i => i.format === "Reel");
  const storyItems = items.filter(i => i.format === "Stories");

  return {
    success: true,
    agent: "Muse",
    action: "muse_from_brief",
    items,
    savedCount: toInsert.length,
    message: `✍️ Muse generated ${reelItems.length} Reels + ${storyItems.length} Stories from your brief — saved to tracker`,
    preview: items.map(i => `• [${i.format}] "${i.title}" — ${i.description}`).join("\n"),
  };
}

// ─── N8N WEBHOOK TRIGGER ──────────────────────────────────────────────────────

async function lacey_trigger_n8n(payload) {
  const {
    workflow = "general",
    data = {},
    message = "",
    triggeredBy = "Vantus",
  } = payload;

  if (!N8N_WEBHOOK_URL) throw new Error("N8N_WEBHOOK_URL not configured");

  const body = {
    workflow,
    triggeredBy,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };

  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  let responseData = {};
  try { responseData = JSON.parse(responseText); } catch {}

  if (!res.ok) throw new Error(`n8n webhook failed: ${res.status} ${responseText}`);

  return {
    success: true,
    agent: "Lacey",
    workflow,
    message: `✅ Triggered n8n workflow "${workflow}" successfully`,
    n8nResponse: responseData,
    timestamp: new Date().toISOString(),
  };
}

// ─── SCRAPPY: HOOK ANALYSIS ───────────────────────────────────────────────────
// NOTE: Requires cid_library table in Supabase with columns:
//   id (int8, primary key, auto-increment), type (text) — "hook"|"body"|"cta",
//   text (text), score (int4), platform (text), views (text), engagement (text),
//   why_it_works (text), vitallyfe_adaptation (text), created_at (timestamptz, default now())

async function scrappy_hook_analysis() {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const prompt = `You are Scrappy, a trend scout for VitalLyfe — a water technology company focused on hydration innovation, water access, and wellness.

Analyze the top 20 performing content pieces in the wellness/hydration space and identify the best performing hooks, body copy patterns, and CTAs.

Return ONLY valid JSON (no markdown) in this exact format:
{
  "hooks": [
    { "rank": 1, "text": "combined hook summary", "voice_hook": "exact words spoken in first 3 seconds", "text_hook": "ON-SCREEN TEXT IN CAPS", "platform": "TikTok", "views": "4.2M", "engagement": "11.4%", "why": "Sentence one about psychology. Sentence two about format. Sentence three about why it stops the scroll.", "adaptation": "VitalLyfe version of this hook" },
    { "rank": 2, "text": "combined hook summary", "voice_hook": "spoken hook text", "text_hook": "ON-SCREEN TEXT", "platform": "Instagram", "views": "2.1M", "engagement": "8.7%", "why": "Why it worked.", "adaptation": "VitalLyfe version" },
    { "rank": 3, "text": "combined hook summary", "voice_hook": "spoken hook text", "text_hook": "ON-SCREEN TEXT", "platform": "TikTok", "views": "1.8M", "engagement": "7.2%", "why": "Why it worked.", "adaptation": "VitalLyfe version" }
  ],
  "bodies": [
    { "rank": 1, "text": "body copy summary", "voice_body": "what they actually say in the body", "text_body": "KEY STAT OR TEXT SHOWN ON SCREEN", "platform": "Instagram", "views": "3.1M", "engagement": "9.2%", "why": "Why this body copy structure works in 2-3 sentences.", "adaptation": "VitalLyfe version" },
    { "rank": 2, "text": "body copy summary", "voice_body": "spoken body copy", "text_body": "ON-SCREEN TEXT", "platform": "TikTok", "views": "2.4M", "engagement": "8.1%", "why": "Why it worked.", "adaptation": "VitalLyfe version" },
    { "rank": 3, "text": "body copy summary", "voice_body": "spoken body copy", "text_body": "ON-SCREEN TEXT", "platform": "YouTube", "views": "1.2M", "engagement": "6.3%", "why": "Why it worked.", "adaptation": "VitalLyfe version" }
  ],
  "ctas": [
    { "rank": 1, "text": "CTA summary", "voice_cta": "what they say for the CTA", "text_cta": "ON-SCREEN CTA TEXT 👇", "platform": "TikTok", "views": "5.1M", "engagement": "12.1%", "why": "Why this CTA converts in 2-3 sentences.", "adaptation": "VitalLyfe version" },
    { "rank": 2, "text": "CTA summary", "voice_cta": "spoken CTA", "text_cta": "ON-SCREEN CTA", "platform": "Instagram", "views": "2.8M", "engagement": "9.4%", "why": "Why it worked.", "adaptation": "VitalLyfe version" },
    { "rank": 3, "text": "CTA summary", "voice_cta": "spoken CTA", "text_cta": "ON-SCREEN CTA", "platform": "Instagram", "views": "1.9M", "engagement": "7.8%", "why": "Why it worked.", "adaptation": "VitalLyfe version" }
  ],
  "message": "🎣 Hook analysis complete — top 3 hooks, body copy, and CTAs surfaced from 20 competitor posts"
}

Base your analysis on real patterns that perform well in wellness, hydration, water tech, and startup founder content. Make the VitalLyfe adaptations specific and immediately usable.`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
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
      ...(parsed.hooks || []).map(h => ({ type: "hook", text: h.text, score: 100 - (h.rank-1)*10, platform: h.platform, views: h.views, engagement: h.engagement, why_it_works: h.why, vitallyfe_adaptation: h.adaptation })),
      ...(parsed.bodies || []).map(b => ({ type: "body", text: b.text, score: 100 - (b.rank-1)*10, platform: b.platform, views: b.views, engagement: b.engagement, why_it_works: b.why, vitallyfe_adaptation: b.adaptation })),
      ...(parsed.ctas || []).map(c => ({ type: "cta", text: c.text, score: 100 - (c.rank-1)*10, platform: c.platform, views: c.views, engagement: c.engagement, why_it_works: c.why, vitallyfe_adaptation: c.adaptation })),
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

async function cid_build_brief(payload) {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const { title, hook, voiceHook, textHook, voiceBody, textBody, voiceCta, textCta, format, trigger, variation, platform } = payload;

  const prompt = `You are a creative director building a production brief for VitalLyfe — a water technology company focused on hydration innovation and water access.

Based on this winning competitor content analysis, build a complete production brief:

CONTENT CONCEPT: ${title}
FORMAT: ${format}
PLATFORM: ${platform}
HOOK (Voice): ${voiceHook || hook}
HOOK (Text on Screen): ${textHook || ''}
BODY (Voice): ${voiceBody || ''}
BODY (Text on Screen): ${textBody || ''}
CTA (Voice): ${voiceCta || ''}
CTA (Text on Screen): ${textCta || ''}
EMOTIONAL TRIGGER: ${trigger}
VITALLYFE VARIATION: ${variation}

Return ONLY valid JSON (no markdown):
{
  "title": "VitalLyfe version of the content title",
  "concept": "2-3 sentence creative concept",
  "format": "${format}",
  "platform": "${platform}",
  "duration": "e.g. 15-30 seconds",
  "vibe": "e.g. Raw + authentic, Cinematic + aspirational",
  "music": "Music direction — tempo, genre, energy level",
  "hook": {
    "voice": "Exact words to say in first 3 seconds",
    "screen_text": "ON-SCREEN TEXT IN CAPS",
    "timing": "e.g. 0-3 seconds"
  },
  "body": {
    "voice": "What to say in the body",
    "screen_text": "KEY TEXT OVERLAY",
    "broll": ["B-roll shot 1", "B-roll shot 2", "B-roll shot 3"],
    "timing": "e.g. 3-22 seconds"
  },
  "cta": {
    "voice": "Exact CTA words",
    "screen_text": "ON-SCREEN CTA",
    "timing": "e.g. 22-30 seconds"
  },
  "shot_list": ["Shot 1 description", "Shot 2 description", "Shot 3 description", "Shot 4 description"],
  "editing_notes": "Pacing, transitions, text animation style",
  "predicted_score": 85,
  "predicted_rationale": "Why this should perform well — 2 sentences"
}`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  const aiData = await aiRes.json();
  const raw = aiData.content?.[0]?.text || "{}";
  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch { throw new Error("Failed to parse brief JSON"); }

  return { success: true, agent: "CID", action: "cid_build_brief", brief: parsed, message: "📋 Production brief generated" };
}

// ─── CID: A/B VARIATIONS ──────────────────────────────────────────────────────

async function cid_ab_variations(payload) {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const { hook, trigger, variation, platform, format } = payload;

  const prompt = `You are a content strategist for VitalLyfe — a water technology company.

Based on this winning hook concept: "${hook}"
Trigger type: ${trigger}
Platform: ${platform}
Original VitalLyfe variation: "${variation}"

Generate 3 distinct A/B variations for VitalLyfe, each with a different angle. Rank them by predicted performance.

Return ONLY valid JSON:
{
  "variations": [
    {
      "rank": 1,
      "angle": "e.g. Data-driven",
      "voice_hook": "Exact spoken hook",
      "text_hook": "ON-SCREEN TEXT",
      "predicted_score": 91,
      "why": "Why this variation should perform best in 1-2 sentences"
    },
    {
      "rank": 2,
      "angle": "e.g. Emotional story",
      "voice_hook": "Exact spoken hook",
      "text_hook": "ON-SCREEN TEXT",
      "predicted_score": 84,
      "why": "Why this ranks second"
    },
    {
      "rank": 3,
      "angle": "e.g. Challenge/controversy",
      "voice_hook": "Exact spoken hook",
      "text_hook": "ON-SCREEN TEXT",
      "predicted_score": 78,
      "why": "Why this is the riskier but potentially high-reward option"
    }
  ]
}`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const aiData = await aiRes.json();
  const raw = aiData.content?.[0]?.text || "{}";
  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch { throw new Error("Failed to parse AB variations JSON"); }

  return { success: true, agent: "CID", action: "cid_ab_variations", variations: parsed.variations || [], message: "🎯 3 A/B variations generated" };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }
  if (!SERVICE_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not set" }) };
  }
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }) };
  }

  try {
    const { action, payload = {} } = JSON.parse(event.body || "{}");

    let result;
    switch (action) {
      case "muse_write_content":     result = await muse_write_content(payload); break;
      case "overseer_scan":          result = await overseer_scan(); break;
      case "sean_briefing":          result = await sean_briefing(); break;
      case "lacey_advance":          result = await lacey_advance(); break;
      case "sam_health":             result = await sam_health(); break;
      case "muse_from_brief":        result = await muse_from_brief(payload); break;
      case "muse_generate_calendar": result = await muse_generate_calendar(); break;
      case "muse_save_calendar":     result = await muse_save_calendar(payload); break;
      case "artgrid_scout":          result = await artgrid_scout(payload); break;
      case "scrappy_research":       result = await scrappy_research(payload); break;
      case "scrappy_muse_collab":    result = await scrappy_muse_collab(payload); break;
      case "scrappy_hook_analysis":  result = await scrappy_hook_analysis(); break;
      case "lacey_trigger_n8n":      result = await lacey_trigger_n8n(payload); break;
      case "cid_build_brief":        result = await cid_build_brief(payload); break;
      case "cid_ab_variations":      result = await cid_ab_variations(payload); break;
      default:
        return {
          statusCode: 400,
          headers: cors,
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }

    // Post to Slack
    const slackLabel = SLACK_AGENT_LABELS[action];
    if (slackLabel && result) {
      const msg = result.message || result.summary || result.briefing || result.report || result.trends || `✅ ${action} completed`;
      await postToSlack(slackLabel, msg);
    }

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("agent-action error:", err);
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
