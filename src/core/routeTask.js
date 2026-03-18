// ── Task Router ──
// Parses natural language input, scores agents by keyword match,
// executes them in sequence, returns aggregated results.

import { AGENT_KEYWORDS, ROUTE_PROMPTS } from './agentRegistry.js';
import { buildSystemPrompt, updateAgentMemory } from './memory.js';

export async function routeTask(input) {
  const lower = input.toLowerCase();

  // Score each agent by keyword matches
  const scores = Object.entries(AGENT_KEYWORDS).map(([agent, keywords]) => ({
    agent,
    score: keywords.filter(k => lower.includes(k)).length,
  }));

  // Select agents with score > 0, always include Sean
  const selected = scores
    .filter(s => s.score > 0 || s.agent === 'Sean')
    .sort((a, b) => b.score - a.score)
    .map(s => s.agent);

  const log = [];
  const results = {};

  for (const agentName of selected) {
    log.push({ agent: agentName, status: 'running', ts: Date.now() });
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          system: buildSystemPrompt(agentName, ROUTE_PROMPTS[agentName]),
          messages: [{ role: 'user', content: input }],
        }),
      });
      const d = await res.json();
      const text = d.content?.find(b => b.type === 'text')?.text || '';
      results[agentName] = text;
      updateAgentMemory(agentName, input, text);
      log[log.length - 1].status = 'done';
    } catch (e) {
      results[agentName] = 'Error: ' + e.message;
      log[log.length - 1].status = 'error';
    }
  }

  return { agents: selected, log, results };
}
