import React, { useState, useEffect } from 'react';
import { useInterval } from '../../utils/hooks.js';

export default function MetricCard({ label, value, delta, color, large, sub }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  useInterval(() => { if (delta > 0) setV(p => p + Math.floor(Math.random()*delta)); }, delta > 0 ? 5000 + Math.random()*3000 : null);
  return (
<div className="hover-card" style={{ background:"rgba(255,255,255,0.06)", borderRadius:16, border:"1px solid rgba(255,255,255,0.13)", overflow:"hidden", position:"relative", height:large?"100%":"auto" }}>
  <div style={{ padding: large ? "36px 32px" : "22px 24px", height:"100%", display:"flex", flexDirection:"column", justifyContent: large ? "flex-end" : "flex-start" }}>
    {large && <div style={{ flex:1 }} />}
    <div style={{ fontSize:10, color:"rgba(255,255,255,0.75)", fontWeight:600, textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>{label}</div>
    <div style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: large ? 72 : 40, fontWeight:400, color:'#f0eeef', letterSpacing: large ? -4 : -2, lineHeight:1 }}>{v.toLocaleString()}</div>
    {(large || sub) && <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:8 }}>{sub || "pieces in pipeline"}</div>}
  </div>
</div>
  );
}
