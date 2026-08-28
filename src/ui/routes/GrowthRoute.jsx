import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { apiFetch } from '../../services/apiFetch.js';
import { BAND_LABEL } from '../../core/warmth.js';

// ── GROWTH / Leads (v3 spec §3.C.4, built 8/23) ──────────────────────────────
// Scrape a prospect → deterministic marketing audit → brief their pain points
// → pipeline → convert to client. The audit + template brief need NO AI
// credits; the AI brief (growth_brief) lights up when credits exist.

const ACCENT = "#2AABFF";
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const card = { background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };
const input = { background: "#141414", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };
const btn = (primary) => ({ padding: "8px 14px", borderRadius: 9, border: primary ? "none" : "1px solid rgba(255,255,255,0.14)", cursor: "pointer", background: primary ? ACCENT : "none", color: primary ? "#08131c" : "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 12, fontFamily: "Inter, sans-serif" });

const STAGES = ["new", "researched", "briefed", "contacted", "replied", "meeting", "won", "lost"];
const STAGE_COLOR = { new: "rgba(255,255,255,0.5)", researched: "#64d2ff", briefed: "#bf5af2", contacted: "#E5E5EA", replied: "#ffd60a", meeting: "#30d158", won: "#30d158", lost: "#ff453a" };
const SEV_COLOR = { high: "#ff453a", med: "#E5E5EA", low: "rgba(255,255,255,0.5)" };

async function growthApi(action, payload) {
  const res = await apiFetch("/api/growth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `${action} failed (${res.status})`); e.status = res.status; throw e; }
  return data;
}
async function sourceApi(action, payload = {}) {
  const res = await apiFetch("/api/growth-source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `${action} failed (${res.status})`); e.status = res.status; throw e; }
  return data;
}
const BAND_COLOR = { warm: "#30d158", warming: "#E5E5EA", cold: "rgba(255,255,255,0.35)" };
async function agentApi(action, payload) {
  const res = await apiFetch("/api/agent-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload, client_id: null }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${action} failed (${res.status})`);
  return data.result ?? data;
}

function Chip({ text, color }) {
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily: "'Geist Mono', monospace", color, border: `1px solid ${color}44`, background: `${color}14`, whiteSpace: "nowrap" }}>{text}</span>;
}

function LeadDetail({ lead, onChanged, onOpenClient }) {
  const [research, setResearch] = useState(null);
  const [briefs, setBriefs] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [sendTo, setSendTo] = useState(lead.email || "");
  const [sender, setSender] = useState("cz");
  const [senders, setSenders] = useState([{ id: "contact", label: "Cloud Scenic <contact@cloudscenic.com>" }, { id: "cz", label: "Christian at Cloud Scenic <cz@cloudscenic.com>" }, { id: "dv", label: "Danny at Cloud Scenic <dv@cloudscenic.com>" }]);
  useEffect(() => { growthApi("senders", {}).then(d => { if (d?.senders?.length) setSenders(d.senders); }).catch(() => {}); }, []);

  const load = useCallback(async () => {
    const [r, b] = await Promise.all([
      sb.from("lead_research").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(1),
      sb.from("lead_briefs").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }),
    ]);
    setResearch(r.data?.[0] || null);
    setBriefs(b.data || []);
  }, [lead.id]);
  useEffect(() => { load(); setSendTo(lead.email || ""); }, [load, lead.email]);

  const run = async (key, fn) => { setBusy(key); setErr(null); try { await fn(); await load(); onChanged(); } catch (e) { setErr(e.message); } setBusy(null); };
  const findings = research?.findings || [];
  const sig = research?.raw || {};
  const latest = briefs[0];
  const copy = async (b) => { try { await navigator.clipboard.writeText(`Subject: ${b.subject}\n\n${b.body_md}`); setErr(null); } catch { setErr("clipboard blocked — select and copy manually"); } };

  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 20, fontWeight: 750, color: "#f5f5f7", fontFamily: "Inter, sans-serif" }}>{lead.name}</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", fontFamily: "'Geist Mono', monospace", marginTop: 2, wordBreak: "break-all" }}>
            {lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: "none" }}>{lead.host}</a> : "no website"}
            {lead.phone ? ` · ${lead.phone}` : ""}{lead.email ? ` · ${lead.email}` : ""}
          </div>
          {Object.keys(sig.socials || {}).length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {Object.entries(sig.socials).map(([k, v]) => <a key={k} href={v} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "2px 8px" }}>{k}</a>)}
            </div>
          )}
        </div>
        <select value={lead.stage} onChange={e => run("stage", async () => { const { error } = await sb.from("leads").update({ stage: e.target.value, updated_at: new Date().toISOString() }).eq("id", lead.id); if (error) throw error; })}
          style={{ ...input, width: "auto", padding: "7px 10px", fontSize: 12, color: STAGE_COLOR[lead.stage] }}>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {err && <div style={{ padding: "9px 12px", borderRadius: 9, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.35)", color: "#ff8a80", fontSize: 12, marginBottom: 10 }}>{err}</div>}

      {/* Warmth (port of Dynasty's three gates) */}
      {lead.warmth_band !== undefined && (
        <div style={{ background: "#141414", borderRadius: 10, padding: "10px 14px", marginBottom: 10, borderLeft: `3px solid ${BAND_COLOR[lead.warmth_band] || BAND_COLOR.cold}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 750, color: BAND_COLOR[lead.warmth_band] || BAND_COLOR.cold, fontFamily: "Inter, sans-serif" }}>{BAND_LABEL[lead.warmth_band] || "Cold"} · {lead.warmth_score ?? 0}/100</span>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "'Geist Mono', monospace" }}>
              person {lead.contact_name && (lead.contact_email || lead.direct_phone || lead.email) ? "✓" : "✗"} · signal {lead.signal_verified_at ? "✓" : "✗"} · engaged {lead.last_engaged_at ? "✓" : "✗"}
            </span>
            <div style={{ flex: 1 }} />
            <button style={btn(false)} disabled={!!busy} onClick={() => run("enrich", async () => { const r = await sourceApi("enrich", { lead_id: lead.id }); setErr(r.steps.map(x => `${x.step}: ${x.result}`).join(" · ")); })}>{busy === "enrich" ? "…" : "Find contact"}</button>
            <button style={btn(false)} disabled={!!busy || !lead.website} onClick={() => run("signal", async () => { const r = await sourceApi("signal_scan", { lead_id: lead.id }); setErr(r.verified ? `Signal verified: ${r.kind} — ${r.evidence || r.url}` : `No verified signal${r.reason ? ` (${r.reason})` : ""}${r.notWired?.length ? ` · not wired yet: ${r.notWired.join(", ")}` : ""}`); })}>{busy === "signal" ? "…" : "Check signal"}</button>
          </div>
          {(lead.warmth_reasons || []).length > 0 && <div style={{ fontSize: 11.5, color: "#c9c9ce", marginTop: 6 }}>{lead.warmth_reasons.slice(0, 3).join(" · ")}</div>}
          {lead.contact_name && <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{lead.contact_name}{lead.contact_title ? `, ${lead.contact_title}` : ""}{lead.contact_email ? ` · ${lead.contact_email}` : ""}{lead.direct_phone ? ` · ${lead.direct_phone}` : ""}</div>}
          {lead.signal_url && <div style={{ fontSize: 11, marginTop: 3 }}><a href={lead.signal_url} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: "none" }}>hiring signal ↗</a>{lead.signal_role ? <span style={{ color: "rgba(255,255,255,0.5)" }}> · {lead.signal_role}</span> : null}</div>}
        </div>
      )}

      {/* Audit */}
      <div style={{ ...head, margin: "12px 0 8px" }}>MARKETING AUDIT — {findings.length} GAP{findings.length === 1 ? "" : "S"}{research ? ` · scanned ${new Date(research.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</div>
      {!research && <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>No scan yet.</div>}
      {research && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "'Geist Mono', monospace", marginBottom: 8 }}>
          pixel {sig.pixels?.meta ? "✓" : "✗"} · analytics {sig.pixels?.ga ? "✓" : "✗"} · schema {sig.hasLocalSchema ? "✓" : "✗"} · mobile {sig.hasViewport ? "✓" : "✗"} · cta {sig.ctaLinks?.length || sig.hasTel || sig.hasForm ? "✓" : "✗"}{sig.builder ? ` · ${sig.builder}` : ""}{sig.jsShell ? " · JS-rendered" : ""}
        </div>
      )}
      {findings.map(f => (
        <div key={f.key} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)", alignItems: "flex-start" }}>
          <Chip text={f.severity.toUpperCase()} color={SEV_COLOR[f.severity]} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 650, color: "#f5f5f7", fontFamily: "Inter, sans-serif" }}>{f.label} <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.4)", fontSize: 11 }}>· {f.evidence}</span></div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.45, marginTop: 2 }}>{f.pitch}</div>
          </div>
        </div>
      ))}
      {research?.summary && <div style={{ fontSize: 12, color: "#E5E5EA", marginTop: 8, padding: "8px 12px", background: "rgba(229,229,234,0.06)", borderRadius: 8 }}>Scrappy: {research.summary}</div>}

      {/* Brief */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 8px", flexWrap: "wrap" }}>
        <div style={{ ...head, flex: 1 }}>BRIEF{latest ? ` · ${latest.origin} · ${latest.status}` : ""}</div>
        <button style={btn(false)} disabled={!!busy || !findings.length} onClick={() => run("tpl", async () => { await growthApi("brief_template", { lead_id: lead.id }); })}>{busy === "tpl" ? "…" : "Draft from audit"}</button>
        <button style={btn(false)} disabled={!!busy || !findings.length} title="Needs AI credits" onClick={() => run("ai", async () => { await agentApi("growth_brief", { lead_id: lead.id }); })}>{busy === "ai" ? "…" : "Scrappy writes it"}</button>
      </div>
      {!latest && <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>No brief yet — draft one from the audit (no AI needed) or let Scrappy write it.</div>}
      {latest && (
        <div style={{ background: "#141414", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f7", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>{latest.subject}</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "#d4d4d8", fontFamily: "Inter, sans-serif", lineHeight: 1.55, margin: 0 }}>{latest.body_md}</pre>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button style={btn(false)} onClick={() => copy(latest)}>Copy</button>
            {latest.status !== "sent" && (
              <>
                <select value={sender} onChange={e => setSender(e.target.value)} title="Send as" style={{ ...input, flex: "0 1 230px", padding: "7px 10px", fontSize: 12 }}>
                  {senders.map(s2 => <option key={s2.id} value={s2.id}>{s2.label.replace(/\s*<.*>$/, "")}</option>)}
                </select>
                <input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="recipient@their-business.com" style={{ ...input, flex: "1 1 200px", padding: "7px 10px", fontSize: 12 }} />
                <button style={btn(true)} disabled={!!busy || !sendTo} onClick={() => run("send", async () => { await growthApi("send_brief", { brief_id: latest.id, to: sendTo, sender }); })}>{busy === "send" ? "Sending…" : "Send"}</button>
              </>
            )}
            {latest.status === "sent" && <span style={{ fontSize: 11, color: "#30d158", fontFamily: "'Geist Mono', monospace" }}>sent to {latest.sent_to} · {new Date(latest.sent_at).toLocaleDateString()}{latest.sent_from ? ` · as ${latest.sent_from}` : ""}</span>}
          </div>
        </div>
      )}

      {/* Convert */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        {lead.converted_client_id
          ? <button style={btn(false)} onClick={() => onOpenClient(lead.converted_client_id)}>Open client →</button>
          : <button style={btn(false)} disabled={!!busy} onClick={() => { if (window.confirm(`Convert ${lead.name} into a client? This creates their CRM record.`)) run("convert", async () => { await growthApi("convert", { lead_id: lead.id }); }); }}>{busy === "convert" ? "…" : "Convert to client"}</button>}
        <button style={btn(false)} disabled={!!busy} onClick={() => run("rescan", async () => { await growthApi("scan", { url: lead.website, name: lead.name }); })}>{busy === "rescan" ? "Scanning…" : "Re-scan"}</button>
      </div>
    </div>
  );
}

function IcpPanel({ clients, onSwept, setErr }) {
  const [icps, setIcps] = useState(null);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ client_id: "", name: "", niche: "", cities: "" });
  const [sweep, setSweep] = useState({ icp_id: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const active = clients.filter(c => c.status === "active");
  const load = useCallback(async () => {
    const { data, error } = await sb.from("client_icps").select("*").order("created_at", { ascending: false });
    setIcps(error ? [] : (data || []));
  }, []);
  useEffect(() => { load(); sourceApi("status").then(setStatus).catch(() => setStatus(null)); }, [load]);
  const add = async (e) => {
    e.preventDefault();
    if (!form.client_id || !form.name.trim() || !form.niche.trim()) return;
    setBusy(true);
    const { error } = await sb.from("client_icps").insert({ client_id: form.client_id, name: form.name.trim(), niche: form.niche.trim(), cities: form.cities.split(",").map(x => x.trim()).filter(Boolean) });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setForm({ client_id: "", name: "", niche: "", cities: "" }); load();
  };
  const runSweep = async () => {
    if (!sweep.icp_id || !sweep.city.trim()) return;
    setBusy(true); setErr(null);
    try { const r = await sourceApi("run_sweep", { icp_id: sweep.icp_id, city: sweep.city.trim() }); setErr(`Sweep done: ${r.found} found · ${r.inserted} new · ${r.merged} merged · ${r.suppressed} suppressed (${r.requests} Places calls)`); onSwept(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const dot = (ok) => <span style={{ width: 7, height: 7, borderRadius: "50%", background: ok ? "#30d158" : "rgba(255,255,255,0.25)", display: "inline-block", marginRight: 5 }} />;
  return (
    <div style={{ ...card, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ ...head, flex: 1 }}>SOURCING — ICPs, sweeps, enrichment</div>
        {status && (
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", fontFamily: "'Geist Mono', monospace", display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span title={status.places ? "Places sweeps live" : `set ${status.hints?.places}`}>{dot(status.places)}Places</span>
            <span title={status.apollo ? "Apollo reveals live" : `set ${status.hints?.apollo}`}>{dot(status.apollo)}Apollo</span>
            <span>{dot(status.apify)}Apify</span>
            <span>{dot(status.tracking)}Tracking</span>
            <span title={status.anthropic ? "AI available (needs credits)" : "no Anthropic key"}>{dot(status.anthropic)}AI</span>
          </div>
        )}
        <button style={{ ...btn(false), padding: "5px 10px", fontSize: 11 }} onClick={() => setOpen(o => !o)}>{open ? "Hide" : "Configure"}</button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <form onSubmit={add} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={{ ...input, flex: "0 0 160px" }}>
              <option value="">Client (ICP owner)…</option>
              {active.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ICP name (Roofers - IE)" style={{ ...input, flex: "1 1 150px" }} />
            <input value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} placeholder="Places phrase (roofing contractor)" style={{ ...input, flex: "1 1 180px" }} />
            <input value={form.cities} onChange={e => setForm(f => ({ ...f, cities: e.target.value }))} placeholder="Cities, comma-separated" style={{ ...input, flex: "1 1 180px" }} />
            <button type="submit" style={btn(true)} disabled={busy || !form.client_id || !form.name.trim() || !form.niche.trim()}>Add ICP</button>
          </form>
          {(icps || []).map(i => (
            <div key={i.id} style={{ fontSize: 12, color: "#d4d4d8", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <b>{i.name}</b> <span style={{ color: "rgba(255,255,255,0.45)" }}>· {i.niche} · {(i.cities || []).join(", ") || "no cities"} · signals: {(i.signal_sources || []).map(x => x.kind).join(", ")}</span>
            </div>
          ))}
          {icps && !icps.length && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>No ICPs yet. Add one per client (or under CloudScenic for the agency's own prospects).</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            <select value={sweep.icp_id} onChange={e => setSweep(x => ({ ...x, icp_id: e.target.value }))} style={{ ...input, flex: "0 0 200px" }}>
              <option value="">Sweep which ICP…</option>
              {(icps || []).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input value={sweep.city} onChange={e => setSweep(x => ({ ...x, city: e.target.value }))} placeholder="City, ST" style={{ ...input, flex: "0 1 160px" }} />
            <button style={btn(true)} disabled={busy || !sweep.icp_id || !sweep.city.trim() || (status && !status.places)} title={status && !status.places ? "Set GOOGLE_PLACES_API_KEY to enable" : ""} onClick={runSweep}>{busy ? "Working…" : "Run sweep"}</button>
            {status && !status.places && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Places not configured — sweeps are dormant until GOOGLE_PLACES_API_KEY is set.</span>}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8, lineHeight: 1.5 }}>Every sweep flows through the capture choke point: existing clients and opt-outs are suppressed (a lookup failure aborts the batch), duplicates merge into the survivor, nothing is dropped. Nothing is ever sent automatically.</div>
        </div>
      )}
    </div>
  );
}

export default function GrowthRoute({ isMobile, setActiveNav, openClient, clients = [] }) {
  const clientsForIcp = clients;
  const [leads, setLeads] = useState(null);
  const [band, setBand] = useState("all"); // all | warm | warming | cold
  const [missing, setMissing] = useState(false);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ url: "", name: "", city: "" });
  const [scanning, setScanning] = useState(false);
  const [stageFilter, setStageFilter] = useState("open");

  const load = useCallback(async () => {
    const { data, error } = await sb.from("leads").select("*").order("updated_at", { ascending: false }).limit(300);
    if (error) { setMissing(/leads/.test(error.message)); setLeads([]); return; }
    setMissing(false); setLeads(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const scan = async (e) => {
    e.preventDefault();
    if (!form.url.trim()) return;
    setScanning(true); setErr(null);
    try {
      const { lead } = await growthApi("scan", { url: form.url.trim(), name: form.name.trim() || undefined, city: form.city.trim() || undefined });
      setForm({ url: "", name: "", city: "" });
      await load();
      setSel(lead.id);
    } catch (e2) { setErr(e2.status === 424 ? e2.message : `Scan failed: ${e2.message}`); }
    setScanning(false);
  };

  const shown = useMemo(() => (leads || [])
    .filter(l => stageFilter === "all" ? true : stageFilter === "open" ? !["won", "lost"].includes(l.stage) : l.stage === stageFilter)
    .filter(l => band === "all" ? true : (l.warmth_band || "cold") === band)
    .sort((a, b) => (b.warmth_score || 0) - (a.warmth_score || 0) || new Date(b.updated_at) - new Date(a.updated_at)), [leads, stageFilter, band]);
  const bandCounts = useMemo(() => (leads || []).reduce((m, l) => { const k = l.warmth_band || "cold"; m[k] = (m[k] || 0) + 1; return m; }, {}), [leads]);
  const selected = (leads || []).find(l => l.id === sel) || null;
  const counts = useMemo(() => STAGES.reduce((m, s) => ({ ...m, [s]: (leads || []).filter(l => l.stage === s).length }), {}), [leads]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ ...head, fontSize: 9.5 }}>CLOUD SCENIC / GROWTH</div>
      <h1 style={{ fontSize: 30, fontWeight: 750, color: "#f5f5f7", margin: "6px 0 4px", fontFamily: "Inter, sans-serif", letterSpacing: -0.5 }}>Leads</h1>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginBottom: 18, lineHeight: 1.5 }}>
        Paste a prospect's website. Vantus reads it, finds what's costing them customers, and drafts the brief. The audit and the template brief run with no AI credits.
      </div>

      {missing && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(229,229,234,0.06)", border: "1px solid rgba(229,229,234,0.25)", color: "#E5E5EA", fontSize: 12.5, marginBottom: 14 }}>The growth tables aren't in the database yet — run supabase/migrations/20260823_growth.sql in the Supabase SQL editor.</div>}
      {err && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.35)", color: "#ff8a80", fontSize: 12.5, marginBottom: 14 }}>{err}</div>}

      <form onSubmit={scan} style={{ ...card, padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="their-website.com" style={{ ...input, flex: "2 1 240px" }} />
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Business name (optional)" style={{ ...input, flex: "1 1 160px" }} />
        <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City (optional)" style={{ ...input, flex: "0 1 140px" }} />
        <button type="submit" style={btn(true)} disabled={scanning || !form.url.trim() || missing}>{scanning ? "Scanning…" : "Scan + audit"}</button>
      </form>

      <IcpPanel clients={clientsForIcp} onSwept={load} setErr={setErr} />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {[["warm", `Warm now ${bandCounts.warm || 0}`], ["warming", `Warming ${bandCounts.warming || 0}`], ["cold", `Cold ${bandCounts.cold || 0}`], ["all", "All bands"]].map(([id, label]) => (
          <button key={id} onClick={() => setBand(id)} style={{ ...btn(false), padding: "5px 10px", fontSize: 11, color: band === id ? (BAND_COLOR[id] || ACCENT) : "rgba(255,255,255,0.6)", borderColor: band === id ? (BAND_COLOR[id] || ACCENT) : "rgba(255,255,255,0.12)" }}>{label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {[["open", "Open"], ["all", "All"], ...STAGES.map(s => [s, `${s} ${counts[s] || 0}`])].map(([id, label]) => (
          <button key={id} onClick={() => setStageFilter(id)} style={{ ...btn(false), padding: "5px 10px", fontSize: 11, color: stageFilter === id ? ACCENT : "rgba(255,255,255,0.6)", borderColor: stageFilter === id ? ACCENT : "rgba(255,255,255,0.12)" }}>{label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "340px 1fr", gap: 14, alignItems: "start" }}>
        <div style={{ ...card, padding: 8 }}>
          {leads == null && <div style={{ padding: 12, color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>Loading…</div>}
          {leads != null && !shown.length && <div style={{ padding: 12, color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>{missing ? "Run the migration to start." : "No leads here yet. Scan one above."}</div>}
          {shown.map(l => (
            <div key={l.id} onClick={() => setSel(l.id)}
              style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", background: sel === l.id ? "rgba(42,171,255,0.1)" : "transparent", borderLeft: `3px solid ${STAGE_COLOR[l.stage]}`, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: "#f5f5f7", fontFamily: "Inter, sans-serif" }}>{l.name}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontFamily: "'Geist Mono', monospace", marginTop: 2 }}>
                {l.warmth_band && l.warmth_band !== "cold" && <span style={{ color: BAND_COLOR[l.warmth_band], fontWeight: 700 }}>{BAND_LABEL[l.warmth_band]} {l.warmth_score} · </span>}
                {l.stage}{l.host ? ` · ${l.host}` : ""}{l.city ? ` · ${l.city}` : ""}
              </div>
              {(l.warmth_reasons || []).length > 0 && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{l.warmth_reasons[0]}</div>}
            </div>
          ))}
        </div>
        <div>
          {selected
            ? <LeadDetail lead={selected} onChanged={load} onOpenClient={(id) => openClient?.(id)} />
            : <div style={{ ...card, padding: 24, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Select a lead, or scan a new one.</div>}
        </div>
      </div>
    </div>
  );
}
