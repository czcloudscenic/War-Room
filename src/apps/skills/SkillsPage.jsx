import React, { useState } from 'react';
import Card from '../../ui/shared/Card.jsx';

export default function SkillsPage({ agents }) {
  const AGENT_COLORS = { Sean:"#2AABFF", Lacey:"#ff9f0a", Ali:"#0a84ff", Sam:"#ffd60a", Artgrid:"#2AABFF", Muse:"#ff375f", Overseer:"#64d2ff", Scrappy:"#5e5ce6" };
  const [briefs, setBriefs] = useState(() => {
try { return JSON.parse(localStorage.getItem("vantus_skill_briefs") || "[]"); } catch { return []; }
  });
  const [form, setForm] = useState({ title:"", desc:"", content:"", target:"All Agents" });
  const [expanded, setExpanded] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [deployedId, setDeployedId] = useState(null);
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = { width:"100%", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"rgba(255,255,255,0.85)", outline:"none", fontFamily:"Inter, sans-serif", background:"#0f0d0e", boxSizing:"border-box" };
  const targetColor = form.target === "All Agents" ? "#2AABFF" : (AGENT_COLORS[form.target] || "#2AABFF");
  const TARGETS = ["All Agents", ...agents.map(a => a.name)];

  const deploy = () => {
if (!form.title.trim() || !form.content.trim() || deploying) return;
setDeploying(true);
setTimeout(() => {
  const brief = { id:`brief-${Date.now()}`, ...form, ts:Date.now() };
  const updated = [brief, ...briefs];
  setBriefs(updated);
  try { localStorage.setItem("vantus_skill_briefs", JSON.stringify(updated.slice(0,50))); } catch {}
  setDeployedId(brief.id);
  setForm({ title:"", desc:"", content:"", target:"All Agents" });
  setDeploying(false);
  setTimeout(() => setDeployedId(null), 4000);
}, 1000);
  };

  const deleteBrief = (id) => {
const updated = briefs.filter(b => b.id !== id);
setBriefs(updated);
try { localStorage.setItem("vantus_skill_briefs", JSON.stringify(updated)); } catch {}
  };

  return (
<div style={{ animation:"fadeIn 0.4s ease" }}>
  {/* Header */}
  <div style={{ marginBottom:32 }}>
    <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:32, fontWeight:700, color:"#f5f5f7", marginBottom:4, letterSpacing:-1 }}>Agent Skills</h1>
    <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", margin:0 }}>Write a skill brief and deploy it to a specific agent or broadcast to all 8. Agents receive it as a capability update.</p>
  </div>

  {/*  BRIEF BUILDER  */}
  <Card style={{ padding:"28px 32px", marginBottom:32 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22, flexWrap:"wrap", gap:14 }}>
      <div>
        <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:22, fontWeight:400, fontStyle:"italic", color:"#ffffff", margin:0, letterSpacing:-0.5 }}>Brief Builder</h2>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:4 }}>Define a skill and deploy it as a capability update</div>
      </div>
      {/* Target selector */}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)", fontWeight:600, letterSpacing:0.5, whiteSpace:"nowrap" }}>Deploy to:</span>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {TARGETS.map(t => {
            const active = form.target === t;
            const tc = t === "All Agents" ? "#2AABFF" : (AGENT_COLORS[t] || "#2AABFF");
            return (
              <button key={t} onClick={() => setF("target", t)} className="glass-btn"
                style={{ fontSize:10, fontWeight:600, color: active ? "#fff" : tc, background: active ? tc : `${tc}12`, border:`1px solid ${tc}30`, borderRadius:20, padding:"5px 13px", cursor:"pointer", fontFamily:"Inter,sans-serif", transition:"all 0.15s" }}>
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>

    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
      <div>
        <label style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.35)", marginBottom:6, display:"block" }}>Skill Name</label>
        <input style={inp} value={form.title} onChange={e=>setF("title",e.target.value)} placeholder="e.g. Tierra Bomba Context, Hook Mastery v2" />
      </div>
      <div>
        <label style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.35)", marginBottom:6, display:"block" }}>Short Description</label>
        <input style={inp} value={form.desc} onChange={e=>setF("desc",e.target.value)} placeholder="What does this skill enable the agent to do?" />
      </div>
    </div>

    <div style={{ marginBottom:22 }}>
      <label style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.35)", marginBottom:6, display:"block" }}>Skill Content / Instructions</label>
      <textarea style={{ ...inp, minHeight:160, resize:"vertical", lineHeight:1.75 }}
        value={form.content} onChange={e=>setF("content",e.target.value)}
        placeholder={"Write the full skill brief here — context, rules, examples, and constraints.\n\nAgents will use this as a hardware update when you deploy.\n\nExample:\n• Tierra Bomba is an island off Cartagena, Colombia\n• Community partner: Amigos del Mar\n• Tone for this pillar: documentary, grounded, human\n• Always open with geography before introducing the mission"} />
    </div>

    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
      <button onClick={deploy} disabled={deploying || !form.title.trim() || !form.content.trim()} className="glass-btn"
        style={{ background: (form.title.trim() && form.content.trim()) ? targetColor : "rgba(255,255,255,0.05)", border:"none", borderRadius:12, color: (form.title.trim() && form.content.trim()) ? "#fff" : "rgba(255,255,255,0.25)", padding:"12px 28px", fontSize:13, fontWeight:700, cursor:(form.title.trim()&&form.content.trim()&&!deploying)?"pointer":"default", fontFamily:"Inter,sans-serif", display:"flex", alignItems:"center", gap:8 }}>
        {deploying
          ? <><div style={{ width:7,height:7,borderRadius:"50%",background:"#fff",animation:"livePulse 1s infinite" }} />Deploying…</>
          : ` Deploy to ${form.target}`}
      </button>
      {deployedId && (
        <span style={{ fontSize:12, color:"#2AABFF", fontWeight:600, animation:"fadeIn 0.3s ease" }}>
           Brief deployed to {briefs[0]?.target}
        </span>
      )}
    </div>
  </Card>

  {/*  DEPLOYED BRIEFS LOG  */}
  {briefs.length > 0 ? (
    <div>
      <h2 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:22, fontWeight:400, fontStyle:"italic", color:"#ffffff", margin:"0 0 18px", letterSpacing:-0.5 }}>Deployed Briefs</h2>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {briefs.map(brief => {
          const tc = brief.target === "All Agents" ? "#2AABFF" : (AGENT_COLORS[brief.target] || "#2AABFF");
          const isOpen = expanded === brief.id;
          const isNew = brief.id === deployedId;
          return (
            <Card key={brief.id} style={{ overflow:"hidden", border: isNew ? `1px solid ${tc}40` : undefined }}>
              <div onClick={() => setExpanded(isOpen?null:brief.id)} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 20px", cursor:"pointer" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${tc}15`, border:`1px solid ${tc}25`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#f5f5f7", marginBottom:4, letterSpacing:-0.2 }}>{brief.title}</div>
                  <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                    <span style={{ fontSize:9, color:tc, background:`${tc}12`, padding:"2px 8px", borderRadius:20, fontWeight:600 }}>{brief.target}</span>
                    {brief.desc && <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{brief.desc}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                  <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)" }}>{new Date(brief.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                  <button onClick={e=>{e.stopPropagation();deleteBrief(brief.id);}} style={{ background:"none", border:"none", fontSize:11, color:"rgba(255,255,255,0.4)", cursor:"pointer", padding:"4px 8px", borderRadius:6 }}>Delete</button>
                  <span style={{ fontSize:13, color:"rgba(255,255,255,0.4)", transform:isOpen?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s", display:"inline-block" }}></span>
                </div>
              </div>
              {isOpen && (
                <div style={{ padding:"0 20px 20px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ marginTop:14, background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"14px 16px", fontSize:12, color:"rgba(255,255,255,0.75)", lineHeight:1.8, whiteSpace:"pre-wrap", border:"1px solid rgba(255,255,255,0.05)", fontFamily:"Inter, sans-serif" }}>{brief.content}</div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  ) : (
    <div style={{ textAlign:"center", padding:"60px 0", opacity:0.35 }}>
      <div style={{ fontSize:48, marginBottom:14 }}></div>
      <div style={{ fontSize:15, fontWeight:600, color:"#f5f5f7", marginBottom:6 }}>No briefs deployed yet</div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>Build your first skill brief above and deploy it to an agent.</div>
    </div>
  )}
</div>
  );
}
