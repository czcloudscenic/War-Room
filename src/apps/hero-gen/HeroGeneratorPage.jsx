import React, { useState, useEffect, useRef, useCallback } from 'react';
import Card from '../../ui/shared/Card.jsx';

const API_KEY = 'AIzaSyBS7-wu8REJz_1bvrfPQPCYPFiwriYB3g4';
const MODEL_CANDIDATES = [
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.5-flash-preview-image-generation',
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
];

const STYLE_PREFIXES = {
  cinematic: 'Cinematic film still, shot on RED V-Raptor, shallow depth of field, natural lighting, subtle film grain, 16:9 widescreen composition,',
  aerial: 'Aerial drone photograph, shot on DJI Inspire 3, wide establishing shot, expansive landscape, high dynamic range,',
  moody: 'Moody documentary photograph, desaturated tones, available light only, intimate framing, raw and authentic,',
  product: 'Product hero shot, shallow depth of field, golden backlight, crystal clear detail, editorial quality, clean composition,',
  night: 'Night photograph, long exposure, starry sky, cool blue tones, ambient glow, deep shadows, cinematic wide,',
  golden: 'Golden hour magic light, warm amber tones, lens flare, backlit subject, rich shadows, dreamlike atmosphere,',
  none: '',
  custom: '',
};

const SHOTS = [
  { id: '3A', must: true, title: 'Tahoe aerial — truck on trail', time: '7:00 AM',
    prompt: 'Aerial drone view of a black pickup truck and tan VW Vanagon driving on a snowy winding mountain trail through tall pine trees, Lake Tahoe backcountry, winter, sense of scale and isolation' },
  { id: '3B', must: true, title: 'Truck on trail — dust, golden light', time: '8:00 AM',
    prompt: 'Black pickup truck and tan VW Vanagon kicking up snow dust on a backcountry trail, golden backlit morning sunlight flaring through pine trees, low tracking angle' },
  { id: '3C', must: false, title: 'Interior POV — driving', time: '9:00 AM',
    prompt: 'Interior dashboard POV from inside a truck, hands on steering wheel wearing brown leather gloves, snowy mountain trail ahead through windshield, mountains visible, coffee cup on dash' },
  { id: '3D', must: true, title: 'Grab unit from truck bed', time: '3:00 PM',
    prompt: 'Rugged man in canvas jacket and hiking boots reaching into black pickup truck bed, grabbing a portable water purification unit, snowy Lake Tahoe forest background, natural afternoon light' },
  { id: '3E', must: true, title: 'Unit at stream — water intake', time: '3:30 PM',
    prompt: 'Portable water purification unit sitting on a mossy snow-covered rock at the edge of a clear alpine stream, intake hose in flowing water, backlit through dense forest, product hero shot' },
  { id: '3F', must: true, title: 'Wide — talent at water edge', time: '4:00 PM',
    prompt: 'Wide establishing shot, man crouched at the edge of a clear mountain stream touching the water, dense pine forest behind him, afternoon golden light filtering through trees, contemplative quiet moment' },
  { id: '3G', must: false, title: 'Making camp — tent setup', time: '5:00 PM',
    prompt: 'Man setting up a green tent at a snowy campsite near a fire pit, black truck with rooftop camper and tan VW Vanagon parked nearby, golden hour sunset light, portable unit on folding table in background' },
  { id: '3H', must: true, title: 'Glass of water on rock', time: '5:30 PM',
    prompt: 'Crystal clear glass of purified water sitting on a natural rock surface, golden hour backlight creating lens flare, shallow depth of field, mountains and lake soft in background, hero product shot' },
  { id: '3I', must: false, title: 'Campsite aerial — golden hour', time: '6:30 PM',
    prompt: 'Overhead aerial drone view of a campsite clearing in snowy forest, truck and VW Vanagon parked, tent set up, fire pit with smoke rising, golden hour warm light, pine trees framing the scene' },
  { id: '3J', must: false, title: 'Night — stars, tent glow', time: '8:30 PM',
    prompt: 'Wide night shot of a campsite under starry sky with Milky Way visible, tent glowing warm orange from inside, portable unit with blue LED glow beside the tent, truck and Vanagon silhouettes, campfire embers' },
];

