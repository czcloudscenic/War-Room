import React, { useState, useRef } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import { AGENTS_BASE } from '../../data/seed.agents.js';
import { routeTask } from '../../core/routeTask.js';

export default function CommandInput({ aiEnabled }) {
  const isMobile = useIsMobile();
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [missionLog, setMissionLog] = useState([]);
  const inputRef = useRef(null);

  const AGENT_COLORS = {};
  AGENTS_BASE.forEach(a => { AGENT_COLORS[a.name] = a.color; });

  const run = async () => {
if (!input.trim() || running || !aiEnabled) return;
setRunning(true);
setMissionLog([]);
const task = input.trim();
setInput('');

const { agents, results } = await routeTask(task);

for (const agent of agents) {
  setMissionLog(prev => [...prev, {
    agent,
    status: 'done',
    result: results[agent],
  }]);
  await new Promise(r => setTimeout(r, 80));
}
setRunning(false);
  };

  const QUICK_CHIPS = [
{ label: 'Morning Briefing', input: 'Give me a morning briefing on the pipeline' },
{ label: 'Generate Captions', input: 'Generate captions for the pipeline' },
{ label: 'SOP Scan', input: 'Run a full SOP compliance scan' },
{ label: 'Advance Pipeline', input: 'Advance all ready pipeline items' },
{ label: 'Health Check', input: 'Run a full system health check' },
{ label: 'Scout Footage', input: 'Scout footage for all video items' },
  ];

  return (
<div style={{ marginBottom: 28 }}>
  <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:22, fontWeight:400, fontStyle:"italic", color:"#f0eeef", margin:"0 0 14px", letterSpacing:-0.5 }}>
    What do you need today?
  </h2>
  <div style={{ display:"flex", gap:8, marginBottom:10 }}>
    <input
      ref={inputRef}
      value={input}
      onChange={e => setInput(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && run()}
      placeholder="Tell Vantus what to do…"
      disabled={running}
      style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"11px 16px", color:"#f5f5f7", fontSize:13, outline:"none", fontFamily:"Inter,sans-serif" }}
    />
    <button onClick={run} disabled={!input.trim() || running || !aiEnabled}
      style={{ background: input.trim() && !running ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color: input.trim() && !running ? "#fff" : "rgba(255,255,255,0.25)", cursor: input.trim() && !running ? "pointer" : "default", padding:"11px 20px", fontSize:13, fontFamily:"Inter,sans-serif", fontWeight:500 }}>
      {running ? '\u2026' : 'Run \u2192'}
    </button>
  </div>
  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
    {QUICK_CHIPS.map(chip => (
      <button key={chip.label} onClick={() => { setInput(chip.input); inputRef.current?.focus(); }}
        disabled={running}
        style={{ fontSize:11, fontWeight:500, color:"rgba(255,255,255,0.55)", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"4px 12px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
        {chip.label}
      </button>
    ))}
  </div>
  {(running || missionLog.length > 0) && (
    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 18px", animation:"fadeIn 0.3s ease" }}>
      <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>
        {running ? 'Mission Running\u2026' : 'Mission Complete'}
      </div>
      {missionLog.map((entry, i) => (
        <div key={i} style={{ marginBottom:10, animation:"slideIn 0.2s ease" }}>
          <div style={{ fontSize:10, fontWeight:700, color: AGENT_COLORS[entry.agent] || '#2AABFF', marginBottom:3 }}>{entry.agent}</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{entry.result}</div>
        </div>
      ))}
      {running && (
        <div style={{ display:"flex", gap:5, alignItems:"center", marginTop:4 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 1s infinite" }} />
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>Agents working\u2026</span>
        </div>
      )}
    </div>
  )}
</div>
  );
}
