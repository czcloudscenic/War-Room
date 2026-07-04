import React, { useState } from 'react';
import Card from '../shared/Card.jsx';
import { useIsMobile } from '../../utils/hooks.js';
import { OPS_INIT } from '../../data/seed.ops.js';

export default function OpsBoard() {
  const isMobile = useIsMobile();
  const [ops, setOps] = useState(OPS_INIT);
  const [newTask, setNewTask] = useState("");
  const [editing, setEditing] = useState(null); // { col, id }
  const [editValue, setEditValue] = useState("");

  const addTask = () => {
    if (!newTask.trim()) return;
    setOps(prev => ({ ...prev, backlog:[...prev.backlog,{ id:Date.now().toString(), title:newTask, agent:"Unassigned" }] }));
    setNewTask("");
  };

  const removeTask = (colKey, id) => {
    setOps(prev => ({ ...prev, [colKey]: prev[colKey].filter(t => t.id !== id) }));
  };

  const startEdit = (colKey, task) => {
    setEditing({ col: colKey, id: task.id });
    setEditValue(task.title);
  };
  const saveEdit = () => {
    if (!editing) return;
    const trimmed = editValue.trim();
    if (!trimmed) { setEditing(null); return; }
    setOps(prev => ({
      ...prev,
      [editing.col]: prev[editing.col].map(t => t.id === editing.id ? { ...t, title: trimmed } : t),
    }));
    setEditing(null);
  };

  const cols = [
    { key:"backlog",    label:"Backlog",     color:"rgba(255,255,255,0.5)" },
    { key:"inProgress", label:"In Progress", color:"#ff9f0a" },
    { key:"completed",  label:"Completed",   color:"#2AABFF" },
  ];

  return (
    <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:12 }}>
      {cols.map(col => (
        <div key={col.key} style={{ flex:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.6)" }}>{col.label}</span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.07)", padding:"2px 8px", borderRadius:20, fontWeight:500 }}>{ops[col.key].length}</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {ops[col.key].map((task,i) => {
              const isEditing = editing && editing.col === col.key && editing.id === task.id;
              return (
                <Card key={task.id} style={{ padding:"12px 14px", borderLeft:"3px solid rgba(255,255,255,0.08)", borderRadius:12, animation:i===0&&col.key==="inProgress"?"slideIn 0.3s ease":"none", position:"relative" }}>
                  <button
                    onClick={() => removeTask(col.key, task.id)}
                    title="Remove task"
                    style={{ position:"absolute", top:6, right:6, width:20, height:20, borderRadius:6, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.45)", fontSize:11, lineHeight:"18px", cursor:"pointer", padding:0, fontFamily:"Inter, sans-serif" }}
                  >×</button>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={e => { if (e.key==="Enter") saveEdit(); if (e.key==="Escape") setEditing(null); }}
                      style={{ width:"calc(100% - 30px)", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(42,171,255,0.4)", borderRadius:6, padding:"4px 8px", color:"#ffffff", fontSize:12, fontWeight:500, outline:"none", fontFamily:"Inter, sans-serif", marginBottom:4 }}
                    />
                  ) : (
                    <div
                      onClick={() => startEdit(col.key, task)}
                      title="Click to edit"
                      style={{ fontSize:12, color:"#ffffff", fontWeight:500, marginBottom:4, lineHeight:1.4, cursor:"text", paddingRight:24 }}
                    >{task.title}</div>
                  )}
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{task.agent}</div>
                  {col.key==="inProgress" && <div style={{ marginTop:10, height:2, background:"rgba(255,255,255,0.05)", borderRadius:2 }}><div style={{ height:"100%", width:"55%", background:"rgba(255,255,255,0.2)", borderRadius:2, animation:"progressBar 28s linear forwards" }} /></div>}
                </Card>
              );
            })}
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
