// ── Agent Memory System ──
// Per-agent memory stored in localStorage, injected into system prompts.

export const getMemory = (agentName) => {
  try {
    return JSON.parse(localStorage.getItem(`vantus_mem_${agentName}`) || '{}');
  } catch { return {}; }
};

export const setMemory = (agentName, updates) => {
  const current = getMemory(agentName);
  const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
  localStorage.setItem(`vantus_mem_${agentName}`, JSON.stringify(merged));
};

export const getActiveICPs = () => {
  try {
    const icps = JSON.parse(localStorage.getItem('vantus_icps') || '[]');
    return icps.filter(p => p.active);
  } catch { return []; }
};

export const buildICPContext = () => {
  const active = getActiveICPs();
  if (!active.length) return '';
  return '\n\nActive Ideal Customer Profiles:\n' + active.map(p =>
    `- ${p.name}: ${p.demographics}. Values: ${p.psychographics}. Pain points: ${p.painPoints}. Platforms: ${(p.platforms||[]).join(', ')}. Content prefs: ${p.contentPrefs}. Triggers: ${p.triggers}.`
  ).join('\n');
};

export const buildSystemPrompt = (agentName, basePrompt) => {
  const mem = getMemory(agentName);
  let prompt = basePrompt;
  if (Object.keys(mem).length) {
    const memStr = Object.entries(mem)
      .filter(([k]) => k !== 'updatedAt')
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');
    prompt += `\n\nYour memory from past sessions:\n${memStr}`;
  }
  prompt += buildICPContext();
  return prompt;
};

export const updateAgentMemory = (agentName, userInput, agentResponse) => {
  const mem = getMemory(agentName);
  setMemory(agentName, {
    ...mem,
    lastTask: userInput.slice(0, 120),
    lastResponse: agentResponse.slice(0, 200),
    taskCount: (mem.taskCount || 0) + 1,
  });
};

// Pre-seed Muse with brand context (call once on app mount)
export const seedMuseMemory = () => {
  if (!getMemory('Muse').brand) {
    setMemory('Muse', {
      brand: 'VitalLyfe',
      niche: 'hydration wellness water autonomy',
      tone: 'cinematic calm purposeful never corporate',
      campaigns: ['Drip Campaign', 'Meet the Makers', 'Product Launch'],
      pillars: ['Abundance', 'Access', 'Innovation', 'Tierra Bomba', 'Startup Diaries'],
    });
  }
};
