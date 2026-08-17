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
// CALIBRATED TO THE ARTWORK v3 (public/ship-interior.jpg 2048×1143, measured
// 8/17 from zoomed crops; logical = px·1280/2048 horizontally, px·720/1143
// vertically). The art is a tilted cutaway — both decks slope DOWN toward the
// stern (right), so FLOOR_LINES below carry the real walk lines; floorY stays
// the flat logical contract for the engine. ceilY only positions station chips
// (ShipScene3D renders them at ceilY-26): 190 puts the upper row just above
// the upper bays, 370 rides the mid-deck slab above the lower bays.
export const DECKS = [
  { i: 0, floorY: 300, ceilY: 190 },
  { i: 1, floorY: 570, ceilY: 370 },
];

// Rooms — every station from core/shipStations.js gets geometry here, mapped
// to the artwork's visible room bays. kind survives for non-art renderers.
export const ROOMS = [
  { id: 'cockpit',    deck: 0, x0: 105,  x1: 400,  kind: 'bridge' },    // glass nose canopy + holo table + pilot chair
  { id: 'intel',      deck: 0, x0: 430,  x1: 595,  kind: 'consoles' },  // blue blueprint-screen room
  { id: 'foundry',    deck: 0, x0: 625,  x1: 725,  kind: 'consoles' },  // dark locker/panel bay
  { id: 'pipeline',   deck: 0, x0: 755,  x1: 895,  kind: 'grid' },      // hanging-lamp bay before the big stern rib
  { id: 'qc',         deck: 0, x0: 945,  x1: 1115, kind: 'lab' },       // big teal wall-screen room
  { id: 'gateway',    deck: 0, x0: 1125, x1: 1220, kind: 'security' },  // sternmost glass-panel bay
  { id: 'quarters',   deck: 1, x0: 195,  x1: 395,  kind: 'bunks' },     // cable room with the reclined bunk
  { id: 'vault',      deck: 1, x0: 425,  x1: 605,  kind: 'vault' },     // tall dark cabinet + workstation bay
  { id: 'analytics',  deck: 1, x0: 620,  x1: 815,  kind: 'core' },      // the holo-core room (cylinder center ≈ x 684)
  { id: 'comm',       deck: 1, x0: 825,  x1: 915,  kind: 'consoles' },  // operator chair + wall screens right of the core
  { id: 'automation', deck: 1, x0: 950,  x1: 1085, kind: 'machines' },  // machinery/crate bay past the stern rib
  { id: 'finance',    deck: 1, x0: 1090, x1: 1220, kind: 'consoles' },  // warm-lamp desk office at the stern
];
export const ENGINE_ROOM = { deck: 1, x0: 1210, x1: 1260, kind: 'engine' };

export const roomById = (id) => ROOMS.find(r => r.id === id) || ROOMS.find(r => r.id === 'quarters');
export const roomCenter = (id) => { const r = roomById(id); return (r.x0 + r.x1) / 2; };

// Ladders connect ADJACENT decks at x — placed at the artwork's structural
// bulkhead seams so climbs read as lift shafts.
export const LADDERS = [
  { x: 416, decks: [0, 1] },  // big nose bulkhead: cockpit|intel above, quarters|vault below
  { x: 925, decks: [0, 1] },  // stern structural rib: pipeline|qc above, comm|automation below
];

// Hull silhouette (drawn + used as bounds): nose left, engines right.
export const HULL = { x0: 48, x1: 1232, top: 120, bottom: 660 };

// The artwork's deck floors are perspective-sloped; these piecewise lines let
// the cinematic renderer place feet ON the painted floor while the engine
// keeps flat logical decks. [x, y] control points, linearly interpolated.
export const FLOOR_LINES = {
  0: [[110, 283], [300, 291], [500, 296], [720, 318], [900, 347], [1200, 433]],
  1: [[195, 460], [500, 509], [688, 551], [875, 551], [1063, 583], [1200, 592]],
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
