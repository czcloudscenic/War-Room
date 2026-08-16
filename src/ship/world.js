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
export const DECKS = [
  { i: 0, floorY: 250, ceilY: 150 },
  { i: 1, floorY: 425, ceilY: 305 },
  { i: 2, floorY: 600, ceilY: 480 },
];

// Rooms — every station from core/shipStations.js gets geometry here.
// kind drives interior props the renderer draws (consoles, core, bunks…).
export const ROOMS = [
  { id: 'cockpit',    deck: 0, x0: 80,   x1: 280,  kind: 'bridge' },
  { id: 'intel',      deck: 0, x0: 300,  x1: 520,  kind: 'consoles' },
  { id: 'foundry',    deck: 0, x0: 540,  x1: 760,  kind: 'consoles' },
  { id: 'qc',         deck: 0, x0: 780,  x1: 980,  kind: 'lab' },
  { id: 'gateway',    deck: 0, x0: 1000, x1: 1195, kind: 'security' },
  { id: 'pipeline',   deck: 1, x0: 95,   x1: 330,  kind: 'grid' },
  { id: 'comm',       deck: 1, x0: 350,  x1: 570,  kind: 'consoles' },
  { id: 'analytics',  deck: 1, x0: 590,  x1: 820,  kind: 'core' },      // the holo-core room
  { id: 'automation', deck: 1, x0: 840,  x1: 1060, kind: 'machines' },
  { id: 'finance',    deck: 1, x0: 1080, x1: 1195, kind: 'consoles' },
  { id: 'quarters',   deck: 2, x0: 170,  x1: 560,  kind: 'bunks' },
  { id: 'vault',      deck: 2, x0: 580,  x1: 800,  kind: 'vault' },
  // deck 2 right of the vault is the engine room — decorative, not a station
];
export const ENGINE_ROOM = { deck: 2, x0: 820, x1: 1110, kind: 'engine' };

export const roomById = (id) => ROOMS.find(r => r.id === id) || ROOMS.find(r => r.id === 'quarters');
export const roomCenter = (id) => { const r = roomById(id); return (r.x0 + r.x1) / 2; };

// Ladders connect ADJACENT decks at x. Pathfinding: walk along deck to a
// ladder that reaches the target deck, climb, repeat.
export const LADDERS = [
  { x: 290,  decks: [0, 1] },
  { x: 578,  decks: [0, 1] },
  { x: 990,  decks: [0, 1] },
  { x: 160,  decks: [1, 2] },
  { x: 830,  decks: [1, 2] },
];

// Hull silhouette (drawn + used as bounds): nose left, engines right.
export const HULL = { x0: 48, x1: 1232, top: 120, bottom: 660 };

// Sprite metrics (logical px). Agents render at 2× tile feel.
export const SPRITE = { w: 14, h: 26, walkSpeed: 55, climbSpeed: 40 }; // px/sec

// Movement-rule states a sprite can be told to hold (mirror of positionCrew):
// 'working' | 'active' | 'idle' | 'future'.
export const WANDER = { min: 3000, max: 9000, radius: 60 }; // idle pacing inside a room, ms + px
