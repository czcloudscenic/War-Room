// ── Agent Ship movement engine ────────────────────────────────────────────────
// Pure simulation: no React, no DOM, no clocks — time arrives via tick(dtMs).
// Turns positionCrew() assignments into sprites that walk decks and climb
// ladders (world.js geometry). Pathfinding is Terraria-simple: walk along the
// current deck to the nearest ladder toward the target deck, climb, repeat,
// then walk to a spot near the room center. Idle crew pace their room on a
// deterministic per-sprite PRNG (no Math.random — replays are stable).

import { DECKS, LADDERS, HULL, SPRITE, WANDER, roomById, roomCenter } from './world.js';
import { ROSTER } from '../core/shipStations.js';

const MAX_STEP_MS = 100;   // dt-spike clamp: no single integration step above this
const MAX_TICK_MS = 1000;  // total sim time absorbed per tick (tab-sleep guard)
const ROOM_PAD = 12;       // keep feet off room walls
const EPS = 0.5;           // px — close enough to snap onto a waypoint

const ROSTER_NAMES = new Set(ROSTER.map(m => m.name));
const deckFloor = (i) => DECKS[i].floorY;

// Deterministic per-sprite PRNG (mulberry32 seeded from the name's char codes).
function seedFromName(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampToHull = (x) => Math.min(HULL.x1 - SPRITE.w / 2, Math.max(HULL.x0 + SPRITE.w / 2, x));
const clampToRoom = (x, room) => Math.min(room.x1 - ROOM_PAD, Math.max(room.x0 + ROOM_PAD, x));

// Where this crew member stands inside their room (index*24 fan-out so
// co-located sprites don't stack; clamped so nobody clips a wall).
function standX(stationId, crewIndex) {
  const room = roomById(stationId);
  return clampToRoom(roomCenter(stationId) + crewIndex * 24, room);
}

// Fixed bunk x for future crew: spread evenly across the quarters room.
function bunkX(futureIndex, futureCount) {
  const room = roomById('quarters');
  const span = room.x1 - room.x0;
  return clampToRoom(room.x0 + (span * (futureIndex + 1)) / (futureCount + 1), room);
}

// Waypoints from the sprite's current spot to (targetDeck, targetX).
// Adjacent-deck ladders only, so deck 0→2 naturally becomes two hops.
function buildPath(fromDeck, fromX, targetDeck, targetX) {
  const path = [];
  let d = fromDeck;
  let x = fromX;
  while (d !== targetDeck) {
    const next = d + (targetDeck > d ? 1 : -1);
    const options = LADDERS.filter(l => l.decks.includes(d) && l.decks.includes(next));
    if (!options.length) break; // geometry contract violated — stop rather than teleport
    let best = options[0];
    for (const l of options) if (Math.abs(l.x - x) < Math.abs(best.x - x)) best = l;
    if (Math.abs(best.x - x) > EPS) path.push({ type: 'walk', x: best.x });
    path.push({ type: 'climb', x: best.x, deck: next });
    x = best.x;
    d = next;
  }
  if (Math.abs(targetX - x) > EPS || path.length === 0) path.push({ type: 'walk', x: targetX });
  return path;
}

export function createShipSim() {
  const sprites = [];            // internal state, crew order
  const byName = new Map();

  function setAnim(s, anim) {
    if (s.anim !== anim) { s.anim = anim; s.animT = 0; }
  }

  function restAnim(s) {
    if (s.future) return 'sleep';
    if (s.state === 'working' || s.state === 'active') return 'work';
    return 'idle';
  }

  function resetWanderTimer(s) {
    s.wanderWait = WANDER.min + s.rng() * (WANDER.max - WANDER.min);
  }

  function setCrew(crewPositions = []) {
    const crew = crewPositions.filter(c => c && ROSTER_NAMES.has(c.name));
    const futureCount = crew.filter(c => c.future).length;
    const next = [];
    let futureIndex = 0;

    crew.forEach((c, i) => {
      const room = roomById(c.station);
      const targetX = c.future ? bunkX(futureIndex++, futureCount) : standX(c.station, i);
      let s = byName.get(c.name);

      if (!s) {
        // First sighting: spawn standing at the assigned room's center line.
        s = {
          name: c.name, color: c.color, future: !!c.future,
          station: c.station, state: c.state, lastAction: c.lastAction ?? null,
          deck: room.deck, x: targetX, y: deckFloor(room.deck),
          facing: 1, anim: 'idle', animT: 0,
          path: [], targetX,
          rng: mulberry32(seedFromName(c.name)),
          wanderWait: 0, wanderX: null,
        };
        resetWanderTimer(s);
        setAnim(s, restAnim(s));
        byName.set(c.name, s);
      } else {
        s.color = c.color;
        s.future = !!c.future;
        s.state = c.state;
        s.lastAction = c.lastAction ?? null;
        if (s.future) {
          // Future crew never move: pin them to their bunk.
          s.station = 'quarters';
          s.path = [];
          s.deck = roomById('quarters').deck;
          s.x = targetX;
          s.y = deckFloor(s.deck);
          setAnim(s, 'sleep');
        } else if (c.station !== s.station || Math.abs(targetX - s.targetX) > EPS) {
          // New assignment (or new fan-out slot): pathfind from wherever we are.
          s.station = c.station;
          s.targetX = targetX;
          s.wanderX = null;
          s.path = buildPath(s.deck, s.x, room.deck, targetX);
        }
      }
      next.push(s);
    });

    // Drop crew no longer on the roster we were handed.
    sprites.length = 0;
    byName.clear();
    for (const s of next) { sprites.push(s); byName.set(s.name, s); }
  }

  // One integration step, dt already clamped to MAX_STEP_MS.
  function step(dt) {
    const dtSec = dt / 1000;
    for (const s of sprites) {
      if (s.future) { setAnim(s, 'sleep'); s.animT += dt; continue; }

      const wp = s.path[0];
      if (wp) {
        if (wp.type === 'walk') {
          setAnim(s, 'walk');
          const dx = wp.x - s.x;
          if (dx !== 0) s.facing = dx > 0 ? 1 : -1;
          const move = SPRITE.walkSpeed * dtSec;
          if (Math.abs(dx) <= move) { s.x = wp.x; s.path.shift(); }
          else s.x += Math.sign(dx) * move;
          s.x = clampToHull(s.x);
        } else { // climb: x snaps to the ladder, y slides between floor lines
          setAnim(s, 'climb');
          s.x = wp.x;
          const ty = deckFloor(wp.deck);
          const dy = ty - s.y;
          const move = SPRITE.climbSpeed * dtSec;
          if (Math.abs(dy) <= move) { s.y = ty; s.deck = wp.deck; s.path.shift(); }
          else s.y += Math.sign(dy) * move;
        }
        if (!s.path.length) { setAnim(s, restAnim(s)); if (s.anim === 'idle') resetWanderTimer(s); }
        s.animT += dt;
        continue;
      }

      // Arrived. Working/active crew man their console; idle crew pace.
      if (s.state === 'working' || s.state === 'active') {
        setAnim(s, 'work');
        s.animT += dt;
        continue;
      }

      // Idle: occasional slow wander inside the room bounds.
      const room = roomById(s.station);
      if (s.wanderX != null) {
        setAnim(s, 'walk');
        const dx = s.wanderX - s.x;
        if (dx !== 0) s.facing = dx > 0 ? 1 : -1;
        const move = SPRITE.walkSpeed * dtSec;
        if (Math.abs(dx) <= move) {
          s.x = s.wanderX;
          s.wanderX = null;
          setAnim(s, 'idle');
          resetWanderTimer(s);
        } else s.x += Math.sign(dx) * move;
        s.x = clampToRoom(clampToHull(s.x), room);
      } else {
        setAnim(s, 'idle');
        s.wanderWait -= dt;
        if (s.wanderWait <= 0) {
          const target = clampToRoom(s.x + (s.rng() * 2 - 1) * WANDER.radius, room);
          if (Math.abs(target - s.x) > EPS) s.wanderX = target;
          else resetWanderTimer(s);
        }
      }
      s.animT += dt;
    }
  }

  function tick(dtMs /*, nowMs — accepted for API symmetry, sim is dt-driven */) {
    let remaining = Math.min(Math.max(0, Number(dtMs) || 0), MAX_TICK_MS);
    while (remaining > 0) {
      const dt = Math.min(remaining, MAX_STEP_MS);
      step(dt);
      remaining -= dt;
    }
  }

  function getSprites() {
    return sprites.map(s => ({
      name: s.name, color: s.color, future: s.future,
      x: s.x, y: s.y, deck: s.deck, facing: s.facing,
      anim: s.anim, animT: s.animT,
      station: s.station, state: s.state, lastAction: s.lastAction,
    }));
  }

  return { setCrew, tick, getSprites };
}
