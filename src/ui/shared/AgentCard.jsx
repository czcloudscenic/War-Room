import React from 'react';
import { AGENT_TASKS } from '../../data/seed.agents.js';
import AgentAvatar from './AgentAvatar.jsx';

export default function AgentCard({ agent, selected, onClick }) {
  const tasks = AGENT_TASKS[agent.name] || [];
  return (
<div onClick={onClick} className="hover-card" style={{ background: selected ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)", border:`1px solid ${selected ? agent.color+"60" : "rgba(255,255,255,0.12)"}`, borderRadius:16, padding:"20px 18px", cursor:"pointer", position:"relative", overflow:"hidden", transition:"border-color 0.15s, background 0.15s" }}>
  {selected && <div style={{ position:"absolute", top:0, left:0, width:"100%", height:1, background:agent.color, opacity:0.6 }} />}
  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
    <AgentAvatar agent={agent} size={32} />
    <div style={{ width:5, height:5, borderRadius:"50%", background: selected ? agent.color : "rgba(255,255,255,0.18)", flexShrink:0, transition:"background 0.2s" }} />
  </div>
  <div style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:"italic", color:"#ffffff", fontSize:16, letterSpacing:-0.3, marginBottom:3 }}>{agent.name}</div>
  <div style={{ fontSize:10, color:agent.color, fontWeight:500, letterSpacing:0.3, opacity:0.85 }}>{agent.role}</div>
  {selected && (
    <div style={{ marginTop:14, borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:12 }}>
      {tasks.slice(0,3).map((t,i) => (
        <div key={i} style={{ fontSize:10, color:"rgba(255,255,255,0.42)", marginBottom:5, lineHeight:1.5 }}>{t}</div>
      ))}
    </div>
  )}
</div>
  );
}
