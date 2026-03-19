import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import { sb } from '../../services/supabaseClient.js';
import { VITAL_LYFE_SOP } from '../../data/seed.content.js';

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const CAMPAIGNS = ["Drip Campaign", "Meet the Makers", "Product Launch"];
const STATUS_OPTIONS = ["Ready For Copy Creation","Need Copy Approval","Ready For Content Creation","Need Content Approval","Needs Revisions","Approved","Ready For Schedule","Scheduled","Scrapped"];
const FORMAT_OPTIONS = ["Graphics (IMG)","Carousel (CRS)","Reel (SHT)","Story (STY)","Thread (TXT)","Reddit (RD)"];
const PLATFORM_OPTIONS = ["IG","TT","X","TH","LI","YT","RD","EM"];
const PILLAR_OPTIONS = ["Abundance","Access","Innovation","Tierra Bomba","Startup Diaries","Product Launch","Meet the Makers"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NAV_TABS = [{id:"tracker",label:"Content Tracker"},{id:"pillars",label:"Pillars"},{id:"count",label:"Count Tracker"},{id:"schedule",label:"Schedule Tracker"},{id:"gantt",label:"Gantt Chart"},{id:"taxonomy",label:"Taxonomy Guide"},{id:"sop",label:"SOPs"}];

const STATUS_SORT = {"Need Content Approval":0,"Need Copy Approval":1,"Needs Revisions":2,"Ready For Copy Creation":3,"Ready For Content Creation":4,"Ready For Schedule":5,"Approved":6,"Scheduled":7,"Scrapped":8};
const STATUS_COLORS = {
  "Ready For Copy Creation":    {bg:"#D4882A18",text:"#D4882A",border:"#D4882A30",dot:"#D4882A"},
  "Need Copy Approval":         {bg:"#5566CC18",text:"#7788EE",border:"#5566CC30",dot:"#5566CC"},
  "Ready For Content Creation": {bg:"#2A9A5818",text:"#2A9A58",border:"#2A9A5830",dot:"#2A9A58"},
  "Need Content Approval":      {bg:"#CC333318",text:"#FF5555",border:"#CC333330",dot:"#CC3333"},
  "Needs Revisions":            {bg:"#E0783018",text:"#E07830",border:"#E0783030",dot:"#E07830"},
  "Approved":                   {bg:"#25A86A18",text:"#25A86A",border:"#25A86A30",dot:"#25A86A"},
  "Ready For Schedule":         {bg:"#7B44C218",text:"#9966DD",border:"#7B44C230",dot:"#7B44C2"},
  "Scheduled":                  {bg:"#88888818",text:"rgba(255,255,255,0.5)",border:"#88888830",dot:"#888888"},
  "Scrapped":                   {bg:"#CC333318",text:"#FF5555",border:"#CC333330",dot:"#CC3333"},
};
const CAMPAIGN_ACCENT = {"Drip Campaign":"#2AABFF","Meet the Makers":"rgba(255,255,255,0.5)","Product Launch":"rgba(255,255,255,0.3)"};

// ── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: '#0d0907',
  card: 'rgba(255,255,255,0.04)',
  cardHover: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.05)',
  text: '#fff',
  textBody: 'rgba(255,255,255,0.65)',
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted: 'rgba(255,255,255,0.4)',
  textLabel: 'rgba(255,255,255,0.35)',
  textFaint: 'rgba(255,255,255,0.25)',
  accent: '#2AABFF',
  hover: 'rgba(255,255,255,0.06)',
  inputBg: 'rgba(255,255,255,0.06)',
  shadow: '0 1px 3px rgba(0,0,0,0.3)',
  shadowHover: '0 4px 16px rgba(0,0,0,0.4)',
  shadowDeep: '0 8px 28px rgba(0,0,0,0.5)',
};
const F = {
  heading: "'Instrument Serif', Georgia, serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'Geist Mono', 'SF Mono', monospace",
};

// ── UTILS ────────────────────────────────────────────────────────────────────
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = e => { if (!ref.current || ref.current.contains(e.target)) return; handler(); };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

// Map content item from Supabase schema to tracker schema
function toTracker(item) {
  return {
    ...item,
    platform: item.platforms || [],
    videoCopy: item.script || "",
    format: item.format || "Reel (SHT)",
    campaign: item.campaign || "Drip Campaign",
    status: item.status || "Ready For Copy Creation",
    pillar: item.pillar || "Abundance",
    title: item.title || "",
    description: item.description || "",
    caption: item.caption || "",
    cta: item.cta || "",
    seoKeywords: item.seoKeywords || "",
    hashtags: item.hashtags || "",
    notes: item.notes || "",
    startWeek: item.startWeek || 1,
    duration: item.duration || 1,
  };
}

// Map tracker schema back to Supabase schema
function toSupabase(item) {
  const { platform, videoCopy, ...rest } = item;
  return {
    ...rest,
    platforms: platform || [],
    script: videoCopy || "",
  };
}

// ── BADGE ────────────────────────────────────────────────────────────────────
function Badge({ children, color }) {
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:"20px",fontSize:"10px",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",background:color?.bg||T.hover,color:color?.text||T.textSecondary,border:`1px solid ${color?.border||T.border}`,whiteSpace:"nowrap",fontFamily:F.mono}}>{color?.dot&&<span style={{width:5,height:5,borderRadius:"50%",background:color.dot,flexShrink:0}}/>}{children}</span>;
}

// ── INLINE STATUS DROPDOWN ───────────────────────────────────────────────────
function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const sc = STATUS_COLORS[value]||{};
  return (
    <div ref={ref} style={{position:"relative",display:"inline-block"}}>
      <button onClick={() => setOpen(o=>!o)} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px 4px 8px",borderRadius:"20px",fontSize:"10px",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",background:sc.bg||T.hover,color:sc.text||T.textSecondary,border:`1px solid ${sc.border||T.border}`,whiteSpace:"nowrap",cursor:"pointer",fontFamily:F.mono}}>
        {sc.dot&&<span style={{width:6,height:6,borderRadius:"50%",background:sc.dot,flexShrink:0}}/>}
        {value}
        <span style={{fontSize:7,opacity:0.5,marginLeft:2}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 5px)",left:0,background:T.bg,border:`1px solid ${T.border}`,borderRadius:"10px",boxShadow:T.shadowDeep,zIndex:600,minWidth:220,overflow:"hidden",padding:"4px"}}>
          {STATUS_OPTIONS.map(s=>{
            const c=STATUS_COLORS[s]||{};
            const isActive=s===value;
            return <button key={s} onClick={()=>{onChange(s);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 12px",background:isActive?T.hover:"transparent",border:"none",borderRadius:"7px",cursor:"pointer",fontSize:12,color:T.text,fontFamily:"inherit",textAlign:"left",fontWeight:isActive?700:400,transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background=isActive?T.hover:"transparent"}>
              <span style={{width:8,height:8,borderRadius:"50%",background:c.dot||"#ccc",flexShrink:0}}/>
              {s}
              {isActive&&<span style={{marginLeft:"auto",fontSize:11,color:T.textLabel}}>✓</span>}
            </button>;
          })}
        </div>
      )}
    </div>
  );
}

// ── EXPANDABLE TEXT ──────────────────────────────────────────────────────────
function ExpandableText({ text, maxLen=130, color }) {
  const [exp,setExp]=useState(false);
  if(!text)return null;
  const c = color || T.textSecondary;
  const short=text.length>maxLen;
  return <span style={{color:c,fontSize:12,lineHeight:1.65}}>{exp||!short?text:text.slice(0,maxLen)+"..."}{short&&<button onClick={()=>setExp(e=>!e)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:11,marginLeft:4,padding:0,textDecoration:"underline",fontFamily:"inherit"}}>{exp?"less":"more"}</button>}</span>;
}

