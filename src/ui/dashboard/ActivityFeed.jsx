import React, { useState, useEffect } from 'react';
import { ACTION_COLORS } from '../../data/seed.agents.js';
import { sb } from '../../services/supabaseClient.js';

// agent_events row → feed-item shape
function rowToFeed(row) {
  const ts = new Date(row.ts);
  const time = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  // Map action_key → short verb for display
  const action = humanizeAction(row.action_key, row.result_summary);
  // Action color: prefer status-based hue (error red), else seed.agents ACTION_COLORS by agent
  const type = row.result_status === "error" ? "error" : agentToType(row.agent_name);
  return {
    id: row.id,
    time,
    agent: row.agent_name,
    action,
    type,
    status: row.result_status,
  };
}

function humanizeAction(key, summary) {
  if (!key) return summary || "";
  const map = {
    muse_write_content:     "wrote content",
    muse_from_brief:        "generated from brief",
    muse_generate_calendar: "generated calendar",
    muse_save_calendar:     "saved calendar",
    muse_ig_ideas:          "generated IG ideas",
    overseer_scan:          "ran SOP scan",
    sean_briefing:          "ran morning briefing",
    lacey_advance:          "advanced pipeline",
    lacey_trigger_n8n:      "triggered n8n",
    sam_health:             "ran health check",
    artgrid_scout:          "scouted footage",
    scrappy_research:       "ran research",
    scrappy_muse_collab:    "× Muse collab",
    scrappy_hook_analysis:  "analyzed hooks",
    cid_build_brief:        "built CID brief",
    cid_ab_variations:      "generated A/B variations",
  };
  return map[key] || key.replace(/_/g, " ");
}

function agentToType(name) {
  // ACTION_COLORS in seed.agents.js is keyed by lowercased agent name in some cases;
  // fall back to a default if missing.
  if (!name) return "default";
  const k = name.toLowerCase();
  if (ACTION_COLORS[k]) return k;
  if (ACTION_COLORS[name]) return name;
  return "default";
}

export default function ActivityFeed({ clientId }) {
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!clientId) { setFeed([]); return; }
    // Initial fetch — last 60 events FOR THIS CLIENT
    (async () => {
      try {
        const { data, error } = await sb
          .from("agent_events")
          .select("id, ts, agent_name, action_key, result_status, result_summary, client_id")
          .eq("client_id", clientId)
          .order("ts", { ascending: false })
          .limit(60);
        if (cancelled) return;
        if (error) { console.warn("[ActivityFeed] initial fetch error", error); return; }
        setFeed((data || []).map(rowToFeed));
      } catch (e) { console.warn("[ActivityFeed] initial fetch threw", e); }
    })();

    // Realtime: only prepend events for the current client
    const channel = sb.channel(`agent_events_${clientId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_events", filter: `client_id=eq.${clientId}` },
        (payload) => {
          setFeed(prev => [rowToFeed(payload.new), ...prev].slice(0, 60));
        }
      ).subscribe();

    return () => { cancelled = true; sb.removeChannel(channel); };
  }, [clientId]);

  if (feed.length === 0) {
    return (
      <div style={{ padding:"12px 14px", fontSize:11, color:"rgba(255,255,255,0.35)", textAlign:"center", fontStyle:"italic" }}>
        No agent events yet. Trigger an agent action to see real-time activity.
      </div>
    );
  }

  return (
    <div style={{ height:"auto", overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }}>
      {feed.map((item, i) => (
        <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 12px", background:i===0?`${ACTION_COLORS[item.type] || '#2AABFF'}0a`:"transparent", borderRadius:8, borderLeft:i===0?`2px solid ${ACTION_COLORS[item.type] || '#2AABFF'}`:"2px solid transparent", animation:i===0?"slideIn 0.3s ease":"none", transition:"all 0.3s" }}>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.55)", whiteSpace:"nowrap" }}>{item.time}</span>
          <span style={{ fontSize:10, color:ACTION_COLORS[item.type] || '#2AABFF', fontWeight:700, whiteSpace:"nowrap" }}>{item.agent}</span>
          <span style={{ fontSize:10, color: item.status === "error" ? "#ff453a" : "rgba(255,255,255,0.75)" }}>{item.action}</span>
        </div>
      ))}
    </div>
  );
}
