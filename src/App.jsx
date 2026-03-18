import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';

// ── Extracted modules ──
import { sb, DB_CONNECTED } from './services/supabaseClient.js';
import { getIsMobile, useIsMobile, useInterval } from './utils/hooks.js';
import { NAV, STATUS_COLOR, STAGE_SHORT, STATUSES, FORMATS, PILLARS_LIST, PLATFORMS_LIST, CAMPAIGNS } from './utils/constants.js';
import { INITIAL_CONTENT, VITAL_LYFE_SOP } from './data/seed.content.js';
import { AGENTS_BASE, AGENT_TASKS, ACTION_COLORS, ACTIVITY_POOL } from './data/seed.agents.js';
import { OPS_INIT } from './data/seed.ops.js';
import { getMemory, setMemory, buildSystemPrompt, updateAgentMemory } from './core/memory.js';
import { AGENT_KEYWORDS, ROUTE_PROMPTS } from './core/agentRegistry.js';
import { routeTask } from './core/routeTask.js';
import { DEFAULT_APPS, loadApps } from './apps/apps.config.js';
import AppPlaceholder from './ui/shared/AppPlaceholder.jsx';

// ── Extracted UI components (Phase 3) ──
import AgentAvatar from './ui/shared/AgentAvatar.jsx';
import Card from './ui/shared/Card.jsx';
import MetricCard from './ui/shared/MetricCard.jsx';
import AgentCard from './ui/shared/AgentCard.jsx';
import QuickActionsDashboard from './ui/dashboard/QuickActionsDashboard.jsx';
import CommandInput from './ui/dashboard/CommandInput.jsx';
import AppsPage from './ui/apps/AppsPage.jsx';
import ReferencesPage from './apps/references/ReferencesPage.jsx';
import SkillsPage from './apps/skills/SkillsPage.jsx';
import AdROIHub from './apps/ad-roi/AdROIHub.jsx';
import TeamBroadcast from './ui/agents/TeamBroadcast.jsx';
import ArtgridScoutPage from './apps/artgrid/ArtgridScoutPage.jsx';
import AgentChatPage from './ui/agents/AgentChatPage.jsx';
import EditContentModal from './ui/pipeline/EditContentModal.jsx';
import CIDPage from './apps/competitor-intel/CIDPage.jsx';
import ICPPage from './ui/command/ICPPage.jsx';
import LoginScreen from './ui/layout/LoginScreen.jsx';
import ClientView from './ui/client/ClientView.jsx';
import SettingsPage from './ui/settings/SettingsPage.jsx';

//  ROOT APP WRAPPER 
function App() {
  const [session, setSession] = useState(null);
  const [role, setRole]       = useState(null);
  const [checking, setChecking] = useState(true);
  const [content, setContent] = useState([]);

  useEffect(() => {
    // Check existing session on load
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        const ADMIN_EMAILS = ["cz@cloudscenic.com","dv@cloudscenic.com","ss@cloudscenic.com"];
        const { data: profile } = await sb.from("profiles").select("role").eq("id", s.user.id).single();
        const detectedRole = profile?.role || (ADMIN_EMAILS.includes(s.user.email) ? "admin" : "client");
        const { data: items } = await sb.from("content_items").select("*").order("id");
        if (items) setContent(items.map(r => ({ ...r, platforms: r.platforms || [] })));
        setSession(s); setRole(detectedRole);
      }
      setChecking(false);
    });
    sb.auth.onAuthStateChange((_e, s) => { if (!s) { setSession(null); setRole(null); } });
  }, []);

  const handleLogin = async (user, r) => {
    // Load content on fresh login
    if (sb) {
      const { data: items } = await sb.from("content_items").select("*").order("id");
      if (items && items.length > 0) setContent(items.map(row => ({ ...row, platforms: row.platforms || [] })));
    }
    setSession({ user }); setRole(r);
  };
  const handleSignOut = async () => { await sb.auth.signOut(); setSession(null); setRole(null); };

  if (checking) return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 1.5s ease-in-out infinite" }} />
    </div>
  );
  if (!session) return <LoginScreen onLogin={handleLogin} />;
  if (role === "client") return <ClientView user={session.user} content={content} setContent={setContent} onSignOut={handleSignOut} />;
  return <Vantus onSignOut={handleSignOut} userEmail={session.user?.email} content={content} setContent={setContent} />;
}
// 


const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@400;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap";
document.head.appendChild(fontLink);





function TypingTask({ text, color }) {
  const [displayed, setDisplayed] = useState("");
  const [idx, setIdx] = useState(0);
  useEffect(() => { setDisplayed(""); setIdx(0); }, [text]);
  useEffect(() => {
if (idx >= text.length) return;
const id = setTimeout(() => { setDisplayed(text.slice(0, idx+1)); setIdx(i => i+1); }, 16 + Math.random()*12);
return () => clearTimeout(id);
  }, [idx, text]);
  return <span style={{ color, fontSize:11, letterSpacing:0.1 }}>{displayed}{idx < text.length ? <span style={{ animation:"blink 0.7s step-end infinite", color }}>|</span> : null}</span>;
}
function OpsBoard() {
  const isMobile = useIsMobile();
  const [ops, setOps] = useState(OPS_INIT);
  const [newTask, setNewTask] = useState("");
  useInterval(() => {
setOps(prev => {
  if (prev.backlog.length===0) return prev;
  const task = prev.backlog[0];
  return { ...prev, backlog:prev.backlog.slice(1), inProgress:[...prev.inProgress,{ ...task, id:task.id+"_m" }] };
});
  }, 20000);
  useInterval(() => {
setOps(prev => {
  if (prev.inProgress.length===0) return prev;
  const task = prev.inProgress[0];
  return { ...prev, inProgress:prev.inProgress.slice(1), completed:[{ ...task, id:task.id+"_d" },...prev.completed].slice(0,8) };
});
  }, 28000);
  const addTask = () => {
if (!newTask.trim()) return;
setOps(prev => ({ ...prev, backlog:[...prev.backlog,{ id:Date.now().toString(), title:newTask, agent:"Unassigned" }] }));
setNewTask("");
  };
  const cols = [{ key:"backlog", label:"Backlog", color:"rgba(255,255,255,0.5)" }, { key:"inProgress", label:"In Progress", color:"#ff9f0a" }, { key:"completed", label:"Completed", color:"#2AABFF" }];
  return (
<div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:12 }}>
  {cols.map(col => (
    <div key={col.key} style={{ flex:1 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.6)" }}>{col.label}</span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.07)", padding:"2px 8px", borderRadius:20, fontWeight:500 }}>{ops[col.key].length}</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {ops[col.key].map((task,i) => (
          <Card key={task.id} style={{ padding:"12px 14px", borderLeft:"3px solid rgba(255,255,255,0.08)", borderRadius:12, animation:i===0&&col.key==="inProgress"?"slideIn 0.3s ease":"none" }}>
            <div style={{ fontSize:12, color:"#ffffff", fontWeight:500, marginBottom:4, lineHeight:1.4 }}>{task.title}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{task.agent}</div>
            {col.key==="inProgress" && <div style={{ marginTop:10, height:2, background:"rgba(255,255,255,0.05)", borderRadius:2 }}><div style={{ height:"100%", width:"55%", background:"rgba(255,255,255,0.2)", borderRadius:2, animation:"progressBar 28s linear forwards" }} /></div>}
          </Card>
        ))}
        {col.key==="backlog" && (
          <div style={{ display:"flex", gap:6 }}>
            <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key==="Enter" && addTask()} placeholder="Add task..." style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"8px 12px", color:"#ffffff", fontSize:11, outline:"none", fontFamily:"Inter, sans-serif" }} />
            <button onClick={addTask} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"rgba(255,255,255,0.6)", cursor:"pointer", padding:"8px 14px", fontSize:14, fontWeight:400 }}>+</button>
          </div>
        )}
      </div>
    </div>
  ))}
</div>
  );
}
function ActivityFeed({ feed }) {
  return (
<div style={{ height:"auto", overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }}>
  {feed.map((item,i) => (
    <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 12px", background:i===0?`${ACTION_COLORS[item.type]}0a`:"transparent", borderRadius:8, borderLeft:i===0?`2px solid ${ACTION_COLORS[item.type]}`:"2px solid transparent", animation:i===0?"slideIn 0.3s ease":"none", transition:"all 0.3s" }}>
      <span style={{ fontSize:9, color:"rgba(255,255,255,0.55)", whiteSpace:"nowrap" }}>{item.time}</span>
      <span style={{ fontSize:10, color:ACTION_COLORS[item.type], fontWeight:700, whiteSpace:"nowrap" }}>{item.agent}</span>
      <span style={{ fontSize:10, color:"rgba(255,255,255,0.75)" }}>{item.action}</span>
    </div>
  ))}
</div>
  );
}

