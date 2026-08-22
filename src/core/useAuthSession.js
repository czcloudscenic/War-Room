// ── useAuthSession (extracted from App.jsx, 2026-08-22 decomposition) ────────
// The entire boot/auth machine: getSession + stuckGuard, the 3s-raced health
// check, admin vs external-client role resolution, pending-invite realtime,
// scoped content preload, sign-out. Behavior-preserving move — every fix that
// lives here (stuckGuard 8s, raced timeboxes, setupSession dedupe, first-login
// stamping) predates the extraction; see App.jsx git history for their whys.
import { useState, useEffect, useRef } from 'react';
import { sb } from '../services/supabaseClient.js';
import { apiFetch } from '../services/apiFetch.js';

const ADMIN_EMAILS = ["cz@cloudscenic.com","dv@cloudscenic.com","ss@cloudscenic.com"];
const ALLOWED_DOMAIN = "cloudscenic.com";

// Working-set bound (Fix #7, admin half): admins load all unposted work plus
// items posted within this window. Older posted rows stay in the DB untouched —
// an all-time History view is the future home for them if ever needed.
const ACTIVE_CONTENT_DAYS = 90;
const activeContentCutoff = () => new Date(Date.now() - ACTIVE_CONTENT_DAYS * 86400000).toISOString();


export { ADMIN_EMAILS, activeContentCutoff };

