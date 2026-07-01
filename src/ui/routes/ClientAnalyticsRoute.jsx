import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

// ── Client Analytics ──────────────────────────────────────────────────────────
// The agency owner view — one screen answering "how's the business doing?" MRR,
// reach, deliverable health, and the top clients by revenue. Rolls up existing
// data: clients.retainer_amount (MRR), account_posts→connected_accounts.client_id
// (social reach per client), content_items (delivery health).

const ACCENT = "#2AABFF";
const NEED_ATTENTION = ["Need Copy Approval", "Need Content Approval", "Needs Revisions"];
const DONE = ["Approved", "Scheduled", "Posted"];
const HEALTH_COLOR = { green: "#30d158", amber: "#ff9f0a", red: "#ff453a" };

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}
function fmtMoney(n) { return "$" + fmtNum(n); }
function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function isOverdue(x) { const t = x.due_date ? new Date(x.due_date).getTime() : NaN; return !Number.isNaN(t) && t < Date.now() && !DONE.includes(x.status) && !x.posted_at; }

const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };

function StatCard({ value, label, sub, color, big }) {
  return (
    <div style={{ flex: 1, minWidth: 150, padding: "18px 20px", background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
      <div style={{ fontSize: big ? 30 : 26, fontWeight: 700, fontFamily: "'Geist Mono', monospace", color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginTop: 9, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
function Bar({ label, value, total, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>{label}</span>
        <span style={{ fontSize: 11.5, fontFamily: "'Geist Mono', monospace", color: "#f5f5f7" }}>{fmtMoney(value)}</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct(value, total)}%`, background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export default function ClientAnalyticsRoute({ isMobile, clients = [], content = [] }) {
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [acc, pst] = await Promise.all([
        sb.from("connected_accounts").select("id, client_id, platform"),
        sb.from("account_posts").select("account_id, metrics"),
      ]);
      if (!cancelled) {
        if (Array.isArray(acc.data)) setAccounts(acc.data);
        if (Array.isArray(pst.data)) setPosts(pst.data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const roll = useMemo(() => {
    const acctClient = new Map(accounts.map(a => [a.id, a.client_id]));
    const reachByClient = {};
    let totalReach = 0, totalEng = 0;
    for (const p of posts) {
      const cid = acctClient.get(p.account_id);
      const m = p.metrics || {};
      const reach = Number(m.reach) || 0;
      const eng = (Number(m.likes) || 0) + (Number(m.comments) || 0) + (Number(m.saved) || 0) + (Number(m.shares) || 0);
      totalReach += reach; totalEng += eng;
      if (cid) reachByClient[cid] = (reachByClient[cid] || 0) + reach;
    }
    const active = clients.filter(c => c.status === "active");
    const mrr = active.reduce((s, c) => s + (Number(c.retainer_amount) || 0), 0);
    const retainerRev = active.filter(c => (c.lane || "recurring") === "recurring").reduce((s, c) => s + (Number(c.retainer_amount) || 0), 0);
    const projectRev = active.filter(c => c.lane === "brief").reduce((s, c) => s + (Number(c.retainer_amount) || 0), 0);

    // Delivery health across all deliverables
    const overdue = content.filter(isOverdue).length;
    const inReview = content.filter(x => NEED_ATTENTION.includes(x.status)).length;
    const onTrack = content.filter(x => !isOverdue(x) && !NEED_ATTENTION.includes(x.status) && x.status !== "Scrapped").length;

    const healthCounts = active.reduce((a, c) => { const h = c.health || "green"; a[h] = (a[h] || 0) + 1; return a; }, {});
    const avgHealth = pct(healthCounts.green || 0, active.length);

    const perClient = active.map(c => {
      const items = content.filter(x => x.client_id === c.id);
      return {
        id: c.id, name: c.name, color: c.brand_color || ACCENT,
        mrr: Number(c.retainer_amount) || 0,
        lane: c.lane || "recurring",
        health: c.health || "green",
        deliverables: items.length,
        overdue: items.filter(isOverdue).length,
        reach: reachByClient[c.id] || 0,
      };
    }).sort((a, b) => b.mrr - a.mrr);

    return { totalReach, totalEng, mrr, retainerRev, projectRev, overdue, inReview, onTrack, avgHealth, activeCount: active.length, perClient, deliverables: content.length };
  }, [accounts, posts, clients, content]);

  const onTrackPct = pct(roll.onTrack, roll.onTrack + roll.inReview + roll.overdue);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: isMobile ? 22 : 32, paddingBottom: isMobile ? 18 : 26, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", fontFamily: "'Geist Mono', monospace", marginBottom: 12 }}>Cloud Scenic / Client Analytics</div>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight: 400, fontStyle: "italic", color: "#fff", margin: 0, letterSpacing: -1, lineHeight: 1 }}>Client Analytics</h1>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: "12px 0 0" }}>The agency at a glance — revenue, reach, and delivery health across every client.</p>
      </div>

      {/* stat cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard value={fmtNum(roll.totalReach)} label="Total reach" sub={`${fmtNum(roll.totalEng)} engagements`} color="#fff" big />
        <StatCard value={fmtMoney(roll.mrr)} label="MRR" sub={`${roll.activeCount} active clients`} color="#30d158" big />
        <StatCard value={`${onTrackPct}%`} label="Deliverables on-track" sub={`${roll.deliverables} total`} color={onTrackPct >= 80 ? "#30d158" : "#f59e0b"} big />
        <StatCard value={`${roll.avgHealth}%`} label="Clients green" sub={`${roll.overdue} overdue items`} color={roll.avgHealth >= 70 ? "#30d158" : "#f59e0b"} big />
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: isMobile ? "wrap" : "nowrap", marginBottom: 24 }}>
        {/* revenue by type */}
        <div style={{ flex: 1, minWidth: 260, padding: "18px 20px", background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
          <div style={{ ...head, marginBottom: 16 }}>Revenue by type</div>
          <Bar label="Retainer (recurring)" value={roll.retainerRev} total={roll.mrr || 1} color="#8b5cf6" />
          <Bar label="Project (brief)" value={roll.projectRev} total={roll.mrr || 1} color="#64d2ff" />
        </div>
        {/* delivery health */}
        <div style={{ flex: 1, minWidth: 260, padding: "18px 20px", background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
          <div style={{ ...head, marginBottom: 16 }}>Deliverable health</div>
          {[["On track", roll.onTrack, "#30d158"], ["In review", roll.inReview, "#f97316"], ["Overdue", roll.overdue, "#ff453a"]].map(([lbl, val, col]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: col }} />
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)" }}>{lbl}</span>
              </div>
              <span style={{ fontSize: 15, fontFamily: "'Geist Mono', monospace", fontWeight: 700, color: val ? col : "rgba(255,255,255,0.3)" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* top clients */}
      <div style={{ ...head, marginBottom: 10 }}>Top clients by MRR</div>
      <div style={{ background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 12, padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ ...head, flex: 2 }}>Client</div>
          <div style={{ ...head, flex: 1, textAlign: "right" }}>MRR</div>
          <div style={{ ...head, flex: 1, textAlign: "right" }}>Deliverables</div>
          <div style={{ ...head, flex: 1, textAlign: "right" }}>Reach</div>
          <div style={{ ...head, flex: 0.8, textAlign: "right" }}>Health</div>
        </div>
        {roll.perClient.length === 0 ? (
          <div style={{ padding: "28px 18px", textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>No active clients yet.</div>
        ) : roll.perClient.map((c, i) => (
          <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 18px", borderBottom: i < roll.perClient.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ flex: 2, display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#f5f5f7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", fontFamily: "'Geist Mono', monospace" }}>{c.lane}</span>
            </div>
            <div style={{ flex: 1, textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: "#30d158" }}>{fmtMoney(c.mrr)}</div>
            <div style={{ flex: 1, textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: c.overdue ? "#ff453a" : "rgba(255,255,255,0.7)" }}>{c.deliverables}{c.overdue ? ` · ${c.overdue}!` : ""}</div>
            <div style={{ flex: 1, textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>{fmtNum(c.reach)}</div>
            <div style={{ flex: 0.8, display: "flex", justifyContent: "flex-end" }}>
              <div title={c.health} style={{ width: 9, height: 9, borderRadius: "50%", background: HEALTH_COLOR[c.health] || HEALTH_COLOR.green }} />
            </div>
          </div>
        ))}
      </div>
      {loading && <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Loading social reach…</div>}
    </div>
  );
}
