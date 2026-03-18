import React, { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import Card from '../shared/Card.jsx';

export default function TeamBroadcast({ agents }) {
  const isMobile = useIsMobile();
  const [broadcasts, setBroadcasts] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const AGENT_SYSTEM = {
Sean: "You are Sean, Commander Agent. Decisive, calm, short sentences. When you receive a brief or update from the team lead, acknowledge it, note implications for your pipeline coordination, and state your immediate action. Under 80 words.",
Lacey: "You are Lacey, Runner Agent. Fast, pragmatic, loves checklists. When you receive a brief, identify what workflows, automations, or SOPs need to be updated or triggered. Under 80 words.",
Ali: "You are Ali, Developer Agent. Precise, technical. When you receive a brief, flag any technical changes needed to the system. Under 80 words.",
Sam: "You are Sam, Monitor Agent. Methodical, data-driven. When you receive a brief, note what metrics or signals you'll be watching. Under 80 words.",
Artgrid: "You are Artgrid, Footage Scout. Visual, cinematic. When you receive a brief, note how it affects your footage scouting strategy. Under 80 words.",
Muse: "You are Muse, Content Ideation Agent. Creative, on-brand. When you receive a brief, surface 2-3 content angles it suggests. Under 80 words.",
Overseer: "You are Overseer, SOP Guardian. Rigorous, precise. When you receive a brief, flag any SOP compliance considerations. Under 80 words.",
Scrappy: "You are Scrappy, Trend Scout. Sharp, fast, a bit chaotic. When you receive a brief, immediately think about what trends or research angles to pursue. Under 80 words.",
  };

  useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({behavior:"smooth"}); }, [broadcasts]);

  const sendBroadcast = async () => {
const text = input.trim(); if (!text || sending) return;
setInput(""); setSending(true);
const id = Date.now();
const broadcast = { id, message: text, ts: Date.now(), responses: {}, loading: true };
setBroadcasts(prev => [...prev, broadcast]);

// Fire all 8 agents in parallel
const agentPromises = agents.map(async (agent) => {
  try {
    const res = await fetch("/api/chat", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:200,
        system: AGENT_SYSTEM[agent.name] || `You are ${agent.name}, an agent in the VitalLyfe Vantus. Respond to the brief concisely.`,
        messages:[{role:"user",content:text}]
      })
    });
    const d = await res.json();
    const blk = d.content?.find(x=>x.type==="text");
    return { agentId: agent.id, agentName: agent.name, response: blk?.text || "…", color: agent.color };
  } catch(e) { return { agentId: agent.id, agentName: agent.name, response: "Connection error.", color: agent.color, err:true }; }
});

