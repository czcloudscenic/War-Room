import React from 'react';
import { useIsMobile } from '../../utils/hooks.js';

export default function AppsPage({ apps, toggleApp }) {
  const isMobile = useIsMobile();
  return (
<div style={{ animation:"fadeIn 0.4s ease" }}>
  <div style={{ marginBottom:32 }}>
    <div style={{ fontSize:9, color:"rgba(255,255,255,0.55)", fontWeight:600, letterSpacing:3, textTransform:"uppercase", fontFamily:"'Geist Mono', monospace", marginBottom:8 }}>Operations</div>
    <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:28, fontWeight:400, fontStyle:"italic", color:"#ffffff", margin:0, letterSpacing:-0.5 }}>Apps</h2>
    <p style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:6 }}>Toggle optional modules. Base pages are always visible.</p>
  </div>
  <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12 }}>
    {apps.map(app => (
      <div key={app.id} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:500, color:"#fff", marginBottom:4 }}>{app.label}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", lineHeight:1.5 }}>{app.desc}</div>
          <div style={{ marginTop:8 }}>
            <span style={{ fontSize:9, fontWeight:700, fontFamily:"'Geist Mono', monospace", letterSpacing:1, color: app.enabled ? "#2AABFF" : "rgba(255,255,255,0.3)" }}>
              {app.enabled ? "ACTIVE" : "INACTIVE"}
            </span>
          </div>
        </div>
        <button onClick={() => toggleApp(app.id)} style={{
          width:36, height:20, borderRadius:10, border:"none", cursor:"pointer", position:"relative", flexShrink:0, marginTop:2,
          background: app.enabled ? "#2AABFF" : "rgba(255,255,255,0.12)", transition:"background 0.2s"
        }}>
          <div style={{
            width:16, height:16, borderRadius:8, background:"#fff", position:"absolute", top:2,
            left: app.enabled ? 18 : 2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)"
          }} />
        </button>
      </div>
    ))}
  </div>
</div>
  );
}
