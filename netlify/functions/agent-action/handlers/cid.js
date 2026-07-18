const { ANTHROPIC_KEY } = require("../_shared");

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


module.exports = { cid_build_brief, cid_ab_variations };
