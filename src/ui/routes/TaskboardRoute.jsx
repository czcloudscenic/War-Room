import React from 'react';
import OpsBoard from '../dashboard/OpsBoard.jsx';

export default function TaskboardRoute() {
  return (
    <div style={{ animation:"fadeIn 0.4s ease" }}>
      <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:32, fontWeight:700, color:"#f5f5f7", marginBottom:6, letterSpacing:-1 }}>Task Board</h1>
      <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:24 }}>Tasks auto-advance every ~20s · Add tasks to the backlog below</p>
      <OpsBoard />
    </div>
  );
}
