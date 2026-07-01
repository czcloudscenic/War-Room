import React from 'react';
import { AGENT_TASKS } from '../../data/seed.agents.js';
import ActivityFeed from '../dashboard/ActivityFeed.jsx';
import CommandInput from '../dashboard/CommandInput.jsx';
import OpsBoard from '../dashboard/OpsBoard.jsx';
import AgentAvatar from '../shared/AgentAvatar.jsx';
import AgentCard from '../shared/AgentCard.jsx';
import Card from '../shared/Card.jsx';
import MetricCard from '../shared/MetricCard.jsx';

export default function DashboardRoute({
  isMobile,
  currentClient,
  clientContent,
  liveCount,
  aiEnabled,
  agents,
  selectedAgent,
  setSelectedAgent,
}) {
  return (
    <div style={{ animation:"fadeIn 0.4s ease" }}>
      {/*  HERO  */}
      <div style={{ marginBottom: isMobile ? 24 : 40, paddingBottom: isMobile ? 24 : 32, borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.55)", fontWeight:600, letterSpacing:3, textTransform:"uppercase", fontFamily:"'Geist Mono', monospace", marginBottom:12 }}>Cloud Scenic / {currentClient?.name || "Loading…"}</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 36 : 52, fontWeight:400, fontStyle:"italic", color:"#ffffff", margin:0, letterSpacing:-1, lineHeight:1 }}>Vantus.</h1>

        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginTop:16 }}>
          <p style={{ fontSize:12, color:"rgba(255,255,255,0.55)", margin:0 }}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:4, height:4, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2.5s ease-in-out infinite" }} />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{liveCount} agents active</span>
          </div>
        </div>
      </div>

      {/*  EMPTY-STATE BANNER — appears for freshly-created clients with no content yet  */}
      {currentClient && clientContent.length === 0 && (
        <div style={{ marginBottom: isMobile ? 20 : 32, padding: isMobile ? "20px 22px" : "26px 30px", background: "rgba(42,171,255,0.05)", border: "1px solid rgba(42,171,255,0.18)", borderRadius: 14 }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:"rgba(42,171,255,0.7)", textTransform:"uppercase", marginBottom:8 }}>Empty Dashboard</div>
          <div style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 22 : 26, fontStyle:"italic", color:"#f5f5f7", fontWeight:400, marginBottom:8, letterSpacing:-0.5 }}>
            No content yet for {currentClient.name}.
          </div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.55, maxWidth:520 }}>
            Add your first content piece in <strong style={{ color:"#f5f5f7", fontWeight:500 }}>Pipeline</strong> or <strong style={{ color:"#f5f5f7", fontWeight:500 }}>Production</strong>, or drop a brief in <strong style={{ color:"#f5f5f7", fontWeight:500 }}>Apps → Brief → Content</strong> to have Muse generate ideas automatically.
          </div>
        </div>
      )}

      {/*  METRIC GRID — 2x2 on mobile, asymmetric on desktop  */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.4fr 1fr 1fr", gridTemplateRows:"auto", gap: isMobile ? 10 : 14, marginBottom: isMobile ? 24 : 44 }}>
        {isMobile ? (
          <>
            <MetricCard label="Content Pieces" value={clientContent.length} delta={0} color="#2AABFF" />
            <MetricCard label="Approved" value={clientContent.filter(x=>x.status==="Approved").length} delta={0} color="#0a84ff" />
            <MetricCard label="Need Attention" value={clientContent.filter(x=>["Need Copy Approval","Need Content Approval","Needs Revisions"].includes(x.status)).length} delta={0} color="#ff9f0a" />
            <MetricCard label="Scheduled" value={clientContent.filter(x=>x.status==="Scheduled").length} delta={0} color="#2AABFF" />
          </>
        ) : (
          <>
            <div style={{ gridRow:"1 / span 2" }}>
              <MetricCard label="Content Pieces" value={clientContent.length} delta={0} color="#2AABFF" large />
            </div>
            <MetricCard label="Approved" value={clientContent.filter(x=>x.status==="Approved").length} delta={0} color="#0a84ff" />
            <MetricCard label="Scheduled" value={clientContent.filter(x=>x.status==="Scheduled").length} delta={0} color="#2AABFF" />
            <MetricCard label="Need Attention" value={clientContent.filter(x=>["Need Copy Approval","Need Content Approval","Needs Revisions"].includes(x.status)).length} delta={0} color="#ff9f0a" />
            <MetricCard label="In Production" value={clientContent.filter(x=>["Ready For Content Creation","Ready For Copy Creation"].includes(x.status)).length} delta={0} color="#ff375f" />
          </>
        )}
      </div>

      {/*  QUICK ACTIONS  */}
      <div style={{ marginBottom: isMobile ? 24 : 44 }}>
        <CommandInput aiEnabled={aiEnabled} />
      </div>

      {/*  AGENT GRID  */}
      <div style={{ marginBottom:44 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:22 }}>
          <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:24, fontWeight:400, fontStyle:"italic", color:"#ffffff", margin:0, letterSpacing:-0.5 }}>The Team</h2>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.28)", fontWeight:400 }}>{liveCount} active</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap:12 }}>
          {(agents || []).map(agent => <AgentCard key={agent.id} agent={agent} selected={selectedAgent?.id===agent.id} onClick={() => setSelectedAgent(selectedAgent?.id===agent.id?null:agent)} />)}
        </div>
      </div>

      {/*  SELECTED AGENT DETAIL  */}
      {selectedAgent && (
        <div style={{ marginBottom:44, animation:"slideIn 0.2s ease", background:"#0f0d0e", borderRadius:16, border:`1px solid rgba(255,255,255,0.07)`, padding:"24px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <AgentAvatar agent={selectedAgent} size={40} />
              <div>
                <div style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:"italic", color:"#f0eeef", fontSize:20, letterSpacing:-0.5 }}>{selectedAgent.name}</div>
                <div style={{ fontSize:10, color:selectedAgent.color, fontWeight:500, marginTop:2, opacity:0.85 }}>{selectedAgent.role}</div>
              </div>
            </div>
            <button onClick={() => setSelectedAgent(null)} style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.35)", cursor:"pointer", fontSize:12, borderRadius:8, width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center" }}>x</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {AGENT_TASKS[selectedAgent.name].slice(0,5).map((t,i) => (
              <div key={i} style={{ fontSize:11, color:"rgba(255,255,255,0.45)", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", lineHeight:1.4 }}>{t}</div>
            ))}
          </div>
        </div>
      )}

      {/*  LIVE ACTIVITY  */}
      <div style={{ marginBottom:44 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
          <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 20 : 24, fontWeight:400, fontStyle:"italic", color:"#f0eeef", margin:0, letterSpacing:-0.5 }}>Live Activity</h2>
          {aiEnabled
            ? <div style={{ width:4, height:4, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2.5s ease-in-out infinite" }} />
            : <span style={{ fontSize:9, color:"rgba(255,80,80,0.7)", fontFamily:"'Geist Mono',monospace", letterSpacing:1.5, fontWeight:700, textTransform:"uppercase" }}>Paused</span>
          }
        </div>
        <Card style={{ padding:"4px 0", maxHeight:320, overflowY:"auto" }}><ActivityFeed clientId={currentClient?.id} /></Card>
      </div>

      {/*  OPERATIONS BOARD  */}
      <div style={{ marginBottom:28 }}>
        <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 20 : 22, fontWeight:400, fontStyle:"italic", color:"#f5f5f7", margin:"0 0 18px", letterSpacing:-0.5 }}>Operations</h2>
        <OpsBoard />
      </div>
    </div>
  );
}
