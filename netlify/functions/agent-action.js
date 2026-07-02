// agent-action.js — Vantus Agent Action Engine
// Handles autonomous agent actions: read/write Supabase, AI generation.
// Per-client brand voice loaded from clients.brand_voice_md at request time (Move 1).
//
// Requires a valid @cloudscenic.com admin OR approved client_users session
// (Authorization: Bearer <access_token>).

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");

// 60/min is generous for normal Vantus usage (humans clicking agent action buttons
// rarely exceed ~5/min). The cap exists to bound per-user Anthropic spend if a
// token leaks or a client loops on errors.
const AGENT_ACTION_RATE_LIMIT_MAX = 60;
const AGENT_ACTION_RATE_LIMIT_WINDOW_MS = 60_000;

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
  muse_generate_calendar: "✍️ *Muse* — Content Calendar",
  muse_save_calendar:     "✍️ *Muse* — Calendar Saved",
  muse_write_content:     "✍️ *Muse* — Content Written",
  scrappy_research:       "📡 *Scrappy* — Trend Research",
  scrappy_muse_collab:    "📡 *Scrappy* × *Muse* — Collab",
  muse_ig_ideas:          "✍️ *Muse* — 5 Instagram Ideas",
};

const SB_HEADERS = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

// ── agent_events logging ──
// Every handler invocation writes one row so we have real history of what
// agents actually did (replaces fake ACTIVITY_POOL theater).
const AGENT_PREFIX_MAP = {
  muse: "Muse", sean: "Sean",
  scrappy: "Scrappy",
  cid: "Scrappy",  // CID actions are Scrappy's domain
};
function deriveAgentName(actionKey) {
  const prefix = (actionKey || "").split("_")[0];
  return AGENT_PREFIX_MAP[prefix] || "Unknown";
}
function deriveContentItemId(payload, result) {
  return (
    payload?.id ||
    payload?.itemId ||
    payload?.contentItemId ||
    result?.id ||
    result?.item?.id ||
    null
  );
}
function deriveSummary(result, action) {
  if (!result) return `${action} returned no result`;
  const s = result.message || result.summary || result.briefing || result.report || result.trends || `${action} completed`;
  return String(s).slice(0, 500);
}
async function logAgentEvent({ agent_name, action_key, payload, result_status, result_summary, content_item_id, client_id }) {
  try {
    await fetch(`${REST}/agent_events`, {
      method: "POST",
      headers: SB_HEADERS(),
      body: JSON.stringify({
        agent_name,
        action_key,
        content_item_id,
        client_id,
        payload,
        result_status,
        result_summary,
      }),
    });
  } catch (e) {
    console.warn("[agent_events] log failed:", e.message);
  }
}

const REST = `${SUPABASE_URL}/rest/v1`;

