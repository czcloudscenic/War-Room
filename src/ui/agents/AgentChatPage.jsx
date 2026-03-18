import React, { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import { buildSystemPrompt, updateAgentMemory } from '../../core/memory.js';
import AgentAvatar from '../shared/AgentAvatar.jsx';

function CalendarSaveButton({ items }) {
  const [status, setStatus] = React.useState("idle");
  const save = async () => {
setStatus("saving");
try {
  const res = await fetch("/api/agent-action", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "muse_save_calendar", payload: { items } }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  setStatus("done");
} catch(e) { setStatus("error"); }
  };
  return (
<div style={{ marginTop:10 }}>
  {status === "idle" && (
    <button onClick={save} style={{ fontSize:11, fontWeight:700, color:"#ff375f", background:"rgba(255,55,95,0.08)", border:"1px solid rgba(255,55,95,0.25)", borderRadius:10, padding:"8px 16px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
       Save {items.length} items to Tracker
    </button>
  )}
  {status === "saving" && <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>⏳ Saving to tracker…</span>}
  {status === "done" && <span style={{ fontSize:11, color:"#2AABFF", fontWeight:600 }}> {items.length} items added to tracker — check Content Tracker</span>}
  {status === "error" && <span style={{ fontSize:11, color:"#ff453a" }}> Save failed — check console</span>}
</div>
  );
}

export default function AgentChatPage({ agents, content }) {
  const isMobile = useIsMobile();
  const [mobileAgentList, setMobileAgentList] = useState(false);
  const PROMPTS = {
Sean: "You are Sean, Commander Agent for the VitalLyfe Vantus by Cloud Scenic. Orchestrate all 7 agents, own the content pipeline. VitalLyfe is a wellness/hydration brand. Campaigns: Drip Campaign, Meet the Makers, Product Launch. Platforms: Instagram, TikTok, YouTube. Pipeline: Ready For Copy Creation, Need Copy Approval, Ready For Content Creation, Need Content Approval, Needs Revisions, Approved, Ready For Schedule, Scheduled. Team: Lacey (Runner), Ali (Developer), Sam (Monitor), Artgrid (Footage Scout), Muse (Content Ideation), Overseer (SOP Guardian). Personality: decisive, calm, short punchy sentences.",
Lacey: "You are Lacey, Runner Agent for the VitalLyfe Vantus by Cloud Scenic. Execute tasks: n8n and Zapier workflows, deliverable batches, SOPs, Drive sync. Personality: fast, pragmatic, loves checklists, dry humor when things break.",
Ali: "You are Ali, Developer Agent for the VitalLyfe Vantus by Cloud Scenic. Tech stack: single HTML file React CDN plus Babel around 1700 lines, Supabase, Google Drive API, Netlify. Surgical edits only. Personality: precise, technical, ships clean code.",
Sam: "You are Sam, Monitor Agent for the VitalLyfe Vantus by Cloud Scenic. Watch: system health, API spend, security, anomalies, pipeline metrics. Personality: methodical, data-driven, flags anything off immediately.",
Artgrid: "You are Artgrid, Footage Scout for the VitalLyfe Vantus by Cloud Scenic. Source B-roll from Artgrid.io. VitalLyfe visuals: warm neutrals, soft light, water in motion, wide landscapes. Never corporate or fake stock. Personality: visual, cinematic, precise search terms.",
Muse: "You are Muse, Content Ideation Agent for the VitalLyfe Vantus by Cloud Scenic. Write hooks, captions, scripts, calendars. Brand voice: cinematic, calm, purposeful. Key phrases: abundance, access, built for beyond. AVOID: revolutionary, game-changing, exclamation points. Caption structure: poetic statement then blank line then expand metaphor then blank line then bridge to brand then blank line then soft CTA like Join us (Link in bio). Always write real copy not descriptions.",
Overseer: "You are Overseer, SOP Guardian for the VitalLyfe Vantus by Cloud Scenic. Enforce 7-step SOP: Step 01 Discovery, Step 02 Copy Creation, Step 03 Footage Scouting, Step 04 Content Creation, Step 05 Client Review, Step 06 Revisions max 2 rounds, Step 07 Scheduling. Flag violations, cite step numbers. Rigorous but never alarmist.",
Scrappy: "You are Scrappy, Trend Scout for the VitalLyfe Vantus by Cloud Scenic. You scour the internet for content trends, viral hooks, competitor moves, and fresh angles — then hand the gems to Muse. You pull from Reddit, Hacker News, TikTok trends, and the wider wellness/tech space. VitalLyfe content pillars: Abundance, Access, Innovation, Startup Diaries, Tierra Bomba, Product Launch, Meet the Makers. Personality: sharp, fast, a little chaotic in a good way. You find things others miss. Short punchy reports. Lead with what's hot. Never vague — always specific signals with real context.",
  };
  const QUICK = {
Sean:     ["Pipeline Status", "Today's Priorities", "Delegate a Task", "Morning Briefing"],
Lacey:    ["Build a Workflow", "Draft an SOP", "Execution Plan", "EOD Checklist"],
Ali:      ["Debug an Issue", "Integration Plan", "Schema Review", "Code Review"],
Sam:      ["System Health Check", "Cost Report", "Security Audit", "Pipeline Metrics"],
Artgrid:  ["Scout Footage", "Mood Board Brief", "Review Clip Selections", "Build Shot List"],
Muse:     ["Write Hooks", "Draft Caption", "Content Calendar", "New Concept Ideas"],
Overseer: ["Full SOP Audit", "Compliance Check", "Brand Voice Review", "Approval Gate"],
Scrappy: ["What's trending this week?", "Competitor analysis", "Fresh hook ideas", "Muse collab brief"],
  };
  const DESC = {
Sean: "Orchestrates agents, owns pipeline priorities",
Lacey: "Automation workflows, deliverable execution, SOPs",
Ali: "Technical infrastructure, API integrations, builds",
Sam: "System monitoring, security, metrics, cost tracking",
Artgrid: "Cinematic footage sourcing, visual briefs, Artgrid.io",
Muse: "Copy, hooks, captions, content calendars, ideation",
Overseer: "SOP enforcement, brand voice compliance, audit",
Scrappy: "Live internet research, trend scouting, Muse monthly collab",
  };

  const [sel, setSel] = useState(agents[0]);
  const [hists, setHists] = useState(() => {
// Load last 10 messages per agent from localStorage on mount
try {
  const saved = localStorage.getItem("vantus_agent_hists");
  return saved ? JSON.parse(saved) : {};
} catch { return {}; }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const msgs = hists[sel.id] || [];

  // Persist last 10 messages per agent to localStorage
  useEffect(() => {
try {
  const trimmed = {};
  Object.keys(hists).forEach(k => { trimmed[k] = (hists[k] || []).slice(-10); });
  localStorage.setItem("vantus_agent_hists", JSON.stringify(trimmed));
} catch {}
  }, [hists]);

  const runAgentAction = async (action, payload = {}) => {
if (actionBusy) return;
setActionBusy(true);
const sysMsg = { role: "system", content: "⏳ Running action…", ts: Date.now(), loading: true };
setHists(h => ({ ...h, [sel.id]: [...(h[sel.id]||[]), sysMsg] }));
try {
  const res = await fetch("/api/agent-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentName: sel.name, action, payload }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  // Format result for display
  let display = d.message || "Action complete.";
  if (d.briefing) display += "\n\n" + d.briefing;
  if (d.report) display += "\n\n" + d.report;
  if (d.calendar) display += "\n\n" + d.calendar;
  if (d.preview) display += "\n\n" + d.preview;
  if (d.content) display += "\n\n" + d.content;
  if (d.flagged && d.flagged.length > 0) {
    display += "\n\n**Flagged Items:**\n" + d.flagged.map(f => `• "${f.title}" — ${f.violation} [${f.severity}]`).join("\n");
  }
  if (d.items && d.items.length > 0 && action === "lacey_advance") {
    display += "\n\n**Advanced:**\n" + d.items.map(i => `• ${i.title}`).join("\n");
  }
  if (d.metrics) {
    const m = d.metrics;
    display += `\n\n**Metrics:** ${m.total} total · ${m.missingCopy} missing captions · ${m.missingScript} missing scripts`;
    if (m.byStatus) display += "\n" + Object.entries(m.byStatus).map(([s,n]) => `${s}: ${n}`).join(" · ");
  }
  if (d.results && d.results.length > 0) {
    display += "\n\n" + d.results.map(r =>
      ` "${r.title}"\nSearch keywords:\n${(r.keywords || []).map(k => `   ${k}`).join("\n")}`
    ).join("\n\n");
    if (d.summary) display += "\n\n---\n" + d.summary;
  }
  // Scrappy research result
  if (d.report?.trendPulse) {
    display += `\n\n Trend Pulse: ${d.report.trendPulse}`;
    if (d.dataPoints) display += `\n Data: ${d.dataPoints.sources || 0} live sources · ${d.dataPoints.queries || 0} search queries`;
    if (d.summary) display += "\n\n" + d.summary;
    if (d.report.competitorMoves) display += `\n\n In the space right now:\n${d.report.competitorMoves}`;
    if (d.report.avoidZones?.length) display += `\n\n Avoid: ${d.report.avoidZones.join(", ")}`;
  }
  // Scrappy  Muse collab result
  if (d.contentIdeas && d.contentIdeas.length > 0) {
    display += `\n\n Trend Pulse: ${d.trendPulse || "—"}`;
    if (d.dataPoints) display += `\n Sources: ${d.dataPoints.sources || 0} live sources searched`;
    display += `\n\n Fresh Ideas (${d.contentIdeas.length}):\n` + d.summary;
  }
  const calendarItems = (action === "muse_generate_calendar" && d.items?.length > 0) ? d.items : null;
  setHists(h => {
    const thread = (h[sel.id]||[]).filter(m => !m.loading);
    return { ...h, [sel.id]: [...thread, { role: "system", content: display, ts: Date.now(), actionResult: true, calendarItems }] };
  });
} catch(e) {
  setHists(h => {
    const thread = (h[sel.id]||[]).filter(m => !m.loading);
    return { ...h, [sel.id]: [...thread, { role: "system", content: ` Action failed: ${e.message}`, ts: Date.now(), err: true }] };
  });
}
setActionBusy(false);
  };

  useEffect(() => {
if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [hists, sel.id]);

  const sendMsg = async (txt) => {
const text = (txt !== undefined ? txt : input).trim();
if (!text || busy) return;
setInput("");
const userMsg = { role: "user", content: text, ts: Date.now() };
const thread = [...msgs, userMsg];
setHists(h => ({ ...h, [sel.id]: thread }));
setBusy(true);
try {
  const ctx = content.length > 0 ? " Pipeline: " + content.slice(0,5).map(c => c.title + "[" + c.stage + "]").join(", ") : "";
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: buildSystemPrompt(sel.name, PROMPTS[sel.name]) + ctx,
      messages: thread.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
    }),
  });
  const d = await res.json();
  const blk = d.content && d.content.find(x => x.type === "text");
  setHists(h => ({ ...h, [sel.id]: [...thread, { role: "assistant", content: blk ? blk.text : "No response.", ts: Date.now() }] }));
  updateAgentMemory(sel.name, text, blk ? blk.text : '');
} catch(e) {
  setHists(h => ({ ...h, [sel.id]: [...thread, { role: "assistant", content: "Connection error. Try again.", ts: Date.now(), err: true }] }));
}
setBusy(false);
setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 80);
  };

  const caps = QUICK[sel.name] || [];

  return (
<div style={{ animation:"fadeIn 0.4s ease", display:"flex", flexDirection: isMobile ? "column" : "row", gap:16, height: isMobile ? "auto" : "calc(100vh - 80px)" }}>

  {/* Mobile: agent selector bar */}
  {isMobile && (
    <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, WebkitOverflowScrolling:"touch" }}>
      {agents.map(ag => {
        const active = sel.id === ag.id;
        return (
          <button key={ag.id} onClick={() => setSel(ag)}
            style={{ flexShrink:0, display:"flex", alignItems:"center", gap:7, background: active ? ag.color + "18" : "#111010", border:"1px solid " + (active ? ag.color + "40" : "rgba(255,255,255,0.08)"), borderRadius:20, padding:"7px 12px", cursor:"pointer" }}>
            <AgentAvatar agent={ag} size={22} />
            <span style={{ fontSize:12, fontWeight: active ? 700 : 400, color: active ? ag.color : "rgba(255,255,255,0.55)", whiteSpace:"nowrap", fontFamily:"Inter,sans-serif" }}>{ag.name}</span>
          </button>
        );
      })}
    </div>
  )}

  {/* Desktop: sidebar agent list */}
  {!isMobile && (
  <div style={{ width:210, flexShrink:0, display:"flex", flexDirection:"column", gap:6 }}>
    <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>7 Agents</div>
    {agents.map(ag => {
      const active = sel.id === ag.id;
      const chatted = (hists[ag.id] || []).length > 0;
      return (
        <div key={ag.id} onClick={() => setSel(ag)} className="hover-card" style={{ background: active ? ag.color + "18" : "#111010", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", border:"1px solid " + (active ? ag.color + "40" : "rgba(255,255,255,0.08)"), borderRadius:14, padding:"11px 13px", cursor:"pointer" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <AgentAvatar agent={ag} size={34} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontWeight:600, color:"#f5f5f7", fontSize:13 }}>{ag.name}</span>
                {chatted && <div style={{ width:5, height:5, borderRadius:"50%", background:ag.color }} />}
              </div>
              <div style={{ fontSize:10, color:ag.color, fontWeight:500, marginTop:1 }}>{ag.role}</div>
            </div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.05)", padding:"2px 6px", borderRadius:20, fontWeight:600 }}>{ag.type}</div>
          </div>
        </div>
      );
    })}
  </div>
  )}

  <div className="hover-card" style={{ flex:1, display:"flex", flexDirection:"column", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.13)", borderRadius:20, overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.07)" }}>
    <div style={{ padding:"16px 22px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:13, flexShrink:0 }}>
      <AgentAvatar agent={sel} size={42} />
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ fontWeight:700, color:"#f5f5f7", fontSize:15 }}>{sel.name}</span>
          <span style={{ fontSize:9, color:sel.color, background:sel.color + "15", padding:"3px 8px", borderRadius:20, fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>{sel.role}</span>
          <span style={{ fontSize:9, color:"rgba(48,209,88,0.8)", background:"rgba(48,209,88,0.1)", padding:"3px 8px", borderRadius:20, fontWeight:600 }}>LIVE</span>
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>{DESC[sel.name]}</div>
      </div>
      {msgs.length > 0 && <button onClick={() => setHists(h => { const n = { ...h, [sel.id]: [] }; try { const t={}; Object.keys(n).forEach(k=>{t[k]=(n[k]||[]).slice(-10);}); localStorage.setItem("vantus_agent_hists",JSON.stringify(t)); } catch {} return n; })} style={{ background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"rgba(255,255,255,0.35)", fontSize:11, cursor:"pointer", padding:"5px 11px", fontFamily:"Inter,sans-serif" }}>Clear</button>}
    </div>

    {/*  AGENT ACTION BUTTONS  */}
    {(sel.name === "Sean" || sel.name === "Muse" || sel.name === "Overseer" || sel.name === "Lacey" || sel.name === "Sam" || sel.name === "Artgrid" || sel.name === "Scrappy") && (
      <div style={{ padding:"8px 16px", borderBottom:"1px solid rgba(255,255,255,0.1)", display:"flex", gap:7, flexWrap:"wrap", background:"rgba(0,0,0,0.015)", flexShrink:0 }}>
        {sel.name === "Sean" && (
          <button onClick={() => runAgentAction("sean_briefing")} disabled={actionBusy}
            style={{ fontSize:11, fontWeight:600, color:"#2AABFF", background:"rgba(48,209,88,0.08)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:20, padding:"5px 12px", cursor:actionBusy?"default":"pointer", fontFamily:"Inter,sans-serif", opacity:actionBusy?0.5:1 }}>
            {actionBusy ? "⏳ Running…" : " Morning Briefing"}
          </button>
        )}
        {sel.name === "Muse" && (
          <button onClick={() => runAgentAction("muse_generate_calendar")} disabled={actionBusy}
            style={{ fontSize:11, fontWeight:600, color:"#ff375f", background:"rgba(255,55,95,0.08)", border:"1px solid rgba(255,55,95,0.2)", borderRadius:20, padding:"5px 12px", cursor:actionBusy?"default":"pointer", fontFamily:"Inter,sans-serif", opacity:actionBusy?0.5:1 }}>
            {actionBusy ? "⏳ Running…" : " Generate Calendar"}
          </button>
        )}
        {sel.name === "Overseer" && (
          <button onClick={() => runAgentAction("overseer_scan")} disabled={actionBusy}
            style={{ fontSize:11, fontWeight:600, color:"#64d2ff", background:"rgba(100,210,255,0.08)", border:"1px solid rgba(100,210,255,0.2)", borderRadius:20, padding:"5px 12px", cursor:actionBusy?"default":"pointer", fontFamily:"Inter,sans-serif", opacity:actionBusy?0.5:1 }}>
            {actionBusy ? "⏳ Running…" : " SOP Scan"}
          </button>
        )}
        {sel.name === "Lacey" && (<>
          <button onClick={() => runAgentAction("lacey_advance")} disabled={actionBusy}
            style={{ fontSize:11, fontWeight:600, color:"#ff9f0a", background:"rgba(255,159,10,0.08)", border:"1px solid rgba(255,159,10,0.2)", borderRadius:20, padding:"5px 12px", cursor:actionBusy?"default":"pointer", fontFamily:"Inter,sans-serif", opacity:actionBusy?0.5:1 }}>
            {actionBusy ? "⏳ Running…" : " Advance Pipeline"}
          </button>
          <button onClick={() => runAgentAction("lacey_trigger_n8n", { workflow: "vitallyfe-pipeline", message: "Triggered from Vantus", triggeredBy: "Lacey" })} disabled={actionBusy}
            style={{ fontSize:11, fontWeight:600, color:"#2AABFF", background:"rgba(48,209,88,0.08)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:20, padding:"5px 12px", cursor:actionBusy?"default":"pointer", fontFamily:"Inter,sans-serif", opacity:actionBusy?0.5:1, marginLeft:8 }}>
            {actionBusy ? "⏳ Running…" : " Trigger n8n"}
          </button>
        </>)}
        {sel.name === "Sam" && (
          <button onClick={() => runAgentAction("sam_health")} disabled={actionBusy}
            style={{ fontSize:11, fontWeight:600, color:"#ffd60a", background:"rgba(255,214,10,0.08)", border:"1px solid rgba(255,214,10,0.2)", borderRadius:20, padding:"5px 12px", cursor:actionBusy?"default":"pointer", fontFamily:"Inter,sans-serif", opacity:actionBusy?0.5:1 }}>
            {actionBusy ? "⏳ Running…" : " Health Check"}
          </button>
        )}
        {sel.name === "Artgrid" && (
          <button onClick={() => runAgentAction("artgrid_scout")} disabled={actionBusy}
            style={{ fontSize:11, fontWeight:600, color:"#2AABFF", background:"rgba(191,90,242,0.08)", border:"1px solid rgba(191,90,242,0.2)", borderRadius:20, padding:"5px 12px", cursor:actionBusy?"default":"pointer", fontFamily:"Inter,sans-serif", opacity:actionBusy?0.5:1 }}>
            {actionBusy ? "⏳ Scouting…" : " Scout All Video Items"}
          </button>
        )}
        {sel.name === "Scrappy" && (<>
          <button onClick={() => runAgentAction("scrappy_research")} disabled={actionBusy}
            style={{ fontSize:11, fontWeight:600, color:"#5e5ce6", background:"rgba(94,92,230,0.08)", border:"1px solid rgba(94,92,230,0.2)", borderRadius:20, padding:"5px 12px", cursor:actionBusy?"default":"pointer", fontFamily:"Inter,sans-serif", opacity:actionBusy?0.5:1 }}>
            {actionBusy ? "⏳ Scraping…" : " Research Trends"}
          </button>
          <button onClick={() => runAgentAction("scrappy_muse_collab")} disabled={actionBusy}
            style={{ fontSize:11, fontWeight:600, color:"#ff375f", background:"rgba(255,55,95,0.08)", border:"1px solid rgba(255,55,95,0.2)", borderRadius:20, padding:"5px 12px", cursor:actionBusy?"default":"pointer", fontFamily:"Inter,sans-serif", opacity:actionBusy?0.5:1 }}>
            {actionBusy ? "⏳ Collaborating…" : " Scrappy  Muse"}
          </button>
        </>)}
      </div>
    )}

    <div style={{ flex:1, overflowY:"auto", padding:"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>
      {msgs.length === 0 && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:56, height:56, borderRadius:17, background:sel.grad, border:"2px solid " + sel.color + "40", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, color:sel.color, marginBottom:14 }}>{sel.name[0]}</div>
          <div style={{ fontSize:16, fontWeight:600, color:"#f5f5f7", marginBottom:5 }}>Chat with {sel.name}</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:24, textAlign:"center", maxWidth:280, lineHeight:1.6 }}>Loaded with full VitalLyfe context and SOP knowledge.</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, width:"100%", maxWidth:420 }}>
            {caps.map((cap, i) => (
              <button key={i} onClick={() => sendMsg(cap)} style={{ background:sel.color + "08", border:"1px solid " + sel.color + "25", borderRadius:11, padding:"11px 13px", cursor:"pointer", textAlign:"left", fontFamily:"Inter,sans-serif" }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#f5f5f7" }}>{cap}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {msgs.map((m, i) => {
        // System / action result messages
        if (m.role === "system") {
          return (
            <div key={i} style={{ borderRadius:14, padding:"12px 16px", background: m.err ? "rgba(255,69,58,0.06)" : "rgba(48,209,88,0.06)", border:"1px solid " + (m.err ? "rgba(255,69,58,0.18)" : "rgba(48,209,88,0.18)"), animation:"slideIn 0.3s ease" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:m.loading ? 0 : 8 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background: m.err ? "#ff453a" : "#2AABFF", animation: m.loading ? "livePulse 1s infinite" : "none" }} />
                <span style={{ fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", color: m.err ? "#ff453a" : "#2AABFF" }}>{m.loading ? "Agent Running…" : "Agent Action Result"}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", marginLeft:"auto" }}>{new Date(m.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</span>
              </div>
              {!m.loading && <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)", lineHeight:1.7, whiteSpace:"pre-wrap", fontFamily:"Inter,sans-serif" }}>{m.content}</div>}
              {!m.loading && m.calendarItems && m.calendarItems.length > 0 && (
                <CalendarSaveButton items={m.calendarItems} />
              )}
            </div>
          );
        }
        // Regular chat messages
        const looksLikeCaption = m.role === "assistant" && sel.name === "Muse" && (m.content.includes("#") || m.content.split("\n").length > 3);
        return (
          <div key={i} style={{ display:"flex", gap:9, flexDirection:m.role === "user" ? "row-reverse" : "row", alignItems:"flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width:28, height:28, borderRadius:8, background:sel.grad, border:"1px solid " + sel.color + "40", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:sel.color, flexShrink:0, marginTop:2 }}>{sel.name[0]}</div>
            )}
            <div style={{ maxWidth:"76%" }}>
              <div style={{ background:m.role === "user" ? "#0f0f1a" : m.err ? "rgba(255,69,58,0.07)" : "#1a1818", border:m.role === "user" ? "none" : "1px solid " + (m.err ? "rgba(255,69,58,0.18)" : "rgba(255,255,255,0.07)"), borderRadius:m.role === "user" ? "15px 15px 3px 15px" : "3px 15px 15px 15px", padding:"10px 13px" }}>
                <div style={{ fontSize:13, color:m.role === "user" ? "#fff" : m.err ? "#ff453a" : "#1a1a2e", lineHeight:1.65, whiteSpace:"pre-wrap", fontFamily:"Inter,sans-serif" }}>{m.content}</div>
                <div style={{ fontSize:9, color:m.role === "user" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.22)", marginTop:4, textAlign:m.role === "user" ? "right" : "left" }}>{new Date(m.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</div>
              </div>
              {looksLikeCaption && (
                <div style={{ marginTop:6, display:"flex", gap:6 }}>
                  <button onClick={() => { navigator.clipboard.writeText(m.content).catch(()=>{}); }}
                    style={{ fontSize:10, fontWeight:600, color:"#ff375f", background:"rgba(255,55,95,0.08)", border:"1px solid rgba(255,55,95,0.2)", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                     Copy Caption
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {busy && (
        <div style={{ display:"flex", gap:9, alignItems:"flex-start" }}>
          <div style={{ width:28, height:28, borderRadius:8, background:sel.grad, border:"1px solid " + sel.color + "40", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:sel.color, flexShrink:0 }}>{sel.name[0]}</div>
          <div style={{ background:"#1a1818", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"3px 15px 15px 15px", padding:"11px 15px", display:"flex", gap:4, alignItems:"center" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:sel.color, animation:"livePulse 1.2s ease-in-out 0s infinite" }} />
            <div style={{ width:6, height:6, borderRadius:"50%", background:sel.color, animation:"livePulse 1.2s ease-in-out 0.2s infinite" }} />
            <div style={{ width:6, height:6, borderRadius:"50%", background:sel.color, animation:"livePulse 1.2s ease-in-out 0.4s infinite" }} />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>

    {msgs.length > 0 && (
      <div style={{ padding:"8px 16px", display:"flex", gap:5, flexWrap:"wrap", borderTop:"1px solid rgba(0,0,0,0.05)", flexShrink:0 }}>
        {caps.map((cap, i) => (
          <button key={i} onClick={() => sendMsg(cap)} disabled={busy} style={{ background:sel.color + "08", border:"1px solid " + sel.color + "20", borderRadius:20, padding:"4px 11px", cursor:busy ? "default" : "pointer", fontFamily:"Inter,sans-serif", fontSize:11, fontWeight:500, color:sel.color, opacity:busy ? 0.5 : 1 }}>{cap}</button>
        ))}
      </div>
    )}

    <div style={{ padding: isMobile ? "10px 12px" : "12px 16px", borderTop:"1px solid rgba(0,0,0,0.07)", display:"flex", gap:9, flexShrink:0, paddingBottom: isMobile ? "max(10px, env(safe-area-inset-bottom, 10px))" : "12px" }}>
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
        placeholder={"Message " + sel.name + "..."}
        disabled={busy}
        style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid " + (input ? sel.color + "40" : "rgba(0,0,0,0.1)"), borderRadius:11, padding: isMobile ? "12px 14px" : "10px 15px", color:"#f5f5f7", fontSize:isMobile ? 16 : 13, outline:"none", fontFamily:"Inter,sans-serif" }}
      />
      <button
        onClick={() => sendMsg()}
        disabled={!input.trim() || busy}
        style={{ background:input.trim() && !busy ? sel.color : "rgba(255,255,255,0.07)", border:"none", borderRadius:11, color:input.trim() && !busy ? "#fff" : "rgba(255,255,255,0.3)", cursor:input.trim() && !busy ? "pointer" : "default", padding: isMobile ? "12px 20px" : "10px 18px", fontSize:17, transition:"all 0.2s", fontFamily:"Inter,sans-serif", minWidth: isMobile ? 52 : "auto" }}>
        {"\u2191"}
      </button>
    </div>
  </div>
</div>
  );
}
