import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { apiFetch } from '../../services/apiFetch.js';

// One row per platform. Add to PLATFORMS as we wire each integration.
const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', dot: '#dc2743', startEndpoint: '/api/oauth/instagram/start', syncEndpoint: '/api/sync/instagram' },
  { id: 'tiktok',    label: 'TikTok',    dot: '#ff0050', startEndpoint: null,   comingSoon: true },
  { id: 'youtube',   label: 'YouTube',   dot: '#ff0000', startEndpoint: null,   comingSoon: true },
  { id: 'linkedin',  label: 'LinkedIn',  dot: '#0a66c2', startEndpoint: null,   comingSoon: true },
];

export default function ConnectedAccountsCard({ S }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});     // per-platform spinner
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await sb
        .from('connected_accounts')
        .select('id,platform,handle,display_name,avatar_url,fetched_at,meta,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAccounts(data || []);
    } catch (e) {
      console.warn('[connected-accounts] load failed', e);
      setToast({ ok: false, msg: 'Could not load accounts: ' + (e.message || 'unknown') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Read ?ig_connected=1 / ?ig_oauth_error=... from URL on mount (callback redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ig_connected') === '1') {
      setToast({ ok: true, msg: '✅ Instagram connected' });
      // Clean up the URL
      window.history.replaceState({}, '', window.location.pathname);
      load();
    } else if (params.get('ig_oauth_error')) {
      const reason = params.get('ig_oauth_error');
      setToast({ ok: false, msg: `❌ Instagram connect failed: ${reason}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [load]);

  const startConnect = async (platform) => {
    const def = PLATFORMS.find(p => p.id === platform);
    if (!def || !def.startEndpoint) return;
    setBusy(b => ({ ...b, [platform]: true }));
    try {
      const res = await apiFetch(def.startEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectTo: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok || !data.authorizeUrl) {
        throw new Error(data.error || `start returned ${res.status}`);
      }
      // Top-level redirect to the platform's OAuth screen
      window.location.assign(data.authorizeUrl);
    } catch (e) {
      setBusy(b => ({ ...b, [platform]: false }));
      setToast({ ok: false, msg: `Connect failed: ${e.message}` });
    }
  };

  const disconnect = async (accountId, platform) => {
    if (!confirm(`Disconnect this ${platform} account? Vantus will lose access to its data.`)) return;
    setBusy(b => ({ ...b, [platform]: true }));
    try {
      const { error } = await sb.from('connected_accounts').delete().eq('id', accountId);
      if (error) throw error;
      setAccounts(prev => prev.filter(a => a.id !== accountId));
      setToast({ ok: true, msg: `Disconnected ${platform}` });
    } catch (e) {
      setToast({ ok: false, msg: `Disconnect failed: ${e.message}` });
    } finally {
      setBusy(b => ({ ...b, [platform]: false }));
    }
  };

  const syncNow = async (accountId, platform) => {
    const def = PLATFORMS.find(p => p.id === platform);
    if (!def?.syncEndpoint) return;
    setBusy(b => ({ ...b, [`${platform}_sync`]: true }));
    setToast(null);
    try {
      const res = await apiFetch(def.syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `sync returned ${res.status}`);
      setToast({ ok: true, msg: `✅ Synced ${data.synced} ${platform} posts` });
      load();
    } catch (e) {
      setToast({ ok: false, msg: `Sync failed: ${e.message}` });
    } finally {
      setBusy(b => ({ ...b, [`${platform}_sync`]: false }));
    }
  };

  return (
    <div style={S.card}>
      <h3 style={S.cardTitle}>Connected Accounts</h3>
      <div style={S.cardSub}>Link the platforms Vantus should analyze</div>

      {toast && (
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 10,
          fontSize: 12,
          color: toast.ok ? '#34C759' : '#ff453a',
          background: toast.ok ? 'rgba(52,199,89,0.06)' : 'rgba(255,69,58,0.06)',
          border: `1px solid ${toast.ok ? 'rgba(52,199,89,0.2)' : 'rgba(255,69,58,0.2)'}`,
        }}>{toast.msg}</div>
      )}

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PLATFORMS.map(p => {
          const linked = accounts.filter(a => a.platform === p.id);
          const isBusy = !!busy[p.id];

          return (
            <div key={p.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: 5,
                background: p.dot, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7', marginBottom: 2 }}>
                  {p.label}
                </div>
                {linked.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {p.comingSoon ? 'Coming soon' : 'Not connected'}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                    {linked.map(a => `@${a.handle || a.display_name || a.id}`).join(', ')}
                    {linked[0].fetched_at && (
                      <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.35)' }}>
                        · synced {new Date(linked[0].fetched_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {p.comingSoon ? (
                <span style={{
                  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
                  padding: '5px 10px', background: 'rgba(255,255,255,0.04)',
                  borderRadius: 8,
                }}>Soon</span>
              ) : linked.length === 0 ? (
                <button
                  onClick={() => startConnect(p.id)}
                  disabled={isBusy || loading}
                  style={{
                    fontSize: 11, fontWeight: 600, color: '#fff',
                    background: '#2AABFF', border: 'none', borderRadius: 8,
                    padding: '6px 14px', cursor: isBusy ? 'default' : 'pointer',
                    opacity: isBusy ? 0.5 : 1, fontFamily: 'Inter, sans-serif',
                  }}>
                  {isBusy ? 'Opening…' : 'Connect'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  {p.syncEndpoint && (
                    <button
                      onClick={() => syncNow(linked[0].id, p.id)}
                      disabled={!!busy[`${p.id}_sync`]}
                      style={{
                        fontSize: 11, fontWeight: 600, color: '#fff',
                        background: '#2AABFF', border: 'none', borderRadius: 8,
                        padding: '6px 12px', cursor: busy[`${p.id}_sync`] ? 'default' : 'pointer',
                        opacity: busy[`${p.id}_sync`] ? 0.5 : 1, fontFamily: 'Inter, sans-serif',
                      }}>
                      {busy[`${p.id}_sync`] ? 'Syncing…' : 'Sync now'}
                    </button>
                  )}
                  <button
                    onClick={() => disconnect(linked[0].id, p.id)}
                    disabled={isBusy}
                    style={{
                      fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8, padding: '6px 12px', cursor: isBusy ? 'default' : 'pointer',
                      opacity: isBusy ? 0.5 : 1, fontFamily: 'Inter, sans-serif',
                    }}>
                    {isBusy ? '…' : 'Disconnect'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