//  CONTENT PIPELINE BOARD (clickable cards) 
function ContentPipelineBoard({ title, icon, stages, stageColors, items, onCardClick, onMuseWrite }) {
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

function PlaceholderPage({ icon, title, badge, desc }) {
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

function Vantus({ onSignOut, userEmail, content: contentProp, setContent: setContentProp }) {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [feed, setFeed] = useState([]);
  const [agents] = useState(AGENTS_BASE);
  const [liveCount, setLiveCount] = useState(6);
  const [previewMode, setPreviewMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [trackerSearch, setTrackerSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPillar, setFilterPillar] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPos, setNotifPos] = useState({ x: window.innerWidth - 320, y: 60 });
  const [aiEnabled, setAiEnabled] = useState(() => {
try { return localStorage.getItem("vantus_ai_enabled") !== "false"; } catch { return true; }
  });
  const [apps, setApps] = useState(() => loadApps());
  useEffect(() => {
    localStorage.setItem('vantus_apps', JSON.stringify(apps));
  }, [apps]);
  const toggleApp = (id) => {
setApps(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };
  const toggleAI = () => {
const next = !aiEnabled;
setAiEnabled(next);
try { localStorage.setItem("vantus_ai_enabled", String(next)); } catch {}
document.body.classList.toggle("ai-disabled", !next);
  };
  // Sync body class on mount
  useEffect(() => {
document.body.classList.toggle("ai-disabled", !aiEnabled);
  }, []);
  // Global AI gate — all agent/chat calls check this ref before firing
  const aiEnabledRef = React.useRef(aiEnabled);
  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);
  const safeAgentFetch = async (url, opts) => {
if (!aiEnabledRef.current) throw new Error("AI_DISABLED");
return fetch(url, opts);
  };
  const notifDragRef = React.useRef(null);
  const notifDragging = React.useRef(false);
  const notifDragOffset = React.useRef({ x: 0, y: 0 });
  // Use content from App (shared with ClientView) — fall back to local state only if not passed in
  const [localContent, setLocalContent] = useState([]);
  const content = contentProp ?? localContent;
  const setContent = setContentProp ?? setLocalContent;
  const [dbStatus, setDbStatus] = useState(DB_CONNECTED ? "connecting" : "offline");

  //  SUPABASE REALTIME SUBSCRIPTION 
  // App-level already handles initial load. Vantus only handles realtime sync + fallback.
  useEffect(() => {
// Pre-seed Muse memory
if (!getMemory('Muse').brand) {
  setMemory('Muse', {
    brand: 'VitalLyfe',
    niche: 'hydration wellness water autonomy',
    tone: 'cinematic calm purposeful never corporate',
    campaigns: ['Drip Campaign', 'Meet the Makers', 'Product Launch'],
    pillars: ['Abundance', 'Access', 'Innovation', 'Tierra Bomba', 'Startup Diaries'],
  });
}
if (!sb) return;

// If no content was passed in from App (standalone mode or content not yet loaded), load it ourselves
if (!contentProp || contentProp.length === 0) {
  sb.from("content_items").select("*").order("id")
    .then(({ data, error }) => {
      if (error) { setDbStatus("error"); return; }
      if (data && data.length > 0) {
        setContent(data.map(r => ({ ...r, platforms: r.platforms || [] })));
      } else {
        setContent([]);
      }
      setDbStatus("live");
    });
} else {
  setDbStatus("live");
}

// Realtime subscription always runs
const channel = sb.channel("content_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "content_items" },
    (payload) => {
      if (payload.eventType === "UPDATE") {
        setContent(prev => prev.map(x =>
          x.id === payload.new.id ? { ...payload.new, platforms: payload.new.platforms || [] } : x
        ));
        // Detect client actions and fire notification
        const newStatus = payload.new?.status;
        const oldStatus = payload.old?.status;
        const clientStatuses = ["Approved", "Needs Revisions"];
        if (clientStatuses.includes(newStatus) && newStatus !== oldStatus) {
          const type = newStatus === "Approved" ? "approved" : "revision_requested";
          const notif = {
            id: Date.now(),
            type,
            item: payload.new,
            ts: Date.now(),
            read: false,
          };
          setNotifications(prev => [notif, ...prev].slice(0, 30));
          // Fire n8n webhook via /api/notify
          fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, item: payload.new }),
          }).catch(() => {});
        }
      }
      if (payload.eventType === "INSERT") {
        setContent(prev => [...prev, { ...payload.new, platforms: payload.new.platforms || [] }]);
      }
      if (payload.eventType === "DELETE") {
        setContent(prev => prev.filter(x => x.id !== payload.old.id));
      }
    }
  ).subscribe();
return () => sb.removeChannel(channel);
  }, []);
  const [editingItem, setEditingItem] = useState(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const feedIdRef = useRef(0);

  const getNewItemTemplate = () => ({
id: `vl-${Date.now()}`,
platform: "instagram",
type: "reel",
stage: "Ready For Copy Creation",
campaign: "Drip Campaign",
status: "Ready For Copy Creation",
format: "Reel",
pillar: "Abundance",
platforms: ["IG"],
title: "",
description: "",
script: "",
caption: "",
cta: "Join us (Link in bio)",
seoKeywords: "",
hashtags: "",
startWeek: 1,
duration: 1,
notes: "",
files: [],
  });

  const handleAddNew = () => {
setEditingItem(getNewItemTemplate());
setIsNewItem(true);
  };

  const now = () => {
const d = new Date();
return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
  };
  const pushFeed = useCallback(() => {
const item = ACTIVITY_POOL[Math.floor(Math.random()*ACTIVITY_POOL.length)];
setFeed(prev => [{ ...item, time:now(), id:feedIdRef.current++ }, ...prev].slice(0,60));
  }, []);

  useEffect(() => { if (aiEnabled) { for (let i=0; i<10; i++) setTimeout(pushFeed, i*150); } }, [aiEnabled]);
  useInterval(pushFeed, aiEnabled ? 2200 : null);

  // Draggable notification panel
  useEffect(() => {
const onMove = (e) => {
  if (!notifDragging.current) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = Math.max(0, Math.min(window.innerWidth - 300, clientX - notifDragOffset.current.x));
  const y = Math.max(0, Math.min(window.innerHeight - 100, clientY - notifDragOffset.current.y));
  // Move via DOM directly — zero re-renders during drag
  if (notifDragRef.current) {
    notifDragRef.current.style.left = x + "px";
    notifDragRef.current.style.top = y + "px";
    notifDragRef.current.style.transition = "none";
  }
  notifDragOffset.current._lastX = x;
  notifDragOffset.current._lastY = y;
};
const onUp = () => {
  if (!notifDragging.current) return;
  notifDragging.current = false;
  // Commit final position to state so React knows where it is
  if (notifDragOffset.current._lastX !== undefined) {
    setNotifPos({ x: notifDragOffset.current._lastX, y: notifDragOffset.current._lastY });
  }
  if (notifDragRef.current) notifDragRef.current.style.transition = "";
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
};
document.addEventListener("mousemove", onMove);
document.addEventListener("mouseup", onUp);
document.addEventListener("touchmove", onMove, { passive: false });
document.addEventListener("touchend", onUp);
return () => {
  document.removeEventListener("mousemove", onMove);
  document.removeEventListener("mouseup", onUp);
  document.removeEventListener("touchmove", onMove);
  document.removeEventListener("touchend", onUp);
};
  }, []);
  useInterval(() => setLiveCount(Math.floor(Math.random()*2)+6), aiEnabled ? 15000 : null);

  const handleSave = (updated) => {
// Derive platform (singular) and type from platforms array + format
const platformMap = { IG: "instagram", TT: "tiktok", YT: "youtube" };
const typeMap = { "Reel": "reel", "Graphics (IMG)": "graphic", "Carousel": "carousel", "Thread": "thread", "Story": "story", "YouTube": "youtube", "Short": "short" };
const primaryPlatform = updated.platforms && updated.platforms.length > 0
  ? (platformMap[updated.platforms[0]] || "instagram") : (updated.platform || "instagram");
const itemType = typeMap[updated.format] || updated.type || "reel";
const item = { ...updated, stage: updated.status, platform: primaryPlatform, type: itemType };

if (isNewItem) {
  setContent(prev => [...prev, item]);
  if (sb) {
    sb.from("content_items").insert(item)
      .then(({ error }) => { if (error) console.warn("Supabase insert error:", error.message); });
  }
} else {
  setContent(prev => prev.map(x => x.id === item.id ? item : x));
  if (sb) {
    sb.from("content_items").update(item).eq("id", item.id)
      .then(({ error }) => { if (error) console.warn("Supabase save error:", error.message); });
  }
}
setEditingItem(null);
setIsNewItem(false);
  };

  const handleDuplicate = (item) => {
const copy = {
  ...item,
  id: `vl-${Date.now()}`,
  title: `Copy of ${item.title}`,
  status: "Ready For Copy Creation",
  stage: "Ready For Copy Creation",
  caption: "",
  script: "",
  publish_date: "",
  client_note: "",
  files: [],
};
setContent(prev => [...prev, copy]);
setEditingItem(null);
setIsNewItem(false);
if (sb) {
  sb.from("content_items").insert(copy)
    .then(({ error }) => { if (error) console.warn("Supabase duplicate error:", error.message); });
}
  };

  const handleDelete = (itemId) => {
if (!window.confirm("Delete this content item? This cannot be undone.")) return;
setContent(prev => prev.filter(x => x.id !== itemId));
setEditingItem(null);
setIsNewItem(false);
if (sb) {
  sb.from("content_items").delete().eq("id", itemId)
    .then(({ error }) => { if (error) console.warn("Supabase delete error:", error.message); });
}
  };

  const [museToast, setMuseToast] = useState(null);
  const handleMuseWrite = async (item, field) => {
setMuseToast({ id: item.id, field, status: "writing" });
try {
  const res = await fetch("/api/agent-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "muse_write_content",
      payload: { itemId: item.id, itemTitle: item.title, pillar: item.pillar, format: item.format, description: item.description, fieldToUpdate: field },
    }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  // Update local content state
  setContent(prev => prev.map(x => x.id === item.id ? { ...x, [field]: d.content } : x));
  setMuseToast({ id: item.id, field, status: "done", content: d.content });
  setTimeout(() => setMuseToast(null), 4000);
} catch(e) {
  setMuseToast({ id: item.id, field, status: "error", msg: e.message });
  setTimeout(() => setMuseToast(null), 4000);
}
  };

  const sidebarW = 220;
  const igItems = content.filter(x => x.platform === "instagram");
  const ttItems = content.filter(x => x.platform === "tiktok");
  const ytItems = content.filter(x => x.platform === "youtube");

  //  PREVIEW MODE — renders ClientView inside an overlay 
  if (previewMode) {
return (
  <div style={{ position:"relative", minHeight:"100vh" }}>
    <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:9999, background:"#0f0f1a", borderBottom:"2px solid #2AABFF", padding:"0 20px", height:44, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2s infinite" }} />
        <span style={{ fontSize:12, fontWeight:700, color:"#2AABFF", letterSpacing:0.3 }}>PREVIEW MODE</span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>— You're seeing exactly what the client sees</span>
      </div>
      <button onClick={() => setPreviewMode(false)} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, color:"#fff", fontSize:12, fontWeight:600, padding:"6px 16px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
        ← Exit Preview
      </button>
    </div>
    <div style={{ paddingTop:44 }}>
      <ClientView user={{ email: userEmail || "client@vitallyfe.com" }} content={content} setContent={setContent} onSignOut={() => setPreviewMode(false)} isPreview={true} />
    </div>
  </div>
);
  }

  return (
<div className="vantus-grid-bg" style={{ display:"flex", height: isMobile ? "100dvh" : "100vh", background:"#0d0907", color:"#f5f5f7", fontFamily:"-apple-system, 'SF Pro Display', Inter, sans-serif", overflow:"hidden", flexDirection: isMobile ? "column" : "row", position:"relative" }}>
  {/* Atmospheric glow — matches login page */}
  <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", background:"radial-gradient(ellipse 80% 50% at 50% 100%, rgba(120,60,20,0.18) 0%, rgba(80,30,10,0.10) 40%, transparent 70%)" }} />
  <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", background:"radial-gradient(ellipse 40% 30% at 20% 100%, rgba(100,45,15,0.12) 0%, transparent 60%)" }} />
  {/*  MUSE TOAST  */}
  {museToast && (
    <div style={{ position:"fixed", bottom: isMobile ? "calc(72px + env(safe-area-inset-bottom, 0px))" : 28, right: isMobile ? 16 : 28, zIndex:9999, animation:"slideIn 0.3s ease", maxWidth: isMobile ? "calc(100vw - 32px)" : 380 }}>
      <div style={{ background: museToast.status==="error" ? "#1a1818" : "#1a1818", border:`1px solid ${museToast.status==="error"?"rgba(255,69,58,0.3)":museToast.status==="done"?"rgba(255,55,95,0.3)":"rgba(255,55,95,0.2)"}`, borderRadius:14, padding:"14px 18px", boxShadow:"0 8px 32px rgba(0,0,0,0.12)", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background: museToast.status==="error"?"#ff453a":"#ff375f", flexShrink:0, animation: museToast.status==="writing"?"livePulse 1s infinite":"none" }} />
        <div>
          <div style={{ fontSize:12, fontWeight:600, color: museToast.status==="error"?"#ff453a":"#ff375f" }}>
            {museToast.status==="writing" ? ` Muse is writing ${museToast.field}…` : museToast.status==="done" ? ` ${museToast.field === "caption" ? "Caption" : "Script"} saved` : ` ${museToast.msg}`}
          </div>
          {museToast.status==="done" && <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginTop:3, lineHeight:1.5, maxWidth:280, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{museToast.content?.slice(0,60)}…</div>}
        </div>
      </div>
    </div>
  )}
  <style>{`
    @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.35)} }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes slideIn { from{transform:translateY(-4px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes progressBar { from{width:5%} to{width:95%} }
    ::-webkit-scrollbar { width:3px; height:3px }
    ::-webkit-scrollbar-track { background:transparent }
    ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.1); border-radius:99px }
    * { box-sizing:border-box; -webkit-font-smoothing:antialiased }
    button { font-family:-apple-system, Inter, sans-serif }
    input::placeholder { color:rgba(255,255,255,0.22) }
    textarea::placeholder { color:rgba(255,255,255,0.2); font-style:italic }
    h1,h2,h3 { letter-spacing:-0.5px }
    .mobile-scroll { -webkit-overflow-scrolling:touch; overflow-x:auto; }
    .mobile-tap { -webkit-tap-highlight-color:transparent; }
    .mobile-card:active { opacity:0.8; transform:scale(0.98); transition:all 0.1s; }
    .glass-btn {
      transition: all 0.18s cubic-bezier(0.4,0,0.2,1) !important;
      position: relative;
    }
    .glass-btn:hover:not(:disabled) {
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35) !important;
      transform: translateY(-1px) scale(1.03) !important;
      filter: brightness(1.15) !important;
    }
    .glass-btn:active:not(:disabled) {
      transform: translateY(0) scale(0.97) !important;
      filter: brightness(0.95) !important;
    }
    button:hover:not(:disabled) {
      filter: brightness(1.08);
      transition: all 0.16s cubic-bezier(0.4,0,0.2,1);
    }
    button:active:not(:disabled) {
      transform: scale(0.97);
    }
    .hover-card {
      transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s cubic-bezier(0.4,0,0.2,1), background 0.2s, border-color 0.2s !important;
    }
    .hover-card:hover {
      transform: translateY(-3px) !important;
      box-shadow: 0 0 0 1px rgba(42,171,255,0.4), 0 8px 32px rgba(42,171,255,0.15), 0 4px 16px rgba(0,0,0,0.3) !important;
      background: rgba(255,255,255,0.09) !important;
      border-color: rgba(42,171,255,0.35) !important;
    }
    .hover-card:active {
      transform: translateY(-1px) scale(0.99) !important;
    }
  `}</style>

  {editingItem && <EditContentModal item={editingItem} isNew={isNewItem} onSave={handleSave} onDelete={handleDelete} onDuplicate={handleDuplicate} onClose={() => { setEditingItem(null); setIsNewItem(false); }} />}

  <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, display:"none" }} />

  {/*  MOBILE TOP BAR  */}
  {isMobile && (
    <div style={{ height:52, background:"#0e0c0d", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", padding:"0 16px", gap:12, zIndex:50, flexShrink:0, paddingTop:"env(safe-area-inset-top,0)" }}>
      <div style={{ width:30, height:30, borderRadius:8, background:"#161414", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <img src="data:image/png;base64,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" style={{ width:"100%", height:"100%", objectFit:"contain", padding:3 }} />
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#f5f5f7", letterSpacing:-0.3 }}>Vantus</div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:4, height:4, borderRadius:"50%", background: dbStatus==="live"?"#2AABFF":"#ff453a" }} />
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontWeight:500, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Geist Mono',monospace" }}>VitalLyfe</span>
        </div>
      </div>
      <button onClick={() => setMobileNavOpen(o => !o)}
        style={{ background:"#161414", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f5f5f7", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16 }}>
        {mobileNavOpen ? "" : ""}
      </button>
    </div>
  )}

  {/*  MOBILE NAV DRAWER  */}
  {isMobile && mobileNavOpen && (
    <div style={{ position:"fixed", inset:0, zIndex:200 }} onClick={() => setMobileNavOpen(false)}>
      <div style={{ position:"absolute", top:52, left:0, right:0, background:"#0e0c0d", borderBottom:"1px solid rgba(255,255,255,0.08)", animation:"slideUp 0.2s ease", maxHeight:"80vh", overflowY:"auto" }}
        onClick={e => e.stopPropagation()}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <div style={{ padding:"10px 20px 4px", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.25)", letterSpacing:2, textTransform:"uppercase", fontFamily:"'Geist Mono',monospace" }}>{section}</div>
            {items.map(item => (
              <React.Fragment key={item.id}>
                <button onClick={() => { setActiveNav(item.id); setMobileNavOpen(false); }}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"13px 20px", background: activeNav===item.id ? "rgba(42,171,255,0.08)" : "none", border:"none", borderLeft: activeNav===item.id ? "2px solid #2AABFF" : "2px solid transparent", color: activeNav===item.id ? "#2AABFF" : "rgba(255,255,255,0.65)", fontSize:13, fontWeight: activeNav===item.id ? 600 : 400, cursor:"pointer", textAlign:"left", fontFamily:"Inter,sans-serif" }}>
                  {item.label}
                </button>
                {item.id === "apps" && apps.filter(a => a.enabled).map(app => (
                  <button key={app.id} onClick={() => { setActiveNav(app.id); setMobileNavOpen(false); }}
                    style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"10px 20px 10px 36px", background: activeNav===app.id ? "rgba(42,171,255,0.08)" : "none", border:"none", borderLeft: activeNav===app.id ? "2px solid #2AABFF" : "2px solid transparent", color: activeNav===app.id ? "#2AABFF" : "rgba(255,255,255,0.45)", fontSize:12, fontWeight: activeNav===app.id ? 600 : 400, cursor:"pointer", textAlign:"left", fontFamily:"Inter,sans-serif" }}>
                    {app.label}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        ))}
        <div style={{ padding:"12px 20px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", gap:10 }}>
          <button onClick={() => { setPreviewMode(true); setMobileNavOpen(false); }} style={{ flex:1, fontSize:12, color:"rgba(255,255,255,0.6)", background:"#161414", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}> Client View</button>
          <button onClick={onSignOut} style={{ fontSize:12, color:"rgba(255,255,255,0.4)", background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"10px 16px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>Sign Out</button>
        </div>
        <div style={{ height:"env(safe-area-inset-bottom,16px)", minHeight:16 }} />
      </div>
    </div>
  )}

  {/*  DESKTOP SIDEBAR  */}
  {!isMobile && (
  <div className="vantus-grid-bg" style={{ width:220, minWidth:220, background:"transparent", borderRight:"1px solid rgba(255,255,255,0.05)", display:"flex", flexDirection:"column", overflow:"hidden", zIndex:20, flexShrink:0 }}>
    <div style={{ padding:sidebarCollapsed?"16px 0":"16px 16px 14px", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>

      {/*  COLLAPSED  */}
      {sidebarCollapsed && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"#161414", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAArIAAAJYCAYAAACepgVkAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAADIhSURBVHgB7d3ddRTZljbqWSkpRd7Jg5N4UHggeVBYUMICwAKQBQUWoG1BcSxAHoAH5LHgcCeUKWV+a9UX1KBAKfSTPzMinmcMhqq7q7v3ri2F3nhzzbkiAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDN+i3W5PLy8o/5fP48ALjOZDgcPgtYkel0+nv58ldAMiUP/r+PHj16E2uwtiC7WCwOZrPZ5/KXBwHATwaDwdPd3d33AStQgmz9nTsOyGWyt7d39Ntvv01iDQaxJuVf8Jfy5SQAuFZpKf6qL/0BD1RC7HEIseR0sq4QW62tkf2m/HB9LF9+DwB+UoLsyf7+/uuAezo/Px/v7Ox8CEGWfOoRqsexRmtrZL8pKfxlAHCt8ox8XsLsOOCeSoh9FUIsCZXn29rnANYeZPf29s7KQ9oZMIDrHZRPrgzocC+1jS1fjgPyOa0ZMNZs7UcLquZjj3rEwFkwgGuU5uJoEw99uuXi4uLv8r3zR0Ay5Xn2eJ1nY79ZeyNbjUajSWll3wYA1yrPSK0sd1IHvIRYMqpn/zcRYquNNLJVs46rtrLjAOAn8/n85bp2LdI91m2R1NoHvL63kUa2quu4BoOBwS+AJcoz8pV1XNxGKYYMeJHVRlevbqyR/aa8QdYVIYcBwHXelDbDSz9LmTshsU/l+fUkNmgbQbbulP0YACzzpPwy+BRwjfJ79F3YVEBCmxrw+t7GjhZ80zycDX4BLGfwi2s1ZdBxQD6nmw6x1cYb2aoZ/KqH1H0sAnCNwWDwdHd31w5u/sOAF0lNSht7tI0gu/FGtqqDX7Hhw8AAbTKfz/8y+MX36rqtEGLJ6WQbIbbaSiP7TfmhrGdlfw8AflJ3Me7v778Oeq8Z8KrD0uOAXDa6butHW2lkvynp3WQuwBLlGfm8hNlx0Hu7u7vPQ4gloW2vVt1qkK3XMZaHtDNgANc7KJ9cGfzqudrGlt+VLwLyOd32Wf6tHi2o7MMDuFlpZo/qi3/QS9ZtkdU21m39aKuNbDUajSblTdM6LoAlyjPyVdBLzYDXcUAy9Qz/tkNstfVGtmrWcdVWdhwA/GQ+n7989OjRm6BXrNsiqbpu60mzhWqrtt7IVvUfxLYPCwNkVp6Rr6zj6pdS8NQmfhyQz0mGEFulaGS/KW+edbXIYQBwnTfD4dBLfw+YHyGxT+U59CSSSBVky9vnYWkcPgQAyzxprvqmwwx4kVWGAa/vpTha8E0zlWvwC2A567g6rraxIcSS02mmEFulamSrZvCrHm73cQrANazj6jYDXiRVB7yOsgXZVI1s1RwePgkArlVe+N8Z/OqmZt3WOCCZ+Xz+NluIrdI1st+UH+Z6yP33AOAndYfj/v7+66AzmgGvOicyDshlMhwOH0dC6RrZb0rqN5kLsER5Rj4vYXYcdMbu7u6fIcSSUOYVqWkb2co6LoDlSpB9X1rZp0HrNW3s54B8Tksb+yySStvIVldXV/UfXIqFuwDZlFb2j7q2MGi9EmJdQ0xKe3t7qeeWUgfZ0Wg0KY2DdVwAS5RnpADUcs2A13FAMvUsfsYBr++lPlpQNeu46uDXOAD4yXw+f/no0aM3QStZt0VSdd3WkyxX0S6TupGt6j/AzIeMAbatPCNfWcfVTqWoqY36OCCfk+whtkofZKvd3d335ctZAHCdgyYQ0SJ1wKu8gBwH5FPXbZ1GC6Q/WvBNHWgoP/AfAoBlnpRfPp+CVphOp+/C2VgS2tvbe5z9bOw3rWhkq+Y6RoNfAMv9FbRCbWNDiCWn07aE2Ko1jWzVDH7VQ/HOggFco/wCOmpe/EnMgBdJ1QGvozYF2dY0slVz6Dj1PjOAbSov/O8MfuXWrNsaByQzn8/ftinEVq1qZL8pD4G6juv3AOAndffj/v7+6yAdKyVJrA54PY6WaVUj+015W7COC2CJ8ox8XgLTOEjn8vLyeQix5NTKT7xb2chWpZWtGwwOA4CflCD7vrSyT4M06oDXzs7O54B8Tksb+yxaqJWNbHV1dVX/gadf1AuwDaWV/aOuLQzSKCHWrl9S2tvba+38UWuD7Gg0mpTGwTougCXKM1JwSqIZ8DoOSKaeqW/bgNf3Wnu0oHJoHuBm8/n85aNHj94EW2XdFkm1bt3Wj1rbyFZ1HddgMDD4BbBEeUa+so5ru0qINeBFVq1uY6tWB9lqd3f3fflyFgBcp35y5YjBljQ3eL0IyKeu2zqNlmv10YJv6kBDaRw+BADXatPd6V1S2th34WwsCXXlmdD6RrZqrmM0+AWwRHnhfxdsVNPGHgfkc9qVF9tONLJVM/hVD9M7CwZwjfKL66h58WcD3EJJUl/Kc+BJV4JsJxrZqg5+RUtvpQDYhPLC/87g12Y067aEWNKpq0u7dMyoM43sN96AAZarOyP39/dfB2tjNSSJ1QGvx9EhnWlkvylvGdZxASxRnpHPS9AaB2tzeXlp3RZZde6T6841slVpZesGg8MA4DqtvVc9uzrgtbOz8zkgn07+3HcyyDYPkvqxjrNgANcw+LUe1m2RVVdX8HXuaEE1Go0m9TBzAHCt8ox0ScKKXV5e/hFCLDl1asDre51sZCuH7QFuNp/PXz569OhNsBKlja1HCsYBuUxKG3vU1SDbyUa2so4L4GaDweCVdVyrUUKsAS+yOunyrX6dbWS/MfgFcKM3w+HQtpcHaOYy6u+acUAunVu39aPOB9nZbHZYGocPAcC1ujoEsikGvMiqDz/bnT1a8E0zlWvwC2CJ8sL/LriX2saGEEtOp314Qe18I1s1g1/1EL6zYADXsI7rftwmSVJfys/zkz4E2c43spXBL4CblRf+dwa/7qaE2OMQYkmoriDty3GhXjSy31iNArBc+eV3sr+//zq4Fb9TSKrzA17f60Uj+015O3ElI8AS5Rn5vITZcfBLs9msXigxDsinV59A96qRrazjArhRJ+9jX6Vm3dbngGTKi+j78qnK0+iRXjWy1dXVVX1AfwkArnNc1xYGS5UQ63pfUurjTujeBdnRaDSph6ADgGuVZ6SgtsTl5eUfYd0WOfVmwOt7vTtaUDXruOrKlHEA8JP5fP7y0aNHb4L/MOBFUpO9vb2jPgbZ3jWylXVcADcbDAavrOP6r2bd1jggn5O+3s7Xy0b2G4NfADd608czd9dpBrzq74xxQC69Wrf1o142st+UtxetLMByL6zj+r+aAa9xQD692lLwo14H2eY6RoNfAEvMZrN30XO1jQ0DXuRU1+V9ih7r9dGCqhn8qof3nQUDuEb59OqoefHvJcfQyKr8XD7u69nYb3rdyFYGvwBuVl743/V18KsZ8DoMSKZeKd33EFv1vpH9xkoVgOXqL839/f3X0TN+N5BUrwe8vtf7Rvab8lbjSkaAJcoz8nnfWtnZbGbAi6x8ktzQyH7HOSiAG9XBkl689Dfrtj4HJFNeKN+XT0d6vangexrZ71xdXdUH9JcA4DrHpaU8jB5o1m1BOnY7/5cg+53RaDQpbzrWcQEsUZ6RnQ94TVg/Dsjn1IDXfzla8INmHdfHcC4K4Frz+fzlo0eP3kRHGfAiqcne3t6RIPtfGtkfWMcFcLPBYPCqq4NfzbqtcUA+1m1dQ5C9xnA4PC1fzgKA6xyUwPciOqa5wcvZWDKaNNmEHwiyS5S3Hq0swBLlGVlb2XF0SDPgNQ5IxorQ5QTZJZrrGA1+ASwxm83eRUc0bexxQD6nfb4i+lcMe92gGfyqh/57eTUjwK+UpuioC79kLy4u/i7/Xv4ISKb8fD12NnY5jewN6uCXdVwAy5Vn5Lu2D37VAS8hlozq1dBC7M00srdgFQvAcvWX7f7+/utoKc94kqoDXo+DG2lkb8Eha4DlyjPyeVtb2dlsZsCLrAyd34JG9pbKG/uH8uUwALjOaWmPWvXSXwe8dnZ2Pgfkc1Z+no6CX9LI3tLV1VV9QH8JAK5z3Fzt2hrNui1IZ29vzyfBtyTI3tJoNJoY/AJYrjwjWxMMy6dsv4d1W+R0asDr9hwtuAPruABuNp/PXz569OhNJGfAi6QmpY09EmRvTyN7B3UdV/nyMgC41mAweJV98Kuu2wohlpys27ojQfaOmruOzwKA6xyUoPgikmpu8HI2lowmTcbgDgTZeyhvS1ZiACxRnpG1lR1HQru7u89DG0tC5dMMn/jegyB7D811jAa/AJaYzWbvIpnaxpaAnbYtptdOy0vW++DODHvdk8EvgJuVZvaoefFP4eLi4m9X0ZJR+Tl57Gzs/Whk76kOflnHBbBceUa+yzL4VQe8hFgyqlc8C7H3p5F9ICtcAJarv6T39/dfx5Z5VpNUHfB6HNybRvaByluU2zcAlijPyOfbbmVns1ndUjAOyMfw+ANpZFegvOl/KF8OA4DrnJbWaSsv/XXAa2dn52OYZyCfT+Xn4knwIBrZFbi6uqoP6C8BwHWOSyt6GFtQQmxtY4VY0tnb23saPJgguwKj0Whi8AtgufKM3PglBM3lB8cB+Zwa8FoNRwtWxDougF96tsmbiwx4kdSktLFHguxqaGRXpK7jKl/cygGw3F+bGvyq67ZCiCWh+Xz+VohdHY3sihn8AlhuE+u4mgGv+iweB+Ri3daKaWRXrLxlWaUBsER5Rr4qYXYca7S7u/s8hFgSGgwGPrldMUF2xZrrGA1+ASwxm83exZrUNrYE5RcB+ZyWl6z3wUo5WrAGBr8Ablaa2aPmxX+lptNpDcnHAcmU7/fHzsaunkZ2Dergl3VcAMuVZ+TKW9lmwOs4IJl6NlyIXQ+N7BpZ/QKw3KoHvzxzSaqu23rSbDdixTSya1S+abdyJSNAG5Rn5PNVreOazWb1woVxQD4nQuz6CLJr1Jz/OgsArlPnCf6KB2oGvI4D8pls8hKQPhJk1+zq6korC7DccQmzh/EAOzs72lhSqjd4BWslyK7ZaDSa1HNgAcC1yjPyVdxTbWPDgBc5nRrwWj/DXhtgHRfALz27z0ewBrxIqg54HQmy66eR3YDmkLfbPACW++uug1/Nuq1xQDLz+fytELsZGtkNKg/devf3YQDwk7us46pHCnZ2duozdRyQSx3wehxshEZ2g8rbmbOyAEuUZ+SrEmbHt/l7d3d3/wwhlpz8rt8gjeyGXVxc1MPffwYA1zkrbdaNk95NG/s5IJ/T8v1rW9EGCbIbZvAL4GblZf+o2cN9rel0Wq+3PQ5IpnzfPnY2drMcLdiwOvhVwuzbAOBa5Rn5btn/rBnwOg5Ipp7xFmI3TyO7JVbGACy3bPDLs5OkrNvaEo3slpRvdmdoAJYoz8jnP67jKiH2eQix5KSN3RJBdkua819nAcB16jzBX9/+i+YGrxcB+Uzuc5kHqyHIbtHV1ZVWFmC54xJmD+tf7Ozs1GtsxwHJ1CMFwdYIsls0Go0m9RxYAHCt8ox81bSxxwH5nDpSsF2GvbbMOi6AX6rXfHtGko0BrwQ0sltW13GVLy8DgGWEWNIpRdT/hNjt08gmMZ1O653hhwEAZFcHvB4HW6eRTaK81TkrCwDt4Hd2EoJsEnUdV/2YIgCAzE6t28rD0YJEDH4BQG6leHrsbGweGtlE6uBXCbNvAwDI6K0Qm4tGNiF3iQNAOtZtJaSRTaj8kLjxCwByORFi89HIJmUdFwCkYd1WUoJsUvVKxp2dnc8BAGyVAa+8HC1IajQaTRaLhT11ALBdp0JsXhrZxKzjAoCt+lLa2CeCbF4a2cTqOq5wewgAbEVdiSnE5qaRbQGDXwCwcQa8WmA3aIOX5a3wj4AVKi3D/1O+HMfDnJbvzf8v4J7K9+GfYW82OflEtAU0stBTs9nsrxJCX8TDnJXG4ijgHmxnIavybHy/v7//NEhPkIUeWmWAKI3a0d7e3lnAHU2n03fx8E8FYOWs22oPw17QQyXEvooVKc3Fu4A7ury8rMeljgPyMeDVIoIs9ExpwY5jtQFi/PXr14ceUaBn5vP5XwH5TEob+yZoDUEW+mdlbew3g8HgVd17HHALzcvUOCCfE21suwiy0COz2ayG2HGs3kHzfxtuVM9nxxpepmAF6rqt06BVDHtBTzQDXh9jjTfFGfziVwx4kdiTEmQ/Ba2ikYWeaAa81vrx/2Kx0LSxVNPGHgfkcyrEtpNGFnpgk/s6B4PB093d3fcBP3BLIVlZt9VeGlnogRJiP8SG1Gl0g1/8qBnwOgxIpjyvDHi1mCALHbeFCfFx+f9pHRc/cuyEjCb7+/uvg9YSZKHDtjUhXtqN56XlGAfEWrdlwEOdBK0myEKH7e7u/hnbCRB1HZcbv/jnZaq81LwOSKZ8X763bqv9DHtBR21ywGsZ67iwbousDHh1g0YWOqpZt7VVpfFwDWmPlVb+MIRYcjoVYrtBkIUOaga8jmP7fv/69avBr54qLzKOl5DRpLSxzsZ2hCAL3ZRmQnwwGLyyjqt/trAtA27Luq0OEWShY0qAeB65AsRBM7VOT2xrWwbcwsSAV7cIstAhTYDI+FH+ixKwfw96oTmfPQ7I52nQKYIsdEjyAGHwqweal6njgHxOSxv7KegU67egIzKs2/qVwWDwdHd3933QWRcXF3//9ttvfwQkY91WN2lkoSNKiP07kpvP538Z/OquOuAlxJJRee4Y8OooQRY6oJkQb8MZ1HH512odV3cZ8CKjyf7+/uugkwRZaLmm4WxNgCityPPyr3kcdEqzmWIckI+dsR0myELLXV5eZlu39SsHpZU1+NUh9Xx2eTl5HZDPmXVb3WbYC1qsDQNey5Rm9mhvb+8saL3yYlJv8DoOSMaAV/dpZKHFmnVbrVQaPOcpO6DZD3wckM+pENt9giy01OXlZZ0OP472Ovz69avBr/ZLvy2DXpqUNtbZ2B4QZKGl6iqraLnBYPDKOq72arZljAPysW6rJwRZaKEOBYiDZtqdlmlu8PKfHRlNDHj1hyALLdPBAPGiOWdJi+zu7rZtWwY9UT7peRn0hiALLdMMeI2jW6zjapFm3ZbzzWR06hrsfrF+C1qkzeu2fsU6rva4uLj421W0ZGTdVv9oZKFFSoh9Fx1VGr53Br/yq+ezhVgyKs8PA149JMhCSzQDXofRXePy79HH1fkZ8CKjyf7+/uugdwRZaI/OB4jSpjwvrco4SKnZMDEOyMfO2J4SZKEFehQgrONKyoAXiX2ybqu/DHtBcl0e8FrG4Fc+0+m0ns8+DkjGgFe/aWQhuWbdVq+U5k8rm0izu/g4IJ9TIbbfNLKQWHNRwMfoofl8/vLRo0dvgq0r34f1E4FxQC6T0sYeCbL9ppGF3P6OnhoMBq+s49q+Dl2HTMeUl923QiyCLCQlQBj82rYOXodMd0x8YkMlyEJCAsS/XljHtT27u7vPQxtLQuUTm5cBIchCSs2A1zioq8c6e5tZZtZtkdhpecl6HxCGvSCdPq7b+hXruDbPui2ysm6L72lkIZnykdlfwX+UZvCdwa/Nac5nHwckU54DJ0Is3xNkIZEaIMpD+o/gR+Pyz8bH3JvjfDYZTYbDoQEv/kOQhVwEiCVKwH+ulV2/Hl2HTPvUNvZLwHcEWUhCgPiluo7LsYs1MuBFYp9KG3sa8APDXpBAM+BVb/DSOP6Cwa/1MeBFVga8WEYjCwk067aE2FsojaHjF2vQ7C4+DsjnVIhlGY0sbJl1W3c3n89futVntUobW78HxwG5TEobeyTIsoxGFrashNgPwZ0MBoNXBr9Wx3XIZFVeWt8KsdxEkIUtEiDu7cA6rtVwHTKJTXzywq8IsrAlAsTDlJamtrLj4EF2d3f/DC9T5HQS8AuCLGxJCRDPQ4B4kNls9i64t2bd1uuAfE6t2+I2DHvBFhjwWh3ruO7Pui2ysm6L29LIwhY067ZYgdIoamXvoTmffRyQTPmZPhFiuS1BFjZMgFi58cXFxevgrrxMkdFkOBwa8OLWBFnYPAFixUp789w6rtsrL1POZ5NVbWO/BNySIAsbNJvNaogdB6t2UP7Z/hX8UrMtw+oyMpoY8OKuBFnYkGZC/DhYl+MSZg+DGzXns8cBydQbvALuSJCFDREg1q+8KDi2cYOmjT0OyOfUgBf3Yf0WbIB1Wxv1zMeT15tOp/V7cByQy6S2sYIs96GRhQ0oIfZDsCl/Gfz6meuQyar8vP5PiOW+BFlYMwFi4w7KP3PDTN9pgr1jF2Q02d/ffx1wT4IsrJEAsR3NOq5x8I/Ly0vrtsjqJOABBFlYIwFia+o6Ljd+xb/bMl4H5HPqPDsPZdgL1sSA1/aVZvZob2/vLHpsOp3WQH8ckEz52XzsbCwPpZGFNWnWbbFFpYnsdSvrOmSyKj+bJ0IsqyDIwhpcXl7+EQJEBuOLi4vX0V9epsjIDV6sjCALazCfz12XmkQz+NW7dVyljXU+m6y0sayMIAsrJkCkUwe/etVMNjd4WUFGRtpYVsqwF6xQM+BVLz8YB6n0afDLgBdZGfBi1TSysELNgNc4SGexWPSilW3a2OOAfE6FWFZNIwsrYt1WKzzr+seapY39WL78HpDLl9LGPhFkWTWNLKxICbF/B9m96vLgV7NuS4glnfJz91aIZR0EWVgBAaI1xuU/q04OQbkOmcQm+/v7rwPWQJCF1RAgWqJZxzWOjnEdMomdBKyJIAsP1Kx2GgdtUddxderGr3o+u4Tz1wH5nFq3xToZ9oIHMODVXl1ax2XdFllZt8W6aWThAZp1W7RQaTA70cq6DpnEDHixdoIs3FP5ePowBIg2G3/9+rX1g1+uQyapSWlj3wSsmSAL99SVRq/PBoNBq9dxNdsyxgH5nGhj2QRBFu5BgOiMg2ZYr3WaG7wcbSGjiQEvNkWQhTsSIDrnRXNMpFVch0xiTwM2RJCFOxIgumexWLTqxaR5mToOyKeu2/oUsCHWb8EdWLfVXYPB4Onu7u77aIHpdPox3CRHPl/29vaeOBvLJmlk4Q5K2DEh3lF1+r8Ng1+uQyar8vNj3RYbp5GFW2oChE0FHVZ+EZ9kvxO+fB/WTwTGAbnUAa/HARumkYXbM+DVcaVNel7C7DiSch0yiZ0EbIEgC7cgQPRGXceVsnWv57NLyH4dkEz5vnxv3Rbb4mgB/IIBr/4pzezR3t7eWSQynU5rwD4OSKb8rDx2NpZt0cjCLzTrtuiR0jClGupzHTKJnQqxbJNGFm5QWrA6Hf4x6J35fP7y0aNHKe6KN+BFUpPSxh4JsmyTRhZu9nfQS4PB4FWGdVyuQyaxEyGWbRNkYQkBovcOmiG/rXEdMolNDHiRgaMFcI1mwOtDCLJEPNnWlZsGvEjsiatoyUAjC9fY3d19HkIs/9dWBr+aNvY4IJ9TIZYsNLLwA+u2+NFgMHhaXm7exwaVNrZ+InAYkIx1W2SikYUfWLfFj+bz+V+bHPxqzmcfBiRTr3EWYslEIwvfaQJEypud2K76C3x/f/91bIB1WyRVB7weBySikYX/0sZyrdJCPS9hdhxr5jpkEjsJSEaQhYYAwS8clKZ0rYNf9Xx2CcuvA/I5s26LjBwtgPh3wKve4LX1BfjkVprZo729vbNYA+u2yMqAF1lpZCH+HfASYvml0piu5fhJcx3ycUA+p0IsWWlk6T3rtrir+Xz+8tGjR29ihQx4kdSktLFHgixZaWTpveYGL7i1wWDwapXruFyHTGLWbZGaIEuvCRDc00EzHPhgzQ1etmWQ0cSAF9kJsvSWAMEDvWjOtT5Icz57HJBMaWKfBSQnyNJbu7u7f4YAwcM8aB1X8zJ1HJDP6bq2c8AqGfailwx4sSoPWcd1cXHxd/nf/yMgGeu2aAuNLL3UfJwLD7ZYLN7dZ/Crns8WYsmoXscsxNIWGll6pxnwehewIvUX//7+/uu7/O9Yt0VSdcDrcUBLaGTpI20sK1Xaq+clzI5v+/e7DpnETgJaRJClV0oL9jwECFbvoHxv3Wrwq57PLqH3RUA+n6zbom0EWXqjmRAXIFiLet61NK2Hv/r7XIdMVnt7e08DWkaQpTfs62TdStN647GVZu/scUA+pwa8aCPDXvSCdVtsynw+f/no0aM31/3PDHiR1KS0sUeCLG2kkaUXSoj9O2ADBoPBq+vWcbkOmcSs26K1BFk6rwkQD75KFG7poNlK8C/XIZPYxIAXbSbI0mlNMyZAsGkvvl/Htbu7a1sGKZVPEF4GtJggS6ddXl4KEGxFaWX/uXTDui0SOy0vWe8DWsywF51lwItt++23345KiP0zbCogob29vcfOxtJ2uwEd1azbgq0pIbYOGdoZSzr1WmUhli7QyNJJl5eXf8znc5sKAH5W1209KUH2S0DLOSNLJ5UQe6vrQgF66ESIpSsEWTrHvk6ApT5Zt0WXOFpApzQDXh9CkAX4iQEvukYjS6c8evSoflxmuAbgZ6dCLF0jyNIpzbmvkwDge3XAy7ORzhFk6ZzhcPimfJkEAP+Yz+dvtbF0kTOydNJsNjtcLBYfAoBJecF/HNBBGlk6qXyEdla+nAUAjhTQWYIsnXV1dfWsfLErEeizU+u26DJBls4ajUaTxWLxNgB6yoAXXSfI0mkGv4C+Ki/yJwa86DpBlk6zjgvoqUnzIg+dJsjSec35sLMA6I+T5kUeOs36LXrBOi6yKt+X78vL1sub/h4fDwNcT5ClN6bTaf2Y7XlAMiWoHjUr4wC4A0GW3ijN10FpZj+XvzwIyOWstLJHAcCdOCNLb9TzYtZxkdRh+cTgOAC4E40svVMCQ21lxwG5fNnb23tsQAfg9jSy9E4JCs8C8jkoL1kvAoBb08jSSyUw1A0GhwHJNK3sJAD4JY0svXR1dVVbWR/hks5sNnsXANyKIEsvjUajicEvkjqse48DgF9ytIDeso6LxOr1oo8DgBtpZOmtZjr8ZUA+44uLi9cBwI00svSewS+Sso4L4Bc0svReCQonAfnUoy+vAoClNLJQlI9xT0ug/TMgmfJ9eVSa2bMA4CeCLITBL1I7Gw6HRwHATxwtgPi/g1/WcZHU4XQ6PQ4AfqKRhe+UwFBb2XFALga/AK6hkYXvlKDwLCCfg/KS9SIA+A+NLPzAOi6Sqq3sk/KyNQkA/qGRhR9cXV1pZcmoDiS+CwD+JcjCD0aj0WSxWNgtS0aHJcweBgD/cLQArmEdF4lNhsPh4wBAIwvXaabDtbJkNP769avBL4DQyMKNDH6RlHVcAKGRhRuVoKCVJaN69OVVAPScRhZ+4eLi4rQE2j8Dkinfl0elmT0LgJ4SZOEXDH6R2NlwODwKgJ5ytAB+oZ5DLGH2bUA+h9Pp9DgAekojC7fQtLIfy1+OA3KZNDd+GfwCekcjC7dQQ0L548YvMhqXVtY6LqCXNLJwB9ZxkdSXppWdBECPaGThDq6urrSyZFSPvrwLgJ4RZOEORqPRpHwx+EVGhyXMHgZAjzhaAHdkHReJfRoOh08CoCc0snBHzXS4G7/I6PevX78a/AJ6QyML92Twi6Tq4Ndj67iAPtDIwj2VoKCVJaN69OVVAPSARhYe4OLi4rQE2j8Dkinfl0elmT0LgA4TZOEBzs/Pxzs7O/XGL4NfZHM2HA6PAqDDHC2AB6jruBaLhXVcZHR4eXn5RwB0mEYWHqhZx1Vb2XFALpPmxi+DX0AnaWThgWpIKH/c+EVG4+l0ah0X0FkaWVgR67hI6kvTyk4CoGM0srA6LwPyOSgvWX8FQAcJsrAiw+HwU/li8It0Shv7x2w2OwyAjnG0AFaoGfz6HNZxkc+n8rL1JAA6RCMLK9RMh7vxi4x+//r1q8EvoFM0srAGBr9Iqg5+PbaOC+gKjSysQQkKWlkyqkdfXgVAR2hkYU0uLi7+rkM2Afk8aYYTAVpNIwtrMp/P6zouH+GSkXVcQCcIsrAmo9FoslgsrOMio0PruIAucLQA1qhZx/Wx/OU4IJdJc+OXTw2A1tLIwhrVkDAYDNz4RUbj6XRqHRfQahpZ2ADruEjqS9PKTgKghTSysBlaWTI6KC9ZBr+A1hJkYQOaVUcGv0inrogz+AW0laMFsCHN4Nfn8pcHAbmclZetowBoGY0sbEgzHe7GLzI6/Pr1q8EvoHU0srBh0+m0ruP6PSCXOvj12DouoE00srBhJSgY/CKjevTlVQC0iEYWtsA6LrJqWtlJALSARha24Orq6ln54iNc0imt7LsAaAlBFrZgNBpNFouFdVxkdGgdF9AWjhbAljTruOrg1zggl0lz45dPDYDUNLKwJTUkDAYDg19kNJ5Op9ZxAelpZGHLDH6R1JemlZ0EQFIaWdiyEhRckkBG1nEB6QmysGWl9TorXwx+kdGxwS8gM0cLIIFm8Otz+cuDgFzOhsPhUQAkpJGFBJrpcEcMyOjw69evBr+AlDSykMh0Oq3ruH4PyOVLc+OXdVxAKhpZSKQEBeu4yOjAOi4gI40sJGMdF1k1rewkAJLQyEIyV1dXz8oXH+GSzmw2excAiQiykMxoNJosFgvruMjo0DouIBNHCyChZh1XHfwaB+QyaW788qkBsHUaWUjIOi4SGxv8ArLQyEJiBr9IyjouIAWNLCRWgoJWlozq0Ze/AmDLBFlIrLReZ+WLwS8yOjb4BWybowWQXDP49bn85UFALmfD4fAoALZEIwvJ1XOI1nGR1OF0Oj0OgC3RyEJLlMBQW9lxQC4Gv4Ct0chCS5Sg8CwgnwPruIBt0chCi1jHRVZNKzsJgA3SyEKLXF1d1VbWR7ikM5vN3gXAhgmy0CKj0Whi8IukDq3jAjbN0QJoGeu4SGwyHA4fB8CGaGShZZrp8JcB+YwvLi5eB8CGaGShpQx+kZR1XMDGaGShpUpQOAnIpx59+SsANkCQhZYqrdfZYrH4X0A+xwa/gE1wtABazOAXiZ0Nh8OjAFgjjSy0WD2HaB0XSR1Op9PjAFgjjSx0QAkMtZUdB+Ri8AtYK40sdEAJCs8C8jkoL1kvAmBNNLLQEdZxkVRtZZ+Ul61JAKyYRhY64urqSitLRnUg8V0ArIEgCx0xGo0mi8XCblkyOrSOC1gHRwugQ6zjIrHJcDh8HAArpJGFDmmmw18G5DO+uLh4HQArpJGFDjL4RVLWcQErpZGFDipBwVlZMqpHX14FwIpoZKGjyse4pyXQ/hmQTPm+PCrN7FkAPJAgCx1l8IvEzobD4VEAPJCjBdBR9RxiCbNvA/I5nE6nxwHwQBpZ6LCmlf1Y/nIckMukufHL4BdwbxpZ6LAaEsofN36R0bi0si8C4AE0stAD1nGR1JemlZ0EwD1oZKEHrq6utLJkVI++vAuAexJkoQdGo9FksVjYLUtGhyXMHgbAPThaAD1hHReJTYbD4eMAuCONLPREMx2ulSWj8devXw1+AXemkYWeMfhFUnXw67F1XMBdaGShZ0pQ0MqSUT368ioA7kAjCz10cXFxWgLtnwHJlO/Lo9LMngXALQiy0EPn5+fjnZ2deuOXwS+yORsOh0cBcAuOFkAPNeu43gbkc3h5eflHANyCRhZ6qlnHVVvZcUAuk+bGL4NfwI00stBTNSSUP278IqPxdDq1jgv4JY0s9Jx1XCT1pWllJwGwhEYWeu7q6korS0b16Mu7ALiBIAs9Vwe/yheDX2R0WMLsYQAs4WgB8G3w63NYx0U+n4bD4ZMAuIZGFohmOtyNX2T0+9evXw1+AdfSyAL/MvhFUnXw67F1XMCPNLLAv0pQ0MqSUT368ioAfqCRBf7j4uLi7xJo3axERk+Gw+GnAGhoZIH/mM/nL8sXH+GS0XEAfEeQBf6jruNaLBbWcZHO3t7emwD4jiAL/KR8fFsDwyQgifJydeKWL+BHgizwkzodXv648YssJuXl6jQAfiDIAtcqH+OelS9nAdunjQWuZWsBsNR0Ov29fPkYsD21jX0cANfQyAJLNauODH6xNeWTgaMAWEKQBW5UgsTrsI6L7Th1pAC4iSAL3Ki5FtSNX2xavZbW9x1wI0EW+KVmHZcbldiYustYGwv8imEv4FZms9lhCRcfAtbPgBdwKxpZ4FbqOq4SZN8HrJ8jBcCtaGSBWzs/Px/v7OzUdVwHAetxWtpYl3EAt6KRBW5tNBpN6tnFgDUx4AXchSAL3Ekz+DUJWD0DXsCdCLLAndR1XIPB4GXAak1KG/smAO5AkAXubHd3tw59nQWszok2Frgrw17AvVjHxQpZtwXci0YWuJe6jqt8MfjFKjwNgHvQyAL3VhrZg9LMfg7ruLg/67aAe9PIAvdWB7/C8noewLot4CEEWeBBmnVcnwLuqDT6BryAB3G0AHgwg1/cgwEv4ME0ssCDNYNfZwG350gB8GAaWWAlzs/Pxzs7Ox/D4Be/UNr79/v7+zYVAA+mkQVWYjQaTUpAsY6LXxoOh26GA1ZCkAVWphn8mgQsd2rAC1gVQRZYGeu4+IWJdVvAKgmywEqVVvY0DH5xPeu2gJUy7AWsnHVcXMO6LWDlNLLAyjXruAx+8a/SxLqGFlg5jSywFqWRPSjN7OewjouI09LGCrLAymlkgbUw+MU3BryAdRFkgbWxjovSzBvwAtbG0QJgrQx+9ZoBL2CtNLLAWjWDX2dBHzlSAKyVRhZYu/Pz8/HOzs7HMPjVJ59KG/skANZIIwus3Wg0miwWC+u4eqQ08U8DYM0EWWAjmsGvL0EfnBrwAjZBkAU2olnH9TLouol1W8CmCLLAxpRW9jQMfnXafD5/q40FNsWwF7BR1nF1mnVbwEZpZIGNatZxGfzqoMFg4OgIsFEaWWDjSiN7UJrZz2EdV5ecljb2WQBskEYW2Lg6+GUdV7cY8AK2QZAFtmJ/f/91+TIJWq+8lJwY8AK2wdECYGsMfnVCXbf1pFmvBrBRGllga5rBr7OgzU6EWGBbNLLAVp2fn493dnY+B21k3RawVRpZYKtGo9GknrEMWqc06kcBsEWCLLB1pdV7U774eLpdTg14AdsmyAJb15yxtEy/PSbWbQEZCLJACqWVPQ2DX62wWCz+p40FMjDsBaRhHVcrGPAC0tDIAmnUdVy17Qsyc6QASEMjC6RSguxBaWbrOq6DIJvT0sY+C4AkNLJAKnXwq4TZt0E6BryAbARZIJ1mHdckyOStAS8gG0EWSKe2suWPj7DzqOu23gRAMoIskFId/ArruLI40cYCGRn2AtI6Pz8f7+zsfA62ybotIC2NLJDWaDSaLBYLA0ZbVJrxowBISpAFUmsGv74E23DqSAGQmSALpFYHv8IS/m34Yt0WkJ0gC6TXtLJnwcbUXb7aWCA7w15AK8xms8MSrj4Em2DAC2gFjSzQCnUdVwmy/ws2wZECoBU0skBrlCB7UJrZuo7rIFiL8s/4/f7+/tMAaAGNLNAadfCrnt0M1mY4HL4MgJYQZIFWaQa/JsE6WLcFtIogC7RKbWXLn2fBqk2s2wLaRpAFWqcOfoV1XKt2oo0F2sawF9BK5+fn452dnc/BKli3BbSSRhZopdFoNClfDH6thi0FQCtpZIHWso5rJU5LG+vMMdBKGlmgtergV1je/yAGvIA2E2SBVmvWcZ0Fd1YabQNeQKs5WgC03mw2Oyyh7ENwFwa8gNbTyAKtV9dx1atVg7twpABoPY0s0AnNOq6PYfDrNs5KG3sUAC2nkQU6oa7jKq2sdVy3UBpsWwqAThBkgc5oBr8mwU1ODXgBXSHIAp1R13GVP9rG5SbWbQFdIsgCnVIHv8I6rmWs2wI6xbAX0DnT6fT38uVj8D3rtoDO0cgCnVMC26fyxeDXdwaDwcsA6BiNLNBJi8XiYDabfQ7ruKrTEu6dHQY6RyMLdFId/ApL//9hwAvoKkEW6KxmHden6LHSTBvwAjrL0QKg02az2WEJcx+in+q6rSdNOw3QORpZoNPqOq4SZN9HP50IsUCXaWSBzjs/Px/v7OzUdVx9Gvz6NBwOnwRAh2lkgc4bjUaT0sr2ah1XaaKfBkDHCbJALzSDX5Poh1MDXkAfCLJAL9Szoj25FGBi3RbQF4Is0Bu7u7t16OssOmw+n7/VxgJ9YdgL6JXpdPp7+fIxumkyHA4fB0BPaGSBXilBr16Q0NXBL0cKgF7RyAK9s1gsDmaz2efo1jqu0xLSnwVAj2hkgd5pLgnoVHtpwAvoI0EW6KVmHden6IDSMJ8Y8AL6yNECoLdms9lhCYEfot3quq0nrqIF+kgjC/RWCYBn0f51XCdCLNBXGlmg187Pz8c7Ozt1HVcbB7+s2wJ6TSML9NpoNJosFotWruMqjfJRAPSYIAv0XjP4NYl2OTXgBfSdIAv0Xj1jOhgMXkZ7TKzbAhBkAf6xu7v7Ploy+LVYLP6njQUw7AXwr5as4zLgBdDQyAI0mnVc2Qe/HCkAaGhkAb5TGtmD0sx+jpzruE5LG/ssAPiHRhbgO83lAilbTwNeAP8lyAL8IOk6rrcGvAD+S5AFuEYJjZk+wq/rtt4EAP8hyAJcoxn8OoscTrSxAD8z7AWwxPn5+XhnZ+djbHfwy7otgCU0sgBLjEajyWKx2PY6rqcBwLUEWYAbbHnwq67b+hQAXEuQBbjBFtdxfbFuC+BmgizAL5RW9DQ2PPhVjzQY8AK4mWEvgFuYzWaHJVx+iM0w4AVwCxpZgFto1nFtavDLkQKAW9DIAtxSaWQPSjP7Oda4jqv8/3i/v79vUwHALWhkAW6pDn6tex3XcDh8GQDcikYW4I6m02ltZcexenXdVqarcQFS08gC3FFpZtcRNifWbQHcjSALcEfN4NdZrNaJdVsAd+NoAcA9nJ+fj3d2dj7Gaga/rNsCuAeNLMA9jEajyaoGv9Z0VAGg8zSyAPe0onVcBrwA7kkjC3BPdR1X+fKgdVkGvADuT5AFeIDSpp7GPQe/SqNrwAvgARwtAHig2Wx2WELph7gbA14AD6SRBXiguo6rBNn/xd04UgDwQBpZgBW44+DXp9LGPgkAHkQjC7ACdfDrtuu4SoP7NAB4MI0swApNp9Payo5v+Fus2wJYEY0swAr94nKDiXVbAACkVVrZD+XP4po/xwHAyjhaALBi5+fn452dnc8//Let2wIAIL+Li4vX37exl5eXfwQAAGRX13GVAPv/N0H2XQAAQFuUAPuiBtliHAAA0CaOFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN3xfwBdnfdgA1mH/gAAAABJRU5ErkJggg==" style={{ width:18, height:18, objectFit:"contain" }} />
          </div>
          <button onClick={() => setSidebarCollapsed(c => !c)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:14, padding:2, lineHeight:1 }}>›</button>
        </div>
      )}

      {/*  EXPANDED  */}
      {!sidebarCollapsed && (
        <div>
          {/* Row 1: icon + wordmark + collapse toggle */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"#161414", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <img src="data:image/png;base64,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" style={{ width:18, height:18, objectFit:"contain" }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:"#f5f5f7", letterSpacing:-0.4, lineHeight:1.2 }}>Vantus</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background: dbStatus==="live"?"#2AABFF":dbStatus==="error"?"#ff453a":"#F17130", flexShrink:0 }} />
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.5)", fontWeight:500, fontFamily:"'Geist Mono', monospace", letterSpacing:1.5, textTransform:"uppercase" }}>VitalLyfe</span>
              </div>
            </div>
            <button onClick={() => setSidebarCollapsed(c => !c)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.35)", cursor:"pointer", fontSize:16, padding:"2px 4px", lineHeight:1, flexShrink:0 }}>‹</button>
          </div>

          {/* Row 2: action buttons */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={() => setPreviewMode(true)} style={{ flex:1, fontSize:10, color:"rgba(255,255,255,0.75)", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"5px 0", cursor:"pointer", fontFamily:"Inter, sans-serif", fontWeight:500, textAlign:"center" }}>Client View</button>
            <div style={{ position:"relative" }}>
              <button onClick={(e) => {
                if (!notifOpen) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setNotifPos({ x: Math.max(0, Math.min(window.innerWidth - 310, rect.left - 270)), y: rect.bottom + 6 });
                }
                setNotifOpen(o=>!o);
                setNotifications(prev=>prev.map(n=>({...n,read:true})));
              }}
                style={{ position:"relative", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.18)", borderRadius:8, padding:"6px 8px", cursor:"pointer", lineHeight:1, color:"rgba(255,255,255,0.85)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                
                {notifications.filter(n=>!n.read).length > 0 && (
                  <span style={{ position:"absolute", top:-4, right:-4, width:14, height:14, borderRadius:"50%", background:"#ff453a", fontSize:8, fontWeight:700, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {notifications.filter(n=>!n.read).length}
                  </span>
                )}
              </button>
              {notifOpen && ReactDOM.createPortal(
                <div ref={notifDragRef} style={{ position:"fixed", left:notifPos.x, top:notifPos.y, width:300, background:"rgba(20,18,16,0.95)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:14, boxShadow:"0 24px 64px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.4)", zIndex:2147483647, overflow:"hidden", willChange:"transform", touchAction:"none" }}>
                  <div
                    onMouseDown={(e) => {
                      notifDragging.current = true;
                      notifDragOffset.current = { x: e.clientX - notifPos.x, y: e.clientY - notifPos.y };
                      document.body.style.userSelect = "none";
                      document.body.style.cursor = "grabbing";
                      e.preventDefault();
                    }}
                    style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.1)", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:2, textTransform:"uppercase", cursor:"grab", userSelect:"none", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span>Client Activity</span>
                    <span onClick={() => setNotifOpen(false)} style={{ cursor:"pointer", fontSize:16, color:"rgba(255,255,255,0.5)", fontWeight:300, lineHeight:1 }}>×</span>
                  </div>
                  {notifications.length === 0 && (
                    <div style={{ padding:"24px 16px", fontSize:11, color:"rgba(255,255,255,0.5)", textAlign:"center" }}>No client actions yet</div>
                  )}
                  {notifications.slice(0,10).map(n => (
                    <div key={n.id} style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:12, alignItems:"flex-start" }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background: n.type==="approved" ? "#2AABFF" : "#ff453a", marginTop:4, flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.9)", lineHeight:1.4 }}>{n.type==="approved" ? "Approved" : "Revisions requested"}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.65)", marginTop:2 }}>{n.item?.title}</div>
                        {n.item?.client_note && <div style={{ fontSize:9, color:"rgba(255,100,80,0.9)", marginTop:3, fontStyle:"italic" }}>"{n.item.client_note}"</div>}
                        <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", marginTop:4 }}>{new Date(n.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                    </div>
                  ))}
                </div>,
                document.body
              )}
            </div>
            {onSignOut && (
              <button onClick={onSignOut} style={{ fontSize:10, color:"rgba(255,255,255,0.4)", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"5px 8px", cursor:"pointer", fontFamily:"Inter, sans-serif", fontWeight:500 }}>Out</button>
            )}
          </div>
        </div>
      )}

    </div>
    {!sidebarCollapsed && (
      <div style={{ padding:"8px 16px 6px", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", gap:5 }}>
        <div style={{ width:5, height:5, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2.5s ease-in-out infinite", flexShrink:0 }} />
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontWeight:400 }}>{liveCount} agents active</span>
      </div>
    )}
    {!sidebarCollapsed && (
      <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background: aiEnabled ? "#2AABFF" : "#ff453a", flexShrink:0, transition:"background 0.2s" }} />
          <span style={{ fontSize:10, color: aiEnabled ? "rgba(255,255,255,0.55)" : "rgba(255,80,80,0.8)", fontWeight:500, transition:"color 0.2s" }}>
            {aiEnabled ? "AI Active" : "AI Disabled"}
          </span>
        </div>
        <button onClick={toggleAI} style={{
          background: aiEnabled ? "rgba(255,255,255,0.06)" : "rgba(255,60,60,0.12)",
          border: aiEnabled ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,60,60,0.3)",
          borderRadius:6, padding:"4px 10px", cursor:"pointer",
          fontSize:9, fontWeight:700, color: aiEnabled ? "rgba(255,255,255,0.5)" : "rgba(255,100,80,0.9)",
          fontFamily:"'Geist Mono', monospace", letterSpacing:1, textTransform:"uppercase", transition:"all 0.2s"
        }}>
          {aiEnabled ? "Kill" : "Enable"}
        </button>
      </div>
    )}
    <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
      {NAV.map(group => (
        <div key={group.section} style={{ padding:"12px 0 0" }}>
          {!sidebarCollapsed && <div style={{ padding:"0 16px 5px", fontSize:9, color:"rgba(255,255,255,0.4)", letterSpacing:2, fontWeight:600, textTransform:"uppercase" }}>{group.section}</div>}
          {group.items.map(item => (
            <React.Fragment key={item.id}>
              <div style={{ padding:sidebarCollapsed?"0":"0 8px 1px" }}>
                <button onClick={() => setActiveNav(item.id)} title={sidebarCollapsed?item.label:undefined}
                  style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:sidebarCollapsed?"9px 0":"7px 10px", justifyContent:sidebarCollapsed?"center":"flex-start", background:"transparent", border:"none", borderLeft: activeNav===item.id ? "2px solid #2AABFF" : "2px solid transparent", color:activeNav===item.id?"#ffffff":"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:12, fontFamily:"-apple-system, Inter, sans-serif", fontWeight:activeNav===item.id?500:400, transition:"color 0.12s, border-color 0.12s", letterSpacing:0.1 }}>
                  {!sidebarCollapsed && item.label}
                </button>
              </div>
              {item.id === "apps" && !sidebarCollapsed && apps.filter(a => a.enabled).map(app => (
                <div key={app.id} style={{ padding:"0 8px 1px" }}>
                  <button onClick={() => setActiveNav(app.id)} title={app.label}
                    style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"5px 10px 5px 22px", justifyContent:"flex-start", background:"transparent", border:"none", borderLeft: activeNav===app.id ? "2px solid #2AABFF" : "2px solid transparent", color:activeNav===app.id?"#ffffff":"rgba(255,255,255,0.45)", cursor:"pointer", fontSize:11, fontFamily:"-apple-system, Inter, sans-serif", fontWeight:activeNav===app.id?500:400, transition:"color 0.12s, border-color 0.12s", letterSpacing:0.1 }}>
                    {app.label}
                  </button>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  </div>
  )} {/* end !isMobile desktop sidebar */}

  {/*  MAIN  */}
  <div style={{ flex:1, overflowY:"auto", padding: isMobile ? "24px 16px calc(72px + env(safe-area-inset-bottom,0px))" : "48px 52px", position:"relative", zIndex:25, background:"transparent", WebkitOverflowScrolling:"touch" }}>

    {/* DASHBOARD */}
    {activeNav === "dashboard" && (
      <div style={{ animation:"fadeIn 0.4s ease" }}>
        {/*  HERO  */}
        <div style={{ marginBottom: isMobile ? 24 : 40, paddingBottom: isMobile ? 24 : 32, borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.55)", fontWeight:600, letterSpacing:3, textTransform:"uppercase", fontFamily:"'Geist Mono', monospace", marginBottom:12 }}>Cloud Scenic / VitalLyfe</div>
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

        {/*  METRIC GRID — 2x2 on mobile, asymmetric on desktop  */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.4fr 1fr 1fr", gridTemplateRows:"auto", gap: isMobile ? 10 : 14, marginBottom: isMobile ? 24 : 44 }}>
          {isMobile ? (
            <>
              <MetricCard label="Content Pieces" value={content.length} delta={0} color="#2AABFF" />
              <MetricCard label="Approved" value={content.filter(x=>x.status==="Approved").length} delta={0} color="#0a84ff" />
              <MetricCard label="Need Attention" value={content.filter(x=>["Need Copy Approval","Need Content Approval","Needs Revisions"].includes(x.status)).length} delta={0} color="#ff9f0a" />
              <MetricCard label="Scheduled" value={content.filter(x=>x.status==="Scheduled").length} delta={0} color="#2AABFF" />
            </>
          ) : (
            <>
              <div style={{ gridRow:"1 / span 2" }}>
                <MetricCard label="Content Pieces" value={content.length} delta={0} color="#2AABFF" large />
              </div>
              <MetricCard label="Approved" value={content.filter(x=>x.status==="Approved").length} delta={0} color="#0a84ff" />
              <MetricCard label="Scheduled" value={content.filter(x=>x.status==="Scheduled").length} delta={0} color="#2AABFF" />
              <MetricCard label="Need Attention" value={content.filter(x=>["Need Copy Approval","Need Content Approval","Needs Revisions"].includes(x.status)).length} delta={0} color="#ff9f0a" />
              <MetricCard label="In Production" value={content.filter(x=>["Ready For Content Creation","Ready For Copy Creation"].includes(x.status)).length} delta={0} color="#ff375f" />
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
            {agents.map(agent => <AgentCard key={agent.id} agent={agent} selected={selectedAgent?.id===agent.id} onClick={() => setSelectedAgent(selectedAgent?.id===agent.id?null:agent)} />)}
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
          <Card style={{ padding:"4px 0", maxHeight:320, overflowY:"auto" }}><ActivityFeed feed={feed} /></Card>
        </div>

        {/*  OPERATIONS BOARD  */}
        <div style={{ marginBottom:28 }}>
          <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 20 : 22, fontWeight:400, fontStyle:"italic", color:"#f5f5f7", margin:"0 0 18px", letterSpacing:-0.5 }}>Operations</h2>
          <OpsBoard />
        </div>
      </div>
    )}

    {/* AGENTS */}
    {activeNav === "agents" && (
      <AgentChatPage agents={agents} content={content} />
    )}

    {/* INSTAGRAM */}
    {activeNav === "instagram" && (
      <div style={{ animation:"fadeIn 0.4s ease" }}>
        <div style={{ display:"flex", alignItems: isMobile ? "flex-start" : "center", gap:14, marginBottom: isMobile ? 16 : 28, flexWrap:"wrap" }}>
          <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}></div>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 22 : 30, fontWeight:700, color:"#f5f5f7", margin:0, letterSpacing:-1 }}>Instagram</h1>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>@vitallyfe · {igItems.length} pieces in pipeline</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", width: isMobile ? "100%" : "auto" }}>
            {!isMobile && ["Ready For Copy Creation","Need Copy Approval","Ready For Content Creation","Need Content Approval","Needs Revisions","Approved","Ready For Schedule","Scheduled"].map(s => {
              const c = STATUS_COLOR[s] || "#999";
              const n = igItems.filter(x=>x.stage===s).length;
              if (!n) return null;
              return <span key={s} style={{ fontSize:9, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.07)", padding:"3px 8px", borderRadius:20, fontWeight:600 }}>{s} · {n}</span>;
            })}
            <button onClick={handleAddNew} style={{ background:"#0f0f1a", border:"none", borderRadius:10, color:"#fff", fontSize:12, fontWeight:600, padding:"7px 14px", cursor:"pointer", fontFamily:"Inter, sans-serif", flexShrink:0 }}>+ Add</button>
          </div>
        </div>
        <ContentPipelineBoard title="Reels & Graphics Pipeline" icon=""
          stages={["Ready For Copy Creation","Need Copy Approval","Ready For Content Creation","Need Content Approval","Needs Revisions","Approved","Ready For Schedule","Scheduled"]}
          stageColors={["#f59e0b","#3b82f6","#10b981","#ff453a","#f97316","#2AABFF","#8b5cf6","#64d2ff"]}
          items={igItems.filter(x => x.type==="reel" || x.type==="graphic")}
          onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
        />
        <ContentPipelineBoard title="Carousels & Threads" icon=""
          stages={["Ready For Copy Creation","Need Copy Approval","Ready For Content Creation","Need Content Approval","Needs Revisions","Approved","Ready For Schedule","Scheduled"]}
          stageColors={["#f59e0b","#3b82f6","#10b981","#ff453a","#f97316","#2AABFF","#8b5cf6","#64d2ff"]}
          items={igItems.filter(x => x.type==="carousel" || x.type==="thread")}
          onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
        />
      </div>
    )}

    {/* TIKTOK */}
    {activeNav === "tiktok" && (
      <div style={{ animation:"fadeIn 0.4s ease" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom: isMobile ? 16 : 28 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#010101,#ff0050)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}></div>
          <div>
            <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 22 : 30, fontWeight:700, color:"#f5f5f7", margin:0, letterSpacing:-1 }}>TikTok</h1>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>@vitallyfe · {ttItems.length} pieces in pipeline</div>
          </div>
        </div>
        <ContentPipelineBoard title="TikTok Pipeline" icon=""
          stages={["Ready For Copy Creation","Need Copy Approval","Ready For Content Creation","Need Content Approval","Needs Revisions","Approved","Ready For Schedule","Scheduled"]}
          stageColors={["#f59e0b","#3b82f6","#10b981","#ff453a","#f97316","#2AABFF","#8b5cf6","#64d2ff"]}
          items={ttItems}
          onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
        />
      </div>
    )}

    {/* YOUTUBE */}
    {activeNav === "youtube" && (
      <div style={{ animation:"fadeIn 0.4s ease" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom: isMobile ? 16 : 28 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#ff0000,#cc0000)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}></div>
          <div>
            <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 22 : 30, fontWeight:700, color:"#f5f5f7", margin:0, letterSpacing:-1 }}>YouTube</h1>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>VitalLyfe · {ytItems.length} pieces · Long-form & Shorts</div>
          </div>
        </div>
        <ContentPipelineBoard title="Production Pipeline" icon=""
          stages={["Ready For Copy Creation","Need Copy Approval","Ready For Content Creation","Need Content Approval","Needs Revisions","Approved","Ready For Schedule","Scheduled"]}
          stageColors={["#f59e0b","#3b82f6","#10b981","#ff453a","#f97316","#2AABFF","#8b5cf6","#64d2ff"]}
          items={ytItems}
          onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
        />
      </div>
    )}

    {/* CONTENT TRACKER */}
    {activeNav === "tracker" && (() => {
      const filtered = content.filter(item => {
        if (filterStatus && item.status !== filterStatus) return false;
        if (filterPillar && item.pillar !== filterPillar) return false;
        if (filterPlatform && item.platform !== filterPlatform) return false;
        if (trackerSearch && !item.title.toLowerCase().includes(trackerSearch.toLowerCase())) return false;
        return true;
      });
      const selStyle = { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"8px 12px", fontSize:12, color:"#f5f5f7", outline:"none", fontFamily:"Inter, sans-serif", cursor:"pointer", appearance:"none" };
      return (
      <div style={{ animation:"fadeIn 0.4s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, gap:12, flexWrap:"wrap" }}>
          <div>
            <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 24 : 32, fontWeight:700, color:"#f5f5f7", marginBottom:4, letterSpacing:-1 }}>Content Tracker</h1>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", margin:0 }}>{filtered.length} of {content.length} pieces · Tap any row to edit</p>
          </div>
          <button onClick={handleAddNew} style={{ background:"#0f0f1a", border:"none", borderRadius:12, color:"#fff", fontSize:13, fontWeight:600, padding:"10px 20px", cursor:"pointer", fontFamily:"Inter, sans-serif", whiteSpace:"nowrap" }}>+ Add Content</button>
        </div>
        {/* Search + Filter Bar */}
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          <input value={trackerSearch} onChange={e=>setTrackerSearch(e.target.value)} placeholder="Search by title…"
            style={{ flex:1, minWidth: isMobile ? "100%" : 180, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"8px 14px", fontSize:isMobile ? 16 : 12, color:"#f5f5f7", outline:"none", fontFamily:"Inter, sans-serif" }} />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", width: isMobile ? "100%" : "auto" }}>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...selStyle, flex: isMobile ? 1 : "none", fontSize: isMobile ? 14 : 12 }}>
              <option value="">All Statuses</option>
              {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterPillar} onChange={e=>setFilterPillar(e.target.value)} style={{ ...selStyle, flex: isMobile ? 1 : "none", fontSize: isMobile ? 14 : 12 }}>
              <option value="">All Pillars</option>
              {PILLARS_LIST.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterPlatform} onChange={e=>setFilterPlatform(e.target.value)} style={{ ...selStyle, flex: isMobile ? 1 : "none", fontSize: isMobile ? 14 : 12 }}>
              <option value="">All Platforms</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>
            {(trackerSearch||filterStatus||filterPillar||filterPlatform) && (
              <button onClick={()=>{setTrackerSearch("");setFilterStatus("");setFilterPillar("");setFilterPlatform("");}} style={{ fontSize:11, color:"rgba(255,255,255,0.5)", background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"8px 12px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}> Clear</button>
            )}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: isMobile ? 10 : 14, marginBottom:24 }}>
          <MetricCard label="Total Pieces" value={content.length} delta={0} color="#2AABFF" />
          <MetricCard label="Approved" value={content.filter(x=>x.status==="Approved").length} delta={0} color="#2AABFF" />
          {!isMobile && <MetricCard label="Scheduled" value={content.filter(x=>x.status==="Scheduled").length} delta={0} color="#0a84ff" />}
        </div>
        {/* Table — horizontal scroll on mobile */}
        <Card style={{ padding:"0", overflow:"hidden" }}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <div style={{ minWidth: isMobile ? 640 : "auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 0.7fr 1fr 1fr 1.3fr 0.8fr 0.7fr auto", gap:0, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
              {["Title","Platform","Campaign","Pillar","Status","Format","Date","Write"].map(h => (
                <div key={h} style={{ fontSize:9, color:"rgba(255,255,255,0.35)", fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", padding:"12px 14px" }}>{h}</div>
              ))}
            </div>
          {filtered.length === 0 && (
            <div style={{ padding:"32px", textAlign:"center", color:"rgba(255,255,255,0.4)", fontSize:12 }}>No items match your filters.</div>
          )}
          {filtered.map((item, i) => {
            const sc = STATUS_COLOR[item.status] || "#999";
            const ptLabel = item.platform === "instagram" ? "IG" : item.platform === "tiktok" ? "TT" : "YT";
            const ptColor = item.platform === "instagram" ? "#e1306c" : item.platform === "tiktok" ? "#ff0050" : "#ff0000";
            const needsCaption = !item.caption || item.caption.length < 10;
            const needsScript = item.format === "Reel" && (!item.script || item.script.length < 10);
            return (
              <div key={item.id}
                style={{ display:"grid", gridTemplateColumns:"2fr 0.7fr 1fr 1fr 1.3fr 0.8fr 0.7fr auto", borderBottom:`1px solid rgba(255,255,255,0.05)`, transition:"background 0.15s", background:"rgba(255,255,255,0.05)" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(42,171,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background="#111010"}>
                <div onClick={() => setEditingItem(item)} style={{ fontSize:12, color:"#f5f5f7", fontWeight:500, padding:"11px 14px", lineHeight:1.3, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                  {item.client_note && <span title={item.client_note} style={{ fontSize:8, color:"#ff453a", background:"rgba(255,69,58,0.1)", padding:"1px 5px", borderRadius:4, fontWeight:700, whiteSpace:"nowrap" }}>CLIENT NOTE</span>}
                  {item.title}
                </div>
                <div style={{ padding:"11px 14px", display:"flex", alignItems:"center" }}>
                  <span style={{ fontSize:10, fontWeight:700, color:ptColor, background:`${ptColor}15`, padding:"2px 7px", borderRadius:6 }}>{ptLabel}</span>
                </div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", padding:"11px 14px", display:"flex", alignItems:"center" }}>{item.campaign}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", padding:"11px 14px", display:"flex", alignItems:"center" }}>{item.pillar}</div>
                <div style={{ padding:"11px 14px", display:"flex", alignItems:"center" }}>
                  <span style={{ fontSize:9, fontWeight:600, color:sc, background:`${sc}15`, padding:"3px 8px", borderRadius:20, whiteSpace:"nowrap" }}>{item.status}</span>
                </div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", padding:"11px 14px", display:"flex", alignItems:"center" }}>{item.format}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", padding:"11px 10px", display:"flex", alignItems:"center" }}>{item.publish_date || "—"}</div>
                <div style={{ padding:"8px 12px", display:"flex", alignItems:"center", gap:5 }}>
                  {needsCaption && <button onClick={() => handleMuseWrite(item, "caption")} style={{ fontSize:9, fontWeight:700, color:"#ff375f", background:"rgba(255,55,95,0.08)", border:"1px solid rgba(255,55,95,0.2)", borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"Inter,sans-serif", whiteSpace:"nowrap" }}> Cap</button>}
                  {needsScript && <button onClick={() => handleMuseWrite(item, "script")} style={{ fontSize:9, fontWeight:700, color:"#2AABFF", background:"rgba(191,90,242,0.08)", border:"1px solid rgba(191,90,242,0.2)", borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"Inter,sans-serif", whiteSpace:"nowrap" }}> Script</button>}
                  {!needsCaption && !needsScript && <span style={{ fontSize:9, color:"#2AABFF", fontWeight:600 }}></span>}
                </div>
              </div>
            );
          })}
          </div>
        </div>
        </Card>
      </div>
      );
    })()}

    {/* TASK BOARD */}
    {activeNav === "taskboard" && (
      <div style={{ animation:"fadeIn 0.4s ease" }}>
        <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:32, fontWeight:700, color:"#f5f5f7", marginBottom:6, letterSpacing:-1 }}>Task Board</h1>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:24 }}>Tasks auto-advance every ~20s · Add tasks to the backlog below</p>
        <OpsBoard />
      </div>
    )}

    {activeNav === "cid" && React.createElement(CIDPage, null)}
    {activeNav === "icp" && <ICPPage />}
    {(activeNav === "sales" || activeNav === "adroihub") && <AdROIHub />}
    {(activeNav === "chat" || activeNav === "broadcast") && <TeamBroadcast agents={agents} />}
    {activeNav === "artgrid" && <ArtgridScoutPage content={content} />}
    {activeNav === "references" && <ReferencesPage />}

    {/* SKILLS */}
    {activeNav === "skills" && <SkillsPage agents={agents} />}

    {/* APPS */}
    {activeNav === "apps" && <AppsPage apps={apps} toggleApp={toggleApp} />}
    {activeNav === "settings" && <SettingsPage />}
    {activeNav === "scrappy" && <AppPlaceholder label="Scraping Ops" desc="Live trend scraping from TikTok, IG, Reddit — powered by Scrappy." icon="◉" />}
    {activeNav === "analytics" && <AppPlaceholder label="Analytics" desc="Pipeline heatmaps, performance breakdowns, and content velocity." icon="◐" />}
    {activeNav === "costs" && <AppPlaceholder label="Cost Governance" desc="API spend tracking, agent budget controls, and cost optimization." icon="$" />}
    {activeNav === "automation" && <AppPlaceholder label="Automation Center" desc="Scheduled agent workflows, n8n triggers, and pipeline automation." icon="⚡" />}

    {/* SOPs */}
    {activeNav === "sops" && (
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
    )}

  </div>

  {/*  MOBILE BOTTOM NAV  */}
  {isMobile && (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:100, background:"rgba(10,8,9,0.96)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", paddingBottom:"env(safe-area-inset-bottom,0)", height:"calc(58px + env(safe-area-inset-bottom,0px))" }}>
      {[
        { id:"dashboard", label:"Home" },
        { id:"tracker", label:"Content" },
        { id:"agents", label:"Agents" },
        { id:"adroihub", label:"ROI" },
        { id:"broadcast", label:"Broadcast" },
      ].map(tab => {
        const active = activeNav === tab.id;
        return (
          <button key={tab.id} onClick={() => setActiveNav(tab.id)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, background:"none", border:"none", cursor:"pointer", padding:"8px 0", height:58 }}>
            <div style={{ width:20, height:20, borderRadius:6, background: active ? "rgba(42,171,255,0.15)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
              <span style={{ fontSize:13, color: active ? "#2AABFF" : "rgba(255,255,255,0.35)" }}>{tab.icon}</span>
            </div>
            <span style={{ fontSize:9, fontWeight: active ? 700 : 400, color: active ? "#2AABFF" : "rgba(255,255,255,0.3)", letterSpacing:0.3, fontFamily:"Inter,sans-serif" }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  )}
</div>
  );
}


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
  