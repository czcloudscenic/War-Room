import React, { useState } from 'react';
import Card from '../shared/Card.jsx';
import { useIsMobile, useInterval } from '../../utils/hooks.js';
import { OPS_INIT } from '../../data/seed.ops.js';

export default function OpsBoard() {
  const isMobile = useIsMobile();
  const [ops, setOps] = useState(OPS_INIT);
  const [newTask, setNewTask] = useState("");
  useInterval(() => {
    setOps(prev => {
      if (prev.backlog.length===0) return prev;
      const task = prev.backlog[0];
      return { ...prev, backlog:prev.backlog.slice(1), inProgress:[...prev.inProgress,{ ...task, id:task.id+"_m" }] };
    });
  }, 20000);
  useInterval(() => {
    setOps(prev => {
      if (prev.inProgress.length===0) return prev;
      const task = prev.inProgress[0];
      return { ...prev, inProgress:prev.inProgress.slice(1), completed:[{ ...task, id:task.id+"_d" },...prev.completed].slice(0,8) };
    });
  }, 28000);
  const addTask = () => {
    if (!newTask.trim()) return;
    setOps(prev => ({ ...prev, backlog:[...prev.backlog,{ id:Date.now().toString(), title:newTask, agent:"Unassigned" }] }));
    setNewTask("");
  };
  const cols = [{ key:"backlog", label:"Backlog", color:"rgba(255,255,255,0.5)" }, { key:"inProgress", label:"In Progress", color:"#ff9f0a" }, { key:"completed", label:"Completed", color:"#2AABFF" }];
  return (
    <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:12 }}>
      {cols.map(col => (
        <div key={col.key} style={{ flex:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.6)" }}>{col.label}</span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.07)", padding:"2px 8px", borderRadius:20, fontWeight:500 }}>{ops[col.key].length}</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {ops[col.key].map((task,i) => (
              <Card key={task.id} style={{ padding:"12px 14px", borderLeft:"3px solid rgba(255,255,255,0.08)", borderRadius:12, animation:i===0&&col.key==="inProgress"?"slideIn 0.3s ease":"none" }}>
                <div style={{ fontSize:12, color:"#ffffff", fontWeight:500, marginBottom:4, lineHeight:1.4 }}>{task.title}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{task.agent}</div>
                {col.key==="inProgress" && <div style={{ marginTop:10, height:2, background:"rgba(255,255,255,0.05)", borderRadius:2 }}><div style={{ height:"100%", width:"55%", background:"rgba(255,255,255,0.2)", borderRadius:2, animation:"progressBar 28s linear forwards" }} /></div>}
              </Card>
            ))}
            {col.key==="backlog" && (
              <div style={{ display:"flex", gap:6 }}>
                <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key==="Enter" && addTask()} placeholder="Add task..." style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"8px 12px", color:"#ffffff", fontSize:11, outline:"none", fontFamily:"Inter, sans-serif" }} />
                <button onClick={addTask} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"rgba(255,255,255,0.6)", cursor:"pointer", padding:"8px 14px", fontSize:14, fontWeight:400 }}>+</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
