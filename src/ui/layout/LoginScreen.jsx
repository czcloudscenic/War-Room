import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import { sb } from '../../services/supabaseClient.js';

export default function LoginScreen({ onLogin }) {
  const isMobile = useIsMobile();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (document.getElementById('lg-css')) return;
    const s = document.createElement('style');
    s.id = 'lg-css';
    s.textContent = `
      .lg-box {
        background: rgba(255,255,255,0.04);
        backdrop-filter: blur(52px);
        -webkit-backdrop-filter: blur(52px);
        box-shadow: 4px 4px 28px rgba(0,0,0,0.35),
                    inset 0 1px 1px rgba(255,255,255,0.15);
        position: relative;
        overflow: hidden;
        border-radius: 24px;
      }
      .lg-box::before {
        content: '';
        position: absolute;
        inset: 0;
        padding: 0.8px;
        border-radius: 24px;
        background: linear-gradient(160deg,
          rgba(255,255,255,0.55) 0%,
          rgba(255,255,255,0.18) 25%,
          transparent 45%,
          transparent 55%,
          rgba(255,255,255,0.18) 75%,
          rgba(255,255,255,0.55) 100%
        );
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }
      .lg-input {
        width: 100%;
        background: rgba(255,255,255,0.07);
        border: none;
        border-bottom: 1px solid rgba(255,255,255,0.18);
        border-radius: 10px 10px 0 0;
        padding: 13px 16px;
        font-size: 14px;
        color: #fff;
        outline: none;
        font-family: Inter, sans-serif;
        margin-bottom: 14px;
        box-sizing: border-box;
        transition: background 0.2s, border-color 0.2s;
      }
      .lg-input:focus {
        background: rgba(255,255,255,0.11);
        border-bottom-color: rgba(42,171,255,0.7);
      }
      .lg-input::placeholder { color: rgba(255,255,255,0.28); }
      .lg-btn {
        width: 100%;
        padding: 14px;
        font-size: 13px;
        font-weight: 600;
        color: #fff;
        letter-spacing: 0.4px;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-family: Inter, sans-serif;
        background: rgba(42,171,255,0.22);
        backdrop-filter: blur(10px);
        box-shadow: inset 0 1px 1px rgba(255,255,255,0.20), 0 0 24px rgba(42,171,255,0.12);
        position: relative;
        overflow: hidden;
        transition: transform 0.15s, background 0.2s;
      }
      .lg-btn::before {
        content: '';
        position: absolute;
        inset: 0;
        padding: 0.8px;
        border-radius: 12px;
        background: linear-gradient(160deg,
          rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 30%,
          transparent 50%, transparent 70%,
          rgba(255,255,255,0.15) 85%, rgba(255,255,255,0.55) 100%
        );
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
      }
      .lg-btn:hover:not(:disabled) { transform:scale(1.02); background:rgba(42,171,255,0.32); }
      .lg-btn:active:not(:disabled) { transform:scale(0.98); }
      .lg-btn:disabled { opacity:0.45; cursor:not-allowed; }
    `;
    document.head.appendChild(s);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) { setError("Email and password required."); return; }
    setLoading(true); setError("");
    const { data, error: err } = await sb.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    const ADMIN_EMAILS = ["cz@cloudscenic.com","dv@cloudscenic.com","ss@cloudscenic.com"];
    const { data: profile } = await sb.from("profiles").select("role").eq("id", data.user.id).single();
    const role = profile?.role || (ADMIN_EMAILS.includes(data.user.email) ? "admin" : "client");
    onLogin(data.user, role);
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", minHeight:"100dvh", background:"#000", position:"relative", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter, sans-serif" }}>

      {/*  FULL SCREEN WATERFALL VIDEO  */}
      <video
        autoPlay muted loop playsInline
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", zIndex:0 }}
        src="https://wjcstqqihtebkpyuacop.supabase.co/storage/v1/object/public/Video%20Assest/waterfall-loop.mp4"
      />

      {/* Dark overlay — preserves moody feel */}
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.48)", zIndex:1 }} />

      {/* Radial gradient — focuses eye on center */}
      <div style={{ position:"absolute", inset:0, zIndex:2, background:"radial-gradient(ellipse 65% 75% at 50% 50%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.30) 65%, rgba(0,0,0,0.70) 100%)", pointerEvents:"none" }} />

      {/*  LIQUID GLASS LOGIN BOX  */}
      <div className="lg-box" style={{ position:"relative", zIndex:10, width: isMobile ? "calc(100vw - 36px)" : 370, padding: isMobile ? "36px 24px 40px" : "48px 44px" }}>

        <div style={{ marginBottom:32, textAlign:"center" }}>
          <div style={{ width:52, height:52, borderRadius:13, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", padding:8 }}>
            <img src="data:image/png;base64,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" style={{ width:"100%", height:"100%", objectFit:"contain", filter:"brightness(0) invert(1)" }} />
          </div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.38)", letterSpacing:3, textTransform:"uppercase", fontWeight:600, marginBottom:7 }}>Cloud Scenic</div>
          <h1 style={{ fontSize:24, fontWeight:500, color:"#fff", margin:"0 0 5px", letterSpacing:-0.5 }}>Vantus</h1>
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", margin:0 }}>VitalLyfe Content Operations</p>
        </div>

        <div>
          <label style={{ fontSize:9, fontWeight:700, letterSpacing:1.8, textTransform:"uppercase", color:"rgba(255,255,255,0.40)", display:"block", marginBottom:6 }}>Email</label>
          <input className="lg-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="you@cloudscenic.com" />
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:9, fontWeight:700, letterSpacing:1.8, textTransform:"uppercase", color:"rgba(255,255,255,0.40)", display:"block", marginBottom:6 }}>Password</label>
          <input className="lg-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••••" />
        </div>

        {error && (
          <div style={{ fontSize:11, color:"rgba(255,110,100,0.95)", marginBottom:14, padding:"9px 13px", background:"rgba(255,50,50,0.08)", borderRadius:8, border:"1px solid rgba(255,60,60,0.15)" }}>
            {error}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading} className="lg-btn">
          {loading ? "Signing in…" : "Enter Vantus →"}
        </button>

        <div style={{ marginTop:22, display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2s infinite" }} />
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.22)" }}>Live operations</span>
        </div>
      </div>

    </div>
  );
}
