import React from 'react';
import { ACTION_COLORS } from '../../data/seed.agents.js';

export default function ActivityFeed({ feed }) {
  return (
    <div style={{ height:"auto", overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }}>
      {feed.map((item,i) => (
        <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 12px", background:i===0?`${ACTION_COLORS[item.type]}0a`:"transparent", borderRadius:8, borderLeft:i===0?`2px solid ${ACTION_COLORS[item.type]}`:"2px solid transparent", animation:i===0?"slideIn 0.3s ease":"none", transition:"all 0.3s" }}>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.55)", whiteSpace:"nowrap" }}>{item.time}</span>
          <span style={{ fontSize:10, color:ACTION_COLORS[item.type], fontWeight:700, whiteSpace:"nowrap" }}>{item.agent}</span>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.75)" }}>{item.action}</span>
        </div>
      ))}
    </div>
  );
}
