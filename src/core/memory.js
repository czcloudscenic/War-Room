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

export const buildICPContext = () => {
  try {
    const clients = JSON.parse(localStorage.getItem('vantus_icps') || '[]');
    const active = clients.filter(c => c.active);
    if (!active.length) return '';
    return '\n\nActive Client ICP Profiles:\n' + active.map(c => {
      const s = c.sections || {};
      const parts = [`Client: ${c.name}`];
      if (s.demographics) {
        const d = s.demographics;
        if (d.businessType) parts.push(`Business: ${d.businessType}`);
        if (d.revenueRange) parts.push(`Revenue: ${d.revenueRange}`);
        if (d.onlinePresence) parts.push(`Online presence: ${d.onlinePresence}`);
        if (d.visualAspirations) parts.push(`Visual aspirations: ${d.visualAspirations}`);
      }
      if (s.goals) {
        const g = s.goals;
        if (g.successVision) parts.push(`Success vision: ${g.successVision}`);
        if (g.emotionalResponse) parts.push(`Desired feeling: ${g.emotionalResponse}`);
        if (g.visibilityLevel) parts.push(`Visibility goal: ${g.visibilityLevel}`);
      }
      if (s.painPoints) {
        const p = s.painPoints;
        if (p.whatsNotWorking) parts.push(`Pain: ${p.whatsNotWorking}`);
        if (p.biggestFrustration) parts.push(`Frustration: ${p.biggestFrustration}`);
      }
      if (s.beliefs) {
        const b = s.beliefs;
        if (b.contentNotConverting) parts.push(`Belief: ${b.contentNotConverting}`);
      }
      return parts.join('. ');
    }).join('\n');
  } catch { return ''; }
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
