import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import { STATUSES, FORMATS, PILLARS_LIST, PLATFORMS_LIST, CAMPAIGNS } from '../../utils/constants.js';

export default function EditContentModal({ item, onSave, onClose, onDelete, onDuplicate, isNew = false }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // SOP gate validation
  const sopGates = useMemo(() => {
const gates = [];
const s = form.status;
const hasCaption = form.caption && form.caption.trim().length > 20;
const hasFiles   = form.files && form.files.length > 0;
const hasDate    = !!form.publish_date;
const isVideo    = ["Reel", "Short", "YouTube"].includes(form.format);

if (["Need Copy Approval","Ready For Content Creation","Need Content Approval","Approved","Ready For Schedule","Scheduled"].includes(s)) {
  gates.push({ label: "Caption written", ok: hasCaption, hard: false, fix: "Write a caption first (min 20 chars)" });
}
if (["Need Content Approval","Approved","Ready For Schedule","Scheduled"].includes(s) && isVideo) {
  gates.push({ label: "Script written", ok: !!(form.script && form.script.trim().length > 20), hard: false, fix: "Write a script before sending to production" });
}
if (["Need Content Approval","Approved","Ready For Schedule","Scheduled"].includes(s)) {
  gates.push({ label: "Files attached", ok: hasFiles, hard: false, fix: "Attach content files before approval" });
}
if (["Ready For Schedule","Scheduled"].includes(s)) {
  gates.push({ label: "Publish date set", ok: hasDate, hard: true, fix: "Set a publish date before scheduling" });
}
return gates;
  }, [form.status, form.caption, form.script, form.files, form.publish_date, form.format]);

  const hardBlocked = sopGates.some(g => g.hard && !g.ok);
  const hasWarnings = sopGates.some(g => !g.ok);
  const togglePlatform = (p) => {
const cur = form.platforms || [];
set("platforms", cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p]);
  };

  //  GOOGLE DRIVE UPLOAD
  const GDRIVE_CLIENT_ID = "458336864067-sf7s9meaogm9ltk4qcupv8tu943in6ft.apps.googleusercontent.com";
  const GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef(null);

  const getAccessToken = () => new Promise((resolve, reject) => {
if (!window.google) { reject(new Error("Google not loaded")); return; }
const client = window.google.accounts.oauth2.initTokenClient({
  client_id: GDRIVE_CLIENT_ID,
  scope: GDRIVE_SCOPE,
  callback: (resp) => resp.error ? reject(resp) : resolve(resp.access_token),
});
client.requestAccessToken({ prompt: "" });
  });

  const handleUpload = async (e) => {
const file = e.target.files[0];
if (!file) return;
setUploading(true); setUploadMsg("Connecting to Google…");
try {
  const token = await getAccessToken();
  setUploadMsg("Uploading to Drive…");

  // Step 1: Initiate resumable upload session
  const initRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": file.type,
      "X-Upload-Content-Length": file.size,
    },
    body: JSON.stringify({ name: `[${form.id}] ${file.name}`, mimeType: file.type }),
  });
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("Failed to get upload URL");

  // Step 2: Upload the file to the session URL
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type, "Content-Length": file.size },
    body: file,
  });
  const data = await uploadRes.json();
  if (data.error) throw new Error(data.error.message);

  // Step 3: Make file viewable by anyone with link
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  const files = [...(form.files || []), { name: file.name, url: data.webViewLink, driveId: data.id }];
  set("files", files);
  setUploadMsg(` ${file.name} uploaded to Drive`);
} catch (err) {
  setUploadMsg("Upload failed: " + err.message);
}
setUploading(false);
  };

  const removeFile = (f) => set("files", (form.files || []).filter(x => x.driveId !== f.driveId));
  const [previewFile, setPreviewFile] = React.useState(null);
  const getPreviewUrl = (f) => {
if (!f.url) return null;
// Google Drive: extract file ID and use embed URL
const driveMatch = f.url.match(/[-\w]{25,}/);
if (f.url.includes("drive.google.com") && driveMatch) {
  return `https://drive.google.com/file/d/${f.driveId || driveMatch[0]}/preview`;
}
return f.url; // direct URL (Supabase storage etc.)
  };
  const isImage = (f) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name);
  const isVideo = (f) => /\.(mp4|mov|avi|webm)$/i.test(f.name);

  const labelStyle = { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 5, display: "block" };
  const inputStyle = { width: "100%", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#ffffff", outline: "none", fontFamily: "Inter, sans-serif", background: "#1a1818", boxSizing: "border-box" };
  const textareaStyle = { ...inputStyle, resize: "vertical", lineHeight: 1.6 };
  const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", cursor: "pointer" };

  return (
<div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", alignItems: isMobile ? "flex-end" : "center", justifyContent:"center", background:"rgba(0,0,0,0.35)", backdropFilter:"blur(4px)" }} onClick={onClose}>
  <div onClick={e => e.stopPropagation()} style={{ background:"rgba(255,255,255,0.05)", borderRadius: isMobile ? "20px 20px 0 0" : 20, width:"100%", maxWidth: isMobile ? "100%" : 660, maxHeight: isMobile ? "92dvh" : "92vh", overflowY:"auto", padding: isMobile ? "24px 20px 32px" : "32px 36px", boxShadow:"0 24px 80px rgba(0,0,0,0.18)", fontFamily:"Inter, sans-serif", paddingBottom: isMobile ? "calc(32px + env(safe-area-inset-bottom,0px))" : "32px" }}>
    {/* Header */}
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
      <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:"italic", fontSize:26, fontWeight:400, color:"#f5f5f7", margin:0 }}>{isNew ? "New Content" : "Edit Content"}</h2>
      <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, color:"rgba(255,255,255,0.35)", cursor:"pointer", lineHeight:1, padding:4 }}></button>
    </div>

    {/* Row 1: Campaign + Status */}
    <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:16, marginBottom:18 }}>
      <div>
        <label style={labelStyle}>Campaign</label>
        <select style={selectStyle} value={form.campaign} onChange={e => set("campaign", e.target.value)}>
          {CAMPAIGNS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Status</label>
        <select style={selectStyle} value={form.status} onChange={e => set("status", e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>

    {/* Row 2: Format + Pillar */}
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>
      <div>
        <label style={labelStyle}>Format</label>
        <select style={selectStyle} value={form.format} onChange={e => set("format", e.target.value)}>
          {FORMATS.map(f => <option key={f}>{f}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Content Pillar</label>
        <select style={selectStyle} value={form.pillar} onChange={e => set("pillar", e.target.value)}>
          {PILLARS_LIST.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
    </div>

    {/* Platforms */}
    <div style={{ marginBottom:18 }}>
      <label style={labelStyle}>Platforms</label>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {PLATFORMS_LIST.map(p => {
          const active = (form.platforms || []).includes(p);
          return (
            <button key={p} onClick={() => togglePlatform(p)} style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s", border: active ? "1px solid rgba(42,171,255,0.4)" : "1px solid rgba(255,255,255,0.1)", background: active ? "rgba(42,171,255,0.15)" : "#1a1818", color: active ? "#2AABFF" : "rgba(255,255,255,0.5)", fontFamily:"Inter, sans-serif" }}>{p}</button>
          );
        })}
      </div>
    </div>

    {/* Content Title */}
    <div style={{ marginBottom:18 }}>
      <label style={labelStyle}>Content Title</label>
      <input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} />
    </div>

    {/* Content Description */}
    <div style={{ marginBottom:18 }}>
      <label style={{ ...labelStyle, display:"flex", alignItems:"center", gap:6 }}>
        <strong style={{ color:"rgba(255,255,255,0.75)" }}>Content Description</strong>
        <span style={{ fontWeight:400, fontSize:9, color:"rgba(255,255,255,0.35)", textTransform:"none", letterSpacing:0 }}>— What is this content?</span>
      </label>
      <textarea style={{ ...textareaStyle, minHeight:72 }} value={form.description} onChange={e => set("description", e.target.value)} />
    </div>

    {/* Script */}
    <div style={{ marginBottom:18 }}>
      <label style={labelStyle}>Video Copy / Script</label>
      <textarea style={{ ...textareaStyle, minHeight:90, fontFamily:"'SF Mono', 'Fira Code', monospace", fontSize:12, color:"rgba(255,255,255,0.65)" }} value={form.script} onChange={e => set("script", e.target.value)} placeholder={"Opening Scene: ...\nMiddle: ...\nClosing Frame: ..."} />
    </div>

    {/* Caption */}
    <div style={{ marginBottom:18 }}>
      <label style={labelStyle}>Caption</label>
      <textarea style={{ ...textareaStyle, minHeight:80 }} value={form.caption} onChange={e => set("caption", e.target.value)} />
    </div>

    {/* CTA */}
    <div style={{ marginBottom:18 }}>
      <label style={labelStyle}>CTA</label>
      <input style={inputStyle} value={form.cta} onChange={e => set("cta", e.target.value)} />
    </div>

    {/* SEO Keywords */}
    <div style={{ marginBottom:18 }}>
      <label style={labelStyle}>SEO Keywords</label>
      <input style={inputStyle} value={form.seoKeywords} onChange={e => set("seoKeywords", e.target.value)} placeholder="water origin, abundance storytelling..." />
    </div>

    {/* Hashtags */}
    <div style={{ marginBottom:18 }}>
      <label style={labelStyle}>Hashtags</label>
      <input style={inputStyle} value={form.hashtags} onChange={e => set("hashtags", e.target.value)} />
    </div>

    {/* Start Week + Duration + Publish Date */}
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:18 }}>
      <div>
        <label style={labelStyle}>Start Week</label>
        <input style={inputStyle} type="number" value={form.startWeek} onChange={e => set("startWeek", e.target.value)} />
      </div>
      <div>
        <label style={labelStyle}>Duration (Weeks)</label>
        <input style={inputStyle} type="number" value={form.duration} onChange={e => set("duration", e.target.value)} />
      </div>
      <div>
        <label style={labelStyle}>Publish Date</label>
        <input style={inputStyle} type="date" value={form.publish_date || ""} onChange={e => set("publish_date", e.target.value)} />
      </div>
    </div>

    {/* Notes */}
    <div style={{ marginBottom:18 }}>
      <label style={labelStyle}>Notes / Direction</label>
      <textarea style={{ ...textareaStyle, minHeight:72 }} value={form.notes} onChange={e => set("notes", e.target.value)} />
    </div>

    {/* Client Note */}
    <div style={{ marginBottom:28 }}>
      <label style={{ ...labelStyle, color:"rgba(255,69,58,0.6)" }}>Client Note</label>
      <textarea style={{ ...textareaStyle, minHeight:56, borderColor: form.client_note ? "rgba(255,69,58,0.3)" : "rgba(255,255,255,0.1)", background: form.client_note ? "rgba(255,69,58,0.08)" : "#1a1818" }}
        value={form.client_note || ""} onChange={e => set("client_note", e.target.value)}
        placeholder="Client revision notes will appear here…" />
    </div>

    {/* File Assets */}
    <div style={{ marginBottom:28 }}>
      <label style={labelStyle}>Assets / Files</label>
      <div style={{ border:"1.5px dashed rgba(255,255,255,0.12)", borderRadius:12, padding:"16px 18px", background:"#0f0d0e" }}>
        {/* Existing files */}
        {(form.files || []).length > 0 && (
          <div style={{ marginBottom:12, display:"flex", flexDirection:"column", gap:6 }}>
            {(form.files || []).map(f => (
              <div key={f.path} style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"8px 12px" }}>
                <span style={{ fontSize:16 }}>{isVideo(f) ? "" : isImage(f) ? "" : ""}</span>
                <span style={{ fontSize:12, color:"#f5f5f7", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:500 }}>{f.name}</span>
                <button onClick={() => setPreviewFile(f)} style={{ fontSize:10, color:"#0a84ff", background:"rgba(42,171,255,0.06)", border:"1px solid rgba(10,132,255,0.2)", borderRadius:5, padding:"2px 8px", cursor:"pointer", fontFamily:"Inter, sans-serif", fontWeight:600, whiteSpace:"nowrap" }}> Preview</button>
                <button onClick={() => removeFile(f)} style={{ fontSize:11, color:"#ff453a", background:"none", border:"none", cursor:"pointer", padding:"2px 6px", borderRadius:5, fontFamily:"Inter, sans-serif" }}>Remove</button>
              </div>
            ))}
          </div>
        )}
        {/* Upload button */}
        <input ref={fileRef} type="file" style={{ display:"none" }} onChange={handleUpload}
          accept="video/*,image/*,.pdf,.psd,.ai,.fig" />
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ fontSize:12, fontWeight:600, color:"#f5f5f7", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"8px 16px", cursor:uploading?"not-allowed":"pointer", fontFamily:"Inter, sans-serif" }}>
            {uploading ? "Uploading…" : "+ Upload File"}
          </button>
          {uploadMsg && <span style={{ fontSize:11, color: uploadMsg.startsWith("") ? "#2AABFF" : "#ff453a" }}>{uploadMsg}</span>}
          {!uploadMsg && <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>Video, image, PDF, PSD, Figma</span>}
        </div>
      </div>
    </div>

    {/* SOP Gate */}
    {sopGates.length > 0 && (
      <div style={{ marginBottom:16, background: hardBlocked ? "rgba(255,69,58,0.04)" : hasWarnings ? "rgba(255,159,10,0.04)" : "rgba(48,209,88,0.04)", border:`1px solid ${hardBlocked?"rgba(255,69,58,0.2)":hasWarnings?"rgba(255,159,10,0.2)":"rgba(48,209,88,0.2)"}`, borderRadius:12, padding:"12px 16px" }}>
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color: hardBlocked?"rgba(255,69,58,0.7)":hasWarnings?"rgba(255,159,10,0.7)":"rgba(48,209,88,0.7)", marginBottom:8 }}> SOP Checklist</div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {sopGates.map((g,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:12, flexShrink:0 }}>{g.ok ? "" : g.hard ? "" : ""}</span>
              <span style={{ fontSize:11, color: g.ok ? "rgba(0,0,0,0.5)" : g.hard ? "#ff453a" : "#ff9f0a", fontWeight: g.ok ? 400 : 600, textDecoration: g.ok ? "line-through" : "none" }}>{g.label}</span>
              {!g.ok && <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontStyle:"italic" }}>— {g.fix}</span>}
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Actions */}
    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
      <button onClick={() => { if (!hardBlocked) onSave(form); }} disabled={hardBlocked}
        style={{ flex:1, background: hardBlocked ? "rgba(0,0,0,0.1)" : "#0f0f1a", border:"none", borderRadius:12, color: hardBlocked ? "rgba(0,0,0,0.3)" : "#fff", fontSize:14, fontWeight:600, padding:"14px", cursor: hardBlocked ? "not-allowed" : "pointer", fontFamily:"Inter, sans-serif", letterSpacing:-0.2 }}>
        {hardBlocked ? " Fix required fields" : isNew ? "Add Content" : "Save Changes"}
      </button>
      <button onClick={onClose} style={{ padding:"14px 22px", background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontSize:14, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>Cancel</button>
      {!isNew && onDuplicate && <button onClick={() => onDuplicate(form)} title="Duplicate this item" style={{ padding:"14px 16px", background:"none", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12, color:"rgba(255,255,255,0.55)", fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", fontWeight:500, flexShrink:0 }}> Dupe</button>}
      {!isNew && onDelete && <button onClick={() => onDelete(form.id)} style={{ padding:"14px 18px", background:"none", border:"1px solid rgba(255,69,58,0.25)", borderRadius:12, color:"rgba(255,69,58,0.7)", fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", fontWeight:500, flexShrink:0 }}></button>}
    </div>
  </div>

  {/* File Preview Overlay */}
  {previewFile && (
    <div onClick={() => setPreviewFile(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"rgba(255,255,255,0.05)", borderRadius:16, overflow:"hidden", maxWidth:"90vw", maxHeight:"90vh", width:"100%", display:"flex", flexDirection:"column", position:"relative" }}>
        <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#f5f5f7" }}>{previewFile.name}</span>
          <button onClick={() => setPreviewFile(null)} style={{ background:"rgba(255,255,255,0.05)", border:"none", borderRadius:8, width:28, height:28, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}></button>
        </div>
        <div style={{ flex:1, overflow:"auto", display:"flex", alignItems:"center", justifyContent:"center", minHeight:300, background:"#161414" }}>
          {isImage(previewFile) ? (
            <img src={previewFile.url} alt={previewFile.name} style={{ maxWidth:"100%", maxHeight:"80vh", objectFit:"contain" }} />
          ) : isVideo(previewFile) ? (
            <video src={previewFile.url} controls style={{ maxWidth:"100%", maxHeight:"80vh" }} />
          ) : (
            <iframe src={getPreviewUrl(previewFile)} style={{ width:"100%", height:"75vh", border:"none" }} title={previewFile.name} allow="autoplay" />
          )}
        </div>
      </div>
    </div>
  )}
</div>
  );
}
