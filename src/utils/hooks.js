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
