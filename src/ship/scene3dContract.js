// ── Phase 2 3D-space contract ────────────────────────────────────────────────
// One coordinate system for the MODELED ship world. The 2D engine keeps its
// logical space (world.js, 1280×720); this file is the only bridge into 3D.
// shipModel.js, environment3d.js, and the ShipWorld3D host all import THIS.
//
// Axes: x = along the hull (nose at -X, engines at +X), y = up, z = toward
// the camera (the cutaway opening faces +Z).

export const toSceneX = (logicalX) => logicalX - 640; // logical x → scene x

// Real deck heights (floor surface y). Deck 0 = upper, deck 1 = lower.
export const DECK_Y = { 0: 60, 1: -140 };
export const DECK_CLEAR = 150;          // floor-to-ceiling per deck
export const ROOM_DEPTH = 180;          // rooms extend z -140..+40
export const WALK_Z = 40;               // crew walk lane (front edge of rooms)

// Hull envelope for the model shell (cutaway open toward +Z).
export const HULL_3D = {
  x0: -600, x1: 600,                    // nose taper begins ~-460, engine block ~+470
  yTop: DECK_Y[0] + DECK_CLEAR + 40,    // 250
  yBottom: DECK_Y[1] - 60,              // -200
  zBack: -160, zFront: 60,
};

// Camera: framed like the painting — slightly above and right of center,
// looking gently down into the cutaway.
export const CAMERA = {
  fov: 34,
  position: [170, 150, 1180],
  target: [0, -30, 0],
  parallax: { x: 26, y: 14 },           // pointer-driven drift amplitude
};

// Palette (matches the painted art + UI_RULES)
export const PALETTE = {
  hull: 0x12151c,
  hullDark: 0x0b0d12,
  deck: 0x161a22,
  wall: 0x10131a,
  rib: 0x1c212c,
  cyan: 0x2aabff,
  cyanSoft: 0x64d2ff,
  amber: 0xffb45c,
  amberDeep: 0xcc7a2e,
  screen: 0x9fd8ff,
};
