import React from 'react';

// ── lazyRoute + RouteErrorBoundary (2026-09-18, stress-test failure #2) ──────
// Every deploy renames the route chunks. A tab opened BEFORE a deploy still
// holds the old names, so the first visit to a page it has not loaded yet asks
// for a file that no longer exists (404), the dynamic import rejects, and with
// no error boundary anywhere the whole app unmounted to a blank white page.
//
// lazyRoute: when a chunk fails to load, reload the page once to pick up the
// new build (activeNav is persisted, so the user lands where they were going).
// The 30 s guard stops a reload loop if the failure is something else.
const RELOAD_KEY = 'vantus_chunk_reload_at';

export function lazyRoute(loader) {
  return React.lazy(() => loader().catch((err) => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0); } catch {}
    if (Date.now() - last > 30000) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch {}
      window.location.reload();
      return new Promise(() => {});          // hold the Suspense fallback until the reload lands
    }
    throw err;
  }));
}

// A crash inside one page must never blank the sidebar and every other page.
// Keyed by the active nav in AppRoutes, so moving to another page recovers.
export class RouteErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[route crash]', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 48, maxWidth: 520, color: 'rgba(255,255,255,0.75)', fontFamily: '-apple-system, Inter, sans-serif' }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>THIS PAGE HIT AN ERROR</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 10 }}>The rest of Vantus is fine.</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>Reload to try this page again, or pick another page from the sidebar. If it keeps happening, send Christian this line:</div>
        <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', background: 'rgba(255,255,255,0.06)', padding: '10px 12px', borderRadius: 8, marginBottom: 18, wordBreak: 'break-word' }}>{String(this.state.error?.message || this.state.error).slice(0, 240)}</div>
        <button onClick={() => window.location.reload()} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Reload</button>
      </div>
    );
  }
}
