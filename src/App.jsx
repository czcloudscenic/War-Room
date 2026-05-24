import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import './styles/globals.css';

// ── Extracted modules ──
import { sb, DB_CONNECTED } from './services/supabaseClient.js';
import { getIsMobile, useIsMobile, useInterval } from './utils/hooks.js';
import { NAV, STATUS_COLOR, STAGE_SHORT, STATUSES, FORMATS, PILLARS_LIST, PLATFORMS_LIST, CAMPAIGNS } from './utils/constants.js';
import { INITIAL_CONTENT, VITAL_LYFE_SOP } from './data/seed.content.js';
import { AGENTS_BASE, AGENT_TASKS, ACTION_COLORS } from './data/seed.agents.js';
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
import ShotRefScout from './apps/shot-ref/ShotRefScout.jsx';
import HeroGeneratorPage from './apps/hero-gen/HeroGeneratorPage.jsx';
import AgentChatPage from './ui/agents/AgentChatPage.jsx';
import EditContentModal from './ui/pipeline/EditContentModal.jsx';
import CIDPage from './apps/competitor-intel/CIDPage.jsx';
import ICPPage from './ui/command/ICPPage.jsx';
import BriefGenPage from './apps/brief-gen/BriefGenPage.jsx';
import LoginScreen from './ui/layout/LoginScreen.jsx';
import ClientView from './ui/client/ClientView.jsx';
import SettingsPage from './ui/settings/SettingsPage.jsx';
import TypingTask from './ui/shared/TypingTask.jsx';
import PlaceholderPage from './ui/shared/PlaceholderPage.jsx';
import OpsBoard from './ui/dashboard/OpsBoard.jsx';
import ActivityFeed from './ui/dashboard/ActivityFeed.jsx';
import ContentPipelineBoard from './ui/pipeline/ContentPipelineBoard.jsx';
import AddClientModal from './ui/clients/AddClientModal.jsx';

//  ROOT APP WRAPPER
const ADMIN_EMAILS = ["cz@cloudscenic.com","dv@cloudscenic.com","ss@cloudscenic.com"];
const ALLOWED_DOMAIN = "cloudscenic.com";

function App() {
  const [session, setSession] = useState(null);
  const [role, setRole]       = useState(null);
  const [checking, setChecking] = useState(true);
  const [content, setContent] = useState([]);

  // Shared session-setup logic for both initial load + auth state changes
  const setupSession = async (s) => {
    const email = (s?.user?.email || "").toLowerCase();
    console.log("[auth] setupSession start", { email, userId: s?.user?.id });

    // Domain guard: only @cloudscenic.com accounts allowed
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      console.warn("[auth] domain guard rejected", email);
      await sb.auth.signOut();
      setSession(null); setRole(null);
      alert(`Access restricted to @${ALLOWED_DOMAIN} accounts.`);
      return;
    }

    let detectedRole = ADMIN_EMAILS.includes(email) ? "admin" : "client";
    try {
      const { data: profile, error: profErr } = await sb
        .from("profiles").select("role").eq("id", s.user.id).maybeSingle();
      if (profErr) console.warn("[auth] profile query error", profErr);
      if (profile?.role) detectedRole = profile.role;
    } catch (e) { console.warn("[auth] profile query threw", e); }

    try {
      const { data: items, error: itemsErr } = await sb
        .from("content_items").select("*").order("id");
      if (itemsErr) console.warn("[auth] content_items error", itemsErr);
      if (items) setContent(items.map(r => ({ ...r, platforms: r.platforms || [] })));
    } catch (e) { console.warn("[auth] content_items threw", e); }

    console.log("[auth] setupSession ok", { email, role: detectedRole });
    setSession(s); setRole(detectedRole);
  };

  useEffect(() => {
    // Initial session check (handles OAuth redirect-back: supabase-js reads
    // the auth fragment from the URL before getSession resolves)
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      console.log("[auth] getSession initial", { hasSession: !!s, email: s?.user?.email });
      if (s) {
        try { await setupSession(s); }
        catch (e) { console.error("[auth] setupSession failed (initial)", e); }
      }
      setChecking(false);
    });
    // Handle subsequent auth events (SIGNED_IN, SIGNED_OUT, INITIAL_SESSION, TOKEN_REFRESHED)
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, s) => {
      console.log("[auth] onAuthStateChange", event, { hasSession: !!s, email: s?.user?.email });
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s) {
        try { await setupSession(s); }
        catch (e) { console.error("[auth] setupSession failed (event)", e); }
      }
      if (event === "SIGNED_OUT") { setSession(null); setRole(null); }
    });
    return () => subscription?.unsubscribe();
  }, []);

  const handleSignOut = async () => { await sb.auth.signOut(); setSession(null); setRole(null); };

  if (checking) return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 1.5s ease-in-out infinite" }} />
    </div>
  );
  // AUTH BYPASS (temporary — Google OAuth debug pending).
  // No login page; anyone reaching the URL is treated as the admin fallback user.
  // Re-enable auth by uncommenting the line below.
  // if (!session) return <LoginScreen />;
  const effectiveUser = session?.user || { email: 'admin@cloudscenic.com' };
  const effectiveRole = role || 'admin';
  if (effectiveRole === "client") return <ClientView user={effectiveUser} content={content} setContent={setContent} onSignOut={handleSignOut} />;
  return <Vantus onSignOut={handleSignOut} userEmail={effectiveUser.email} content={content} setContent={setContent} />;
}
// 


