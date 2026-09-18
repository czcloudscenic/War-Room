# Vantus Handoff Brief

## 2026-09-17 (night) — crew rebuilt on one auto-rigged skeleton; versioned asset names. Pushed through 86bb306.

**Read this before touching the crew again.** Two rules came out of tonight, both paid for.

**Rule 1: never hand-skin a static mesh onto a donor rig.** The Neo and
Morpheus zips are static meshes. Skinning them onto the Mixamo rig in Blender
failed four separate ways, each invisible until the figure was on screen:
exported lying on their backs; upside down once that was corrected; 74x
oversized because a skinned mesh's geometry can sit in a space its own node
transform does not describe (skeleton 0..1.81, mesh box straddling zero at
+/-1); and baking the armature scale to fix THAT invalidated the skin binding
so the mesh collapsed onto the head. The generate-then-auto-rig route
(`image_to_3d` with `enable_rigging`, `pose_mode: a-pose`, `should_texture:
true`, `animation_action_id: 30`) was correct the first time and every time
after. All four crew now come from it, on the identical 24-joint rig
`crewPose.js` binds: Neo (Sean), blonde red dress (Muse), woman in black
(Scrappy), Morpheus (Slate).

**Rule 2: bump the filename when a GLB is regenerated.** Files are
`/crew/<name>-r2.glb`, `/sentinel/head-r2.glb`. A replaced asset under the
SAME name is served stale by browsers and the Netlify CDN, so new code runs
against an old broken mesh. That is exactly the picture Christian was sent:
a figure folded 70 deg at the waist, another twisted 90 deg at the torso. The
harness could not reproduce either at 883 frames of forced full-rate
simulation, flown into the same stations; the raw work clip bends ~20 deg,
the pose layers are clamped far below that, and restore/apply does not
accumulate. Stale mesh under new calibration is the one thing that produces
it. If a crew member ever looks bent double again, check the filename before
the code.

**Sizing.** `calibrate()` in `crewGLB.js` sizes each figure from its posed
skeleton on the first animated frame - measuring at LOAD reads a span of 0
because the bones still sit at their raw node transforms before the first
mixer update. Bind-pose boxes are not trusted anywhere any more.

**Walk.** All four carry the human-authored walk retargeted from
`mr-man-walking.fbx` (`scratchpad/work/retarget.py`: 22/22 bones, rotation
only, no hips translation). Checks before install: bind bbox unchanged, head
above hips, knees ~103-170, elbows ~128-168. The library `Casual_Walk` barely
swung the arms.

**Harness tricks that finally gave ground truth.** Override
`window.requestAnimationFrame` with a setTimeout(0) shim to run ~120 fps under
Playwright's 1 fps throttle; `__selectStation(id)` flies in (Slate lives at
`qc`, Scrappy at `intel`, Muse `foundry`, Sean `cockpit`); measure hips->head
lean per rig from the skeleton, not from a screenshot.

## 2026-09-17 (late) — Christian's asset drop becomes the crew and the sentinel. Pushed through c06d4d0.

Fifteen zips of Matrix and Fallout assets. The rule that came out of it: **use
the assets, do not admire them.** An earlier pass converted the lot and wired
almost none of it, and that was the complaint.

**The crew are the Matrix cast.** Neo, Morpheus and the walking woman all
arrived as STATIC meshes, no skeleton, so none could be dropped in as crew.
Each is skinned with automatic weights to the Mixamo rig inside
`mr-man-walking.fbx` (the only human-authored clip in the drop), then its bones
RENAMED to the names `crewPose.js` binds: strip `mixamorig:`, `Spine1`->
`Spine01`, `Spine2`->`Spine02`, `Neck`->`neck`. **Skip the rename and everything
still renders while nothing drives it** - hips layer, joint limits, head
look-at and the shared idle/work clips all fail silently. `missing_contract_bones`
in the bind script is the check.

Three auto-weighting failures on scanned characters, each with a fix worth
keeping (all in `scratchpad/work/bindrig.py`):
- **Long coat binds to the legs** and swings as a rigid slab with whichever
  thigh won the vertex, shearing through the other. Coat verts get re-weighted
  onto the spine chain by height so the hem follows the pelvis. This is the
  same failure that tore every previous Slate build.
- **Hair cards and glasses arms get claimed by a HAND bone** and stretch into a
  spike across the frame. Everything above the neck is locked to neck/head.
- **Orientation.** The woman imported feet-up. A "widest slice" test is wrong
  for both arms-down and wide-stance figures; compare the FOOTPRINT of the
  bottom slab against the top instead (soles cover ground, a skull crown
  tapers). Neo 0.60 vs 0.11, the woman 29872 vs 96217.

The woman in the red dress was NOT in the drop - the only woman there wears a
striped shirt and jeans - so she is generated on the same 24-joint rig the
earlier crew used. Morpheus keeps his fight stance because that stance IS his
bind pose; the walk plays as a delta on top of it and reads combat-ready at
crew scale.

**Sentinel.** `/sentinel/head.glb` is now the real machine's body core, pulled
out of the 3M-triangle FBX by keeping `Corpo|Body|Olho|Lente` and dropping
`Garra|Braco|Aros`, decimated to 40k, rotated to face +X, re-materialled from
tan plastic to dark metal. **Our procedural tentacles stay** - the model's arms
are static and all the pursuit/attach behaviour lives in those tentacles.

**Crew grade.** Black leather vanished against an unlit bay. Exposure cannot
fix it (anything times black is still black), so `GRADE.darkFloor` puts a
luminance floor under the darkest garments. The red dress is the check that it
has not gone too far.

### The hull swap that got reverted - do not redo it
The Matrix hovercraft from `matrix-cruiser.zip` was fitted properly (scale
2.37, nose already -X so YAW 0, every bay station clearing the deck block) and
Christian rejected it on sight: the generated hull's greebled plating, masts
and glowing pads read far more Matrix than a clean model. It is fully reverted.
**The hull is settled. Leave it alone.**

### Converted, on disk, still unused
`scratchpad/out/`: `apu.glb` (APU walker, walk clip intact, x16.73 for 4 m),
`fallout-room.glb` (open-fronted Fallout Shelter room, +X open face, 752 KB),
`sentinel-hi.glb`, `matrix-cruiser.glb`. Unusable as delivered: Agent Arnold
(1.5M tris, no skeleton), both Neo OBJs are static (that is why they get
skinned), `woman-walking` has no rig despite the name.

### Harness
`window.__shipWorld.fit()` projects the hull bbox and returns the worst |NDC|;
<= 1 is on-screen. The camera is not in the scene graph, so it is exposed on
the same hook. Motion is verified by grabbing two frames ~6 s apart and
diffing the crew band: 23% of pixels change when the crew are animating.

## 2026-09-17 (Counsel + 4 agents) — the pelvis, the joints, bays on the hull profile, Rush + morale, and a crew rebuild. Pushed through 70bbc41.

**THE PELVIS (d20d337).** Christian: "add control joints in the hips so they don't stand/walk stupid — this has been the biggest error since day 1." He was right, and the cause was worse than missing joints: the joints existed and *nothing ever drove them*. `crewPose.js` drove look, feet, arms and spine; the Hips bone was touched only by a vertical foot-IK follow. New `hipsLayer` runs FIRST (hips lead, feet answer): walking reads the stride straight off the feet (u = forward separation, lift = foot height difference), leads with the swinging leg's hip, drops that hip on the airborne side, shifts over the planted foot, bobs twice per stride, counter-rotates the upper spine; standing is contrapposto with a weighted-leg swap every ~5.5 s. **Body-left is +x**, so leading with the left hip is a NEGATIVE yaw — get that backwards and the walk inverts.

**JOINT LIMITS (70bbc41)** — the answer to "they're still not one solid figure". I measured the meshes first: skin weights are clean (sum to 1.0 on 100% of vertices, cross-limb bleed 0.01–1.8%), so it was never the rig. The cause was `POSE.reach` placing hands **~1.7 arm-lengths** from the shoulder, so every working frame hit the hard extension clamp and held the elbow at ~180°, which is exactly where a skinned sleeve shears off the forearm. Hands now hang off each arm's own shoulder at 0.83 of chain (elbow rests ~121°, measured 119–148° live). `POSE.limits`: elbow/knee 6–150°, hinge direction taken ONCE at bind from each limb's rest bend, shoulder cone 90°, hip 60°, arm maxExtend 0.90 with an ease. `correctPosture`'s arm tuck now fades out as the reach layer takes the shoulder, so one layer owns a bone. 10 tests, proven load-bearing by mutation.

**BAYS FOLLOW THE HULL (f354fbf).** Christian: "match the outline of the bay to the outside of the ship, the shaders are working against us." The panels and glow cards were axis-aligned rectangles inside a tapered vessel. `hullGLB` now measures a BOTTOM profile too (rejecting the hover pads) and exposes `HULL_BOTTOM_Y`, `hullProfileAt`, `bayProfileAt`, `hullProfileVersion`; `roomWalls` builds panel and glow as ONE shared profile-shaped mesh with the falloff baked into vertex colour instead of a radial texture. Deck slabs stepped to the same profile.

**THE CUTTING BEAM (f354fbf).** It had gone invisible: drawing behind the machine's own body, leaving only the weld blob. Beam and impact now draw over everything (`depthTest: false`, high renderOrder) with a wider core and a haze sleeve.

**RUSH + MORALE (a82164a).** Station detail shows the agent, morale (48 h success ratio, "unknown" with no receipts — never a default), output, blockers, and a Rush button calling the real `/api/agent-action` through the existing `apiFetch` (Bearer supabase token, `{action, payload, client_id}`). `RUSH_ACTION` maps six stations to real action keys; 10-minute cooldown, failed runs burn it via a session log because the events feed carries successes only.

### CREW REBUILD — in flight, do not half-wire it
Christian: "fix how the figures actually look, maybe you just have to rebuild the assets so they're similar to Fallout Shelter." Four new stylized crew generated (GPT Image 2.5 A-pose sheets → Meshy `image_to_3d` with `enable_rigging`, `pose_mode: a-pose`, texture on, PBR OFF) and installed as `public/crew/{sean,muse,scrappy,slate}2.glb` (walk clip baked in, ~1.2 MB each, 31k tris, ONE mesh, 1.80 m). Idle (action 11) and work (action 34) clips were generating at handoff time. **Swap all three slots per character at once** — pointing `CREW_GLB.walk` at a new rig while `idle` still points at an old one mixes two different skeletons and proportions. Sheets for review: `~/Desktop/crew-v2-sheets`. Note this moves the crew off Danny's photoreal-Matrix doctrine; Christian made that call knowingly.

### Harness capture (the rAF throttle)
Playwright throttles this page's rAF to **exactly 1000 ms**, so fps readings there are meaningless and `browser_take_screenshot` times out. Both harnesses now expose an on-demand capture: `window.__shipWorld.grab()` and `window.__grab()` (model viewer) render one frame and return a PNG data URL; POST it to a tiny local writer (pattern in `/tmp/shot-server.mjs`, port 5198) to get a file. `preserveDrawingBuffer` is dev-only.

## 2026-09-17 (Counsel + 3 agents) — the Fallout Shelter read, wider tunnel, no weather, the sentinel seated, agents that move. Pushed.

Christian's list: agents' movement, "multiple colors blending", load "glitches then goes into the actual ship", rain in a tunnel and too slow, tunnel too narrow (top sentinel clipping the roof), sentinel still not attached, "not looking like Fallout Shelter".

**The colour complaint and the Fallout Shelter complaint were one problem.** FS rooms are bright, evenly lit, per-room COLOUR cells framed by dark structure. Ours was a uniform grey-blue wash.
- `src/ship/stationPalette.js` (new): one identity per station, all inside the cold/neutral band (no warm hue) — icy cockpit, deep-blue intel, violet foundry, clinical qc, steel pipeline, green-cyan gateway, slate quarters, near-black vault with a cyan edge, bright cyan analytics, pale comm, teal automation, silver finance.
- The bay is **painted bright, not lit bright**: the back panel glows at emissive 0.85 in its station colour and an additive "cell glow" card fills the bay opening at 0.72, and the props are tinted 0.22 toward the same colour with emissive 0.42. Only the bays a receipt says are live get a real lamp, max four.
- **Do not add per-bay point lights.** Twelve fills plus twelve rims put 30 point lights in the scene; a dozen point lights has blanked the frame before on this project. The painted approach is also the historically correct one.
- Structure recedes: environmentIntensity 0.32→0.12, front fill 200k→66k, hull/decks/walls material colours ×0.55 in ShipWorld3D only. Ambient 0.95 / hemi 1.0 carry the interior.
- Crew grade relaxed (`crewGLB.js` GRADE saturation 0.58→0.95): it had been tuned to sink them INTO the old painted plate, which was making them part of the wash. They should be the most saturated thing in a bay.
- Camera reframed to the CUTAWAY: [180,150,2120] → **[120,60,1500]**. FS fills the screen with rooms; the exterior may run off frame.

**Agents move.** `world.js` gains `TASK` (7–17 s); working crew step to another spot in their own bay and settle back (`shipEngine.js`), so they are not statues. Walk speed 30→46, wander 1.8–5.2 s at radius 95. Verified headlessly: 44–65 units of travel per agent over 99 s of sim.

**Tunnel** (agent): CEIL_Y 420→670, FLOOR_Y −500→−760, WALL_Z −580, FRONT_Z 540. Clearance above the masts 201, above a docked sentinel 270, above the cruising escort 375 — nothing can clip the roof. Ribs and lamps every segment, speed 240→384. **All weather removed**; 24 slow beads fall from the ceiling ribs only.

**Sentinel** (agent): seated at `hullTopY(dockX) − 6` so the legs sink into the plating, scale 300→210, beam now ~123 units and vertical from the head's underside to a weld point directly beneath it, additive weld disc lying on the plating, sparks biased along the hull, contact shadow under the body.

**Load gate** (agent): the rig stays hidden behind a "BOOTING SHIP" overlay until textures, hull, first prop and walls land, or 6 s, then fades in over 400 ms. Failures count as landed so it cannot wedge.

### Two hard-won harness notes
- **16.1M triangles**: the modeled tentacle segments were cloned onto ~660 segments at 29.6k tris each. Removed — at ship distance an arm is a few pixels and the primitive cylinders read identically. If a close-up ever needs them, attach to the first two segments of the cutter only. Scene is now ~2.3M tris. The sentinel head was rebuilt (weld → simplify 0.02) 99k → **39.7k**; plain `simplify` does nothing on these meshes without `weld` first.
- **fps in the Playwright harness is meaningless**: frame gaps are exactly 1000.0 ms because the automated browser throttles rAF, even with an M3 Pro GPU and with every update() no-opped. Screenshots time out for the same reason. Use the new capture path instead: `window.__shipWorld.grab()` renders one frame and returns a PNG data URL (dev-only `preserveDrawingBuffer`); POST it to a tiny local writer (see /tmp/shot-server.mjs pattern) to get a file.

**Next:** the bays can go brighter still; rush button; morale on the crew; incident visuals inside the bay.

## 2026-09-17 (Counsel, later) — game layer step 1: the three bars, incidents, morale, all from rows; the ship stops shaking. Pushed.

- **Calm ship (Christian: "hard to click into anything"):** the pursuit shudder and the hand-held camera are gone; the rig keeps a slow cruise sway only (z ±0.006 rad over 9 s, y ±2.5) and pointer parallax is halved. Measured in the harness: chip drift 0.4 px over 1.5 s. The pursuit now shows in the cutter, sparks and the bars, not in motion.
- **`shipStations.js` game layer (pure, 12 new tests, 65/65):** `computeBars({content, health})` → pipeline (share of open items moved in 24 h), approvals (items at a human gate), health (link, backup, credits; names the first failure; amber "unknown" when nothing is known). `computeIncidents(content)` → one incident per blocked item in its station (`stationForItem` from status), spreading one hop along `SPREAD_ORDER` (foundry → qc → pipeline → comm) per 24 h unhandled; `cutIntensity = 0.4 + 0.6 * clamp(oldestHours/72)`. `computeMorale(events)` → success ratio per agent over 48 h, null without receipts.
- **Wired:** ShipRoute renders the three bars in the top strip (green / neutral / red, label from the function) plus an INCIDENTS count when any exist; passes `incidents` and `morale` to ShipWorld3D. Chips with an incident pulse red with `!n` (title: count, oldest hours, spread). `sentinels3d.update(t, { enclosed, cut })` scales beam, impact light and spark rate by `cut`. Harness feeds two blocked items (one 30 h old) so Foundry shows !1 and QC !2 and cut = 0.65.
- **Test file gotcha:** rolldown cannot bundle a dynamic `await import()` in tests/core.test.mjs; use static imports at the top. The tally line prints before the last block: new assertions go ABOVE `console.log(\`\\n${pass} passed...\`)`.

**Next (build order):** station incident visuals in 3D (flicker + sparks in the bay, relight on clear), rush button in fly-in wired to `agent-action` with a 10-min cooldown and morale ±10, morale shown in fly-in, drag-to-assign as intent, then the pursuit event beats driven by incidents.

## 2026-09-17 (Counsel) — DIRECTION: the ship as Fallout Shelter. Rules doc + procedural joint layers. Pushed.

Christian: "think like Fallout Shelter; joint points at knees/ankles/elbows/wrists/neck to maximize movement; then the pursuit event; assets maybe later." Read `docs/SHIP-GAME-RULES.md` (new) before touching game logic: stations = rooms, agents = dwellers, receipts = production, blocked items = incidents that spread, sentinel cut intensity from the oldest blocker's age, rush = the real agent action, morale = success ratio over 48 h. Build order is at the bottom of that doc.

**Joint layers (`src/ship/crewPose.js`, new; wired in `crewGLB.js`):** the rigs already had the joints; these are procedural layers after the mixer and after `correctPosture`, in order legs → spine → arms → head, all weighted by the `POSE` config (exported): head look-at (neck 30 / head 70, ±70° yaw ±35° pitch, tau 0.25 s; work = the console, idle = wandering glances, `sprite.lookAt` or `figure.setLookTarget()` overrides), foot planting with analytic two-bone IK + pelvis follow (`figure.setGroundFn(fn)`; weight 1 idle/work, 0.6 walk, 0 climb), console reach (hands on a plane 34% of height, 9 ahead after tuning from 22 which exceeded the ~10-unit arm, 3 Hz alternating typing bob, 0.4 s ease), walk lean (max 6°) and `figure.impulse(strength)` recoil spring with head dip. Verified in the harness: heads yaw 11–38° toward consoles while working, hands ahead of the hips, feet on the floor, no console errors. Nothing calls `impulse()` yet: the pursuit event should.

**Next (build order):** `computeBars` + `computeIncidents` in `shipStations.js` (pure), the top bar strip, station incident visuals, sentinel intensity from blocker age, rush, morale, drag-to-assign as intent.

## 2026-09-14 (Counsel, night) — brighter tunnel rig; the movie sentinel; crew walk the stairs; cleaner idles. Pushed.

- **Brightness:** exposure 1.7, ambient 0.46, hemisphere 0.7, key 3.4, front fill 200000, fog 0.00042 (the tunnel pass had overshot dark).
- **The docked cutter is now a purpose-generated model** (`public/sentinel/perched-a.glb`, Tripo, 2.1 MB): a sentinel in the wrapped gripping pose, long tentacle legs on the plating, bulbous riveted head, red eye. `sentinels3d.js`: the animated machine flies in and lands as before; at land > 0.5 it hides and the perched model shows at (dockX, HULL_TOP_Y(dockX) - 2, dockZ), scaled to ~300 units across, facing the nose, breathing 1%, shuddering with the cut; the beam's muzzle moves to the perched head. `perched-b.glb` (a crouched beetle variant with a base plate) is in the folder unused. The animated machine's arms are also long whips now (11 segs x 13) with a radial grip pose, and the head is rolled so its socket sits under the body.
- **Crew walk the stairs** (`shipEngine.js`, `ShipWorld3D.jsx`, `crewGLB.js` climb branch): `sprite.climbT` 0..1 and `sprite.climbDir`; the placement maps climbT onto the real switchback path (walk lane → lower flight A at sx-42 rising z 30→-70 → landing crossing to sx+10 → upper flight B back to z 28 → hatch), arc-length sampled, feet within 2 units of tread tops, heading from motion, walk clip time-scaled. Stair numbers are duplicated from `shipModel.js` STAIR: change both together. Not yet watched in a browser (climbs only happen on station changes).
- **Idle clips:** rig library Idle_02 re-rigged onto all four crew (`public/crew/<name>_idle2.glb`, slimmed); `CREW_GLB.idle` points at them. The posture corrector is still on; it can likely go now.

**Note for whoever drives the Playwright browser:** Christian uses that same browser himself (ShareGrid tabs were open in it). Leave his tabs alone; use tab 0 for the harness.

## 2026-09-14 (Counsel + 4 agents) — THE REBUILD: Matrix hull proportions, open interior with stairs, sentinel attached and cutting, tunnel only. Pushed.

Christian: "I just don't like the shape of anything: sentinel keeps clipping through the ship, it needs to be attached like the movie blasting lasers; don't like the outside world, keep it in tunnels; the ship size doesn't look like a Matrix ship; don't like all these walls, it needs stairs." Four agents ran in parallel on disjoint files; Counsel integrated and verified in the harness.

- **Exterior (`hullGLB.js`, `scene3dContract.js`):** uniform scale 1.92x (length 2304), no Y stretch, centered (0,0,-60), Y-turn kept. Window CUT x -570..610, y -146..216, z > -150. New cut-frame group: deck-edge beams at y -140/60, plates, section ribs at x -566/-180/0/540/606. Exports `HULL_BOUNDS` (exact after load) and `HULL_TOP_Y(x)` (measured 40-bin centerline profile). Camera now [180,150,2120], fov 33; shadow frustum ±1320/1260.
- **Interior (`shipModel.js`, `roomWalls.js`):** partitions and ladders removed. I-beam rib pairs at every former partition (back z -130, front z 58) tied by ceiling cross-beams. Switchback stairs at both LADDERS x (13 treads + landing, stringers, riser plates, handrails, stairwell columns, hatch cut through the deck-0 slab). Railing along the deck-0 cut edge (z 48, top 42, mid 21, posts every 90) broken at the openings. New merged mesh 'structure'. Known: crew still climb vertically at LADDERS x (climb anim) rather than walking treads; one bunk frame may clip a tread underside.
- **Sentinel (`sentinels3d.js`, `drones.js`):** threat > 0.6 eases `attach`; the cutter's position = (dockX crawling ±40 around 470, HULL_TOP_Y(dockX) + 43.6, 30), pitched -0.7 rad; tentacles blend from trailing to a grip pose (seg0 -1.1 rad, +0.12/segment) with writhe; continuous beam from the head to a weld point on the plating, sparks 7%/frame, ring of 6 additive scars fading over 6 s. `clampOutsideHull` pushes every free machine out of HULL_BOUNDS+40. Painted view: `drones.update(t, { enclosed })` makes its beam continuous.
- **Environment (`tunnel.js`, `environment3d.js`, ShipWorld3D lights/fog):** GAP removed, `enclosed` always true; back wall plating (y ±270), ceiling y 420, black water floor y -500 (MeshStandard, roughness 0.15, reflects the pads), front walkway ledge z 380, ring ribs every 2 segments, pipes, looms, neutral lamps with small halos (opacity 0.09, fog-obeying), steam, pad wash, drips. Outside world built but hidden (`OUTSIDE_VISIBLE`); BACKDROP empty; fog 0x04060a @ 0.00064; ambient 0.24. 17 draw calls for the enclosure.
- **Integration fixes by Counsel:** halos were grey discs (fog-immune) → fog-obeying, 130 px, 0.09; camera 2240 → 2120; room lamps 21000 cd.

**Verified:** wide frame reads as a Matrix hovercraft in a tunnel; fly-ins show open decks, stairs, railings; the docked sentinel grips the stern with its head on the plating.

**Next:** crew walk the stair treads (shipEngine climb path → stair path), a second hunter head variant, crew idle clips from the rig library, and the painted view can retire once Christian stops using it.

## 2026-09-14 (Counsel, later) — "go": hull at 2k, light shafts + dust, modeled sentinel parts. Pushed.

- **Hull texture:** `public/hull/hull.glb` repacked from the raw Meshy output with its 2048 base-color and metallic-roughness maps (WebP, quantized, 6.9 MB). Was a 1k downsize.
- **Volumetrics (`src/ship/lightShafts.js`):** two crossed additive gradient cards under each room lamp (opacity ~0.09, pulsing) and 900 drifting dust motes across the cutaway. Scenery only.
- **Modeled sentinel (`drones.js`):** two Tripo text-to-3D parts, `public/sentinel/head.glb` (2.2 MB) and `tentacle.glb` (0.7 MB), loaded once and cloned. The head replaces the primitive head + plates (eyes, nav light and searchlight stay ours, state-driven); each tentacle cylinder gets a modeled segment child with the same pivot chain, so the writhe and the pursuit animation are unchanged. Primitives remain as stand-in and fallback. Orientation: the head already faces +X; the segment's long axis is diagonal in its own XY, turned -45° about Z and flipped to hang down the chain. Both the painted view's drones and the 3D world's escorts use the builder, so both got the upgrade.

**Verified:** harness wide + fly-ins; the docked cutter on the stern shows the modeled head and arms.

## 2026-09-14 (Counsel) — GOAL PASS: the full 3D ship, hyper-real Matrix, on localhost. Model world is the default 3D View. Pushed.

Christian's /goal: "build the full 3d ship in a local host hyper realistic matrix". Delivered as the modeled world (`ShipWorld3D`), now the default **3D View** on the Ship route; the painted view is the **Painted** toggle, the still plate **Art View**. Run locally with `npm run dev` → the Ship route, or login-free at `/tests/ship-scene.html?view=world&scenario=all`.

