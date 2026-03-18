import React from 'react';

export default function Card({ children, style={}, glowColor, onClick }) {
  return (
<div onClick={onClick} className="hover-card" style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.13)", borderRadius:16, boxShadow:"0 2px 16px rgba(0,0,0,0.15)", ...style }}>
  {children}
</div>
  );
}