// ── QUICK NOTE ───────────────────────────────────────────────────────────────
function QuickNote({ value, onChange }) {
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState(value||"");
  const ref=useRef(null);
  useClickOutside(ref,()=>setOpen(false));
  const hasNote=value&&value.trim().length>0;
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>{setDraft(value||"");setOpen(o=>!o);}} title="Quick note" style={{background:hasNote?"#D4882A18":"none",border:`1px solid ${hasNote?"#D4882A30":T.border}`,borderRadius:"5px",cursor:"pointer",fontSize:11,padding:"3px 8px",color:hasNote?"#D4882A":T.textFaint,display:"flex",alignItems:"center",gap:4,transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.textLabel;e.currentTarget.style.color=T.textSecondary;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=hasNote?"#D4882A30":T.border;e.currentTarget.style.color=hasNote?"#D4882A":T.textFaint;}}>✎{hasNote?" Edit":" Note"}</button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:T.bg,border:`1px solid ${T.border}`,borderRadius:"10px",boxShadow:T.shadowDeep,zIndex:500,width:260,padding:14}}>
          <div style={{fontSize:9,color:T.textLabel,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,marginBottom:7,fontFamily:F.mono}}>Quick Note</div>
          <textarea value={draft} onChange={e=>setDraft(e.target.value)} style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:"6px",color:T.text,padding:"8px 10px",fontSize:12,outline:"none",resize:"vertical",minHeight:72,fontFamily:"inherit",boxSizing:"border-box"}} placeholder="Add a note..." autoFocus/>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <button onClick={()=>{onChange(draft);setOpen(false);}} style={{flex:1,padding:"7px",background:T.accent,border:"none",borderRadius:"6px",color:"#FFF",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Save</button>
            <button onClick={()=>setOpen(false)} style={{padding:"7px 10px",background:"none",border:`1px solid ${T.border}`,borderRadius:"6px",color:T.textMuted,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── IDEA CARD ────────────────────────────────────────────────────────────────
function IdeaCard({ idea, onEdit, onDelete, onUpdate }) {
  const [showCopy,setShowCopy]=useState(false);
  const cc=CAMPAIGN_ACCENT[idea.campaign]||T.textMuted;
  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow,transition:"box-shadow 0.2s,border-color 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow=T.shadowHover;e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow=T.shadow;e.currentTarget.style.borderColor=T.border;}}>
      <div style={{height:3,background:cc}}/>
      <div style={{padding:"15px 16px"}}>
        <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
          <StatusDropdown value={idea.status} onChange={s=>onUpdate({...idea,status:s})}/>
          <Badge color={{bg:T.hover,text:T.textSecondary,border:T.border}}>{(idea.format||"").split(" ")[0]}</Badge>
          {(idea.platform||[]).map(p=><Badge key={p} color={{bg:"rgba(255,255,255,0.03)",text:T.textMuted,border:T.border}}>{p}</Badge>)}
          <span style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center"}}>
            <QuickNote value={idea.notes} onChange={n=>onUpdate({...idea,notes:n})}/>
            <button onClick={()=>onEdit(idea)} style={{background:T.hover,border:`1px solid ${T.border}`,color:T.textSecondary,cursor:"pointer",fontSize:11,padding:"3px 10px",borderRadius:"4px",fontFamily:"inherit",fontWeight:500}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background=T.hover}>Edit</button>
            <button onClick={()=>onDelete(idea.id)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:14,padding:"3px 5px",borderRadius:"4px",transition:"color 0.15s"}} onMouseEnter={e=>e.currentTarget.style.color="#CC3333"} onMouseLeave={e=>e.currentTarget.style.color=T.textFaint}>✕</button>
          </span>
        </div>
        <div style={{fontFamily:F.heading,fontSize:15,color:T.text,fontStyle:"italic",marginBottom:10,lineHeight:1.3}}>{idea.title}</div>
        {idea.description&&(<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.borderLight}`,borderRadius:"6px",padding:"9px 12px",marginBottom:10}}><div style={{fontSize:9,color:T.textLabel,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4,fontWeight:700,fontFamily:F.mono}}>Description</div><ExpandableText text={idea.description} maxLen={140} color={T.textBody}/></div>)}
        {idea.videoCopy&&(<div style={{marginBottom:8}}><button onClick={()=>setShowCopy(s=>!s)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:10,padding:0,letterSpacing:"0.08em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.color=T.textSecondary} onMouseLeave={e=>e.currentTarget.style.color=T.textFaint}><span style={{fontSize:8}}>{showCopy?"▼":"▶"}</span>{(idea.format||"").includes("Thread")?"Thread Copy":"Video Copy"}</button>{showCopy&&<div style={{marginTop:6,background:T.hover,border:`1px solid ${T.border}`,borderRadius:"5px",padding:"9px 12px",fontSize:11,color:T.textSecondary,lineHeight:1.75,whiteSpace:"pre-wrap",fontFamily:F.mono}}>{idea.videoCopy}</div>}</div>)}
        {idea.caption&&(<div style={{marginBottom:7}}><div style={{fontSize:9,color:T.textFaint,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3,fontWeight:700,fontFamily:F.mono}}>Caption</div><ExpandableText text={idea.caption} maxLen={90} color={T.textSecondary}/></div>)}
        {idea.cta&&<div style={{marginBottom:6,fontSize:11,color:T.textMuted}}><span style={{fontWeight:700,color:T.textSecondary,marginRight:4}}>CTA:</span>{idea.cta}</div>}
        {idea.hashtags&&<div style={{fontSize:10,color:T.textFaint,marginBottom:idea.notes?7:0,wordBreak:"break-word",lineHeight:1.5}}>{idea.hashtags}</div>}
        {idea.notes&&<div style={{borderTop:`1px solid ${T.borderLight}`,paddingTop:7,marginTop:7,fontSize:11,color:"#D4882A",fontStyle:"italic"}}>✎ {idea.notes}</div>}
        <div style={{marginTop:9}}><Badge color={{bg:T.hover,text:T.textBody,border:T.border}}>{idea.pillar}</Badge></div>
      </div>
    </div>
  );
}

// ── THE FLOW (AI OVERVIEW) ───────────────────────────────────────────────────
function TheFlow({ ideas }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const generatePulse = async () => {
    setLoading(true); setError(""); setResult("");
    const summary = {
      total: ideas.length,
      byCampaign: ideas.reduce((a,i)=>{a[i.campaign]=(a[i.campaign]||0)+1;return a;},{}),
      byStatus: ideas.reduce((a,i)=>{a[i.status]=(a[i.status]||0)+1;return a;},{}),
      byFormat: ideas.reduce((a,i)=>{const f=(i.format||"").split(" ")[0];a[f]=(a[f]||0)+1;return a;},{}),
      needsAttention: ideas.filter(i=>["Need Content Approval","Need Copy Approval","Needs Revisions"].includes(i.status)).map(i=>i.title),
      approved: ideas.filter(i=>i.status==="Approved").length,
      scheduled: ideas.filter(i=>i.status==="Scheduled").length,
      pillars: [...new Set(ideas.map(i=>i.pillar))],
    };
    try {
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:`You are the creative strategist for Vital Lyfe, a water technology company. Your brand voice is calm, confident, cinematic, and purposeful. You write in clear prose — no bullet lists. Think editorial, not corporate. The internal tracker tool is called "The Flow." Write a brief, energetic overview (3-4 paragraphs) of the current content pipeline state for the team. Be specific about what's moving, what needs attention, and what's looking strong. Sign off with a motivational one-liner that feels on-brand with Vital Lyfe's mission around water, access, and innovation.`,
          messages:[{role:"user",content:`Here is our current content pipeline data:\n\n${JSON.stringify(summary,null,2)}\n\nItems needing attention: ${summary.needsAttention.join(", ")||"none"}\n\nWrite The Flow overview.`}]
        })
      });
      const data = await res.json();
      const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("\n")||"";
      if(text) setResult(text);
      else setError("Could not generate overview. Try again.");
    } catch(e) { setError("Connection error. Please try again."); }
    setLoading(false);
  };

  return (
    <>
      <button onClick={()=>{setOpen(true);if(!result)generatePulse();}} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"rgba(255,255,255,0.08)",border:"none",borderRadius:"7px",color:"#FFF",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.03em",boxShadow:T.shadow,transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.14)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}>
        <span style={{fontSize:14}}>◎</span> The Flow
      </button>
      {open&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:24,backdropFilter:"blur(6px)"}}>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:"16px",width:"100%",maxWidth:620,maxHeight:"85vh",overflowY:"auto",padding:"36px",boxShadow:"0 24px 64px rgba(0,0,0,0.5)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
              <div>
                <div style={{fontFamily:F.heading,fontSize:24,color:T.text,fontStyle:"italic",marginBottom:2}}>◎ The Flow</div>
                <div style={{fontSize:11,color:T.textLabel,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:F.mono}}>AI-Generated Content Overview</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={generatePulse} disabled={loading} style={{padding:"7px 14px",background:T.hover,border:`1px solid ${T.border}`,borderRadius:"6px",color:T.textSecondary,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>↺ Refresh</button>
                <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:22,lineHeight:1}}>✕</button>
              </div>
            </div>
            {loading&&(
              <div style={{textAlign:"center",padding:"40px 20px"}}>
                <div style={{fontSize:28,marginBottom:12,animation:"pulse 1.5s ease-in-out infinite"}}>◎</div>
                <div style={{fontSize:13,color:T.textLabel,fontFamily:F.heading,fontStyle:"italic"}}>Reading the pipeline...</div>
              </div>
            )}
            {error&&<div style={{padding:"16px",background:"#CC333318",border:"1px solid #CC333330",borderRadius:"8px",color:"#FF5555",fontSize:13}}>{error}</div>}
            {result&&(
              <div style={{fontSize:14,color:T.textBody,lineHeight:1.85,fontFamily:F.heading,whiteSpace:"pre-wrap"}}>
                {result}
              </div>
            )}
            <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${T.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:10,color:T.textFaint,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:F.mono}}>Cloud Scenic × Vital Lyfe</span>
              <span style={{fontSize:10,color:T.textFaint,fontFamily:F.mono}}>Powered by Claude AI</span>
            </div>
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
        </div>
      )}
    </>
  );
}