const results = await Promise.all(agentPromises);
const responses = {};
results.forEach(r => { responses[r.agentId] = r; });
setBroadcasts(prev => prev.map(b => b.id===id ? {...b, responses, loading:false} : b));
setSending(false);
setExpandedId(id);
setTimeout(()=>{ if(inputRef.current) inputRef.current.focus(); }, 80);
  };

  const QUICK_BRIEFS = [
"New campaign brief: we're shifting focus to Tierra Bomba content for the next 3 weeks. Prioritize community and access angles.",
"Client approved all Drip Campaign reels. We're moving to scheduling phase — all hands on Week 5 Product Launch prep.",
"Budget update: $500 freed up for paid ads this month. Optimize for highest-converting content.",
"New platform strategy: doubling down on TikTok. All reels should be adapted for TT-first hook structure.",
  ];

  return (
<div style={{animation:"fadeIn 0.4s ease",display:"flex",flexDirection:"column",height: isMobile ? "auto" : "calc(100vh - 80px)"}}>
  <div style={{marginBottom: isMobile ? 12 : 20}}>
    <h1 style={{fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 24 : 32, fontWeight:700, color:"#f5f5f7", marginBottom:4, letterSpacing:-1}}>Team Broadcast</h1>
    <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:0}}>Send a brief to all 8 agents — each responds in their own voice.</p>
  </div>

  <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:20,paddingBottom:20}}>
    {broadcasts.length === 0 && (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,paddingBottom:80}}>
        <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:16}}></div>
        <div style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.35)",marginBottom:6}}>No broadcasts yet</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:24,textAlign:"center",maxWidth:320,lineHeight:1.6}}>Send a brief, update, or direction below. All 8 agents will respond simultaneously.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,width:"100%",maxWidth:500}}>
          {QUICK_BRIEFS.map((b,i)=>(
            <button key={i} onClick={()=>setInput(b)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",cursor:"pointer",textAlign:"left",fontFamily:"Inter,sans-serif"}}>
              <div style={{fontSize:11,fontWeight:600,color:"#f5f5f7",lineHeight:1.4}}>{b.slice(0,60)}…</div>
            </button>
          ))}
        </div>
      </div>
    )}

    {broadcasts.map(b => (
      <div key={b.id} style={{animation:"fadeIn 0.4s ease"}}>
        {/*  YOUR MESSAGE  */}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
          <div style={{maxWidth:"70%",background:"#0f0f1a",borderRadius:"15px 15px 3px 15px",padding:"12px 16px"}}>
            <div style={{fontSize:13,color:"#fff",lineHeight:1.65}}>{b.message}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:4,textAlign:"right"}}>{new Date(b.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
          </div>
        </div>

        {/*  AGENT RESPONSES  */}
        {b.loading ? (
          <div style={{display:"flex",gap:8,alignItems:"center",padding:"12px 16px",background:"rgba(255,255,255,0.05)",borderRadius:12}}>
            {[0,0.2,0.4].map((d,i)=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#2AABFF",animation:`livePulse 1.2s ${d}s infinite`}}/>)}
            <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginLeft:6}}>All 8 agents responding…</span>
          </div>
        ) : (
          <div>
            <button onClick={()=>setExpandedId(expandedId===b.id?null:b.id)} style={{background:"none",border:"none",fontSize:11,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"Inter,sans-serif",padding:"4px 0",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
              <span style={{transform:expandedId===b.id?"rotate(90deg)":"rotate(0deg)",display:"inline-block",transition:"transform 0.2s",fontSize:10}}></span>
              {Object.keys(b.responses).length} agent responses
            </button>
            {expandedId===b.id && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {Object.values(b.responses).map(r=>{
                  const ag = agents.find(a=>a.id===r.agentId);
                  return (
                    <Card key={r.agentId} style={{padding:"14px 16px",borderLeft:`3px solid ${r.color}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{width:26,height:26,borderRadius:7,background:ag?.grad||"#eee",border:`1px solid ${r.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:r.color,flexShrink:0}}>{r.agentName[0]}</div>
                        <span style={{fontSize:12,fontWeight:600,color:"#f5f5f7"}}>{r.agentName}</span>
                        <span style={{fontSize:9,color:r.color,fontWeight:600,marginLeft:"auto"}}>{ag?.role}</span>
                      </div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.7}}>{r.response}</div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    ))}
    <div ref={bottomRef}/>
  </div>

  {/*  INPUT  */}
  {broadcasts.length > 0 && (
    <div style={{padding:"8px 0 4px",display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
      {QUICK_BRIEFS.slice(0,2).map((b,i)=>(
        <button key={i} onClick={()=>setInput(b)} disabled={sending} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"4px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:11,color:"rgba(255,255,255,0.6)"}}>
          {b.slice(0,40)}…
        </button>
      ))}
    </div>
  )}
  <div style={{display:"flex",gap:10,paddingTop:12,borderTop:"1px solid rgba(0,0,0,0.07)",flexWrap: isMobile ? "wrap" : "nowrap"}}>
    <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendBroadcast();}}}
      placeholder="Send a brief to all 8 agents…" disabled={sending}
      style={{flex:1, width: isMobile ? "100%" : "auto", background:"rgba(255,255,255,0.05)",border:`1px solid ${input?"rgba(48,209,88,0.4)":"rgba(0,0,0,0.1)"}`,borderRadius:12,padding:"12px 16px",color:"#f5f5f7",fontSize: isMobile ? 16 : 13,outline:"none",fontFamily:"Inter,sans-serif"}}/>
    <button onClick={sendBroadcast} disabled={!input.trim()||sending}
      style={{background:input.trim()&&!sending?"#2AABFF":"rgba(255,255,255,0.07)",border:"none",borderRadius:12,color:input.trim()&&!sending?"#fff":"rgba(255,255,255,0.3)",cursor:input.trim()&&!sending?"pointer":"default",padding:"12px 22px",fontSize:17,transition:"all 0.2s",fontFamily:"Inter,sans-serif", width: isMobile ? "100%" : "auto"}}>
      {sending?"⏳ Sending…":"↑ Broadcast"}
    </button>
  </div>
</div>
  );
}
