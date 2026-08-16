// ── Cinematic renderer — the actual ship, alive ──────────────────────────────
// Draws the photoreal hull artwork (public/ship-interior.jpg — original
// generation in the mood of Danny's reference, no film likenesses) as the
// world, and composites the LIVE crew into it as rim-lit figures walking the
// art's decks. Same engine, same movement rule — this is the pixel renderer's
// cinematic sibling; both read the same world.js geometry.
//
// Sprites here are deliberately silhouette-style (dark body, colored rim
// light, glow status dot) so they sit IN the artwork like the tiny figures in
// Danny's mockup instead of floating on top of it.

import { WORLD_W, WORLD_H, ROOMS, DECKS, SPRITE, floorYAt } from './world.js';
import { STATIONS } from '../core/shipStations.js';

const mono = '9px "Geist Mono", monospace';
const HOLO = '#2AABFF';

const stationMeta = {};
for (const s of STATIONS) stationMeta[s.id] = s;

export function hitTestStation(x, y) {
  for (const r of ROOMS) {
    const deck = DECKS[r.deck];
    if (x >= r.x0 - 6 && x <= r.x1 + 6 && y >= deck.ceilY - 26 && y <= deck.floorY + 10) return r.id;
  }
  return null;
}

function drawFigure(ctx, sp, t) {
  // Project logical feet onto the artwork's sloped floor lines: standing
  // sprites sit exactly on the painted deck; climbers lerp between decks.
  const x = sp.x;
  const f0 = floorYAt(0, x), f1 = floorYAt(1, x);
  const span = (DECKS[1].floorY - DECKS[0].floorY) || 1;
  const p = Math.min(1, Math.max(0, (sp.y - DECKS[0].floorY) / span));
  const y = f0 + (f1 - f0) * p;
  const h = SPRITE.h + 6, w = SPRITE.w;
  const ghost = sp.state === 'future';
  const walkPhase = Math.sin((sp.animT || 0) / 130);
  const bob = sp.anim === 'walk' ? Math.abs(walkPhase) * 2
    : sp.anim === 'work' ? Math.sin((sp.animT || 0) / 420) * 1.5
    : Math.sin((sp.animT || 0) / 900) * 0.8;

  ctx.save();
  ctx.globalAlpha = ghost ? 0.32 : 1;
  ctx.translate(x, y - bob);
  if (sp.facing === -1) ctx.scale(-1, 1);

  if (sp.anim === 'sleep') {
    // lying on a bunk: horizontal body
    ctx.rotate(-Math.PI / 2);
  }

  // soft ground shadow
  ctx.save();
  ctx.globalAlpha *= 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 2, w * 0.7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // legs (walk scissor)
  const legSpread = sp.anim === 'walk' ? walkPhase * 4 : sp.anim === 'climb' ? 3 : 1.5;
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(-3 - legSpread / 2, -10, 3, 10);
  ctx.fillRect(0 + legSpread / 2, -10, 3, 10);
  // torso — dark with the agent color as a rim/vest
  ctx.fillStyle = '#12151c';
  ctx.fillRect(-w / 2 + 2, -h + 8, w - 4, h - 18);
  ctx.fillStyle = sp.color;
  ctx.globalAlpha *= 0.9;
  ctx.fillRect(sp.facing === -1 ? -w / 2 + 2 : w / 2 - 4, -h + 8, 2, h - 18); // rim light edge
  ctx.globalAlpha = ghost ? 0.32 : 1;
  // arms
  const armLift = sp.anim === 'climb' ? -6 : sp.anim === 'work' ? -2 : 0;
  ctx.fillStyle = '#0e1117';
  ctx.fillRect(-w / 2, -h + 10 + armLift, 2.5, 11);
  ctx.fillRect(w / 2 - 2.5, -h + 10 + armLift, 2.5, 11);
  // head with faint face light
  ctx.fillStyle = '#1a1e27';
  ctx.fillRect(-4, -h, 8, 8);
  ctx.fillStyle = 'rgba(150,190,230,0.35)';
  ctx.fillRect(sp.facing === -1 ? -4 : 1, -h + 2, 3, 3);
  ctx.restore();

  // status dot + working glow (screen light in front of them)
  if (!ghost) {
    if (sp.anim === 'work') {
      const g = ctx.createRadialGradient(x + sp.facing * 10, y - 14, 2, x + sp.facing * 10, y - 14, 22);
      g.addColorStop(0, 'rgba(42,171,255,0.30)');
      g.addColorStop(1, 'rgba(42,171,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 30, y - 40, 60, 44);
    }
    const dot = sp.anim === 'work' ? '#30d158' : sp.state === 'active' ? HOLO : 'rgba(255,255,255,0.4)';
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(x, y - h - 5 - bob, 2, 0, Math.PI * 2);
    ctx.fill();
    if (sp.anim === 'work') {
      const pulse = 0.4 + 0.3 * Math.sin(t / 300);
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(x, y - h - 5 - bob, 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#30d158';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // name tag
  ctx.font = mono;
  ctx.textAlign = 'center';
  ctx.fillStyle = ghost ? 'rgba(255,255,255,0.28)' : sp.color;
  ctx.fillText(sp.name, x, y + 11);
  ctx.textAlign = 'left';
}

export function renderShipArt(ctx, frame) {
  const { t, sprites = [], activity = {}, selectedStation, hoverStation, bgImage } = frame;
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  if (bgImage && bgImage.complete && bgImage.naturalWidth) {
    ctx.drawImage(bgImage, 0, 0, WORLD_W, WORLD_H);
  }

  // room chips + state glows over the art
  for (const r of ROOMS) {
    const meta = stationMeta[r.id];
    const deck = DECKS[r.deck];
    const cx = (r.x0 + r.x1) / 2;
    const here = sprites.filter(sp => sp.station === r.id && sp.state !== 'future');
    const lit = here.some(sp => sp.anim === 'work' || sp.state === 'active');
    const count = activity[r.id] || 0;
    const isSel = selectedStation === r.id;
    const isHover = hoverStation === r.id;

    if (lit) {
      const g = ctx.createRadialGradient(cx, deck.floorY - 40, 10, cx, deck.floorY - 40, 90);
      g.addColorStop(0, 'rgba(42,171,255,0.10)');
      g.addColorStop(1, 'rgba(42,171,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(r.x0 - 20, deck.ceilY - 20, (r.x1 - r.x0) + 40, (deck.floorY - deck.ceilY) + 40);
    }
    if (isSel || isHover) {
      ctx.strokeStyle = isSel ? HOLO : 'rgba(42,171,255,0.45)';
      ctx.lineWidth = isSel ? 1.5 : 1;
      ctx.strokeRect(r.x0, deck.ceilY - 14, r.x1 - r.x0, deck.floorY - deck.ceilY + 22);
    }

    // label chip
    const label = `${meta?.n || ''} ${meta?.label || r.id}`.toUpperCase();
    ctx.font = mono;
    const tw = ctx.measureText(label).width;
    const chipW = tw + 14 + (count > 0 ? 18 : 0);
    const chipX = cx - chipW / 2;
    const chipY = deck.ceilY - 26;
    ctx.fillStyle = 'rgba(6,8,13,0.72)';
    ctx.strokeStyle = lit ? 'rgba(42,171,255,0.45)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(chipX, chipY, chipW, 16, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = lit ? '#bfe3ff' : 'rgba(255,255,255,0.6)';
    ctx.fillText(label, chipX + 7, chipY + 11.5);
    if (count > 0) {
      ctx.fillStyle = HOLO;
      ctx.fillText(String(count), chipX + chipW - 12, chipY + 11.5);
    }
  }

  // crew — draw back-to-front by y so overlaps read right
  const ordered = [...sprites].sort((a, b) => a.y - b.y);
  for (const sp of ordered) drawFigure(ctx, sp, t);
}
