import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { setLedgerFields } from '../../core/approvals.js';

// ── Setup / Data-Entry ────────────────────────────────────────────────────────
// One screen to bulk-fill the data that makes Analytics/Billing/Ledger/Reports
// read real numbers instead of zeros. Reuses AddClientModal field patterns.
// Writes straight to Supabase (App realtime syncs `clients`/`content` back);
// team_members + connected_accounts are loaded and managed locally here.
//
// Owner assignment for deliverables is intentionally NOT here yet:
// content_items.assigned_to is a FK to profiles(id) while the Ledger resolves
// owners against team_members — a schema mismatch that needs a migration
// decision before it can work. Due-date bulk-set (below) has no such issue.

const ACCENT = "#2AABFF";
const SERVICE_LIBRARY = ["Content Strategy", "Reels", "Stories", "Static Posts", "Graphics & Flyers", "Photography", "Video Editing", "Paid Ads", "SEO", "Email", "Reporting"];
const DONE_STATUSES = ["Posted", "Scrapped"];
const PLATFORM_LABEL = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn" };

const label = { fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 };
const input = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", fontSize: 16, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const card = { background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", marginBottom: 18 };

function Section({ n, title, desc, done, total, children }) {
  const complete = total > 0 && done >= total;
  const color = total === 0 ? "rgba(255,255,255,0.3)" : complete ? "#30d158" : "#ff9f0a";
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: complete ? "rgba(48,209,88,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${color}`, color, fontSize: 12, fontWeight: 700, fontFamily: "'Geist Mono', monospace" }}>
          {complete ? "✓" : n}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f5f5f7" }}>{title}</div>
            {total > 0 && <div style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", color }}>{done}/{total}</div>}
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{desc}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SetupRoute({ isMobile, clients = [], content = [] }) {
  const [team, setTeam] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [clientOv, setClientOv] = useState({});   // id -> partial (optimistic)
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tm, acc] = await Promise.all([
        sb.from("team_members").select("id, name, role, email, skills, status, color, active").order("created_at"),
        sb.from("connected_accounts").select("id, platform, handle, display_name, avatar_url, client_id").order("id"),
      ]);
      if (cancelled) return;
      if (Array.isArray(tm.data)) setTeam(tm.data);
      if (Array.isArray(acc.data)) setAccounts(acc.data);
    })();
    return () => { cancelled = true; };
  }, []);

  const activeClients = useMemo(() => clients.filter(c => c.status === "active"), [clients]);
  const cval = (c, k) => (clientOv[c.id] && k in clientOv[c.id]) ? clientOv[c.id][k] : c[k];

  async function patchClient(id, fields) {
    setClientOv(prev => ({ ...prev, [id]: { ...prev[id], ...fields } }));
    await sb.from("clients").update(fields).eq("id", id);
  }
  async function patchAccount(id, client_id) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, client_id } : a));
    await sb.from("connected_accounts").update({ client_id }).eq("id", id);
  }

  // ── completion counts ──
  const retDone = activeClients.filter(c => Number(cval(c, "retainer_amount")) > 0).length;
  const acctDone = accounts.filter(a => a.client_id).length;
  const dueItems = content.filter(x => !DONE_STATUSES.includes(x.status));
  const dueDone = dueItems.filter(x => x.due_date).length;
  const teamDone = team.filter(m => m.email && m.email.trim()).length;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: isMobile ? 22 : 32, paddingBottom: isMobile ? 18 : 26, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", fontFamily: "'Geist Mono', monospace", marginBottom: 12 }}>Cloud Scenic / Setup</div>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight: 400, fontStyle: "italic", color: "#fff", margin: 0, letterSpacing: -1, lineHeight: 1 }}>Setup</h1>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: "12px 0 0", maxWidth: 560 }}>Fill these in once and the rest of Vantus comes alive — MRR, per-client reach, and delivery health all read from here.</p>
      </div>

      {/* 1 — Retainers & scope */}
      <Section n={1} title="Retainers & scope" desc="Sets MRR and revenue-by-type across Analytics & Billing." done={retDone} total={activeClients.length}>
        {activeClients.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>No active clients yet. Add one from the Clients page.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {activeClients.map(c => {
              const scope = Array.isArray(cval(c, "service_scope")) ? cval(c, "service_scope") : [];
              return (
                <div key={c.id} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.brand_color || ACCENT }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f7" }}>{c.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <div style={{ width: 130 }}>
                      <label style={label}>Retainer ($/mo)</label>
                      <input type="number" defaultValue={c.retainer_amount ?? ""} placeholder="0" style={input}
                        onBlur={e => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== (c.retainer_amount ?? null)) patchClient(c.id, { retainer_amount: v }); }} />
                    </div>
                    <div style={{ width: 130 }}>
                      <label style={label}>Status</label>
                      <select value={cval(c, "retainer_status") || "active"} style={input} onChange={e => patchClient(c.id, { retainer_status: e.target.value })}>
                        <option value="active">Active</option><option value="pending">Pending</option><option value="none">None</option>
                      </select>
                    </div>
                    <div style={{ width: 160 }}>
                      <label style={label}>Engagement</label>
                      <select value={cval(c, "lane") || "recurring"} style={input} onChange={e => patchClient(c.id, { lane: e.target.value })}>
                        <option value="recurring">Recurring retainer</option><option value="brief">Brief / project</option>
                      </select>
                    </div>
                  </div>
                  <label style={label}>Services in scope</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {SERVICE_LIBRARY.map(s => {
                      const on = scope.includes(s);
                      return (
                        <button type="button" key={s} onClick={() => patchClient(c.id, { service_scope: on ? scope.filter(x => x !== s) : [...scope, s] })}
                          style={{ fontSize: 11, padding: "5px 10px", borderRadius: 20, cursor: "pointer", fontFamily: "Inter, sans-serif",
                            background: on ? "rgba(42,171,255,0.15)" : "rgba(255,255,255,0.04)",
                            border: on ? "1px solid rgba(42,171,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
                            color: on ? "#2AABFF" : "rgba(255,255,255,0.5)" }}>{s}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* 2 — Connected accounts → client */}
      <Section n={2} title="Connect social accounts to clients" desc="Attributes each account's reach to the right client in Analytics." done={acctDone} total={accounts.length}>
        {accounts.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>No connected accounts yet. Connect them in Settings → Connected Accounts.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {accounts.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, fontFamily: "'Geist Mono', monospace", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", width: 66 }}>{PLATFORM_LABEL[a.platform] || a.platform}</span>
                <span style={{ flex: 1, minWidth: 120, fontSize: 13, color: "#f5f5f7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.handle || a.display_name || `Account ${a.id}`}</span>
                <select value={a.client_id || ""} onChange={e => patchAccount(a.id, e.target.value || null)} style={{ ...input, width: 200, padding: "8px 10px", fontSize: 13 }}>
                  <option value="">— Unassigned —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 3 — Due dates (owner assignment deferred — see banner) */}
      <Section n={3} title="Deliverable due dates" desc="Powers overdue detection in Ledger, Reports, and Analytics." done={dueDone} total={dueItems.length}>
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(255,159,10,0.06)", border: "1px solid rgba(255,159,10,0.25)", borderRadius: 9, fontSize: 11.5, color: "rgba(255,200,120,0.9)" }}>
          Owner assignment isn't here yet — <code style={{ fontFamily: "'Geist Mono', monospace" }}>content_items.assigned_to</code> points at auth users while the Ledger reads the team roster. That mismatch needs a schema decision first. Due dates work now.
        </div>
        <BulkDue items={dueItems} clients={clients} isMobile={isMobile} onBusy={setBusy} busy={busy} />
      </Section>

      {/* 4 — Team roster */}
      <Section n={4} title="Team roster" desc="Real names + emails so the daily overdue-task chase can reach people." done={teamDone} total={team.length}>
        <TeamEditor team={team} setTeam={setTeam} />
      </Section>
    </div>
  );
}

// ── Section 3 body: multi-select + bulk due date ──
function BulkDue({ items, clients, isMobile, onBusy, busy }) {
  const [sel, setSel] = useState(() => new Set());
  const [due, setDue] = useState("");
  const [overrides, setOverrides] = useState({}); // id -> due_date (optimistic)
  const cname = (id) => { const c = clients.find(x => x.id === id); return c ? c.name : "—"; };
  const missing = items.filter(x => !(overrides[x.id] ?? x.due_date));
  const shown = missing.slice(0, 40);

  const toggle = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShown = shown.length > 0 && shown.every(x => sel.has(x.id));
  const toggleAll = () => setSel(allShown ? new Set() : new Set(shown.map(x => x.id)));

  async function apply() {
    if (!due || sel.size === 0) return;
    onBusy("due");
    const ids = [...sel];
    setOverrides(prev => { const n = { ...prev }; ids.forEach(id => { n[id] = due; }); return n; });
    try { await Promise.all(ids.map(id => setLedgerFields(id, { due_date: due }))); }
    finally { setSel(new Set()); onBusy(null); }
  }

  if (items.length > 0 && missing.length === 0) {
    return <div style={{ fontSize: 12, color: "#30d158" }}>Every deliverable has a due date. ✓</div>;
  }
  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>No open deliverables yet.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={toggleAll} style={{ fontSize: 11, padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>{allShown ? "Clear" : `Select all (${shown.length})`}</button>
        <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ ...input, width: 160 }} />
        <button type="button" disabled={!due || sel.size === 0 || busy === "due"} onClick={apply}
          style={{ fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none", cursor: (!due || sel.size === 0) ? "not-allowed" : "pointer", background: (!due || sel.size === 0) ? "rgba(255,255,255,0.08)" : ACCENT, color: (!due || sel.size === 0) ? "rgba(255,255,255,0.4)" : "#fff" }}>
          {busy === "due" ? "Setting…" : `Set due date${sel.size ? ` (${sel.size})` : ""}`}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {shown.map(x => (
          <label key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: sel.has(x.id) ? "rgba(42,171,255,0.08)" : "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9, cursor: "pointer" }}>
            <input type="checkbox" checked={sel.has(x.id)} onChange={() => toggle(x.id)} style={{ accentColor: ACCENT, width: 15, height: 15 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#f5f5f7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.title || "Untitled"}</span>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "'Geist Mono', monospace" }}>{cname(x.client_id)}</span>
          </label>
        ))}
        {missing.length > shown.length && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", padding: "6px 2px" }}>+{missing.length - shown.length} more — set these first, the rest will surface.</div>}
      </div>
    </div>
  );
}

// ── Section 4 body: team roster editor ──
function TeamEditor({ team, setTeam }) {
  const [adding, setAdding] = useState(false);
  const [nm, setNm] = useState({ name: "", role: "", email: "", skills: "" });

  const patch = async (id, fields) => {
    setTeam(prev => prev.map(m => m.id === id ? { ...m, ...fields } : m));
    await sb.from("team_members").update(fields).eq("id", id);
  };
  const del = async (m) => {
    if (!window.confirm(`Remove ${m.name} from the roster?`)) return;
    setTeam(prev => prev.filter(x => x.id !== m.id));
    await sb.from("team_members").delete().eq("id", m.id);
  };
  const add = async () => {
    if (!nm.name.trim()) return;
    const row = { name: nm.name.trim(), role: nm.role.trim() || null, email: nm.email.trim() || null, skills: nm.skills.split(",").map(s => s.trim()).filter(Boolean), status: "online" };
    const { data } = await sb.from("team_members").insert(row).select().single();
    if (data) setTeam(prev => [...prev, data]);
    setNm({ name: "", role: "", email: "", skills: "" }); setAdding(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {team.map(m => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, flexWrap: "wrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color || ACCENT, flexShrink: 0 }} />
          <input defaultValue={m.name} onBlur={e => e.target.value.trim() && e.target.value !== m.name && patch(m.id, { name: e.target.value.trim() })} placeholder="Name" style={{ ...input, width: 130, padding: "7px 10px", fontSize: 13 }} />
          <input defaultValue={m.role || ""} onBlur={e => e.target.value !== (m.role || "") && patch(m.id, { role: e.target.value.trim() || null })} placeholder="Role" style={{ ...input, width: 120, padding: "7px 10px", fontSize: 13 }} />
          <input defaultValue={m.email || ""} onBlur={e => e.target.value !== (m.email || "") && patch(m.id, { email: e.target.value.trim() || null })} placeholder="email@…" style={{ ...input, flex: 1, minWidth: 150, padding: "7px 10px", fontSize: 13, border: m.email ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,159,10,0.35)" }} />
          <button type="button" onClick={() => del(m)} title="Remove" style={{ width: 30, height: 30, borderRadius: 8, background: "transparent", border: "1px solid rgba(255,69,58,0.3)", color: "#ff453a", cursor: "pointer", fontSize: 13 }}>×</button>
        </div>
      ))}
      {adding ? (
        <div style={{ display: "flex", gap: 8, padding: "9px 12px", background: "rgba(42,171,255,0.05)", border: "1px solid rgba(42,171,255,0.2)", borderRadius: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={nm.name} onChange={e => setNm({ ...nm, name: e.target.value })} placeholder="Name *" style={{ ...input, width: 130, padding: "7px 10px", fontSize: 13 }} autoFocus />
          <input value={nm.role} onChange={e => setNm({ ...nm, role: e.target.value })} placeholder="Role" style={{ ...input, width: 120, padding: "7px 10px", fontSize: 13 }} />
          <input value={nm.email} onChange={e => setNm({ ...nm, email: e.target.value })} placeholder="email@…" style={{ ...input, flex: 1, minWidth: 140, padding: "7px 10px", fontSize: 13 }} />
          <input value={nm.skills} onChange={e => setNm({ ...nm, skills: e.target.value })} placeholder="skills, comma, sep" style={{ ...input, width: 150, padding: "7px 10px", fontSize: 13 }} />
          <button type="button" onClick={add} style={{ fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff", cursor: "pointer" }}>Add</button>
          <button type="button" onClick={() => { setAdding(false); setNm({ name: "", role: "", email: "", skills: "" }); }} style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} style={{ alignSelf: "flex-start", fontSize: 12, padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>+ Add team member</button>
      )}
    </div>
  );
}
