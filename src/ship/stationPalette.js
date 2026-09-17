// ── stationPalette.js ────────────────────────────────────────────────────────
// One colour identity per station, so the cutaway reads like Fallout Shelter's
// grid of lit cells instead of one grey-blue wash.
//
// DOCTRINE (docs/SHIP-GAME-RULES.md, the Matrix look): the world is cold
// blue-black. Nothing here is warm — no orange, no amber, no yellow. The
// separation between bays comes from HUE and VALUE inside the cold/neutral
// band (icy white → cyan → teal → steel → deep blue → violet-blue → slate),
// never from temperature. The structure around the bays (hull, ribs, decks,
// tunnel) stays dark; these are the only saturated things in frame.
//
//   fill      the bright short-range lamp inside the bay (its identity)
//   rim       the low back light behind the crew (usually darker/deeper)
//   intensity candela for the fill light; the rim runs at RIM_RATIO of it
//
// Used by ShipWorld3D.jsx (the per-bay two-light rig) and roomWalls.js (the
// painted back panel is tinted toward the same fill so the wall joins the cell).

// The rim runs at 30% of the fill so it shapes silhouettes without lifting
// the whole bay back into a wash.
export const RIM_RATIO = 0.3;

export const STATION_PALETTE = {
  // Deck 0, bow → stern
  cockpit:    { key: 'icy',     fill: '#d8f2ff', rim: '#4f9ad0', intensity: 26000 }, // canopy daylight, coldest white in the ship
  intel:      { key: 'deep',    fill: '#4a86e0', rim: '#16336b', intensity: 24000 }, // deep blueprint blue
  foundry:    { key: 'violet',  fill: '#8a7ce0', rim: '#332a68', intensity: 23000 }, // violet-blue, the one non-cyan bay
  qc:         { key: 'clinic',  fill: '#cff2f4', rim: '#5fb6c2', intensity: 27000 }, // clinical white-cyan, the brightest lab
  pipeline:   { key: 'steel',   fill: '#7fa2ca', rim: '#2c4a6a', intensity: 22000 }, // steel blue, muted between two bright bays
  gateway:    { key: 'green',   fill: '#4fdcb8', rim: '#135f52', intensity: 23000 }, // green-cyan: the only green, sternmost
  // Deck 1, bow → stern
  quarters:   { key: 'slate',   fill: '#8c98a8', rim: '#232c38', intensity: 15000 }, // dim slate — people rest here, it is the dark bay
  vault:      { key: 'vault',   fill: '#59697a', rim: '#2aabff', intensity: 12000 }, // near-black steel with a hard cyan edge
  analytics:  { key: 'holo',    fill: '#6fd2ff', rim: '#166ba8', intensity: 30000 }, // the holo core: brightest cyan in the hull
  comm:       { key: 'pale',    fill: '#aecbf0', rim: '#3a5c8c', intensity: 24000 }, // pale blue, softer than intel
  automation: { key: 'teal',    fill: '#6fa8a6', rim: '#1e4749', intensity: 20000 }, // teal-grey machinery bay
  finance:    { key: 'silver',  fill: '#c8cfd8', rim: '#4f5a66', intensity: 22000 }, // neutral silver, no hue at all
};

// Fallback for any id not in the map (never null, so callers stay branch-free).
export const DEFAULT_STATION_LIGHT = { key: 'neutral', fill: '#cfd8e6', rim: '#33404f', intensity: 20000 };

/** Palette entry for a station id. Always returns an object. */
export function stationLightFor(id) {
  return STATION_PALETTE[id] || DEFAULT_STATION_LIGHT;
}
