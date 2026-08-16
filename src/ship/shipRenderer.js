// ── Agent Ship renderer — Terraria-style cross-section of the hovercraft ─────
// Pure canvas-2D immediate-mode drawing, ES module, no React / no DOM creation.
// renderShip(ctx, frame) draws one full 1280×720 logical frame (caller scales);
// hitTestStation(x, y) maps logical coords to a station id.
//
// All animation derives deterministically from frame.t (NO Math.random at draw
// time) so frames are stable. Static geometry (stars, city skyline, room
// rects) is precomputed once at module load; the render loop allocates nothing
// beyond trivial locals plus a lazily-created, cached set of glow gradients.
//
// Geometry contract: src/ship/world.js. Labels: src/core/shipStations.js.
// Mood (from Danny's mockup): near-black charcoal hull, cyan/teal hologram
// glow, warm amber work lamps, glittering dark city far below — rendered as
// crisp chunky game art, not photorealism.

import { WORLD_W, WORLD_H, DECKS, ROOMS, ENGINE_ROOM, LADDERS, HULL, SPRITE } from './world.js';
import { STATIONS } from '../core/shipStations.js';

const TAU = Math.PI * 2;

// Deterministic 0..1 hash — stands in for Math.random everywhere.
const rnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const FONT_LABEL = '9px ui-monospace, Menlo, Consolas, monospace';
const FONT_SMALL = '8px ui-monospace, Menlo, Consolas, monospace';
const FONT_TINY = '7px ui-monospace, Menlo, Consolas, monospace';

const SPR_H = SPRITE.h;                    // 26 — head top sits at feetY - SPR_H
const SPR_HALF = Math.floor(SPRITE.w / 2); // 7  — body spans x ± SPR_HALF

// ── Static geometry (precomputed once at module load) ────────────────────────

const ROOM_RECTS = ROOMS.map((r) => {
  const d = DECKS[r.deck];
  return {
    id: r.id, kind: r.kind, deck: r.deck,
    x0: r.x0, x1: r.x1, y0: d.ceilY, y1: d.floorY,
    w: r.x1 - r.x0, h: d.floorY - d.ceilY,
    cx: Math.round((r.x0 + r.x1) / 2),
  };
});
const ROOM_BY_ID = {};
for (const r of ROOM_RECTS) ROOM_BY_ID[r.id] = r;

const ENGINE_RECT = (() => {
  const d = DECKS[ENGINE_ROOM.deck];
  return { x0: ENGINE_ROOM.x0, x1: ENGINE_ROOM.x1, y0: d.ceilY, y1: d.floorY, cx: Math.round((ENGINE_ROOM.x0 + ENGINE_ROOM.x1) / 2) };
})();

const STATION_BY_ID = {};
for (const s of STATIONS) STATION_BY_ID[s.id] = s;
const ROOM_LABEL = {};
for (const r of ROOM_RECTS) {
  const s = STATION_BY_ID[r.id];
  ROOM_LABEL[r.id] = s ? (s.n + ' ' + s.label.toUpperCase()) : r.id.toUpperCase();
}

// Hull silhouette: nose taper on the left, chamfered engine block on the right.
const HULL_PTS = [
  [168, 120], [1162, 120], [1232, 190], [1232, 590], [1162, 660],
  [168, 660], [78, 570], [48, 430], [48, 350], [78, 210],
];

// Structural slab bands (roof armor + inter-deck slabs + keel).
const BANDS = [
  { y: HULL.top, h: DECKS[0].ceilY - HULL.top },
  { y: DECKS[0].floorY, h: DECKS[1].ceilY - DECKS[0].floorY },
  { y: DECKS[1].floorY, h: DECKS[2].ceilY - DECKS[1].floorY },
  { y: DECKS[2].floorY, h: HULL.bottom - DECKS[2].floorY },
];

const LADDER_SPANS = LADDERS.map((l) => {
  const a = Math.min(l.decks[0], l.decks[1]);
  const b = Math.max(l.decks[0], l.decks[1]);
  return {
    x: l.x,
    y0: DECKS[a].floorY, y1: DECKS[b].floorY,
    slabY: DECKS[a].floorY, slabH: DECKS[b].ceilY - DECKS[a].floorY,
  };
});

// Night sky stars (positions/phases fixed forever, twinkle from t).
const STARS = [];
for (let i = 0; i < 90; i++) {
  STARS.push({
    x: Math.floor(rnd(i) * WORLD_W),
    y: Math.floor(rnd(i + 211) * 112),
    s: rnd(i + 431) < 0.18 ? 2 : 1,
    p: rnd(i + 617) * TAU,
    warm: rnd(i + 809) < 0.22,
  });
}