function compressImage(srcDataUrl, maxW, maxH, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = maxW;
      canvas.height = maxH;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, maxW, maxH);
      const scale = Math.max(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (maxW - w) / 2, (maxH - h) / 2, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(srcDataUrl);
    img.src = srcDataUrl;
  });
}

export default function HeroGeneratorPage() {
  const [activeModel, setActiveModel] = useState(null);
  const [detecting, setDetecting] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('cinematic');
  const [customStyle, setCustomStyle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState({ msg: 'Detecting model...', error: false });
  const [images, setImages] = useState([]);
  const textareaRef = useRef(null);

  // Detect model on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const model of MODEL_CANDIDATES) {
        if (cancelled) return;
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Generate a simple test image of a blue circle on white background' }] }],
              generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
            }),
          });
          if (res.status === 404) continue;
          if (res.ok || res.status === 400 || res.status === 429) {
            if (!cancelled) {
              setActiveModel(model);
              setStatus({ msg: `Model locked: ${model}`, error: false });
              setDetecting(false);
            }
            return;
          }
        } catch { /* try next */ }
      }
      if (!cancelled) {
        setStatus({ msg: 'No working model found. Check API key.', error: true });
        setDetecting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getPrefix = useCallback(() => {
    if (style === 'custom') return customStyle.trim();
    return STYLE_PREFIXES[style] || '';
  }, [style, customStyle]);

  const generate = useCallback(async (overridePrompt) => {
    const raw = overridePrompt || prompt.trim();
    if (!raw) { setStatus({ msg: 'Enter a prompt first.', error: true }); return; }
    if (!activeModel) { setStatus({ msg: 'No model detected yet.', error: true }); return; }

    const prefix = getPrefix();
    const fullPrompt = prefix ? `${prefix} ${raw}` : raw;
    setGenerating(true);
    setStatus({ msg: `Sending to ${activeModel}...`, error: false });

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts;
      if (!parts) throw new Error('No content in response. ' + JSON.stringify(data?.candidates?.map(c => c.finishReason)));

      const imgPart = parts.find(p => p.inlineData);
      if (!imgPart) {
        const textPart = parts.find(p => p.text);
        throw new Error('No image returned. Model said: ' + (textPart?.text || 'nothing'));
      }

      const b64 = imgPart.inlineData.data;
      const mime = imgPart.inlineData.mimeType || 'image/png';
      const dataUrl = await compressImage(`data:${mime};base64,${b64}`, 720, 405, 0.65);

      setImages(prev => [{ dataUrl, prompt: raw, fullPrompt, timestamp: Date.now() }, ...prev]);
      setStatus({ msg: `Generated via ${activeModel}`, error: false });
    } catch (e) {
      setStatus({ msg: `Error: ${e.message}`, error: true });
    } finally {
      setGenerating(false);
    }
  }, [prompt, activeModel, getPrefix]);

  const downloadOne = (img) => {
    const slug = img.prompt.replace(/[^a-z0-9]+/gi, '-').slice(0, 40).toLowerCase();
    const a = document.createElement('a');
    a.href = img.dataUrl;
    a.download = `vl-scene3-${slug}-${Date.now()}.jpg`;
    a.click();
  };

  const downloadAll = () => {
    images.forEach((img, i) => setTimeout(() => downloadOne(img), i * 300));
  };

  const redo = (img) => {
    setPrompt(img.prompt);
    generate(img.prompt);
  };

  const remove = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#f5f5f7', marginBottom: 4, letterSpacing: -1 }}>
            Mini Hero Generator
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Scene 3: Overland — Gemini AI Image Generation
          </p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(42,171,255,0.08)', border: '1px solid rgba(42,171,255,0.2)',
          borderRadius: 8, padding: '6px 14px',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2AABFF', animation: 'livePulse 2s infinite' }} />
          <span style={{ fontSize: 11, color: '#2AABFF', fontWeight: 600 }}>
            {detecting ? 'Detecting model...' : activeModel || 'No model'}
          </span>
        </div>
      </div>

      {/* Shot list reference */}
      <Card style={{ padding: '16px 20px', marginBottom: 16, marginTop: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Scene 3 Shot List — Click to prefill</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {SHOTS.map(s => (
            <div
              key={s.id}
              onClick={() => { setPrompt(s.prompt); textareaRef.current?.focus(); }}
              style={{
                padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${s.must ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(42,171,255,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = s.must ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: s.must ? '#10b981' : 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{s.id}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{s.title}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{s.time}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Controls */}
      <Card style={{ padding: '20px', marginBottom: 24, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Style select */}
        <div style={{ marginBottom: 12 }}>
          <select
            value={style}
            onChange={e => setStyle(e.target.value)}
            style={{
              width: '100%', background: '#141214', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '10px 14px', color: '#FAFAFA', fontSize: 12,
              outline: 'none', fontFamily: 'Inter,sans-serif', cursor: 'pointer',
            }}
          >
            <option value="cinematic">Cinematic Film Still (RED V-Raptor)</option>
            <option value="aerial">Aerial Drone (DJI Inspire 3)</option>
            <option value="moody">Moody Documentary</option>
            <option value="product">Product Hero Shot</option>
            <option value="night">Night / Astro</option>
            <option value="golden">Golden Hour Magic</option>
            <option value="none">No Style Prefix</option>
            <option value="custom">Custom Style...</option>
          </select>
        </div>

        {style === 'custom' && (
          <input
            type="text"
            value={customStyle}
            onChange={e => setCustomStyle(e.target.value)}
            placeholder="Enter custom style prefix..."
            style={{
              width: '100%', background: '#141214', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '10px 14px', color: '#FAFAFA', fontSize: 11,
              outline: 'none', marginBottom: 12, fontFamily: 'Inter,sans-serif',
            }}
          />
        )}

        {/* Prompt + generate */}
        <div style={{ display: 'flex', gap: 10 }}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); }}
            placeholder={"Describe the image you want to generate...\n\ne.g. Man in rugged canvas jacket pulling a portable water unit from a black pickup truck bed, snowy Lake Tahoe forest in background"}
            rows={3}
            style={{
              flex: 1, background: '#141214', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '14px 16px', color: '#FAFAFA', fontSize: 13,
              lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'Inter,sans-serif',
            }}
          />
          <button
            onClick={() => generate()}
            disabled={generating || detecting}
            style={{
              background: generating ? 'rgba(42,171,255,0.15)' : '#2AABFF',
              border: 'none', borderRadius: 12,
              color: generating ? '#2AABFF' : '#fff',
              cursor: generating ? 'default' : 'pointer',
              padding: '14px 28px', fontSize: 13, fontWeight: 700,
              whiteSpace: 'nowrap', fontFamily: 'Inter,sans-serif',
              opacity: (generating || detecting) ? 0.6 : 1,
            }}
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Status */}
        <div style={{ marginTop: 10, fontSize: 11, color: status.error ? '#ff453a' : 'rgba(255,255,255,0.4)', minHeight: 18 }}>
          {status.msg}
        </div>
      </Card>

      {/* Gallery header */}
      {images.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{images.length} image{images.length !== 1 ? 's' : ''}</h2>
          <button
            onClick={downloadAll}
            style={{
              background: 'rgba(42,171,255,0.08)', border: '1px solid rgba(42,171,255,0.2)',
              borderRadius: 8, color: '#2AABFF', cursor: 'pointer',
              padding: '7px 16px', fontSize: 11, fontWeight: 600, fontFamily: 'Inter,sans-serif',
            }}
          >
            Download All
          </button>
        </div>
      )}

      {/* Gallery grid */}
      {images.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {images.map((img, i) => (
            <Card key={img.timestamp + '-' + i} style={{ overflow: 'hidden', padding: 0 }}>
              <img
                src={img.dataUrl}
                alt={img.prompt}
                onClick={() => downloadOne(img)}
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
              />
              <div style={{ padding: '12px 14px' }}>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 8,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {img.prompt}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { label: 'Download', fn: () => downloadOne(img) },
                    { label: 'Redo', fn: () => redo(img) },
                    { label: 'Remove', fn: () => remove(i) },
                  ].map(a => (
                    <button
                      key={a.label}
                      onClick={a.fn}
                      style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 6, color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                        padding: '5px 10px', fontSize: 10, fontWeight: 600, fontFamily: 'Inter,sans-serif',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(42,171,255,0.3)'; e.currentTarget.style.color = '#2AABFF'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 32, opacity: 0.15, marginBottom: 12 }}>&#9671;</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Generate your first reference image above</div>
        </div>
      )}
    </div>
  );
}
