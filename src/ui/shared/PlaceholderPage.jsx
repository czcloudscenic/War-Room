import React from 'react';

export default function PlaceholderPage({ icon, title, badge, desc }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"70vh" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:20, opacity:0.15 }}>{icon}</div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <h2 style={{ fontSize:28, fontWeight:700, color:"#f5f5f7", margin:0, letterSpacing:-0.5 }}>{title}</h2>
          {badge && <span style={{ fontSize:10, color:"#ff9f0a", background:"rgba(255,159,10,0.15)", padding:"3px 10px", borderRadius:20, fontWeight:600 }}>{badge}</span>}
        </div>
        <p style={{ fontSize:13, color:"rgba(255,255,255,0.5)", maxWidth:360, margin:"0 auto", lineHeight:1.6 }}>{desc}</p>
      </div>
    </div>
  );
}
