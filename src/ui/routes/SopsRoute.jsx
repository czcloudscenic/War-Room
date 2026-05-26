import React from 'react';
import { VITAL_LYFE_SOP } from '../../data/seed.content.js';
import Card from '../shared/Card.jsx';

export default function SopsRoute({ isMobile }) {
  return (
    <div style={{ animation:"fadeIn 0.4s ease" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom: isMobile ? 16 : 28, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", letterSpacing:2, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Standard Operating Procedure</div>
          <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 22 : 32, fontWeight:700, color:"#f5f5f7", margin:0, letterSpacing:-1 }}>{VITAL_LYFE_SOP.title}</h1>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginTop:5 }}>{VITAL_LYFE_SOP.subtitle} · {VITAL_LYFE_SOP.version}</div>
        </div>
        <Card style={{ padding:"12px 16px", textAlign:"center" }}>
          <div style={{ fontSize:9, color:"rgba(48,209,88,0.6)", fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>Agents Trained On</div>
          <div style={{ fontSize:24, fontWeight:700, color:"#2AABFF" }}>4</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", marginTop:2 }}>Artgrid · Muse · Overseer · Scrappy</div>
        </Card>
      </div>
      <Card style={{ padding:"16px 20px", marginBottom:24, borderLeft:"3px solid #2AABFF", background:"rgba(48,209,88,0.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2.5s ease-in-out infinite", flexShrink:0 }} />
          <span style={{ fontSize:12, color:"rgba(48,209,88,0.8)", fontWeight:500 }}>Artgrid, Muse, and Overseer have been programmed with this SOP. They understand all 7 steps and operate within this framework automatically.</span>
        </div>
      </Card>
      <div style={{ marginBottom:28 }}>
        <h2 style={{ fontSize:17, fontWeight:600, color:"#f5f5f7", margin:"0 0 16px", letterSpacing:-0.4 }}>Workflow Steps</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {VITAL_LYFE_SOP.steps.map((step,i) => {
            const colors = ["#2AABFF","#0a84ff","#2AABFF","#ff9f0a","#ff375f","#64d2ff","#ffd60a"];
            const c = colors[i];
            return (
              <Card key={step.num} style={{ padding:"18px 22px", display:"grid", gridTemplateColumns:"52px 1fr", gap:16, alignItems:"flex-start" }}>
                <div style={{ fontSize:28, fontWeight:800, color:"rgba(255,255,255,0.08)", letterSpacing:-1, lineHeight:1 }}>{step.num}</div>
                <div>
                  <div style={{ fontSize:9, color:c, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>{step.phase}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#f5f5f7", letterSpacing:-0.3, marginBottom:8 }}>{step.title}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:12 }}>{step.desc}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {step.tags.map(tag => <span key={tag} style={{ fontSize:9, color:"rgba(255,255,255,0.6)", background:"rgba(255,255,255,0.06)", padding:"3px 9px", borderRadius:20, fontWeight:600, border:`1px solid ${c}20` }}>{tag}</span>)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
        <Card style={{ padding:"20px" }}>
          <h3 style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", margin:"0 0 14px", letterSpacing:1.5, textTransform:"uppercase" }}>Tools</h3>
          {VITAL_LYFE_SOP.tools.map((t,i) => (
            <div key={t} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ width:24, height:24, borderRadius:7, background:"rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"rgba(255,255,255,0.5)", fontWeight:700 }}>{String(i+1).padStart(2,"0")}</div>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.75)", fontWeight:500 }}>{t}</span>
            </div>
          ))}
        </Card>
        <Card style={{ padding:"20px" }}>
          <h3 style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", margin:"0 0 14px", letterSpacing:1.5, textTransform:"uppercase" }}>Platforms</h3>
          {VITAL_LYFE_SOP.platforms.map((p,i) => {
            const c = ["#e1306c","#ff0050","#ff0000"][i];
            return (
              <div key={p} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:c, flexShrink:0 }} />
                <span style={{ fontSize:12, color:"rgba(255,255,255,0.75)", fontWeight:500 }}>{p}</span>
              </div>
            );
          })}
        </Card>
        <Card style={{ padding:"20px" }}>
          <h3 style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", margin:"0 0 14px", letterSpacing:1.5, textTransform:"uppercase" }}>Content Pillars</h3>
          {VITAL_LYFE_SOP.contentPillars.map((p,i) => {
            const c = ["#2AABFF","#0a84ff","#ff9f0a","#ff375f","#2AABFF"][i];
            return (
              <div key={p} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:c, flexShrink:0 }} />
                <span style={{ fontSize:12, color:"rgba(255,255,255,0.75)", fontWeight:500 }}>{p}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
