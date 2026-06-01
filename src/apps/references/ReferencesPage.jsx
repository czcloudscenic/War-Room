import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import { PILLARS_LIST } from '../../utils/constants.js';
import Card from '../../ui/shared/Card.jsx';

const REF_TYPES = ["Hook", "Caption", "CTA", "Brand Voice", "Campaign Brief", "Script Sample"];
const INITIAL_REFS = [];

export default function ReferencesPage() {
  const isMobile = useIsMobile();
  const [refs, setRefs] = useState(() => {
try { const saved = JSON.parse(localStorage.getItem("vantus_refs") || "null"); return saved && saved.length > 0 ? saved : INITIAL_REFS; } catch { return INITIAL_REFS; }
  });
  useEffect(() => { try { localStorage.setItem("vantus_refs", JSON.stringify(refs)); } catch {} }, [refs]);
  const [expanded, setExpanded] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title:"", type:"Hook", pillar:"Education", platform:"IG", content:"", notes:"" });
  const setF = (k,v) => setForm(f => ({ ...f, [k]:v }));
  const TYPE_COLOR = { "Hook":"#3b82f6", "Caption":"#10b981", "CTA":"#f59e0b", "Brand Voice":"#8b5cf6", "Campaign Brief":"#ff375f", "Script Sample":"#2AABFF" };
  const TYPE_ICON = { "Hook":"", "Caption":"", "CTA":"", "Brand Voice":"", "Campaign Brief":"", "Script Sample":"" };
  const labelStyle = { fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.5)", marginBottom:5, display:"block" };
  const inp = { width:"100%", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#f5f5f7", outline:"none", fontFamily:"Inter, sans-serif", background:"rgba(255,255,255,0.05)", boxSizing:"border-box" };

  const saveRef = () => {
if (!form.title.trim() || !form.content.trim()) return;
setRefs(prev => [...prev, { ...form, id:`ref-${Date.now()}` }]);
setForm({ title:"", type:"Hook", pillar:"Education", platform:"IG", content:"", notes:"" });
setAdding(false);
  };

  return (
<div style={{ animation:"fadeIn 0.4s ease" }}>
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
    <div>
      <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 24 : 32, fontWeight:700, color:"#f5f5f7", marginBottom:4, letterSpacing:-1 }}>References</h1>
      <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", margin:0 }}>Drop campaign examples, hooks, captions, and brand voice notes here. Muse reads from this folder.</p>
    </div>
    <button onClick={() => setAdding(true)} style={{ background:"#0f0f1a", border:"none", borderRadius:12, color:"#fff", fontSize:13, fontWeight:600, padding:"10px 20px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}>+ Add Reference</button>
  </div>

  <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
    {REF_TYPES.map(t => { const c=TYPE_COLOR[t]; const n=refs.filter(r=>r.type===t).length; return (
      <span key={t} style={{ fontSize:10, color:"rgba(255,255,255,0.6)", background:"rgba(255,255,255,0.06)", padding:"4px 12px", borderRadius:20, fontWeight:600, border:"1px solid rgba(255,255,255,0.1)" }}>{t}{n>0?` · ${n}`:""}</span>
    );})}
  </div>

  {adding && (
    <Card style={{ padding:"28px", marginBottom:24, border:"1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h3 style={{ fontSize:15, fontWeight:600, color:"#f5f5f7", margin:0 }}>New Reference</h3>
        <button onClick={() => setAdding(false)} style={{ background:"none", border:"none", fontSize:18, color:"rgba(255,255,255,0.35)", cursor:"pointer" }}></button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:12, marginBottom:14 }}>
        <div><label style={labelStyle}>Title</label><input style={inp} value={form.title} onChange={e=>setF("title",e.target.value)} placeholder="e.g. Money Moves — Hook Bank" /></div>
        <div><label style={labelStyle}>Type</label><select style={{ ...inp, appearance:"none", cursor:"pointer" }} value={form.type} onChange={e=>setF("type",e.target.value)}>{REF_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div><label style={labelStyle}>Pillar</label><select style={{ ...inp, appearance:"none", cursor:"pointer" }} value={form.pillar} onChange={e=>setF("pillar",e.target.value)}>{PILLARS_LIST.map(p=><option key={p}>{p}</option>)}</select></div>
        <div><label style={labelStyle}>Platform</label><input style={inp} value={form.platform} onChange={e=>setF("platform",e.target.value)} placeholder="IG, TT, All..." /></div>
      </div>
      <div style={{ marginBottom:12 }}><label style={labelStyle}>Content</label><textarea style={{ ...inp, minHeight:140, resize:"vertical", lineHeight:1.7 }} value={form.content} onChange={e=>setF("content",e.target.value)} placeholder="Paste hooks, captions, brand voice notes, campaign brief, or script samples here..." /></div>
      <div style={{ marginBottom:20 }}><label style={labelStyle}>Agent Notes</label><textarea style={{ ...inp, minHeight:56, resize:"vertical", lineHeight:1.6 }} value={form.notes} onChange={e=>setF("notes",e.target.value)} placeholder="Context for Muse on how to use this reference..." /></div>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={saveRef} style={{ background:"#0f0f1a", border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:600, padding:"11px 24px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}>Save</button>
        <button onClick={() => setAdding(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>Cancel</button>
      </div>
    </Card>
  )}

  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
    {refs.map(ref => {
      const c = TYPE_COLOR[ref.type]||"#999"; const isOpen = expanded===ref.id;
      return (
        <Card key={ref.id} style={{ overflow:"hidden", border:isOpen?"1px solid rgba(0,0,0,0.12)":"1px solid rgba(0,0,0,0.07)" }}>
          <div onClick={() => setExpanded(isOpen?null:ref.id)} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 20px", cursor:"pointer" }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${c}12`, border:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:14 }}>{TYPE_ICON[ref.type]}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:"#f5f5f7", letterSpacing:-0.2, marginBottom:4 }}>{ref.title}</div>
              <div style={{ display:"flex", gap:6 }}>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.6)", background:"rgba(255,255,255,0.06)", padding:"2px 8px", borderRadius:20, fontWeight:600 }}>{ref.type}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.05)", padding:"2px 8px", borderRadius:20 }}>{ref.pillar}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.05)", padding:"2px 8px", borderRadius:20 }}>{ref.platform}</span>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={e=>{e.stopPropagation();setRefs(prev=>prev.filter(r=>r.id!==ref.id));}} style={{ background:"none", border:"none", fontSize:11, color:"rgba(255,255,255,0.4)", cursor:"pointer", padding:"4px 8px", borderRadius:6 }}>Delete</button>
              <span style={{ fontSize:13, color:"rgba(255,255,255,0.4)", transform:isOpen?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s", display:"inline-block" }}></span>
            </div>
          </div>
          {isOpen && (
            <div style={{ padding:"0 20px 20px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>Content</div>
                <div style={{ background:"#0f0d0e", borderRadius:10, padding:"14px 16px", fontSize:12, color:"rgba(255,255,255,0.6)", lineHeight:1.8, whiteSpace:"pre-wrap", border:"1px solid rgba(255,255,255,0.05)" }}>{ref.content}</div>
              </div>
              {ref.notes && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>Agent Notes</div>
                  <div style={{ background:`${c}08`, borderRadius:10, padding:"12px 14px", fontSize:11, color:`${c}cc`, lineHeight:1.6, border:`1px solid ${c}20` }}>{ref.notes}</div>
                </div>
              )}
            </div>
          )}
        </Card>
      );
    })}
  </div>
</div>
  );
}