const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@400;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap";
document.head.appendChild(fontLink);





function Vantus({ onSignOut, userEmail, content: contentProp, setContent: setContentProp }) {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [activePlatform, setActivePlatform] = useState("instagram");

  // ── Multi-tenant: client roster + currently-active client ──
  const [clients, setClients] = useState([]);
  const [currentClient, setCurrentClient] = useState(null);  // {id, slug, name, brand_color, ...}
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);  // null = not editing
  const switchClient = useCallback((c) => {
    setCurrentClient(c);
    try { localStorage.setItem("vantus_current_client_id", c.id); } catch {}
    setClientPickerOpen(false);
  }, []);
  const [selectedAgent, setSelectedAgent] = useState(null);
  // feed state removed — ActivityFeed self-manages from agent_events table
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
        // Detect client actions and fire notification.
        // /api/notify now INSERTs into the notifications table (Move 3); the
        // notifications realtime subscription below delivers it back to local state.
        // Optimistic in-memory push removed — DB is the source of truth.
        const newStatus = payload.new?.status;
        const oldStatus = payload.old?.status;
        const clientStatuses = ["Approved", "Needs Revisions"];
        if (clientStatuses.includes(newStatus) && newStatus !== oldStatus) {
          const type = newStatus === "Approved" ? "approved" : "revision_requested";
          fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, item: payload.new, client_id: payload.new?.client_id }),
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

  // ── CLIENTS (multi-tenant) ──
  // Fetch the client roster on mount, set currentClient from localStorage
  // (or default to the first active client). Subscribe to realtime so
  // newly-added clients appear without refresh.
  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await sb
        .from("clients")
        .select("id, slug, name, brand_voice_md, brand_color, logo_url, primary_email, slack_channel_id, n8n_webhook_url, status")
        .eq("status", "active")
        .order("name");
      if (cancelled || error) { if (error) console.warn("[clients] fetch error", error); return; }
      const list = data || [];
      setClients(list);
      // Pick currentClient: saved id → first active → null
      let savedId = null;
      try { savedId = localStorage.getItem("vantus_current_client_id"); } catch {}
      const saved = savedId ? list.find(c => c.id === savedId) : null;
      setCurrentClient(saved || list[0] || null);
    })();
    const ch = sb.channel("clients_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => {
        if (payload.eventType === "INSERT") setClients(prev => [...prev, payload.new]);
        if (payload.eventType === "UPDATE") setClients(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        if (payload.eventType === "DELETE") setClients(prev => prev.filter(c => c.id !== payload.old.id));
      }).subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, []);

  // ── NOTIFICATIONS (Move 3 — DB-backed, multi-tenant scoped) ──
  // Fetch last 30 on mount + realtime, scoped to currentClient.
  useEffect(() => {
    if (!sb) return;
    const clientId = currentClient?.id;
    if (!clientId) { setNotifications([]); return; }
    let cancelled = false;
    const mapRow = (row) => ({
      id: row.id,
      ts: new Date(row.ts).getTime(),
      type: row.type,
      item: row.payload?.item || null,
      message: row.payload?.message || "",
      read: row.read,
    });
    (async () => {
      const { data, error } = await sb
        .from("notifications")
        .select("id, ts, type, payload, read, client_id")
        .eq("client_id", clientId)
        .order("ts", { ascending: false })
        .limit(30);
      if (cancelled) return;
      if (error) { console.warn("[notifications] fetch error", error); return; }
      setNotifications((data || []).map(mapRow));
    })();
    const ch = sb.channel(`notifications_${clientId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `client_id=eq.${clientId}` },
        (payload) => {
          setNotifications(prev => [mapRow(payload.new), ...prev].slice(0, 30));
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `client_id=eq.${clientId}` },
        (payload) => {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? mapRow(payload.new) : n));
        }
      )
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [currentClient?.id]);

  // Mark all currently-unread notifications as read in the DB.
  // Used by the bell-click handler.
  const markAllNotificationsRead = useCallback(async () => {
    if (!sb) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await sb.from("notifications").update({ read: true }).in("id", unreadIds);
    if (error) console.warn("[notifications] mark-read error", error);
    // Realtime UPDATE event will refresh local state; no optimistic flip needed.
  }, [notifications]);

  const [editingItem, setEditingItem] = useState(null);
  const [isNewItem, setIsNewItem] = useState(false);

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
  // ACTIVITY_POOL theater removed — ActivityFeed now self-fetches real agent_events
  // from Supabase + subscribes to realtime inserts. See src/ui/dashboard/ActivityFeed.jsx.

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
// Multi-tenant: tag new items with currentClient. Existing items keep their own client_id.
const item = { ...updated, stage: updated.status, platform: primaryPlatform, type: itemType };
if (isNewItem && currentClient?.id) item.client_id = currentClient.id;

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
  client_id: item.client_id || currentClient?.id,  // multi-tenant: preserve or default
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
  const [igIdeasLoading, setIgIdeasLoading] = useState(false);
  const handleIgIdeas = async () => {
    setIgIdeasLoading(true);
    setMuseToast({ id: "ig-ideas", field: "ideas", status: "writing" });
    try {
      const res = await safeAgentFetch("/api/agent-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "muse_ig_ideas", payload: { campaign: "Drip Campaign" }, client_id: currentClient?.id }),
      });
      const d = await res.json();
      if (d.error || !d.success) throw new Error(d.error || d.message || "Unknown error");
      setMuseToast({ id: "ig-ideas", field: "ideas", status: "done", content: `${d.count} ideas added to Content Tracker` });
      setTimeout(() => setMuseToast(null), 5000);
    } catch(e) {
      setMuseToast({ id: "ig-ideas", field: "ideas", status: "error", msg: e.message });
      setTimeout(() => setMuseToast(null), 5000);
    } finally {
      setIgIdeasLoading(false);
    }
  };
  const handleMuseWrite = async (item, field) => {
setMuseToast({ id: item.id, field, status: "writing" });
try {
  const res = await fetch("/api/agent-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "muse_write_content",
      payload: { itemId: item.id, itemTitle: item.title, pillar: item.pillar, format: item.format, description: item.description, fieldToUpdate: field },
      client_id: item.client_id || currentClient?.id,
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

  const sidebarW = 260;
  // Multi-tenant scope: filter content to currentClient. When currentClient is
  // null (during initial load), show nothing (don't leak other clients' data).
  const clientContent = currentClient
    ? content.filter(x => x.client_id === currentClient.id)
    : [];
  const igItems = clientContent.filter(x => x.platform === "instagram");
  const ttItems = clientContent.filter(x => x.platform === "tiktok");
  const ytItems = clientContent.filter(x => x.platform === "youtube");

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
    <div style={{ height:52, background:"#0e0c0d", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", padding:"0 12px", gap:10, zIndex:50, flexShrink:0, paddingTop:"env(safe-area-inset-top,0)" }}>
      {/* Vantus app logo */}
      <div style={{ width:32, height:32, flexShrink:0 }}>
        <img src="/vantus-logo.png" style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }} />
      </div>
      {/* Client switcher: tap to open client picker drawer */}
      <button
        onClick={() => setClientPickerOpen(o => !o)}
        style={{ flex:1, display:"flex", alignItems:"center", gap:8, padding:"4px 8px", background:"transparent", border:"none", cursor:"pointer", minWidth:0, textAlign:"left", fontFamily:"Inter, sans-serif" }}
      >
        <div style={{ width:24, height:24, borderRadius:6, background: currentClient?.logo_url ? "rgba(255,255,255,0.05)" : (currentClient?.brand_color || "#222"), display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0, padding: currentClient?.logo_url ? 2 : 0, boxSizing:"border-box" }}>
          {currentClient?.logo_url ? (
            <img src={currentClient.logo_url} alt={currentClient.name} style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", display:"block" }} />
          ) : (
            <span style={{ fontSize:10, fontWeight:700, color:"#fff" }}>{(currentClient?.name || "?").slice(0,1).toUpperCase()}</span>
          )}
        </div>
        <div style={{ flex:1, minWidth:0, overflow:"hidden" }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#f5f5f7", letterSpacing:-0.2, lineHeight:1.1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{currentClient?.name || "Vantus"}</div>
          <div style={{ fontSize:8, color:"rgba(255,255,255,0.35)", fontFamily:"'Geist Mono',monospace", letterSpacing:1.2, textTransform:"uppercase", marginTop:1 }}>Tap to switch ▾</div>
        </div>
      </button>
      {/* Mobile notification bell */}
      <button
        onClick={() => {
          if (!notifOpen) {
            setNotifPos({ x: 12, y: 60 });
            markAllNotificationsRead();
          }
          setNotifOpen(o => !o);
        }}
        style={{ position:"relative", background:"#161414", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"rgba(255,255,255,0.85)", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {notifications.filter(n=>!n.read).length > 0 && (
          <span style={{ position:"absolute", top:-4, right:-4, width:14, height:14, borderRadius:"50%", background:"#ff453a", fontSize:8, fontWeight:700, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {notifications.filter(n=>!n.read).length}
          </span>
        )}
      </button>
      <button onClick={() => setMobileNavOpen(o => !o)}
        style={{ background:"#161414", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f5f5f7", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18, flexShrink:0 }}>
        {mobileNavOpen ? "×" : "≡"}
      </button>
    </div>
  )}

  {/* MOBILE CLIENT PICKER SHEET — slides up from below the top bar */}
  {isMobile && clientPickerOpen && (
    <div style={{ position:"fixed", inset:0, top:52, zIndex:180 }} onClick={() => setClientPickerOpen(false)}>
      <div style={{ position:"absolute", top:0, left:0, right:0, background:"#0e0c0d", borderBottom:"1px solid rgba(255,255,255,0.08)", animation:"slideUp 0.2s ease", maxHeight:"70vh", overflowY:"auto", paddingBottom:12 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:"12px 16px 6px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.45)", letterSpacing:2, fontWeight:600, textTransform:"uppercase" }}>Switch Client</span>
          <button onClick={() => setClientPickerOpen(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:16, padding:"0 4px" }}>×</button>
        </div>
        <button onClick={() => { setAddClientOpen(true); setClientPickerOpen(false); }}
          style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 12px 8px", padding:"12px 14px", background:"rgba(42,171,255,0.08)", border:"1px dashed rgba(42,171,255,0.3)", borderRadius:10, color:"#2AABFF", cursor:"pointer", fontFamily:"Inter, sans-serif", fontSize:13, fontWeight:500, width:"calc(100% - 24px)" }}>
          <span style={{ fontSize:18, lineHeight:1 }}>+</span> Add new client
        </button>
        {clients.length === 0 && (
          <div style={{ padding:"24px 16px", fontSize:12, color:"rgba(255,255,255,0.4)", textAlign:"center" }}>No clients yet.</div>
        )}
        {clients.map(c => {
          const isActive = currentClient?.id === c.id;
          return (
            <div key={c.id} style={{ display:"flex", alignItems:"stretch", margin:"0 12px 4px" }}>
              <button onClick={() => switchClient(c)}
                style={{ flex:1, display:"flex", alignItems:"center", gap:12, padding:"12px 12px", background: isActive ? "rgba(255,255,255,0.06)" : "transparent", border:"1px solid " + (isActive ? "rgba(255,255,255,0.12)" : "transparent"), borderRadius:"10px 0 0 10px", borderRight:"none", cursor:"pointer", textAlign:"left", fontFamily:"Inter, sans-serif" }}>
                <div style={{ width:30, height:30, borderRadius:7, background: c.logo_url ? "rgba(255,255,255,0.05)" : (c.brand_color || "#222"), display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0, padding: c.logo_url ? 2 : 0, boxSizing:"border-box" }}>
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", display:"block" }} />
                  ) : (
                    <span style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{(c.name || "?").slice(0,1).toUpperCase()}</span>
                  )}
                </div>
                <span style={{ flex:1, fontSize:14, fontWeight:isActive?600:400, color:isActive?"#f5f5f7":"rgba(255,255,255,0.75)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                {isActive && <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontFamily:"'Geist Mono', monospace" }}>ACTIVE</span>}
              </button>
              <button onClick={() => { setEditingClient(c); setClientPickerOpen(false); }}
                title={`Edit ${c.name}`}
                style={{ width:42, background: isActive ? "rgba(255,255,255,0.06)" : "transparent", border:"1px solid " + (isActive ? "rgba(255,255,255,0.12)" : "transparent"), borderLeft:"none", borderRadius:"0 10px 10px 0", color:"rgba(255,255,255,0.45)", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>
                ✎
              </button>
            </div>
          );
        })}
      </div>
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
  <div className="vantus-grid-bg" style={{ width: sidebarCollapsed ? 68 : sidebarW, minWidth: sidebarCollapsed ? 68 : sidebarW, background:"transparent", borderRight:"1px solid rgba(255,255,255,0.05)", display:"flex", flexDirection:"column", overflow:"hidden", zIndex:20, flexShrink:0, transition:"width 0.18s ease" }}>
    <div style={{ padding:sidebarCollapsed?"16px 0":"16px 16px 14px", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>

      {/*  COLLAPSED  */}
      {sidebarCollapsed && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ width:40, height:40 }}>
            <img src="/vantus-logo.png" style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }} />
          </div>
          <button onClick={() => setSidebarCollapsed(c => !c)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:14, padding:2, lineHeight:1 }}>›</button>
        </div>
      )}

      {/*  EXPANDED  */}
      {!sidebarCollapsed && (
        <div>
          {/* Row 1: icon + wordmark + collapse toggle */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:40, height:40, flexShrink:0 }}>
              <img src="/vantus-logo.png" style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }} />
            </div>
            <div
              onClick={() => setClientPickerOpen(o => !o)}
              title="Switch client"
              style={{ flex:1, minWidth:0, cursor:"pointer" }}
            >
              <div style={{ fontSize:14, fontWeight:600, color:"#f5f5f7", letterSpacing:-0.4, lineHeight:1.2 }}>Vantus</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background: currentClient?.brand_color || (dbStatus==="live"?"#2AABFF":dbStatus==="error"?"#ff453a":"#F17130"), flexShrink:0 }} />
                <span style={{ flex:1, fontSize:9, color:"rgba(255,255,255,0.5)", fontWeight:500, fontFamily:"'Geist Mono', monospace", letterSpacing:1.5, textTransform:"uppercase", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{currentClient?.name || "..."}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)", marginLeft:2 }}>▾</span>
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
                  // Spawn panel directly below the bell, left-aligned with it
                  const rect = e.currentTarget.getBoundingClientRect();
                  setNotifPos({
                    x: Math.max(8, Math.min(window.innerWidth - 308, rect.left)),
                    y: rect.bottom + 6,
                  });
                  markAllNotificationsRead();
                }
                setNotifOpen(o=>!o);
              }}
                style={{ position:"relative", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.18)", borderRadius:8, padding:"6px 8px", cursor:"pointer", lineHeight:1, color:"rgba(255,255,255,0.85)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                
                {notifications.filter(n=>!n.read).length > 0 && (
                  <span style={{ position:"absolute", top:-4, right:-4, width:14, height:14, borderRadius:"50%", background:"#ff453a", fontSize:8, fontWeight:700, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {notifications.filter(n=>!n.read).length}
                  </span>
                )}
              </button>
              {notifOpen && createPortal(
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
              {/* ADD CLIENT MODAL */}
              {addClientOpen && createPortal(
                <AddClientModal
                  onClose={() => setAddClientOpen(false)}
                  onCreated={(c) => {
                    setClients(prev => [...prev, c]);
                    switchClient(c);
                    setAddClientOpen(false);
                  }}
                />,
                document.body
              )}
              {/* EDIT CLIENT MODAL */}
              {editingClient && createPortal(
                <AddClientModal
                  editingClient={editingClient}
                  onClose={() => setEditingClient(null)}
                  onUpdated={(c) => {
                    // If archived, drop from active list; otherwise update in place
                    if (c.status === "archived") {
                      setClients(prev => prev.filter(x => x.id !== c.id));
                      if (currentClient?.id === c.id) {
                        const remaining = clients.filter(x => x.id !== c.id);
                        setCurrentClient(remaining[0] || null);
                        try { remaining[0] ? localStorage.setItem("vantus_current_client_id", remaining[0].id) : localStorage.removeItem("vantus_current_client_id"); } catch {}
                      }
                    } else {
                      setClients(prev => prev.map(x => x.id === c.id ? c : x));
                      if (currentClient?.id === c.id) setCurrentClient(c);
                    }
                    setEditingClient(null);
                  }}
                />,
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
    <div style={{ flex:1, overflowY:"auto", padding:"8px 0", position:"relative" }}>
      {/* CLIENT PICKER DRAWER — overlays the nav when the client header is clicked */}
      {clientPickerOpen && !sidebarCollapsed && (
        <div style={{ position:"absolute", inset:0, background:"#0a0a0f", zIndex:5, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"12px 16px 6px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:9, color:"rgba(255,255,255,0.45)", letterSpacing:2, fontWeight:600, textTransform:"uppercase" }}>Switch Client</span>
            <button onClick={() => setClientPickerOpen(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:14, padding:"0 4px" }}>×</button>
          </div>
          <button
            onClick={() => { setAddClientOpen(true); setClientPickerOpen(false); }}
            style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 8px 6px", padding:"10px 12px", background:"rgba(42,171,255,0.08)", border:"1px dashed rgba(42,171,255,0.3)", borderRadius:10, color:"#2AABFF", cursor:"pointer", fontFamily:"Inter, sans-serif", fontSize:12, fontWeight:500 }}
          >
            <span style={{ fontSize:16, lineHeight:1 }}>+</span> Add new client
          </button>
          <div style={{ flex:1, overflowY:"auto" }}>
            {clients.length === 0 && (
              <div style={{ padding:"24px 16px", fontSize:11, color:"rgba(255,255,255,0.4)", textAlign:"center" }}>No clients yet. Click "Add new client" above.</div>
            )}
            {clients.map(c => {
              const isActive = currentClient?.id === c.id;
              return (
                <div key={c.id} style={{ display:"flex", alignItems:"stretch", gap:0, margin:"0 8px 4px" }}>
                  <button
                    onClick={() => switchClient(c)}
                    style={{ flex:1, display:"flex", alignItems:"center", gap:11, padding:"9px 10px", background: isActive ? "rgba(255,255,255,0.06)" : "transparent", border:"1px solid " + (isActive ? "rgba(255,255,255,0.12)" : "transparent"), borderRadius:"10px 0 0 10px", borderRight:"none", cursor:"pointer", textAlign:"left", fontFamily:"Inter, sans-serif" }}
                  >
                    <div style={{ width:28, height:28, borderRadius:7, background: c.logo_url ? "rgba(255,255,255,0.05)" : (c.brand_color || "#222"), display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0, padding: c.logo_url ? 2 : 0, boxSizing:"border-box" }}>
                      {c.logo_url ? (
                        <img src={c.logo_url} alt={c.name} style={{ maxWidth:"100%", maxHeight:"100%", width:"auto", height:"auto", objectFit:"contain", display:"block" }} />
                      ) : (
                        <span style={{ fontSize:11, fontWeight:700, color:"#fff", letterSpacing:0.3 }}>{(c.name || "?").slice(0,1).toUpperCase()}</span>
                      )}
                    </div>
                    <span style={{ flex:1, fontSize:13, fontWeight:isActive?600:400, color:isActive?"#f5f5f7":"rgba(255,255,255,0.75)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                    {isActive && <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontFamily:"'Geist Mono', monospace" }}>ACTIVE</span>}
                  </button>
                  <button
                    onClick={() => { setEditingClient(c); setClientPickerOpen(false); }}
                    title={`Edit ${c.name}`}
                    style={{ width:32, background: isActive ? "rgba(255,255,255,0.06)" : "transparent", border:"1px solid " + (isActive ? "rgba(255,255,255,0.12)" : "transparent"), borderLeft:"none", borderRadius:"0 10px 10px 0", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}
                  >
                    ✎
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          <Card style={{ padding:"4px 0", maxHeight:320, overflowY:"auto" }}><ActivityFeed clientId={currentClient?.id} /></Card>
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

    {/* CONTENT (unified: Instagram / TikTok / YouTube with tab switcher) */}
    {activeNav === "content" && (() => {
      const STAGES = ["Ready For Copy Creation","Need Copy Approval","Ready For Content Creation","Need Content Approval","Needs Revisions","Approved","Ready For Schedule","Scheduled"];
      const STAGE_COLORS = ["#f59e0b","#3b82f6","#10b981","#ff453a","#f97316","#2AABFF","#8b5cf6","#64d2ff"];
      const platforms = [
        { id:"instagram", label:"Instagram", dot:"#dc2743", items: igItems, subtitle:`@vitallyfe · ${igItems.length} pieces in pipeline` },
        { id:"tiktok",    label:"TikTok",    dot:"#ff0050", items: ttItems, subtitle:`@vitallyfe · ${ttItems.length} pieces in pipeline` },
        { id:"youtube",   label:"YouTube",   dot:"#ff0000", items: ytItems, subtitle:`VitalLyfe · ${ytItems.length} pieces · Long-form & Shorts` },
      ];
      const active = platforms.find(p => p.id === activePlatform) || platforms[0];
      return (
      <div style={{ animation:"fadeIn 0.4s ease" }}>
        {/* Platform tab switcher */}
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {platforms.map(p => {
            const isActive = p.id === activePlatform;
            return (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                style={{
                  display:"flex", alignItems:"center", gap:10,
                  background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                  border: "1px solid " + (isActive ? "rgba(255,255,255,0.18)" : "transparent"),
                  borderRadius: 14,
                  padding: "10px 18px",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span style={{ width:8, height:8, borderRadius:"50%", background:p.dot, flexShrink:0 }} />
                <span style={{ fontSize:14, fontWeight: isActive ? 600 : 400, color: isActive ? "#f5f5f7" : "rgba(255,255,255,0.55)" }}>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active platform header */}
        <div style={{ display:"flex", alignItems: isMobile ? "flex-start" : "center", gap:14, marginBottom: isMobile ? 16 : 28, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 22 : 30, fontWeight:700, color:"#f5f5f7", margin:0, letterSpacing:-1 }}>{active.label}</h1>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>{active.subtitle}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", width: isMobile ? "100%" : "auto" }}>
            {!isMobile && STAGES.map(s => {
              const n = active.items.filter(x => x.stage === s).length;
              if (!n) return null;
              return <span key={s} style={{ fontSize:9, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.07)", padding:"3px 8px", borderRadius:20, fontWeight:600 }}>{s} · {n}</span>;
            })}
            {active.id === "instagram" && (
              <button onClick={handleIgIdeas} disabled={igIdeasLoading} style={{ background: igIdeasLoading ? "rgba(255,55,95,0.15)" : "rgba(255,55,95,0.12)", border:"1px solid rgba(255,55,95,0.3)", borderRadius:10, color:"#ff375f", fontSize:12, fontWeight:600, padding:"7px 14px", cursor: igIdeasLoading ? "not-allowed" : "pointer", fontFamily:"Inter, sans-serif", flexShrink:0, display:"flex", alignItems:"center", gap:6 }}>
                {igIdeasLoading ? <><span style={{ width:8, height:8, borderRadius:"50%", background:"#ff375f", display:"inline-block", animation:"livePulse 1s infinite" }} /> Generating…</> : "✍️ 5 IG Ideas"}
              </button>
            )}
            <button onClick={handleAddNew} style={{ background:"#0f0f1a", border:"none", borderRadius:10, color:"#fff", fontSize:12, fontWeight:600, padding:"7px 14px", cursor:"pointer", fontFamily:"Inter, sans-serif", flexShrink:0 }}>+ Add</button>
          </div>
        </div>

        {/* Pipeline boards per platform */}
        {active.id === "instagram" && (
          <>
            <ContentPipelineBoard title="Reels & Graphics Pipeline" icon=""
              stages={STAGES} stageColors={STAGE_COLORS}
              items={active.items.filter(x => x.type==="reel" || x.type==="graphic")}
              onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
            />
            <ContentPipelineBoard title="Carousels & Threads" icon=""
              stages={STAGES} stageColors={STAGE_COLORS}
              items={active.items.filter(x => x.type==="carousel" || x.type==="thread")}
              onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
            />
          </>
        )}
        {active.id === "tiktok" && (
          <ContentPipelineBoard title="TikTok Pipeline" icon=""
            stages={STAGES} stageColors={STAGE_COLORS}
            items={active.items}
            onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
          />
        )}
        {active.id === "youtube" && (
          <ContentPipelineBoard title="Production Pipeline" icon=""
            stages={STAGES} stageColors={STAGE_COLORS}
            items={active.items}
            onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
          />
        )}
      </div>
      );
    })()}

    {/* CONTENT TRACKER */}
    {activeNav === "tracker" && (() => {
      const filtered = clientContent.filter(item => {
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
            <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 24 : 32, fontWeight:700, color:"#f5f5f7", marginBottom:4, letterSpacing:-1 }}>Production</h1>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", margin:0 }}>{filtered.length} of {clientContent.length} pieces · Tap any row to edit</p>
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
          <MetricCard label="Total Pieces" value={clientContent.length} delta={0} color="#2AABFF" />
          <MetricCard label="Approved" value={clientContent.filter(x=>x.status==="Approved").length} delta={0} color="#2AABFF" />
          {!isMobile && <MetricCard label="Scheduled" value={clientContent.filter(x=>x.status==="Scheduled").length} delta={0} color="#0a84ff" />}
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
    {activeNav === "briefgen" && <BriefGenPage onContentAdded={(items) => setContent(prev => [...prev, ...items])} />}
    {activeNav === "shotref" && <ShotRefScout />}
    {activeNav === "herogen" && <HeroGeneratorPage />}
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
        { id:"taskboard", label:"Tasks" },
      ].map(tab => {
        const active = activeNav === tab.id;
        return (
          <button key={tab.id} onClick={() => setActiveNav(tab.id)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, background:"none", border:"none", cursor:"pointer", padding:"8px 0", height:58, position:"relative" }}>
            {active && <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:24, height:2, background:"#2AABFF", borderRadius:"0 0 2px 2px" }} />}
            <span style={{ fontSize:11, fontWeight: active ? 600 : 500, color: active ? "#2AABFF" : "rgba(255,255,255,0.55)", letterSpacing:0.2, fontFamily:"Inter,sans-serif" }}>{tab.label}</span>
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
  