// City skyline — two parallax layers, buildings + pre-placed windows.
const CITY_P = 1540; // wrap period
function buildCity(seed, minH, maxH, minW, maxW, winChance) {
  const list = [];
  let x = 0, i = 0;
  while (x < CITY_P - minW) {
    const w = Math.floor(minW + rnd(seed + i * 7) * (maxW - minW));
    const hgt = Math.floor(minH + rnd(seed + i * 7 + 3) * (maxH - minH));
    const wins = [];
    if (winChance > 0) {
      for (let wy = 6; wy < hgt - 6; wy += 10) {
        for (let wx = 3; wx < w - 4; wx += 7) {
          const k = rnd(seed * 13 + i * 97 + wx * 5 + wy * 3);
          if (k < winChance) wins.push({ x: wx, y: wy, tw: k < winChance * 0.4, warm: k > winChance * 0.55, p: k * 40 });
        }
      }
    }
    list.push({ x, w, h: hgt, wins });
    x += w + 3 + Math.floor(rnd(seed + i * 7 + 5) * 9);
    i++;
  }
  return list;
}
const CITY_FAR = buildCity(21, 50, 165, 26, 60, 0.10);
const CITY_NEAR = buildCity(87, 30, 125, 34, 78, 0.22);

// ── Lazily-created gradient cache (needs a ctx; reused every frame via
//    translate so we never rebuild gradients in the loop) ─────────────────────
let G = null;
function initCache(ctx) {
  G = {};
  let g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, '#04060b'); g.addColorStop(0.55, '#070b13'); g.addColorStop(1, '#0b101c');
  G.sky = g;
  g = ctx.createRadialGradient(0, 0, 2, 0, 0, 60);
  g.addColorStop(0, 'rgba(255,176,82,0.55)'); g.addColorStop(1, 'rgba(255,176,82,0)');
  G.lamp = g;
  g = ctx.createRadialGradient(0, 0, 6, 0, 0, 110);
  g.addColorStop(0, 'rgba(96,235,244,0.45)'); g.addColorStop(1, 'rgba(96,235,244,0)');
  G.coreGlow = g;
  g = ctx.createRadialGradient(0, 0, 3, 0, 0, 30);
  g.addColorStop(0, 'rgba(140,245,215,0.55)'); g.addColorStop(1, 'rgba(140,245,215,0)');
  G.spot = g;
  g = ctx.createLinearGradient(0, 0, 120, 0);
  g.addColorStop(0, 'rgba(255,166,66,0.85)'); g.addColorStop(0.4, 'rgba(120,220,235,0.30)'); g.addColorStop(1, 'rgba(120,220,235,0)');
  G.thrust = g;
  g = ctx.createLinearGradient(0, HULL.top, 0, HULL.bottom);
  g.addColorStop(0, '#161b25'); g.addColorStop(0.5, '#11151f'); g.addColorStop(1, '#0d1119');
  G.hull = g;
  g = ctx.createRadialGradient(0, 0, 2, 0, 0, 50);
  g.addColorStop(0, 'rgba(110,225,240,0.35)'); g.addColorStop(1, 'rgba(110,225,240,0)');
  G.hover = g;
}

// ── Backdrop ──────────────────────────────────────────────────────────────────

function drawSky(ctx, t) {
  ctx.fillStyle = G.sky;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // stars
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    ctx.globalAlpha = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.0011 + s.p));
    ctx.fillStyle = s.warm ? '#ffe3b8' : '#cfe6f2';
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  // storm-cloud banding, slow drift
  ctx.fillStyle = '#1b2334';
  for (let i = 0; i < 6; i++) {
    const w = 280 + rnd(i + 3) * 320;
    const y = 16 + i * 18 + rnd(i + 9) * 10;
    const x = ((i * 331 + t * (0.006 + rnd(i + 40) * 0.009)) % (WORLD_W + w * 2)) - w;
    ctx.globalAlpha = 0.05 + rnd(i + 80) * 0.06;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, 13, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCityLayer(ctx, layer, off, bodyColor, bf, t) {
  for (let i = 0; i < layer.length; i++) {
    const b = layer[i];
    const X = Math.round(((b.x - off) % CITY_P + CITY_P) % CITY_P - 130);
    if (X > WORLD_W + 4 || X + b.w < -4) continue;
    const by = WORLD_H - b.h;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(X, by, b.w, b.h);
    for (let j = 0; j < b.wins.length; j++) {
      const win = b.wins[j];
      const a = win.tw ? 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.002 + win.p)) : 0.4;
      ctx.globalAlpha = a * bf;
      ctx.fillStyle = win.warm ? '#ffcf8e' : '#9adbe8';
      ctx.fillRect(X + win.x, by + win.y, 2, 3);
    }
    ctx.globalAlpha = 1;
  }
}

