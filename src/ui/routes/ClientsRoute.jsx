import React, { useMemo } from 'react';

// ── Clients CRM home ──────────────────────────────────────────────────────────
// All-clients fulfillment dashboard. Each client is a workspace card showing
// onboarding/setup %, content counts by status bucket, point-of-contact, and
// last activity — the agency "at a glance" view (Kyte model).
//
// Reads only existing schema (clients + content_items), so it works against the
// live DB with no migration. When the CRM migration lands (onboarding_stage,
// client_contacts), this page upgrades to use those fields where present.

const ACCENT = "#2AABFF";

// Status buckets — mirror DashboardRoute exactly so counts agree across the app.
const NEED_ATTENTION = ["Need Copy Approval", "Need Content Approval", "Needs Revisions"];
const IN_PRODUCTION  = ["Ready For Copy Creation", "Ready For Content Creation", "Ready For Schedule"];

function relTime(ts) {
  if (!ts) return null;
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// Workspace setup completeness — an honest readout of how configured a client is.
// Prefers a real onboarding_progress column once the migration adds it.
function setupScore(client, hasContent, hasProof) {
  if (typeof client.onboarding_progress === "number") {
    return Math.max(0, Math.min(100, Math.round(client.onboarding_progress)));
  }
  let s = 0;
  if (client.brand_voice_md && client.brand_voice_md.trim().length > 20) s += 25;
  if (client.logo_url)      s += 15;
  if (client.primary_email) s += 15;
  if (hasContent)           s += 20;
  if (hasProof)             s += 25; // approved or scheduled work = live production
  return s;
}

function clientStats(client, content) {
  const items = content.filter(x => x.client_id === client.id);
  const by = (pred) => items.filter(pred).length;
  const approved   = by(x => x.status === "Approved");
  const scheduled  = by(x => x.status === "Scheduled");
  const attention  = by(x => NEED_ATTENTION.includes(x.status));
  const production  = by(x => IN_PRODUCTION.includes(x.status));
  const lastTs = items.reduce((m, x) => {
    const t = new Date(x.updated_at || x.created_at || 0).getTime();
    return t > m ? t : m;
  }, 0);
  return {
    total: items.length,
    approved, scheduled, attention, production,
    last: lastTs || null,
    setup: setupScore(client, items.length > 0, approved + scheduled > 0),
  };
}

function StatChip({ value, label, color }) {
  const dim = !value;
  return (
    <div style={{ flex:1, minWidth:0, textAlign:"center", padding:"8px 4px", background: dim ? "rgba(255,255,255,0.02)" : `${color}10`, border:`1px solid ${dim ? "rgba(255,255,255,0.05)" : color + "28"}`, borderRadius:9 }}>
      <div style={{ fontSize:18, fontWeight:700, fontFamily:"'Geist Mono', monospace", color: dim ? "rgba(255,255,255,0.28)" : color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:8.5, letterSpacing:0.6, textTransform:"uppercase", color:"rgba(255,255,255,0.4)", marginTop:5, fontWeight:600 }}>{label}</div>
    </div>
  );
}

function ClientCard({ client, content, isActive, onOpen, onEdit }) {
  const s = useMemo(() => clientStats(client, content), [client, content]);
  const statusColor = client.status === "active" ? "#30d158" : client.status === "paused" ? "#ff9f0a" : "rgba(255,255,255,0.3)";
  const accent = client.brand_color || ACCENT;
  const last = relTime(s.last);

  return (
    <div
      style={{ position:"relative", display:"flex", flexDirection:"column", background:"#0f0d0e", border:`1px solid ${isActive ? accent + "55" : "rgba(255,255,255,0.07)"}`, borderRadius:16, padding:"20px 20px 18px", transition:"border-color 0.15s, transform 0.15s" }}
    >
      {/* attention badge */}
      {s.attention > 0 && (
        <div title={`${s.attention} item(s) need attention`} style={{ position:"absolute", top:14, right:14, display:"flex", alignItems:"center", gap:5, background:"rgba(249,115,22,0.12)", border:"1px solid rgba(249,115,22,0.35)", borderRadius:20, padding:"3px 9px" }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"#f97316" }} />
          <span style={{ fontSize:10, fontWeight:700, color:"#f97316" }}>{s.attention} to review</span>
        </div>
      )}

      {/* header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
        <div style={{ width:40, height:40, borderRadius:10, background: client.logo_url ? "rgba(255,255,255,0.05)" : accent, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0, padding: client.logo_url ? 3 : 0, boxSizing:"border-box" }}>
          {client.logo_url
            ? <img src={client.logo_url} alt={client.name} style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", display:"block" }} />
            : <span style={{ fontSize:16, fontWeight:700, color:"#fff" }}>{(client.name || "?").slice(0,1).toUpperCase()}</span>}
        </div>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:15, fontWeight:600, color:"#f5f5f7", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{client.name}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:statusColor }} />
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.45)", textTransform:"capitalize" }}>{client.status || "active"}</span>
            {last && <span style={{ fontSize:10, color:"rgba(255,255,255,0.28)" }}>· {last}</span>}
          </div>
        </div>
      </div>

      {/* setup / onboarding bar */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
          <span style={{ fontSize:9.5, letterSpacing:0.8, textTransform:"uppercase", color:"rgba(255,255,255,0.4)", fontWeight:600 }}>Workspace setup</span>
          <span style={{ fontSize:11, fontWeight:700, fontFamily:"'Geist Mono', monospace", color: s.setup >= 100 ? "#30d158" : accent }}>{s.setup}%</span>
        </div>
        <div style={{ height:5, background:"rgba(255,255,255,0.06)", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${s.setup}%`, background: s.setup >= 100 ? "#30d158" : accent, borderRadius:4, transition:"width 0.4s ease" }} />
        </div>
      </div>

      {/* counts */}
      <div style={{ display:"flex", gap:7, marginBottom:16 }}>
        <StatChip value={s.attention}  label="Review"    color="#f97316" />
        <StatChip value={s.production} label="In prod"   color="#ff375f" />
        <StatChip value={s.approved}   label="Approved"  color="#2AABFF" />
        <StatChip value={s.scheduled}  label="Scheduled" color="#64d2ff" />
      </div>

      {/* footer: POC + actions */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:"auto", paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:8.5, letterSpacing:0.6, textTransform:"uppercase", color:"rgba(255,255,255,0.32)", fontWeight:600 }}>Contact</div>
          <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.6)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:2 }}>{client.primary_email || "—"}</div>
        </div>
        <div style={{ display:"flex", gap:7, flexShrink:0 }}>
          <button onClick={() => onEdit(client)} title="Edit client" style={{ width:30, height:30, borderRadius:8, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.45)", cursor:"pointer", fontSize:12 }}>✎</button>
          <button onClick={() => onOpen(client)} style={{ height:30, padding:"0 14px", borderRadius:8, background: accent, border:"none", color:"#fff", cursor:"pointer", fontSize:11.5, fontWeight:600 }}>Open</button>
        </div>
      </div>
    </div>
  );
}

export default function ClientsRoute({ isMobile, clients = [], content = [], currentClient, onOpen, onEdit, onAdd }) {
  // Active first, then most-needing-attention surfaces to the top.
  const ranked = useMemo(() => {
    const att = (c) => content.filter(x => x.client_id === c.id && NEED_ATTENTION.includes(x.status)).length;
    const rank = (c) => (c.status === "active" ? 0 : c.status === "paused" ? 1 : 2);
    return [...clients].sort((a, b) => rank(a) - rank(b) || att(b) - att(a) || (a.name || "").localeCompare(b.name || ""));
  }, [clients, content]);

  const totalAttention = content.filter(x => NEED_ATTENTION.includes(x.status)).length;
  const activeCount = clients.filter(c => c.status === "active").length;

  return (
    <div style={{ animation:"fadeIn 0.4s ease" }}>
      {/* header */}
      <div style={{ marginBottom: isMobile ? 24 : 36, paddingBottom: isMobile ? 20 : 28, borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.55)", fontWeight:600, letterSpacing:3, textTransform:"uppercase", fontFamily:"'Geist Mono', monospace", marginBottom:12 }}>Cloud Scenic / Client Book</div>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:14 }}>
          <div>
            <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight:400, fontStyle:"italic", color:"#fff", margin:0, letterSpacing:-1, lineHeight:1 }}>Clients</h1>
            <p style={{ fontSize:12.5, color:"rgba(255,255,255,0.5)", margin:"12px 0 0" }}>
              {clients.length} {clients.length === 1 ? "client" : "clients"} · {activeCount} active
              {totalAttention > 0 && <span style={{ color:"#f97316", fontWeight:600 }}> · {totalAttention} awaiting review</span>}
            </p>
          </div>
          <button onClick={onAdd} style={{ height:38, padding:"0 18px", borderRadius:10, background:ACCENT, border:"none", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ fontSize:16, lineHeight:1 }}>+</span> Add client
          </button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div style={{ padding:"60px 30px", textAlign:"center", border:"1px dashed rgba(255,255,255,0.12)", borderRadius:16 }}>
          <div style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:24, fontStyle:"italic", color:"#f5f5f7", marginBottom:8 }}>No clients yet.</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:22 }}>Add your first client to start the fulfillment book.</div>
          <button onClick={onAdd} style={{ height:38, padding:"0 20px", borderRadius:10, background:ACCENT, border:"none", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>+ Add client</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
          {ranked.map(c => (
            <ClientCard
              key={c.id}
              client={c}
              content={content}
              isActive={currentClient?.id === c.id}
              onOpen={onOpen}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