// ── SUMMARY STATS ────────────────────────────────────────────────────────────
function SummaryStats({ ideas, activeFilter, onFilter, onNavigate }) {
  const byCampaign={};
  ideas.forEach(i=>{byCampaign[i.campaign]=(byCampaign[i.campaign]||0)+1;});
  const approved=ideas.filter(i=>i.status==="Approved").length;
  const scrapped=ideas.filter(i=>i.status==="Scrapped").length;
  const statCards=[
    ...Object.entries(byCampaign).map(([name,count])=>({id:name,label:name,count,accent:CAMPAIGN_ACCENT[name]||T.accent})),
    {id:"approved",label:"Approved",count:approved,accent:"#25A86A"},
    {id:"scrapped",label:"Scrapped Content",count:scrapped,accent:"#CC3333"},
  ];
  return(
    <div style={{display:"grid",gridTemplateColumns:`repeat(${statCards.length},1fr)`,gap:12,marginBottom:16}}>
      {statCards.map(({id,label,count,accent})=>{
        const isActive=activeFilter===id;
        return(
          <div key={id} onClick={()=>{
            if(id==="scrapped"){onNavigate("scrapped");}
            else{onFilter(isActive?"All":id);onNavigate("tracker");}
          }}style={{background:isActive?`rgba(42,171,255,0.15)`:T.card,border:`1px solid ${isActive?T.accent+"40":T.border}`,borderRadius:"10px",padding:"15px 18px",borderLeft:`4px solid ${isActive?"transparent":accent}`,boxShadow:isActive?"0 4px 14px rgba(42,171,255,0.15)":T.shadow,cursor:"pointer",transition:"all 0.18s",userSelect:"none"}} onMouseEnter={e=>{if(!isActive){e.currentTarget.style.boxShadow=T.shadowHover;e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";}}} onMouseLeave={e=>{if(!isActive){e.currentTarget.style.boxShadow=T.shadow;e.currentTarget.style.borderColor=T.border;}}}>
            <div style={{fontSize:28,fontWeight:700,color:isActive?T.accent:T.text,fontFamily:F.heading,lineHeight:1}}>{count}</div>
            <div style={{fontSize:10,color:isActive?"rgba(42,171,255,0.7)":T.textLabel,marginTop:4,letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:600,fontFamily:F.mono}}>{label}</div>
            {isActive&&<div style={{fontSize:9,color:T.textFaint,marginTop:2,letterSpacing:"0.04em",fontFamily:F.mono}}>click to clear</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── MODAL ────────────────────────────────────────────────────────────────────
const iSt={width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:"5px",color:T.text,padding:"9px 13px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const lSt={display:"block",fontSize:9,color:T.textLabel,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4,marginTop:16,fontWeight:700,fontFamily:F.mono};

function Modal({ idea, onClose, onSave }) {
  const [form,setForm]=useState(idea||{campaign:CAMPAIGNS[0],status:STATUS_OPTIONS[0],format:FORMAT_OPTIONS[0],platform:["IG"],title:"",description:"",videoCopy:"",caption:"",cta:"",seoKeywords:"",hashtags:"",pillar:PILLAR_OPTIONS[0],notes:"",startWeek:1,duration:1});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const togglePlat=p=>{const arr=form.platform||[];set("platform",arr.includes(p)?arr.filter(x=>x!==p):[...arr,p]);};
  const isThread=(form.format||"").includes("Thread");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24,backdropFilter:"blur(6px)"}}>
      <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:"14px",width:"100%",maxWidth:680,maxHeight:"92vh",overflowY:"auto",padding:"36px",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
          <div style={{fontFamily:F.heading,fontSize:22,color:T.text,fontStyle:"italic"}}>{idea?.id?"Edit Content":"Add New Idea"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:22,lineHeight:1}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div><label style={lSt}>Campaign</label><select value={form.campaign} onChange={e=>set("campaign",e.target.value)} style={iSt}>{CAMPAIGNS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={lSt}>Status</label><select value={form.status} onChange={e=>set("status",e.target.value)} style={iSt}>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div><label style={lSt}>Format</label><select value={form.format} onChange={e=>set("format",e.target.value)} style={iSt}>{FORMAT_OPTIONS.map(f=><option key={f} value={f}>{f}</option>)}</select></div>
          <div><label style={lSt}>Content Pillar</label><select value={form.pillar} onChange={e=>set("pillar",e.target.value)} style={iSt}>{PILLAR_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
        </div>
        <label style={lSt}>Platforms</label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{PLATFORM_OPTIONS.map(p=><button key={p} onClick={()=>togglePlat(p)} style={{padding:"5px 13px",borderRadius:"5px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,background:(form.platform||[]).includes(p)?T.accent:T.hover,border:`1px solid ${(form.platform||[]).includes(p)?T.accent:T.border}`,color:(form.platform||[]).includes(p)?"#FFF":T.textMuted,transition:"all 0.15s"}}>{p}</button>)}</div>
        <label style={lSt}>Content Title</label><input value={form.title} onChange={e=>set("title",e.target.value)} style={iSt} placeholder="e.g. The Source"/>
        <label style={{...lSt,color:T.text}}>Content Description <span style={{fontSize:9,color:T.textFaint,fontWeight:400,textTransform:"none"}}>— What is this content?</span></label>
        <textarea value={form.description} onChange={e=>set("description",e.target.value)} style={{...iSt,minHeight:80,resize:"vertical"}} placeholder="Visuals, tone, narrative arc, purpose..."/>
        <label style={lSt}>{isThread?"Thread Copy":"Video Copy / Script"}</label>
        <textarea value={form.videoCopy} onChange={e=>set("videoCopy",e.target.value)} style={{...iSt,minHeight:90,resize:"vertical",fontFamily:F.mono,fontSize:12}} placeholder={isThread?"1. Tweet one...\n2. Tweet two...":"Opening Scene: ...\nMiddle: ...\nClosing Frame: ..."}/>
        <label style={lSt}>Caption</label><textarea value={form.caption} onChange={e=>set("caption",e.target.value)} style={{...iSt,minHeight:60,resize:"vertical"}} placeholder="Caption copy..."/>
        <label style={lSt}>CTA</label><input value={form.cta} onChange={e=>set("cta",e.target.value)} style={iSt} placeholder="e.g. Join us (Link in bio)"/>
        <label style={lSt}>SEO Keywords</label><input value={form.seoKeywords||""} onChange={e=>set("seoKeywords",e.target.value)} style={iSt} placeholder="water origin, abundance storytelling..."/>
        <label style={lSt}>Hashtags</label><input value={form.hashtags} onChange={e=>set("hashtags",e.target.value)} style={iSt} placeholder="#VitalLyfe #WaterAccess..."/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div><label style={lSt}>Start Week</label><input type="number" min="1" max="12" value={form.startWeek||1} onChange={e=>set("startWeek",parseInt(e.target.value)||1)} style={iSt}/></div>
          <div><label style={lSt}>Duration (weeks)</label><input type="number" min="1" max="8" value={form.duration||1} onChange={e=>set("duration",parseInt(e.target.value)||1)} style={iSt}/></div>
        </div>
        <label style={lSt}>Notes / Direction</label><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} style={{...iSt,minHeight:50,resize:"vertical"}} placeholder="Visual direction, revisions, team notes..."/>
        <div style={{display:"flex",gap:12,marginTop:28}}>
          <button onClick={()=>onSave(form)} style={{flex:1,padding:"13px",background:T.accent,border:"none",borderRadius:"7px",color:"#FFF",fontWeight:700,fontSize:13,cursor:"pointer",letterSpacing:"0.05em",fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.background="#4BBFFF"} onMouseLeave={e=>e.currentTarget.style.background=T.accent}>{idea?.id?"Save Changes":"Add Content"}</button>
          <button onClick={onClose} style={{padding:"13px 22px",background:"none",border:`1px solid ${T.border}`,borderRadius:"7px",color:T.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── PILLARS PAGE ─────────────────────────────────────────────────────────────
const PILLARS_INIT=[
  {name:"Abundance",hashtag:"#VLAD",description:"Cinematic celebration of Earth's water systems. Oceans, rivers, rainfall, and ice. The world isn't short on water; it's short on access.",examples:"Drone coastlines and aerial water systems.\nMacro 'texture' reels (droplets, rainfall, motion).\nVisual contrasts between abundance and reach.",ctas:"Abundance isn't the problem.\nWhat we have is waiting to be unlocked.\nThe story of water starts here.",approved:false},
  {name:"Access",hashtag:"#VLAC",description:"Honest, human stories showing who still lives without drinkable water. From coastlines to off-grid explorers — this pillar shows the reality of access.",examples:"Portrait reels of people living near undrinkable water.\nShort-form stories of resilience and daily survival.\nField-style visuals showing contrast: water everywhere, none to drink.",ctas:"Access changes everything.\nCloser than you think.\nBecause water in sight isn't water in hand.",approved:false},
  {name:"Innovation",hashtag:"#VLIV",description:"Visual metaphors of engineering turning abundance into access. No tech reveals — just form, motion, and human precision.",examples:"Macro or slow-motion shots of water under pressure.\nHands building, testing, or refining systems.\nAbstract flow visuals symbolizing problem-solving.",ctas:"Innovation is how abundance becomes access.\nPrecision is progress.\nBuilt for what the world needs next.",approved:false},
  {name:"Tierra Bomba",hashtag:"#VLTB",description:"Our first real-world mission. In partnership with Amigos del Mar, the team travels to Tierra Bomba, Colombia — an island surrounded by seawater but living without access.",examples:"Documentary-style reels of team and community interactions.\nPortraits of local life and shared moments.\nOn-the-ground photography showing collaboration, learning, and motion.",ctas:"Where innovation meets reality.\nProof in progress.\nThis is what access looks like.",approved:false},
  {name:"Startup Diaries",hashtag:"#VLSD",description:"Behind-the-scenes storytelling from inside Vital Lyfe HQ. People, process, and purpose.",examples:"Day-in-the-life reels of the CEO and team.\nBehind-the-scenes at HQ — sketching, prototyping, testing.\nQuiet moments of focus and craft.",ctas:"This is how innovation is built.\nThe people behind the mission.\nReal work. Real water.",approved:false},
];
function PillarsPage(){
  const [pillars,setPillars]=useState(PILLARS_INIT);
  const [editIdx,setEditIdx]=useState(null);
  const [editForm,setEditForm]=useState(null);
  const [addMode,setAddMode]=useState(false);
  const [newP,setNewP]=useState({name:"",hashtag:"",description:"",examples:"",ctas:"",approved:false});
  const toggle=i=>setPillars(ps=>ps.map((p,idx)=>idx===i?{...p,approved:!p.approved}:p));
  const startEdit=i=>{setEditIdx(i);setEditForm({...pillars[i]});};
  const saveEdit=()=>{setPillars(ps=>ps.map((p,i)=>i===editIdx?editForm:p));setEditIdx(null);};
  const del=i=>{if(window.confirm("Delete this pillar?"))setPillars(ps=>ps.filter((_,idx)=>idx!==i));};
  const addRow=()=>{if(!newP.name.trim())return;setPillars(ps=>[...ps,{...newP}]);setNewP({name:"",hashtag:"",description:"",examples:"",ctas:"",approved:false});setAddMode(false);};
  const thS={padding:"10px 16px",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textLabel,background:T.hover,borderBottom:`1px solid ${T.border}`,textAlign:"left",fontFamily:F.mono};
  const tdS={padding:"12px 16px",fontSize:12,color:T.textBody,lineHeight:1.65,borderBottom:`1px solid ${T.borderLight}`,verticalAlign:"top"};
  const fS={width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:"4px",color:T.text,padding:"6px 9px",fontSize:11,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  return(
    <div style={{padding:"20px 0 60px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
        <div><div style={{fontFamily:F.heading,fontSize:20,fontStyle:"italic",color:T.text,marginBottom:2}}>Content Pillars</div><div style={{fontSize:11,color:T.textLabel}}>The narrative foundations for all Vital Lyfe content.</div></div>
        <button onClick={()=>setAddMode(true)} style={{padding:"7px 16px",background:T.accent,border:"none",borderRadius:"7px",color:"#FFF",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>+ Add Pillar</button>
      </div>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><th style={{...thS,width:120}}>Pillar</th><th style={thS}>Description</th><th style={thS}>Content Examples</th><th style={thS}>CTA Examples</th><th style={{...thS,width:80,textAlign:"center"}}>Hashtag</th><th style={{...thS,width:80,textAlign:"center"}}>Approved</th><th style={{...thS,width:90,textAlign:"center"}}>Actions</th></tr></thead>
          <tbody>
            {pillars.map((p,i)=>(
              <tr key={i} onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {editIdx===i?(<>
                  <td style={tdS}><input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} style={fS}/></td>
                  <td style={tdS}><textarea value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} style={{...fS,minHeight:65,resize:"vertical"}}/></td>
                  <td style={tdS}><textarea value={editForm.examples} onChange={e=>setEditForm(f=>({...f,examples:e.target.value}))} style={{...fS,minHeight:65,resize:"vertical"}}/></td>
                  <td style={tdS}><textarea value={editForm.ctas} onChange={e=>setEditForm(f=>({...f,ctas:e.target.value}))} style={{...fS,minHeight:65,resize:"vertical"}}/></td>
                  <td style={tdS}><input value={editForm.hashtag} onChange={e=>setEditForm(f=>({...f,hashtag:e.target.value}))} style={fS}/></td>
                  <td style={{...tdS,textAlign:"center"}}><button onClick={()=>toggle(i)} style={{width:20,height:20,borderRadius:"4px",cursor:"pointer",border:`1px solid ${T.border}`,background:p.approved?T.accent:"transparent"}}>{p.approved&&<span style={{color:"#FFF",fontSize:11,lineHeight:1}}>✓</span>}</button></td>
                  <td style={{...tdS,textAlign:"center"}}><div style={{display:"flex",gap:4,justifyContent:"center"}}><button onClick={saveEdit} style={{padding:"4px 9px",background:T.accent,border:"none",borderRadius:"4px",color:"#FFF",fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Save</button><button onClick={()=>setEditIdx(null)} style={{padding:"4px 7px",background:"none",border:`1px solid ${T.border}`,borderRadius:"4px",color:T.textMuted,fontSize:10,cursor:"pointer"}}>✕</button></div></td>
                </>):(<>
                  <td style={{...tdS,fontWeight:700,color:T.text,fontSize:13}}>{p.name}</td>
                  <td style={tdS}>{p.description}</td>
                  <td style={{...tdS,whiteSpace:"pre-line"}}>{p.examples}</td>
                  <td style={{...tdS,whiteSpace:"pre-line",fontStyle:"italic",color:T.textSecondary}}>{p.ctas}</td>
                  <td style={{...tdS,textAlign:"center"}}><span style={{background:T.hover,border:`1px solid ${T.border}`,borderRadius:"4px",padding:"3px 7px",fontSize:10,fontWeight:700,color:T.textBody,fontFamily:F.mono}}>{p.hashtag}</span></td>
                  <td style={{...tdS,textAlign:"center"}}><button onClick={()=>toggle(i)} style={{width:20,height:20,borderRadius:"4px",cursor:"pointer",border:`1px solid ${T.border}`,background:p.approved?T.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>{p.approved&&<span style={{color:"#FFF",fontSize:11,lineHeight:1}}>✓</span>}</button></td>
                  <td style={{...tdS,textAlign:"center"}}><div style={{display:"flex",gap:4,justifyContent:"center"}}><button onClick={()=>startEdit(i)} style={{padding:"4px 9px",background:T.hover,border:`1px solid ${T.border}`,borderRadius:"4px",color:T.textSecondary,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Edit</button><button onClick={()=>del(i)} style={{padding:"4px 7px",background:"none",border:"none",color:T.textFaint,fontSize:12,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.color="#CC3333"} onMouseLeave={e=>e.currentTarget.style.color=T.textFaint}>✕</button></div></td>
                </>)}
              </tr>
            ))}
            {addMode&&(<tr style={{background:"rgba(42,171,255,0.05)"}}>
              <td style={tdS}><input value={newP.name} onChange={e=>setNewP(f=>({...f,name:e.target.value}))} style={fS} placeholder="Pillar name"/></td>
              <td style={tdS}><textarea value={newP.description} onChange={e=>setNewP(f=>({...f,description:e.target.value}))} style={{...fS,minHeight:55,resize:"vertical"}} placeholder="Description..."/></td>
              <td style={tdS}><textarea value={newP.examples} onChange={e=>setNewP(f=>({...f,examples:e.target.value}))} style={{...fS,minHeight:55,resize:"vertical"}} placeholder="Content examples..."/></td>
              <td style={tdS}><textarea value={newP.ctas} onChange={e=>setNewP(f=>({...f,ctas:e.target.value}))} style={{...fS,minHeight:55,resize:"vertical"}} placeholder="CTA examples..."/></td>
              <td style={tdS}><input value={newP.hashtag} onChange={e=>setNewP(f=>({...f,hashtag:e.target.value}))} style={fS} placeholder="#HASH"/></td>
              <td style={{...tdS,textAlign:"center"}}>—</td>
              <td style={{...tdS,textAlign:"center"}}><div style={{display:"flex",gap:4,justifyContent:"center"}}><button onClick={addRow} style={{padding:"4px 9px",background:T.accent,border:"none",borderRadius:"4px",color:"#FFF",fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Add</button><button onClick={()=>setAddMode(false)} style={{padding:"4px 7px",background:"none",border:`1px solid ${T.border}`,borderRadius:"4px",color:T.textMuted,fontSize:10,cursor:"pointer"}}>✕</button></div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── COUNT TRACKER ────────────────────────────────────────────────────────────
function CountTrackerPage({ideas}){
  const campaigns=["Drip Campaign","Tierra Bomba","Meet the Makers","Product Launch"];
  const formats=["Graphics","Carousels","Reels","Stories","Threads","Reddit"];
  const statuses=STATUS_OPTIONS;
  const getCount=(campaign,format,status)=>ideas.filter(i=>{
    const mc=i.campaign===campaign||(campaign==="Tierra Bomba"&&i.pillar==="Tierra Bomba");
    const mf=(i.format||"").toLowerCase().includes(format.toLowerCase().replace("carousels","carousel").replace("reels","reel").replace("graphics","graphic").replace("stories","story").replace("threads","thread").replace("reddit","reddit"));
    return mc&&mf&&i.status===status;
  }).length;
  const thS={padding:"8px 12px",fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:T.textLabel,background:T.hover,borderBottom:`1px solid ${T.border}`,textAlign:"center",whiteSpace:"nowrap",fontFamily:F.mono};
  const tdS={padding:"9px 12px",fontSize:12,color:T.textBody,borderBottom:`1px solid ${T.borderLight}`,textAlign:"center"};
  return(
    <div style={{padding:"20px 0 60px"}}>
      <div style={{marginBottom:18}}><div style={{fontFamily:F.heading,fontSize:20,fontStyle:"italic",color:T.text,marginBottom:2}}>Count Tracker</div><div style={{fontSize:11,color:T.textLabel}}>Live count by campaign, format, and status.</div></div>
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        {campaigns.map(campaign=>{
          const ci=ideas.filter(i=>i.campaign===campaign);
          return(<div key={campaign} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow}}>
            <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:9}}><div style={{width:7,height:7,borderRadius:"50%",background:CAMPAIGN_ACCENT[campaign]||T.textMuted}}/><span style={{fontWeight:700,fontSize:12,color:T.text}}>{campaign}</span><span style={{fontSize:11,color:T.textFaint,marginLeft:4}}>{ci.length} total</span></div>
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
              <thead><tr><th style={{...thS,textAlign:"left",width:100}}>Type</th>{statuses.map(s=><th key={s} style={thS}>{s.length>14?s.slice(0,14)+"...":s}</th>)}<th style={{...thS,background:"rgba(255,255,255,0.08)"}}>Total</th></tr></thead>
              <tbody>{formats.map(format=>{
                const counts=statuses.map(s=>getCount(campaign,format,s));
                const total=counts.reduce((a,b)=>a+b,0);
                return(<tr key={format} onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><td style={{...tdS,textAlign:"left",fontWeight:600,color:T.textBody}}>{format}</td>{counts.map((c,i)=><td key={i} style={{...tdS,color:c>0?T.text:T.textFaint,fontWeight:c>0?700:400}}>{c}</td>)}<td style={{...tdS,fontWeight:700,color:T.text,background:T.hover}}>{total}</td></tr>);
              })}</tbody>
            </table></div>
          </div>);
        })}
      </div>
    </div>
  );
}

// ── SCHEDULE TRACKER ─────────────────────────────────────────────────────────
const CAL_DAYS=["S","M","T","W","Th","F","S"];
const CAL_MONTHS_FULL=["January","February","March","April","May","June","July","August","September","October","November","December"];
const SOCIAL_LINKS=[
  {label:"Instagram",icon:"📷",url:"https://instagram.com"},
  {label:"TikTok",icon:"🎵",url:"https://tiktok.com"},
  {label:"X / Twitter",icon:"✕",url:"https://x.com"},
  {label:"Threads",icon:"@",url:"https://threads.net"},
  {label:"LinkedIn",icon:"in",url:"https://linkedin.com"},
  {label:"YouTube",icon:"▶",url:"https://youtube.com"},
];
function ScheduleTrackerPage({ideas, jumpMonth}){
  const today=new Date();
  const [month,setMonth]=useState(jumpMonth??today.getMonth());
  const [year,setYear]=useState(today.getFullYear());

  useEffect(()=>{
    if(jumpMonth!=null){
      setMonth(jumpMonth);
      const currentMonth = today.getMonth();
      if(jumpMonth < currentMonth) setYear(today.getFullYear()+1);
      else setYear(today.getFullYear());
    }
  },[jumpMonth]);
  const firstDay=new Date(year,month,1).getDay();
  const dim=new Date(year,month+1,0).getDate();
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push(null);
  for(let d=1;d<=dim;d++)cells.push(d);
  while(cells.length%7!==0)cells.push(null);
  const scheduled=ideas.filter(i=>i.status==="Scheduled"||i.status==="Approved");
  const ENG=[{label:"Low",color:"#CC333318",border:"#CC333330"},{label:"Mid",color:"#D4882A18",border:"#D4882A30"},{label:"High",color:"#25A86A18",border:"#25A86A30"}];
  return(
    <div style={{padding:"20px 0 60px"}}>
      <div style={{marginBottom:18}}><div style={{fontFamily:F.heading,fontSize:20,fontStyle:"italic",color:T.text,marginBottom:2}}>Schedule Tracker</div><div style={{fontSize:11,color:T.textLabel}}>Calendar view of approved and scheduled content.</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 240px",gap:18,alignItems:"start"}}>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow}}>
          <div style={{padding:"13px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <button onClick={()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);}} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"5px",padding:"4px 9px",cursor:"pointer",fontSize:12,color:T.textMuted}}>‹</button>
            <span style={{fontFamily:F.heading,fontStyle:"italic",fontSize:16,color:T.text}}>{CAL_MONTHS_FULL[month]} {year}</span>
            <button onClick={()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);}} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"5px",padding:"4px 9px",cursor:"pointer",fontSize:12,color:T.textMuted}}>›</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {CAL_DAYS.map(d=><div key={d} style={{padding:"8px 0",textAlign:"center",fontSize:9,fontWeight:700,color:T.textFaint,letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:`1px solid ${T.borderLight}`,fontFamily:F.mono}}>{d}</div>)}
            {cells.map((d,i)=>{
              const isToday=d===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
              const hc=d&&scheduled.length>0&&(d%3===0||d%5===0);
              return(<div key={i} style={{minHeight:65,padding:"7px 5px",borderBottom:`1px solid ${T.borderLight}`,borderRight:((i+1)%7===0)?"none":`1px solid ${T.borderLight}`,background:d?isToday?"rgba(42,171,255,0.08)":"transparent":"rgba(255,255,255,0.02)"}}>
                {d&&<><div style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:isToday?T.accent:"none",marginBottom:3}}><span style={{fontSize:10,fontWeight:isToday?700:400,color:isToday?"#FFF":T.textBody}}>{d}</span></div>{hc&&<div style={{fontSize:8,background:T.hover,borderRadius:"3px",padding:"2px 4px",color:T.textSecondary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{scheduled[d%scheduled.length]?.title?.slice(0,10)||"Content"}</div>}</>}
              </div>);
            })}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <a href="https://sproutsocial.com" target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",textDecoration:"none",boxShadow:T.shadow,transition:"box-shadow 0.15s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow=T.shadowHover} onMouseLeave={e=>e.currentTarget.style.boxShadow=T.shadow}>
            <div style={{width:32,height:32,background:"#1DB954",borderRadius:"7px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🌱</div>
            <div><div style={{fontWeight:700,fontSize:12,color:T.text}}>Sprout Social</div><div style={{fontSize:10,color:T.textLabel}}>Open Publishing Calendar →</div></div>
          </a>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow}}>
            <div style={{padding:"11px 14px",borderBottom:`1px solid ${T.border}`,fontSize:9,fontWeight:700,color:T.textLabel,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:F.mono}}>Best Post Times</div>
            {[{d:"Mon",t:"5:30 PM"},{d:"Tue",t:"12:00 PM"},{d:"Wed",t:"12:00 PM"},{d:"Thu",t:"12:00 PM"},{d:"Fri",t:"9:00 AM"},{d:"Sat",t:"9:00 AM"},{d:"Sun",t:"9:00 AM"}].map(({d,t})=><div key={d} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px",borderBottom:`1px solid ${T.borderLight}`,fontSize:12}}><span style={{color:T.textBody,fontWeight:500}}>{d}</span><span style={{color:T.textMuted,fontSize:11}}>{t}</span></div>)}
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow}}>
            <div style={{padding:"11px 14px",borderBottom:`1px solid ${T.border}`,fontSize:9,fontWeight:700,color:T.textLabel,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:F.mono}}>Engagement</div>
            {ENG.map(({label,color,border})=><div key={label} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 14px",borderBottom:`1px solid ${T.borderLight}`}}><div style={{width:14,height:14,borderRadius:"3px",background:color,border:`1px solid ${border}`,flexShrink:0}}/><span style={{fontSize:12,color:T.textSecondary}}>{label}</span></div>)}
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow}}>
            <div style={{padding:"11px 14px",borderBottom:`1px solid ${T.border}`,fontSize:9,fontWeight:700,color:T.textLabel,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:F.mono}}>Social Channels</div>
            {SOCIAL_LINKS.map(({label,icon,url})=><a key={label} href={url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderBottom:`1px solid ${T.borderLight}`,textDecoration:"none",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><span style={{width:22,height:22,borderRadius:"5px",background:T.hover,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:T.textBody,flexShrink:0}}>{icon}</span><span style={{fontSize:12,color:T.textBody,fontWeight:500}}>{label}</span><span style={{marginLeft:"auto",fontSize:10,color:T.textFaint}}>→</span></a>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GANTT CHART ──────────────────────────────────────────────────────────────
const GANTT_COLORS={"Drip Campaign":T.accent,"Meet the Makers":"rgba(255,255,255,0.4)","Product Launch":"rgba(255,255,255,0.25)"};
function GanttPage({ideas}){
  const [items,setItems]=useState(ideas.map(i=>({...i})));
  const [loading,setLoading]=useState(false);
  const [aiMsg,setAiMsg]=useState("");
  const totalWeeks=12;
  const weekW=Math.floor(700/totalWeeks);

  const updateItem=(id,key,val)=>setItems(its=>its.map(i=>i.id===id?{...i,[key]:val}:i));

  const generateAI=async()=>{
    setLoading(true);setAiMsg("");
    const summary=ideas.map(i=>({title:i.title,campaign:i.campaign,format:i.format,status:i.status,pillar:i.pillar}));
    try{
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-20250514",max_tokens:800,
        system:`You are a content strategy expert for Vital Lyfe. Suggest an optimal publishing timeline for the content items. Respond ONLY with a valid JSON array, no markdown, no explanation. Each item: {"id": number, "startWeek": number, "duration": number}. startWeek 1-12, duration 1-4. Prioritize: urgency items first, product launch content weeks 5-8, approved drip content spread weeks 1-4, meet the makers weeks 3-6.`,
        messages:[{role:"user",content:`Suggest timeline for these items:\n${JSON.stringify(summary)}`}]
      })});
      const data=await res.json();
      const text=data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"";
      const clean=text.replace(/```json|```/g,"").trim();
      const suggestions=JSON.parse(clean);
      setItems(its=>its.map(i=>{const s=suggestions.find(sg=>sg.id===i.id);return s?{...i,startWeek:s.startWeek,duration:s.duration}:i;}));
      setAiMsg("Timeline updated based on team capacity and industry standards.");
    }catch(e){setAiMsg("Could not generate AI timeline. You can adjust manually below.");}
    setLoading(false);
  };

  const grouped=CAMPAIGNS.reduce((a,c)=>{a[c]=items.filter(i=>i.campaign===c);return a;},{});

  return(
    <div style={{padding:"20px 0 60px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
        <div><div style={{fontFamily:F.heading,fontSize:20,fontStyle:"italic",color:T.text,marginBottom:2}}>Gantt Chart</div><div style={{fontSize:11,color:T.textLabel}}>Visual content timeline. Drag week/duration fields to adjust, or let AI suggest.</div></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {aiMsg&&<span style={{fontSize:11,color:"#25A86A"}}>{aiMsg}</span>}
          <button onClick={generateAI} disabled={loading} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"rgba(255,255,255,0.08)",border:"none",borderRadius:"7px",color:"#FFF",fontWeight:700,fontSize:11,cursor:loading?"wait":"pointer",fontFamily:"inherit",opacity:loading?0.7:1,letterSpacing:"0.03em"}}>
            {loading?"◎ Thinking...":"◎ AI Suggest Timeline"}
          </button>
        </div>
      </div>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow}}>
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,background:T.hover}}>
          <div style={{width:280,flexShrink:0,padding:"9px 16px",fontSize:9,fontWeight:700,color:T.textLabel,letterSpacing:"0.1em",textTransform:"uppercase",borderRight:`1px solid ${T.border}`,fontFamily:F.mono}}>Content</div>
          <div style={{flex:1,display:"flex",overflowX:"auto"}}>
            {Array.from({length:totalWeeks},(_,i)=>(
              <div key={i} style={{minWidth:weekW,textAlign:"center",padding:"9px 2px",fontSize:9,fontWeight:700,color:T.textLabel,letterSpacing:"0.08em",borderRight:i<totalWeeks-1?`1px solid ${T.borderLight}`:"none",fontFamily:F.mono}}>W{i+1}</div>
            ))}
          </div>
          <div style={{width:100,flexShrink:0,padding:"9px 10px",fontSize:9,fontWeight:700,color:T.textLabel,letterSpacing:"0.1em",textTransform:"uppercase",borderLeft:`1px solid ${T.border}`,textAlign:"center",fontFamily:F.mono}}>Adjust</div>
        </div>
        {CAMPAIGNS.map(campaign=>(
          <div key={campaign}>
            <div style={{padding:"8px 16px",background:T.hover,borderBottom:`1px solid ${T.border}`,borderTop:`1px solid ${T.border}`,fontSize:10,fontWeight:700,color:T.textSecondary,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:F.mono}}>{campaign}</div>
            {(grouped[campaign]||[]).map(item=>{
              const sc=Math.max(1,Math.min(item.startWeek||1,totalWeeks));
              const dur=Math.max(1,Math.min(item.duration||1,totalWeeks-sc+1));
              const barLeft=(sc-1)*weekW;
              const barWidth=dur*weekW-4;
              const barColor=GANTT_COLORS[campaign]||T.textMuted;
              const sc2=STATUS_COLORS[item.status]||{};
              return(
                <div key={item.id} style={{display:"flex",borderBottom:`1px solid ${T.borderLight}`,alignItems:"center",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:280,flexShrink:0,padding:"10px 16px",borderRight:`1px solid ${T.borderLight}`}}>
                    <div style={{fontSize:12,color:T.text,fontFamily:F.heading,fontStyle:"italic",marginBottom:3,lineHeight:1.2}}>{item.title}</div>
                    <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:9,padding:"1px 6px",borderRadius:"10px",background:sc2.bg||T.hover,color:sc2.text||T.textSecondary,border:`1px solid ${sc2.border||T.border}`,fontWeight:700,letterSpacing:"0.03em",fontFamily:F.mono}}>{item.status}</span>
                      <span style={{fontSize:9,color:T.textLabel}}>{(item.format||"").split(" ")[0]}</span>
                    </div>
                  </div>
                  <div style={{flex:1,position:"relative",height:44,overflow:"hidden"}}>
                    <div style={{position:"absolute",top:"50%",transform:"translateY(-50%)",left:barLeft+2,width:barWidth,height:22,background:barColor,borderRadius:"4px",display:"flex",alignItems:"center",paddingLeft:8,minWidth:8}}>
                      <span style={{fontSize:9,color:"#FFF",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",opacity:barWidth>40?1:0}}>{(item.title||"").slice(0,20)}</span>
                    </div>
                    {Array.from({length:totalWeeks},(_,i)=><div key={i} style={{position:"absolute",left:i*weekW,top:0,bottom:0,width:weekW,borderRight:i<totalWeeks-1?`1px solid ${T.borderLight}`:"none"}}/>)}
                  </div>
                  <div style={{width:100,flexShrink:0,padding:"6px 10px",borderLeft:`1px solid ${T.borderLight}`,display:"flex",gap:5,alignItems:"center",justifyContent:"center"}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <label style={{fontSize:8,color:T.textLabel,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:F.mono}}>Start</label>
                      <input type="number" min="1" max={totalWeeks} value={sc} onChange={e=>updateItem(item.id,"startWeek",Math.max(1,Math.min(parseInt(e.target.value)||1,totalWeeks)))} style={{width:36,padding:"3px 4px",border:`1px solid ${T.border}`,borderRadius:"4px",fontSize:11,fontWeight:700,color:T.text,textAlign:"center",outline:"none",fontFamily:"inherit",background:T.inputBg}}/>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <label style={{fontSize:8,color:T.textLabel,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:F.mono}}>Wks</label>
                      <input type="number" min="1" max="8" value={dur} onChange={e=>updateItem(item.id,"duration",Math.max(1,Math.min(parseInt(e.target.value)||1,8)))} style={{width:36,padding:"3px 4px",border:`1px solid ${T.border}`,borderRadius:"4px",fontSize:11,fontWeight:700,color:T.text,textAlign:"center",outline:"none",fontFamily:"inherit",background:T.inputBg}}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TAXONOMY PAGE ────────────────────────────────────────────────────────────
const TAX_INIT={
  platform:[{name:"Website / Blog",code:"WEB",notes:"Longform written + owned content"},{name:"YouTube",code:"YT",notes:"Long + short-form motion"},{name:"Instagram",code:"IG",notes:"Reels, feed, stories, live"},{name:"TikTok",code:"TT",notes:"Short-form motion"},{name:"X (Twitter)",code:"X",notes:"Text + short clips"},{name:"Threads",code:"TH",notes:"Text + short motion"},{name:"LinkedIn",code:"LI",notes:"Thought leadership, B2B"},{name:"Reddit",code:"RD",notes:"Community posts"},{name:"Email",code:"EM",notes:"Newsletters, drip, transactional"}],
  format:[{name:"Blog Article",code:"BLG",notes:"Longform written"},{name:"Video (Longform)",code:"VID",notes:"YouTube or hero content"},{name:"Short Video",code:"SHT",notes:"Reels, Shorts, TikTok"},{name:"Static Image",code:"IMG",notes:"Single image posts"},{name:"Carousel",code:"CRS",notes:"Multi-image post"},{name:"Story",code:"STY",notes:"Ephemeral content"},{name:"Live Stream",code:"LIV",notes:"Live broadcast"},{name:"Post (Text)",code:"TXT",notes:"X, Threads, LI copy-led"},{name:"Reddit Post",code:"RD",notes:"Community post, link or text"},{name:"Email",code:"NWS",notes:"Newsletter or campaign send"}],
  type:[{name:"Motion",code:"M",notes:"Video, animation, moving content"},{name:"Static",code:"S",notes:"Still imagery or text-only content"},{name:"Mixed Media",code:"MM",notes:"Mix of media; useful for carousels"}],
  orientation:[{name:"Vertical",code:"VT",notes:"Reels, TikTok, YT Shorts, Stories",ratio:"9:16"},{name:"Square",code:"SQ",notes:"Legacy IG format; useful for ads",ratio:"1:1"},{name:"Landscape",code:"LS",notes:"YouTube, site embeds, hero films",ratio:"16:9"},{name:"Portrait",code:"PT",notes:"IG in-feed; good balance",ratio:"4:5"},{name:"Cinematic",code:"CN",notes:"Rare, but great for campaign hero films",ratio:"21:9"},{name:"Text",code:"TX",notes:"X, Threads, LinkedIn",ratio:"N/A"}],
};
function TaxTable({title,rows:initRows,cols}){
  const [rows,setRows]=useState(initRows);
  const [editIdx,setEditIdx]=useState(null);
  const [editRow,setEditRow]=useState(null);
  const [addMode,setAddMode]=useState(false);
  const [newRow,setNewRow]=useState({});
  const keys=cols.map(c=>c.key);
  const thS={padding:"9px 14px",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textLabel,background:T.hover,borderBottom:`1px solid ${T.border}`,textAlign:"left",fontFamily:F.mono};
  const tdS={padding:"9px 14px",fontSize:12,color:T.textBody,borderBottom:`1px solid ${T.borderLight}`,verticalAlign:"middle"};
  const fS={width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:"3px",color:T.text,padding:"4px 7px",fontSize:11,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const cS={display:"inline-block",background:T.hover,border:`1px solid ${T.border}`,borderRadius:"3px",padding:"2px 6px",fontSize:10,fontWeight:700,color:T.textBody,fontFamily:F.mono};
  const save=()=>{const d=[...rows];d[editIdx]=editRow;setRows(d);setEditIdx(null);};
  const del=i=>setRows(r=>r.filter((_,idx)=>idx!==i));
  const add=()=>{if(!newRow[keys[0]]?.trim())return;setRows(r=>[...r,{...newRow}]);setNewRow({});setAddMode(false);};
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontWeight:700,fontSize:12,color:T.text}}>{title}</span>
        <button onClick={()=>setAddMode(true)} style={{padding:"4px 11px",background:T.hover,border:`1px solid ${T.border}`,borderRadius:"5px",color:T.textSecondary,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>+ Add</button>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{cols.map(c=><th key={c.key} style={thS}>{c.label}</th>)}<th style={{...thS,width:80,textAlign:"center"}}>Actions</th></tr></thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i} onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {editIdx===i?(<>{keys.map(k=><td key={k} style={tdS}><input value={editRow[k]||""} onChange={e=>setEditRow(r=>({...r,[k]:e.target.value}))} style={fS}/></td>)}<td style={{...tdS,textAlign:"center"}}><div style={{display:"flex",gap:3,justifyContent:"center"}}><button onClick={save} style={{padding:"3px 8px",background:T.accent,border:"none",borderRadius:"4px",color:"#FFF",fontSize:9,cursor:"pointer",fontWeight:700}}>Save</button><button onClick={()=>setEditIdx(null)} style={{padding:"3px 6px",background:"none",border:`1px solid ${T.border}`,borderRadius:"4px",color:T.textMuted,fontSize:9,cursor:"pointer"}}>✕</button></div></td></>)
              :(<>{cols.map(c=><td key={c.key} style={tdS}>{c.key==="code"?<span style={cS}>{row[c.key]}</span>:<span style={c.key==="name"?{fontWeight:600,color:T.text}:{}}>{row[c.key]||""}</span>}</td>)}<td style={{...tdS,textAlign:"center"}}><div style={{display:"flex",gap:3,justifyContent:"center"}}><button onClick={()=>{setEditIdx(i);setEditRow({...row});}} style={{padding:"3px 8px",background:T.hover,border:`1px solid ${T.border}`,borderRadius:"4px",color:T.textSecondary,fontSize:9,cursor:"pointer"}}>Edit</button><button onClick={()=>del(i)} style={{padding:"3px 5px",background:"none",border:"none",color:T.textFaint,fontSize:11,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.color="#CC3333"} onMouseLeave={e=>e.currentTarget.style.color=T.textFaint}>✕</button></div></td></>)}
            </tr>
          ))}
          {addMode&&(<tr style={{background:"rgba(42,171,255,0.05)"}}>
            {keys.map(k=><td key={k} style={tdS}><input value={newRow[k]||""} onChange={e=>setNewRow(r=>({...r,[k]:e.target.value}))} style={fS} placeholder={cols.find(c=>c.key===k)?.label||k}/></td>)}
            <td style={{...tdS,textAlign:"center"}}><div style={{display:"flex",gap:3,justifyContent:"center"}}><button onClick={add} style={{padding:"3px 8px",background:T.accent,border:"none",borderRadius:"4px",color:"#FFF",fontSize:9,cursor:"pointer",fontWeight:700}}>Add</button><button onClick={()=>setAddMode(false)} style={{padding:"3px 6px",background:"none",border:`1px solid ${T.border}`,borderRadius:"4px",color:T.textMuted,fontSize:9,cursor:"pointer"}}>✕</button></div></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}
function TaxonomyGuidePage(){
  return(
    <div style={{padding:"20px 0 60px"}}>
      <div style={{marginBottom:18}}><div style={{fontFamily:F.heading,fontSize:20,fontStyle:"italic",color:T.text,marginBottom:2}}>Taxonomy Guide</div><div style={{fontSize:11,color:T.textLabel}}>All tables fully editable — add, edit, or remove any row.</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
        <TaxTable title="Platform" rows={TAX_INIT.platform} cols={[{key:"name",label:"Platform"},{key:"code",label:"Code"},{key:"notes",label:"Notes"}]}/>
        <TaxTable title="Format" rows={TAX_INIT.format} cols={[{key:"name",label:"Format"},{key:"code",label:"Code"},{key:"notes",label:"Description"}]}/>
        <TaxTable title="Type" rows={TAX_INIT.type} cols={[{key:"name",label:"Type"},{key:"code",label:"Code"},{key:"notes",label:"Notes"}]}/>
        <TaxTable title="Orientation" rows={TAX_INIT.orientation} cols={[{key:"name",label:"Orientation"},{key:"code",label:"Code"},{key:"notes",label:"Notes"},{key:"ratio",label:"Aspect Ratio"}]}/>
      </div>
    </div>
  );
}

// ── SCRAPPED CONTENT PAGE ────────────────────────────────────────────────────
function ScrappedPage({ ideas, onUpdate, onDelete, onEdit }) {
  const scrapped = ideas.filter(i => i.status === "Scrapped");
  const restore = (idea) => onUpdate({...idea, status:"Ready For Copy Creation"});
  const thS={padding:"10px 16px",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textLabel,background:T.hover,borderBottom:`1px solid ${T.border}`,textAlign:"left",fontFamily:F.mono};
  const tdS={padding:"12px 16px",fontSize:12,color:T.textSecondary,borderBottom:`1px solid ${T.borderLight}`,verticalAlign:"middle"};
  return (
    <div style={{padding:"20px 0 60px"}}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
        <div>
          <div style={{fontFamily:F.heading,fontSize:20,fontStyle:"italic",color:T.text,marginBottom:2}}>Scrapped Content</div>
          <div style={{fontSize:11,color:T.textLabel}}>Content pieces that have been scrapped. Restore or permanently delete.</div>
        </div>
        {scrapped.length > 0 && (
          <div style={{marginLeft:"auto",background:"#CC333318",border:"1px solid #CC333330",borderRadius:"8px",padding:"8px 16px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#CC3333",display:"inline-block"}}/>
            <span style={{fontSize:12,color:"#FF5555",fontWeight:700}}>{scrapped.length} scrapped piece{scrapped.length!==1?"s":""}</span>
          </div>
        )}
      </div>

      {scrapped.length === 0 ? (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"12px",padding:"60px 20px",textAlign:"center",boxShadow:T.shadow}}>
          <div style={{fontSize:32,marginBottom:12}}>✓</div>
          <div style={{fontFamily:F.heading,fontSize:18,fontStyle:"italic",color:T.textLabel,marginBottom:6}}>Nothing scrapped.</div>
          <div style={{fontSize:12,color:T.textFaint}}>All content is active. Scrapped pieces will appear here.</div>
        </div>
      ) : (
        <div style={{background:T.card,border:"1px solid #CC333330",borderRadius:"12px",overflow:"hidden",boxShadow:T.shadow}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <th style={thS}>Title</th>
                <th style={thS}>Campaign</th>
                <th style={thS}>Format</th>
                <th style={thS}>Pillar</th>
                <th style={thS}>Description</th>
                <th style={thS}>Notes</th>
                <th style={{...thS,textAlign:"center",width:140}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scrapped.map((idea) => (
                <tr key={idea.id} style={{transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{...tdS,fontFamily:F.heading,fontStyle:"italic",color:T.text,fontSize:13,maxWidth:200}}>{idea.title}</td>
                  <td style={tdS}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:CAMPAIGN_ACCENT[idea.campaign]||T.textMuted,flexShrink:0}}/>
                      {idea.campaign}
                    </span>
                  </td>
                  <td style={tdS}><span style={{fontSize:11}}>{(idea.format||"").split(" ")[0]}</span></td>
                  <td style={tdS}><span style={{fontSize:11,background:T.hover,border:`1px solid ${T.border}`,borderRadius:"4px",padding:"2px 7px"}}>{idea.pillar}</span></td>
                  <td style={{...tdS,maxWidth:220,color:T.textSecondary,fontSize:11,lineHeight:1.5}}>{idea.description?(idea.description.length>80?idea.description.slice(0,80)+"...":idea.description):"—"}</td>
                  <td style={{...tdS,fontSize:11,color:"#D4882A",fontStyle:"italic",maxWidth:160}}>{idea.notes||"—"}</td>
                  <td style={{...tdS,textAlign:"center"}}>
                    <div style={{display:"flex",gap:6,justifyContent:"center",alignItems:"center"}}>
                      <button onClick={()=>restore(idea)} style={{padding:"5px 12px",background:"#25A86A18",border:"1px solid #25A86A30",borderRadius:"6px",color:"#25A86A",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700,transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background="#25A86A30"} onMouseLeave={e=>e.currentTarget.style.background="#25A86A18"}>↩ Restore</button>
                      <button onClick={()=>onEdit(idea)} style={{padding:"5px 10px",background:T.hover,border:`1px solid ${T.border}`,borderRadius:"6px",color:T.textSecondary,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                      <button onClick={()=>{if(window.confirm("Permanently delete this piece?"))onDelete(idea.id);}} style={{padding:"5px 8px",background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:14,transition:"color 0.15s"}} onMouseEnter={e=>e.currentTarget.style.color="#CC3333"} onMouseLeave={e=>e.currentTarget.style.color=T.textFaint} title="Delete permanently">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── ASK FLOW ─────────────────────────────────────────────────────────────────
const FAQ_CATEGORIES = [
  {
    label:"Pipeline",
    questions:[
      "What needs attention right now?",
      "Give me a morning briefing on the pipeline",
      "Which pieces are furthest behind?",
      "What's approved and ready to go?",
      "What content is scheduled this month?",
    ]
  },
  {
    label:"Campaigns",
    questions:[
      "Summarize the Drip Campaign status",
      "What's happening in Meet the Makers?",
      "How is Product Launch tracking?",
      "Which campaign has the most content?",
      "What formats are we missing across campaigns?",
    ]
  },
  {
    label:"Copy & Strategy",
    questions:[
      "Suggest a caption for our next water reel",
      "What are the best times to post on Instagram?",
      "Write a thread idea for the Abundance pillar",
      "Suggest hashtags for an innovation reel",
      "What content pillars are underserved?",
    ]
  },
  {
    label:"Analytics",
    questions:[
      "How many reels do we have total?",
      "Break down content by format",
      "How many pieces per campaign?",
      "What's our approval rate?",
      "Which pillar has the most content?",
    ]
  },
];

function AskFlow({ ideas }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [faqTab, setFaqTab] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const INTRO = "Hey \u2014 I'm **Flow**, your Vital Lyfe content strategist.\n\nI have full visibility into your tracker right now \u2014 every piece, every status, every campaign.\n\nTry **\"Give me a morning briefing\"** or pick a quick question below. I can also help with copy, captions, strategy, and anything in between.";

  useEffect(()=>{
    if(open && messages.length===0) setMessages([{role:"assistant",content:INTRO,suggestions:["Give me a morning briefing","What needs attention right now?","Summarize the Drip Campaign"]}]);
  },[open]);

  useEffect(()=>{
    if(open) setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),80);
  },[open,messages,loading]);

  useEffect(()=>{ if(open) setTimeout(()=>inputRef.current?.focus(),150); },[open]);

  const buildContext = () => {
    const byStatus=ideas.reduce((a,i)=>{a[i.status]=(a[i.status]||0)+1;return a;},{});
    const byCampaign=ideas.reduce((a,i)=>{a[i.campaign]=(a[i.campaign]||0)+1;return a;},{});
    const byFormat=ideas.reduce((a,i)=>{const f=(i.format||"").split(" ")[0];a[f]=(a[f]||0)+1;return a;},{});
    const needsAttention=ideas.filter(i=>["Need Content Approval","Need Copy Approval","Needs Revisions"].includes(i.status));
    return `You are Flow, the AI content strategist embedded inside the Vital Lyfe content tracker. You are calm, sharp, and on-brand. Vital Lyfe is a water technology company — mission: turning water abundance into access through innovation. Brand voice: cinematic, purposeful, confident.

Keep answers concise and useful. No markdown headers. Use plain prose or short lists. End responses with 2-3 suggested follow-up questions on a new line prefixed with "SUGGESTIONS:" and separated by "|" — like: SUGGESTIONS: Question one?|Question two?|Question three?

LIVE PIPELINE DATA:
- Total: ${ideas.length} pieces
- By campaign: ${JSON.stringify(byCampaign)}
- By status: ${JSON.stringify(byStatus)}
- By format: ${JSON.stringify(byFormat)}
- Needs attention (${needsAttention.length}): ${needsAttention.map(i=>`"${i.title}" — ${i.status}`).join("; ")||"none"}
- Approved: ${ideas.filter(i=>i.status==="Approved").map(i=>i.title).join(", ")||"none"}
- Scheduled: ${ideas.filter(i=>i.status==="Scheduled").map(i=>i.title).join(", ")||"none"}

FULL CONTENT:
${ideas.map(i=>`\u2022 "${i.title}" | ${i.campaign} | ${i.status} | ${(i.format||"").split(" ")[0]} | ${i.pillar}${i.notes?` | Note: ${i.notes}`:""}`).join("\n")}`;
  };

  const send = async (text) => {
    const msg = (text||input).trim();
    if (!msg||loading) return;
    setInput("");
    setSuggestions([]);
    const newMsgs = [...messages,{role:"user",content:msg}];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const res = await fetch("/api/chat",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:900,
          system:buildContext(),
          messages:newMsgs.filter(m=>m.role!=="system").map(m=>({role:m.role,content:m.content})),
        })
      });
      const data = await res.json();
      const raw = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"Something went wrong.";
      let reply = raw, suggs = [];
      if(raw.includes("SUGGESTIONS:")) {
        const [body,sLine] = raw.split("SUGGESTIONS:");
        reply = body.trim();
        suggs = sLine.trim().split("|").map(s=>s.trim()).filter(Boolean).slice(0,3);
      }
      setMessages(m=>[...m,{role:"assistant",content:reply,suggestions:suggs}]);
      setSuggestions(suggs);
    } catch(e) {
      setMessages(m=>[...m,{role:"assistant",content:"Connection issue. Please try again."}]);
    }
    setLoading(false);
  };

  const renderMsg = (content) => content.split(/(\*\*[^*]+\*\*)/g).map((p,i)=>
    p.startsWith("**")?<strong key={i}>{p.slice(2,-2)}</strong>:<span key={i}>{p}</span>
  );

  const liveStats = [
    {label:"Total",val:ideas.length,color:T.text},
    {label:"Attention",val:ideas.filter(i=>["Need Content Approval","Need Copy Approval","Needs Revisions"].includes(i.status)).length,color:"#CC3333"},
    {label:"Approved",val:ideas.filter(i=>i.status==="Approved").length,color:"#25A86A"},
    {label:"Scheduled",val:ideas.filter(i=>i.status==="Scheduled").length,color:"#7B44C2"},
  ];

  return (
    <>
      <button onClick={()=>setOpen(true)} style={{position:"fixed",bottom:62,right:24,zIndex:300,display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.08)",border:`1px solid ${T.border}`,borderRadius:"14px",color:"#FFF",padding:"12px 20px",cursor:"pointer",fontFamily:F.body,fontWeight:700,fontSize:13,letterSpacing:"0.02em",boxShadow:T.shadowDeep,transition:"all 0.2s",backdropFilter:"blur(8px)"}}
        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,0.5)";}}
        onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=T.shadowDeep;}}>
        <span style={{fontSize:16}}>◎</span>
        Ask Flow
        <span style={{background:"rgba(255,255,255,0.18)",borderRadius:"6px",padding:"1px 7px",fontSize:9,fontWeight:700,letterSpacing:"0.07em"}}>AI</span>
      </button>

      {open&&<div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:700}}/>}

      {open&&(
        <div style={{position:"fixed",top:0,right:0,bottom:0,zIndex:800,width:440,background:T.bg,borderLeft:`1px solid ${T.border}`,boxShadow:"-8px 0 48px rgba(0,0,0,0.4)",display:"flex",flexDirection:"column",fontFamily:F.body}}>

          <div style={{padding:"16px 18px 14px",borderBottom:`1px solid ${T.borderLight}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,background:"rgba(255,255,255,0.08)",borderRadius:"11px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>◎</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:T.text,letterSpacing:"-0.01em"}}>Ask Flow</div>
                  <div style={{fontSize:9,color:T.textLabel,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:F.mono}}>Vital Lyfe AI Strategist · Live Data</div>
                </div>
              </div>
              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                <button onClick={()=>{setMessages([{role:"assistant",content:INTRO,suggestions:["Give me a morning briefing","What needs attention right now?","Summarize the Drip Campaign"]}]);setSuggestions([]);}} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"6px",padding:"4px 9px",fontSize:10,color:T.textLabel,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>↺</button>
                <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:20,lineHeight:1,padding:4}}>✕</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {liveStats.map(({label,val,color})=>(
                <div key={label} style={{background:T.hover,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"6px 8px",textAlign:"center"}}>
                  <div style={{fontSize:17,fontWeight:700,color,fontFamily:F.heading,lineHeight:1}}>{val}</div>
                  <div style={{fontSize:8,color:T.textLabel,letterSpacing:"0.07em",textTransform:"uppercase",marginTop:2,fontFamily:F.mono}}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
            {messages.map((msg,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start",gap:4}}>
                <div style={{maxWidth:"90%",padding:"10px 14px",borderRadius:msg.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:msg.role==="user"?T.accent:T.hover,color:msg.role==="user"?"#FFF":"rgba(255,255,255,0.85)",fontSize:13,lineHeight:1.72,border:msg.role==="assistant"?`1px solid ${T.border}`:"none",whiteSpace:"pre-wrap"}}>
                  {renderMsg(msg.content)}
                </div>
                {msg.role==="assistant"&&msg.suggestions&&msg.suggestions.length>0&&i===messages.length-1&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,maxWidth:"90%"}}>
                    {msg.suggestions.map((s,si)=>(
                      <button key={si} onClick={()=>send(s)} style={{padding:"5px 11px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"20px",fontSize:11,color:T.textSecondary,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background=T.accent;e.currentTarget.style.color="#FFF";e.currentTarget.style.borderColor=T.accent;}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.textSecondary;e.currentTarget.style.borderColor=T.border;}}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <span style={{fontSize:9,color:T.textFaint,letterSpacing:"0.04em"}}>{msg.role==="user"?"You":"Flow"}</span>
              </div>
            ))}
            {loading&&(
              <div style={{display:"flex",alignItems:"flex-start"}}>
                <div style={{padding:"10px 14px",background:T.hover,border:`1px solid ${T.border}`,borderRadius:"12px 12px 12px 3px",display:"flex",gap:5,alignItems:"center"}}>
                  {[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:T.textFaint,display:"inline-block",animation:`flowdot 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          <div style={{borderTop:`1px solid ${T.borderLight}`,padding:"10px 16px 8px",flexShrink:0,background:T.hover}}>
            <div style={{display:"flex",gap:4,marginBottom:8,overflowX:"auto"}}>
              {FAQ_CATEGORIES.map((cat,i)=>(
                <button key={i} onClick={()=>setFaqTab(i)} style={{padding:"4px 10px",borderRadius:"20px",border:`1px solid ${faqTab===i?T.accent:T.border}`,background:faqTab===i?"rgba(42,171,255,0.15)":"transparent",color:faqTab===i?T.accent:T.textMuted,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap",transition:"all 0.15s"}}>
                  {cat.label}
                </button>
              ))}
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {FAQ_CATEGORIES[faqTab].questions.map((q,i)=>(
                <button key={i} onClick={()=>send(q)} style={{padding:"5px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"20px",fontSize:11,color:T.textSecondary,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s",whiteSpace:"nowrap"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=T.accent;e.currentTarget.style.color="#FFF";e.currentTarget.style.borderColor=T.accent;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.textSecondary;e.currentTarget.style.borderColor=T.border;}}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div style={{padding:"10px 14px 14px",borderTop:`1px solid ${T.borderLight}`,background:T.bg,flexShrink:0}}>
            <div style={{display:"flex",gap:7,alignItems:"flex-end"}}>
              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask anything about your pipeline..." rows={2} style={{flex:1,background:T.hover,border:`1px solid ${T.border}`,borderRadius:"10px",color:T.text,padding:"9px 12px",fontSize:13,outline:"none",resize:"none",fontFamily:"inherit",lineHeight:1.5}} onFocus={e=>e.target.style.borderColor=T.textLabel} onBlur={e=>e.target.style.borderColor=T.border}/>
              <button onClick={()=>send()} disabled={!input.trim()||loading} style={{padding:"9px 14px",background:input.trim()&&!loading?T.accent:T.hover,border:"none",borderRadius:"10px",color:input.trim()&&!loading?"#FFF":T.textLabel,fontWeight:700,fontSize:14,cursor:input.trim()&&!loading?"pointer":"default",fontFamily:"inherit",height:44,transition:"all 0.15s",flexShrink:0}}>→</button>
            </div>
            <div style={{fontSize:9,color:T.textFaint,marginTop:5,letterSpacing:"0.04em"}}>Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      )}
      <style>{`@keyframes flowdot{0%,80%,100%{transform:scale(0.6);opacity:0.3}40%{transform:scale(1);opacity:1}}`}</style>
    </>
  );
}

// ── NAV BAR ──────────────────────────────────────────────────────────────────
function NavBar({activePage,setActivePage}){
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",display:"flex",alignItems:"center",padding:"5px 5px",marginBottom:16,boxShadow:T.shadow,gap:2}}>
      {NAV_TABS.map(({id,label})=>(
        <button key={id} onClick={()=>setActivePage(id)} style={{flex:1,padding:"8px 8px",borderRadius:"7px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:activePage===id?700:500,border:"none",background:activePage===id?"rgba(42,171,255,0.15)":"transparent",color:activePage===id?T.accent:T.textMuted,letterSpacing:"0.03em",transition:"all 0.15s",whiteSpace:"nowrap"}} onMouseEnter={e=>{if(activePage!==id)e.currentTarget.style.color=T.text;}} onMouseLeave={e=>{if(activePage!==id)e.currentTarget.style.color=T.textMuted;}}>{label}</button>
      ))}
    </div>
  );
}

// ── SOP PAGE ─────────────────────────────────────────────────────────────────
function SopPage(){
  const bg   = T.card;
  const bdr  = T.border;
  const txt  = T.text;
  const sub  = T.textSecondary;
  const tag  = T.hover;

  const steps = VITAL_LYFE_SOP?.steps || [
    {num:"01",phase:"Discovery",title:"Ideation & Concept Alignment",desc:"Cloud Scenic meets with VitalLyfe's Marketing Director to align on creative direction, brand goals, campaign objectives, and overall content strategy.",tags:["Ideation","Strategy Session","Marketing Director"]},
    {num:"02",phase:"Planning",title:"Content Tracker Build & Approval",desc:"A comprehensive content tracker is built covering every planned asset across Reels, Stories, Graphics, and Carousels.",tags:["Google Sheets","Reels","Stories","Graphics","Carousels","Content Pillars"]},
    {num:"03",phase:"Pre-Production",title:"Footage Scouting via Art Grid",desc:"With the approved tracker as a reference, the team heads into Art Grid to scout and select footage.",tags:["Art Grid","Footage Research","Visual Direction"]},
    {num:"04",phase:"Production",title:"Content Development & Post-Production",desc:"All content is developed and edited across every required format.",tags:["Post-Production","Reels","Stories","Graphics","Carousels"]},
    {num:"05",phase:"Review",title:"Content Review & Client Approval",desc:"All completed content is sent for client review via Google Drive or Wipster.",tags:["Google Drive","Wipster","Feedback Loop","Approval Gate"]},
    {num:"06",phase:"Distribution",title:"Content Scheduling Across All Platforms",desc:"Approved content is loaded into Sprout Social and scheduled across all active social platforms.",tags:["Sprout Social","Multi-Platform","Approved Captions"]},
    {num:"07",phase:"Final Sign-Off",title:"Scheduler Review & Final Confirmation",desc:"The completed schedule from Sprout Social is sent back to the client for a final review.",tags:["Sprout Social","Final Approval","Delegation","Go-Live"]},
  ];

  const tools = [
    {n:"01", name:"Sprout Social", role:"Scheduling & Publishing"},
    {n:"02", name:"Google Drive",  role:"File Storage & Review"},
    {n:"03", name:"Wipster",       role:"Video Review & Approval"},
    {n:"04", name:"Google Sheets", role:"Content Tracker & Planning"},
    {n:"05", name:"Slack",         role:"Team Communication"},
  ];

  return (
    <div style={{maxWidth:900,margin:"0 auto",paddingTop:12}}>
      <div style={{background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"36px 40px",marginBottom:28,position:"relative",overflow:"hidden",border:`1px solid ${bdr}`}}>
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(42,171,255,0.06) 0%,transparent 60%)",pointerEvents:"none"}}/>
        <div style={{fontFamily:F.mono,fontSize:9,letterSpacing:"0.2em",textTransform:"uppercase",color:T.textLabel,marginBottom:14}}>MASTER SOP · CLOUD SCENIC × VITALLYFE · V1.0 · 2026</div>
        <div style={{fontFamily:F.heading,fontSize:48,fontWeight:700,color:"#FFF",lineHeight:1,marginBottom:10}}>
          MASTER CONTENT <span style={{color:"rgba(255,255,255,0.25)"}}>WORKFLOW</span>
        </div>
        <div style={{fontSize:13,color:T.textMuted,lineHeight:1.7,maxWidth:540}}>
          A defined end-to-end process for how Cloud Scenic develops, produces, reviews, and publishes content for VitalLyfe across all social platforms.
        </div>
      </div>

      <div style={{background:bg,border:`1px solid ${bdr}`,borderRadius:12,overflow:"hidden",marginBottom:24}}>
        <div style={{padding:"18px 28px",borderBottom:`1px solid ${bdr}`,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontFamily:F.mono,fontSize:9,letterSpacing:"0.18em",textTransform:"uppercase",color:sub}}>WORKFLOW STEPS</span>
        </div>
        {steps.map((s,i)=>(
          <div key={s.num} style={{display:"grid",gridTemplateColumns:"80px 1fr",borderTop:i===0?"none":`1px solid ${bdr}`,padding:"28px 28px"}}>
            <div style={{fontFamily:F.heading,fontSize:44,fontWeight:700,color:"rgba(255,255,255,0.08)",lineHeight:1,paddingTop:4}}>{s.num}</div>
            <div>
              <div style={{fontFamily:F.mono,fontSize:9,letterSpacing:"0.18em",textTransform:"uppercase",color:sub,marginBottom:6}}>{s.phase}</div>
              <div style={{fontWeight:700,fontSize:15,color:txt,marginBottom:8}}>{s.title}</div>
              <div style={{fontSize:13,color:sub,lineHeight:1.75,marginBottom:12}}>{s.desc||s.body}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {(s.tags||[]).map(t=>(
                  <span key={t} style={{background:tag,border:`1px solid ${bdr}`,borderRadius:5,padding:"3px 9px",fontSize:10,color:sub,fontFamily:F.mono,letterSpacing:"0.04em"}}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{background:bg,border:`1px solid ${bdr}`,borderRadius:12,overflow:"hidden",marginBottom:40}}>
        <div style={{padding:"18px 28px",borderBottom:`1px solid ${bdr}`}}>
          <span style={{fontFamily:F.mono,fontSize:9,letterSpacing:"0.18em",textTransform:"uppercase",color:sub}}>TOOLS & PLATFORMS — APPS USED IN THIS WORKFLOW</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))"}}>
          {tools.map((t,i)=>(
            <div key={t.n} style={{padding:"20px 22px",borderRight:i%5!==4?`1px solid ${bdr}`:"none",borderTop:i>4?`1px solid ${bdr}`:"none"}}>
              <div style={{fontFamily:F.mono,fontSize:9,color:sub,marginBottom:8}}>{t.n}</div>
              <div style={{fontWeight:700,fontSize:13,color:txt,marginBottom:4}}>{t.name}</div>
              <div style={{fontSize:11,color:sub}}>{t.role}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{textAlign:"center",fontFamily:F.mono,fontSize:9,letterSpacing:"0.16em",color:sub,paddingBottom:24,textTransform:"uppercase"}}>
        Cloud Scenic × VitalLyfe · Confidential · Master SOP · v1.0 · 2026
      </div>
    </div>
  );
}

// ── MAIN: CLIENT VIEW ────────────────────────────────────────────────────────
export default function ClientView({ user, content, setContent, onSignOut, isPreview }) {
  const ideas = (content||[]).map(toTracker);

  const [filterCampaign,setFilterCampaign]=useState("All");
  const [filterFormat,setFilterFormat]=useState("All");
  const [filterPlatform,setFilterPlatform]=useState("All");
  const [view,setView]=useState("board");
  const [modal,setModal]=useState(null);
  const [search,setSearch]=useState("");
  const [activePage,setActivePage]=useState("tracker");
  const [collapsedGroups,setCollapsedGroups]=useState({});
  const [activeMonth,setActiveMonth]=useState("Mar");
  const [scheduleMonth,setScheduleMonth]=useState(new Date().getMonth());

  const toggleGroup=s=>setCollapsedGroups(g=>({...g,[s]:!g[s]}));

  const filtered=ideas.filter(i=>{
    if(i.status==="Scrapped")return false;
    if(filterCampaign==="approved"&&i.status!=="Approved")return false;
    if(filterCampaign!=="All"&&filterCampaign!=="approved"&&i.campaign!==filterCampaign)return false;
    if(filterFormat!=="All"&&!(i.format||"").toLowerCase().includes(filterFormat.toLowerCase()))return false;
    if(filterPlatform!=="All"&&!(i.platform||[]).includes(filterPlatform))return false;
    if(search){const q=search.toLowerCase();if(!(i.title||"").toLowerCase().includes(q)&&!(i.caption||"").toLowerCase().includes(q)&&!(i.description||"").toLowerCase().includes(q))return false;}
    return true;
  });

  const sortedFiltered=[...filtered].sort((a,b)=>(STATUS_SORT[a.status]??4)-(STATUS_SORT[b.status]??4));

  const handleSave=async(form)=>{
    const sbItem = toSupabase(form);
    if(form.id){
      // Update existing
      const updated = ideas.map(i=>i.id===form.id?form:i);
      setContent(updated.map(toSupabase));
      try { await sb.from("content_items").update(sbItem).eq("id",form.id); } catch(e){ console.error("Update error:",e); }
    }else{
      // Insert new
      try {
        const { data } = await sb.from("content_items").insert({...sbItem, id: undefined}).select();
        if(data&&data[0]){
          setContent([...content, data[0]]);
        }
      } catch(e){ console.error("Insert error:",e); }
    }
    setModal(null);
  };

  const handleDelete=async(id)=>{
    setContent(content.filter(i=>i.id!==id));
    try { await sb.from("content_items").delete().eq("id",id); } catch(e){ console.error("Delete error:",e); }
  };

  const handleUpdate=async(updated)=>{
    const newIdeas = ideas.map(i=>i.id===updated.id?updated:i);
    setContent(newIdeas.map(toSupabase));
    const sbItem = toSupabase(updated);
    try { await sb.from("content_items").update(sbItem).eq("id",updated.id); } catch(e){ console.error("Update error:",e); }
  };

  const grouped=STATUS_OPTIONS.reduce((acc,s)=>{acc[s]=sortedFiltered.filter(i=>i.status===s);return acc;},{});
  const fBtn=active=>({padding:"5px 12px",borderRadius:"6px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:active?700:500,border:`1px solid ${active?T.accent:T.border}`,background:active?"rgba(42,171,255,0.15)":"transparent",color:active?T.accent:T.textMuted,letterSpacing:"0.04em",textTransform:"uppercase",transition:"all 0.15s"});

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:F.body,paddingBottom:56}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:rgba(255,255,255,0.03);}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:3px;}
        select option{background:${T.bg};color:${T.text};}input::placeholder,textarea::placeholder{color:${T.textFaint};}textarea{font-family:inherit;}
        input:focus,textarea:focus,select:focus{border-color:${T.textLabel} !important;outline:none;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* HEADER */}
      <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,padding:"0 32px",display:"flex",alignItems:"center",height:60,position:"sticky",top:0,zIndex:100,boxShadow:`0 1px 0 ${T.border}`,backdropFilter:"blur(12px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:16,flex:1}}>
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:"4px",padding:"5px 10px"}}><span style={{fontWeight:900,fontSize:9,color:"#FFF",letterSpacing:"0.14em",textTransform:"uppercase"}}>CLOUD SCENIC</span></div>
          <div style={{width:1,height:24,background:T.border}}/>
          <span style={{fontWeight:700,fontSize:13,color:T.text,letterSpacing:"0.02em"}}>VitalLyfe</span>
          <div style={{width:1,height:24,background:T.border}}/>
          <span style={{fontFamily:F.heading,fontStyle:"italic",fontSize:12,color:T.textLabel}}>Content Tracker</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <TheFlow ideas={ideas}/>
          {activePage==="tracker"&&<button onClick={()=>setView(v=>v==="board"?"list":"board")} style={{padding:"6px 13px",borderRadius:"6px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:500,border:`1px solid ${T.border}`,background:"transparent",color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{view==="board"?"List":"Board"}</button>}
          <button onClick={()=>setModal("new")} style={{padding:"7px 18px",background:T.accent,border:"none",borderRadius:"7px",color:"#FFF",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",boxShadow:T.shadow}} onMouseEnter={e=>e.currentTarget.style.background="#4BBFFF"} onMouseLeave={e=>e.currentTarget.style.background=T.accent}>+ Add Content</button>
        </div>
      </div>

      <div style={{padding:"20px 32px 32px"}}>
        <SummaryStats ideas={ideas} activeFilter={filterCampaign} onFilter={setFilterCampaign} onNavigate={setActivePage}/>
        <NavBar activePage={activePage} setActivePage={setActivePage}/>

        {activePage==="pillars"  &&<PillarsPage/>}
        {activePage==="count"    &&<CountTrackerPage ideas={ideas}/>}
        {activePage==="schedule" &&<ScheduleTrackerPage ideas={ideas} jumpMonth={scheduleMonth}/>}
        {activePage==="gantt"    &&<GanttPage ideas={ideas}/>}
        {activePage==="taxonomy" &&<TaxonomyGuidePage/>}
        {activePage==="scrapped" &&<ScrappedPage ideas={ideas} onUpdate={handleUpdate} onDelete={handleDelete} onEdit={setModal}/>}
        {activePage==="sop"      &&<SopPage/>}

        {activePage==="tracker"&&<>
          {/* Filters */}
          <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{position:"relative"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"6px",color:T.text,padding:"6px 12px 6px 30px",fontSize:12,outline:"none",width:200,fontFamily:"inherit"}}/>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.textFaint,fontSize:12,pointerEvents:"none"}}>⌕</span>
            </div>
            {(filterFormat!=="All"||filterPlatform!=="All"||search)&&(
              <button onClick={()=>{setFilterFormat("All");setFilterPlatform("All");setSearch("");}} style={{padding:"5px 12px",borderRadius:"6px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,border:"1px solid #CC333330",background:"#CC333318",color:"#FF5555",letterSpacing:"0.04em",transition:"all 0.15s"}}>✕ Clear Filters</button>
            )}
            <div style={{width:1,height:22,background:T.border}}/>
            <span style={{fontSize:9,color:T.textLabel,letterSpacing:"0.09em",textTransform:"uppercase",fontWeight:700,fontFamily:F.mono}}>Format:</span>
            {["All","Graphics","Carousel","Reel","Story","Thread","Reddit"].map(f=>{
              const val=f==="All"?"All":f;
              const active=filterFormat===val;
              return <button key={f} onClick={()=>setFilterFormat(active?"All":val)} style={fBtn(active)}>{active&&f!=="All"?"✕ ":""}{f}</button>;
            })}
            <div style={{width:1,height:22,background:T.border}}/>
            <span style={{fontSize:9,color:T.textLabel,letterSpacing:"0.09em",textTransform:"uppercase",fontWeight:700,fontFamily:F.mono}}>Platform:</span>
            {["All",...PLATFORM_OPTIONS].map(p=>{
              const active=filterPlatform===p;
              return <button key={p} onClick={()=>setFilterPlatform(active&&p!=="All"?"All":p)} style={fBtn(active)}>{active&&p!=="All"?"✕ ":""}{p}</button>;
            })}
            <span style={{marginLeft:"auto",fontSize:11,color:T.textFaint}}>{filtered.length} item{filtered.length!==1?"s":""}</span>
          </div>

          {/* BOARD */}
          {view==="board"&&(
            <div>
              {STATUS_OPTIONS.map(status=>{
                const group=grouped[status];
                if(!group||group.length===0)return null;
                const sc=STATUS_COLORS[status];
                const isCollapsed=collapsedGroups[status];
                const isUrgent=["Need Content Approval","Need Copy Approval","Needs Revisions"].includes(status);
                return(
                  <div key={status} style={{marginBottom:24}}>
                    <button onClick={()=>toggleGroup(status)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",paddingBottom:10,borderBottom:`2px solid ${isUrgent?sc.dot+"44":sc.border||T.border}`,marginBottom:isCollapsed?0:12,background:"none",border:"none",borderBottom:`2px solid ${isUrgent?sc.dot+"44":sc.border||T.border}`,cursor:"pointer",padding:"0 0 10px 0",textAlign:"left"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:sc.dot||T.textMuted,flexShrink:0}}/>
                      <span style={{fontSize:10,fontWeight:700,color:sc.text||T.textSecondary,textTransform:"uppercase",letterSpacing:"0.12em",fontFamily:F.mono}}>{status}</span>
                      <span style={{fontSize:11,color:T.textFaint,fontWeight:500}}>— {group.length}</span>
                      {isUrgent&&<span style={{marginLeft:6,fontSize:9,background:sc.bg,color:sc.text,border:`1px solid ${sc.border}`,borderRadius:"10px",padding:"1px 7px",fontWeight:700,fontFamily:F.mono}}>Needs Attention</span>}
                      <span style={{marginLeft:"auto",fontSize:10,color:T.textFaint}}>{isCollapsed?"▶ expand":"▼ collapse"}</span>
                    </button>
                    {!isCollapsed&&(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
                        {group.map(idea=><IdeaCard key={idea.id} idea={idea} onEdit={setModal} onDelete={handleDelete} onUpdate={handleUpdate}/>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* LIST */}
          {view==="list"&&(
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",overflow:"hidden",boxShadow:T.shadow}}>
              <div style={{display:"grid",gridTemplateColumns:"200px 180px 1fr 85px 70px",background:T.hover,padding:"9px 18px",borderBottom:`1px solid ${T.border}`,fontSize:9,color:T.textFaint,letterSpacing:"0.12em",textTransform:"uppercase",gap:12,fontWeight:700,fontFamily:F.mono}}>
                <span>Status</span><span>Title</span><span>Description</span><span>Format</span><span></span>
              </div>
              {sortedFiltered.map((idea,i)=>{
                const cc=CAMPAIGN_ACCENT[idea.campaign]||T.textMuted;
                return(
                  <div key={idea.id} style={{display:"grid",gridTemplateColumns:"200px 180px 1fr 85px 70px",padding:"10px 18px",gap:12,borderBottom:i<sortedFiltered.length-1?`1px solid ${T.borderLight}`:"none",alignItems:"center",transition:"background 0.15s",borderLeft:`3px solid ${cc}`}} onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span><StatusDropdown value={idea.status} onChange={s=>handleUpdate({...idea,status:s})}/></span>
                    <span style={{fontFamily:F.heading,fontStyle:"italic",fontSize:13,color:T.text,lineHeight:1.3}}>{idea.title}</span>
                    <span style={{fontSize:11,color:T.textMuted,lineHeight:1.6}}>{idea.description?(idea.description.length>90?idea.description.slice(0,90)+"...":idea.description):"—"}</span>
                    <span style={{fontSize:11,color:T.textLabel}}>{(idea.format||"").split(" ")[0]}</span>
                    <span style={{display:"flex",gap:4,alignItems:"center"}}>
                      <QuickNote value={idea.notes} onChange={n=>handleUpdate({...idea,notes:n})}/>
                      <button onClick={()=>setModal(idea)} style={{background:"none",border:"none",color:T.textLabel,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Edit</button>
                      <button onClick={()=>handleDelete(idea.id)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:13,transition:"color 0.15s"}} onMouseEnter={e=>e.currentTarget.style.color="#CC3333"} onMouseLeave={e=>e.currentTarget.style.color=T.textFaint}>✕</button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty */}
          {sortedFiltered.length===0&&(
            <div style={{textAlign:"center",padding:"60px 20px",color:T.textLabel}}>
              <div style={{fontFamily:F.heading,fontSize:22,fontStyle:"italic",marginBottom:6,color:T.textFaint}}>No content found.</div>
              <div style={{fontSize:12}}>Adjust filters or add a new idea above.</div>
            </div>
          )}
        </>}
      </div>

      {/* MONTH BAR */}
      <div style={{background:T.card,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",height:46,position:"fixed",bottom:0,left:0,right:0,zIndex:100,boxShadow:`0 -1px 0 ${T.border}`}}>
        {MONTHS.map((m,i)=>{
          const isActive=activeMonth===m;
          return(
            <button key={m} onClick={()=>{setActiveMonth(m);setActivePage("schedule");setScheduleMonth(i);}} style={{flex:1,height:"100%",background:isActive?"rgba(42,171,255,0.15)":"transparent",border:"none",borderRight:i<11?`1px solid ${T.borderLight}`:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:isActive?700:400,color:isActive?T.accent:T.textMuted,letterSpacing:"0.05em",textTransform:"uppercase",transition:"all 0.15s"}} onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background=T.hover;}} onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background="transparent";}}>{m}</button>
          );
        })}
      </div>

      {modal&&<Modal idea={modal==="new"?null:modal} onClose={()=>setModal(null)} onSave={handleSave}/>}
      <AskFlow ideas={ideas}/>
    </div>
  );
}