function drawCity(ctx, t) {
  drawCityLayer(ctx, CITY_FAR, (t * 0.0016) % CITY_P, '#0a0e15', 0.55, t);
  drawCityLayer(ctx, CITY_NEAR, (t * 0.0042) % CITY_P, '#0e1420', 1, t);
  // the ship's shadow pooled over the city
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#020305';
  ctx.beginPath();
  ctx.ellipse(640, 708, 560, 24, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRain(ctx, t) {
  // occasional weather: gate opens and closes on a slow cycle
  const gate = Math.sin(t * 0.000063) - 0.15;
  if (gate <= 0) return;
  ctx.globalAlpha = Math.min(0.3, gate * 0.45);
  ctx.strokeStyle = '#8fb6c9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 46; i++) {
    const sp = 0.35 + rnd(i) * 0.4;
    const y = ((t * sp + rnd(i + 300) * 900) % 800) - 40;
    const x = ((rnd(i + 700) * 1400 - y * 0.25) % 1400 + 1400) % 1400 - 60;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y + 16);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawExterior(ctx, t) {
  const fl = 0.65 + 0.25 * Math.sin(t * 0.021) + 0.1 * Math.sin(t * 0.047);
  // thruster wash off the stern
  for (let i = 0; i < 3; i++) {
    const y = 285 + i * 105;
    ctx.save();
    ctx.translate(HULL.x1 + 6, y);
    ctx.globalAlpha = clamp01(0.45 * fl + (i === 1 ? 0.15 : 0));
    ctx.fillStyle = G.thrust;
    ctx.fillRect(0, -13, 120, 26);
    ctx.restore();
  }
  // hover emitters under the keel (it floats, after all)
  for (let i = 0; i < 3; i++) {
    const x = 330 + i * 310;
    ctx.save();
    ctx.translate(x, HULL.bottom + 4);
    ctx.scale(1, 1.6);
    ctx.globalAlpha = clamp01(0.3 + 0.18 * Math.sin(t * 0.005 + i * 2.1));
    ctx.fillStyle = G.hover;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ── Hull ──────────────────────────────────────────────────────────────────────

function traceHull(ctx) {
  ctx.beginPath();
  ctx.moveTo(HULL_PTS[0][0], HULL_PTS[0][1]);
  for (let i = 1; i < HULL_PTS.length; i++) ctx.lineTo(HULL_PTS[i][0], HULL_PTS[i][1]);
  ctx.closePath();
}

function drawShell(ctx, t) {
  // armored outline + faint cyan cutaway rim
  traceHull(ctx);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2b3444';
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(120,220,235,0.20)';
  ctx.stroke();
  // stern nozzle housings
  ctx.fillStyle = '#1a202b';
  ctx.strokeStyle = '#323c4c';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const y = 285 + i * 105;
    ctx.fillRect(HULL.x1 - 4, y - 16, 16, 32);
    ctx.strokeRect(HULL.x1 - 4, y - 16, 16, 32);
  }
  // rooftop antennas with blinking nav light
  ctx.strokeStyle = '#3a4353';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(520, HULL.top); ctx.lineTo(520, HULL.top - 28);
  ctx.moveTo(902, HULL.top); ctx.lineTo(902, HULL.top - 18);
  ctx.stroke();
  const blink = Math.sin(t * 0.004) > 0.55;
  ctx.fillStyle = blink ? '#ff5d5d' : '#5b2430';
  ctx.fillRect(518, HULL.top - 32, 4, 4);
  ctx.fillRect(900, HULL.top - 22, 4, 4);
}

// ── Interior structure ────────────────────────────────────────────────────────

function drawInterior(ctx, t, activity) {
  // interior base fill (clip trims to the hull polygon)
  ctx.fillStyle = G.hull;
  ctx.fillRect(HULL.x0 - 40, HULL.top, HULL.x1 - HULL.x0 + 80, HULL.bottom - HULL.top);
  // slab bands with ribbed plating
  for (let i = 0; i < BANDS.length; i++) {
    const b = BANDS[i];
    ctx.fillStyle = '#171c26';
    ctx.fillRect(0, b.y, WORLD_W, b.h);
    ctx.fillStyle = '#232b39';
    ctx.fillRect(0, b.y, WORLD_W, 2);
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, b.y + b.h - 2, WORLD_W, 2);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#1f2734';
    for (let x = 64; x < WORLD_W; x += 48) ctx.fillRect(x, b.y + 3, 3, b.h - 6);
    ctx.globalAlpha = 1;
  }
  // deck interior strips (walls between rooms stay this color)
  for (let i = 0; i < DECKS.length; i++) {
    const d = DECKS[i];
    ctx.fillStyle = '#10141c';
    ctx.fillRect(0, d.ceilY, WORLD_W, d.floorY - d.ceilY);
  }
  // rooms
  for (let i = 0; i < ROOM_RECTS.length; i++) {
    const r = ROOM_RECTS[i];
    drawRoom(ctx, r, t, activity[r.id] | 0);
  }
  drawEngineRoomInterior(ctx, t);
}

function drawLadders(ctx) {
  for (let i = 0; i < LADDER_SPANS.length; i++) {
    const l = LADDER_SPANS[i];
    // opening cut through the slab
    ctx.fillStyle = '#07090e';
    ctx.fillRect(l.x - 9, l.slabY, 18, l.slabH);
    // rails
    ctx.fillStyle = '#414c60';
    ctx.fillRect(l.x - 7, l.y0 - 4, 2, l.y1 - l.y0 + 4);
    ctx.fillRect(l.x + 5, l.y0 - 4, 2, l.y1 - l.y0 + 4);
    // rungs
    for (let y = l.y0 + 4; y < l.y1 - 2; y += 9) ctx.fillRect(l.x - 7, y, 14, 2);
  }
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

function drawRoom(ctx, r, t, count) {
  // the holo-core's light spill deliberately escapes its room
  if (r.kind === 'core') {
    ctx.save();
    ctx.translate(r.cx, r.y1 - 44);
    ctx.globalAlpha = 0.5 + 0.18 * Math.sin(t * 0.0032);
    ctx.fillStyle = G.coreGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 110, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x0, r.y0, r.w, r.h);
  ctx.clip();

  // room base + back-wall panel seams
  ctx.fillStyle = '#0c1017';
  ctx.fillRect(r.x0, r.y0, r.w, r.h);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#141a24';
  for (let x = r.x0 + 12; x < r.x1 - 6; x += 34) ctx.fillRect(x, r.y0 + 8, 1, r.h - 16);
  ctx.globalAlpha = 1;

  const draw = INTERIOR[r.kind];
  if (draw) draw(ctx, r, t);

  // warm ceiling work lamp
  ctx.save();
  ctx.translate(r.cx, r.y0 + 3);
  ctx.globalAlpha = 0.35 + Math.min(count, 12) * 0.02;
  ctx.fillStyle = G.lamp;
  ctx.beginPath();
  ctx.arc(0, 0, 60, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffcf96';
  ctx.fillRect(r.cx - 7, r.y0 + 1, 14, 2);
  ctx.globalAlpha = 1;

  // recent receipts brighten the room
  if (count > 0) {
    ctx.globalAlpha = 0.04 + Math.min(count, 10) * 0.006;
    ctx.fillStyle = '#6fe0ef';
    ctx.fillRect(r.x0, r.y0, r.w, r.h);
    ctx.globalAlpha = 1;
  }

  // floor + side walls
  ctx.fillStyle = '#242e3d';
  ctx.fillRect(r.x0, r.y1 - 3, r.w, 3);
  ctx.fillStyle = '#1a212d';
  ctx.fillRect(r.x0, r.y0, 3, r.h);
  ctx.fillRect(r.x1 - 3, r.y0, 3, r.h);

  // label ("01 COCKPIT") — nudged right in the nose so it stays inside the hull
  const lx = r.id === 'cockpit' ? r.x0 + 68 : r.x0 + 8;
  ctx.font = FONT_LABEL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(126,222,232,0.7)';
  ctx.fillText(ROOM_LABEL[r.id], lx, r.y0 + 11);

  // receipt count chip
  if (count > 0) {
    const s = String(count);
    const cw = 10 + s.length * 6;
    const cx0 = r.x1 - 8 - cw;
    ctx.fillStyle = 'rgba(46,196,182,0.14)';
    ctx.fillRect(cx0, r.y0 + 5, cw, 12);
    ctx.strokeStyle = 'rgba(103,232,217,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx0 + 0.5, r.y0 + 5.5, cw - 1, 11);
    ctx.fillStyle = '#7ff0dd';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'center';
    ctx.fillText(s, cx0 + cw / 2, r.y0 + 11);
  }

  ctx.restore();
}

// Interior props per room kind. Every draw fn stays inside r's rect (clipped).
const INTERIOR = {
  bridge(ctx, r, t) {
    // forward viewport
    const wx0 = r.x0 + 62;
    const wx1 = r.cx + 18;
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(wx0, r.y0 + 16, wx1 - wx0, r.h - 40);
    ctx.strokeStyle = '#2c3646';
    ctx.lineWidth = 3;
    ctx.strokeRect(wx0, r.y0 + 16, wx1 - wx0, r.h - 40);
    ctx.fillStyle = '#232c3a';
    ctx.fillRect(wx0 + Math.floor((wx1 - wx0) / 2), r.y0 + 16, 2, r.h - 40);
    ctx.fillStyle = '#9fd4e6';
    for (let i = 0; i < 8; i++) {
      ctx.globalAlpha = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.001 + i * 1.9));
      ctx.fillRect(wx0 + 6 + Math.floor(rnd(i + 31) * (wx1 - wx0 - 12)), r.y0 + 20 + Math.floor(rnd(i + 77) * (r.h - 50)), 1, 1);
    }
    ctx.globalAlpha = 1;
    // holo table
    const hx = r.x1 - 48;
    ctx.fillStyle = '#28313f';
    ctx.fillRect(hx - 22, r.y1 - 17, 44, 4);
    ctx.fillStyle = '#1d2430';
    ctx.fillRect(hx - 18, r.y1 - 13, 36, 10);
    ctx.globalAlpha = 0.16 + 0.07 * Math.sin(t * 0.004);
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(hx - 20, r.y0 + 22);
    ctx.lineTo(hx + 20, r.y0 + 22);
    ctx.lineTo(hx + 6, r.y1 - 17);
    ctx.lineTo(hx - 6, r.y1 - 17);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(hx, r.y0 + 42 + Math.sin(t * 0.0025) * 4);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = 'rgba(103,232,249,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.restore();
  },

  consoles(ctx, r, t) {
    const nd = Math.max(2, Math.min(3, Math.floor(r.w / 90)));
    const gap = r.w / (nd + 1);
    for (let i = 0; i < nd; i++) {
      const dx = Math.round(r.x0 + gap * (i + 1));
      ctx.fillStyle = '#1d2431';
      ctx.fillRect(dx - 20, r.y1 - 14, 40, 11);
      ctx.fillStyle = '#232b38';
      ctx.fillRect(dx - 2, r.y1 - 18, 4, 5);
      // screen with flicker
      const fl = clamp01(0.55 + 0.18 * Math.sin(t * 0.009 + i * 2.3 + r.x0) + 0.08 * Math.sin(t * 0.031 + i));
      ctx.fillStyle = '#0d1420';
      ctx.fillRect(dx - 11, r.y1 - 34, 22, 16);
      ctx.globalAlpha = fl;
      ctx.fillStyle = '#5fe0f2';
      ctx.fillRect(dx - 9, r.y1 - 32, 18, 12);
      ctx.globalAlpha = fl * 0.6;
      ctx.fillStyle = '#0d3d49';
      for (let ry = r.y1 - 30; ry < r.y1 - 22; ry += 3) {
        ctx.fillRect(dx - 8, ry, 6 + Math.floor(rnd(i * 9 + ry) * 10), 1);
      }
      ctx.globalAlpha = 1;
    }
  },

  lab(ctx, r, t) {
    const ax = r.cx - 24;
    // scanner arch
    ctx.fillStyle = '#222a37';
    ctx.fillRect(ax - 26, r.y1 - 58, 6, 55);
    ctx.fillRect(ax + 20, r.y1 - 58, 6, 55);
    ctx.strokeStyle = '#2f3948';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(ax, r.y1 - 58, 23, Math.PI, TAU);
    ctx.stroke();
    // sweeping scan beam
    const sy = r.y1 - 50 + ((t * 0.02) % 44);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(ax - 20, r.y1 - 52, 40, 49);
    ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 0.01);
    ctx.fillRect(ax - 20, sy, 40, 2);
    ctx.globalAlpha = 1;
    // specimen pedestal
    const px = r.x1 - 42;
    ctx.fillStyle = '#1d2430';
    ctx.fillRect(px - 12, r.y1 - 12, 24, 9);
    ctx.save();
    ctx.translate(px, r.y1 - 24);
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 0.0045);
    ctx.fillStyle = G.spot;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.75 + 0.2 * Math.sin(t * 0.0045);
    ctx.fillStyle = '#a5f3d0';
    ctx.beginPath();
    ctx.arc(px, r.y1 - 24, 4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  security(ctx, r, t) {
    // barred gate on the right
    const gx = r.cx + 10;
    ctx.fillStyle = '#1c2330';
    ctx.fillRect(gx - 4, r.y0 + 12, r.x1 - 6 - (gx - 4), r.h - 15);
    ctx.fillStyle = '#3d4759';
    for (let x = gx + 2; x < r.x1 - 10; x += 9) ctx.fillRect(x, r.y0 + 14, 3, r.h - 17);
    ctx.fillRect(gx, r.y0 + 26, r.x1 - 10 - gx, 3);
    ctx.fillRect(gx, r.y1 - 30, r.x1 - 10 - gx, 3);
    // status panel
    const sx = r.x0 + 26;
    ctx.fillStyle = '#141b26';
    ctx.fillRect(sx - 10, r.y1 - 52, 22, 30);
    ctx.strokeStyle = '#2c3646';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 9.5, r.y1 - 51.5, 21, 29);
    const on0 = true;
    const on1 = Math.sin(t * 0.003) > 0;
    const on2 = Math.sin(t * 0.0011 + 1) > 0.85;
    ctx.fillStyle = '#35e07b'; ctx.globalAlpha = on0 ? 1 : 0.2; ctx.fillRect(sx - 4, r.y1 - 46, 5, 4);
    ctx.fillStyle = '#ffb454'; ctx.globalAlpha = on1 ? 1 : 0.2; ctx.fillRect(sx - 4, r.y1 - 38, 5, 4);
    ctx.fillStyle = '#ff5d5d'; ctx.globalAlpha = on2 ? 1 : 0.2; ctx.fillRect(sx - 4, r.y1 - 30, 5, 4);
    ctx.globalAlpha = 1;
  },

  grid(ctx, r, t) {
    // wall board of 8 glowing pipeline slots
    const cols = 4, sw = 42, sh = 36;
    const x00 = r.cx - (cols * sw + (cols - 1) * 8) / 2;
    const y00 = r.y0 + 26;
    for (let i = 0; i < 8; i++) {
      const cx0 = Math.round(x00 + (i % cols) * (sw + 8));
      const cy0 = Math.round(y00 + Math.floor(i / cols) * (sh + 10));
      ctx.fillStyle = '#0f1622';
      ctx.fillRect(cx0, cy0, sw, sh);
      ctx.strokeStyle = 'rgba(103,232,249,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx0 + 0.5, cy0 + 0.5, sw - 1, sh - 1);
      const amber = i % 3 === 2;
      ctx.globalAlpha = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.0028 + i * 1.7));
      ctx.fillStyle = amber ? '#ffb454' : '#5fe0f2';
      ctx.fillRect(cx0 + 5, cy0 + 6, 6, 6);
      ctx.fillRect(cx0 + 5, cy0 + sh - 10, Math.round((sw - 10) * (0.25 + 0.7 * rnd(i * 3 + 8))), 5);
      ctx.globalAlpha = 1;
    }
  },

  core(ctx, r, t) {
    // THE HOLO-CORE — tall luminous pulsing cylinder
    const cw = 46;
    const x = r.cx - cw / 2;
    const yTop = r.y0 + 16;
    const yBot = r.y1 - 8;
    const riseH = yBot - yTop;
    ctx.fillStyle = '#232b39';
    ctx.fillRect(x - 10, yTop - 6, cw + 20, 6);
    ctx.fillRect(x - 10, yBot, cw + 20, 6);
    ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 0.0032);
    ctx.fillStyle = '#3ad6e8';
    ctx.fillRect(x, yTop, cw, riseH);
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 0.0032 + 1);
    ctx.fillStyle = '#bff6ff';
    ctx.fillRect(r.cx - 5, yTop + 2, 10, riseH - 4);
    // energy rings drifting upward
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#c8fbff';
    for (let i = 0; i < 5; i++) {
      const ry = yBot - 3 - ((i * (riseH / 5) + t * 0.02) % (riseH - 5));
      ctx.fillRect(x + 2, ry, cw - 4, 1);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(140,240,250,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, yTop, cw, riseH);
    // light pooled on the floor
    ctx.globalAlpha = 0.12 + 0.05 * Math.sin(t * 0.0032);
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.ellipse(r.cx, yBot + 4, 60, 6, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  machines(ctx, r, t) {
    // server racks with blinking LEDs
    for (let m = 0; m < 2; m++) {
      const rx = Math.round(r.x0 + 26 + m * (r.w - 84));
      ctx.fillStyle = '#161c27';
      ctx.fillRect(rx, r.y0 + 26, 34, r.h - 29);
      ctx.strokeStyle = '#2b3444';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 0.5, r.y0 + 26.5, 33, r.h - 30);
      for (let led = 0; led < 18; led++) {
        const lx = rx + 5 + (led % 3) * 10;
        const ly = r.y0 + 32 + Math.floor(led / 3) * 13;
        const k = rnd(m * 131 + led * 17);
        const on = Math.sin(t * (0.002 + k * 0.004) + k * 9) > k - 0.35;
        ctx.globalAlpha = on ? 0.9 : 0.15;
        ctx.fillStyle = k < 0.7 ? '#35e07b' : '#ffb454';
        ctx.fillRect(lx, ly, 4, 3);
      }
      ctx.globalAlpha = 1;
    }
    // working piston between the racks
    const px = r.cx;
    const stroke = Math.sin(t * 0.005) * 9;
    ctx.fillStyle = '#232b38';
    ctx.fillRect(px - 14, r.y0 + 20, 28, 12);
    ctx.fillStyle = '#3d4759';
    ctx.fillRect(px - 3, r.y0 + 30, 6, Math.round(34 + stroke));
    ctx.fillStyle = '#2b3444';
    ctx.fillRect(px - 12, Math.round(r.y0 + 60 + stroke), 24, 14);
    ctx.fillStyle = '#1a212d';
    ctx.fillRect(px - 18, r.y1 - 12, 36, 9);
  },

  bunks(ctx, r) {
    // stacked bunk beds along the wall — future crew sleep here
    const stacks = Math.max(1, Math.floor((r.w - 100) / 120) + 1);
    for (let sIdx = 0; sIdx < stacks; sIdx++) {
      const bx = Math.round(r.x0 + 24 + sIdx * 120);
      ctx.fillStyle = '#2a3240';
      ctx.fillRect(bx - 4, r.y1 - 72, 3, 69);
      ctx.fillRect(bx + 79, r.y1 - 72, 3, 69);
      for (let lvl = 0; lvl < 2; lvl++) {
        const by = r.y1 - 12 - lvl * 32;
        ctx.fillStyle = '#333c4c';
        ctx.fillRect(bx, by, 78, 4);
        ctx.fillStyle = '#232b3a';
        ctx.fillRect(bx + 2, by - 6, 74, 6);
        ctx.fillStyle = '#3a4456';
        ctx.fillRect(bx + 4, by - 6, 12, 6);
      }
    }
  },

  vault(ctx, r, t) {
    // heavy round door
    const dx = r.x0 + 52;
    const dy = r.y1 - 52;
    ctx.fillStyle = '#212936';
    ctx.beginPath();
    ctx.arc(dx, dy, 34, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3d4759';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(dx, dy, 30, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 4);
      const ca = Math.cos(a) * 22;
      const sa = Math.sin(a) * 22;
      ctx.moveTo(dx - ca, dy - sa);
      ctx.lineTo(dx + ca, dy + sa);
    }
    ctx.stroke();
    ctx.fillStyle = '#57657c';
    ctx.beginPath();
    ctx.arc(dx, dy, 6, 0, TAU);
    ctx.fill();
    // lock status light
    ctx.fillStyle = Math.sin(t * 0.002) > -0.6 ? '#35e07b' : '#ffb454';
    ctx.fillRect(dx + 38, dy - 20, 4, 4);
    // shelving with crates
    const sx0 = r.cx + 4;
    const sw2 = r.x1 - 14 - sx0;
    for (let s2 = 0; s2 < 2; s2++) {
      const sy = r.y1 - 22 - s2 * 34;
      ctx.fillStyle = '#2a3240';
      ctx.fillRect(sx0, sy, sw2, 4);
      for (let c = 0; c < 4; c++) {
        const k = rnd(s2 * 31 + c * 7);
        if (k > 0.82) continue;
        const cw2 = 12 + Math.floor(k * 10);
        ctx.fillStyle = c % 2 ? '#4b3f2f' : '#374357';
        ctx.fillRect(sx0 + 4 + c * 26, sy - 12, cw2, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(sx0 + 4 + c * 26, sy - 12, cw2, 2);
      }
    }
  },
};

function drawEngineRoomInterior(ctx, t) {
  const r = ENGINE_RECT;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  ctx.clip();
  ctx.fillStyle = '#0d1017';
  ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  // overhead conduit pipes with amber joints
  ctx.fillStyle = '#242d3c';
  for (let i = 0; i < 3; i++) ctx.fillRect(r.x0 + 6, r.y0 + 14 + i * 11, r.x1 - r.x0 - 12, 5);
  for (let x = r.x0 + 28; x < r.x1 - 12; x += 44) {
    ctx.globalAlpha = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.006 + x));
    ctx.fillStyle = '#ffb454';
    ctx.fillRect(x, r.y0 + 25, 4, 5);
  }
  ctx.globalAlpha = 1;
  // reactor housing
  const cx = r.cx;
  const cy = r.y1 - 52;
  ctx.fillStyle = '#171d28';
  ctx.fillRect(cx - 64, r.y0 + 44, 128, r.y1 - r.y0 - 47);
  ctx.strokeStyle = '#323c4e';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 64, r.y0 + 44, 128, r.y1 - r.y0 - 47);
  // glowing amber core with flicker
  const fl = 0.75 + 0.15 * Math.sin(t * 0.013) + 0.1 * Math.sin(t * 0.037);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = clamp01(0.8 * fl);
  ctx.fillStyle = G.lamp;
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = clamp01(0.85 * fl);
  ctx.fillStyle = '#ffb454';
  ctx.beginPath();
  ctx.arc(cx, cy, 17, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffe3b0';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, TAU);
  ctx.fill();
  // spinning cyan containment arcs
  const a0 = t * 0.0016;
  ctx.strokeStyle = 'rgba(120,230,242,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 27, a0, a0 + 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 27, a0 + Math.PI, a0 + Math.PI + 1.9);
  ctx.stroke();
  // coil stacks either side, cyan bands pulsing
  for (let sIdx = -1; sIdx <= 1; sIdx += 2) {
    const bx2 = cx + sIdx * 92;
    ctx.fillStyle = '#1c2330';
    ctx.fillRect(bx2 - 14, r.y0 + 52, 28, r.y1 - r.y0 - 58);
    for (let b2 = 0; b2 < 4; b2++) {
      ctx.globalAlpha = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.004 + b2 * 1.3 + sIdx));
      ctx.fillStyle = '#5fe0f2';
      ctx.fillRect(bx2 - 11, r.y0 + 58 + b2 * 15, 22, 4);
    }
    ctx.globalAlpha = 1;
  }
  // floor line
  ctx.fillStyle = '#242e3d';
  ctx.fillRect(r.x0, r.y1 - 3, r.x1 - r.x0, 3);
  ctx.restore();
}

