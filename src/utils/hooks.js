// ── React Hooks ──
import { useState, useEffect, useRef } from 'react';

//  PLATFORM DETECTION
export const getIsMobile = () => {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());
  const isSmallScreen = window.innerWidth < 768;
  return isMobileUA || isSmallScreen;
};

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getIsMobile);
  useEffect(() => {
    const handler = () => setIsMobile(getIsMobile());
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => { window.removeEventListener("resize", handler); window.removeEventListener("orientationchange", handler); };
  }, []);
  return isMobile;
}

//  SUPABASE ROWS HOOK
// Fetch-on-mount rows for route-owned scoped queries (Fix #7). buildQuery is a
// closure returning a thenable supabase query so `sb` stays out of this module.
// On error: warn + render empty, never crash the route.
export function useSupabaseRows(buildQuery, deps = []) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error: err } = await buildQuery();
        if (cancelled) return;
        if (err) { console.warn("[useSupabaseRows]", err); setError(err); }
        else { setError(null); setRows(Array.isArray(data) ? data : []); }
      } catch (e) {
        if (!cancelled) { console.warn("[useSupabaseRows]", e); setError(e); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, deps);
  return { rows, loading, error };
}

//  INTERVAL HOOK
export function useInterval(cb, delay) {
  const cbRef = useRef(cb);
  useEffect(() => { cbRef.current = cb; }, [cb]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => cbRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
