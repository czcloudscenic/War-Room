import React, { useState, useEffect } from 'react';

export default function TypingTask({ text, color }) {
  const [displayed, setDisplayed] = useState("");
  const [idx, setIdx] = useState(0);
  useEffect(() => { setDisplayed(""); setIdx(0); }, [text]);
  useEffect(() => {
    if (idx >= text.length) return;
    const id = setTimeout(() => { setDisplayed(text.slice(0, idx+1)); setIdx(i => i+1); }, 16 + Math.random()*12);
    return () => clearTimeout(id);
  }, [idx, text]);
  return <span style={{ color, fontSize:11, letterSpacing:0.1 }}>{displayed}{idx < text.length ? <span style={{ animation:"blink 0.7s step-end infinite", color }}>|</span> : null}</span>;
}
