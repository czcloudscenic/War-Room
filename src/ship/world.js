// ── Agent Ship world geometry (the shared contract) ──────────────────────────
// One coordinate system for the whole game: engine (movement/pathfinding) and
// renderer (drawing) both import THIS file and nothing else about layout.
// Logical canvas is 1280×720; the component scales it to fit its container.
//
// Side-view cross-section, Terraria-style: three decks, rooms per station,
// ladders connecting decks. Floors are walk lines (sprite feet y == floorY).

export const WORLD_W = 1280;
export const WORLD_H = 720;

// Decks: floorY is where feet stand; ceilY is the deck's ceiling.
// CALIBRATED TO THE ARTWORK v2 (public/ship-interior.jpg, 8/17 regeneration
// matched to Danny's reference; drawn 1280×720): the cinematic renderer walks
// the crew on the art's visible deck floors.
export const DECKS = [
  { i: 0, floorY: 300, ceilY: 150 },
  { i: 1, floorY: 570, ceilY: 330 },
];

// Rooms — every station from core/shipStations.js gets geometry here, mapped
// to the artwork's visible room bays. kind survives for non-art renderers.
export const ROOMS = [
  { id: 'cockpit',    deck: 0, x0: 70,   x1: 290,  kind: 'bridge' },
  { id: 'intel',      deck: 0, x0: 310,  x1: 450,  kind: 'consoles' },
  { id: 'foundry',    deck: 0, x0: 470,  x1: 620,  kind: 'consoles' },
  { id: 'pipeline',   deck: 0, x0: 640,  x1: 790,  kind: 'grid' },
  { id: 'qc',         deck: 0, x0: 810,  x1: 980,  kind: 'lab' },
  { id: 'gateway',    deck: 0, x0: 1000, x1: 1200, kind: 'security' },
  { id: 'quarters',   deck: 1, x0: 170,  x1: 330,  kind: 'bunks' },
  { id: 'vault',      deck: 1, x0: 350,  x1: 460,  kind: 'vault' },
  { id: 'analytics',  deck: 1, x0: 460,  x1: 620,  kind: 'core' },      // the holo-core room
  { id: 'comm',       deck: 1, x0: 640,  x1: 800,  kind: 'consoles' },
  { id: 'automation', deck: 1, x0: 820,  x1: 1000, kind: 'machines' },
  { id: 'finance',    deck: 1, x0: 1020, x1: 1200, kind: 'consoles' },
];
export const ENGINE_ROOM = { deck: 1, x0: 1210, x1: 1260, kind: 'engine' };

export const roomById = (id) => ROOMS.find(r => r.id === id) || ROOMS.find(r => r.id === 'quarters');
export const roomCenter = (id) => { const r = roomById(id); return (r.x0 + r.x1) / 2; };

// Ladders connect ADJACENT decks at x — placed at the artwork's structural
// bulkhead seams so climbs read as lift shafts.
export const LADDERS = [
  { x: 300, decks: [0, 1] },
  { x: 985, decks: [0, 1] },
];

// Hull silhouette (drawn + used as bounds): nose left, engines right.
export const HULL = { x0: 48, x1: 1232, top: 120, bottom: 660 };

// The artwork's deck floors are perspective-sloped; these piecewise lines let
// the cinematic renderer place feet ON the painted floor while the engine
// keeps flat logical decks. [x, y] control points, linearly interpolated.
export const FLOOR_LINES = {
  0: [[70, 223], [400, 214], [700, 210], [1000, 222], [1200, 238]],
  1: [[170, 415], [460, 421], [620, 424], [820, 414], [1200, 400]],
};
export function floorYAt(deck, x) {
  const pts = FLOOR_LINES[deck] || [[0, DECKS[deck]?.floorY || 0]];
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
  }
  return pts[pts.length - 1][1];
}

// Sprite metrics (logical px). Agents render at 2× tile feel.
export const SPRITE = { w: 14, h: 26, walkSpeed: 55, climbSpeed: 40 }; // px/sec

// Movement-rule states a sprite can be told to hold (mirror of positionCrew):
// 'working' | 'active' | 'idle' | 'future'.
export const WANDER = { min: 3000, max: 9000, radius: 60 }; // idle pacing inside a room, ms + px
