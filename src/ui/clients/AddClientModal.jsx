import React, { useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import ClientTeamPanel from './ClientTeamPanel.jsx';

function slugify(s) {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Service Library (ceiling) — clients inherit only the ones they pay for (scope).
const SERVICE_LIBRARY = ["Content Strategy", "Reels", "Stories", "Static Posts", "Graphics & Flyers", "Photography", "Video Editing", "Paid Ads", "SEO", "Email", "Reporting"];

export default function AddClientModal({ onClose, onCreated, onUpdated, editingClient = null, currentUserId = null }) {
  const isEdit = !!editingClient;
  const [name, setName] = useState(editingClient?.name || "");
  const [slug, setSlug] = useState(editingClient?.slug || "");
  const [slugTouched, setSlugTouched] = useState(isEdit);  // don't auto-derive in edit mode
  const [brandVoice, setBrandVoice] = useState(editingClient?.brand_voice_md || "");
  const [primaryEmail, setPrimaryEmail] = useState(editingClient?.primary_email || "");
  const [brandColor, setBrandColor] = useState(editingClient?.brand_color || "#2AABFF");
  const [slackChannel, setSlackChannel] = useState(editingClient?.slack_channel_id || "");
  const [slackWebhook, setSlackWebhook] = useState(editingClient?.slack_webhook_url || "");
  const [n8nWebhook, setN8nWebhook] = useState(editingClient?.n8n_webhook_url || "");
  const [logoUrl, setLogoUrl] = useState(editingClient?.logo_url || "");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [lane, setLane] = useState(editingClient?.lane || "recurring");
  const [services, setServices] = useState(Array.isArray(editingClient?.service_scope) ? editingClient.service_scope : []);
  const [cadence, setCadence] = useState(editingClient?.cadence || "");
  const [approvalRule, setApprovalRule] = useState(editingClient?.approval_rule || "internal");
  const [retainerAmount, setRetainerAmount] = useState(editingClient?.retainer_amount ?? "");
  const [retainerStatus, setRetainerStatus] = useState(editingClient?.retainer_status || "active");
  const toggleService = (s) => setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const joinArr = (a) => (Array.isArray(a) ? a.join("\n") : "");
  const toArr = (s) => s.split("\n").map(x => x.trim()).filter(Boolean);
  const [brandPillars, setBrandPillars] = useState(joinArr(editingClient?.brand_pillars));
  const [brandDos, setBrandDos] = useState(joinArr(editingClient?.brand_dos));
  const [brandDonts, setBrandDonts] = useState(joinArr(editingClient?.brand_donts));

  const handleNameChange = (v) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Logo must be an image."); return; }
    if (f.size > 2 * 1024 * 1024) { setError("Logo must be under 2MB."); return; }
    setError("");
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const uploadLogoIfNeeded = async () => {
    if (!logoFile) return logoUrl.trim() || null;
    setUploading(true);
    try {
      const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${slug || "client"}-${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from("client-logos").upload(path, logoFile, {
        upsert: true,
        contentType: logoFile.type,
      });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      const { data: pub } = sb.storage.from("client-logos").getPublicUrl(path);
      return pub?.publicUrl || null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!name.trim()) { setError("Client name is required."); return; }
    if (!slug.trim()) { setError("Slug is required."); return; }
    setSaving(true);
    try {
      const finalLogoUrl = await uploadLogoIfNeeded();
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        brand_voice_md: brandVoice.trim() || null,
        brand_color: brandColor || null,
        primary_email: primaryEmail.trim() || null,
        slack_channel_id: slackChannel.trim() || null,
        slack_webhook_url: slackWebhook.trim() || null,
        n8n_webhook_url: n8nWebhook.trim() || null,
        logo_url: finalLogoUrl,
        lane,
        service_scope: services,
        cadence: cadence.trim() || null,
        approval_rule: approvalRule,
        retainer_amount: retainerAmount === "" ? null : Number(retainerAmount),
        retainer_status: retainerStatus,
        brand_pillars: toArr(brandPillars),
        brand_dos: toArr(brandDos),
        brand_donts: toArr(brandDonts),
      };

      if (isEdit) {
        const { data, error: upErr } = await sb
          .from("clients").update(payload).eq("id", editingClient.id)
          .select().single();
        if (upErr) {
          if (upErr.code === "23505") setError(`Slug "${slug}" is already in use.`);
          else setError(upErr.message || "Update failed");
          return;
        }
        onUpdated?.(data);
      } else {
        const { data, error: insErr } = await sb
          .from("clients").insert({ ...payload, status: "active" })
          .select().single();
        if (insErr) {
          if (insErr.code === "23505") setError(`Slug "${slug}" is already in use. Pick a different one.`);
          else setError(insErr.message || "Insert failed");
          return;
        }
        onCreated?.(data);
      }
    } catch (e2) {
      setError(e2.message || "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!isEdit) return;
    if (!window.confirm(`Archive "${editingClient.name}"? It'll hide from the picker but data is preserved.`)) return;
    setArchiving(true);
    try {
      const { error: upErr } = await sb
        .from("clients").update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("id", editingClient.id);
      if (upErr) { setError(upErr.message || "Archive failed"); return; }
      onUpdated?.({ ...editingClient, status: "archived" });
      onClose?.();
    } finally {
      setArchiving(false);
    }
  };

  const labelStyle = { fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.45)", display:"block", marginBottom:6 };
  // fontSize 16 prevents iOS Safari from auto-zooming the viewport on input focus
  const inputStyle = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"9px 12px", fontSize:16, color:"#f5f5f7", outline:"none", fontFamily:"Inter, sans-serif", boxSizing:"border-box" };

  return (
    <div
      onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(6px)", zIndex:2147483646, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{ width:480, maxWidth:"100%", maxHeight:"90vh", overflowY:"auto", background:"#13110f", border:"1px solid rgba(255,255,255,0.12)", borderRadius:18, padding:"24px 26px", boxShadow:"0 24px 64px rgba(0,0,0,0.7)" }}
      >
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", letterSpacing:3, fontWeight:600, textTransform:"uppercase", marginBottom:6 }}>{isEdit ? "Edit Client" : "New Client"}</div>
          <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:24, fontWeight:500, color:"#f5f5f7", margin:0, letterSpacing:-0.5 }}>{isEdit ? editingClient.name : "Add Client"}</h2>
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:"4px 0 0" }}>{isEdit ? "Update brand voice, logo, integrations, or archive this client." : "Lands you on a blank dashboard scoped to this client."}</p>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Client Name *</label>
          <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Acme Co." style={inputStyle} autoFocus />
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Slug *</label>
          <input value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} placeholder="acme-co" style={inputStyle} />
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4 }}>URL-safe identifier. Auto-derived from name.</div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Logo</label>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:64, height:64, borderRadius:12, background:"rgba(255,255,255,0.04)", border:"1px dashed rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
              {logoPreview || logoUrl ? (
                <img src={logoPreview || logoUrl} style={{ width:"100%", height:"100%", objectFit:"contain" }} alt="Logo preview" />
              ) : (
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:1, textTransform:"uppercase" }}>Preview</span>
              )}
            </div>
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
              <label style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 12px", background:"rgba(42,171,255,0.08)", border:"1px solid rgba(42,171,255,0.25)", borderRadius:8, cursor:"pointer", fontSize:12, color:"#2AABFF", fontWeight:500, width:"fit-content" }}>
                <input type="file" accept="image/*" onChange={handleFilePick} style={{ display:"none" }} />
                {logoFile ? `📎 ${logoFile.name.slice(0, 30)}` : "Upload image"}
              </label>
              <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="or paste URL…" style={{ ...inputStyle, padding:"7px 10px", fontSize:11 }} disabled={!!logoFile} />
            </div>
          </div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:6 }}>PNG or JPG · under 2MB · square works best</div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Brand Voice (Markdown)</label>
          <textarea
            value={brandVoice}
            onChange={e => setBrandVoice(e.target.value)}
            placeholder="e.g. Calm, confident, purposeful. Never corporate. Avoid generic wellness language."
            rows={3}
            style={{ ...inputStyle, resize:"vertical", minHeight:60, fontFamily:"'Geist Mono', Inter, sans-serif", fontSize:12 }}
          />
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4 }}>Will seed agent prompts for this client (Move 1).</div>
        </div>

        <div style={{ display:"flex", gap:12, marginBottom:14 }}>
          <div style={{ flex:1 }}>
            <label style={labelStyle}>Primary Email</label>
            <input type="email" value={primaryEmail} onChange={e => setPrimaryEmail(e.target.value)} placeholder="approver@client.com" style={inputStyle} />
          </div>
          <div style={{ width:110 }}>
            <label style={labelStyle}>Brand Color</label>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} style={{ width:32, height:32, border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, background:"none", cursor:"pointer", padding:0 }} />
              <input value={brandColor} onChange={e => setBrandColor(e.target.value)} style={{ ...inputStyle, padding:"7px 8px", fontSize:11, fontFamily:"'Geist Mono', monospace" }} />
            </div>
          </div>
        </div>

        {/* Brand Guidelines */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Pillars <span style={{ color:"rgba(255,255,255,0.25)" }}>(one per line)</span></label>
          <textarea value={brandPillars} onChange={e => setBrandPillars(e.target.value)} placeholder={"Movement, not product\nCalm authority\nReal stories"} rows={2} style={{ ...inputStyle, resize:"vertical", minHeight:46, fontSize:12 }} />
        </div>
        <div style={{ display:"flex", gap:12, marginBottom:6 }}>
          <div style={{ flex:1 }}>
            <label style={labelStyle}>Always do</label>
            <textarea value={brandDos} onChange={e => setBrandDos(e.target.value)} placeholder={"Lead with the feeling\nKeep it human"} rows={2} style={{ ...inputStyle, resize:"vertical", minHeight:46, fontSize:12 }} />
          </div>
          <div style={{ flex:1 }}>
            <label style={labelStyle}>Never do</label>
            <textarea value={brandDonts} onChange={e => setBrandDonts(e.target.value)} placeholder={"Sound corporate\nGeneric wellness lingo"} rows={2} style={{ ...inputStyle, resize:"vertical", minHeight:46, fontSize:12 }} />
          </div>
        </div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", margin:"0 0 14px" }}>Fed into every agent prompt for this client — pillars + do/don't rules.</div>

        {/* Scope & Fulfillment */}
        <div style={{ marginBottom:18, paddingTop:6, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.55)", margin:"10px 0 12px" }}>Scope &amp; Fulfillment</div>

          <div style={{ display:"flex", gap:12, marginBottom:14 }}>
            <div style={{ flex:1 }}>
              <label style={labelStyle}>Engagement</label>
              <select value={lane} onChange={e => setLane(e.target.value)} style={inputStyle}>
                <option value="recurring">Recurring retainer</option>
                <option value="brief">Brief / project-driven</option>
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={labelStyle}>Approval rule</label>
              <select value={approvalRule} onChange={e => setApprovalRule(e.target.value)} style={inputStyle}>
                <option value="internal">Internal QC only</option>
                <option value="client">Client approval required</option>
                <option value="auto">Auto (no review)</option>
              </select>
            </div>
          </div>

          <label style={labelStyle}>Services in scope</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:14 }}>
            {SERVICE_LIBRARY.map(s => {
              const on = services.includes(s);
              return (
                <button type="button" key={s} onClick={() => toggleService(s)}
                  style={{ fontSize:11, padding:"6px 11px", borderRadius:20, cursor:"pointer", fontFamily:"Inter, sans-serif",
                    background: on ? "rgba(42,171,255,0.15)" : "rgba(255,255,255,0.04)",
                    border: on ? "1px solid rgba(42,171,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
                    color: on ? "#2AABFF" : "rgba(255,255,255,0.5)" }}>{s}</button>
              );
            })}
          </div>

          <label style={labelStyle}>Cadence</label>
          <input value={cadence} onChange={e => setCadence(e.target.value)} placeholder="1 shoot/mo · 2 reels/wk · 2 stories/wk" style={inputStyle} />
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", margin:"4px 0 14px" }}>What they get each cycle.</div>

          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={labelStyle}>Retainer ($/mo)</label>
              <input type="number" value={retainerAmount} onChange={e => setRetainerAmount(e.target.value)} placeholder="0" style={inputStyle} />
            </div>
            <div style={{ flex:1 }}>
              <label style={labelStyle}>Retainer status</label>
              <select value={retainerStatus} onChange={e => setRetainerStatus(e.target.value)} style={inputStyle}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
        </div>

        <details style={{ marginBottom:18 }}>
          <summary style={{ fontSize:11, color:"rgba(255,255,255,0.5)", cursor:"pointer", padding:"4px 0", letterSpacing:0.3 }}>Optional integrations</summary>
          <div style={{ marginTop:12 }}>
            <label style={labelStyle}>Slack Webhook URL</label>
            <input value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/T.../B.../..." style={inputStyle} />
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4, marginBottom:12 }}>Incoming webhook for this client's channel. Falls back to global if blank.</div>

            <label style={labelStyle}>Slack Channel ID <span style={{ color:"rgba(255,255,255,0.25)" }}>(deprecated)</span></label>
            <input value={slackChannel} onChange={e => setSlackChannel(e.target.value)} placeholder="C0AM0UU4G4R" style={inputStyle} />
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4, marginBottom:12 }}>Legacy — only used if you set up a Slack bot later.</div>

            <label style={labelStyle}>n8n Webhook URL</label>
            <input value={n8nWebhook} onChange={e => setN8nWebhook(e.target.value)} placeholder="https://...n8n.cloud/webhook/..." style={inputStyle} />
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4 }}>Per-client automation webhook.</div>
          </div>
        </details>

        {error && (
          <div style={{ fontSize:11, color:"rgba(255,140,130,0.95)", marginBottom:14, padding:"9px 13px", background:"rgba(255,50,50,0.08)", borderRadius:8, border:"1px solid rgba(255,60,60,0.15)" }}>
            {error}
          </div>
        )}

        {isEdit && (
          <ClientTeamPanel
            clientId={editingClient.id}
            clientName={editingClient.name}
            currentUserId={currentUserId}
          />
        )}

        <div style={{ display:"flex", gap:8, justifyContent:"space-between", alignItems:"center", marginTop: isEdit ? 18 : 0 }}>
          {isEdit ? (
            <button type="button" onClick={handleArchive} disabled={archiving || saving} style={{ background:"transparent", border:"1px solid rgba(255,69,58,0.35)", borderRadius:10, color:"#ff453a", fontSize:11, fontWeight:500, padding:"9px 14px", cursor: archiving?"not-allowed":"pointer", fontFamily:"Inter, sans-serif", opacity: archiving?0.55:1 }}>
              {archiving ? "Archiving…" : "Archive Client"}
            </button>
          ) : <span />}
          <div style={{ display:"flex", gap:8 }}>
            <button type="button" onClick={onClose} style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, color:"rgba(255,255,255,0.65)", fontSize:12, fontWeight:500, padding:"9px 16px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}>Cancel</button>
            <button type="submit" disabled={saving || archiving} style={{ background:"rgba(42,171,255,0.18)", border:"1px solid rgba(42,171,255,0.4)", borderRadius:10, color:"#2AABFF", fontSize:12, fontWeight:600, padding:"9px 18px", cursor: (saving||archiving)?"not-allowed":"pointer", fontFamily:"Inter, sans-serif", opacity: (saving||archiving)?0.55:1 }}>
              {uploading ? "Uploading logo…" : saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Client")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