**Shipped in this pass (5 commits, 2ad7ffa → this one):**
1. **Physically based interior.** Hull, bulkheads, decks: `MeshStandardMaterial` with Sobel normal maps derived from the concept-art tiles (`public/textures/ship-*-n.jpg`, generated by `scratchpad/tools/gen-normals.mjs` with sharp; regenerate after any tile change). Wet deck at roughness 0.42. Walls and ceilings standard too.
2. **Image-based lighting.** `EnvironmentLight` component: PMREM of three's RoomEnvironment, `scene.environmentIntensity` 0.32, so metals and the deck reflect. Lives in its own effect on purpose.
3. **Hover-pad underglow.** Two cyan point lights under the keel throw the pad glow onto the undercity. THREE were one too many: the frame went black with three plus the room lamps (light-count / uniform limit, no console error); keep the total point-light count where it is.
4. **SSAO** is imported and wired behind `SSAO_ENABLED = false`: it blanked the composer output in this scene; the bisect never reached it because the light count was the first cause found. Re-test alone before enabling.
5. **The Osiris pursuit** (`sentinels3d.js` + `ShipWorld3D`): `update(t, { enclosed })` eases a `threat` 0..1 while the tunnel is enclosed; escorts slide to per-machine `tight` slots outside the hull; the stern machine docks on the top armor (`PURSUIT.dock`) and cuts in 1.5 s bursts every 3.2 s: neutral beam, impact flash, point light, 140 gravity sparks (Points, allocation-free). The rig gains a fast low-amplitude shudder and the camera a hand-held drift scaled by threat. Verified in three consecutive frames: dock, sparks, flash.
6. **Resolution.** Wall panels and tiles repacked at 2048 (walls ~1.1 MB, tiles ~2 MB each plus their normals), DPR cap 1.75 → 2. The Model View now weighs about 45 MB of assets on first open; all lazy, none on the painted or list views.

**Honest limits.** "Hyper-real" in a browser means this: real geometry, real light, real reflections, real motion, at 60 fps on a laptop. It is not the Osiris short's offline render and will not be. The remaining gap is art: prop texture quality (Tripo bakes are soft), the hull GLB's 1k texture, and the box-room walls being flat planes with painted depth. Next lifts if wanted: 4k retexture of the hull via Meshy's texture pass, a second sentinel model with real geometry instead of primitives, and a proper interior volumetric (light shafts).

## 2026-09-12 (Counsel, early) — LAMPS FORWARD + CREW WORK CLIPS. Pushed.