async function sbGet(table, params = "") {
  const res = await fetch(`${REST}/${table}${params}`, { headers: SB_HEADERS() });
  if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Move 1 — read client's brand voice from DB instead of hardcoding it inline.
// Falls back to a generic context if client_id is missing or brand_voice_md is empty,
// so prompts still work for orphaned requests (e.g. before a client is selected).
//
// Pillars are parsed from brand_voice_md if present (look for a "Pillars:" line or
// a "## Pillars" / "### Pillars" markdown block). Otherwise empty — handlers
// instruct Claude to derive them from the voice text directly.
function parsePillars(voiceMd) {
  if (!voiceMd) return [];
  // 1) Try "Pillars: a, b, c" or "Content pillars: a, b, c" inline form
  const inline = voiceMd.match(/(?:content\s+)?pillars?:\s*([^\n]+)/i);
  if (inline) {
    return inline[1].split(/[,|·•]/).map(s => s.trim()).filter(Boolean).slice(0, 12);
  }
  // 2) Try "## Pillars" or "### Pillars" block — collect bullets until next header
  const block = voiceMd.match(/#{2,3}\s*pillars?\s*\n([\s\S]*?)(?:\n#{1,3}|\n*$)/i);
  if (block) {
    return block[1].split("\n").map(line => line.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean).slice(0, 12);
  }
  return [];
}

async function getBrandContext(client_id) {
  const fallback = { name: "the brand", slug: null, voice: "", pillars: [], clientId: null };
  if (!client_id) return fallback;
  try {
    const rows = await sbGet("clients", `?id=eq.${client_id}&select=name,slug,brand_voice_md,brand_pillars,brand_dos,brand_donts`);
    const r = rows?.[0];
    if (!r) return { ...fallback, clientId: client_id };
    const voiceMd = r.brand_voice_md || "";
    // Prefer the structured Brand Manager fields; fall back to parsing the markdown.
    const pillars = (Array.isArray(r.brand_pillars) && r.brand_pillars.length) ? r.brand_pillars : parsePillars(voiceMd);
    const dos = Array.isArray(r.brand_dos) ? r.brand_dos : [];
    const donts = Array.isArray(r.brand_donts) ? r.brand_donts : [];
    // Compose structured guidelines so EVERY prompt that injects `voice` respects them.
    let guide = "";
    if (pillars.length) guide += `\nContent pillars: ${pillars.join(", ")}.`;
    if (dos.length) guide += `\nAlways: ${dos.join("; ")}.`;
    if (donts.length) guide += `\nNever: ${donts.join("; ")}.`;
    return {
      name: r.name || "the brand",
      slug: r.slug || null,
      voice: voiceMd + (guide ? `\n\nBrand guidelines:${guide}` : ""),
      pillars, dos, donts,
      clientId: client_id,
    };
  } catch (e) {
    console.warn("[brand] getBrandContext failed:", e.message);
    return { ...fallback, clientId: client_id };
  }
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

async function ai(system, user, maxTokens = 1200, model = "claude-haiku-4-5-20251001") {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const d = await res.json();
  if (!res.ok) {
    // Full diagnostic so the agent_events row tells us what's wrong
    throw new Error(`Anthropic ${res.status} ${d.error?.type || ""}: ${d.error?.message || JSON.stringify(d).slice(0, 300)}`);
  }
  return d.content?.[0]?.text || "";
}

// ─── ACTION HANDLERS ──────────────────────────────────────────────────────────

async function muse_write_content(payload, brand) {
  const { itemId, itemTitle, pillar, format, description, fieldToUpdate = "caption" } = payload;

  const systemPrompt = `You are Muse, Content Ideation Agent for ${brand.name} via Cloud Scenic Vantus.
Write ${fieldToUpdate === "script" ? "video scripts" : "captions"} for the ${brand.name} brand.

${brand.voice}

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

async function sean_briefing(brand) {
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

  const systemPrompt = `You are Sean, Commander Agent for ${brand.name} via Cloud Scenic Vantus.
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

async function muse_generate_calendar(brand) {
  const items = await sbGet("content_items", "?order=id&limit=10");
  const pillars = brand.pillars && brand.pillars.length ? brand.pillars : [];
  const existing = items.map(i => i.title).join(", ");
  const brandHashtag = "#" + (brand.name || "").replace(/\s+/g, "");
  const pillarLine = pillars.length
    ? `Content pillars: ${pillars.join(", ")}.`
    : `Content pillars: derive 5-7 pillars from the brand voice above and use them consistently across the calendar.`;
  const pillarConstraint = pillars.length
    ? `one of: ${pillars.join(" | ")}`
    : `derive from the brand voice`;

  const systemPrompt = `You are Muse, Content Ideation Agent for ${brand.name}.
Generate content calendar ideas.

${brand.voice || "(No brand voice configured — keep tone neutral and on-trend.)"}

${pillarLine}
Platforms: Instagram (Reels, Graphics, Carousels), TikTok (Reels), YouTube (Shorts, Long-form), X/Threads.

Return a JSON array of content items only (no markdown, no backticks):
[
  {
    "title": "evocative content title",
    "pillar": "${pillarConstraint}",
    "format": "Reel|Carousel|Graphics (IMG)|Thread|Short|YouTube",
    "platforms": ["IG"],
    "platform": "instagram|tiktok|youtube",
    "type": "reel|carousel|graphic|thread|short|youtube",
    "campaign": "",
    "status": "Ready For Copy Creation",
    "stage": "Ready For Copy Creation",
    "description": "one sentence description",
    "caption": "",
    "script": "",
    "cta": "",
    "seoKeywords": "",
    "hashtags": "${brandHashtag}",
    "startWeek": 1,
    "duration": 1,
    "notes": ""
  }
]
Generate 12-16 items across 4 weeks, covering all pillars evenly. Vary formats and platforms. Return ONLY the JSON array.`;

  const rawResult = await ai(systemPrompt, `Existing content (don't repeat): ${existing}\n\nGenerate the 4-week calendar now.`, 2400);

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
    message: `✍️ ${calendarItems.length}-piece content calendar generated`,
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

async function muse_from_brief(payload, brand) {
  const { reels = 8, stories = 4, campaign = "Drip Campaign" } = payload;
  // Trim brief to 3000 chars — PDFs can dump a lot of noise
  const brief = (payload.brief || "").trim().slice(0, 3000);
  if (!brief || brief.length < 10) {
    return { success: false, agent: "Muse", action: "muse_from_brief", message: "❌ Brief is too short — add more detail" };
  }
  const brandHashtag = "#" + (brand.name || "").replace(/\s+/g, "");

  const systemPrompt = `You are Muse, Content Ideation Agent for ${brand.name} via Cloud Scenic Vantus.
You read creative briefs and generate specific, production-ready content ideas.

${brand.voice}

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
    "hashtags": "${brandHashtag}",
    "startWeek": 1,
    "duration": 1
  }
]`;

  const userPrompt = `Creative brief from the team:\n\n${brief}\n\nGenerate exactly ${reels} Reels and ${stories} Stories based on this brief. Total: ${reels + stories} items.`;

  const rawResult = await ai(systemPrompt, userPrompt, 2600);

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

// ─── SCRAPPY: HOOK ANALYSIS ───────────────────────────────────────────────────
// NOTE: Requires cid_library table in Supabase with columns:
//   id (int8, primary key, auto-increment), type (text) — "hook"|"body"|"cta",
//   text (text), score (int4), platform (text), views (text), engagement (text),
//   why_it_works (text), client_adaptation (text), created_at (timestamptz, default now())
// (Column renamed from vitallyfe_adaptation in Fix #3.1 migration 20260526.)

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

async function cid_build_brief(payload, brand) {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const { title, hook, voiceHook, textHook, voiceBody, textBody, voiceCta, textCta, format, trigger, variation, platform } = payload;

  const prompt = `You are a creative director building a production brief for ${brand.name} via Cloud Scenic Vantus.

${brand.name} brand context:
${brand.voice || "(No brand voice configured — work from the competitor analysis alone.)"}

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
${brand.name.toUpperCase()} VARIATION: ${variation}

Return ONLY valid JSON (no markdown):
{
  "title": "${brand.name} version of the content title",
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
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1300, messages: [{ role: "user", content: prompt }] }),
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

async function cid_ab_variations(payload, brand) {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const { hook, trigger, variation, platform, format } = payload;

  const prompt = `You are a content strategist for ${brand.name} via Cloud Scenic Vantus.

${brand.name} brand context:
${brand.voice || "(No brand voice configured — focus on platform performance and hook mechanics.)"}

Based on this winning hook concept: "${hook}"
Trigger type: ${trigger}
Platform: ${platform}
Original ${brand.name} variation: "${variation}"

Generate 3 distinct A/B variations for ${brand.name}, each with a different angle. Rank them by predicted performance.

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
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
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

async function muse_ig_ideas(payload = {}, brand) {
  const { campaign = "", inspiration = "" } = payload;
  const insp = String(inspiration || "").trim();
  const pillars = brand.pillars && brand.pillars.length ? brand.pillars : [];

  const [existing, synced, researchDigest] = await Promise.all([
    sbGet("content_items", "?platform=eq.instagram&order=id.desc&limit=40"),
    getSyncedDigest("instagram", 8),
    _researchDigest(insp),
  ]);
  const existingTitles = existing.map(i => i.title).join(", ");

  const brandHashtag = "#" + (brand.name || "").replace(/\s+/g, "");
  const pillarLine = pillars.length
    ? `Content pillars: ${pillars.join(", ")}.`
    : `Content pillars: derive 3-5 from the brand voice above and use them consistently.`;
  const pillarConstraint = pillars.length
    ? `one of: ${pillars.join(" | ")}`
    : `derive from the brand voice`;

  const systemPrompt = `You are Muse, an elite short-form content strategist for ${brand.name} — the kind a top creator pays $10k/mo for. Sharp, specific, scroll-stopping ideas only. Never safe filler.
Generate exactly 5 Instagram content ideas.

NON-NEGOTIABLE — zero generic AI slop. BANNED words/shapes: "unlock", "game-changer", "dive in/into", "in today's world", "elevate", "supercharge", "the secret to", "level up", and any vague aspirational theme. Every idea must be a SPECIFIC, opinionated concept with a concrete detail only a real operator inside this business would think of. If an idea could be posted by literally any brand, it is a FAILURE — rewrite it until it's unmistakably ${brand.name}.

TONAL REFERENCE ONLY (flavor — do NOT let this make ideas safe, generic, or less bold):
${brand.voice || "(no voice set — be sharp, current, a little contrarian)"}

${pillarLine}
Instagram formats: Reel, Carousel, Graphics (IMG).
${synced ? `
PRIMARY SOURCE — @${synced.handle || "this account"}'s REAL top-performing posts, highest engagement first (${synced.sampleSize} synced posts analyzed):
${synced.digest}

These are what demonstrably work on THIS account. Each of your 5 ideas MUST be modeled on a specific post above — same hook mechanic and format — applied to a DIFFERENT but equally CONCRETE moment (never a duplicate).

BE SPECIFIC, NOT GENERIC. The reason these posts win is concreteness: "Super Full Time" is a real milestone, "the proposal's 'high'" is a real sales moment, "THE SOUND" is one exact craft detail. Every idea must contain a real, particular detail — an actual number, a named role ("the editor at 2am", "the PM during a reshoot"), a specific agency scenario, a real dollar figure or deadline. A title that could belong to ANY agency is a FAILURE — rewrite it until it could only be a Cloud Scenic post. No vague, aspirational, or theme-level concepts.

The brand voice above governs TONE only: do NOT force in off-account topics that don't appear in these posts. In each idea's "notes", name the exact post it's modeled on, e.g. "models #2 — the 'Super Full Time' milestone hook".` : `
(No synced account data yet — generate on brand voice + pillars alone.)`}

AMBITION — these should feel like scroll-stopping creator content, not safe brand posts. ${insp
  ? `Channel the content DNA and hook ambition of: ${insp}. Use the viral structures they are known for — big specific results/numbers, contrarian truths, give-away-the-playbook value, framework/listicle drops, bold curiosity gaps — adapted to Cloud Scenic's voice and grounded in our winning hooks above.${researchDigest ? `\n\nLIVE RESEARCH on ${insp} (fresh web results — mine these for CURRENT, real hooks/formats/angles; adapt them to Cloud Scenic, do not copy verbatim):\n${researchDigest}` : ""}`
  : `Aim for the ambition of top creator-economy content (e.g. Alex Hormozi: big specific numbers, contrarian truths, give-away value, frameworks) — adapted to Cloud Scenic, never generic or safe.`}

VARIETY — the 5 ideas must be DISTINCT from each other AND different from everything in the "existing content" list below. Skip the safe/obvious version of each hook and spread across the pillars.

Return a JSON array of exactly 5 items only (no markdown, no backticks):
[
  {
    "title": "evocative content title",
    "pillar": "${pillarConstraint}",
    "format": "Reel|Carousel|Graphics (IMG)",
    "platform": "instagram",
    "type": "reel|carousel|graphic",
    "campaign": "${campaign}",
    "status": "Ready For Copy Creation",
    "stage": "Ready For Copy Creation",
    "description": ${synced ? `"ONE sentence that names the specific top post this idea is modeled on (quote its hook + its ER%) then the fresh angle — e.g. \\"Models your 14.2% ER 'POV: you find THE SOUND' post: same satisfying-reveal POV, applied to the color grade.\\""` : `"one sentence visual description"`},
    "caption": "",
    "script": "a tight short-form script — a scroll-stopping HOOK line, then 2-3 body beats, then a CTA. Write real spoken/on-screen lines, not a description.",
    "cta": "",
    "seoKeywords": "",
    "hashtags": "${brandHashtag}",
    "platforms": ["IG"],
    "startWeek": 1,
    "duration": 1,
    "notes": ""
  }
]
Return ONLY the JSON array. Vary the 5 ideas across different pillars and formats.`;

  const userMsg = `Existing IG content (don't repeat): ${existingTitles}\n\n${synced ? "Generate 5 fresh Instagram ideas grounded in the account's top performers above, each with a real short-form script." : "Generate 5 fresh Instagram ideas now, each with a real short-form script."}`;
  const rawResult = await ai(systemPrompt, userMsg, 2600, "claude-sonnet-4-6");

  let ideas = [];
  try {
    const jsonMatch = rawResult.match(/\[[\s\S]*\]/);
    ideas = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch(e) { ideas = []; }

  if (ideas.length === 0) {
    return { success: false, agent: "Muse", action: "muse_ig_ideas", message: "❌ Muse couldn't generate ideas — try again" };
  }

  // Save to Supabase — map to real content_items columns (snake_case) and
  // whitelist; the model emits a few camelCase keys (seoKeywords, startWeek)
  // and extra fields that aren't columns, which would 400 the whole batch.
  const slug = brand.slug || "ig";
  const toInsert = ideas.map((item, idx) => ({
    id: `${slug}-ig-${Date.now()}-${idx}`,
    title: item.title || "Untitled",
    description: item.description || "",
    campaign: item.campaign || campaign || "",
    platform: "instagram",
    type: item.type || "reel",
    format: item.format || "",
    stage: item.stage || "Ready For Copy Creation",
    status: item.status || "Ready For Copy Creation",
    pillar: item.pillar || "",
    platforms: Array.isArray(item.platforms) ? item.platforms : ["IG"],
    script: item.script || "",
    caption: item.caption || "",
    cta: item.cta || "",
    hashtags: item.hashtags || brandHashtag,
    seo_keywords: item.seoKeywords || item.seo_keywords || "",
    notes: item.notes || "",
    start_week: Number(item.startWeek || item.start_week || 1),
    duration: Number(item.duration || 1),
    ...(brand.clientId ? { client_id: brand.clientId } : {}),
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
    action: "muse_ig_ideas",
    ideas,
    count: ideas.length,
    grounded: !!synced,
    message: synced
      ? `✍️ ${ideas.length} Instagram ideas generated — grounded in your ${synced.sampleSize} synced posts — and added to Content Tracker`
      : `✍️ ${ideas.length} Instagram ideas generated and added to Content Tracker`,
    preview: ideas.map(i => `• [${i.pillar}] "${i.title}" — ${i.format}`).join("\n"),
  };
}

// ── Idea Engine ───────────────────────────────────────────────────────────────
// Two-stage so Opus never blows the 26s timeout: muse_idea_list returns compact
// tiles (fast, small output); muse_film_brief expands ONE tile into a full,
// shootable breakdown on demand when the user opens it.
const SLOP = `zero generic AI slop. BANNED words/shapes: "unlock", "game-changer", "dive in/into", "in today's world", "elevate", "supercharge", "the secret to", "level up", any vague aspirational theme. Every concept must be SPECIFIC and opinionated with a concrete detail only a real operator inside this business would think of — if it could be posted by any brand, it's a FAILURE.`;
const VOICE_RULES = `WRITE LIKE A HUMAN, NOT AN AI. A real operator typed this fast — specific, a little rough, personality on. HARD BANS on AI cadence (these read as AI even with the right words): no em-dash-balanced sentences, no "it's not just X, it's Y", no "here's the thing"/"the truth is"/"let's be honest", no rule-of-three lists, no hype adjectives (incredible/powerful/seamless/effortless), no "imagine if", no perfectly parallel clauses, no wrapping every thought in a neat bow. Short punchy lines. Plain real words. Start mid-thought sometimes. If a line sounds like a LinkedIn post or a polished brand caption, rewrite it dirtier, blunter, and more specific.`;

// THE WINNING FORMULA — distilled from the proven personal-brand / info-business
// viral playbook. This is the DEFAULT engine for every idea; naming a creator is
// optional enrichment, not required. Apply all of it.
const WINNING_FORMULA = `THE WINNING FORMULA — apply this to EVERY idea by default (it's how top personal-brand / info-business content actually wins; no creator needs to be named):
1. HOOK on a psychological lever — a curiosity gap, a contrarian truth, a big specific claim, or a direct callout that stops the scroll in the first 1-2 seconds.
2. CONCRETE SPECIFICS over adjectives — real numbers, real timeframes, real names ("$57K in 14 days", "117 clients", "$180k week"). Specificity is what makes it believable.
3. PROOF / RECEIPTS — show don't tell: Stripe notifications, revenue charts, follower spikes, DM screenshots, view counts, app notifications. Especially when selling.
4. BELIEF SHIFT — reframe how the viewer thinks, challenge an assumption they hold, teach the ONE thing. Make them feel they've been doing it wrong.
5. VULNERABILITY → AUTHORITY — admit the grind, the failure, the 16-hour days. Trust is earned through honesty, not flexing alone.
6. IDENTITY / STATUS — make the viewer want to be the kind of person who gets this; name their exact situation so they feel seen.
7. PAYOFF — land on a curiosity question or a call to reflection, never a salesy pitch. The tension shouldn't fully resolve until the end.
Never sound like an ad, a brand, or AI. Concrete, bold, human.`;

async function _researchDigest(insp) {
  if (!insp || !TAVILY_KEY) return "";
  try {
    const qs = [`${insp} best viral short-form video hooks and formats 2026`, `${insp} most viral content ideas and angles this year`];
    const results = await Promise.allSettled(qs.map(q => tavilySearch(q, "basic", 4)));
    const lines = [];
    results.forEach(r => {
      if (r.status === "fulfilled" && r.value) {
        if (r.value.answer) lines.push("• " + String(r.value.answer).slice(0, 400));
        (r.value.results || []).slice(0, 4).forEach(x => lines.push(`• ${x.title}: ${String(x.content || "").slice(0, 160)}`));
      }
    });
    return lines.slice(0, 12).join("\n");
  } catch (e) { return ""; }
}

const FUNNEL = {
  TOF: "TOP OF FUNNEL — a cold stranger who's never heard of this brand. Goal: reach, attention, a new follow. SELL NOTHING. Lean on curiosity gap, contrarian truth, relatable callout, status/identity. Broad, entertaining, or genuinely useful — make a stranger stop and feel seen.",
  MOF: "MIDDLE OF FUNNEL — a warm viewer who's aware but not convinced. Goal: nurture trust, build belief, position authority. Lean on transformation/before→after, vulnerability→authority, teach the 'how', show the process and receipts. Earn the relationship; pitch nothing directly.",
  BOF: "BOTTOM OF FUNNEL — a hot viewer ready to act (or a retargeted one). Goal: convert. Lean on proof/testimonials, objection-handling, loss aversion, a concrete outcome, and a confident CTA. Sell through proof and outcomes — never salesy hype.",
};
const CONTENT_TYPE = {
  "Story Sequence": "FORMAT — an Instagram STORY (a single vertical frame, sometimes 2-3 in a row). NOT a video. It is a real or aspirational photo background with LAYERED TEXT and PROOF stacked on top, read top-to-bottom. Two flavors: (1) value-essay — a behind-the-scenes photo (desk/gym/studio) with a stack of short belief/reframe text boxes building hook → reframe → a payoff or curiosity question; (2) proof/flex — a bold headline with a HUGE specific number ('$57K in 14 days', '117+ clients', '$180k week') over a lifestyle shot, layered with real RECEIPTS: Stripe revenue notifications, revenue charts, follower-spike or DM screenshots, view counts, app notification screenshots ('new client $3,000/mo, $36K ARR'). Other real elements: feature/benefit bullet lists for product stories, an embedded video clip or a meme image as the background, and raw vulnerability/mission copy for MOF ('it hurts me to see people try without success'). Always concrete numbers over adjectives. Use the value-essay flavor for TOF/MOF and the proof/flex flavor for BOF.",
  "Carousel": "FORMAT — a CAROUSEL: slide 1 is the hook, each slide advances the idea with one beat, the last slide lands the point or CTA.",
  "Reel/Video": "FORMAT — a REEL / short VIDEO: hook in the first 3 seconds, fast beats, one clean payoff.",
};

async function muse_idea_list(payload = {}, brand) {
  const insp = String(payload.inspiration || "").trim();
  const funnel = String(payload.funnelStage || "TOF").toUpperCase();
  const contentType = String(payload.contentType || "Reel/Video").trim();
  const userIdea = String(payload.userIdea || "").trim();
  const funnelLine = FUNNEL[funnel] || FUNNEL.TOF;
  const ctLine = CONTENT_TYPE[contentType] || CONTENT_TYPE["Reel/Video"];
  const [synced, research] = await Promise.all([getSyncedDigest("instagram", 8), _researchDigest(insp)]);
  const nicheLine = brand.voice ? `Niche/context: ${String(brand.voice).slice(0, 220).replace(/\s+/g, " ")}…` : `Niche: ${brand.name}.`;

  const funnelIntent = { TOF: "a cold stranger who's never heard of them — earn attention and a follow, sell nothing", MOF: "a warm viewer deciding whether to trust them — build belief and authority", BOF: "a ready-to-act viewer — convert with proof and outcomes, never salesy" }[funnel] || "earn attention";

  const system = `You're the most in-demand short-form content strategist alive — the one top creators DM at 2am. You think in scroll-stopping, genuinely valuable ideas. Never templates, never filler, never AI-sounding. When someone reads one of your ideas they think "damn, I have to make that."

You're ideating ${contentType} content for ${brand.name}${brand.voice ? `, ${nicheLine}` : ""}.
Stage: ${funnel} — talking to ${funnelIntent}.
${userIdea
  ? `The operator already has a raw idea and wants to RUN with it: "${userIdea}". Do NOT replace it, water it down, or wrap it in a template. Make it great — give 6 distinct, ambitious ways to execute THIS exact idea, each a sharper angle or entry point.`
  : `Give 6 distinct, ambitious ideas — different angles, no two alike.`}

What separates a great idea here from a generic one: a hook that stops the scroll in the first 2 seconds, one real specific detail (a number, a moment, a name — never vague), and a genuine insight or tension the audience actually feels. Teach them something they didn't expect or make them feel something real. If an idea could've come from any brand or any AI, it's a miss — make each one unmistakably this person and genuinely worth posting.
${synced ? `\nTheir real top posts (this is the voice + what their audience already rewards — match the energy, don't copy):\n${synced.digest}\n` : ""}${research ? `\nCurrent patterns worth riffing on (take the mechanic, not the words):\n${research}\n` : ""}
Return ONLY a JSON array of 6 (no markdown, no commentary). Keep each tile SHORT — the depth comes later when they open it:
[{
  "title":"short name, 3-6 words",
  "hook":"the literal first line / first 3 seconds — word for word, exactly what's said or on screen",
  "angle":"ONE tight sentence: what the piece is and why it's worth watching",
  "format":"${contentType}"
}]
Make the 6 genuinely different and genuinely good. Go.`;

  const raw = await ai(system, userIdea ? `Make their idea great — 6 tight, ambitious executions (hook + ~2 sentence angle each, no more). Go.` : `6 ideas. Bold, specific, unmistakable. Hook + 2 tight sentences each. Go.`, 1100, "claude-sonnet-4-6");
  let ideas = [];
  try { const m = raw.match(/\[[\s\S]*\]/); ideas = m ? JSON.parse(m[0]) : []; } catch (e) { ideas = []; }
  if (!ideas.length) return { success: false, agent: "Muse", action: "muse_idea_list", message: "❌ Muse couldn't generate concepts — try again" };
  ideas = ideas.map((i, idx) => ({ idx, ...i }));
  return {
    success: true, agent: "Muse", action: "muse_idea_list", ideas, count: ideas.length, grounded: !!synced,
    message: synced ? `🎬 ${ideas.length} concepts generated — grounded in your ${synced.sampleSize} synced posts` : `🎬 ${ideas.length} concepts generated`,
  };
}

async function muse_film_brief(payload = {}, brand) {
  const title = String(payload.title || "").trim();
  const concept = String(payload.concept || payload.angle || "").trim();
  const hook = String(payload.hook || "").trim();
  const lever = String(payload.lever || "").trim();
  const format = String(payload.format || "Reel").trim();
  const pillar = String(payload.pillar || "").trim();
  const funnel = String(payload.funnelStage || "").toUpperCase();
  if (!title) return { success: false, agent: "Muse", action: "muse_film_brief", message: "No concept provided" };
  const synced = await getSyncedDigest("instagram", 8);
  const structHint = /story/i.test(format)
    ? `This is an Instagram STORY (a single layered frame, not a video). Each shotBreakdown entry is one LAYERED ELEMENT stacked top-to-bottom: set "time" to a label like "Background", "Headline", "Line 2", "Proof", "Payoff". "shot" = what the element is and where it sits (e.g. "behind-the-scenes desk photo as the background", "bold headline top third, the big number in accent color", "Stripe revenue notification screenshot mid-frame", "follower-spike screenshot"). "script" = the EXACT copy/text in that element with real specific numbers. "overlay" = the proof detail or '-'. Use 6-10 elements. Open on a hook headline; for BOF lean hard on real receipts (Stripe/charts/follows/DMs/view counts). "setting" = the background photo; "talent" = who/what is in it.`
    : /carousel/i.test(format)
    ? `Each shotBreakdown entry is a SLIDE: set "time" to "Slide 1", "Slide 2", … "shot" = the visual, "script" = the slide copy, "overlay" = headline or '-'.`
    : `Each shotBreakdown entry is a timestamped beat: set "time" to "0:00 — …", "0:03 — …" (5-7 beats). "shot" = camera/blocking, "script" = the line, "overlay" = on-screen text or '-'.`;

  const funnelIntent = { TOF: "a cold stranger — earn attention, sell nothing", MOF: "a warm viewer building trust in them", BOF: "a ready-to-act viewer — proof and outcomes, never salesy" };

  const system = `You're a world-class short-form director and writer — the one creators trust to turn a raw idea into something they can shoot today. You write real, specific, human lines. Never templates, never AI-sounding filler, never a pitch.

Turn the one idea below into a complete, shootable ${format} brief for ${brand.name}. Open on the hook and don't let the tension resolve until the payoff. Every line should be a real line they could actually say or put on screen — concrete details, real numbers, the kind of thing that's genuinely worth posting.
${synced && synced.voiceSamples ? `\nMatch this person's actual voice — real lines from their posts (mirror the energy, don't copy):\n${synced.voiceSamples}\n` : ""}${funnel && funnelIntent[funnel] ? `Stage: ${funnel} — talking to ${funnelIntent[funnel]}.\n` : ""}
${structHint}

Return ONLY JSON (no markdown):
{
  "title": "${title.replace(/"/g, "'")}",
  "filmLabel": "short label e.g. FILM 1",
  "concept": "2-3 sentences: what it is and the feeling it creates",
  "message": "the single core message, one line",
  "setting": "where it's shot — specific",
  "talent": "who's on camera and the energy they bring",
  "shotBreakdown": [ {"time":"...","shot":"...","script":"the exact line","overlay":"on-screen text or '-'"} ],
  "script": "the full spoken/on-screen script in labeled sections"
}
Write the real lines. No placeholders, nothing generic.`;

  const raw = await ai(system, `The idea: "${title}"${hook ? `\nHook to open on: ${hook}` : ""}${concept ? `\nWhat it is: ${concept}` : ""}\nWrite the full ${format} brief now — real, specific, worth posting. Keep it tight: 5-7 beats, no filler.`, 2000, "claude-sonnet-4-6");
  let brief = null;
  try { const m = raw.match(/\{[\s\S]*\}/); brief = m ? JSON.parse(m[0]) : null; } catch (e) { brief = null; }
  if (!brief) return { success: false, agent: "Muse", action: "muse_film_brief", message: "❌ Muse couldn't build the brief — try again" };
  brief.format = format; brief.pillar = pillar; if (lever) brief.lever = lever;
  return { success: true, agent: "Muse", action: "muse_film_brief", brief, message: `🎬 Film brief ready: ${brief.title || title}` };
}

// ── Performance "why" analysis ────────────────────────────────────────────────
// Reads synced account_posts, compares each platform's top performers against
// that platform's baseline, and asks Claude to explain WHY the winners won —
// per-post reasons + aggregate patterns. Per-platform, because the drivers
// differ (a YouTube thumbnail/title game ≠ an Instagram hook game).
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
async function ops_assign(payload) {
  const { taskDump = "", team = [] } = payload;
  if (!taskDump.trim()) return { tasks: [] };
  const roster = team.length
    ? team.map(m => `- ${m.name} (${m.role || "team"}) — skills: ${(Array.isArray(m.skills) ? m.skills : []).join(", ") || "general"} [id:${m.id}]`).join("\n")
    : "(no team members — leave assignee_id null)";
  const today = new Date().toISOString().slice(0, 10);
  const system = `You are the AI Operations Manager for a creative agency. You receive a raw task list (one task per line, natural language) and the team roster with skills. For EACH task, return an object with:
- title: a clean, concise task title
- priority: one of "low" | "medium" | "high" | "urgent"
- score: integer 0-100 (urgency x importance)
- assignee_id: the id of the single best-fit team member by skill match, or null if none fit
- assignee_name: that member's name, or null
- reason: one short line on why this person
- due_hint: an ISO date (YYYY-MM-DD) if the task names timing (today, Monday, EOD, by Friday), else null
Return ONLY a JSON array — no prose, no markdown fences.`;
  const user = `Today is ${today}.\n\nTEAM ROSTER:\n${roster}\n\nTASK LIST:\n${taskDump}`;
  const raw = await ai(system, user, 1800);
  let tasks = [];
  try {
    tasks = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (!Array.isArray(tasks)) tasks = [];
  } catch (e) { console.error("[ops_assign] JSON parse failed:", e.message, "| raw:", (raw || "").slice(0, 500)); tasks = []; }
  return { tasks };
}

exports.handler = async (event) => {
  const cors = makeCors(event);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);

  const rl = rateLimit(`agent-action:${auth.user.id}`, AGENT_ACTION_RATE_LIMIT_MAX, AGENT_ACTION_RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);

  if (!SERVICE_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not set" }) };
  }
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }) };
  }

  const { action, payload = {}, client_id = null } = JSON.parse(event.body || "{}");
  const actionStartedAt = Date.now();
  const agent_name = deriveAgentName(action);
  let brand = await getBrandContext(client_id);
  // Per-request voice override — replaces brand.voice for this one call without
  // touching clients.brand_voice_md. Useful for "try a punchier tone" runs.
  const voiceOverride = (payload.voiceOverride || "").trim();
  if (voiceOverride) brand = { ...brand, voice: voiceOverride };

  try {
    let result;
    switch (action) {
      case "muse_write_content":     result = await muse_write_content(payload, brand); break;
      case "sean_briefing":          result = await sean_briefing(brand); break;
      case "muse_from_brief":        result = await muse_from_brief(payload, brand); break;
      case "muse_generate_calendar": result = await muse_generate_calendar(brand); break;
      case "muse_save_calendar":     result = await muse_save_calendar(payload); break;
      case "scrappy_research":       result = await scrappy_research(payload, brand); break;
      case "scrappy_muse_collab":    result = await scrappy_muse_collab(payload, brand); break;
      case "scrappy_hook_analysis":  result = await scrappy_hook_analysis(brand); break;
      case "cid_build_brief":        result = await cid_build_brief(payload, brand); break;
      case "cid_ab_variations":      result = await cid_ab_variations(payload, brand); break;
      case "muse_ig_ideas":          result = await muse_ig_ideas(payload, brand); break;
      case "muse_idea_list":         result = await muse_idea_list(payload, brand); break;
      case "muse_film_brief":        result = await muse_film_brief(payload, brand); break;
      case "scrappy_analyze_performance": result = await scrappy_analyze_performance(payload, brand); break;
      case "ops_assign":             result = await ops_assign(payload); break;
      default:
        await logAgentEvent({
          agent_name: "Unknown",
          action_key: action,
          payload,
          result_status: "skipped",
          result_summary: `Unknown action: ${action}`,
          content_item_id: null,
          client_id,
        });
        return {
          statusCode: 400,
          headers: cors,
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }

    const eventLog = logAgentEvent({
      agent_name,
      action_key: action,
      payload,
      result_status: "success",
      result_summary: deriveSummary(result, action),
      content_item_id: deriveContentItemId(payload, result),
      client_id,
    });

    const slackLabel = SLACK_AGENT_LABELS[action];
    const slackPost = (slackLabel && result) ? (async () => {
      const msg = result.message || result.summary || result.briefing || result.report || result.trends || `✅ ${action} completed`;
      await postToSlack(slackLabel, msg);
    })() : Promise.resolve();

    await Promise.all([eventLog, slackPost]);
    console.log(`[agent-action] ${action} completed in ${Date.now() - actionStartedAt}ms`);

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("agent-action error:", err);
    await logAgentEvent({
      agent_name,
      action_key: action,
      payload,
      result_status: "error",
      result_summary: String(err.message).slice(0, 500),
      content_item_id: deriveContentItemId(payload, null),
      client_id,
    });
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
