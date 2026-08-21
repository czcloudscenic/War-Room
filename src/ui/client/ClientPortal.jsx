// ClientPortal — the slim external-client approval surface.
//
// Approved client_users land here instead of the admin shell (App.jsx renders
// this when role === 'client'). It shows ONLY items sitting at an approval
// gate with approval_mode='client', plus a collapsed recently-decided list.
// Reads go straight to Supabase with the client's own session (RLS scopes
// them); decisions go through POST /api/approval (approvals INSERT is
// admin/service-key-only under RLS — never recordApproval from here).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { sb } from '../../services/supabaseClient';
import PortalItemCard from './PortalItemCard.jsx';

const GATE_STATUSES = ['Need Copy Approval', 'Need Content Approval'];
const DECIDED_STATUSES = ['Approved', 'Needs Revisions', 'Ready For Content Creation', 'Ready For Schedule', 'Scheduled', 'Posted'];

export default function ClientPortal({ session, clientIds, onSignOut }) {
  const [clients, setClients] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDecided, setShowDecided] = useState(false);

  const email = session?.user?.email || '';

  const load = useCallback(async () => {
    if (!sb || !clientIds?.length) { setLoading(false); return; }
    const [cRes, iRes] = await Promise.all([
      sb.from('clients').select('id, name, logo_url, brand_color, included_revisions').in('id', clientIds),
      sb.from('content_items')
        .select('*')
        .in('client_id', clientIds)
        .eq('approval_mode', 'client')
        .order('updated_at', { ascending: false }),
    ]);
    if (!cRes.error) setClients(cRes.data || []);
    if (!iRes.error) setItems((iRes.data || []).map(r => ({ ...r, platforms: r.platforms || [] })));
    setLoading(false);
  }, [clientIds]);

  useEffect(() => { load(); }, [load]);

  // Live updates: any change to this client's items refreshes the row in place.
  useEffect(() => {
    if (!sb || !clientIds?.length) return;
    const filter = clientIds.length === 1
      ? `client_id=eq.${clientIds[0]}`
      : `client_id=in.(${clientIds.join(',')})`;
    const ch = sb.channel('portal_content')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_items', filter }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setItems(prev => prev.map(x => x.id === payload.new.id ? { ...payload.new, platforms: payload.new.platforms || [] } : x));
        } else if (payload.eventType === 'INSERT') {
          setItems(prev => prev.some(x => x.id === payload.new.id) ? prev : [{ ...payload.new, platforms: payload.new.platforms || [] }, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setItems(prev => prev.filter(x => x.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => sb.removeChannel(ch);
  }, [clientIds]);

  const clientById = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);
  const awaiting = useMemo(() => items.filter(x => GATE_STATUSES.includes(x.status)), [items]);
  const decided = useMemo(() => items.filter(x => DECIDED_STATUSES.includes(x.status)).slice(0, 10), [items]);

  const brandName = clients.length === 1 ? clients[0]?.name : 'Content Review';
  const accent = clients[0]?.brand_color || '#2AABFF';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: "-apple-system, Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {clients.length === 1 && clients[0]?.logo_url && (
            <img src={clients[0].logo_url} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>{brandName}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 1 }}>Content approval portal</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{email}</span>
          <button onClick={onSignOut} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 80px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading your review queue…</div>
        )}

        {!loading && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: -0.4 }}>Awaiting your review</h2>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{awaiting.length} item{awaiting.length === 1 ? '' : 's'}</span>
            </div>

            {awaiting.length === 0 && (
              <div style={{ padding: '44px 24px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.14)', borderRadius: 14, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                Nothing waiting on you — you're all caught up. New items appear here the moment they're ready.
              </div>
            )}

            {awaiting.map(item => (
              <PortalItemCard
                key={item.id}
                item={item}
                client={clientById[item.client_id]}
                accent={accent}
                showClientName={clients.length > 1}
              />
            ))}

            {decided.length > 0 && (
              <div style={{ marginTop: 36 }}>
                <button
                  onClick={() => setShowDecided(v => !v)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, letterSpacing: 0.3 }}
                >
                  {showDecided ? '▾' : '▸'} Recently decided ({decided.length})
                </button>
                {showDecided && (
                  <div style={{ marginTop: 12 }}>
                    {decided.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', marginBottom: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{item.title}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', padding: '3px 10px', borderRadius: 20, color: item.status === 'Needs Revisions' ? '#E5E5EA' : '#30d158', background: item.status === 'Needs Revisions' ? 'rgba(229,229,234,0.12)' : 'rgba(48,209,88,0.12)' }}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