// ── Sprites — chunky pixel crew, ~14×26 (SPRITE metrics) ─────────────────────

function drawSprites(ctx, sprites, t) {
  ctx.font = FONT_SMALL;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < sprites.length; i++) drawSprite(ctx, sprites[i], t);
}

function drawSprite(ctx, s, t) {
  const anim = s.anim || 'idle';
  const aT = s.animT || 0;
  const px = Math.round(s.x);
  const py = Math.round(s.y);
  const color = s.color || '#7dd3fc';
  const ghost = !!s.future;

  if (anim === 'sleep') {
    drawSleeper(ctx, px, py, color, t);
  } else {
    ctx.save();
    ctx.translate(px, py);
    const dir = (s.facing === -1 || s.facing === 'left') ? -1 : 1;
    if (dir < 0 && anim !== 'climb') ctx.scale(-1, 1);
    ctx.globalAlpha = ghost ? 0.35 : 1;

    let bob = 0;
    let legPh = 0;
    if (anim === 'walk') {
      legPh = Math.floor(aT / 150) % 2;
      bob = -Math.round(Math.abs(Math.sin(aT * 0.0105)) * 1.5);
    } else if (anim === 'idle') {
      bob = Math.round(Math.sin(aT * 0.002));
    }
    ctx.translate(anim === 'work' ? Math.sin(aT * 0.004) * 1.5 : 0, bob);

    if (anim === 'climb') {
      drawClimber(ctx, color, aT);
    } else {
      // legs (darker)
      ctx.fillStyle = '#232a38';
      if (anim === 'walk') {
        if (legPh === 0) { ctx.fillRect(-6, -9, 4, 9); ctx.fillRect(2, -9, 4, 7); }
        else { ctx.fillRect(-6, -9, 4, 7); ctx.fillRect(2, -9, 4, 9); }
      } else {
        ctx.fillRect(-5, -9, 4, 9);
        ctx.fillRect(1, -9, 4, 9);
      }
      // torso in the agent's color, front arm shaded
      ctx.fillStyle = color;
      ctx.fillRect(-5, -19, 10, 10);
      ctx.fillRect(SPR_HALF - 5, -18, 3, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(-5, -12, 10, 3);
      ctx.fillRect(SPR_HALF - 5, -18, 3, 8);
      // head block + hair + eye (idle crews blink)
      ctx.fillStyle = '#b08560';
      ctx.fillRect(-4, -SPR_H, 8, 7);
      ctx.fillStyle = '#20242f';
      ctx.fillRect(-4, -SPR_H, 8, 2);
      const blink = anim === 'idle' && (aT % 3400) < 130;
      if (!blink) {
        ctx.fillStyle = '#0b0e15';
        ctx.fillRect(2, -SPR_H + 3, 1, 2);
      }
    }

    if (anim === 'work') {
      // cyan console light washing over them + green status dot
      ctx.globalAlpha = (ghost ? 0.35 : 1) * (0.12 + 0.06 * Math.sin(t * 0.008 + px));
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(4, -22, 7, 15);
      ctx.globalAlpha = (ghost ? 0.35 : 1) * clamp01(0.6 + 0.4 * Math.sin(t * 0.006));
      ctx.fillStyle = '#35e07b';
      ctx.fillRect(-2, -SPR_H - 7, 4, 4);
    }
    ctx.restore();
  }

  // name tag
  ctx.globalAlpha = ghost ? 0.32 : 0.85;
  ctx.fillStyle = color;
  ctx.fillText(s.name || '', px, py + 10);
  ctx.globalAlpha = 1;
}

function drawClimber(ctx, color, aT) {
  const ph = Math.floor(aT / 180) % 2;
  ctx.fillStyle = '#232a38';
  ctx.fillRect(-5, -9 - (ph ? 3 : 0), 4, 9);
  ctx.fillRect(1, -9 - (ph ? 0 : 3), 4, 9);
  ctx.fillStyle = color;
  ctx.fillRect(-5, -19, 10, 10);
  ctx.fillRect(-SPR_HALF, -29 - (ph ? 0 : 3), 3, 9);
  ctx.fillRect(SPR_HALF - 3, -29 - (ph ? 3 : 0), 3, 9);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-SPR_HALF, -29 - (ph ? 0 : 3), 3, 9);
  ctx.fillRect(SPR_HALF - 3, -29 - (ph ? 3 : 0), 3, 9);
  // back of the head — climbing away from camera
  ctx.fillStyle = '#b08560';
  ctx.fillRect(-4, -SPR_H, 8, 7);
  ctx.fillStyle = '#20242f';
  ctx.fillRect(-4, -SPR_H, 8, 3);
}

