import React, { useState, useEffect } from 'react';

export default function AgentAvatar({ agent, size=40 }) {
  const [beat, setBeat] = useState(false);
  useEffect(() => {
const id = setInterval(() => { setBeat(true); setTimeout(() => setBeat(false), 300); }, 3000 + Math.random() * 4000);
return () => clearInterval(id);
  }, []);
  return (
<div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
  <div style={{ width:size, height:size, borderRadius:size*0.3, background:agent.grad, border:`1.5px solid ${agent.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.38, fontWeight:700, color:agent.color, boxShadow:beat?`0 0 12px ${agent.color}60`:"none", transition:"box-shadow 0.3s" }}>{agent.name[0]}</div>
  <div style={{ position:"absolute", bottom:-1, right:-1, width:size*0.26, height:size*0.26, borderRadius:"50%", background:"#2AABFF", border:`2px solid #f5f5f7`, animation:"livePulse 2.5s ease-in-out infinite" }} />
</div>
  );
}
