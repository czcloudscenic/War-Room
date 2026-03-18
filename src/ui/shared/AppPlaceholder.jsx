import React from 'react';
import { useIsMobile } from '../../utils/hooks.js';

export default function AppPlaceholder({ label, desc, icon }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ animation:"fadeIn 0.4s ease" }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.55)", fontWeight:600, letterSpacing:3, textTransform:"uppercase", fontFamily:"'Geist Mono', monospace", marginBottom:8 }}>App</div>
        <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:28, fontWeight:400, fontStyle:"italic", color:"#ffffff", margin:0, letterSpacing:-0.5 }}>{label}</h2>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:6 }}>{desc}</p>
      </div>
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding: isMobile ? "40px 24px" : "60px 48px", textAlign:"center" }}>
        <div style={{ fontSize:36, marginBottom:16, opacity:0.3 }}>{icon || "◇"}</div>
        <div style={{ fontSize:14, fontWeight:500, color:"rgba(255,255,255,0.5)", marginBottom:8 }}>Coming Soon</div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", maxWidth:320, margin:"0 auto", lineHeight:1.6 }}>
          This module is under development. It will be available in a future update.
        </div>
      </div>
    </div>
  );
}
