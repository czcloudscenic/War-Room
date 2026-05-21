import React from 'react';
import { STAGE_SHORT } from '../../utils/constants.js';

export default function ContentPipelineBoard({ title, icon, stages, stageColors, items, onCardClick, onMuseWrite }) {
  return (
    <div style={{ marginBottom:32 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <span style={{ fontSize:18 }}>{icon}</span>
        <span style={{ fontSize:16, fontWeight:600, color:"#f5f5f7", letterSpacing:-0.5 }}>{title}</span>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.05)", padding:"2px 9px", borderRadius:20, fontWeight:600 }}>{items.length} pieces</span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginLeft:"auto" }}>← scroll →</span>
      </div>
      <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8 }}>
        {stages.map((stage,si) => {
          const c = stageColors[si];
          const stageItems = items.filter(x => x.stage === stage);
          return (
            <div key={stage} style={{ minWidth:160, maxWidth:160 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:9, fontWeight:700, color:c, letterSpacing:0.3, textTransform:"uppercase", lineHeight:1.3 }}>{STAGE_SHORT[stage] || stage}</span>
                <span style={{ fontSize:10, color:c, background:`${c}18`, padding:"1px 7px", borderRadius:20, fontWeight:700 }}>{stageItems.length}</span>
              </div>
              <div style={{ minHeight:120, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:12, padding:8 }}>
                {stageItems.map((item) => (
                  <div key={item.id} className="hover-card" style={{ padding:"10px 12px", marginBottom:7, borderRadius:10, borderLeft:`2px solid ${c}`, background:"rgba(255,255,255,0.05)", backdropFilter:"blur(12px)", boxShadow:"0 1px 6px rgba(0,0,0,0.4)" }}>
                    <div onClick={() => onCardClick(item)} style={{ cursor:"pointer" }}>
                      <div style={{ fontSize:11, color:"#ffffff", fontWeight:600, lineHeight:1.35, marginBottom:5 }}>{item.title}</div>
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", marginBottom:5, lineHeight:1.4 }}>{item.campaign}</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                        <span style={{ fontSize:8, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.07)", padding:"2px 5px", borderRadius:4, fontWeight:700 }}>{item.pillar}</span>
                        {item.platforms.slice(0,2).map(p => <span key={p} style={{ fontSize:8, color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.05)", padding:"2px 5px", borderRadius:4 }}>{p}</span>)}
                      </div>
                    </div>
                    {onMuseWrite && (
                      <div style={{ display:"flex", gap:4 }}>
                        {(!item.caption || item.caption.length < 10) && (
                          <button onClick={() => onMuseWrite(item, "caption")} style={{ fontSize:8, fontWeight:700, color:"#ff375f", background:"rgba(255,55,95,0.08)", border:"1px solid rgba(255,55,95,0.2)", borderRadius:5, padding:"2px 7px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}> Caption</button>
                        )}
                        {item.format === "Reel" && (!item.script || item.script.length < 10) && (
                          <button onClick={() => onMuseWrite(item, "script")} style={{ fontSize:8, fontWeight:700, color:"#2AABFF", background:"rgba(191,90,242,0.08)", border:"1px solid rgba(191,90,242,0.2)", borderRadius:5, padding:"2px 7px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}> Script</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {stageItems.length===0 && <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textAlign:"center", padding:"24px 0" }}>empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
