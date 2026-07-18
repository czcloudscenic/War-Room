const { TAVILY_KEY, SB_HEADERS, REST, sbGet, sbPatch, ai } = require("../_shared");

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

// ─── SCRAPPY: HOOK ANALYSIS ───────────────────────────────────────────────────
// NOTE: Requires cid_library table in Supabase with columns:
//   id (int8, primary key, auto-increment), type (text) — "hook"|"body"|"cta",
//   text (text), score (int4), platform (text), views (text), engagement (text),
//   why_it_works (text), client_adaptation (text), created_at (timestamptz, default now())
// (Column renamed from vitallyfe_adaptation in Fix #3.1 migration 20260526.)


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

module.exports = { muse_write_content, muse_generate_calendar, muse_save_calendar, muse_from_brief, muse_ig_ideas, muse_idea_list, muse_film_brief };