- **Lamps:** room point lights moved in front of the props (z = WALK_Z + 14, 22000 cd); the white blowouts on prop tops are gone and faces are lit.
- **Crew face their stations:** `crewGLB.js` turns a working figure three-quarters toward the back wall (side from the sprite's facing) instead of squaring up to the camera.
- **Work clips without Mixamo:** the Meshy rig service (`3d_rigging`, 8 credits each) re-rigged each crew member's own public GLB (`https://usevantus.com/crew/<name>.glb`) with the library action **Checkout_Gesture (id 34)**, the closest thing in the 678-clip catalog to operating a console (there is no typing clip). `CREW_GLB` now carries `work:` per character → `public/crew/<name>_work.glb`; the loader binds the clip by bone name onto the base mesh and `anim === 'work'` plays it. Verified in the harness: all four bind with no PropertyBinding warnings (Sean 19/24 bones moving, Muse 16, Scrappy 22, Slate 20). Work files hold a mesh copy they never render, so their textures were shrunk to 128 px WebP (each about 1.5 MB, mesh-dominated).
- Mixamo is now optional: if Christian wants a true typing clip later, the same `work:` slot takes it.

**Next:** the Osiris pursuit sequence (tunnel close-in, sentinels swarm and cut, hull shake, sparks), then the resolution pass. Optional: cleaner idle from the same library (Idle_02 / Idle_12) to retire the posture corrector.

## 2026-09-11 (Counsel, late night) — CEILINGS + SECOND PROPS. Pushed.

- **Ceilings (`roomWalls.js`):** one tiled plane per deck, facing down, spanning the hull at each deck's ceiling height (top armor underside for deck 0, the deck-0 slab underside for deck 1), `public/textures/ship-ceiling.jpg` repeated 7x (ribs, pipes, cable looms), Lambert with a faint emissive so the lamps in the tile read.
- **Companion props (`roomProps.js` `PROP_SECONDARY`):** nine more Tripo text-to-3D objects, one per room kind (nav pedestal, server cabinet, junction box + spool, analysis bench, scanner pillar, control pedestal, drum cluster, footlocker + bench, crate stack), placed off-center (`dx` as a fraction of room width) behind the walk lane. Same pipeline: simplify 0.05, 1k WebP, quantize → 1.4 to 1.7 MB each. `public/props` is now 18 files, 27 MB, loaded only when the Model View mounts.
- Primitive 'props' and 'amberAccents' (the neutral bars: finance stacks, board slots) hide once the first real prop lands.
- Verified in the harness wide and flown into Intel Core and Automation Bay.

**Known:** two props still catch a hot top highlight (Foundry board, Lab arch) from the lamp directly above them; moving the room lamps forward of the props (z = WALK_Z + 10) is the fix. The ceiling is subtle at the wide framing and reads in fly-ins.

**Next:** crew face their station prop and use work clips (Mixamo: Idle, Typing, Walking, FBX without skin, Christian's download); the Osiris pursuit sequence; lamps forward; then the resolution pass.

## 2026-09-11 (Counsel, night) — INTERIOR WALLS AND DECKS: painted back-wall panels per room kind, concept-art material tiles on hull, bulkheads, decks. Pushed.

- **`src/ship/roomWalls.js` (new):** one textured plane per room just in front of the procedural back panel (z = WALK_Z - ROOM_DEPTH + 6), cover-fitted (aspect kept, overflow cropped), Lambert with a low cyan-tinted emissive from the same map so screens and lamps in the panel glow and pulse. `WALL_MANIFEST` maps room kind → `public/walls/wall-*.jpg` (bridge, consoles, lab, machines, quarters, vault; grid/core reuse consoles, security reuses lab). Six panels generated with GPT Image 2.5 in the painting's style (4:3, 1k JPEG, ~300 KB each).
- **Material tiles:** `public/textures/ship-{wall,deck,hull}.jpg` replaced with seamless concept-art tiles (bulkhead plating, wet deck grating, armor plating; the old grunge tiles are in the session scratchpad). `ship-ceiling.jpg` (ribs, pipes, cable looms) generated and shipped but not yet wired (the ceiling ribs are untextured Lambert; apply it to the underside of the deck slabs next).
- **Lamp rig:** room point lights 70000 → 18000 cd (the props were blowing out white), ambient 0.30 → 0.38.
- Chip styles no longer mix `border` with `borderLeft` (React warning).
- **Higgsfield note:** the first batch failed 4 of 10 with "Out of credits on ultra (monthly) plan" while the balance showed 495 credits; a retry a minute later succeeded. Treat that error as transient and retry once before assuming the account is dry.

**Next:** ceiling tile on the deck undersides; a second prop per room; crew face their prop and use typing/console clips (Mixamo, Christian downloads); the Osiris pursuit sequence; then resolution.

## 2026-09-11 (Counsel, evening) — DIRECTION LOCKED: the modeled world becomes the game. Real props in every room, painted backdrop, fly-to camera, sentinels in the world. Pushed.

Christian, after seeing the painted view up close: "the hull isn't even 3D, it's just an image... make the inside hull a 3D world they can interact with like a video game", then "more realistic, 6k, actual shapes and sizes but close to the reference", with the Animatrix "Final Flight of the Osiris" as the feel (tunnels, banking, sentinel pursuit). So the Model View is the future; the painted 3D View stays the default until the model world overtakes it.

**Shipped this pass:**
- **Room props (`src/ship/roomProps.js`, `public/props/*.glb`):** nine Tripo text-to-3D props, one per room kind (bridge holo table, operator console, status board, lab scanner arch, security gate, holo core, machinery bank, sleeper pod, vault cabinet). Raw output was 1.4M triangles / 40 MB each; simplified 20x, 1k WebP textures, quantized → about 1.6 MB each (14 MB total, loaded only when the Model View mounts). Placed at each room's center on its floor behind the walk lane, scaled to a target height per kind (`PROP_MANIFEST`). The procedural furniture (merged mesh 'props') hides once the first prop lands.
- **Painted backdrop in the modeled world:** the concept-art storm/city plate far behind (z -1500) and a darker second rank (z -950), mirrored-repeat scrolling, so the horizon is painting instead of gradient.
- **Model View interaction:** same model as the painted view: click a chip → camera flies into the room (2.3x), Escape / top-left chip returns, wheel zooms to 2.6x, drag pans, pointer parallax. Chips are low inside each bay and projected every frame through the camera and the flight rig.
- **Painted view fixes from Christian's notes:** chips inside bays (were on the plating), sentinels tripled with 12 heavier tentacles, background depth (mid rank + drifting haze + vignette), patrol sentinels drift with the world (only the attacker rides the hull), cockpit/quarters bays recalibrated so Sean stands inside the glass.

**Next lifts, in order (this is the game plan):**
1. Interior fidelity: room walls and decks from the concept art baked as textures (or generated wall panels per room kind), better lamp pooling, and a second prop per room so bays are not one object each.
2. Crew at work: typing/console clips (Mixamo, Christian downloads), agents face their prop, walk paths that avoid props.
3. Osiris feel: tunnel pursuit sequence (sentinels close in when the tunnel is enclosed), hull shake, sparks at the attacker's cut point, camera hand-held drift.
4. Resolution: the hull GLB at full 124k tris is in; props could go back to 0.1 ratio (3 MB each) when the look is settled; DPR cap 1.75 → 2 on desktop.
5. The painted view retires to Art View once the model world is ahead of it.

## 2026-09-11 (Counsel, late) — NEW HULL SHAPE in both views. 3D View: repainted concept art with the armored hover-pad hull. Model View: a generated 3D hull (Meshy) around the procedural interior, cut away, pads pulsing. Pushed.

Christian's reference: an armored plated hovercraft with a forward cockpit block, cyan ring hover pads under the belly and on outrigger arms, antenna masts, twin turret (`~/Desktop/dacian-falx-1.jpg`).

**3D View (default, painted):** GPT Image 2.5 repainted ONLY the exterior of the concept art into that hull (4 variants generated; #4 chosen because it keeps the original composition and interior, so the calibrated rooms, floor lines and chips still hold). Cut out with the background remover → `public/ship/ship-cutout-v2.webp` (585 KB). v1 kept as a fallback file. Verified in the harness: crew on the decks, chips on rooms, pads glowing under the belly.

**Model View (modeled world):** `src/ship/hullGLB.js` (new) loads `public/hull/hull.glb` (Meshy image-to-3D from the reference, 124k tris, simplified + 1k WebP texture + quantized = 3.7 MB; the Tripo alternative was 1.9M tris / 58 MB and rejected). Normalized to the contract (nose at -X: the generation puts the cockpit at +X, so it is turned about Y; symmetry was on so both flanks carry the outrigger rings), scaled 1.22x the contract length and 1.32x in Y so real plating survives above and below the decks, and CUT AWAY with a window: five clipping planes with `clipIntersection` remove only fragments inside the room box (x -556..598, y -198..252, z > -150), so nose, stern, top armor, keel and pads survive. `gl.localClippingEnabled` is set on the Canvas. FrontSide on purpose (the shell's inner faces read as a grey cavity through the window; culled, the rooms' own back panel closes it). The procedural shell stays (hidden inside the GLB, its top slab caps the rooms); only the cutaway rim is hidden. Hover pads glow via emissiveMap = base map tinted cyan, pulsing in `update(t)`. Camera pulled to z 1420 to hold the longer hull. Tunnel lamp halos toned down (0.22, 200 px).

**Harness:** `tests/model-view.html?src=/hull/hull.glb` is a login-free GLB viewer (bounds and triangle count in the bar). `tests/ship-scene.html?view=world|painted|scene`.

**Honest state of Model View:** the exterior is now the real ship; the interior is still the procedural box rooms (props are primitives). It reads as a technical cutaway, not the painting. It is the right base for "fully animate the whole ship" (rig banks, pads pulse, tunnel streams, sentinels escort, crew walk on real floors), but the next lift is interior fidelity: either generated 3D props per room (same Meshy path) or baked painted textures on the room walls from the concept art.

**Higgsfield spend today:** about 9 image generations, 2 background removals, 2 image-to-3D jobs; balance was 663 credits at the start.

## 2026-09-11 (Counsel, afternoon) — THE CONCEPT ART FLIES. 3D View = the painting itself in motion, generated painted plates behind it, fly-to-station, zoom, pan, cursor-tracking hunter. Pushed.

Christian: "push it but I need it to look like the concept art", then "it needs to be crazy interactive." The modeled hull could never look like the painting, so the painting became the ship:

- **`src/ui/ship/ShipPainted3D.jsx` (new, now the 3D View).** The painting with its background removed (`public/ship/ship-cutout.webp`, Higgsfield background remover, 266 KB) rides the flight rig (bank, breathe, bob; more shake in tunnels). Three environment plates generated with GPT Image 2.5 using the painting as the style reference stream behind it with true depth parallax: `plate-open.jpg` (storm + city, z -700, slow), `plate-tunnel.jpg` (tunnel wall, z -350, fades in on a 46 s cycle: 18 s enclosed with 2.5 s ramps), `plate-fg.webp` (keyed foreground structures, z -150, fastest). MirroredRepeatWrapping makes every plate tile seamlessly. Rain in front. Crew, station FX, beacons, sentinels, receipt rule unchanged. Radar contacts come from `drones.getContacts`.
- **Interaction.** Click a station chip: the camera flies into that room (zoom 2.25x, eased), the other chips clear, the selected chip at top-left is the way back (or Escape). Wheel zooms 1x to 2.4x on top. Drag pans within bounds. The pointer drives parallax across the depth stack (damped when zoomed). The attacking sentinel's searchlight tracks the cursor and its eye brightens as you get close (`drones.setPointer`).
- **Route toggles:** 3D View (painted, moving) · Model View (modeled hull from this morning) · Art View (still plate) · Map · List.
- **Harness:** `tests/ship-scene.html?view=painted|world|scene`, stateful host, `window.__selectStation('cockpit')` to exercise fly-to. Dev hooks `window.__shipPainted` / `__shipWorld` / `__shipDebug`.
- **Assets (Higgsfield, second account, ~$3 of credits):** originals in the session scratchpad only; the repo carries the compressed versions. Regenerate with the prompts in this session's log if a variant is wanted (e.g. a second open plate for variety).
- **Anthropic:** Christian loaded $25 of credits today. Receipts resume when anyone runs an agent action; the crew then move on their own.

**Known limits:** at 2.25x zoom the 2048-px painting is soft (an upscaled cutout, 4096 wide, would fix it: one Higgsfield upscale + re-cut). The tunnel plate's top edge is visible above the hull in some frames (make the plate taller or add a ceiling plate). The modeled-hull checker artifact from the morning is unresolved and now moot for the default view.

## 2026-09-11 (Counsel) — THE SHIP FLIES. Modeled hull is the 3D View; undercity streams past; sentinels escort; radar + comms HUD on real signal. Two commits on main, NOT pushed.

Christian's call this morning: build Danny's list for real (moving ship, correct figures, realistic sentinels, radars, comms). That is impossible on a painting, so the parked Phase 2 modeled hull (`ShipWorld3D`) is now the **3D View**; the painted plate survives as **Art View**. Everything below was verified in `tests/ship-scene.html?view=world` (harness now mounts either view) before commit; build green, 53/53.

**Slice 1, art pass on the hull:** doctrine palette (PALETTE.amber is now the neutral attention token #E5E5EA, amberDeep a dim steel; city windows neutral) so there is no warm hue anywhere; the Tron cutaway rim cut from 0.38 to 0.10; PCF shadows (directional key with a 2k ortho map sized to the hull, `shadowSide: BackSide` on the two-sided Lambert shell per rendering-traps.md); FogExp2; bloom 0.75 → 0.28, exposure 1.35; camera reframed (fov 33, z 1250) so the whole hull sits in frame; crew scaled 2.05x so a person is about half the deck clearance. Shadows read faintly; contrast is the remaining art debt.

**Slice 2, motion (`src/ship/tunnel.js`, new):** the hull stays put and the WORLD streams toward +X. A half-pipe undercity (back-wall plating, ceiling girders, pipes, neutral wall lamps with soft radial halos, floor grating, foreground cables) instanced with one instance per segment, 22-segment pattern with a 7-segment open stretch where the city and storm show, wrapped by re-indexing, zero per-frame allocation. `tunnel.enclosed` is a live getter. The camera only sees two bands (above the top armor 250..370 and below the keel -200..-380) so every passing element lives in one of those bands. Hull, greebles and crew hang under a `shipRig` group that banks (z), breathes (x) and bobs; amplitudes small enough that the chip anchors, projected once at rest, stay on their rooms.

**Slice 3, sentinels (`src/ship/sentinels3d.js`, new; `buildSentinel` exported from drones.js):** same original squid machines, flown as an escort in scene space (NOT under the rig, so they move against the banking hull): stern-high at (590, 295, -60) scale 2.2, bow-low under the nose at (-560, -290, -120) scale 2.5, a far crosser at z -720 overtaking on a 34 s line, and a close foreground pass every 38 s (1.9 s, scale 3.4, z 620). Tentacles trail in the slipstream, searchlights sweep the plating. Metal roughness raised to 0.58 so it reads as brushed steel without an env map. Red hunter eye and nav light kept (the sentinel's signature; small).

**Slice 4, HUD (`src/ui/ship/ShipHUD.jsx`, new):** radar bottom-left, a canvas sweep where every blip is a machine at its real scene position (`sentinels.getContacts`), hull drawn as a bar, ENCLOSED / OPEN AIR from the tunnel; comms bottom-right with HOME LINK, LAST BACKUP, LAST RECEIPT, CONTACTS, all fed by `ShipRoute` from the numbers it already trusts (`backupOk`, `events[0].ts`, Supabase presence). If a value is not known the panel says unknown. Nothing decorative.

**GLBs:** unchanged from 9/10 (1.9 MB each, WebP). **Posture corrector** from 9/10 still active in both views.

**Seen, not fixed:** a small checkerboard artifact at the top-center of the frame, above the hull, appeared in two captures about 9 s after load during an enclosed stretch, and did not reproduce in five toggled captures (halos / plates / girders / env / rig each hidden). If it shows again, hide `window.__shipWorld.sentinels.group` first (the one layer not toggled).

**Not done, in order of value:** (1) Mixamo clips: the rigs are Mixamo-named, so a clean Idle / Typing / Walking retargets directly and would let the posture corrector be deleted; Christian downloads three FBX "without skin", Blender converts (script to write). (2) Contrast pass on the hull interior (the lamps at 70000 cd barely pool; shadows faint). (3) Mobile guard on the Ship route (988 KB chunk + GLBs). (4) Fix #10 / orphaned files. (5) The checker above.

**Dev hooks (DEV only, stripped in prod):** `window.__shipDebug` (Art View figures) and `window.__shipWorld` (3D View: scene, rig, env, greebles, tunnel, sentinels, figures, model()). Use them from the harness before believing any visual change.

## 2026-09-10 (Counsel, evening) — SHIP: crew composited into the plate, real-scene harness, GLBs 47MB → 15MB. Committed on main, NOT pushed.

Christian's verdict on the day's 17 ship commits: "can't get it right." Counsel rendered the route outside the login (see harness below) and diagnosed a direction problem, not a tuning one: the painting is dark, cool and painterly; the Meshy crew arrived front-lit, saturated and glossy, so they read as stickers no matter how scale or walk was tuned. Doctrine keeps them photoreal (Matrix archetypes), so the fix is compositing.

**Shipped (one commit, build green, 53/53):**
1. `crewGLB.js` `gradeIntoPlate()` — every crew material is desaturated (0.58) and knocked down (exposure 0.70, cool tint) in the shader via `onBeforeCompile`, forced matte (roughness 0.94, metalness 0), self-glow cut from 0.22 to 0.06. Tunables in `GRADE`.
2. Contact shadow — a soft black ellipse billboarded at the feet (`SHADOW`), fades in with the real character. This is the cue that makes a figure stand ON the deck instead of floating in front of it.
3. Light rig in `ShipScene3D.jsx` — ambient 0.42 → 0.20, hemi 0.55 → 0.34, key 1.75 → 1.35, and the 0.42 fill became a real cyan rim (1.10, from behind-above) so silhouettes separate from the hull. `tests/ship-visual.html` mirrored line for line.
4. **`tests/ship-scene.html` + `.jsx` — mounts the REAL `ShipScene3D`** with stand-in receipts, no login. `?scenario=mixed|empty|all`. This closes the "harness is structurally blind" item: the 9/10 ReferenceError would have shown up here as a black canvas. Screenshot it before every ship commit. `npm run dev` then `/tests/ship-scene.html`.
5. Crew GLBs: textures were 2048² PNG (7.2 MB of Sean's 9 MB). Resized to 1024² and converted to WebP with gltf-transform; meshes untouched, rigs untouched, no decoder needed (EXT_texture_webp is native to GLTFLoader). 47 MB → 15 MB, verified loading and rendering identically in the harness. Originals in `~/vantus-crew-staging/crew-originals-2026-09-10/`. Remaining 1.8 MB per file is mesh; `gltf-transform quantize` would halve it again if wanted (also decoder-free).

**Follow-up, same evening ("bodies are still crooked"):** measured in the harness, not eyeballed. Bind poses are straight (0.3 deg); the Meshy clips carry a built-in lean (hips-to-head about 6.5 deg sideways, 5 deg forward, identical on all four because it is one clip retargeted) and hang the arms 21 to 38 deg out, asymmetrically. The code added a 5.7 deg "lean into the console" on top. Fix, all in `crewGLB.js`: `correctPosture()` runs after `mixer.update` every frame; it measures the spine in the body's own frame, eases it (1.2 s), and SETS a correction on a feet-pivoted group so the mean posture is vertical while the idle sway survives; each upper arm is pulled toward a 9 deg hang (capped at 32 deg of correction) in world space converted to bone-local, eased off while walking so the arm swing is untouched. Work lean 0.1 → 0.03. Measured after: spine within sway of vertical, both arms 9 to 10 deg on every crew member. Lesson for the terminal: the first version accumulated the correction in the frame it was moving and inverted the bodies in two seconds. Measure in the harness (`window.__shipDebug`, dev only) before believing a posture change.

**Verified visually** (harness screenshots, mixed + empty scenarios): crew sit in the plate, Slate's coat carries the cyan rim, Muse's dress reads as wardrobe rather than a highlight, the empty deck shows idle crew at home posts.

**Flag, not changed:** the sentinel drone's search beam is warm red-orange (`drones.js` beamMat 0xff5340 / haze 0xff7a5c). It is a Matrix sentinel by design, but it is the one warm hue in the scene and the doctrine says none. Danny or Christian decide; a one-line color swap either way.

**Not done:** merging walk+idle into one GLB per character (retargeting risk noted in the master brief; not worth it now that files are 1.9 MB), Fix #10 / the 3 orphaned files, mobile guard.


## 2026-09-10 — INFRA MOVED to Cloud Scenic + all four crew are real characters. Rigging solved locally. Long session, several self-inflicted breakages, all recorded.

**Netlify + Supabase both now live under Cloud Scenic. Verified, not assumed.**
- Netlify site `majestic-cassata-aa16e9` (`6d97835e-1874-43d7-9465-f93afd68c6fb`) moved from the personal team `cz-mwalysu` to **Cloud Scenic** (`69a5bd3afc07a04153d6d6b9`); plan `nf_team_dev` -> `nf_team_pro`. All 30 env vars, `usevantus.com`, SSL, deploy history and the GitHub App link survived. Fresh CI build verified green under the new team.
- Supabase project `wjcstqqihtebkpyuacop` transferred org-to-org (separate login, so: invite current login as Owner of target org, accept, then transfer). **Ref, anon key, service key and JWT secret all unchanged**, so the 4 hardcoded CSP entries in netlify.toml and the 4 env vars needed no edit and nobody was signed out. Verified 24 tables / 184 rows byte-identical against a pre-transfer snapshot (`~/vantus-migration-backup/`).
- **Netlify secret env values are WRITE-ONLY** — 6 of the 30 cannot be read back by CLI or API. A rebuild-from-scratch would strand them. Always transfer, never rebuild. `netlify env:get <NAME> --context production` returns real values for non-secret vars only.

**THE OUTAGE, and the standing risk it leaves.** Vantus was down and nobody knew: the Supabase project had **auto-paused from inactivity** (agents went quiet 8/21 on $0 Anthropic credits, last human sign-in 8/27, free tier pauses after ~7 idle days).
- Tell-tale: **the project hostname stops resolving** (`dig +short <ref>.supabase.co` returns nothing). The site still serves 200 because the SPA is static, and every function 401s on auth *before* it reaches the DB, so the outage is completely masked.
- Mid-restore it returns Cloudflare **521**, then PostgREST answers **PGRST205 "could not find the table in the schema cache"** with 0 tables. That is NOT data loss.
- **To settle "is the data gone": query `/auth/v1/admin/users` with the service key.** GoTrue reads Postgres directly and bypasses PostgREST's schema cache.
- **It will pause again on a free plan.** 8 client tenants + 9 crons. The plan decision is still open.

**ALL FOUR CREW ARE NOW REAL RIGGED CHARACTERS** — Sean, Slate, Muse, Scrappy live on prod.
- **Rigging no longer needs Higgsfield or Mixamo.** Sean is already rigged with a 24-bone Mixamo-standard skeleton and walk/idle clips, and every crew mesh comes out of the same Meshy pipeline, so the rig transfers. `~/vantus-crew-staging/tools/rig-from-sean.sh <name> <mesh.glb>` does it headlessly in Blender in ~90s. Only the MESH step still needs Higgsfield.
- Hard-won, all baked into the script: **scale the MESH to the rig, never the rig to the mesh** — a scaled armature makes the glTF exporter silently emit `skins=0` from a scene that looks perfectly valid (cost 3 attempts). Blender's bone-heat auto-weighting **fails outright on long coats**, so copy Sean's proven weights across with a `DATA_TRANSFER` modifier (`POLYINTERP_NEAREST`) instead. Flatten glTF import empties before parenting.
- **A-pose is mandatory and must be eyeballed.** Muse's August crops were labelled A-pose in this file and were not (arms flat against the dress); that cost a 30-credit mesh and two failed rigs. ALWAYS open the crops and look at the arms before spending.
- **Higgsfield grace-period cap** rations ~1 image + ~4 3D jobs/day on the old account. Christian switched the connector to a second Ultra account which is not capped. Note: media_ids do not carry across accounts, re-upload from `~/vantus-crew-staging/`.

**Ship feel — five changes mined from `Station-Sciences/bot-crossing` (MIT, cloned to `~/reference/bot-crossing`).** Its `.claude/skills/agent-session-world/references/` docs are the same problem domain and worth reading before touching this route.
- Crew no longer move in lockstep: per-character animation phase + 0.90-1.10x pace, hashed from the name.
- **Activity drives ambience**: each of the 16 catalogued screens maps to its nearest station; a room whose agent actually worked in 48h lifts its screens up to 1.35x, and ship busyness lifts the holo-core light. (Sanity check: core-room screens resolve to `analytics`, matching the 8/17 measurement.)
- Name plates ease to full opacity only while working, 0.62 active, 0.2 at rest.
- Receipt-driven **work glow** per crew member, hidden entirely when idle.
- **Attention beacons** (`src/ship/beacons.js`): a tall column through the hull from Comm Relay for approvals, Pipeline Grid for blocked. ShipRoute computes those counts ONCE and feeds both the mission bar and the beacons, so the world cannot claim what the numbers deny.
- REMOVED after Christian rejected it: an idle "glance" that rotated the whole body ~23 degrees and read as figures on turntables. Head-only was tried and was worse — `headBone.rotation.y += lookY` accumulates on any frame the clip does not re-pose that bone (Muse's head hit 71 radians).

**THE WALK: it was skating, and that is why nothing read as animated.** Measured from the glTF itself, one `Casual_Walk` cycle is **4.23 SECONDS** (human ~1.1s) and carries only 0.383 body-heights, ~0.09 bh/sec — against a glide of ~0.65 bh/sec. Seven times the travel the legs were paying for. Fixed by dropping `SPRITE.walkSpeed` 55 -> 30 (climb 40 -> 26) AND driving `walkAction.timeScale` from the distance actually covered each frame, clamped 0.6-6x. **Change one, retune both.**

**GARMENTS were tearing in half mid-stride.** A dress or long coat is ONE tube around BOTH legs; nearest-surface transfer gives its left face to LeftUpLeg and its right to RightUpLeg. Fixed by rebalancing the hem band toward an even share of both legs plus hips, easing in below the hip. Two earlier attempts failed and are worth not repeating: smoothing all weights (then just the leg chain) left vertices unweighted and spiking into white shards; and a distance-to-bone test silently did nothing because **bone positions come back in a different scale from the mesh** — all measurements now come from the mesh's own bounding box.

**CREW SCALE was tuned for stand-ins, not people.** `humanScaleAt` ran 66-105 logical units, tuned 8/17 against the blocky procedural figures. A real character occupies far more visual mass at the same height. Now **46-74**. `tests/ship-visual.html` duplicates this formula and must be changed in step.

**I TOOK THE SHIP ROUTE DOWN FOR ~40 MINUTES. Read this before editing ShipScene3D.**
- I passed `activityCount={activityCount}` from the outer component where **no such variable exists** — the memo is called `counts`. I invented the name from a grep that showed the memo body without its assignment line. ReferenceError during render of `ShipScene3D` itself, so the WHOLE ROUTE went black, not just the canvas. Anyone whose `vantus_active_nav` is `"ship"` lands straight on it and sees nothing.
- **Neither gate could catch it.** It is a runtime scope error, not syntax, so `npm run build` passes; `npm test` is pure core math; and **`tests/ship-visual.html` builds its own scene and never mounts `ShipScene3D`**. That harness is structurally blind to the production component.
- My first "fix" threaded the same non-existent name through as a prop and still crashed.
- **Rules now: read the file before editing it (never blind regex insertion), and load the actual page before claiming a fix.** The free-identifier sweep used for the App.jsx split works well here — extract the component body, list free names, confirm each is a prop, local, or import.

**OPEN**
- **Supabase plan** — free tier will auto-pause again. Decide before the next idle week.
- **Anthropic credits still $0** — no receipts since 8/21, so the ship renders an honestly empty deck and no crew ever walks in production. This is also what let the database idle out.
- `tests/ship-visual.html` does not render `ShipScene3D`. Until it does, every change to that route ships blind.
- Compression never done: 4 characters ≈ 29MB of GLBs (Sean 9.0MB each, others 4.9-5.5MB). Blender's export is fatter than Higgsfield's (4.4MB in, 7.7MB out).
- Fix #10 (parked hull, 1,775 lines) and the 3 orphaned files (1,349 lines, zero importers) still undecided.
- Mobile unowned on this route: 988KB chunk plus GLBs, no guard.
- Muse's dress and Slate's coat still distort somewhat in close-up; invisible at ship camera distance.

## 2026-09-02 — state check: sourcing migration APPLIED, go. DNS 2/3 correct, port still UNPUSHED

Christian asked for a handoff refresh; verified live state rather than assuming:

- **Port commits `ccaa6df` + `90e61e3` still local (main ahead of origin by 2, +this note = 3).** The "push" word never came — that is the ONLY thing between the Growth port and prod. Deploy order is safe: migration is already in.
- **`20260827_growth_sourcing.sql` WAS PASTED** since 8/27: client_icps / sourcing_runs / lead_events / growth_budget all EXIST on prod. When the push lands, the whole port goes live against ready tables.
- **go.cloudscenic.com: 2 of 3 DNS records correct, verification PENDING with a specific fix.** DKIM TXT (resend._domainkey.go) is live and correct; MX at send.go is correct; but the TXT at `send.go` reads `v=spf1 include:dc-fd741b8612._spfm.send.go.cloudscenic.com ~all` — GoDaddy's own forwarding-style SPF, not Resend's. **Fix: edit that TXT (name `send.go`) to exactly `v=spf1 include:amazonses.com ~all`.** A verify was re-triggered via the Resend API this session; it will keep failing SPF until that edit. Until verified, brief sends from cz@go.cloudscenic.com 403.
- **Keys unchanged:** GOOGLE_PLACES_API_KEY and APOLLO_API_KEY still not set (sweeps + Apollo reveals dormant by design). Apify/Resend/cron keys set. Anthropic credits still $0 (backlogged).
- **Next actions, smallest first:** (1) Christian fixes the one SPF TXT at GoDaddy; (2) Christian says "push" → push, deploy watch, Playwright sweep of Leads (status dots, ICP add, Check signal, Find contact, bands); (3) keys whenever.

## 2026-08-27 — GROWTH PORT BUILT (Dynasty Lead Finder + Website Generator DNA): sourcing, enrichment, warmth, engagement, Warm Now. Committed `ccaa6df`, NOT PUSHED (Christian's go pending).

Request came via Counsel (agent mesh) relaying Christian: "just give Vantus everything it needs." Read both tools IN PLACE (no .env copied; the one env read earlier that day — the Website Generator's Resend key — was at Christian's explicit ask to pull the go. domain records, and it turned out to be the SAME Resend account as Vantus). Spec: docs/GROWTH-PORT-SPEC.md — read it first; it carries the paste list.

**Shipped (feature-detected, dormant without keys, nothing outbound automatically):** migration `20260827_growth_sourcing.sql` (client_icps w/ signal_sources CONFIG, sourcing_runs w/ daily Places cap in DB, lead_events, growth_budget Apollo caps, leads += tenant/ICP/signal/contact/warmth); `_lib/leadCapture.js` (THE choke point: suppression abort-on-failure → dedup merge-never-drop → upsert; norm_* contract mirrors Dynasty); `src/core/warmth.js` (pure port, 3 gates); `growth-source` fn (status/run_sweep/signal_scan/enrich/rescore, esbuild to require the ESM warmth); `growth-events` fn (30-min Resend poll → lead_events → warmth, inbound only); GrowthRoute Warm now/Warming/Cold bands + warmth box (Find contact, Check signal) + ICP panel (config dots, Run sweep). Tests 53/53.

**Not wired (declared honestly in UI/spec):** signal kinds job_board (Apify Indeed + Places name-match), ad_library, community_launch — config exists, dispatch says "not wired"; 3-touch sequence (Phase 2, draft-first); founder digest line; Apollo phone reveals (email match only in v1).

**Deploy order when Christian says go:** paste migration → push → verify: status dots on Leads page, add an ICP, Check signal on a lead with a website (deterministic), Find contact (site + Apify steps run; Apollo says not configured), band filters. Sweeps stay dormant until GOOGLE_PLACES_API_KEY.

**Gotcha:** `netlify env` reads are masked for secrets; `growth-source`/`growth-events` need `node_bundler = "esbuild"` (set) because they require src/core/warmth.js (ESM) from CJS — verified locally by bundling with rolldown and loading the handler.

## 2026-08-26 (later) — Leads briefs SEND FOR REAL: root-domain sender picker live, proven to cz@

Christian's call (over my subdomain-separation advice, flagged once): briefs send from the verified root domain with a per-send sender picker — **Cloud Scenic <contact@>, Christian <cz@>, Danny <dv@>** — reply-to = the chosen sender. He added `GROWTH_RESEND_API_KEY` (production, secret); growth.js prefers it over RESEND_API_KEY. `GROWTH_FROM_EMAIL` remains an optional 4th "custom" sender. Proven live at `c4f01f7`: parlour.bar scanned → template brief → sender cz → sent to cz@cloudscenic.com → Resend accepted → stage auto-advanced to contacted. Test lead deleted. Reputation note for whoever sends: cold volume from cloudscenic.com now shares reputation with approval/report mail — keep it warm and modest. Open tracking: flip on per-domain in Resend if opens are wanted (not verified this session). Playwright note: the scan intake races React right after navigation — set the input, wait ~400ms, then click.

## 2026-08-26 — "run the things you can do": Fix #12 + decomposition slice B + recipients check. 21/21 prod sweep.

- **Fix #12 SHIPPED** — Scope Sentinel "Log manually": human picks the class + optional $ value, row lands confirmed/decided_by them (browser insert under admin RLS, no function). The absorbed-value register works with AI furloughed. Verified live (test row inserted → confirmed → deleted).
- **Decomposition slice B SHIPPED** — the 20 primary route mounts (Dashboard…Software OPS) moved to `src/ui/AppRoutes.jsx` with an explicit 24-prop contract. Method worth reusing: strip comments/strings from the block, collect identifiers, subtract props/JSX-attr names/property accesses/object keys/arrow params → the free list MUST be empty before writing (it caught nothing missing, and flagged 2 false positives that the checker then learned). 12 dead lazy consts removed. App.jsx 1,324 → **1,193** (from 1,640). Slice C = the trailing mounts (agents/content/ideas/apps/settings, which carry handleIgIdeas/toggleApp/etc.) + realtime/data loaders.
- **Prod sweep after deploy (`cc163b0`):** fresh magic-link login → all 19 table routes + workspace-via-Open + manual scope entry = 21/21, zero real console errors.
- **Recipients sanity check (read-only):** CloudScenic cz@, dynasty hello@dynastystaffusa.com, VitalLyfe natalia@ (client-mode → gate emails reach her, expected), **Parlour Bar: NO primary_email** (auto mode, so nothing sends; fill it in Scope & Rates/Setup). No report_recipients set anywhere (falls back to primary — fine).
- Ops gotcha: the Playwright MCP profile lock survives overnight (`pkill -f mcp-chrome-<id>`), and the session scratchpad dir is wiped — helpers now live in /tmp/vantus-tools (recreate if gone).
- **8/26 board decision (Christian): BACKLOGGED, do not re-raise as urgent** — Anthropic credits, Stripe proof, Parlour primary_email, Gemini billing, the Danny email. Still live on his side: GROWTH_FROM_EMAIL (unblocks real brief sends) and the Google OAuth origin (Drive upload). Mine: Growth tuning (needs his notes), App.jsx slice C, Phase C leftovers.

## 2026-08-23 (session close) — Growth v1 accepted: "solid, still needs some tuning"

Christian's verdict on the live Growth module: solid, tuning session planned for next sitting. Nothing further shipped after `e38319d`. **Next session opens with Growth tuning — ask what felt off** (likely candidates: audit finding coverage/wording, template-brief voice, stage flow, list ergonomics) and pull from the honest not-built list in the 8/23 entry (Places discovery sweep, Apify rendered scans, Apollo lookup, Resend open tracking, warmth scoring). Standing board otherwise unchanged: Anthropic credits still $0 (gates all AI incl. growth_brief + the last sentinel verification), GROWTH_FROM_EMAIL unset (briefs are copy-mode), Fix #12 manual scope entry, App.jsx slices B/C, Stripe/Google console items, Danny data entry + skill-briefs file.

## 2026-08-23 — GROWTH v1 SHIPPED: scrape -> marketing audit -> brief -> pipeline -> convert (no AI needed for the core)

Christian's ask: put the scraper in Vantus — scrape a lead, research their marketing, pinpoint failures, send a brief with the pain points. Built as the spec's Growth destination (§3.C.4) with Dynasty's scrape-cascade DNA. Live at `26dbef5` (function + redirect; `84c21ac` shipped the code but MISSED netlify.toml — lesson: `git add` the root toml explicitly, `netlify/` dir does not include it). Migration `20260823_growth.sql` applied by Christian same session. Browser-verified on prod: parlour.bar scanned in 4s → 4 gaps (no Meta pixel / no socials linked / Wix / no H1; correctly did NOT flag the GA + LocalBusiness schema it has) → template brief with those pain points, stage auto-advanced to briefed, no em-dashes. Test lead deleted after.

**Pieces:**
- `netlify/functions/_lib/siteAudit.js` — deterministic marketing audit. Fetches home/about/contact/services (7s cap each), follows JS `location.href` + meta-refresh trampolines (cloudscenic.com itself bounces to /lander), detects JS-rendered shells (then keeps only raw-HTML-safe findings + says a rendered scan is needed). Signals: emails/phones/socials, Meta/GA/TikTok/Hotjar pixels, JSON-LD types + LocalBusiness family, viewport, H1, meta description, copyright year, builder (Wix/Squarespace/WordPress/GoDaddy/Shopify/Weebly/Webflow), CTA links/tel/form, https, word count. `audit()` → ranked findings {key, severity, label, evidence, pitch}. `templateBrief()` → the zero-credit outreach brief (sanitized: no em-dashes ever).
- `netlify/functions/growth.js` (/api/growth, 26s, admin-only): scan (upsert lead by host + lead_research), brief_template, send_brief, convert (lead → clients row, stage won). **send_brief is gated on `GROWTH_FROM_EMAIL`** — cold outreach must NOT go from notifications@cloudscenic.com (root reputation); set it to a verified cold-outreach sender (e.g. go.cloudscenic.com once added to THIS Resend account) → until then the UI is copy mode. `GROWTH_REPLY_TO` defaults cz@.
- agent-action `growth_brief` (prefix growth → Scrappy): AI narrates the findings into a brief (never invents gaps), lands origin 'ai'. Errors until Anthropic credits exist.
- `GrowthRoute.jsx` (nav Growth → Leads): intake (url/name/city), stage filters with counts, lead list, detail = audit findings + signal line + brief (Draft from audit / Scrappy writes it / Copy / Send) + Convert to client (opens the workspace) + Re-scan. Feature-detects tables.
- Tables: leads (unique host), lead_research (findings jsonb), lead_briefs (draft/approved/sent, resend_id). Admin RLS.
- Tests: 37 (audit logic, brief shape, url normalization). The no-em-dash test CAUGHT a real violation in the pitch copy before ship.

**Not built (honest):** Google Places discovery sweeps (Dynasty-style "find me 50 roofers in Ontario" — Vantus has no Places key; Tavily could stand in), Apify rendered scans for JS shells (APIFY token exists, not wired here yet), Apollo decision-maker lookup (no key in Vantus), open/click tracking on sent briefs (Resend webhooks), warmth scoring.

## 2026-08-22 (session close) — rights clock LIVE end-to-end, map refreshed, the no-credits board settled

**Closes the goal session.** Everything below is on prod at `f1a28a5`.

- **Rights clock VERIFIED live:** Christian applied `20260822_rights_clock.sql` mid-session; browser round-trip proven on prod — added a test license expiring +14d → correctly badged RENEW SOON (inside its 30d lead) → deleted clean. Gotcha for future feature-detect tabs: the missing-table state is cached per mount — a tab loaded pre-migration keeps showing the hint until re-mount/reload.
- **Architecture map refreshed to 8/22** (58 nodes, 75 wires): new nodes ClientWorkspaceRoute (critical path — the red Open wire), CalendarRoute, useAuthSession, clientHealth; Open-button bug removed from registries; findings sidebar carries the shipped/debugged summary. Regenerate-by-hand pattern held (edit nodes/edges/FIXES/KNOWN_BUGS in the script block, then headless-Chrome screenshot to verify).
- **NEW Fix #12 (top buildable item, no credits needed):** ScopeRoute can only take requests through the AI classify button — with the Anthropic balance at $0 the absorbed-value register is UNUSABLE. Build the manual-classification fallback (human picks the class, optional classify-later queue when AI returns). Christian aware, not yet green-lit.
- **Credits: deferred indefinitely** ("not sure when"). The furlough line for the team: the software works, the AI workforce is furloughed — pipeline/approvals/portal/email/billing surfaces/calendar/rights/workspace all run; QC, Muse, Scrappy, Intel, Sentinel, AI Assign, chat error until top-up. First action when credits land: one sentinel_classify to close the last Phase D verification.
- **Next session picks from:** Fix #12 (small, high leverage while credits are out) · App.jsx slice B (route-mount table) then C (data loaders) · Christian's console sitting (Stripe curl + webhook, Google OAuth origin) · the Danny email (draft v2 in TextEdit; its real payload is his data-entry list + the skill-briefs file only he has).

## 2026-08-22 (later) — Goal session wave 2: auth decomposed, calendar + rights clock shipped. 26 tests green.

Continuation of the "Make Vantus work" goal after credits were deferred. Everything below deployed + Playwright-verified on prod same session:

1. **Decomposition slice A:** the entire auth machine moved to `src/core/useAuthSession.js` (App.jsx 1,640 → 1,324 lines). Behavior-preserving: setupSession, stuckGuard, raced health check, pending-invite realtime, sign-out, + ADMIN_EMAILS/activeContentCutoff (re-exported; Vantus isOpsAdmin + realtime reload consume them). Verified with a FRESH magic-link login through the extracted hook. Slices B/C (route-mount table, realtime/data loaders) deliberately deferred — do one slice per session, verify, ship.
2. **Content calendar (§3.C.5 calendar leg):** `CalendarRoute.jsx`, nav `calendar` under Content. All clients on one Monday-start month grid; items land on posted_at (solid dot) or publish_date (hollow); day chips deep-link to Ledger. Honest-empty today because the book has no dated items. Sprout truth pull stays future wiring.
3. **Rights clock (Phase E.3):** migration `20260822_rights_clock.sql` (asset_rights, admin RLS) STAGED in TextEdit — NOT yet applied; the workspace Rights tab feature-detects and names the SQL until then. `rightsState()` pure math in clientHealth.js (expired / due-inside-lead / ok, per-right lead_days).
4. **Tests now 26** (rights math added; also fixed a self-inflicted bug where appended tests sat after process.exit and never ran — the harness's honesty matters most).
5. Also this wave, earlier: TEST-QC item scrapped (archived-client leftovers swept), mp4 probe silenced, Ledger nav label → "Deliverables" (spec §9), npm vulnerabilities 3→0 (dead pdfjs-dist removed).

**Board after the goal session:** everything buildable without credits/keys/Danny/Higgsfield is BUILT and verified. Open gates unchanged: Anthropic credits (Christian, "in a while") → sentinel re-verify; rights migration paste (TextEdit, whenever); Stripe/Google/Gemini console items; Danny data entry + skill-briefs file; crew GLBs; site-Supabase creds for Growth v1; App.jsx slices B/C next code session.

## 2026-08-22 — "MAKE VANTUS WORK": Phase C workspace SHIPPED + full debug sweep. Goal session under Danny's one-line delegation.

**Danny's entire reply to the recap ask: "Make Vantus work" (screenshot 8/22).** Read as delegation: the 3 estimate decisions decided ourselves (rule-based approvals stand; confirmed-flag BUILT; AI rationale skipped), veto pass treated as cleared (his own frozen spec, no objections). Christian set a /goal: complete + debug everything reachable, credits top-up after.

**Shipped to prod (`99e0985` → `196d5ed`, deploys verified, then browser-verified via Playwright magic-link session):**
1. **CLIENT WORKSPACE (§3.C.6) — the Open-button bug is DEAD.** Open on a client card now lands on `ClientWorkspaceRoute` (nav id `clientworkspace`, drill-in under g-clients, not a NAV entry): Overview / Deliverables / Scope & Rates / Facts / Decisions (reuses DecisionLogRoute) / Portal & Access (reuses ClientTeamPanel) / Activity (agent_events + audit_log merged feed). Verified live: all 7 tabs render, health strip honest on an empty book.
2. **Client health factors (§3.C.1):** `src/core/clientHealth.js` — 6 EXPLAINABLE factors (approval delay, publish failures, runway via runway.mjs severity, stale facts, payment, inactivity), worst-of headline, no black-box score per spec ban.
3. **Bottleneck panel (§3.C.2):** `BottleneckPanel.jsx` on the Dashboard under CommandView — internal decisions aging at gates (client-mode excluded), facts gaps, unowned clients, single-owner concentration. Renders nothing when empty.
4. **approval_mode_confirmed flag (estimate Q2):** migration `20260822_phase_c.sql` APPLIED by Christian same session; Scope & Rates toggle feature-detects the column (verified both states live: pending-hint pre-migration, toggle post); write path round-trip proven (UI true→false, DB consistent, all 4 active clients false awaiting real human confirmation); activation check gates on the flag with a legacy path for un-migrated rows.
5. **Test harness:** `tests/core.test.mjs` — 22 assertions over truth/clientHealth/commandDigest; `npm test` = rolldown bundle → node (repo .js is CJS-typed for functions, so tests bundle first). All green.
6. **Debug sweep:** npm audit 3 high → **0 vulnerabilities** (nanoid+postcss fixed; **pdfjs-dist REMOVED — declared but imported NOWHERE**, dead dep carrying the PDF.js arbitrary-JS CVE); all 33 functions + handlers node --check clean; ship-interior.mp4 404 probe now HEAD-once-per-session (was console noise every ship visit); remaining console warning = THREE.Clock deprecation from three/R3F internals (benign, lib-side); "TEST-QC price check" item (archived QC Test Kitchen) was still polluting Queued/Blocked/Approvals — SCRAPPED via service key, archived-client sweep confirmed no others.
7. Nav label: Ledger → "Deliverables" (spec §9, id unchanged).

**Still gated, in order of unlock:** Anthropic credits (Christian, next per goal) → re-verify sentinel_classify. Stripe proof + Google OAuth origin + Gemini (console items). Danny's data entry + skill-briefs FILE (not on this Mac — only he has it). Phase C remainder (#5b): content merge calendar, WORK board intake, Growth v1 (needs site-Supabase uowv creds). Higgsfield → crew GLBs. App.jsx decomposition (#8) deliberately NOT attempted this session — needs its own reviewed session, now has a test net to build on.

**Verification method note for the record:** magic-link admin session via generate_link action_link → Playwright drives prod as cz@. The pattern works headless and is the house way to browser-verify auth-gated UI.

## 2026-08-21 (afternoon) — Missing-items sweep + PHASE D BUILT. ⚠️ MIGRATION GATE: `20260821_phase_d.sql` BEFORE push.

**Repo state at close:** `cdcdc26` deployed + verified ready on prod; `ea68b21` (Phase D) committed on main, NOT pushed — apply `supabase/migrations/20260821_phase_d.sql` in the Supabase editor first (staged in TextEdit at /tmp/vantus-phase-d-migration-2026-08-21.sql). Only local noise: .netlify zips + deno.lock, never commit.

**Shipped to prod (`cdcdc26`):**
- Boot-time fix for the 15-40s first paint: the spinner waited on 4 SERIAL fetches (getSession → getUser health check → profile → content) and the 8s stuckGuard only covered the first; on network flaps the uncapped health check stalled 30s+. Now: health-check calls raced at 3s (timeout = proceed with stored session; only explicit server rejection on getUser AND refresh signs out), profile stays awaited-but-raced (profiles.role can DOWNGRADE cz@ to agency — unawaited would flash admin nav), content fetch no longer blocks paint. index.html preconnects fonts.gstatic + Supabase. CSP note: inline onload= handlers are blocked (script-src has no unsafe-inline) — the font async-load trick does NOT work here.
- Every haiku default → `claude-opus-5`: _shared.js ai(), scrappy.js:279, cid.js:60+124. chat.js default was already sonnet-4-6 (haiku stays user-selectable there, which is not a default).

**Prod data cleanup DONE:** ZZ Stress Test fully deleted (3 items, 26 tokens, 65 notifications, all children walked); QC Test Kitchen archived. Stuck-cron noise ends. Note: account_posts has NO client_id column (keys via connected_accounts).

**BACKUP_ENC_KEY: RESOLVED, stop listing it.** backup_runs shows 8/8 nightly encrypted exports status=ok (11:00 UTC, ~13KB .json.gz.enc) through 8/21. The 8/13 entry was right; later entries listing it open were stale.

**EMAIL IS LIVE — the biggest correction of the day.** RESEND_API_KEY (+ both Stripe keys) ARE set in the PRODUCTION context as secret-typed vars. THE GOTCHA THAT HID THIS THREE TIMES: `netlify env:list`/`env:get` read the dev context by default and return secret values MASKED as 20 asterisks — "empty/len-20/invalid" CLI reads mean nothing; check `--context production` and only trust a function-side proof. Proof: stuck-items cron emailed cz/dv/ss on 8/19 (Christian's screenshot), and an end-to-end test through deployed /api/notify (admin session minted via service-key generate_link → verify) sent for real: Resend id 139ede1a…, test notification row deleted after. **Client-facing emails are ARMED — no dry-run net.** Stripe keys: set but UNPROVEN (flagged malformed in July); validity test command given to Christian, not yet run.

**PHASE D BUILT (`ea68b21`, unpushed):** all three §3.D workstreams that don't need Stripe:
- **Scope Sentinel** (§3.D.1): `handlers/sentinel.js` — `sentinel_classify` (7-class enum, never defaults unclear→included, est_value, clarifying question; judged against real clients columns + confirmed precedent) + `sentinel_decide` (human confirm/dismiss/override). Admin-only in the dispatcher (same 403 block as intel). New receipts agent: prefix `sentinel` → "Sentinel". UI: ScopeRoute (nav `scope`, Work group) — intake, draft cards with decide buttons, absorbed-value monthly roll-up (confirmed + absorbed_intentionally rows, deterministic math).
- **Vault hardening** (§3.D.3): `vault_secrets` table = RLS enabled ZERO policies (service-key only, approval_tokens pattern); `/api/vault-secrets` fn (redirect added in netlify.toml) — AES-256-GCM via existing `_lib/crypto` TOKEN_ENC_KEY (already set in prod, no new env), list never returns secret material, reveal/copy decrypt ONE value + write an audit_log view row (values never logged), delete audited. UI: VaultSecretsSection mounted at the bottom of VaultRoute (masked dots, 30s auto-remask).
- **Profitability Lite** (§3.D.4): `client_costs` table; ProfitabilityRoute (nav `profitability`, Growth group) — per-client month view: retainer (if active) + invoices PAID that month − hard costs; entry form + cost list. NO labor allocation per the cut list (the existing Client Analytics margin view keeps its allocation math — different lens, left untouched).
- **Deploy order:** migration → push → verify: Scope Sentinel classify on a real ask; vault secret save/reveal (audit row should appear); a client_costs row lands in Profitability.

**Decisions logged today:** vantus-site GitHub repo CONSCIOUSLY WAIVED (project discarded; Netlify deploy stays; never re-raise). Dynasty passcode rotation: ignore per Christian. GitHub PATs: all four were already expired; Christian deleting them (housekeeping). Supabase dashboard passwords: cz account is GitHub-OAuth-linked = no password exists (reset email confirms); dv/ss to run the same check. Stripe + Gemini console fixes: deferred by Christian. Google OAuth origin fix: still open, walkthrough given.

**Danny email: DRAFTED, NOT SENT (Christian said don't send).** Week-recap version at scratchpad danny-vantus-email.txt (also in TextEdit): recap + data-entry list + 3 decisions + 5 vetoes. No em-dashes. Gmail MCP needs /mcp auth if sending from his address later.

**PHASE D DEPLOYED + VERIFIED (evening, `edb4073`):** migration applied by Christian, pushed, deploy ready. Live verification against prod: Vault save/masked-list/reveal-decrypts-correctly/2-audit-rows/delete ALL OK; client_costs round-trip OK; sentinel_classify's code path proven to the Anthropic API — which 400'd with **"credit balance is too low"**. NEW BLOCKER (CHRISTIAN): the Anthropic account behind Vantus's ANTHROPIC_API_KEY has $0 credits — console.anthropic.com → Plans & Billing → add credits. Until then EVERY AI agent action (QC, Muse, Scrappy, Intel, Sentinel) fails the same way. Re-verify after top-up: one sentinel_classify.
Also fixed en route (`edb4073`): opus-5 compat — thinking leads content[], so ai()/cid/scrappy now take the first TEXT block, and max_tokens floors at 4096 so thinking can't truncate answers. Any future direct Anthropic fetch must do the same.

**Codex: not needed this session** — Phase D shipped complete. Optional future brief: polish passes (roll-up chart, workspace widgets).

## 2026-08-21 — session close: one crew member is REAL, the board for next session

**Repo state at close:** `main` == `origin/main` (`3042c61`), deployed + ready on Netlify (verified by commit_ref every push). Only local noise: regenerated `.netlify/functions/*.zip` + untracked `deno.lock` — never commit either. Everything below is live on usevantus.com and Playwright-verified.

**What this session shipped (7 prod pushes):**
1. **Nav collapsed into the 8-group accordion** from Christian's screenshot (`261d4c5` → final layout `e3ab393`): Command / Clients / Work / Content / Growth / Intelligence / Workforce / Admin. Details + group→page mapping in the 8/20 entry below.
2. **Every trace of orange removed** (`3aa7a88` components → `7a2e529` backgrounds): attention token is now #E5E5EA, backgrounds pure neutral black, the two amber glow divs are gone. Don't reintroduce warm hues.
3. **Phase 3 pipeline cracked + Sean fully DONE** (`4dd2355`): root cause of all rig failures was multi-figure/pinned-arms source art — single-figure A-pose turnarounds fix it. Sean's walk + idle rigged GLBs live at `public/crew/sean.glb` + `sean_idle.glb` (24-joint skins, verified by parsing the GLB). Full per-character recipe with exact prompts/ids in the 8/20 (night) entry.
4. **GLB crew renderer SHIPPED** (`79d502f` + CSP fix `f62b7ef`): `src/ship/crewGLB.js` `createCrewFigure()` — real rigged characters with walk/idle crossfade for crew in its `CREW_GLB` map, automatic procedural fallback for everyone else. **Sean stands in the cockpit as a real character on prod right now.** CSP lesson: GLB-embedded textures load via blob: URLs → `blob:` is in connect-src (netlify.toml).
5. Housekeeping: dynasty.js NETLIFY_DEV localhost fix committed (`abf3469`, inert in prod).

**THE blocker — Higgsfield billing "grace period" (CHRISTIAN):** the account (Ultra label, ~2,720 credits) is throttled to a tiny daily allowance ("daily generation limit for your grace period... update your plan"). Today that was 2 images + ~5 3D jobs, then hard cut; failed jobs auto-refund. **Check higgsfield.ai → billing — almost certainly a failed renewal.** Fixing it un-gates everything below in one sitting; otherwise it's one chunk per daily reset.

**Next session run-list (mechanical, recipe in 8/20 night entry):**
- **Muse** — 4 A-pose crops already uploaded+confirmed; next call is `multi_image_to_3d` with media_ids 6677bd8c…, d8d6fb1a…, 6fe5ec64…, 63702e9c… (full ids in 8/20 entry) → then `3d_rigging` ×2 (walk id 30 / idle id 0, height 1.8) → drop GLBs in `public/crew/` → uncomment her `CREW_GLB` line.
- **Scrappy + Slate** — 1 turnaround image each (reference sheet job_ids in 8/20 entry, reuse Sean's prompt with their identity blocks) → same chain.
- After all four: consider draco/meshopt compression if 8×9MB GLBs hurt load (deferred consciously; Sean alone is fine).

**Unchanged gates:** Phase C = the Danny call (questions in VANTUS-PHASE-A-ESTIMATE.md); emails dry-run until a Resend key; Christian's admin list (ZZ Stress Test delete, QC Test Kitchen archive, vantus-site repo push, CloudScenic brand facts, BACKUP_ENC_KEY).

**Ops notes that held this session:** push flaps → retry wins; deploy-watch by commit_ref; Playwright browser_click broken in this MCP build → browser_evaluate querySelector clicks; sips --cropOffset broken → PIL column-scan for sheet splitting.

## 2026-08-20 — sidebar collapsed into grouped accordion (Christian's screenshot); Higgsfield still image-blocked

- **Nav accordion LIVE (`261d4c5`, deployed + Playwright-verified):** the 20 flat pages now sit under 6 icon groups — Command (Dashboard/Approvals/Decisions/Operations), Clients (Clients/Setup/Reports), Content (Idea Engine/Pipeline/Runway), Intelligence (Content Intel/Client Analytics), Workforce (Agents/Agent Ship/Software OPS), Admin (Billing/Ledger/Vault/Apps/Settings). Click a group to open it (single-open accordion); the active page's group auto-opens and follows navigation; group holding the active page keeps a highlight pill when closed; collapsed 68px rail shows group icons (click = expand + open that group); mobile drawer got the same accordion. `NAV` restructured in `src/utils/constants.js` (+ `navGroupOf()` helper); icons/chevron + both render sites in `App.jsx`. Follow-up same session (`e3ab393`): Christian confirmed all 8 tab names — final layout: Command (Dashboard/Approvals/Decisions), Clients (Clients/Setup), Work (Operations/Ledger/Reports), Content (Ideas/Pipeline/Runway), Growth (Client Analytics), Intelligence (Content Intel), Workforce (Agents/Ship/Software OPS), Admin (Billing/Vault/Apps/Settings). Growth + Intelligence are 1-page homes that future pages grow into.
- **Orange hue stripped tool-wide (`3aa7a88`, deployed + verified):** Christian asked to remove the orange all over the tool. All ambers (#ff9f0a/#f97316/#f59e0b + rgba variants, 77 uses / 31 files) -> neutral near-white #E5E5EA; warnings still read as bright emphasis, zero warm cast; red/green/blue/purple semantics untouched. Hand-tuned: Needs Revisions status -> #ff375f pink (was colliding with Copy Creation), future crew Route/Quill/Echo -> teal/slate/sky, away dot + secure action -> cool tones, login screen orange haze -> cool graphite. Google logo yellow untouched. NOTE: #E5E5EA is now the app's "attention" token — reuse it, don't reintroduce amber. Round 2 (`7a2e529`, deployed + verified on Approvals): Christian still saw the warm haze — it was the BACKGROUND, not components: two fixed amber radial glow divs behind every page (App.jsx ~line 958) now deleted, body #0d0907 -> #000, and every warm-cast near-black (#0f0d0e/#1a1818/#161314/#161414/#0e0c0d/#111010/#0a0809/#1a1410) -> neutral equivalent. Backgrounds are pure neutral black now — don't add warm-tinted darks or glow layers back.
- **Phase 3 characters still blocked, new root cause:** Higgsfield errors "daily generation limit for your grace period" on ALL image generation even after the daily reset (3D endpoints work; account has ~2,800 credits on Ultra) — that wording is a billing/grace state, check the Higgsfield billing page. Also learned: `3d_rigging` fails on Sean's meshes every time — his sheet crops have two figures + arms pinned under the coat; auto-riggers need a single A-pose figure. The mesh tool silently ignores enable_rigging/enable_animation (bare mesh out). Plan when images unblock: regenerate all 4 crew sheets as single-figure A-pose turnarounds (prompt drafted in session) → mesh → rig → GLTFLoader swap. A fresh unrigged Sean mesh sits uncommitted at `public/crew/sean.glb` — don't ship it static.

## 2026-08-20 (night) — PHASE 3 PIPELINE PROVEN: Sean is rigged + animated. Root cause of every rig failure found and beaten.

**The discovery that unblocked everything:** Meshy's auto-rigger needs a SINGLE figure in an A-POSE (arms clearly off the torso, legs apart). Sean's old sheets had 2 figures per crop + arms pinned under the coat — that's why every 3d_rigging call failed instantly. Also confirmed: multi_image_to_3d silently ignores enable_rigging/enable_animation (always outputs a bare mesh); rigging must be its own 3d_rigging pass on the mesh URL.

**The proven per-character recipe (ran end-to-end for Sean):**
1. nano_banana_pro turnaround from the character's 8/17 sheet as image_reference: 4 views in a row, EXPLICIT A-pose language ("arms angled 35 degrees away, clear visible gap between arm and body"), white bg, 16:9 2k. Sean's exact prompt is in this session — reuse it, swapping the identity/wardrobe block.
2. Split into 4 single-figure crops (PIL column-darkness scan — sips cropOffset is broken), media_upload → curl PUT → media_confirm.
3. multi_image_to_3d with the 4 crops, should_texture:true (~38cr, mesh takes ~15-25 min).
4. 3d_rigging on the mesh URL, height_meters 1.8, enable_animation + animation_action_id 30 (Casual_Walk) → walk GLB; run again with id 0 (Idle) → idle GLB. ~8cr each, minutes.

**DONE — Sean:** `public/crew/sean.glb` (Casual_Walk) + `public/crew/sean_idle.glb` (Idle), both 24-joint skins, textured, 9MB each, committed. Verified by parsing the GLB JSON chunk (skins/animations present).
**STAGED — Muse:** A-pose turnaround generated + 4 crops uploaded/confirmed as media_ids 6677bd8c-d71a-4ae1-af3f-d567e1fe2502 (front), d8d6fb1a-4e75-43d5-a7b1-cab63eb011fc (sideL), 6fe5ec64-cb35-4890-a681-459a33663068 (back), 63702e9c-d4ec-4fa8-9045-b34399546adc (sideR). Next call = step 3 with exactly those ids.
**BLOCKED — Scrappy + Slate turnarounds:** need 1 image job each; their 8/17 sheet job_ids for image_reference: Scrappy e98dcaa6-d4df-4650-85f4-1e162715631a, Slate ac910d9b-ee83-43f9-ab58-54deec52be88 (Muse's was 0b68d776-6f9a-4640-9d57-c9e9f1fbfc26).

**THE BLOCKER — Higgsfield "grace period":** the account (Ultra label, ~2,760 credits) is in a billing grace state. Error: "daily generation limit for your grace period... update your plan to continue." Today's allowance ≈ 2 images + ~5 3D jobs, then hard cut. All failed jobs auto-refund. CHRISTIAN: check higgsfield.ai billing — a failed renewal is throttling the account; fixing it removes the daily cap. Otherwise: run the remaining steps across daily resets (Muse mesh+rigs, then Scrappy/Slate full recipe).

**LAST MILE SHIPPED SAME NIGHT (79d502f + f62b7ef, deployed + Playwright-verified):** `src/ship/crewGLB.js` — `createCrewFigure()` drop-in used by ShipScene3D + ShipWorld3D. Crew listed in its `CREW_GLB` map render the real rigged character (walk/idle crossfade via AnimationMixer, same facing/lean language, normalized to the 34-unit figure height); everyone else — and any GLB load failure — keeps the procedural figure. SEAN IS LIVE IN THE COCKPIT as a real character on prod. CSP gotcha solved: GLTFLoader fetches GLB-embedded textures via blob: URLs — `blob:` added to connect-src in netlify.toml. To bring each remaining crew online: run the recipe above, drop `public/crew/<name>.glb` + `<name>_idle.glb`, uncomment their line in CREW_GLB. Also committed this session: the dynasty.js NETLIFY_DEV localhost-origin fix (abf3469, inert in prod).

## 2026-08-17 (late night) — The measured living ship is LIVE; Phase 3 pilot mesh in flight; the honest ceiling was named.

After Christian rejected the static look ("agents in the corner / just looks like an image"), the closing pass (final push 2da753b): two Fable agents measured the artwork pixel-precisely — sloped floor lines both decks (~150-unit nose-to-stern drop; the old flat lines were mid-wall, THAT was the floating crew), true room bays (holo-core = analytics at x≈684), and the human scale: **~130 logical units per adult mid-ship — our figures were 3× too small**. Now live: crew at perspective-aware human scale on the real painted floors, chips riding the deck slopes, shipArtFX (16 measured screen flickers, 12 lamp halos, breathing core glow + light, foreground rain, city twinkle, cloud drift, dust — 8 draw calls, 0.05ms), continuous camera sway/breathe. CINEMAGRAPH LESSON: a Seedance ambient-loop video of the art was tried and REVERTED — its "imperceptible" camera drift wandered and re-graded the scene, breaking calibration; the video code path remains (drop a locked-off loop at public/ship-interior.mp4, no deploy needed) but demand a literal tripod-static generation.
NOW EXPOSED at human scale: the procedural figures read blocky against photoreal art. Phase 3 pilot RESULT: Sean MESH DONE — valid textured 4MB GLB (saved ~/Downloads/vantus-sean-character.glb; CDN hf_20260817_201839_e5387b22…glb; also job e5387b22 in the gallery). Rigging step BLOCKED: Higgsfield daily generation limit hit — resume with 3d_rigging (model_url=e5387b22-1834-436d-ae3e-bc9fa35be125, enable_animation, animation_action_id 30 Casual_Walk; idle clip TBD) after the limit resets. If the mesh is good: same for Muse/Scrappy/Slate, then 3d_rigging animation clips (walk/idle via animation_actions) → GLTFLoader + AnimationMixer replacing procedural figures in ShipScene3D. That is the last mile to the reference.
The honest ceiling was also named to Christian mid-frustration: painting-fidelity + full interactivity is a game-studio-scale ask; the shipped compromise is art-as-world + live layers. His standing directive: keep going until it matches.

## 2026-08-17 (final) — THE SHIP MATCHES THE REFERENCE. Insight that ended the loop: polygons can't look like a painting — the painting is the world.

Christian's bar was always "looks like the reference image." Landed (push 22fb9f2, verified live): regenerated the ship artwork FROM his reference (same composition/density/lighting, people + film creatures removed, 2048px, candidate B of 2), recalibrated world.js (rooms/floor-lines/ladders/deck ceilings) to the new art's bays, and restored ShipScene3D (art stage + live 3D crew + projected chips) as the 3D View. The screen now reads as his mockup: photoreal ship centerpiece, receipt-driven crew, rail + mission bar chrome. ShipWorld3D (fully modeled world) stays in-repo one import away, pending its art-direction session — its DoubleSide/candela/albedo fixes from tonight all stand. Doctrine for the future: cinematic look = generated art as the stage + live layers on top; modeled 3D = for when the camera must move.

## 2026-08-17 (night) — Cinematic pass on the modeled ship: shipped + root-caused, one art-direction session left honestly open.

Christian's bar: the modeled 3D ship should look like his reference. Shipped tonight (pushes 310321f..249a473): grunge textures (public/textures/, generated + wired as map/bump), greebles.js detail layer (20 cable runs, swaying wires, pipes+valves, blinking junction boxes, vents, trusses, clutter — Fable subagent, 17 draw calls), UnrealBloomPass + ACES (three's bundled passes, no new deps), per-room warm lamp rig at candela scale, lightable base albedo, and the big one: **DoubleSide on merged shell materials — the cutaway shows back faces of outward-facing geometry, which single-sided Lambert lit BLACK under every lamp.** That bug ate 4 brightness iterations before a magenta diagnostic floodlight isolated it (props lit, shell didn't). Also root-caused the "slow prod first paint": Playwright browser console shows ERR_INTERNET_DISCONNECTED/NETWORK_CHANGED bursts — the Mac's network flaps; auth itself resolves instantly. Texture loads confirmed ok on prod.
**Honest state:** structure/density/glow ✔, but the painterly grim richness of the reference is NOT yet met. Remaining = art direction, not debugging: baked AO/shadow gradients into merged geometry (vertex colors), per-room emissive light pockets, texture presence tuning, possibly SSAO pass. DO THIS WITH A LOCAL VISUAL HARNESS (standalone vite page importing src/ship/* with a fake sim — no auth, screenshot in seconds) instead of prod deploy loops.
**Standing option:** ShipScene3D (the cinematic painted ship + live 3D crew) is in-repo unimported and is visually the closest thing to the reference today — a one-line route swap makes it the 3D View while the modeled world gets its art pass.

## 2026-08-17 (later) — Crew wardrobe identities LIVE + Phase 3 character sheets GENERATED. Likeness rule held and settled.

Christian asked for the actual Matrix cast (Neo/Morpheus/Trinity/Tank/red-dress woman) by name; declined plainly once (WB copyright + actor right-of-publicity + Danny's own spec ban) and he accepted the swap: "make faces that aren't their faces." Settled doctrine: archetype wardrobe yes, likenesses never.
- **Wardrobe pass LIVE (push 50a3386):** every crew figure in the 3D ship now has a distinct silhouette — Sean flared trench + visor, Muse THE red satin dress, Scrappy operator sweater + headset, Slate bald mentor greatcoat + spectacles, six future crew varied (vest+cap/blazer/hood/scarf/suspenders/armor). Fable subagent build, 11-figure harness green, verified on prod (Muse's red reads instantly in Quarters).
- **Phase 3 character sheets DONE (Higgsfield, in Christian's gallery):** 4 turnaround model sheets (front/3-4/profile/back) for Sean/Muse/Scrappy/Slate — original faces, reference-mood wardrobe, spot-checked for likeness safety (Slate ≠ Fishburne, Sean ≠ Reeves). Job ids in this session's transcript; raw URLs on the CDN.
- **Phase 3 pipeline upgrade discovered:** Higgsfield has `multi_image_to_3d` (feed the 4 cropped turnaround views) AND `3d_rigging` + `animation_actions` (rig + baked animation clips) — meaning NO Mixamo manual step is needed. Full remaining path, all automatable: crop each sheet into its 4 views → multi_image_to_3d per character → 3d_rigging with walk/idle clips → GLB integration in ShipWorld3D via AnimationMixer switched by sim state. One session of work when called.

## 2026-08-17 — PHASE 2 SHIPPED: the fully MODELED 3D ship. The ship arc is complete through Phase 2; only Phase 3 (bespoke characters) remains.

The painted backdrop is gone from the 3D View — the crew now walks a real procedural low-poly cutaway hull (final push c20be8f, verified live):
- `src/ship/shipModel.js` (Fable subagent, 586 lines): ribbed armored shell w/ cyan cross-section rims, all 12 station interiors (cockpit viewport + holo table, console rooms w/ flickering screens, 8-slot pipeline board, QC scanner arch w/ sweeping beam, security gate, pulsing core chamber, server racks + cycling piston, bunks, vault door + crates, reactor + 3 thrusters), lift shafts at ladder seams — 23 draw calls, deterministic builds, 0.005ms/frame, only 2 real lights.
- `src/ship/environment3d.js` (Fable subagent): storm-sky dome, 3-layer endless city (400 twinkling windows), rain that provably never enters the cutaway, haze, under-hull hover glow — 11 draw calls.
- `src/ship/scene3dContract.js` = the single 3D-space source of truth (deck heights, walk lane, camera, palette). `ShipWorld3D.jsx` = host: engine→3D navigation (climbs lerp real deck heights), crewModels figures reused, chips projected from true 3D anchors, contract camera + parallax, 4-light rig (incl. warm cutaway-side fill per the 8/17 lighting pass).
- Movement verified live again (intel receipt → figure at the core → aged honestly back to 0 working). Renderer lineage now: ShipWorld3D (live) ← ShipScene3D (art plane, unimported) ← ShipGame (2D canvas, ACTIVE as no-WebGL fallback) ← shipRenderer/shipRendererArt (unimported skins).
- Phase 3 queued: bespoke GLB crew (character sheets → mesh → Mixamo rig — original designs only; the likeness rule held through every request to use the film cast).
- Prod note: fresh sessions take 15-40s to first paint (black + blue dot) — pre-existing app hydration, NOT the 3D chunk (occurs before route code runs); worth a look someday.

## 2026-08-15 (night) — PHASE 1 3D SHIP LIVE: the cinematic ship in a real three.js scene, receipt-driven 3D crew.

Christian's directive: fully 3D, animated, "the actual ship I sent." Delivered as the planned Phase 1 (2.5D uplift) — LIVE on prod, verified with a walk test (fired intel_score_content, watched the 3D Scrappy figure work at the holo-core; header showed "1 working this minute").
- **First npm deps in this repo:** `three` + `@react-three/fiber` (R3F v9 for React 19). Entirely inside the lazy ShipRoute chunk (249KB gzip); main bundle unchanged. NoToneMapping so the painting renders as painted; hemisphere+key light rig shapes the crew only.
- **Files:** `ShipScene3D.jsx` (R3F host: parallax camera w/ ambient sway, art plane, sim bridge, HTML chip overlay, feet projected onto painted floor lines) · `src/ship/crewModels.js` (procedural articulated figures, 13 meshes: flared-coat silhouette, agent-color rim, visor strip, elbow-jointed typing arms, status light, canvas name tag — ORIGINAL designs; 22/22 checks) · `src/ship/holoFX.js` (core particle column + light, dust, window shafts, engine flicker; 0.01ms/frame). Both modules by parallel Fable subagents against contracts — second clean run of that pattern.
- **Fallback chain:** no WebGL → 2D canvas ship (ShipGame); ShipView3D (static art + cards) still in-repo unimported.
- **Likeness rule enforced again:** Christian asked for "the actual character models" from his reference = the Matrix cast. Flagged once (spec ban + legal exposure), built original crew in the same wardrobe/mood. Phase 3 (bespoke GLB characters via character-sheet → mesh → Mixamo rig) is where the designed crew lands if wanted.
- **Phases 2–3 queued (planned, not started):** true modeled low-poly interior w/ waypoint navigation; bespoke rigged character models. Plan in the 8/15 conversation; re-scope on request.
- Known cosmetics: THREE.Clock deprecation warning in console (benign); quarters figures could use a touch more separation at laptop widths.

## 2026-08-15 (evening) — THE LIVING SHIP IS LIVE: full §10 build-out in one day, ending in a Terraria-style crew simulation on prod.

Christian ordered the full ship ("stop with these small phases") — a conscious override of the cut-list's Phase E sequencing, defensible because the cut-list gated the office on receipts existing and Phase B shipped receipts. Progression across the day, ALL live on usevantus.com:
1. **Founder Rail** (List View) on the Dashboard + as the ship's right rail.
2. **Static 3D view**: original cinematic artwork generated via Higgsfield in the mood of Danny's reference (`agent-ship-*-reference/mockup.png` in ~/Downloads — his versions contain Matrix likenesses, OURS DOESN'T, per his own likeness rule) with mockup-style live station cards. Superseded same day but the art ships at `public/ship-interior.jpg` and `ShipView3D.jsx` remains in-repo unimported.
3. **The living ship (current 3D View)**: `src/ship/world.js` (geometry contract: 3 decks, 12 rooms, ladders) + `shipEngine.js` (receipt-driven crew movement — multi-deck pathfinding, walk/climb/work/idle/sleep, seeded deterministic wandering; built by a Fable subagent, verified with a cockpit→vault multi-hop trace) + `shipRenderer.js` (canvas pixel world: per-room interiors, holo-core, bunks with sleeping future crew, parallax city, rain, reactor; second Fable subagent) + `ShipGame.jsx` (RAF host). **Movement proven live on prod**: fired intel_score_content, watched Scrappy walk Quarters→ladder→Analytics Node and work beside the holo-core. Screenshots in ~/ship-game-*.png.
- Route chrome per Danny's mockup: AGENT SHIP // ONLINE strip (status = real backup health), 3D/Map/List toggle, mission bar (real numbers only), AgentRail as the AGENT ACTIVITY feed.
- Crew canon: Sean/Muse/Scrappy/Slate commissioned (Slate = the QC agent's §10 name; agent_events name "QC" maps to him); Route/Tally/Frame/Echo/Quill/Vault ghosted asleep in bunks until commissioned.
- Multi-agent note: the two sim modules were built by parallel Fable subagents against the world.js contract — clean handoffs, both self-verified. Pattern worked; reuse it.
- Nits open: none blocking. Possible polish: sprite labels tiny at laptop widths; station detail panel could pin receipts to the clicked room's sprites.

## 2026-08-15 — Founder Rail BUILT (spec §10 List View, the "matrix view" Danny mentioned). — ✅ superseded by the evening entry; everything shipped same day.

Danny's "matrix view for the agents" = the Agent Ship he locked in the spec 7/31 (Matrix-hovercraft reference, §9 art note + §10). Doctrine-compliant first slice built: **AgentRail.jsx** on the Dashboard — Danny's exact tiers (WORKING NOW honestly empty until long-running agents exist / QUEUED NEXT from ai_ops tasks with reason / BLOCKED with owner + SLA-paused marker / APPROVALS with Review Now deep link / DONE last 48h as expandable agent_events receipts with failure count shown) + the real-numbers bottom bar (agents active, done 48h, blocked, approvals, backup health). Supersedes the flat AllActivityFeed mount in CommandView — same receipts spine, per the one-spine rule. Map View (2D stations) = good future Codex brief; 3D ship stays Phase E per Danny's own cut list. Also in this unpushed pair: CSP hash for the React 19 style-hoisting console violation (8/14). Cron fleet: day 2 all green (backup 12.3KB ok, SLA pause held). Both intel AI actions proven live 8/14 (score: 4 verdicts, sharp summary; ideas: 4 grounded drafts, fit 0.85–0.92 — awaiting Approve/Kill in the UI to start the taste loop). Facts review now 4/6 (CloudScenic + ZZ remain).

## 2026-08-13 (later) — Content Intel (Studio Intel port) BUILT + committed. ⚠️ MIGRATION GATE: `20260813_content_analysis.sql` BEFORE push. Phase B browser stress test PASSED same day.

**Stress test first:** Phase B verified in a real browser against prod (Playwright, admin magic-link session): Decisions CRUD loop, TruthDrawer receipts, live approval minted immutable v1 + approved_version_id, stale-facts hard gate blocked scheduling, block-reason save → Ledger flag → founder digest with SLA-paused marker, 3 audit rows verified in DB, Settings cards render. Test artifacts cleaned (decision row deleted; ZZ fixture kept for the team's portal pass). Known pre-existing wart: one CSP inline-style console error on load. Not exercised: Mark-posted URL prompt, the two Phase B crons (fire on schedule).

**Then the port (per Studio's STUDIO-INTEL-TO-VANTUS guide):** per-client Content Intel — reads the IG posts the sync already lands in `account_posts`, computes send/save/follow/hook-hold rates vs per-client benchmarks, plus two AI actions (ideas from live performance, winners/losers scoring). Nothing auto-posts, ever.

- **⚠️ DEPLOY ORDER:** `supabase/migrations/20260813_content_analysis.sql` in the Supabase editor FIRST (staged in TextEdit). Tables: `content_analysis` (**account_post_id is BIGINT — the guide assumed uuid, but account_posts.id is bigserial; fixed**), `content_ideas`, `content_benchmarks`, + `clients.content_pillars` jsonb. RLS admin-domain; portal users see nothing.
- **Handler:** `agent-action/handlers/intel.js` (house CJS, `ai()`/`sbGet` from _shared) — `intel_score_content`, `intel_generate_ideas`, `intel_set_idea_status` (the taste-loop write). Wired into the dispatcher **admin-only** (service-key writes bypass RLS; portal sessions get 403). `intel` prefix → Scrappy in AGENT_PREFIX_MAP; agent_events logging is automatic. Brand context = `brand.voice` (getBrandContext), replacing Studio's personal KNOWLEDGE block; to run Christian's own account, paste his KNOWLEDGE text into that client's brand_voice_md.
- **Cron:** `intel-refresh` (15:30 UTC) — nightly deterministic rate recompute for every IG-connected client, zero AI spend; rewritten from the guide's Functions-2.0 style to the house CJS + next_run gate. AI reads stay on-demand.
- **Sync delta:** `sync-instagram.js` REELS/VIDEO metric list now requests `ig_reels_avg_watch_time` (stored raw ms in metrics jsonb; readMetrics divides) + Studio's degrade-retry (one unsupported metric no longer loses ALL insights for that media — previously it did).
- **UI:** `ContentIntelRoute.jsx` — new "Content Intel" nav under CONTENT: benchmark bars ("bars to beat", Studio defaults until a client has `content_benchmarks` rows), ranked table with ▲/▼ vs bars, Run analysis / Generate ideas, idea queue with Approve/Kill. Guide's foreign palette + fictional `useSupabaseRows(table, options)` signature replaced with house style + the real query-builder hook. Browser-safe math copy in `src/utils/contentMetrics.js` (handler keeps its own — change together).
- **Deliberately dropped from the guide:** comments ingestion (Vantus doesn't ingest comments; re-addable later), the transcript clip scorer (excluded by the guide itself), Studio's IG_ACCESS_TOKEN/IG_USER_ID env (per-client tokens in connected_accounts are the right shape), Netlify env changes (none needed), CSP changes (all new calls are server-side or same-origin).
- **Known-null by design:** `follow_rate` (IG doesn't expose per-media follows) and `hook_hold` (no duration source yet — was null in Studio too).
- **Verify after migration+push:** cron dry-run `/.netlify/functions/intel-refresh?test=1&key=<CRON_TEST_KEY>`; `intel_score_content` on a client with synced IG posts (CloudScenic); ideas land as drafts; portal user sees zero rows.
- Committed on main, NOT pushed (push on Christian's go).
- **v1.1 addendum (same day, ~2:15pm):** Codex's second pack (`codex/grunt-2026-08-13b`, 4 clean commits) merged + wired: `BenchmarksCard` (per-client bar editing + set-from-control-post) and `PillarsEditor` side-by-side in ContentIntelRoute, `IdeaPromoteButton` on approved ideas (inline-confirmed insert into content_items at Ready For Copy Creation, idea → status 'posted'; contract verified — text id, stage mirrors status). NO migration needed — tables already live. Console items closed this session: BACKUP_ENC_KEY set+verified (dry-run proved encrypt path, first real export tonight 11:00 UTC), rogue Resend var DELETED (it was a Resend key pasted as the NAME, value empty — which is why RESEND_API_KEY was never set; key = burned, mint fresh when deliberately going email-live). Codex checked out its branch in the shared worktree AGAIN mid-session (no damage; worktree isolation still the fix). cloudscenic's 3 connected_accounts were assigned to the CloudScenic client (they had client_id NULL — Setup §2 gap) and content_analysis seeded (4 IG posts; one reel at 2.64% send-rate vs the 1.3% bar).

## 2026-08-13 — Phase B (TRUTH) BUILT + Codex UI pack MERGED. ⚠️ MIGRATION GATE: `20260813_truth.sql` in the Supabase editor BEFORE push. — ✅ SHIPPED same day: migration applied+verified 12/12, pushed on Christian's go, deploy ready. Stress test passed (see entry above).

**Christian verified Phase A in the browser this morning ("looks good") and ordered Phase B.** All eight §3.B workstreams implemented; Codex built the presentational pack in parallel on `codex/grunt-2026-08-13` (5 clean commits, new-files-only) and it is merged + wired. Build clean. Committed on main, NOT pushed — main is now 4 commits ahead of origin.

- **⚠️ DEPLOY ORDER:** apply `supabase/migrations/20260813_truth.sql` FIRST (idempotent, additive), THEN push. New tables: `content_versions` (immutable — UPDATE-blocking trigger), `decisions`, `audit_log` (append-only), `truth_registry` (seeded: Sprout=schedule, Stripe=payments, Vantus=approvals), `backup_runs`, private `backups` storage bucket. New columns: content_items verification fields (verification_status/live_url/verified_at/verification_source + approved_version_id) + block fields (block_reason/blocked_since/block_owner/block_external/block_escalation_date — same on tasks); clients get facts_review_frequency_days + facts_last_reviewed_at (backfilled from facts_updated_at).
- **Version lineage (§3.B.2):** `src/core/versions.js` — creative edits in handleSave mint immutable versions; every APPROVED decision captures the approved version + sets `approved_version_id`, on BOTH paths (`recordApproval` browser-side, `executeDecision` in approval-decision.js service-side — **the two are mirrored, change together**). TruthDrawer shows drift ("edited since approval"). Missing lineage on legacy items is warn-only, deliberately.
- **Publish verification (§3.B.1):** `markPosted` now REQUIRES a live URL (Ledger prompts for it); stamps the verified/manual receipt + audit row. New cron `verify-publishes` (16:30 UTC): flags past-publish-date items with no receipt → 'awaiting' + `publish_unverified` bell; auto-verifies via `platform_post_id` ↔ `account_posts` (no writer for platform_post_id yet — the join is ready for Phase C Sprout wiring).
- **Exception engine (§3.B.4):** Blocked section in EditContentModal (reason/owner/external/escalation); blocked_since bookkeeping in handleSave; commandDigest blocked tier shows reason+owner (explicit blocks beat the age heuristic); **check-stuck-items now SKIPS external waits until their escalation date — SLA paused, client delay ≠ our failure (R10)**.
- **Audit trail (§3.B.5):** `src/core/audit.js` (logAudit/auditDiff — best-effort, never blocks the change). Hooked: content_items mandated fields (handleSave), Setup client fields (patchClient), Facts saves, vault saves (**field names only, never values**), markPosted, verify-publishes system rows.
- **Freshness gating (§3.B.7):** `truthGates()` in `src/core/truth.js` — **STALE FACTS HARD-BLOCK scheduling/client-facing statuses** (in the modal's SOP checklist). FactsAndReports grew review-cycle controls: per-client frequency + "Still correct — mark reviewed". Editing facts counts as reviewing. **Expect stale badges on first look — that's the feature; review facts to clear.**
- **Backups (§3.B.8):** `backup-export` cron (11:00 UTC) — gzip + AES-256-GCM export of 20 operational tables to the `backups` bucket + a backup_runs ledger row every run, ok OR failed. **Needs `BACKUP_ENC_KEY` (32-byte base64: `openssl rand -base64 32`) in Netlify env — until set, every run logs FAILED loudly in the Settings Backups card.** Christian console item.
- **Surfaces:** Ledger row → **Receipts** button → `TruthDrawer` (approved version/by whom, publish receipt, block state, versions, decisions, who touched it — the Phase B DoD on one panel). New **Decisions** nav (COMMAND) → Codex's DecisionLogRoute (decision debt ranked by blocks_count + decided history). Settings: TruthRegistryCard + Codex's BackupsCard. NOTIF_META: +publish_unverified; report_sent/report_missing now first-class (were fallback-rendered since 7/2).
- **Two-agent note for the record:** Codex ran in THIS working tree and checked out its branch mid-session; my working changes rode along and came back to main untouched (only HANDOFF.md content differed between bases — recovered). Codex's 5 commits were verified single-file before merging. If both lanes run concurrently again, prefer `git worktree` for the Codex lane.
- **Not exercised:** none of this has touched a real browser (STRESS-TEST.md pattern stands). Deliberately not built: checksums/diff viewers, hard-block on missing legacy lineage, per-fact freshness (per-client cycle only), Stripe/Sprout sync writers (Phase C/D).

## 2026-08-12 — Phase A LIVE on prod (go-live sequence completed 8/7); critical path is the Danny call + his data entry

**Go-live executed 8/7, in order and clean:** migration `20260805_activation.sql` applied by Christian in the Supabase SQL editor → `f6e198d` + `f5db0c3` pushed → Netlify deploy `6a7631ee…` went **ready** at 12:28pm. usevantus.com now serves the activation dashboard, approvals inbox, command view, and notification digest. The 8/5 entry's sequence is fully discharged; there is no migration exposure.

**Standing reminder for whoever logs in first:** the Dashboard opens in ACTIVATION STATE with everything red. That is the feature working. It stays red until Danny's data entry lands (17 skill briefs via Apps → Skills — now writing to the real `skill_briefs` table, not localStorage — plus Facts of Record, retainers, cadence, per-client owner, report recipients, approval modes). "View KPIs anyway" shows the old grid.

**Open board (non-code):**
- Danny call — hand off `VANTUS-PHASE-A-ESTIMATE.md`, get answers on: AI-written approval rationale (+2-3d), explicit approval-mode-confirmed flag (+0.5d), `RESEND_API_KEY` (all email still `[email dry-run]`).
- Browser stress-test pass — Phase A surfaces AND the client portal have never been exercised in a real browser (`STRESS-TEST.md`).
- Post-pass cleanup: delete client "ZZ Stress Test" (slug `zz-stress`) + archive QC Test Kitchen; both will correctly trip the stuck-item cron.
- Console loose ends: rogue Resend-named env var (7/8), `vantus-site` GitHub repo not yet created/pushed, Dynasty passcode rotation (`temppass`).

**Coding backlog = v3 spec Phases B–E** (spec lives OUTSIDE the repo at `~/Downloads/VANTUS-V3-BUILD-SPEC.md`). Doctrine order: B (TRUTH — publish verification receipts, version/approval lineage, decision log + decision debt, exception engine, generalized audit trail, source-of-truth registry, freshness/stale gating, backup discipline) → C (Danny's views: health bars, bottleneck panel, receipts-grade activity rail [ship List View first], Growth v1, content merge, client workspace shell that retires Setup and fixes the Open button, WORK destination) → D (Scope Sentinel agent, Stripe, vault hardening, Profitability Lite) → E (interpreter/steward/rights clock/office). **Phase B is veto-safe and can start now; Phase C waits on Danny's Section 8 vetoes.** Phase B adds several new tables — same migration-before-push discipline applies.

**Working tree:** `netlify/functions/dynasty.js` carries an uncommitted dev-only tweak (drops the localhost Origin header under `netlify dev` so the origin allowlist doesn't block local POSTs; prod untouched). It is the Dynasty terminal's change — leave it for that lane to commit. `deno.lock` untracked.

## 2026-08-05 — Phase A sits COMMITTED + UNPUSHED (`f6e198d`); go-live is a 3-step sequence — ✅ DISCHARGED 8/7, see entry above

**Current state:** local main is 1 commit ahead of origin (`f6e198d`, the full Phase A build below). Working tree otherwise clean except the pre-existing `netlify/functions/dynasty.js` modification (Dynasty terminal's, untouched) and untracked `deno.lock`. Nothing applied to prod yet — neither SQL nor code.

**Go-live sequence, in order (a push IS a prod deploy):**
1. Apply `supabase/migrations/20260805_activation.sql` in the Supabase SQL editor (project wjcs…). Idempotent; adds `clients.report_recipients`, `clients.owner_team_member_id`, `skill_briefs`.
2. `git push origin main` after review — Netlify auto-deploys.
3. First login will show the Dashboard in ACTIVATION STATE with everything red — that is the feature working, not a regression. It stays that way until the data entry lands (Danny's side: 17 skill briefs via Apps → Skills, Facts of Record, retainer numbers, cadence; plus per-client owner in Setup §1).

**Danny call (estimate handoff) still pending.** `VANTUS-PHASE-A-ESTIMATE.md` (repo root, in the commit) carries the three open questions: rule-based vs AI-written approvals rationale (+2-3d), explicit approval-mode confirmation flag (+0.5d), email digests gated on RESEND_API_KEY (his console item). Also tell him: the skill-brief deploy task DEPENDS on step 1 above — briefs deployed before the migration land in a browser's localStorage, not the system (the app auto-imports them after, but don't rely on it across machines).

**Out-of-repo context:** the Vantus marketing site is a separate repo at `~/vantus-site`, LIVE at https://vantus-site.netlify.app (future-facing positioning, waitlist Netlify form registered, no pricing per the spec's no-external-selling gate). Its GitHub repo (`czcloudscenic/vantus-site`) still needs to be created + pushed — no `gh` CLI on this machine.

## 2026-08-04 — Phase A (v3 spec) BUILT: activation dashboard, approvals inbox, command view, digest. ⚠️ MIGRATION GATE before push

**Danny's VANTUS-V3-BUILD-SPEC.md (frozen 7/31) reviewed → estimate in `VANTUS-PHASE-A-ESTIMATE.md` (repo root) → Christian green-lit → Phase A implemented this session. Committed locally in `f6e198d`, NOT pushed.**

- **⚠️ DEPLOY ORDER (the whole risk of this drop):** apply `supabase/migrations/20260805_activation.sql` in the Supabase SQL editor FIRST, then push. It adds `clients.report_recipients`, `clients.owner_team_member_id`, and the new `skill_briefs` table (admin-domain RLS). The app tolerates the missing table (warns, shows an error line on Skills) but the activation checklist and Skills page only go fully live after the migration. Idempotent, additive, safe to re-run.
- **Activation state (spec §3.A.1):** `src/core/activation.js` — 11 per-client checks computed only from real columns (contact, brand voice, Facts of Record via the existing `factsFilled()`, retainer [brief-lane exempt], cadence, approval-mode-with-approver, connected account, report recipients, account owner, content flowing, owner+due hygiene) + agents-without-briefs at book level. `ActivationBoard.jsx` replaces the Dashboard KPI grid while under-configured: score ring, next-5 actions (deep-link via setActiveNav), deficiency groups, per-client score strip, "View KPIs anyway" peek. `ClientsRoute.setupScore` now delegates to the same module — grid % and dashboard checklist can't disagree.
- **Approvals inbox v1 (§3.A.3):** new `Approvals` nav id (COMMAND section) + `src/ui/routes/ApprovalsRoute.jsx`. Cross-client queue of gate-status items with `approval_mode != client`; risk/effect/recommendation are RULE-BASED (qc_status, revision cap vs included_revisions, due-date proximity, runway severity, days-at-gate) — deliberately no AI text (Danny question #1 in the estimate; +2-3d if he wants it). Approve/Reject wire into the existing `recordApproval()` (same audit path as the portal; reject requires feedback). Edit reuses EditContentModal via setEditingItem. Client-mode items render as a read-only "waiting on clients" strip — chase, don't override.
- **Founder command view (§3.A.2):** `src/core/commandDigest.js` (pure) tiers the book into critical / requires-you / due-today / blocked / at-risk from content+tasks+invoices+pending client_users+runway; `CommandView.jsx` renders tier tiles → expandable lists → deep links, and sits on the Dashboard both during and after activation. Routine tier = `AllActivityFeed.jsx` (agent_events, no client filter, client chip per row — same rows as the per-client feed, second rendering).
- **Notification digest (§3.A.4):** `NotificationDigest.jsx` — one unscoped notifications query (admin RLS already allows; index exists), grouped client→type, role tabs Founder/Ops/Finance. `NOTIF_META` moved from App.jsx to `utils/constants.js` (+role field) so bell + digest render one map. In-app only — email digests stay gated on RESEND_API_KEY (Christian-console item, unchanged).
- **Landing spots for Danny's parallel data:** SkillsPage now reads/writes `skill_briefs` (one-time localStorage import, flagged via `vantus_skill_briefs_imported`; "All Agents" target covers the roster in the activation check). Setup §1 grew Account-owner select + Posts/week. Monthly-reports cards grew a Recipients input (comma-separated → `report_recipients`; empty still falls back to primary_email).
- **App.jsx delta ~25 lines** (nav block, DashboardRoute props, ApprovalsRoute mount, NOTIF_META import swap). All new logic in `src/core/` + new files. Build clean after every chunk (final: 428KB main, 13 lazy chunks).
- **Not exercised:** any of this against prod data in a real browser — same standing gap as the portal (STRESS-TEST.md pattern applies). First look will show everything red/missing until Danny's data entry lands; that's the feature working, not a bug.
- **Explicitly NOT built (per spec/estimate):** client workspace shell (Phase C — Open button still switches tenant + goes to dashboard), email delivery, Danny's content (17 briefs, facts, retainers), AI-written approval rationale, sidebar badge counts.

## 2026-07-29 night session — migrations APPLIED + verified on prod; feature pack proven live; stress-test kit shipped

**Closes the ⚠️ from the late-session entry below: there is no migration exposure anymore.**

- **Christian pasted the migration bundle the same evening.** Verified directly against prod Supabase, 13/13 green: all 4 new tables (approval_tokens / content_comments / stuck_alert_state / intake_requests), all 4 new columns (clients.included_revisions, clients.intake_token backfilled for every active client, team_members.monthly_cost, content_items.review_video_path), the review-media bucket, and the **revision-count trigger fires** (tested with a real approvals insert, then cleaned).
- **One-click approval flow proven END-TO-END against prod DB** (on the QC test item, fully cleaned + restored after): GET renders confirm page → POST records the decision → item advanced to Needs Revisions → trigger bumped revision_count → audit row `stage='client'` → notification carried the cycle-aware dedupe_key + client_id → BOTH tokens consumed (sibling invalidation) → replayed link says "Already recorded" → no premature cap alert at round 1 of 2. 8/8 assertions.
- **Intake proven live:** greet endpoint returns the client name, honeypot fake-succeeds and writes nothing, real POST stages a row + rings the bell. Both crons 403 unauthenticated on prod (chase-overdue-tasks was publicly invocable before this pack).
- **Stress-test kit shipped (`7d30c7b`):** `STRESS-TEST.md` (repo root) is the team's per-feature walkthrough — portal setup via a personal-Gmail invite, the internal-item scoping tripwire, two-browser realtime, caps to R2/2, intake promote, token rotation, margin entry. **Seeded prod fixture: client "ZZ Stress Test"** (slug `zz-stress`, approval_rule client, id `31749476-…`) with 3 items — copy-gate + content-gate (client-mode, appear in the portal) + one internal-mode negative control. **Delete ZZ + finally archive QC Test Kitchen after the team's pass** — both will (correctly) trip the stuck-item cron within days.
- **Still not exercised anywhere:** (1) the portal in a real browser with a client Google login — the whole backend is proven, the React surface isn't; first item on STRESS-TEST.md. (2) Real emails — `RESEND_API_KEY` still empty; every send logs `[email dry-run]`. (3) Stripe create-path. The 7/18 Christian-console board is otherwise unchanged.
- Two-agent repo etiquette now standing: **`git pull` before every commit**; pushes are keyless AND auto-deploy — a push IS a prod deploy.

## 2026-07-29 late session — Software OPS merged; ⚠️ the push AUTO-DEPLOYED the whole backlog — ⚠️ RESOLVED: migrations applied + verified same night (see entry above)

**Written by the Dynasty agent (cross-repo session, Christian directing).**

- **Software OPS is LIVE on usevantus.com** (commits `d186295`, `2326c28`, `260c4b1`).
  Admin-only nav section: client grid (Dynasty live + 2 standby slots) → the
  Dynasty pipeline's four ops pages inside Vantus, via a new `/api/dynasty`
  proxy (`netlify/functions/dynasty.js`: requireUser admin + rate limit +
  action allowlist → dynasty-lead-finder with `x-passcode` from env
  `DYNASTY_ADMIN_PASSCODE`/`DYNASTY_API_BASE`, set in Netlify UI). Pages in
  `src/ui/dynasty/*`, styles scoped `.dynops`, grid in `SoftwareOpsRoute.jsx`
  (registry-driven). Gate = `isOpsAdmin` (role admin OR ADMIN_EMAILS) — do NOT
  simplify to `role==="admin"`; profiles.role overrides cz@ to "agency".
  The standalone center (cloudscenic-ops-center.netlify.app) stays deployed in
  parallel; dynasty-leads repo untouched. Dynasty audit rows from Vantus show
  actor "Admin" (break-glass) — known tradeoff.
- **⚠️ THE PUSH SHIPPED EVERYTHING MAIN WAS HOLDING.** Christian ordered
  "merge it to vantus"; pushes are now KEYLESS (SSH key on czcloudscenic +
  global insteadOf — the one-shot-PAT era is over, update all assumptions),
  and Netlify auto-deploy is ON. So `260c4b1` took the 7/9–7/13 held commits,
  the Codex agent-action split, AND the M0–M7 feature pack live — **the ⛔
  migration gate above is now live-without-migrations.**
- **Exposure read (why this is survivable tonight):** every new email send
  site is Resend-key-guarded and the key is EMPTY → dry-run only, nothing can
  email clients. The portal branch is a security IMPROVEMENT (approved
  client_users no longer fall through to the admin shell). Approval/intake
  paths only 500 if someone exercises them before migrations. **Hard
  deadline: `check-stuck-items` cron fires 16:00 UTC (9am PT) daily** and
  will hit missing tables.
- **DO FIRST NEXT SESSION (or Christian tonight): apply the migration bundle**
  — `/tmp/vantus-m0-migrations-2026-07-29.sql` (19.8KB, additive+idempotent,
  already staged for TextEdit paste into Supabase). After that, the deployed
  state is fully supported and M8 regression can proceed as written below.
  Rollback alternative (loses Software OPS too): restore the prior production
  deploy in the Netlify UI.
- Coordination note: two agents committed to this repo today (this terminal's
  M-pack sweeps absorbed the dynasty.js dev-scrub mid-flight; reconciled).
  `git pull` before committing, and stop assuming pushes are blocked on PATs.

## 2026-07-29 session — Timeliner-inspired feature pack (7 milestones — SUPERSEDED: deployed by the late session, migrations applied + verified in the night session above; architecture facts below remain current)

**Built the full 6-feature pack on localhost per the approved plan** (`~/.claude/plans/lets-plan-to-make-rippling-petal.md`): client approval portal + one-click email approvals, timestamped video review comments, revision caps, stuck-item bottleneck cron, per-client margin view, public intake form. Commits `46c4d6b` (M0) → `0073f13` (M7), interleaved cleanly with the other terminal's Dynasty module (`2326c28`, `d186295`). **Nothing pushed, nothing deployed. Localhost only.**

**⛔ GATE — Christian must apply the migration bundle before ANY of this deploys or is browser-tested:** 7 additive+idempotent files `supabase/migrations/20260729_*.sql`, combined paste-ready at `/tmp/vantus-m0-migrations-2026-07-29.sql` (opened in TextEdit). Adds: approval_tokens (RLS, zero policies = service-key only), content_comments (+realtime publication), review-media storage bucket + `content_items.review_video_path`, `clients.included_revisions` + **revision-count trigger** (fixes the old race/bypass — approvals.js no longer bumps the counter itself) + `content_items.updated_at` touch trigger, stuck_alert_state, `team_members.monthly_cost`, `clients.intake_token` + intake_requests.

**Key architecture facts for pickup:**
- `/api/approval` (`approval-decision.js`): GET = confirm page ONLY (email-scanner-safe), POST = execute (single-use token, siblings invalidated) or portal-session mode. All writes via SERVICE_KEY because approvals INSERT is admin-only RLS. Emits the SAME notify type + cycle-aware dedupe_key as the App.jsx realtime detector — first writer wins, no double fan-out.
- Approval-request emails fire via notify type `approval_requested` (from handleSave + the realtime detector) when a `approval_mode='client'` item ENTERS Need Copy/Content Approval; `_lib/approvalRequest.js` issues the two tokens + emails `clients.primary_email`. **Every new send site is Resend-key-guarded (dry-run logs when keyless)** — tokens still get created, so the flow tests end-to-end without the key.
- Portal: App.jsx now has the missing `role==='client'` branch → `src/ui/client/ClientPortal.jsx` (approved clients used to fall through to the FULL ADMIN SHELL with only RLS scoping them — closed).
- Review video lives in the `review-media` bucket (public-read, unguessable paths) because Drive can't serve first-party video (webViewLink=HTML page, /preview iframe CSP-blocked + no currentTime). `ReviewPanel.jsx` is shared by EditContentModal + portal.
- `check-stuck-items` cron (16:00 UTC): per-status thresholds on `updated_at`, auto Unstick tasks, re-sends client approval links as the nudge. Dry-run verified live — correctly flagged the QC Test Kitchen leftover ("TEST-QC price check", 25d stuck).
- `chase-overdue-tasks` finally got an invocation gate (was publicly invocable!), a working dedupe_key, and client_id (its bell rows never rendered before).
- requireUser now allows localhost origins ONLY when `CONTEXT !== 'production'` (netlify dev testing).
- Intake: `/intake?t=<per-client token>` static page (CSP-safe external css/js) → staged `intake_requests` → Operations → Intake tab promote/dismiss. Setup Section 1 has copy/rotate link buttons.

**Remaining before deploy (M8):** (1) Christian applies migrations; (2) browser-test the portal end-to-end with a non-@cloudscenic Google identity approved in client_users against a disposable test client; (3) once the real Resend key is pasted, render-check the 5 new email templates (all in/via `_lib/emailTemplates.js`); (4) full regression (admin login, Ledger approve/revise, crons `?test=1`); (5) deploy via `netlify deploy --build --prod` (site still on the free team). The 7/18 board (empty Stripe/Resend keys, rogue env var, OAuth origin, team transfer) is UNCHANGED and still gates the integrations.

---

## 2026-07-18 session — env re-audit (keys now EMPTY not malformed), agent-action.js monolith split (Codex, reviewed+merged)

**Nothing pushed, nothing deployed.** `main` is now **18 commits ahead of `origin`** (9 held from 7/9–7/13 + this session's board doc + Codex's 9-commit refactor). All builds clean. Everything ships the moment a one-shot PAT arrives.

**🔑 Live env re-audited today — state CHANGED since 7/12.** Re-checked the linked Netlify env (names + length/prefix only; value reads are classifier-blocked, as intended). The three integrations the 7/12 sprint found *malformed* are now **empty** — someone cleared the bad values but never pasted good ones, so all three are still dead:
- `STRIPE_SECRET_KEY` → **empty** (was bad 20/64-char). Billing "Create & send" still errors.
- `STRIPE_WEBHOOK_SECRET` → **empty**. Paid-sync can't verify signatures.
- `RESEND_API_KEY` → **empty** (was bad 20-char). All email still dead.
- Rogue var **named** `re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH` → **STILL PRESENT** (now empty-valued). Its NAME is a burned Resend key visible in every env listing = compromised. Delete the var + revoke that key in Resend.
- Healthy: `SUPABASE_SERVICE_KEY` is the new `sb_…` format (len 41); Anthropic/Slack/Tavily/Apify/Meta/TikTok/YT/Google keys all present + correctly shaped. Full re-verified checklist is at the top of `VANTUS_TODO.md` (updated 7/18).

**🧱 agent-action.js monolith split — SHIPPED to `main` (local), reviewed byte-for-byte.** The Fix #4 handler-split (speced May, branch never merged) never landed and the file had grown to **1,750 lines**. Briefed Codex (`/tmp/codex-brief-agent-action-split.md`); it ran in its own worktree on `codex/grunt-2026-07-18`, split into a **158-line router** + `agent-action/_shared.js` + six agent modules (`handlers/{qc,muse,scrappy,sean,cid,ops}.js`), 9 incremental commits.
- **Reviewed, not trusted:** line-level multiset diff of the original vs the split = **zero original logic lines lost** (only import/export boilerplate added); all **16 action cases route** with exact original signatures; `node --check` + router load-smoke + `npm run build` all green; scope confined to the 7 new files + CODEX_NOTES.
- **Gotcha worth keeping:** `npm run build` (Vite) only bundles `src/` — it does **NOT** touch `netlify/functions/`, so a green build proves nothing about a function refactor. Verify functions with `node --check` + a `require()` load smoke test instead. The brief carried this; future function-refactor briefs must too.
- Fast-forward merged (preserves the 9 granular commits for bisect); worktree removed.

**Next clean Codex target (not started):** App.jsx → hooks state extraction (1,444 lines, no `src/hooks/` yet). Riskier than the agent-action split — it *can* change behavior — so write a state-cluster map prep first before handing it off.

**Christian's ~15-min console session still clears the whole board** (full checklist in `VANTUS_TODO.md`): paste real Stripe (x2) + Resend keys; delete the rogue Resend var + revoke it; register `https://usevantus.com` as a Google OAuth JS origin; transfer usevantus.com → Cloud Scenic Pro team (unblocks auto-deploy); flip Gemini billing; rotate Supabase passwords; revoke the old exposed PAT; hand over one PAT → push the 18 held commits.

---

## 2026-07-09 session — runway work pushed + shipped, Netlify deploy failure root-caused (wrong team), repo cleanup

**Live state:** the 3 runway/handoff commits (`4e9260e` drought detection + Mon/Fri digests + Slack fix + Danny-on-emails, `ed263c1` Sprout last-post signals, `7787d05` 7/8 handoff) were **pushed to `origin/main` + deployed live** to usevantus.com this session. Runway drought work is now in production.

**🔴 Netlify auto-deploy is BLOCKED — root cause found (not a code bug, not a failed card):**
- A git-triggered deploy (commit `ed9c2f1`) failed with **"Skipped due to account credit usage exceeded."** Netlify skipped the build entirely — never compiled.
- Diagnosed via Netlify API: **usevantus.com lives on the free Personal team `cz-mwalysu`, NOT the Cloud Scenic Pro team.** `payment_failed: None` on both teams. Build minutes barely used (6 of the period) → the tripped cap is **bandwidth/usage**, and the Personal plan has `block_builds_when_usage_exceeded: true`, which hard-blocks git builds.
- **The real fix = transfer the site to the Cloud Scenic Pro team** (`cloudscenic`, billed dv@) — already paid, higher limits, won't hard-block. Netlify → site → Site config → General → Danger zone → **Transfer site**. Upgrading the free team is the fallback.
- **Workaround that WORKS meanwhile:** `netlify deploy --build --prod` — builds locally on the Mac (~6s) and uploads the artifact, bypassing Netlify's build infra entirely. That's how the runway work got live this session. Use it for every deploy until the team transfer is done.

**Repo cleanup (2 commits sitting LOCAL, NOT pushed — deliberately held):**
- `a9e273e` — **untracked `.netlify/functions/manifest.json`** (`git rm --cached`). It was committed before the `.gitignore:8 .netlify/` rule, so it showed dirty every session from a regenerated build timestamp. Now silenced.
- `9a8727c` — **`VANTUS_TODO.md` 7/9 three-lane action queue** (Claude Code / Codex / Christian) + the Netlify diagnosis, at the top of the file.
- **Holding the push on purpose:** these are pure housekeeping (zero runtime impact — the live site already has everything). Pushing now would just trigger another failed Netlify build + need a fresh PAT. Push them with the next real deploy AFTER the team transfer, so they build clean. (Local `origin/main` tracking ref reads "ahead 5" because the earlier push went to an explicit PAT URL, which doesn't update the ref — true state is 4 on remote, 2 pending.)

**🔒 Rogue Resend secret — now fully identified (still Christian's to rotate):** the rogue env var's **NAME is literally a live Resend key** — `re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH` — pasted into the name field instead of the value. Env var names aren't masked, so the key is **exposed in plaintext = compromised.** Delete that var in Netlify **and rotate the key in Resend** (revoke `re_jEHHfr94…` at resend.com/api-keys, generate new, set as the *value* of `RESEND_API_KEY`), then redeploy. The correct `RESEND_API_KEY` var also exists — leave it, just update its value.

**Open items — the honest triage (everything real is Christian's, ~20–35 min solo):**
1. **Transfer usevantus.com → Cloud Scenic Pro team** (unblocks auto-deploy). 3–5 min.
2. **Delete rogue var + rotate Resend key** (security). 5–8 min.
3. **Flip Gemini billing** in AI Studio → revives all 7 VL generators (429 quota). 5–15 min.
4. **Revoke the GitHub PAT** exposed in this session's chat. 1 min.
5. Connect per-client social OAuth (@DynastyStaffing / @Parlor.Bar / @Vital.Lyfe) — gated on client logins, not on Christian's time.
6. Enter real retainer numbers (replace Dynasty $20k / Parlour $2k / VitalLyfe $8k placeholders).
7. Data check: any "no client email" warning → set that client's `primary_email` (code is correct; it's a data gap — Parlour Bar is the known one).
- **Codex has nothing real here.** The only candidate (email-warning hardening) is unnecessary — code already reads `primary_email` correctly and the mailer already falls back to owner + Slack notice.

---

## 2026-07-08 session — Creative OS handoff processed: email "bug" root-caused (non-bug), rogue secret found

**No code changes. NOT pushed: `4e9260e` + `ed263c1` (runway drought detection + Sprout last-post signals) still await Christian's push.**

**Context:** the Creative OS agent's 7/7 live cleanup (3 ghost clients archived → 5 active book, placeholder retainers Dynasty $20k / Parlour $2k / VitalLyfe $8k, 3/3 team roster, Facts of Record 4/5, Dynasty report recipient saved) handed over 3 items. Full handoff kit filed at `~/Desktop/Software builds/CS_CreativeOS_ChrisKit_v1/` (read its `CHRIS_HANDOFF.md`).

**Item 2 CLOSED — "Setup shows no-client-email for Dynasty" is a NON-BUG, do not "fix" it:**
- Verified end-to-end: warning (`FactsAndReports.jsx:246`), data source (`App.jsx` `select("*")` — confirmed present in the LIVE bundle downloaded from usevantus.com), and mailer (`send-monthly-reports.js:136` → `c.primary_email || OWNER_EMAIL`) all read the same correct column `clients.primary_email`.
- DB queried via service key: dynasty row HAS `hello@dynastystaffusa.com`. The warning the auditor saw belongs to **Parlour Bar** (`primary_email` NULL, recurring lane) — the row below Dynasty. It's truthful. **Open data gap: Parlour Bar needs a real primary_email from Christian** (don't scrape a generic info@).
- Auto-send confirmed double-gated: every client's `report_schedule` is NULL (cron skips) AND per 7/3 the Resend-domain + placeholder-retainer blockers stand. Keep off until retainers are real.

**SECURITY — rogue secret in Netlify env:** a variable whose NAME is a raw Resend API key (`re_jEHHfr94_...`) exists alongside the real `RESEND_API_KEY`. No repo references. Deletion was permission-blocked twice in this harness; **Christian: run `npx netlify env:unset "re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH"` and rotate that key in Resend.**

**Still on Christian (from the handoff):** (1) Gemini billing toggle in AI Studio — VL portal's `gemini-proxy` returns 429, blocks all 7 generators; account action, Danny's card. (2) Social OAuth connects in Setup for @DynastyStaffing / @Parlor.Bar / @Vital.Lyfe; the 3 cloud.scenic agency accounts stay Unassigned on purpose. Chrome extension wasn't connected this session, so neither guided browser task ran.

**Schema note worth keeping:** two Supabase projects by design — `wjcstqqihtebkpyuacop` = Vantus (app), `wbryunphevoixgjalcvx` = VitalLyfe generator context (`brand-context.js`). Don't cross-wire.

---

## 2026-07-03 session — full test campaign (27/31), config fixes, data wipe, Client Vault

**All pushed + deployed; migration `20260703_client_vault.sql` applied by Christian.** Latest on `main`: `8e5c002` + this handoff commit.

**Test campaign (results annotated in `TESTING-2026-07-02.md`):** 27/31 pass. The whole QC section is green INCLUDING A9 vision — a flyer with a wrong on-asset price ($8.99 vs $13.99 of record, caption clean) came back blocked citing on-asset. Demo-ready for Danny. Remaining: C4 (cron send fires 13:00 UTC 7/4 — dummy June report queued for "QC Test Kitchen", goes to cz@), C5 covered by design, D5 mobile pass deferred (`/mobile-audit`).

**Two prod configs were silently broken and got fixed by Christian mid-session:**
- Google OAuth `origin_mismatch` — usevantus.com wasn't an Authorized JS Origin for the Drive client (lives in GCloud project "Vital Lyfe War Room", number 458336864067). **Drive upload had NEVER worked in prod** (zero items ever had files). Fixed → upload + QC vision proven.
- Resend domain — cloudscenic.com wasn't verified, so ALL email (reports/invoices/notifies/chase) was still dead despite the 7/2 API-key fix. Verified → C3 + D3 (invoice email) pass. `CRON_TEST_KEY` now set + enforced (keyless ?test=1 refuses).

**Bugs found by testing, fixed + deployed:** (1) manual "+ Add" item creation NEVER persisted — modal sent camelCase `seoKeywords`/`startWeek`, PostgREST rejected the whole insert (PGRST204); (2) realtime INSERT echo doubled client/item cards vs optimistic appends; (3) approval Slack notifications double-fired (recordApproval + the per-tab realtime detector) — notify.js now honors the (type,content_item_id) dedupe before Slack/email/n8n.

**Data wipe (Christian-approved):** 13 seed content items + 5 placeholder team members deleted from prod; dashboard OpsBoard demo tasks emptied and its fake task-motion timers + the agent-count jitter removed (the board was pure theater — not DB-backed).

**NEW: Client Vault** (FINANCE → Vault, `src/ui/routes/VaultRoute.jsx`): per-client billing profile (legal name, contact, email, phone, address/ZIP, tax id, notes) → `client_vault` table, admin-only RLS (portal + anon read zero). Card-on-file via Stripe Checkout **setup mode** (`vault_link`/`vault_sync` actions in `billing-stripe.js`): card is typed on Stripe's hosted page, Stripe vaults it, Vantus stores only brand/last4/expiry + ids and sets the customer default PM. **Never store raw card numbers — this design is deliberate (PCI).** Smoke-tested live: save works, checkout.stripe.com session returns.

**Cleanup owed (next session):** after the 7/4 cron send lands, archive "QC Test Kitchen" (id `4bf5e953…`), delete its test item `qc-test-kitchen-a1-price`, its client_vault row, the dummy `client_reports` row/PDF, and the test flyer in Drive. Note: a live-mode Stripe customer was created for the test client (harmless, no charges).

---

## 2026-07-02 session — QC Agent + Facts of Record + monthly report auto-email (Danny's spec)

**Built from Danny's spec package (`vantus-spec-for-chris.zip`, Counsel has it at scratchpad + the 4-item build order). All four items committed locally on `main` — NOT pushed yet.** Commits: `e59dea2` (schema), `e35a933` (QC agent), `cb90bc4` (Setup sections), `4864c8f` (report cron).

**Before this deploys, two manual steps (in order):**
1. **Apply `supabase/migrations/20260702_qc_facts_reports.sql` in the Supabase SQL editor** (adds qc_* to content_items, client_facts/report_schedule to clients, client_reports table + private `client-reports` bucket, and seeds Dynasty/Parlour/Vital Lyfe config per the spec). App code tolerates the columns missing, but QC runs will fail until applied.
2. Push `main` (founder PAT) → Netlify auto-deploys the new/changed functions.

**What shipped:**
- **QC Agent (spec priority 1):** `qc_review` action in `agent-action.js`. Hybrid gate: Claude sonnet **vision** (new `aiVision` helper) reviews facts/copy/brand + extracts on-asset text from the Google Drive assets; deterministic code exact-matches prices, phone numbers, and offer validity windows (expired offer = auto-blocker). Auto-runs when an item enters "Need Content Approval" (hook in `App.jsx handleSave`); manual "Run QC" button in the Ledger row panel. `qc_status` is a **parallel field** (not a new pipeline status): blocked items can't be Approved at the content gate, can't move to Ready For Schedule/Scheduled (hard SOP gate in EditContentModal), can't be Marked Posted. Videos are NOT frame-checked in v1 (no ffmpeg in functions) — caption+facts checked, warning emitted; fast-follow.
- **Facts of Record (priority 2):** Setup section 5 — per-client hours/locations/prices/offers/operational-facts editor → `clients.client_facts` JSONB, stamps `facts_updated_at`, amber staleness badge >30d, and QC injects a stale-facts warning into every result. No facts on file → QC runs typo/brand only + says so. Owner: Sebastian (data entry pending him).
- **Monthly report auto-email (priority 3):** semi-auto Sprout path (Christian's call — no Sprout API). Setup section 6: drop the month's PDF per client → private `client-reports` bucket + `client_reports` row; `send-monthly-reports` cron (daily 13:00 UTC) emails any unsent completed-month report to `clients.primary_email` with PDF attached, stamps sent_at, Slack+bell, and **nags from the 28th** if the PDF is missing. Test path: `?test=1&key=<CRON_TEST_KEY>` sends to OPS_OWNER without marking. Optional env: `CRON_TEST_KEY`.
- **Per-client config (priority 4):** seeded in the migration (Dynasty 2/day Mon-Fri + monthly_1st report; Parlour 2 videos + 2 flyers/wk pre-approved; Vital Lyfe brief-lane full approval). Rest is Setup-UI data entry.
- Side fix: clients query in App.jsx widened to `select *` — Setup previously read retainer/scope blanks on first load because the narrow column list omitted them.

**Verify after deploy:** create a test item with a Drive image + a wrong price vs facts → move to Need Content Approval → expect qc blocked + the issue naming the price; fix → Run QC → pass. Then `send-monthly-reports?test=1` with a dummy PDF uploaded.

---

## 2026-07-01 session — fulfillment OS complete, Stripe wired, big cleanup

**Current board lives in `VANTUS_TODO.md` (rewritten this session, read it first).** Everything below is pushed and live; last commit on `main` is `0a01e23`.

**What Vantus is now:** the agency fulfillment + billing OS (multi-tenant client book), not a single-client dashboard. The generator side is pre-production (Idea Engine, agents, Pipeline); the fulfillment side is delivery, approvals, and billing. Live nav: Dashboard, Clients, Setup, Ledger, Reports, Client Analytics, Operations, Agents, Idea Engine, Pipeline, Billing. Agent team is Sean / Muse / Scrappy.

**Shipped + pushed this session:**
- P1: overdue-task chase cron (`chase-overdue-tasks`), MRR trend chart, invoice-sent email.
- **Setup** data-entry page (retainers/scope, connected-account to client mapping, bulk owner + due-date, team roster edit).
- Owner-assign: migration `20260701_assigned_to_team_members.sql` (assigned_to FK repointed to team_members), applied by Christian.
- **Stripe wiring** (`billing-stripe.js`): create hosted invoice on send + webhook paid-sync. Secrets `STRIPE_SECRET_KEY` (live restricted key `rk_live_`) + `STRIPE_WEBHOOK_SECRET` set in Netlify, live webhook endpoint created (invoice.paid/voided/marked_uncollectible). Verified wired (webhook returns sig-fail not 501). Create-path NOT yet proven with a real invoice (test skipped). Each client needs `primary_email`.
- Codex perf merge: code-split + null-guard sweep + route-chunk prefetch (bundle 744KB to ~531KB, nav stays instant).
- Cleanup: removed 6 pages (Ad ROI Hub, References, ArtGrid, Cost Governance, Ideal Customer, Competitor Intel) + Analytics (extracted to `ripped out features/analytics-page/`). Removed the Artgrid agent everywhere. Deleted `tools/`. Deleted the parked ripped-out code (agents/apps/client-view/routes + working-ripped-out), keeping only analytics-page. Docs refreshed. `npm audit` clean.

**Open / parked (revisit later):**
- P0 data entry on the Setup page (retainers, account-to-client mappings, owners + due dates, real team roster). Pages read light until entered.
- **Danny update email** drafted (framing: generator = pre-production, fulfillment = delivery/billing, no more Monday.com; no em-dashes per Christian). Not sent.
- **Analytics live-data** (weekend job): plan at `ripped out features/analytics-page/LIVE-DATA-PLAN.md`. Key: the SMM-agent "reuse its IG pull" shortcut is a dead end (backbone only). Real reuse = Vantus's own `sync-instagram.js` + `oauth-instagram-*` + Meta app. Two routes (share Vantus Supabase, or port to a Supabase Edge Function). Seed a test row first.
- Other parked builds: ClientView self-approval portal (old code was deleted but recoverable from git), Unified Inbox, Template Engine, auto-posting, in-page customization design.

**Guardrails unchanged:** founder pushes `main` (one-shot PAT; shell can't reach keychain); migrations via Supabase SQL editor; `git fetch` before commit (shared repo); Codex runs in its OWN worktree (a shared-dir collision happened this session, never let it check out the live folder).

---

# Vantus Handoff Brief — 2026-06-04 (9-item package: speed shipped, #3 reunited, #10 planned)

## 2026-06-04 session — the "9-item package" push

**Canonical list lives in `VANTUS_TODO.md`** (repo root) — that's the running board, status-keyed. This handoff is the narrative; the TODO is the source of truth. Read it first on pickup.

### 📋 9-item package status (6 shipped, 4 left)
| # | Item | Status |
|---|------|--------|
| 1 | Refresh holds your page, doesn't sign you out | ✅ live |
| 7 | Analytics + Ad ROI Hub moved under "Content" nav | ✅ live |
| 8 | Team Broadcast page killed; button moved under Scrappy in Agents | ✅ live |
| 6 (part) | Login water-video removed | ✅ live |
| 4 | Generation speed 28–30s → 10–15s | ✅ **shipped this session** (`70dcd29`) |
| 3 | Analytics "why it won/lost" (Opus) | ✅ **committed & live this session** (`6cb248b`) |
| 9 | Admin page (user count + feedback) | 🗓️ queued for Codex next burst |
| 10 | Virality Checker (pre-publish gate) | 🟢 **ours, started — planning** |
| 6 | Multi-tenant data isolation (agency seats + self-serve) | 🟡 blocked — needs design pass |
| 2 | Per-client OAuth | 🟡 blocked behind #6 |
| 5 | Ad ROI Hub (Meta + static-ad gen) | 🟡 blocked — no Meta connection exists |

### 🚀 #4 — Generation speed (SHIPPED, live)
- Built by Codex on its worktree, reviewed by me line-by-line, pushed to `main` (`52bdea3..70dcd29`).
- Worst offenders fixed: `muse_ig_ideas` and `scrappy_muse_collab` (both 22–30s) → ~10–15s. Method: parallelized fetches (`Promise.all`), Tavily `advanced`→`basic`, `muse_ig_ideas` Opus→**Sonnet**, single-pass collab (raw Tavily data → ideas, *better* grounding), trimmed token caps. Shared `scrappySearchContext` + `_researchDigest` dedup.
- Bonus Codex added: real timing logs — `[agent-action] {action} completed in {ms}ms` in Netlify function logs (so "estimated" numbers become measurable).
- ⚠️ **Spot-check still owed:** the `muse_ig_ideas` Opus→Sonnet quality on a real Idea Engine run. Founder said they'd eyeball it.

### 🔧 #3 — "why it won/lost" (REUNITED + live) — the gotcha to remember
- The #3 work (Opus winner/loser contrast + `lossReasons` "why it lost" in `scrappy_analyze_performance` + `AnalyticsRoute.jsx` Bottom Performers section) had been **deployed-from-local-tree but never committed.**
- Pushing Codex's #4 branch (built off the older commit) auto-deployed and **briefly reverted #3 on prod.** Caught it, committed #3 (`fce3c0f`), **rebased it onto #4** (`6cb248b`) — clean, non-overlapping (#4 never touched `scrappy_analyze_performance`), built green, pushed. #3 now reunited with #4 and in history.
- **Lesson:** the Desktop repo and Codex's `/private/tmp/vantus-grunt-2026-06-04` are **linked git worktrees sharing one object store** — Codex commits are reachable from Desktop by SHA without a fetch. Don't push a branch that's behind local uncommitted work without reconciling first.
- 🔜 #3's win/lose is still slated to eventually **migrate into #10's gate** (where the model can actually see the content). It's safe and shipped for now.

### 🗓️ #9 — Admin page (queued for Codex)
- Was ~80% done before a burst-cancel (`admin-stats.js` + `netlify.toml` redirect written on the throwaway branch, **nothing merged**, that branch had its feedback migration reverted out so #4's net diff stayed clean).
- Re-hand on a **fresh burst** — brief at `/tmp/codex_brief_speed_admin.md` (the #9 half). Standalone #4 brief also saved at `/tmp/codex_brief_4_speed.md` (already shipped, keep for reference).
- Codex burst was nearly spent (`<20%` of 5h, resets ~08:21). Hand it ONE finite task per burst; don't let the speed-audit type work finish on the downgraded mini model.

### 🧭 #10 — Virality Checker (STARTED — planning, this is the next build)
**Concept:** a pre-publish gate — run content through it *before* posting; the model actually watches the whole video (you hold the file at that moment, so no gated-link/scraper wall). It's the final gate before content goes out.
**Architecture decision made:** build the brain on **Gemini alone, all platforms** — YouTube by URL (native), IG/TikTok by file-upload at the gate (Gemini Files API). Gemini gives the **semantic "why"** ("body sags at 0:15, hook works because of the close-up") which is what the founder wants. **Dropped Higgsfield as a dependency** (its MCP is session-only, not usable by the deployed app, and dev-API availability is uncertain) — keep Higgsfield's virality *score* as an optional later layer only.
**The loop (why it matters):** the gate IS the DNA harvester — every check is a real, legit, fully-analyzed piece of the user's content. Store that DNA → feed the **Idea Engine** so it generates grounded ideas. Pair each gate analysis with the metrics that roll in later → revives a *real* "why it won."
**Build slices:**
1. Scaffold (no key) — Virality Checker page + nav item + route, DNA-store table/migration, analysis-function skeleton.
2. Wire Gemini — URL for YouTube, upload for IG/TikTok → verdict. **Needs `GEMINI_API_KEY`.**
3. DNA harvest → Idea Engine feed.
4. Pair gate analysis + later metrics → real "why it won."
**⛔ UNBLOCK NEEDED:** founder grabs a free Gemini key at https://aistudio.google.com/apikey → set as `GEMINI_API_KEY` in Netlify. Slice 1 (scaffold) can start without it.

### 🚢 Git / deploy state
- `main` is at **`6cb248b`** (= #4 speed + #3 reunited), live on prod via auto-deploy.
- Pushes this session via one-shot GitHub PATs (shell can't reach keychain — [[project_vantus_push_auth]]). **Both tokens should be revoked** (reminded founder). Always `git fetch` + verify fast-forward before pushing — Counsel tab may push to `main` too ([[project_vantus_counsel_workflow]]).
- `VANTUS_TODO.md` is **untracked** (not committed) — it's the working list; commit it if you want it versioned.

### 📌 Pickup queue (in order)
1. **Spot-check Idea Engine** quality (`muse_ig_ideas`, Opus→Sonnet) on a live run.
2. **#10 slice 1** — scaffold the Virality Checker (page + nav + route + DNA-store migration + function skeleton). No key needed.
3. **Grab the Gemini key** → #10 slice 2 (wire the real gate).
4. **Re-hand #9** to Codex on a fresh burst (`/tmp/codex_brief_speed_admin.md`).
5. When ready for the next epic: **#6 multi-tenant design session** (unblocks #2).

---

# Vantus Handoff Brief — 2026-06-02 (YouTube OAuth live + Scrappy performance analysis)

## 2026-06-02 session — YouTube connected, analytics cards restyled, "why it won" analysis

**Why:** First real step of the self-serve analyzer pivot — get a second platform (YouTube) syncing real account data, then start turning that synced data into insight. Connected **Cloud Scenic's own YouTube channel** as the working test account.

### 🎥 YouTube OAuth — shipped & live
- Created a Google Cloud OAuth client (Web app) **separate from Supabase's Google sign-in client** so the consent screen is YouTube-access, not login. Enabled **YouTube Data API v3** + **YouTube Analytics API**; scopes `youtube.readonly` + `yt-analytics.readonly`; redirect `https://usevantus.com/api/oauth/youtube/callback`.
- Set the three Netlify env vars via CLI: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YT_REDIRECT_URI`. (`SUPABASE_URL` / `SUPABASE_SERVICE_KEY` already present.)
- Confirmed `20260601_connected_accounts.sql` was **already applied to prod** (a "policy already exists" error on re-run proved the tables/RLS exist).
- **Connected Cloud Scenic's channel + synced** — videos flowing into `account_posts`.
- ⚠️ OAuth consent screen is in **Testing** mode: only test-user accounts can connect, and refresh tokens expire after 7 days. Publish (and likely Google verification for the readonly scopes) before opening it to other users.
- To connect a brand/business YouTube: sign in as the Google account that **manages** the channel, then pick it in the brand picker — `channels?mine=true` resolves to whatever the authorizing account selects.

### 🎨 Analytics card display — restyled
- Top Performer thumbnails now use **per-platform aspect ratios**: YouTube `16:9`, TikTok `9:16`, Instagram/other `1:1` (`AnalyticsRoute.jsx`, was hardcoded `1:1`).
- Enlarged cards: grid min-width 180px → **280px** + scaled-up card text/metrics.
- Generic connect-toast handler in `ConnectedAccountsCard.jsx` — `youtube_connected` / `tiktok_connected` (+ `*_oauth_error`) params now surface a toast and clean the URL, not just Instagram's.

### 📊 Scrappy performance analysis — built (NEEDS TUNING)
- New agent action **`scrappy_analyze_performance`** (`agent-action.js`): reads synced `account_posts`, groups by platform, computes each platform's **median engagement** as baseline, takes top 6, asks Claude (Haiku) for **per-post "why it won" reasons + 3–5 aggregate patterns**. Per-platform because drivers differ. Returns `{ insights, reasons }`.
- `AnalyticsRoute.jsx`: **"✨ Why these won"** button, **Performance Insights** panel (patterns per platform), and a **"Why it won"** line on each Top Performer card (keyed by `reasons[post.id]`).
- 🐛 **KNOWN BUG (tomorrow's first fix):** the analysis surfaces reasons across multiple posts and leans on raw view-count; it should be scoped to the true **top performer(s)** and rank by the right metric. Founder flagged it; output otherwise works.

### 🚢 Deploy / git state
- Founder authorized overriding the "agent never pushes" rule for this session. Deploys done via `netlify deploy --build --prod` (direct, not git-triggered). Pushes via one-shot GitHub PAT (this shell can't reach the keychain — see [[project_vantus_push_auth]]).
- Pushed to `main`: `33516c4` (aspect ratios + toasts), `62afc21` (bigger cards).
- ⚠️ **`44b55a5` (Scrappy analysis) is committed locally + live on prod, but NOT pushed to `main`.** Push it first thing tomorrow (fresh PAT) before any Counsel/Codex push rebuilds prod from git and drops it.

### 📌 Tomorrow's queue
1. **Push `44b55a5`** to sync git ← do before anything else
2. **Fix "Why these won" scoping** (top performer(s) only; correct ranking metric)
3. **Wire Muse to synced content** — `muse_ig_ideas` reads `account_posts` top performers + caption themes, generates grounded ideas + fills the `script` field (Instagram-first, on-demand button, daily n8n cron later). Deferred today.
4. **Performance pages** — recommendations layer built on top of the Scrappy analysis.

---

# Vantus Handoff Brief — 2026-06-01 (post-rip pass + IG-analyzer pivot prep)

## 2026-06-01 session — Major rip + de-hardcoding pass

**Why:** The original Vantus premise was "log in to your IG/TT/YT/LinkedIn accounts, have AI analyze your analytics and generate better content ideas." The actual built app drifted into a VitalLyfe-specific content-ops dashboard. This session ripped the agency-shaped weight and de-VitalLyfe'd everything so the codebase is ready for the self-serve IG OAuth pivot.

### Ripped (preserved under `ripped out features/`)
- **Apps:** Brief → Content (brief-gen), Shot Reference, Hero Generator
- **Agents:** Lacey (Runner), Ali (Developer), Sam (Monitor), Overseer (SOP Guardian) — kept Sean, Muse, Scrappy, Artgrid
- **Routes:** TrackerRoute (redundant), TaskboardRoute (empty ops theater), SopsRoute (VitalLyfe 7-step SOP)
- **External-client portal:** `ClientView.jsx` (1,298 lines) + preview-mode overlay + 2 "Client View" trigger buttons + `seed.content.js` (VITAL_LYFE_SOP). Approved external clients now route to the main app — RLS already scopes them per `client_id`.

Backups: `ripped out features/{apps,agents,routes,client-view}/` + `working ripped out features/` (full pre-rip production build snapshot for fallback).

### De-hardcoded
Anything VitalLyfe-specific now flows through `clients.brand_voice_md` at request time, parsed into a `brand.pillars` array via new `parsePillars()` helper in `agent-action.js`:
- `muse_ig_ideas` + `muse_generate_calendar` + `scrappy_research` — pillars/voice come from client context, not hardcoded
- `notify.js` email + Slack branding — pulls `clients.name` per call ("Cloud Scenic × {client}" / "{client} Vantus"), falls back to "Vantus"
- `ContentRoute` IG/TT/YT subtitles — pull `currentClient.ig_handle / slug / name`
- `LoginScreen` tagline — "VitalLyfe Content Operations" → "Content Operations Dashboard"
- `CIDPage` AI prompt + ~10 UI labels — "VitalLyfe Adaptation/Version/Ready" → "Brand Adaptation/Version/Ready"
- `ArtgridScout` AI prompt — brand-agnostic, takes voice from context
- `AdROIHub` AI persona — generic Ad Analyst (was "Sam"). Seed campaigns + placeholder also generic.
- `constants.js` — `PILLARS_LIST` is generic placeholders, `CAMPAIGNS = []`
- `App.jsx` — Muse memory seed neutered, new-item template uses client slug
- `ICPPage` — `DEFAULT_CLIENTS = []` (was hardcoded VitalLyfe profile)
- `ReferencesPage` — `INITIAL_REFS = []` (was 4 Drip Campaign seeds)
- `seed.ops.js` — dead-agent task entries (Lacey/Ali/Overseer) stripped
- Various placeholders (`teammate@example.com`, `e.g. your brand name`, generic campaign examples)

Only residue: a single historical comment in `src/core/memory.js` about the long-removed `seedMuseMemory()`. Not live.

### Auth-lock fix (stuckGuard tightening)
**Bug:** Opening Vantus in a second tab kicked the user out of both. Cause: `stuckGuard` setTimeout in `App.jsx` fired unconditionally at 4s — even if `getSession()` resolved at 3.9s, the guard still wiped tokens and reloaded.
**Fix:** Cancel the guard the moment auth resolves (both `getSession().then()` and `onAuthStateChange`). Bumped timeout 4s → 8s for slow networks. Recovery still runs if auth genuinely hangs.

### Build delta
- Modules: 103 → 93
- JS bundle: 798KB → 628KB (~21% lighter)
- pdf-worker chunk (1.2MB): GONE (was used by ripped brief-gen)

### What still uses VitalLyfe as data (not behavior)
- The `clients` row for VitalLyfe in Supabase — still has `brand_voice_md` seeded from migration `20260526_seed_vitallyfe_brand_voice.sql`. Useful as the working test client.
- HANDOFF.md (this doc) still references it as the historical client.

### What the new "user" model looks like (next sprint)
Replace agency-style `clients` rows + invite allowlist with:
- IG/TT/YT/LinkedIn OAuth-per-user
- New `ig_accounts` (and sibling `tt_accounts`, etc.) tables: `user_id`, `account_id`, `access_token`, `handle`, `meta`
- Worker that pulls recent posts + insights (top performers, engagement, hashtags, themes)
- Retarget `muse_ig_ideas` to read user's top posts + caption themes, generate 5 ideas grounded in their actual account
- Add Higgsfield account linking (already stashed)
- Self-serve sign-up — kill the "pending approval" gate

---

# Vantus Handoff Brief — 2026-05-26 PM (evening — post 3-agent collab session)

## Project
Cloud Scenic × VitalLyfe "Vantus" — content operations dashboard.
**Live:** https://usevantus.com (Let's Encrypt SSL, Cloudflare-registered, Netlify-hosted)
**Fallback URL:** https://majestic-cassata-aa16e9.netlify.app (kept active)
**GitHub:** https://github.com/czcloudscenic/War-Room.git (auto-deploys on push to `main`)
**Internal name:** "warroom" (per `package.json` — kept for repo + Netlify subdomain consistency)

## Stack
- **Frontend:** React 19 + Vite 8 (Node 22 pinned via `.nvmrc` and `netlify.toml`). `src/App.jsx` now 1,342 lines (was 1,676 — Codex split out 6 route components into `src/ui/routes/` as Fix #2).
- **Backend:** Supabase (`wjcstqqihtebkpyuacop`) — tables: `content_items` (versioned), `profiles`, `cid_library` + `cid_performance` (real CID tables), `agent_events`, `notifications`, `clients`, `client_users`. (`cid_posts` was a phantom — never existed; migration + caller deleted 2026-05-26 PM.)
- **Netlify Functions:** `/api/chat`, `/api/agent-action`, `/api/notify`, `/api/apify-scrape`, `/api/unsplash` — plus shared helpers `_lib/requireUser.js` (auth + cors) and `_lib/rateLimit.js` (in-memory sliding window). (`/api/cid-scrape` removed 2026-05-26 PM — zero callers + queried phantom table. Higgsfield function is stashed.)
- **Anthropic models:** `claude-haiku-4-5-20251001` (server-side functions) + `claude-sonnet-4-6` (frontend /api/chat callers — bumped from retired `claude-sonnet-4-20250514` on 2026-05-26)
- **Workflows:** n8n cloud at `https://cloudscenic.app.n8n.cloud`, workflow "VitalLyfe Vantus — Content Sync" (ID `3WXHHEiMz9rMnBEn`) — published + live. Per-client routing via `clients.n8n_webhook_url` (Fix #7).

## Env Vars (Netlify, all set)
`ANTHROPIC_API_KEY` · `SUPABASE_SERVICE_KEY` · `SUPABASE_URL` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `TAVILY_API_KEY` · `N8N_WEBHOOK_URL` · `SLACK_WEBHOOK_URL` (global fallback) · `SLACK_BOT_TOKEN` · `RESEND_API_KEY`

(`CID_BEARER_TOKEN` deleted 2026-05-26 PM — orphaned after cid-scrape removal.)

## Current Nav (UI sidebar)
- **COMMAND:** Dashboard, Task Board, Agents, Competitor Intel, Ideal Customer
- **CONTENT:** Pipeline (unified Instagram/TikTok/YouTube with platform tabs), Production (was Content Tracker)
- **CREATIVE:** Higgsfield Studio *(nav only; component still untracked — see Dirty WIP)*
- **APPS:** Apps, Settings
  - Apps page lists toggleable modules: Brief → Content, ArtGrid Scout, Shot Reference, Hero Generator, Ad ROI Hub, Team Broadcast, References, Skills, SOPs, plus dormant ones

## Agent Actions (`netlify/functions/agent-action.js`)
muse_write_content · muse_from_brief · muse_generate_calendar · muse_save_calendar · muse_ig_ideas · overseer_scan · sean_briefing · lacey_advance · lacey_trigger_n8n · sam_health · artgrid_scout · scrappy_research · scrappy_muse_collab · scrappy_hook_analysis · cid_build_brief · cid_ab_variations

Every invocation writes one row to `agent_events` via SERVICE_KEY (success/error/skipped). **All calls now require an authenticated session** (via `requireUser`).

## Brain Trilogy Status
| Move | What | Status |
| --- | --- | --- |
| **1** — Cortex wiring | Per-client agent brand voice from `clients.brand_voice_md` | ✅ **Live 2026-05-26** (commit `767cb93`). `agent-action.js:94 getBrandContext(client_id)` reads `clients.brand_voice_md` per request; 12 prompt sites interpolate `${brand.name}` + `${brand.voice}`; dynamic `#${brand.name}` hashtags; dead `seedMuseMemory` removed. VitalLyfe seeded via `20260526_seed_vitallyfe_brand_voice.sql`. **Per-request voice override** also wired in `agent-action.js` (payload.voiceOverride replaces brand.voice for that call) + `AgentChatPage.jsx` exposes a textarea — useful for "try a punchier tone" runs. |
| **2** — `agent_events` | Real history of agent invocations | ✅ Live |
| **3** — Notifications persistence | Durable, deduped, realtime | ✅ Live |

**Brain trilogy complete.** Forward layer: Cortex wiki entries (`wiki/clients/<slug>/brand-voice.md`) push into `clients.brand_voice_md` via `scripts/sync-cortex.mjs` (stub exists, schema not finalized — don't create the directory until founder signs off on the convention).

## ✅ Security Posture (REWRITTEN 2026-05-26 PM — hardening sweep complete)

**Auth: live.** Four-way branch in `App.jsx setupSession()` (L72) — admin / approved external client / pending invite (realtime unlock) / unknown blocked.

**Function-level auth: live.** All 5 protected functions reject anon callers via `_lib/requireUser.js`. (cid-scrape.js was deleted 2026-05-26 PM in the closed-by-removal cleanup — was the only function on the legacy bearer-token pattern.)

**Email/password auth: DISABLED 2026-05-26 PM.** Supabase Auth → Providers → Email toggle flipped off. The admin password leaked in git history (pre-`9fb1e10` setup.js — literal redacted from docs 2026-07-12) is now genuinely inert — only Google OAuth remains for cz/dv/ss admin sign-in. Magic-link fallback also disabled (acceptable since Google is the intended path). Remaining: rotate the cz/dv/ss account passwords in the Supabase dashboard to fully retire the value.

**Client-side auth injection: live.** `src/services/apiFetch.js` attaches the access token on every protected call (26 sites). `AgentChatPage` now also passes `currentClient.id` as `client_id` so the backend resolves brand voice correctly (fixed 2026-05-26 — Move 1 was silently using fallback before this prop wiring).

**RLS posture:**
- Temp anon policies fully cleared. Admin policies (@cloudscenic.com email check) on every table.
- `client_users` — admins full r/w; approved clients read their own row(s); realtime enabled.
- `content_items` — admins full r/w; approved clients scoped SELECT+UPDATE to their `client_id` (via `EXISTS` subquery against `client_users`); INSERT/DELETE admin-only; legacy "Allow all for now" anon policy DROPPED (Fix #10.1, `20260526_content_items_client_rls.sql`). Anon REST probe with anon key now returns 0 rows.

**Security hardening sweep (Fix-batch shipped 2026-05-26 PM, commit `8e59968`):**
- **CORS** locked from `*` to allowlist regex via `_lib/requireUser.js cors(event)` — matches `usevantus.com` + `(deploy-preview-*--)?majestic-cassata-aa16e9.netlify.app`. All 6 functions rewritten. `Vary: Origin`.
- **Rate limits** via new `_lib/rateLimit.js` — in-memory sliding window keyed on `user.id:endpoint`. `/api/chat` 30/min, `/api/agent-action` 60/min. Cold starts reset (acceptable since auth+RLS are primary defense).
- **Headers** in `netlify.toml`: HSTS preload (1y, includeSubDomains, preload), Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo denied), tight CSP whitelisting only Anthropic + Supabase REST+WSS + Resend + Slack hooks + n8n cloud + Tavily + Apify + Unsplash images. `style-src 'unsafe-inline'` retained for inline-style React patterns (tighten when factored out — separate task).
- **Auth-lock contention** auto-recovers now (Fix #15). On stuckGuard fire: clears `sb-*-auth-token` localStorage keys, sets one-shot `sessionStorage` flag to prevent reload loops, then `location.reload()`. Manual `localStorage.clear() + reload` workaround retired.

**Remaining open security debt (low urgency):**
- `style-src 'unsafe-inline'` in CSP — required by current inline-style patterns. Tighten when inline styles get factored out.

(Password rotation debt closed 2026-05-26 PM — better fix than rotation: email/password auth provider disabled entirely. Password leak in git history is now inert.)

## Per-client Routing (all live as of 2026-05-26)
- **Slack:** `clients.slack_webhook_url` column. `notify.js` prefers it; falls back to global `SLACK_WEBHOOK_URL`. (Fix #6, commit `702f867`)
- **n8n:** `clients.n8n_webhook_url` column. `notify.js` reads it in the same Supabase fetch as Slack (one roundtrip pulls both); falls back to global env. (Fix #7, commit `2bb8958`)
- **Brand voice:** `clients.brand_voice_md` column. `agent-action.js getBrandContext(client_id)` reads it per request, passes to every handler. Per-request override via `payload.voiceOverride`. (Move 1 / Fix #3, commit `767cb93`)

## Dirty / Stashed WIP — CORRECTED 2026-07-12 (stash cleared)

**The stash is gone; this section previously misdescribed it.** `stash@{0}` ("pre-codex-fix2 wip") was inspected on 2026-07-12: it contained ONLY tracked changes — `public/portal.html` (1,920-line WIP diff), one-line edits to `src/apps/apps.config.js` + `src/utils/constants.js`, and `.netlify/` build noise. The untracked files earlier versions of this section listed (`HiggsfieldStudio.jsx`, `higgsfield.js`, `scripts/sync-cortex.mjs`, `.claude/` config) were **never in the stash** — plain `git stash` doesn't capture untracked files — and they no longer exist on disk or in any commit. That WIP is lost; treat any future Higgsfield Studio or sync-cortex work as a fresh build.

What survived is archived on branch **`archive/portal-html-wip-2026-05-26`** (the stash commit, unpopped). The stash itself was dropped. Re-evaluate portal.html from that branch only if the old client-portal page is ever wanted; it predates the React-side hardening.

`src/ui/layout/PasswordGate.jsx` from earlier HANDOFFs was never created (no git history, not in stash). Drop the mention if it comes up again.

## Session log

### 2026-05-26 PM — Move 1 sprint (9 fixes shipped + security sweep + Codex App.jsx split)

Massive session. Closed half the open punch-list in one afternoon.

| Commit | What |
| --- | --- |
| `767cb93` | `feat(brand)`: per-client brand voice from clients.brand_voice_md (Move 1 / Fix #3). New `getBrandContext` helper + 12 prompt sites refactored + dynamic hashtags + `seedMuseMemory` removed + VitalLyfe SQL seed |
| `22cc58f` | `feat(brand)`: per-request voice override + bump 9 deprecated frontend models (`claude-sonnet-4-20250514` → `claude-sonnet-4-6`; `claude-3-haiku-20240307` → `claude-haiku-4-5-20251001`) |
| `0c163dd` | `fix(brand)`: pass currentClient into AgentChatPage (post-Move-1 regression — `client_id: null` was reaching backend) |
| `2b43364` | `fix(auth)`: auto-recover from supabase-js auth-lock deadlock (Fix #15). stuckGuard clears `sb-*-auth-token` keys + reloads; one-shot sessionStorage flag prevents reload loops |
| `ed46c31` | `chore(schema)`: content_items baseline migration (Fix #10) — 25 cols + FK + indexes + RLS captured in `20260526_content_items_baseline.sql`. Surfaced wide-open "Allow all for now" policy as security debt |
| `5a51b00` | `fix(rls)`: scoped client policies on content_items + drop wide-open anon (Fix #10.1) — `20260526_content_items_client_rls.sql`. Anon REST returns 0 rows now |
| `2bb8958` | `feat(notify)`: per-client n8n routing + consolidated slack+n8n into one Supabase fetch (Fix #7) |
| `4b54630` | `chore(cleanup)`: delete dead `src/agents/` folder (Fix #8) — 8 files, 96 lines |
| `183d53f` | `chore(cleanup)`: cid_library column rename `vitallyfe_adaptation` → `client_adaptation` (Fix #3.1) + close Fix #11 (pdfjs already dynamic) + arch map sync |
| Codex on `codex/grunt-2026-05-26` | `refactor(App)`: extract 6 route components to `src/ui/routes/` (Fix #2). App.jsx 1,676 → 1,342 lines. 7 commits (`4ee755b` Dashboard, `6589b78` Agents, `bee8946` Content, `f2d384c` Tracker, `94eae54` Taskboard, `c4f2cc5` Sops, `e57e951` notes) |
| `8e59968` | `security`: CORS allowlist + per-user rate limits + CSP/HSTS/Permissions/Referrer (security hardening sweep) |
| `90beaa6` | `chore(cleanup)`: drop unused INITIAL_CONTENT seed array (Fix #14 partial) + drop matching App.jsx import + regenerate arch map docs |

**What unlocked:** brain trilogy complete. Multi-tenancy is real end-to-end — adding a new client via AddClient modal + filling `brand_voice_md` gets them their own agent voice automatically. Security posture moved from "auth gate only" to "auth + RLS + CORS + rate limits + CSP". App.jsx finally splittable. Three migrations applied to live Supabase by founder (brand voice seed, content_items baseline, content_items client_rls, cid_library rename) — all verified before code push.

**Codex workflow established:** I work main, Codex grinds on `codex/grunt-<date>` feature branches. Brief Codex with exact line numbers + dirty-WIP out-of-scope list + CODEX_NOTES.md as the report. Use `git push origin HEAD:main` to dodge stale local main refs.

### 2026-05-26 PM (evening) — 3 closed-by-removal cleanups + Codex Fix #4 grind + 3-agent collab pattern proven

| Commit | What |
| --- | --- |
| `a22df04` | `chore(cleanup)`: close cid_posts dead chain + document email/password auth disable. Live SQL probe confirmed `cid_posts` table never existed; `cid-scrape.js` + `003_cid_posts.sql` deleted; arch map + 5 markdown bundle files synced; +88/-171 lines |
| (out-of-band) | **Supabase Auth → Providers → Email** toggle flipped off in dashboard. Leaked admin password (literal redacted 2026-07-12) in git history now inert. Only Google OAuth path remains. |
| (out-of-band) | **Netlify env var `CID_BEARER_TOKEN`** deleted — orphaned after cid-scrape removal. |
| Codex on `codex/grunt-2026-05-27` | `refactor(agent-action)`: Fix #4 — split 1,317-line monolith into 16 handler files under `netlify/functions/agent-action/handlers/`. agent-action.js now 309-line router. 19 commits, build green after each. CODEX_NOTES.md has full report. **Awaiting founder review + merge.** |

**3-agent collab pattern proven at scale:** Main Claude (this tab) drove diagnostics + briefs + arch-map updates. Counsel Claude (parallel tab) shipped `90beaa6` (INITIAL_CONTENT cleanup, caught dead import before I did) + `9955cd3` (HANDOFF rewrite to fix stale "Dirty WIP" claim). Codex GPT-5.5 ground through Fix #4 on its own branch. Zero conflicts across all three. See [[project_vantus_counsel_workflow]] for the workflow notes.

**Codex burst budget behavior:** 5h burst limit (gpt-5.5 quality) caps Codex on big refactors. When exhausted, auto-downgrades to gpt-5.4-mini. Weekly limit is separate (much more generous). Resets are timed per-window (today's was 01:51). Plan big Codex jobs around burst windows.

**Codex standing contract:** "use `codex/grunt-YYYY-MM-DD` today's date, NEVER push to remote, founder reviews + merges manually." My initial Fix #4 brief overrode both (asked for a specific branch name + push) — Codex correctly refused both via CODEX_NOTES.md and asked for confirmation. Briefs should respect the contract; only override when explicitly needed.

**Next session queue (briefs already drafted at `/tmp/`):**
- `/tmp/codex-brief-deadcode.md` — dead code sweep across `src/`. Ready to fire when Codex burst returns.
- `/tmp/codex-brief-app-state.md` — App.jsx state extraction into custom hooks (skeleton; needs parallel Claude tab to produce state map at `/tmp/app-state-map.md` first, paste into brief).
- `/tmp/other-claude-prompt.md` — prompt for a parallel Claude tab to do the state mapping prep.

### 2026-05-25 — Auth restore + invite flow + per-client Slack
Eight commits, four high-severity bugs closed, full external-client invite flow shipped.

| Commit | What |
| --- | --- |
| `307b64f` | `fix(auth)`: dedupe setupSession + render UI immediately on session resolve |
| `8e5095e` | `feat(auth)`: re-enable auth gate + add admin RLS policies (Fix #1) |
| `852d915` | `chore(rls)`: drop temp anon policies now OAuth is live (Fix #1 tail) |
| `2a9c9c1` | `feat(auth)`: caller auth on 5 functions + client_users invite/allowlist flow (Fix #2) |
| `d0acec3` | `fix(auth)`: flip checking=false in onAuthStateChange + 4s stuckGuard (hotfix) |
| `19b6235` | `feat(invite)`: admin team panel inside Edit Client modal (Fix #2.5) |
| `702f867` | `feat(slack)`: per-client webhook routing in notify.js (Fix #4) |
| `d7f0b27` | `docs(map)`: regenerate architecture map after fixes |

**What unlocked:** real multi-tenancy. We can now invite external client teammates (e.g. Natalia at VitalLyfe) via the UI; they get a "pending" screen until we approve in the team panel; on approval their dashboard unlocks via realtime. Per-client Slack routing means future clients won't pollute #vitallyfe-war-room.

### 2026-05-22 → 2026-05-23 (preserved for context)
Repo tidy, component extraction, security audit, Move 2 + Move 3 deployed, custom domain set up, Anthropic model upgrade, mobile nav fixes, multi-tenant `clients` table seeded with VitalLyfe.

## What's NOT Built / Open Items

**Sprint-scale:**
- **Fix #4** — ✅ **DONE on `codex/grunt-2026-05-27`, awaiting founder merge.** 1,317-line agent-action.js → 309-line router + 16 handler files under `netlify/functions/agent-action/handlers/`. 19 commits, build green after each. Reviewed safe by main Claude. Merge with `git checkout main && git merge codex/grunt-2026-05-27 && git push origin main`.
- **App.jsx state extraction** — next big Codex job (~12 hooks under `src/hooks/`). Brief skeleton drafted at `/tmp/codex-brief-app-state.md`; needs the state-cluster mapping section filled in by a parallel Claude tab first (prompt at `/tmp/other-claude-prompt.md`).
- **Fix #12** — Back OpsBoard with a DB-backed `tasks` table (new migration + UI rewrite). ~1 hr. Not Codex-shaped (needs UI browser testing).
- **Fix #13** — Per-user client assignments. Counsel + main both flagged as ambiguous: could mean access (already done via `client_users.status='approved'`), role-per-client (add `assignment_role` column), or primary-contact-per-client (different concept). **Defer until the actual pain forces the question** — small team + one flagship client doesn't surface this yet.

**Decision-bound:**
- **Fix #9 — RESOLVED 2026-07-12 (moot).** The Higgsfield WIP never existed in the stash: `HiggsfieldStudio.jsx` / `higgsfield.js` / `sync-cortex.mjs` were **untracked**, and the plain `git stash` (no `-u`) only captured tracked changes. The untracked files are gone from disk and were never committed anywhere — the WIP is lost. What the stash actually held (a 1,920-line `public/portal.html` rewrite + 2 one-line nav registrations + `.netlify/` build noise) is archived on branch `archive/portal-html-wip-2026-05-26`; stash dropped. `main` has zero Higgsfield references, so nothing dangles. If Higgsfield Studio is ever wanted, it's a fresh build, not a resume.

**Polish:**
- **Vantus-bot Slack app** for agent-attributed messages (currently posts as signed-in user via MCP).
- **Fix #14** — INITIAL_CONTENT seed array removed 2026-05-26 (commit `90beaa6`). `seed.content.js` now only exports `VITAL_LYFE_SOP`, still rendered by `SopsRoute` + `ClientView`. Per-client SOP schema decision is the remaining work before this constant can move into the DB.
- **Dead code sweep across `src/`** — brief drafted at `/tmp/codex-brief-deadcode.md`. Fire when Codex burst returns.
- **External tracker → n8n trigger** (SharePoint/Airtable side).
- Tighten `style-src 'unsafe-inline'` in CSP when inline-style React patterns get factored out.

**Cortex bridge (forward design — not built):**
- `wiki/clients/<slug>/brand-voice.md` → `clients.brand_voice_md` push pipeline via `scripts/sync-cortex.mjs` (stub lives in `stash@{0}`, not in working tree). DO NOT create `wiki/clients/` until founder signs off on the schema. See `~/.claude/projects/-Users-chrisz/memory/project_cortex_vantus_bridge.md`.

## Strategic Context
- **Client:** VitalLyfe (Natalia = approver, Jon = JC, Danny = Cloud Scenic ops)
- **Active campaigns:** Tierra Bomba at $100/day, influencer seeding ~27–30 confirmed
- **External tracker:** influencer list in SharePoint, NOT in Vantus
- **Slack:** posts go to `#vitallyfe-war-room` as "VitalLyfe War Room" bot via `SLACK_WEBHOOK_URL`

## Sister Project
Cloud Scenic OS lives at `~/Desktop/Software builds/Cloud Scenic OS/` — separate codebase, Portal Build Companion agent owns it. Don't mix the two.

## Key Files (Vantus)
- `src/App.jsx` — root component (1,342 lines, post Codex Fix #2 split). Owns all state; routes are dumb presentation.
- `src/ui/routes/` — 6 extracted route components (DashboardRoute · AgentsRoute · ContentRoute · TrackerRoute · TaskboardRoute · SopsRoute). Codex 2026-05-26 Fix #2.
- `src/services/apiFetch.js` — auth-aware fetch wrapper. Attaches `Bearer <access_token>` to every protected call.
- `src/services/supabaseClient.js` — Supabase singleton.
- `src/ui/clients/AddClientModal.jsx` — client CRUD + team management. Embeds ClientTeamPanel.
- `src/ui/clients/ClientTeamPanel.jsx` — invite/approve/reject UI.
- `src/ui/layout/LoginScreen.jsx` — Google OAuth button.
- `src/ui/agents/AgentChatPage.jsx` — chat panel. Passes `currentClient.id` as `client_id` for brand voice resolution. Voice-override textarea above quick actions.
- `netlify/functions/_lib/requireUser.js` — shared auth gate + per-request `cors(event)` (allowlist regex).
- `netlify/functions/_lib/rateLimit.js` — NEW 2026-05-26. In-memory sliding-window per-user rate limit.
- `netlify/functions/agent-action.js` — **On `main`:** 1,317-line monolith. **On `codex/grunt-2026-05-27` (awaiting merge):** 309-line router that imports 16 handlers from `netlify/functions/agent-action/handlers/`. Once merged, this becomes the post-Fix #4 shape.
- `netlify/functions/agent-action/handlers/` — **Codex branch only, awaiting merge.** 16 per-handler files (one per agent action). See CODEX_NOTES.md on the branch for the full list + extraction commits.
- `netlify/functions/chat.js` — Anthropic proxy. Rate-limit 30/min/user.
- `netlify/functions/notify.js` — client notifications + per-client Slack + per-client n8n (single consolidated Supabase fetch).
- `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql` — VitalLyfe brand voice seed (Move 1).
- `supabase/migrations/20260526_content_items_baseline.sql` — full content_items DDL (Fix #10).
- `supabase/migrations/20260526_content_items_client_rls.sql` — scoped client RLS + drop anon policy (Fix #10.1).
- `supabase/migrations/20260526_cid_library_rename_adaptation.sql` — column rename (Fix #3.1, idempotent DO block).
- `supabase/migrations/20260525_*.sql` — auth restore batch (client_users, slack_webhook, admin RLS, drop temp anon).
- `netlify.toml` — security headers (HSTS, CSP, Referrer-Policy, Permissions-Policy) added 2026-05-26.
- `architecture-map.html` — interactive system map (regenerated 2026-05-26 with all today's changes).
- `docs/architecture-map/` — portable markdown export (README · critical-path · nodes · known-bugs · roadmap · open-items).
- `docs/architecture-map/open-items.md` — checkbox punch-list. Current open count: 3 MED bugs + 2 LOW track-only + 4 numbered fixes. (#4 closed on codex branch awaiting merge; cid_posts LOW closed-by-removal; rotate-passwords closed-by-auth-disable.)
- `sprint-recap.html` — **NEW 2026-05-26 PM evening (untracked).** Single-page animated dashboard summarizing the day's work — 4 ticker counters, before/after agent-action.js shrinking bar, 3-agent collab cards, commit timeline, live ticker. Built as a video prop; keep or delete. Open at `http://localhost:4747/sprint-recap.html` if `python3 -m http.server 4747` is running from repo root.
- `docs/REFACTOR_PLAN.md` — pre-existing refactor roadmap.
- `START HERE.md` — quick-orient nav for cold opens.
- `CODEX_NOTES.md` — Codex's report from the Fix #2 split run (2026-05-26).

---
## 2026-07-04 — harness restart snapshot (recorded by Counsel)
> The Nerve Center multiplexer was shut down and came back **blank** on 2026-07-04; the live agent sessions in its tabs were lost (in-flight, uncommitted-to-chat context is gone — only on-disk state survives). This block records the exact repo state at restart so a cold-started agent can resume without stepping on uncommitted work. **Run `git status` yourself before acting — treat the list below as a starting point, not gospel.**
- Branch `main` · HEAD `a8ff98b` (2026-07-04, "docs(map): update punch-list — 10 map bugs fixed in the 2026-07-04 sweep").
- The narrative above (dated 2026-07-03) predates that 07-04 map-bug commit — treat this repo as **one commit ahead of the prose**.
- Untracked at restart (NOT committed): `COUNSEL_HANDOFF_2026-07-01.md`, `ripped out features/`.
- No tracked-file modifications pending. Owned by the Vantus terminal — Counsel only recorded state, did not edit the narrative.

---
## 2026-07-06 — post-crash recovery + map sync (Vantus terminal, closing)
Cold-started after a terminal crash. On-disk state was intact; no work lost. Verified the build (`npm run build` clean, 98 modules), then closed out the loose threads from the 2026-07-04 sweep:

**Shipped to prod (usevantus.com, HTTP 200):**
- Pushed the 5 sweep commits that were sitting local-only → HEAD `a8ff98b` deployed on Netlify.
- Ran migration `20260704_notify_dedupe_and_cleanup.sql` against prod (via Supabase SQL editor): `notifications.dedupe_key` cycle-aware index is live (re-approvals notify again), deprecated `clients.slack_channel_id` column dropped.
- Confirmed `TOKEN_ENC_KEY` already exists in Netlify — the crypto hard-fail change (encrypt() throws when key unset) is a no-op in prod; existing OAuth tokens were already encrypted with it. **Do NOT rotate that key** or already-stored tokens become undecryptable.

**Architecture map refreshed** → committed + pushed as `dc55cbf` (docs-only):
- HTML `FIXES`/`KNOWN_BUGS` badges were pre-sweep (showed all 10 fixed bugs as open) — rewritten to show only genuinely-open work. Removed the `dead-ui` node (its 3 components were deleted in the sweep). Findings panel + `slack_channel_id` note updated.
- `known-bugs.md`: 10 fixed bugs moved to a "Fixed in the 7/4 sweep" section. `open-items.md`: marked DEPLOYED, migration marked run. `roadmap.md`: added a shipped/partial/open status table.

**Still open (nothing blocking — tracked partials):**
- **#5 Stripe** — the one real unproven thing: `billing-stripe.js:64` live invoice create-path has never run against a real invoice. Send one small controlled invoice to validate webhook paid-sync before billing a client through it. (Email-overlap half already fixed.)
- **#7 admin scoping** — client boundary is doubly-safe now (RLS + client-half scope); give Ledger/Reports/Client-Analytics their own scoped fetches before the next heavy client.
- **#8 security** — crypto done; still open: rotate the Supabase admin password out of git history once fully off password login, tighten CSP style-src.
- **Spot-check owed:** the two 7/3 config outages (Google OAuth Drive origin, Resend domain) were reportedly fixed in-console — verify they held; neither surfaces an error where a human looks.

**Repo state at close:** `main` == `origin/main` (level, `dc55cbf`). Uncommitted/untracked and deliberately left: `HANDOFF.md` (this note + Counsel's restart note), `COUNSEL_HANDOFF_2026-07-01.md`, `ripped out features/`. Both push PATs used this session were one-shot — revoke at https://github.com/settings/tokens if not already done.

---
## 2026-07-12 — Hardening sprint (Fix #7 admin half + CSP + stash truth + integration probes)

**Shipped (4 local commits on `main`, awaiting founder push+deploy — repo is now 7 ahead of origin incl. the 3 held 7/9 commits):**
- `4fe5c97` **Fix #7 (admin half) DONE.** `useSupabaseRows` hook in `src/utils/hooks.js`; ReportsRoute + ClientAnalyticsRoute fetch their own slim windowed rows (90d; approvals limit 20 w/ `content_items(title)` embed; `account_posts` projected via `metrics->>` — jsonb blob no longer ships); global content blob bounded to `posted_at.is.null OR >= 90d` (`ACTIVE_CONTENT_DAYS`, App.jsx). Ledger deliberately keeps riding the bounded blob (realtime + optimistic-overrides interplay). Realtime channel unchanged — patch-only handlers self-maintain the bound. Query syntax validated against live PostgREST (anon 200s). Remaining client half: portal-user `client_id=eq.` re-subscribe.
- `3758a98` **CSP: `'unsafe-inline'` dropped from style-src (Fix #8).** The old "styled-jsx" comment was wrong — no styled-jsx exists, and React `style={{}}` goes through CSSOM (not governed by style-src). Real consumers: LoginScreen's runtime `<style>` injection (moved into `globals.css`) and the GIS button stylesheet (sha256-allowlisted; unused by our UI anyway). Verified on a draft deploy: login pixel-identical, console zero violations.
- `d8f7b0c` **Stash truth + credential redaction.** `stash@{0}` was never the Higgsfield WIP — those files were untracked and plain `git stash` skipped them; they're gone (Fix #9 = moot, fresh build if ever wanted). Actual stash contents (portal.html rewrite + 2 nav one-liners) archived on `archive/portal-html-wip-2026-05-26`, stash dropped. Leaked password literal redacted from all current-tree docs.

**Integration probes — all three "reportedly fixed" integrations are BROKEN in prod (see VANTUS_TODO 🚨 block for fixes):**
1. **Stripe:** `STRIPE_SECRET_KEY` is not a Stripe-shaped value in ANY Netlify context (prod 20 chars, dev 64) — Stripe returns 401. The known-bugs "key is live" claim was wrong. Fix #5 proof invoice is blocked until the real key is set.
2. **Resend:** `RESEND_API_KEY` equally invalid (not `re_`-shaped, API rejects) → all outbound email dead. The rogue env var NAMED `re_jEHHfr94_…` still exists — treat that value as burned, rotate in Resend, set the new key, delete the rogue var.
3. **Google OAuth:** live probe of the GIS popup URL → Google still serves `origin_mismatch` for `https://usevantus.com` (client `844741925554-i2j0…`). The 7/3 console fix never took. Drive upload has never worked in prod.

**Deploy note:** these 4 commits are safe to deploy independently of the key fixes (nothing depends on Stripe/Resend/OAuth). `netlify deploy --build --prod` after founder review; git auto-deploy still credit-blocked.

---
## 2026-07-13 — status ping (no Vantus code work)

Session pivoted to a Danny catch-up email (Dynasty demo, lives at `/tmp/danny-dynasty-demo-email.txt`, owned by the Dynasty session — not Vantus work). Framing correction from Christian for whoever revises it: Dynasty is **already sold**; the email is a catch-up for Danny, not a pitch. He rates the current draft "some good, some eh" — revision pending in the owning session.

**Vantus state unchanged since the 7/12 block above:**
- `main` ahead 7 of origin (3 held 7/9 commits + 4 hardening commits). Push still gated on a one-shot PAT from Christian; deploy via `netlify deploy --build --prod` (git auto-deploy still credit-blocked).
- The three broken integrations (Stripe key invalid, Resend key invalid + rogue `re_…`-named env var, Google OAuth origin unregistered) are still awaiting Christian's ~10-min console session — see the 🚨 block in VANTUS_TODO.md.
- Incidental: `.netlify/netlify.toml` shows modified (regenerated by the 7/12 CLI draft deploys, same class of noise as the untracked manifest — harmless, don't commit it).

---

## 2026-08-17 (night, cont.) — crew at home posts + patrol drones

- **Movement rule amended (Christian):** idle crew now hold their HOME STATION, not Quarters. `shipStations.js` ROSTER gained `home:` (Sean→cockpit, Muse→foundry, Scrappy→intel, Slate→qc); both idle paths (no receipts / stale receipts) resolve to `member.home || 'quarters'`. Future crew still ghost in Quarters. Receipts still drive working/active state and station moves.
- **NEW `src/ship/drones.js`:** 4 original patrol drones (dark capsules, cyan eye, blinking red nav light, faint additive searchlight cone, 3 swaying feeler antennas). Deterministic sin paths — two upper sky, one low over the city, one slow foreground hull crossing. NO film-machine likenesses (Christian said "sentinel robots"; built our own design per the likeness doctrine). First deploy had them 3-4x too small at camera distance — rescaled (s 2.0–3.8).
- Pushes `9099056` + `1bd9c5e`, both deployed + verified via Playwright (magic-link login, Agent Ship → 3D View): Sean/Scrappy/Muse/Slate each at their bay, drones visible in sky and over city.
- Note: one `git push` failed on a network flap mid-run ("repository exists" SSH tail) — retry succeeded; the deploy-watch that reported ready was watching the PREVIOUS deploy. Watch for commit_ref, not just state.
- **Sentinels rescaled to actual scale (Christian: "i need actual scale sentinals"):** drones.js rebuilt as sentinel-class machines — armored head larger than a crew member, 6-eye cyan cluster + pulsing red hunter eye, 8 chained-segment tentacles (7 segs each, travelling sway wave), sweeping searchlight. Push `b72d465`, verified on prod: machines visible over the nose, stern, city band, and the slow foreground crosser.
- **Crew pop + sentinels to deep background (Christian: figures "too big & blending into the ship", sentinel over cockpit rejected):** humanScaleAt cut ~30% (66-105 units); commissioned crew get signature-color tint on near-black garments + 0.4 emissive self-glow (Sean blue / Scrappy indigo / Muse red / Slate cyan now pop); future crew forced to true ghosts (desaturated slate, 0.35 opacity — their wardrobe colors were reading as pixel noise in Quarters). Sentinels halved again + moved to the storm line / city band with haze-lifted hull colors — never over the hull. Pushes 41525c4 + 54af643, Playwright-verified.
- **Hull-breach attacker (Christian: "sentinal on the ship shooting lasers trying to get in nothing crazy"):** 5th sentinel holds an agitated hover over the stern hull (ATTACK config in drones.js, hover 838/95 → impact 895/168), pitched down, tentacles writhing fast, no searchlight. Laser = burst cycle (1.4s on / 2.4s off) with cutting flicker: red core cylinder + wide additive haze sheath + pulsing impact flare. First beam was ~2px and invisible — widened core to r2.4-3.2 + haze r6.5-8.5. Also: future-crew ghost meshes REMOVED from the 3D scene entirely (Christian's "glitch in the left corner" = their accent strips + translucent boxes in Quarters; they remain in Map/List views). Pushes e0c4220 + 8e3d310, laser verified mid-burst on prod.

---
## 2026-08-18 — session close: ship arc settled, board for next session

**Repo state at close:** `main` == `origin/main` (`9b5c0c9`), deployed + ready on Netlify (verified by commit_ref). Only local noise: two regenerated `.netlify/functions/*.zip` artifacts — don't commit. All of tonight's ship work is live on usevantus.com and Playwright-verified.

**Ship view final state (3D View on Agent Ship):** art-as-world painting + shipArtFX life layer; crew at HOME stations when idle (Sean cockpit / Scrappy intel / Muse foundry / Slate qc), receipts still move them; crew scaled 66-105 units with signature-color tint + emissive pop; future crew NOT rendered in 3D (Map/List only); 4 background sentinels patrol storm sky + city band only; 5th attacker sentinel over the stern firing burst lasers at the hull. All sentinel/crew designs original per the settled likeness doctrine.

**What's left on the Vantus build (verbatim board given to Christian tonight):**
- *Blocked on Danny:* Phase C (client workspace shell + rest of spec) gated on his Section 8 vetoes — the Danny call. Open questions live in `VANTUS-PHASE-A-ESTIMATE.md` (AI vs rule-based approval recs, approval_rule default, Resend key). All email still dry-run until a real Resend key lands.
- *Blocked on Higgsfield daily limit (resumes when it resets):* rig Sean — `3d_rigging` with `model_url: e5387b22-1834-436d-ae3e-bc9fa35be125`, `enable_animation: true`, `animation_action_id: 30` (Casual_Walk); then sheet→4-crop→mesh→rig for Muse/Scrappy/Slate (sheets already in Higgsfield gallery); then GLTFLoader + AnimationMixer replaces the procedural figures in ShipScene3D. This is the last visible gap vs the reference.
- *Christian's quick list:* the Danny call; create empty private GitHub repo for vantus-site then `git push -u origin main`; delete ZZ Stress Test + archive QC Test Kitchen from prod; review CloudScenic brand facts for intel features.
- *No buildable code work remains* that isn't gated on one of the above.

**Ops notes for next session:** git pushes intermittently fail on this Mac's network flaps ("repository exists" SSH tail) — retry loop wins; Netlify deploy-watch must match `commit_ref`, not just `state=ready`; prod boot can black-screen 15-45s on the same flaps (wait, don't debug); Playwright browser_click is broken in this MCP build — use browser_evaluate with a querySelector click instead.
