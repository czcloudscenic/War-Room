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
// CALIBRATED TO THE ARTWORK (public/ship-interior.jpg, drawn 1280×720): the
// cinematic renderer walks the crew on the art's visible deck floors.
export const DECKS = [
  { i: 0, floorY: 300, ceilY: 165 },
  { i: 1, floorY: 570, ceilY: 380 },
];

// Rooms — every station from core/shipStations.js gets geometry here, mapped
// to the artwork's visible room bays. kind survives for non-art renderers.
export const ROOMS = [
  { id: 'cockpit',    deck: 0, x0: 95,   x1: 285,  kind: 'bridge' },
  { id: 'intel',      deck: 0, x0: 305,  x1: 465,  kind: 'consoles' },
  { id: 'foundry',    deck: 0, x0: 485,  x1: 655,  kind: 'consoles' },
  { id: 'pipeline',   deck: 0, x0: 675,  x1: 830,  kind: 'grid' },
  { id: 'qc',         deck: 0, x0: 850,  x1: 1010, kind: 'lab' },
  { id: 'gateway',    deck: 0, x0: 1030, x1: 1215, kind: 'security' },
  { id: 'quarters',   deck: 1, x0: 130,  x1: 330,  kind: 'bunks' },
  { id: 'vault',      deck: 1, x0: 350,  x1: 520,  kind: 'vault' },
  { id: 'analytics',  deck: 1, x0: 540,  x1: 760,  kind: 'core' },      // the holo-core room
  { id: 'comm',       deck: 1, x0: 780,  x1: 925,  kind: 'consoles' },
  { id: 'automation', deck: 1, x0: 945,  x1: 1095, kind: 'machines' },
  { id: 'finance',    deck: 1, x0: 1115, x1: 1225, kind: 'consoles' },
];
export const ENGINE_ROOM = { deck: 1, x0: 1230, x1: 1260, kind: 'engine' };

export const roomById = (id) => ROOMS.find(r => r.id === id) || ROOMS.find(r => r.id === 'quarters');
export const roomCenter = (id) => { const r = roomById(id); return (r.x0 + r.x1) / 2; };

// Ladders connect ADJACENT decks at x — placed at the artwork's structural
// bulkhead seams so climbs read as lift shafts.
export const LADDERS = [
  { x: 475,  decks: [0, 1] },
  { x: 1020, decks: [0, 1] },
];

// Hull silhouette (drawn + used as bounds): nose left, engines right.
export const HULL = { x0: 48, x1: 1232, top: 120, bottom: 660 };

// Sprite metrics (logical px). Agents render at 2× tile feel.
export const SPRITE = { w: 14, h: 26, walkSpeed: 55, climbSpeed: 40 }; // px/sec

// Movement-rule states a sprite can be told to hold (mirror of positionCrew):
// 'working' | 'active' | 'idle' | 'future'.
export const WANDER = { min: 3000, max: 9000, radius: 60 }; // idle pacing inside a room, ms + px
