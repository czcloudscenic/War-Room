import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import './styles/globals.css';

// ── Extracted modules ──
import { sb, DB_CONNECTED } from './services/supabaseClient.js';
import { apiFetch } from './services/apiFetch.js';
import { getIsMobile, useIsMobile, useInterval } from './utils/hooks.js';
import { NAV } from './utils/constants.js';
import { AGENTS_BASE, ACTION_COLORS } from './data/seed.agents.js';
import { OPS_INIT } from './data/seed.ops.js';
import { getMemory, setMemory, buildSystemPrompt, updateAgentMemory } from './core/memory.js';
import { AGENT_KEYWORDS, ROUTE_PROMPTS } from './core/agentRegistry.js';
import { routeTask } from './core/routeTask.js';
import { DEFAULT_APPS, loadApps } from './apps/apps.config.js';
import AppPlaceholder from './ui/shared/AppPlaceholder.jsx';

// ── Extracted UI components (Phase 3) ──
import QuickActionsDashboard from './ui/dashboard/QuickActionsDashboard.jsx';
import AppsPage from './ui/apps/AppsPage.jsx';
import ReferencesPage from './apps/references/ReferencesPage.jsx';
import SkillsPage from './apps/skills/SkillsPage.jsx';
import AdROIHub from './apps/ad-roi/AdROIHub.jsx';
import TeamBroadcast from './ui/agents/TeamBroadcast.jsx';
import ArtgridScoutPage from './apps/artgrid/ArtgridScoutPage.jsx';
import EditContentModal from './ui/pipeline/EditContentModal.jsx';
import CIDPage from './apps/competitor-intel/CIDPage.jsx';
import ICPPage from './ui/command/ICPPage.jsx';
import LoginScreen from './ui/layout/LoginScreen.jsx';
import SettingsPage from './ui/settings/SettingsPage.jsx';
import TypingTask from './ui/shared/TypingTask.jsx';
import PlaceholderPage from './ui/shared/PlaceholderPage.jsx';
import AddClientModal from './ui/clients/AddClientModal.jsx';
import DashboardRoute from './ui/routes/DashboardRoute.jsx';
import AgentsRoute from './ui/routes/AgentsRoute.jsx';
import ContentRoute from './ui/routes/ContentRoute.jsx';
import AnalyticsRoute from './ui/routes/AnalyticsRoute.jsx';
import IdeaEngineRoute from './ui/routes/IdeaEngineRoute.jsx';

//  ROOT APP WRAPPER
const ADMIN_EMAILS = ["cz@cloudscenic.com","dv@cloudscenic.com","ss@cloudscenic.com"];
const ALLOWED_DOMAIN = "cloudscenic.com";