export function useAuthSession() {

  const [session, setSession] = useState(null);
  const [role, setRole]       = useState(null);
  const [checking, setChecking] = useState(true);
  const [content, setContent] = useState([]);
  // pendingInvite: { email, client_users_id, client_id } when the signed-in
  // email exists in client_users but status is still 'pending'. Drives the
  // "awaiting approval" screen + realtime listener that flips state when admin approves.
  const [pendingInvite, setPendingInvite] = useState(null);
  const [clientIds, setClientIds] = useState([]); // for external client users — which client(s) they belong to

  // Dedupe setupSession so it runs at most once per unique user.id.
  // Without this, SIGNED_IN + INITIAL_SESSION + getSession all fire in parallel
  // on OAuth redirect-back, fighting over the supabase-js auth lock (5s timeout
  // → "Lock broken with steal option" AbortError → spinner hangs forever).
  const setupRanForRef = useRef(null);

  // Shared session-setup logic for both initial load + auth state changes
  const setupSession = async (s) => {
    if (!s?.user) return;
    if (setupRanForRef.current === s.user.id) {
      console.log("[auth] setupSession skipped (already ran for this user)");
      return;
    }
    setupRanForRef.current = s.user.id;

    const email = (s?.user?.email || "").toLowerCase();
    console.log("[auth] setupSession start", { email, userId: s?.user?.id });

    // ── HEALTH CHECK ─────────────────────────────────────────────────────────
    // After supabase-js says the session is valid, verify the token actually
    // works server-side by hitting /auth/v1/user (sb.auth.getUser). The recurring
    // "page down after deploy" pattern was: localStorage held a token that
    // supabase-js trusted (so onAuthStateChange + getSession both fired SIGNED_IN)
    // but the server had since rotated/invalidated it. Queries silently returned
    // 401/403, the UI rendered empty, and the user had to nuke localStorage by
    // hand. This check catches that case and auto-recovers once.
    // On a normal page reload the access token can be briefly expired-but-
    // refreshable — so if the server check fails, try a REFRESH before doing
    // anything destructive. Only a genuinely dead session (refresh also fails)
    // signs the user out. (Previously this nuked localStorage + reloaded, which
    // turned a hard refresh — Cmd-Shift-R — into a full sign-out.)
    // Every await here is time-boxed: on a flapping network a bare fetch can sit
    // 30s+ in the OS retry path, and this block runs BEFORE first paint — it was
    // the 15-40s boot spinner. Timeout = proceed with the stored session (same
    // trust level as the network-error branch below); only an explicit server
    // rejection on BOTH getUser and refresh signs the user out.
    const HEALTH_TIMEOUT_MS = 3000;
    const TIMED_OUT = Symbol("timeout");
    const raced = (p) => Promise.race([p, new Promise(res => setTimeout(() => res(TIMED_OUT), HEALTH_TIMEOUT_MS))]);
    try {
      const userRes = await raced(sb.auth.getUser());
      if (userRes === TIMED_OUT) {
        console.warn("[auth health] getUser timed out — proceeding; queries will surface real issues");
      } else {
        const { data: userData, error: userErr } = userRes;
        let healthy = !userErr && userData?.user?.id;
        if (!healthy) {
          const refRes = await raced(sb.auth.refreshSession().catch(() => TIMED_OUT));
          if (refRes === TIMED_OUT) {
            console.warn("[auth health] refresh unavailable — proceeding with stored session");
          } else if (!refRes.error && refRes.data?.session?.user?.id) {
            healthy = true; s = refRes.data.session;
          } else {
            console.warn("[auth health] session unrecoverable, signing out", { userErr });
            await sb.auth.signOut();
            setSession(null); setRole(null);
            return;
          }
        }
      }
    } catch (e) {
      // Network error talking to /auth/v1/user — keep the session; queries will surface real issues.
      console.warn("[auth health] check threw, proceeding anyway", e);
    }

    // Admin path: @cloudscenic.com → full agency access
    if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      let detectedRole = ADMIN_EMAILS.includes(email) ? "admin" : "client";
      setSession(s);
      setRole(detectedRole);
      setPendingInvite(null);

      // Best-effort: fetch profile + content. If RLS rejects, log and continue.
      // Profile stays awaited (profiles.role can DOWNGRADE an admin-email user —
      // rendering before it lands would flash admin nav) but is time-boxed like
      // the health check. Content is NOT awaited — it was an uncapped pre-paint
      // fetch; the shell renders now and rows stream in behind it.
      try {
        const profRes = await raced(sb.from("profiles").select("role").eq("id", s.user.id).maybeSingle());
        if (profRes === TIMED_OUT) {
          console.warn("[auth] profile query timed out — role stays", detectedRole);
        } else {
          const { data: profile, error: profErr } = profRes;
          if (profErr) console.warn("[auth] profile query error", profErr);
          if (profile?.role && profile.role !== detectedRole) {
            detectedRole = profile.role;
            setRole(detectedRole);
          }
        }
      } catch (e) { console.warn("[auth] profile query threw", e); }

      (async () => {
        try {
          const { data: items, error: itemsErr } = await sb
            .from("content_items").select("*")
            .or(`posted_at.is.null,posted_at.gte.${activeContentCutoff()}`)
            .order("id");
          if (itemsErr) console.warn("[auth] content_items error", itemsErr);
          if (items) setContent(items.map(r => ({ ...r, platforms: r.platforms || [] })));
        } catch (e) { console.warn("[auth] content_items threw", e); }
      })();

      console.log("[auth] setupSession ok (admin)", { email, role: detectedRole });
      return;
    }

    // External-client path: look up in client_users allowlist
    let inviteRows = [];
    try {
      const { data, error } = await sb
        .from("client_users")
        .select("id, client_id, status, first_login_at")
        .eq("email", email);
      if (error) console.warn("[auth] client_users lookup error", error);
      inviteRows = data || [];
    } catch (e) {
      console.warn("[auth] client_users lookup threw", e);
    }

    const approved = inviteRows.filter(r => r.status === "approved");
    const pending  = inviteRows.filter(r => r.status === "pending");
    const rejected = inviteRows.filter(r => r.status === "rejected");

    // Approved external client → into ClientView, scoped to their client_id(s)
    if (approved.length > 0) {
      setSession(s);
      setRole("client");
      const clientScope = approved.map(r => r.client_id);
      setClientIds(clientScope);
      setPendingInvite(null);

      // Defense in depth: load ONLY this client's content, explicitly scoped.
      // RLS already bounds what a client can SELECT, but scoping here means a
      // client's browser never holds another tenant's rows even if a policy
      // regressed. (Admins load all clients' active work, recency-bounded —
      // Reports/Client Analytics fetch their own scoped rows; Ledger rides the
      // bounded blob by design.)
      try {
        const { data: items } = await sb
          .from("content_items").select("*").in("client_id", clientScope).order("id");
        if (items) setContent(items.map(r => ({ ...r, platforms: r.platforms || [] })));
      } catch (e) { console.warn("[auth] client content_items threw", e); }

      // Stamp first_login_at if it's never been set (silent best-effort)
      const needsStamp = approved.filter(r => !r.first_login_at).map(r => r.id);
      if (needsStamp.length > 0) {
        sb.from("client_users")
          .update({ first_login_at: new Date().toISOString() })
          .in("id", needsStamp).then(() => {});
      }
      console.log("[auth] setupSession ok (client)", { email, client_ids: approved.map(r => r.client_id) });
      return;
    }

    // Pending invite → show "awaiting approval" screen, don't sign out
    if (pending.length > 0) {
      console.log("[auth] invite pending admin approval", { email });
      setPendingInvite({
        email,
        rows: pending,
      });
      setSession(s);
      setRole(null);

      // Stamp first_login_at + fire admin notification on FIRST login attempt only
      const firstTime = pending.filter(r => !r.first_login_at);
      if (firstTime.length > 0) {
        const ids = firstTime.map(r => r.id);
        sb.from("client_users")
          .update({ first_login_at: new Date().toISOString() })
          .in("id", ids).then(() => {});

        // Fire notification (best-effort, non-blocking)
        apiFetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "client_invite_first_login",
            item: {
              title: `${email} requested access`,
              campaign: "Client invite",
              platform: "Auth",
              pillar: "Access",
              client_note: `Approve in Clients → Team panel for client ${pending[0].client_id}.`,
              id: pending[0].id,
              client_id: pending[0].client_id,
            },
            client_id: pending[0].client_id,
          }),
        }).catch(() => {});
      }
      return;
    }

    // Rejected or unknown → block
    setupRanForRef.current = null;
    await sb.auth.signOut();
    setSession(null); setRole(null); setPendingInvite(null);
    if (rejected.length > 0) {
      alert(`Access denied for ${email}. Contact the agency if you think this is a mistake.`);
    } else {
      alert(`${email} is not on the invite list. Ask Cloud Scenic to invite you, then try again.`);
    }
  };

  useEffect(() => {
    let cancelled = false;

    // Fix #15 — auth-lock auto-recovery.
    // supabase-js holds a navigator.locks mutex around getSession()/signOut().
    // If a prior tab crashed mid-call (or the user has stale localStorage),
    // the lock can deadlock — getSession() never resolves and the whole app
    // hangs. Manual fix used to be `localStorage.clear(); reload()`.
    // Now we do it automatically: stuckGuard fires after 4s, clears just the
    // sb-*-auth-token keys, and reloads once. A sessionStorage flag prevents
    // an infinite reload loop if the second attempt also hangs.
    const RECOVERY_FLAG = "vantus_auth_recovery_attempted";

    let stuckGuard = setTimeout(() => {
      if (cancelled) return;
      // NON-DESTRUCTIVE: if getSession() stalls (supabase-js navigator.locks can
      // hang on some reloads), do NOT touch the stored token — just drop the
      // checking spinner. The session stays intact in localStorage, and
      // onAuthStateChange's INITIAL_SESSION/SIGNED_IN event will still deliver it
      // and run setupSession. (Previously this wiped sb-*-auth-token + reloaded,
      // which on a hard refresh — Cmd-Shift-R — signed the user out entirely.)
      console.warn("[auth] stuckGuard fired — dropping spinner; session left intact");
      setChecking(false);
    }, 8000);

    // Cancel the guard the moment auth resolves — success OR confirmed signed-out.
    // Without this, opening Vantus in a second tab would race the 8s timer:
    // tab 2 resolves its session in ~5s (second-tab navigator.locks is slower),
    // but the guard still fired and wiped tokens for BOTH tabs.
    const clearStuckGuard = () => {
      if (stuckGuard) { clearTimeout(stuckGuard); stuckGuard = null; }
    };

    // Initial session check (handles OAuth redirect-back: supabase-js reads
    // the auth fragment from the URL before getSession resolves)
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      if (cancelled) return;
      clearStuckGuard();
      console.log("[auth] getSession initial", { hasSession: !!s, email: s?.user?.email });
      if (s) {
        try { await setupSession(s); }
        catch (e) { console.error("[auth] setupSession failed (initial)", e); }
      }
      setChecking(false); // drop the spinner only after setup — never flash LoginScreen mid-auth
    });
    // Handle subsequent auth events (SIGNED_IN, SIGNED_OUT, INITIAL_SESSION, TOKEN_REFRESHED)
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, s) => {
      console.log("[auth] onAuthStateChange", event, { hasSession: !!s, email: s?.user?.email });
      clearStuckGuard();
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s) {
        // Clear recovery flag so the next time we get stuck, auto-recovery can fire again
        try { sessionStorage.removeItem(RECOVERY_FLAG); } catch {}
        try { await setupSession(s); }
        catch (e) { console.error("[auth] setupSession failed (event)", e); }
      }
      // Drop the spinner only after setup ran (or it's a sign-out) — no LoginScreen flash mid-auth.
      setChecking(false);
      if (event === "SIGNED_OUT") {
        setupRanForRef.current = null;
        setSession(null);
        setRole(null);
        setPendingInvite(null);
        setClientIds([]);
      }
    });
    return () => {
      cancelled = true;
      clearStuckGuard();
      subscription?.unsubscribe();
    };
  }, []);

  // While stuck on "awaiting approval", listen for admin to flip our row to 'approved'
  useEffect(() => {
    if (!pendingInvite?.email) return;
    const channel = sb.channel(`client_users:${pendingInvite.email}`)
      .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "client_users", filter: `email=eq.${pendingInvite.email}` },
          (payload) => {
            console.log("[auth] pending invite update", payload.new);
            if (payload.new?.status === "approved") {
              // Re-run setupSession with the current session to flip into client view
              setupRanForRef.current = null;
              sb.auth.getSession().then(({ data: { session: s } }) => { if (s) setupSession(s); });
            }
            if (payload.new?.status === "rejected") {
              sb.auth.signOut();
            }
          })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [pendingInvite?.email]);

  const handleSignOut = async () => {
    await sb.auth.signOut();
    setSession(null); setRole(null); setPendingInvite(null); setClientIds([]);
  };


  return { session, role, checking, pendingInvite, clientIds, content, setContent, handleSignOut };
}
