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

// Hull envelope for the procedural INTERIOR shell (cutaway open toward +Z):
// the room block plus its slabs. The generated exterior (hullGLB.js) is
// placed around this at true proportion and is much bigger; anything that
// needs the exterior's surface or extents reads HULL_BOUNDS / HULL_TOP_Y
// from hullGLB.js, not these numbers.
export const HULL_3D = {
  x0: -600, x1: 600,                    // nose taper begins ~-460, engine block ~+470
  yTop: DECK_Y[0] + DECK_CLEAR + 40,    // 250
  yBottom: DECK_Y[1] - 60,              // -200
  zBack: -160, zFront: 60,
};

// Camera: framed like the painting — slightly above and right of center,
// looking gently down into the cutaway.
export const CAMERA = {
  fov: 33,
  // The exterior hull is 2304 long (hullGLB.js), centered at z -60. At this
  // depth (2300 to the hull's centerline) the half-width is ≈ 1310 on a
  // 1.93:1 viewport (tan(16.5°) × aspect), 1.14× the 1152 half-length, so
  // the nose block and stern clear the frame edges; y keeps the old ~4.5°
  // downward pitch so the cut still reads as a section, not a plan.
  position: [180, 150, 2120],
  target: [10, -10, 0],
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
  // Doctrine (9/10): no orange or warm hues anywhere. "amber" survives as the
  // name of the second accent so nothing downstream renames, but it is now the
  // neutral attention token (#E5E5EA family) and its deep variant a dim steel.
  amber: 0xe5e5ea,
  amberDeep: 0x7d8794,
  screen: 0x9fd8ff,
};