function App() {
  const [session, setSession] = useState(null);
  const [role, setRole]       = useState(null);
  const [checking, setChecking] = useState(true);
  const [content, setContent] = useState([]);
  // pendingInvite: { email, client_users_id, client_id } when the signed-in
  // email exists in client_users but status is still 'pending'. Drives the
  // "awaiting approval" screen + realtime listener that flips state when admin approves.
  const [pendingInvite, setPendingInvite] = useState(null);
  const [clientIds, setClientIds] = useState([]); // for external client users — which client(s) they belong to

  // Dedupe setupSession so it runs at most once per unique user.id.
  // Without this, SIGNED_IN + INITIAL_SESSION + getSession all fire in parallel
  // on OAuth redirect-back, fighting over the supabase-js auth lock (5s timeout
  // → "Lock broken with steal option" AbortError → spinner hangs forever).
  const setupRanForRef = useRef(null);

  // Shared session-setup logic for both initial load + auth state changes
  const setupSession = async (s) => {
    if (!s?.user) return;
    if (setupRanForRef.current === s.user.id) {
      console.log("[auth] setupSession skipped (already ran for this user)");
      return;
    }
    setupRanForRef.current = s.user.id;

    const email = (s?.user?.email || "").toLowerCase();
    console.log("[auth] setupSession start", { email, userId: s?.user?.id });

    // ── HEALTH CHECK ─────────────────────────────────────────────────────────
    // After supabase-js says the session is valid, verify the token actually
    // works server-side by hitting /auth/v1/user (sb.auth.getUser). The recurring
    // "page down after deploy" pattern was: localStorage held a token that
    // supabase-js trusted (so onAuthStateChange + getSession both fired SIGNED_IN)
    // but the server had since rotated/invalidated it. Queries silently returned
    // 401/403, the UI rendered empty, and the user had to nuke localStorage by
    // hand. This check catches that case and auto-recovers once.
    const HEALTH_FLAG = "vantus_session_health_recovered";
    try {
      const { data: userData, error: userErr } = await sb.auth.getUser();
      const healthy = !userErr && userData?.user?.id;
      if (!healthy) {
        const alreadyTried = (() => { try { return sessionStorage.getItem(HEALTH_FLAG); } catch { return null; } })();
        if (alreadyTried) {
          // Recovery already ran this tab and we're still broken. Don't loop —
          // surface the bad state by signing out so the user lands on LoginScreen.
          console.warn("[auth health] still unhealthy after recovery, forcing sign-out");
          await sb.auth.signOut();
          setSession(null); setRole(null);
          return;
        }
        console.warn("[auth health] server rejected stored session — auto-recovering", { userErr });
        try { sessionStorage.setItem(HEALTH_FLAG, "1"); } catch {}
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && (/^sb-.*-auth-token/.test(k) || k.startsWith("supabase.auth"))) {
              localStorage.removeItem(k);
            }
          }
        } catch {}
        location.reload();
        return;
      }
      // Health check passed — clear the recovery flag so it can fire again next time
      try { sessionStorage.removeItem(HEALTH_FLAG); } catch {}
    } catch (e) {
      // Network error or similar — proceed, the existing query try/catches will surface real issues
      console.warn("[auth health] check threw, proceeding anyway", e);
    }

    // Admin path: @cloudscenic.com → full agency access
    if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      let detectedRole = ADMIN_EMAILS.includes(email) ? "admin" : "client";
      setSession(s);
      setRole(detectedRole);
      setPendingInvite(null);

      // Best-effort: fetch profile + content. If RLS rejects, log and continue.
      try {
        const { data: profile, error: profErr } = await sb
          .from("profiles").select("role").eq("id", s.user.id).maybeSingle();
        if (profErr) console.warn("[auth] profile query error", profErr);
        if (profile?.role && profile.role !== detectedRole) {
          detectedRole = profile.role;
          setRole(detectedRole);
        }
      } catch (e) { console.warn("[auth] profile query threw", e); }

      try {
        const { data: items, error: itemsErr } = await sb
          .from("content_items").select("*").order("id");
        if (itemsErr) console.warn("[auth] content_items error", itemsErr);
        if (items) setContent(items.map(r => ({ ...r, platforms: r.platforms || [] })));
      } catch (e) { console.warn("[auth] content_items threw", e); }

      console.log("[auth] setupSession ok (admin)", { email, role: detectedRole });
      return;
    }

    // External-client path: look up in client_users allowlist
    let inviteRows = [];
    try {
      const { data, error } = await sb
        .from("client_users")
        .select("id, client_id, status, first_login_at")
        .eq("email", email);
      if (error) console.warn("[auth] client_users lookup error", error);
      inviteRows = data || [];
    } catch (e) {
      console.warn("[auth] client_users lookup threw", e);
    }

    const approved = inviteRows.filter(r => r.status === "approved");
    const pending  = inviteRows.filter(r => r.status === "pending");
    const rejected = inviteRows.filter(r => r.status === "rejected");

    // Approved external client → into ClientView, scoped to their client_id(s)
    if (approved.length > 0) {
      setSession(s);
      setRole("client");
      setClientIds(approved.map(r => r.client_id));
      setPendingInvite(null);

      // Stamp first_login_at if it's never been set (silent best-effort)
      const needsStamp = approved.filter(r => !r.first_login_at).map(r => r.id);
      if (needsStamp.length > 0) {
        sb.from("client_users")
          .update({ first_login_at: new Date().toISOString() })
          .in("id", needsStamp).then(() => {});
      }
      console.log("[auth] setupSession ok (client)", { email, client_ids: approved.map(r => r.client_id) });
      return;
    }

    // Pending invite → show "awaiting approval" screen, don't sign out
    if (pending.length > 0) {
      console.log("[auth] invite pending admin approval", { email });
      setPendingInvite({
        email,
        rows: pending,
      });
      setSession(s);
      setRole(null);

      // Stamp first_login_at + fire admin notification on FIRST login attempt only
      const firstTime = pending.filter(r => !r.first_login_at);
      if (firstTime.length > 0) {
        const ids = firstTime.map(r => r.id);
        sb.from("client_users")
          .update({ first_login_at: new Date().toISOString() })
          .in("id", ids).then(() => {});

        // Fire notification (best-effort, non-blocking)
        apiFetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "client_invite_first_login",
            item: {
              title: `${email} requested access`,
              campaign: "Client invite",
              platform: "Auth",
              pillar: "Access",
              client_note: `Approve in Clients → Team panel for client ${pending[0].client_id}.`,
              id: pending[0].id,
              client_id: pending[0].client_id,
            },
            client_id: pending[0].client_id,
          }),
        }).catch(() => {});
      }
      return;
    }

    // Rejected or unknown → block
    setupRanForRef.current = null;
    await sb.auth.signOut();
    setSession(null); setRole(null); setPendingInvite(null);
    if (rejected.length > 0) {
      alert(`Access denied for ${email}. Contact the agency if you think this is a mistake.`);
    } else {
      alert(`${email} is not on the invite list. Ask Cloud Scenic to invite you, then try again.`);
    }
  };

  useEffect(() => {
    let cancelled = false;

    // Fix #15 — auth-lock auto-recovery.
    // supabase-js holds a navigator.locks mutex around getSession()/signOut().
    // If a prior tab crashed mid-call (or the user has stale localStorage),
    // the lock can deadlock — getSession() never resolves and the whole app
    // hangs. Manual fix used to be `localStorage.clear(); reload()`.
    // Now we do it automatically: stuckGuard fires after 4s, clears just the
    // sb-*-auth-token keys, and reloads once. A sessionStorage flag prevents
    // an infinite reload loop if the second attempt also hangs.
    const RECOVERY_FLAG = "vantus_auth_recovery_attempted";

    let stuckGuard = setTimeout(() => {
      if (cancelled) return;
      const alreadyTried = (() => { try { return sessionStorage.getItem(RECOVERY_FLAG); } catch { return null; } })();
      if (alreadyTried) {
        // Recovery already ran this tab; don't loop. Drop to login screen.
        console.warn("[auth] stuckGuard fired again after recovery — falling through to login");
        setChecking(false);
        return;
      }
      console.warn("[auth] stuckGuard fired — auto-recovering (clearing sb auth keys + reload)");
      try { sessionStorage.setItem(RECOVERY_FLAG, "1"); } catch {}
      try {
        // Clear only the supabase-js auth-token keys — preserve unrelated app state
        // like vantus_agent_hists, vantus_current_client_id, apps prefs, etc.
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (/^sb-.*-auth-token/.test(k) || k.startsWith("supabase.auth"))) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
        console.log("[auth] recovery cleared", toRemove.length, "auth key(s):", toRemove);
      } catch (e) {
        console.warn("[auth] recovery localStorage clear failed", e);
      }
      // Reload — fastest path back to a working session
      location.reload();
    }, 8000);

    // Cancel the guard the moment auth resolves — success OR confirmed signed-out.
    // Without this, opening Vantus in a second tab would race the 8s timer:
    // tab 2 resolves its session in ~5s (second-tab navigator.locks is slower),
    // but the guard still fired and wiped tokens for BOTH tabs.
    const clearStuckGuard = () => {
      if (stuckGuard) { clearTimeout(stuckGuard); stuckGuard = null; }
    };

    // Initial session check (handles OAuth redirect-back: supabase-js reads
    // the auth fragment from the URL before getSession resolves)
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      if (cancelled) return;
      clearStuckGuard();
      console.log("[auth] getSession initial", { hasSession: !!s, email: s?.user?.email });
      setChecking(false);
      if (s) {
        try { await setupSession(s); }
        catch (e) { console.error("[auth] setupSession failed (initial)", e); }
      }
    });
    // Handle subsequent auth events (SIGNED_IN, SIGNED_OUT, INITIAL_SESSION, TOKEN_REFRESHED)
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, s) => {
      console.log("[auth] onAuthStateChange", event, { hasSession: !!s, email: s?.user?.email });
      clearStuckGuard();
      // Always flip checking off as soon as we hear from auth — even if getSession is still hung
      setChecking(false);
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s) {
        // Clear recovery flag so the next time we get stuck, auto-recovery can fire again
        try { sessionStorage.removeItem(RECOVERY_FLAG); } catch {}
        try { await setupSession(s); }
        catch (e) { console.error("[auth] setupSession failed (event)", e); }
      }
      if (event === "SIGNED_OUT") {
        setupRanForRef.current = null;
        setSession(null);
        setRole(null);
        setPendingInvite(null);
        setClientIds([]);
      }
    });
    return () => {
      cancelled = true;
      clearStuckGuard();
      subscription?.unsubscribe();
    };
  }, []);

  // While stuck on "awaiting approval", listen for admin to flip our row to 'approved'
  useEffect(() => {
    if (!pendingInvite?.email) return;
    const channel = sb.channel(`client_users:${pendingInvite.email}`)
      .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "client_users", filter: `email=eq.${pendingInvite.email}` },
          (payload) => {
            console.log("[auth] pending invite update", payload.new);
            if (payload.new?.status === "approved") {
              // Re-run setupSession with the current session to flip into client view
              setupRanForRef.current = null;
              sb.auth.getSession().then(({ data: { session: s } }) => { if (s) setupSession(s); });
            }
            if (payload.new?.status === "rejected") {
              sb.auth.signOut();
            }
          })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [pendingInvite?.email]);

  const handleSignOut = async () => {
    await sb.auth.signOut();
    setSession(null); setRole(null); setPendingInvite(null); setClientIds([]);
  };

  if (checking) return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 1.5s ease-in-out infinite" }} />
    </div>
  );
  // Auth gate restored (Fix #1, 2026-05-25). No session → LoginScreen.
  if (!session) return <LoginScreen />;
  // External-client invite still pending admin approval (Fix #2.6c, 2026-05-25)
  if (pendingInvite) return <PendingApprovalScreen email={pendingInvite.email} onSignOut={handleSignOut} />;
  // External-client portal (ClientView) was ripped 2026-06-01 ahead of the
  // self-serve IG-analyzer pivot. Approved external clients now see the main
  // Vantus app — RLS on content_items already scopes them to their own rows.
  return <Vantus onSignOut={handleSignOut} userEmail={session.user.email} userId={session.user.id} content={content} setContent={setContent} />;
}

