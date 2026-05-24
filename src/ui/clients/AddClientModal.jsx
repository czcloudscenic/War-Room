import React, { useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

function slugify(s) {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AddClientModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [brandVoice, setBrandVoice] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [brandColor, setBrandColor] = useState("#2AABFF");
  const [slackChannel, setSlackChannel] = useState("");
  const [n8nWebhook, setN8nWebhook] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (v) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!name.trim()) { setError("Client name is required."); return; }
    if (!slug.trim()) { setError("Slug is required."); return; }
    setSaving(true);
    try {
      const { data, error: insErr } = await sb
        .from("clients")
        .insert({
          name: name.trim(),
          slug: slug.trim(),
          brand_voice_md: brandVoice.trim() || null,
          brand_color: brandColor || null,
          primary_email: primaryEmail.trim() || null,
          slack_channel_id: slackChannel.trim() || null,
          n8n_webhook_url: n8nWebhook.trim() || null,
          logo_url: logoUrl.trim() || null,
          status: "active",
        })
        .select()
        .single();
      if (insErr) {
        if (insErr.code === "23505") setError(`Slug "${slug}" is already in use. Pick a different one.`);
        else setError(insErr.message || "Insert failed");
        return;
      }
      onCreated?.(data);
    } catch (e2) {
      setError(e2.message || "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.45)", display:"block", marginBottom:6 };
  const inputStyle = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#f5f5f7", outline:"none", fontFamily:"Inter, sans-serif", boxSizing:"border-box" };

  return (
    <div
      onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(6px)", zIndex:2147483646, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
    >
      <form
        onSubmit={handleCreate}
        onClick={(e) => e.stopPropagation()}
        style={{ width:480, maxWidth:"100%", maxHeight:"90vh", overflowY:"auto", background:"#13110f", border:"1px solid rgba(255,255,255,0.12)", borderRadius:18, padding:"24px 26px", boxShadow:"0 24px 64px rgba(0,0,0,0.7)" }}
      >
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", letterSpacing:3, fontWeight:600, textTransform:"uppercase", marginBottom:6 }}>New Client</div>
          <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:24, fontWeight:500, color:"#f5f5f7", margin:0, letterSpacing:-0.5 }}>Add Client</h2>
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:"4px 0 0" }}>Lands you on a blank dashboard scoped to this client.</p>
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

        <details style={{ marginBottom:18 }}>
          <summary style={{ fontSize:11, color:"rgba(255,255,255,0.5)", cursor:"pointer", padding:"4px 0", letterSpacing:0.3 }}>Optional integrations</summary>
          <div style={{ marginTop:12 }}>
            <label style={labelStyle}>Slack Channel ID</label>
            <input value={slackChannel} onChange={e => setSlackChannel(e.target.value)} placeholder="C0AM0UU4G4R" style={inputStyle} />
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4, marginBottom:12 }}>Where this client's notifications post.</div>

            <label style={labelStyle}>n8n Webhook URL</label>
            <input value={n8nWebhook} onChange={e => setN8nWebhook(e.target.value)} placeholder="https://...n8n.cloud/webhook/..." style={inputStyle} />
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4, marginBottom:12 }}>Per-client automation webhook.</div>

            <label style={labelStyle}>Logo URL</label>
            <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
          </div>
        </details>

        {error && (
          <div style={{ fontSize:11, color:"rgba(255,140,130,0.95)", marginBottom:14, padding:"9px 13px", background:"rgba(255,50,50,0.08)", borderRadius:8, border:"1px solid rgba(255,60,60,0.15)" }}>
            {error}
          </div>
        )}

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button type="button" onClick={onClose} style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, color:"rgba(255,255,255,0.65)", fontSize:12, fontWeight:500, padding:"9px 16px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ background:"rgba(42,171,255,0.18)", border:"1px solid rgba(42,171,255,0.4)", borderRadius:10, color:"#2AABFF", fontSize:12, fontWeight:600, padding:"9px 18px", cursor: saving?"not-allowed":"pointer", fontFamily:"Inter, sans-serif", opacity: saving?0.55:1 }}>
            {saving ? "Creating…" : "Create Client"}
          </button>
        </div>
      </form>
    </div>
  );
}
