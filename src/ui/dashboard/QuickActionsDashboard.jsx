import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../../utils/hooks.js';

export default function QuickActionsDashboard({ aiEnabled = true }) {
  const isMobile = useIsMobile();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
if (document.getElementById('qa-css')) return;
const s = document.createElement('style');
s.id = 'qa-css';
s.textContent = `
  .qa-btn:hover:not(:disabled) {
    color: #fff !important;
    border-color: rgba(42,171,255,0.4) !important;
    box-shadow: 0 0 16px rgba(42,171,255,0.18), 0 0 4px rgba(42,171,255,0.12);
  }
  .qa-btn:active:not(:disabled) { opacity: 0.7 !important; }
`;
document.head.appendChild(s);
  }, []);
  const [activeAction, setActiveAction] = useState(null);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const ACTIONS = [
{ label: "Morning Briefing", action: "sean_briefing", agent: "Sean", color: "#2AABFF" },
{ label: "Generate Captions", action: "muse_generate_calendar", agent: "Muse", color: "#2AABFF" },
{ label: "SOP Scan", action: "overseer_scan", agent: "Overseer", color: "#2AABFF" },
{ label: "Advance Pipeline", action: "lacey_advance", agent: "Lacey", color: "#2AABFF" },
{ label: "Health Check", action: "sam_health", agent: "Sam", color: "#2AABFF" },
{ label: "Trigger n8n", action: "lacey_trigger_n8n", agent: "Lacey", color: "#2AABFF", payload: { workflow: "vitallyfe-pipeline", message: "Triggered from Vantus Quick Actions", triggeredBy: "Vantus" } },
  ];

  const run = async (action, agent, color, label, payload = {}) => {
if (busy) return;
if (!aiEnabled) {
  setExpanded(true);
  setResult({ ok: false, text: "AI is currently disabled. Turn it back on from the sidebar kill switch.", color: "#ff453a" });
  setActiveAction({ action, agent, label, color });
  return;
}
setBusy(true);
setActiveAction({ action, agent, label, color });
setResult(null);
setExpanded(true);
try {
  const res = await fetch("/api/agent-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentName: agent, action, payload }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  let display = d.message || "Action complete.";
  if (d.briefing) display += "\n\n" + d.briefing;
  if (d.report) display += "\n\n" + d.report;
  if (d.calendar) display += "\n\n" + d.calendar;
  if (d.flagged && d.flagged.length > 0) {
    display += "\n\nFlagged Items:\n" + d.flagged.map(f => `• "${f.title}" — ${f.violation} [${f.severity}]`).join("\n");
  }
  if (d.items && d.items.length > 0) {
    display += "\n\nAdvanced:\n" + d.items.map(i => `• ${i.title}`).join("\n");
  }
  if (d.metrics) {
    const m = d.metrics;
    display += `\n\nMetrics: ${m.total} total · ${m.missingCopy} missing captions · ${m.missingScript} missing scripts`;
    if (m.byStatus) display += "\n" + Object.entries(m.byStatus).map(([s,n]) => `${s}: ${n}`).join(" · ");
  }
  if (d.briefs && d.briefs.length > 0 && d.summary) {
    display += "\n\n" + d.summary;
  }
  setResult({ ok: true, text: display, color });
} catch(e) {
  setResult({ ok: false, text: ` ${e.message}`, color: "#ff453a" });
}
setBusy(false);
  };

  return (
<div style={{ marginBottom:28 }}>
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
    <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:22, fontWeight:400, fontStyle:"italic", color:"#f0eeef", margin:0, letterSpacing:-0.5 }}>Quick Actions</h2>
  </div>
  <div className="hover-card" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.13)", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
    <div style={{ padding: isMobile ? "12px 14px" : "16px 20px", display:"flex", gap: isMobile ? 8 : 8, flexWrap:"wrap" }}>
      {ACTIONS.map(({ label, action, agent, color, payload }) => (
        <button key={action} onClick={() => run(action, agent, color, label, payload || {})} disabled={busy} className="qa-btn"
          style={{ fontSize: isMobile ? 11 : 11, fontWeight:500, color:"rgba(255,255,255,0.88)", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding: isMobile ? "8px 12px" : "8px 16px", cursor:busy?"default":"pointer", fontFamily:"Inter,sans-serif", letterSpacing:0.2, opacity:busy?0.5:1, flex: isMobile ? "1 0 calc(50% - 4px)" : "none", transition:"color 0.15s, border-color 0.15s, box-shadow 0.15s" }}>
          {busy && activeAction?.action === action ? "running…" : label}
        </button>
      ))}
    </div>
    {expanded && (
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ padding:"10px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(0,0,0,0.015)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background: result ? (result.ok ? "#2AABFF" : "#ff453a") : activeAction?.color, animation: !result ? "livePulse 1s infinite" : "none" }} />
            <span style={{ fontSize:11, fontWeight:600, color: result ? (result.ok ? "#2AABFF" : "#ff453a") : "rgba(0,0,0,0.5)" }}>
              {result ? (activeAction?.agent + " — " + activeAction?.label) : "Agent running…"}
            </span>
          </div>
          <button onClick={() => { setExpanded(false); setResult(null); setActiveAction(null); }}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:14, padding:"2px 6px", fontFamily:"Inter,sans-serif" }}></button>
        </div>
        {result && (
          <div style={{ padding:"14px 18px", maxHeight:320, overflowY:"auto" }}>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)", lineHeight:1.7, whiteSpace:"pre-wrap", fontFamily:"Inter,sans-serif" }}>{result.text}</div>
          </div>
        )}
        {!result && (
          <div style={{ padding:"20px 18px", display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:activeAction?.color, animation:"livePulse 1.2s 0s infinite" }} />
            <div style={{ width:7, height:7, borderRadius:"50%", background:activeAction?.color, animation:"livePulse 1.2s 0.2s infinite" }} />
            <div style={{ width:7, height:7, borderRadius:"50%", background:activeAction?.color, animation:"livePulse 1.2s 0.4s infinite" }} />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginLeft:8 }}>{activeAction?.agent} is working…</span>
          </div>
        )}
      </div>
    )}
  </div>
</div>
  );
}
