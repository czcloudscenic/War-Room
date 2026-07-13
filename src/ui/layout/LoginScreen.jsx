import React, { useState } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import { sb } from '../../services/supabaseClient.js';

// Parse error info from URL params (both ?error= query and #error= hash)
function parseUrlError() {
  const out = {};
  try {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    for (const k of ["error", "error_code", "error_description", "message"]) {
      const v = q.get(k) || h.get(k);
      if (v) out[k] = decodeURIComponent(v.replace(/\+/g, " "));
    }
  } catch {}
  return out;
}

export default function LoginScreen() {
  const isMobile = useIsMobile();
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [urlError, setUrlError] = useState(parseUrlError());

  // .lg-* styles live in src/styles/globals.css (moved out of a runtime <style>
  // injection so CSP style-src doesn't need 'unsafe-inline').

  const handleGoogleSignIn = async () => {
    setLoading(true); setError("");
    const { error: err } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { hd: 'cloudscenic.com' },
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", minHeight:"100dvh", background:"#000", position:"relative", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter, sans-serif" }}>

      {/* Aggressive orange haze background */}
      <div style={{ position:"absolute", inset:0, zIndex:0, background:"radial-gradient(ellipse 95% 70% at 50% 0%, #4a2810 0%, #1e1207 45%, #0a0705 100%)" }} />

      {/* Radial gradient — focuses eye on center */}
      <div style={{ position:"absolute", inset:0, zIndex:2, background:"radial-gradient(ellipse 65% 75% at 50% 50%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.30) 65%, rgba(0,0,0,0.70) 100%)", pointerEvents:"none" }} />

      {/*  LIQUID GLASS LOGIN BOX  */}
      <div className="lg-box" style={{ position:"relative", zIndex:10, width: isMobile ? "calc(100vw - 36px)" : 370, padding: isMobile ? "36px 24px 40px" : "48px 44px" }}>

        <div style={{ marginBottom:32, textAlign:"center" }}>
          <div style={{ width:64, height:64, margin:"0 auto 18px" }}>
            <img src="/vantus-logo.png" style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }} />
          </div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.38)", letterSpacing:3, textTransform:"uppercase", fontWeight:600, marginBottom:7 }}>Cloud Scenic</div>
          <h1 style={{ fontSize:24, fontWeight:500, color:"#fff", margin:"0 0 5px", letterSpacing:-0.5 }}>Vantus</h1>
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", margin:0 }}>Content Operations Dashboard</p>
        </div>

        <button onClick={handleGoogleSignIn} disabled={loading} className="lg-google-btn">
          <svg className="lg-google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? "Redirecting to Google…" : "Continue with Google"}
        </button>

        {(error || Object.keys(urlError).length > 0) && (
          <div style={{ fontSize:11, color:"rgba(255,180,170,0.95)", marginTop:14, padding:"12px 14px", background:"rgba(255,50,50,0.10)", borderRadius:8, border:"1px solid rgba(255,60,60,0.18)", whiteSpace:"pre-wrap", wordBreak:"break-word", fontFamily:"Geist Mono, monospace", lineHeight:1.5 }}>
            {error && <div>{error}</div>}
            {urlError.error_description && <div><b>{urlError.error_description}</b></div>}
            {urlError.error_code && <div>code: {urlError.error_code}</div>}
            {urlError.error && !urlError.error_description && <div>error: {urlError.error}</div>}
            {urlError.message && <div>{urlError.message}</div>}
          </div>
        )}

        <div style={{ marginTop:22, textAlign:"center" }}>
          <p style={{ fontSize:10, color:"rgba(255,255,255,0.28)", margin:0, lineHeight:1.6 }}>
            Sign in with your @cloudscenic.com Google account
          </p>
        </div>
      </div>

    </div>
  );
}