function PendingApprovalScreen({ email, onSignOut }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", color:"#e6e8ec", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"-apple-system, Inter, sans-serif", padding:"24px" }}>
      <div style={{ maxWidth:440, textAlign:"center" }}>
        <div style={{ width:64, height:64, borderRadius:"50%", background:"linear-gradient(135deg,#1a3a5a,#0a1f33)", margin:"0 auto 28px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>⏳</div>
        <div style={{ fontSize:22, fontWeight:600, letterSpacing:-0.4, marginBottom:10 }}>Almost there</div>
        <div style={{ fontSize:14, opacity:0.65, lineHeight:1.55, marginBottom:6 }}>
          We've notified Cloud Scenic about your sign-in attempt.
        </div>
        <div style={{ fontSize:13, opacity:0.5, marginBottom:32 }}>
          Once they approve <span style={{ color:"#2AABFF", fontWeight:500 }}>{email}</span>, this page will unlock automatically — no refresh needed.
        </div>
        <button onClick={onSignOut} style={{ fontSize:12, padding:"8px 18px", background:"transparent", border:"1px solid rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.6)", borderRadius:8, cursor:"pointer" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
// 


const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@400;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap";
document.head.appendChild(fontLink);





function Vantus({ onSignOut, userEmail, userId, content: contentProp, setContent: setContentProp }) {
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
  // Initialized to agents.length on mount + jitters to (n-1 | n) every 15s for a "live" feel.
  // Reflects actual agent roster, not a hardcoded number.
  const [liveCount, setLiveCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
return apiFetch(url, opts);
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
// Pre-seed Muse memory only if not already set. Brand-specific values come from
// the active client (clients.brand_voice_md). This is a neutral placeholder.
if (!getMemory('Muse').brand) {
  setMemory('Muse', {
    brand: '',
    niche: '',
    tone: '',
    campaigns: [],
    pillars: [],
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
          apiFetch("/api/notify", {
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
      // Wait for supabase-js to finish restoring auth from localStorage before
      // querying. Without this, the fetch can race the auth restore on hard
      // refresh / new deploy → RLS returns empty → "No clients yet".
      await sb.auth.getSession();
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
id: `${currentClient?.slug || "item"}-${Date.now()}`,
platform: "instagram",
type: "reel",
stage: "Ready For Copy Creation",
campaign: "",
status: "Ready For Copy Creation",
format: "Reel",
pillar: "",
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
  useEffect(() => {
    // Sync the live count to the active agent roster whenever it changes.
    setLiveCount(agents.length);
  }, [agents.length]);
  useInterval(() => setLiveCount(agents.length - (Math.random() < 0.5 ? 0 : 1)), aiEnabled ? 15000 : null);

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
    const inspiration = (window.prompt("Creators / styles for Muse to emulate (e.g. Alex Hormozi, Nik). Leave blank for default creator-level ambition:", "") || "").trim();
    setIgIdeasLoading(true);
    setMuseToast({ id: "ig-ideas", field: "ideas", status: "writing" });
    try {
      const res = await safeAgentFetch("/api/agent-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "muse_ig_ideas", payload: { inspiration }, client_id: currentClient?.id }),
      });
      const d = await res.json();
      if (d.error || !d.success) throw new Error(d.error || d.message || "Unknown error");
      setMuseToast({ id: "ig-ideas", field: "ideas", status: "done", content: d.message || `${d.count} ideas added to Content Tracker` });
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
  const res = await apiFetch("/api/agent-action", {
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
          <button onClick={onSignOut} style={{ flex:1, fontSize:12, color:"rgba(255,255,255,0.4)", background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"10px 16px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>Sign Out</button>
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
                  currentUserId={userId}
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
                  currentUserId={userId}
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
      <DashboardRoute
        isMobile={isMobile}
        currentClient={currentClient}
        clientContent={clientContent}
        liveCount={liveCount}
        aiEnabled={aiEnabled}
        agents={agents}
        selectedAgent={selectedAgent}
        setSelectedAgent={setSelectedAgent}
      />
    )}

    {/* AGENTS */}
    {activeNav === "agents" && (
      <AgentsRoute agents={agents} content={content} currentClient={currentClient} />
    )}

    {/* CONTENT (unified: Instagram / TikTok / YouTube with tab switcher) */}
    {activeNav === "content" && (
      <ContentRoute
        igItems={igItems}
        ttItems={ttItems}
        ytItems={ytItems}
        activePlatform={activePlatform}
        setActivePlatform={setActivePlatform}
        isMobile={isMobile}
        handleIgIdeas={handleIgIdeas}
        igIdeasLoading={igIdeasLoading}
        handleAddNew={handleAddNew}
        setEditingItem={setEditingItem}
        handleMuseWrite={handleMuseWrite}
        currentClient={currentClient}
      />
    )}

    {activeNav === "analytics" && <AnalyticsRoute />}
    {activeNav === "ideas" && <IdeaEngineRoute currentClient={currentClient} />}
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
    {activeNav === "costs" && <AppPlaceholder label="Cost Governance" desc="API spend tracking, agent budget controls, and cost optimization." icon="$" />}
    {activeNav === "automation" && <AppPlaceholder label="Automation Center" desc="Scheduled agent workflows, n8n triggers, and pipeline automation." icon="⚡" />}

  </div>

  {/*  MOBILE BOTTOM NAV  */}
  {isMobile && (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:100, background:"rgba(10,8,9,0.96)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", paddingBottom:"env(safe-area-inset-bottom,0)", height:"calc(58px + env(safe-area-inset-bottom,0px))" }}>
      {[
        { id:"dashboard", label:"Home" },
        { id:"content", label:"Pipeline" },
        { id:"agents", label:"Agents" },
        { id:"adroihub", label:"ROI" },
        { id:"cid", label:"Intel" },
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
  