function drawSleeper(ctx, px, py, color, t) {
  ctx.save();
  ctx.translate(px, py);
  ctx.globalAlpha = 0.35;
  // lying flat on the bunk, head to the left
  ctx.fillStyle = '#232a38';
  ctx.fillRect(3, -6, 9, 5);
  ctx.fillStyle = color;
  ctx.fillRect(-7, -7, 10, 6);
  ctx.fillStyle = '#b08560';
  ctx.fillRect(-13, -7, 6, 6);
  // drifting zZ
  const k = (t * 0.0011 + rnd(px)) % 1;
  ctx.globalAlpha = 0.35 * (1 - k);
  ctx.fillStyle = '#9fd8e8';
  ctx.font = FONT_TINY;
  ctx.textAlign = 'left';
  ctx.fillText('z', 12, -10 - k * 10);
  ctx.fillText('Z', 17, -15 - k * 10);
  ctx.restore();
}

// ── Selection / hover highlight ───────────────────────────────────────────────

function strokeRoom(ctx, r, a, lw, glow, t) {
  if (!r) return;
  ctx.save();
  if (glow) {
    ctx.globalAlpha = 0.06 + 0.03 * Math.sin(t * 0.005);
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(r.x0, r.y0, r.w, r.h);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = lw + 3;
    ctx.strokeRect(r.x0 + 1, r.y0 + 1, r.w - 2, r.h - 2);
  }
  ctx.globalAlpha = a;
  ctx.strokeStyle = '#7defff';
  ctx.lineWidth = lw;
  ctx.strokeRect(r.x0 + 1, r.y0 + 1, r.w - 2, r.h - 2);
  ctx.restore();
}

function drawHighlights(ctx, sel, hov, t) {
  if (hov && hov !== sel) strokeRoom(ctx, ROOM_BY_ID[hov], 0.35, 1.5, false, t);
  if (sel) strokeRoom(ctx, ROOM_BY_ID[sel], 0.9, 2, true, t);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function renderShip(ctx, frame) {
  const f = frame || {};
  const t = f.t || 0;
  const sprites = f.sprites || [];
  const activity = f.activity || {};
  if (!G) initCache(ctx);

  ctx.save();
  // 1–2. night sky + city far below (with parallax + twinkle)
  drawSky(ctx, t);
  drawCity(ctx, t);
  // 8. weather outside the hull (hull occludes it)
  drawRain(ctx, t);
  // engine wash + hover emitters glow behind the shell
  drawExterior(ctx, t);

  // 3–7. everything inside the hull, clipped to the silhouette
  ctx.save();
  traceHull(ctx);
  ctx.clip();
  drawInterior(ctx, t, activity);
  drawLadders(ctx);
  drawSprites(ctx, sprites, t);
  drawHighlights(ctx, f.selectedStation, f.hoverStation, t);
  ctx.restore();

  drawShell(ctx, t);
  ctx.restore();
}

const HIT_PAD = 6;
export function hitTestStation(x, y) {
  for (let i = 0; i < ROOM_RECTS.length; i++) {
    const r = ROOM_RECTS[i];
    if (x >= r.x0 - HIT_PAD && x <= r.x1 + HIT_PAD && y >= r.y0 - HIT_PAD && y <= r.y1 + HIT_PAD) return r.id;
  }
  return null;
}
