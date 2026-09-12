// ── Agent Ship crew: rigged GLB characters ────────────────────────────────────
// Phase 3 of the ship arc: real textured, skeleton-rigged characters (Meshy
// pipeline — A-pose turnaround → multi_image_to_3d → 3d_rigging) replace the
// procedural primitive figures. Each character ships as TWO GLBs sharing one
// skeleton: a Casual_Walk loop and an Idle loop; we bind both clips to one
// AnimationMixer and crossfade on the sim's anim state.
//
// createCrewFigure() is a drop-in for createAgentFigure(): same contract
// ({ group, update(sprite, t), dispose() }, group origin = FEET center,
// logical height ≈ 34 units so humanScaleAt() math is unchanged). Crew
// without a GLB entry — and any GLB that fails to load — render the
// procedural figure, so the ship never shows an empty post while the fleet
// is generated character by character.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createAgentFigure, makeNameTexture } from './crewModels.js';

// Characters with generated rigs. Add a line per crew member as their GLBs
// land in public/crew/ (recipe in HANDOFF.md 2026-08-20).
export const CREW_GLB = {
  Sean: { walk: '/crew/sean.glb', idle: '/crew/sean_idle.glb', work: '/crew/sean_work.glb' },
  Muse: { walk: '/crew/muse.glb', idle: '/crew/muse_idle.glb', work: '/crew/muse_work.glb' },
  Scrappy: { walk: '/crew/scrappy.glb', idle: '/crew/scrappy_idle.glb', work: '/crew/scrappy_work.glb' },
  Slate: { walk: '/crew/slate.glb', idle: '/crew/slate_idle.glb', work: '/crew/slate_work.glb' },
};

const FIGURE_HEIGHT = 34;   // logical units — must match crewModels' proportions
const TAG_Y = 41;
const LIGHT_Y = 36.5;
const LOWER_DECK_SCALE = 38 / 34;
const STATUS_GREEN = 0x37ff8b;
const STATUS_GRAY = 0x3a4150;
// Meshy rigs face +Z at identity — same "toward camera" baseline as the
// procedural figures. Adjust here if a future provider ships a different axis.
const MODEL_YAW = 0;

// ── Compositing the crew into the plate ──────────────────────────────────────
// The painting is dark, cool, rim-lit and painterly. A Meshy/Blender character
// arrives the opposite: evenly lit, saturated, glossy. No amount of scale or
// walk tuning fixes that mismatch; grading does. Every figure gets:
//   saturation  pulled toward the plate's near-monochrome palette
//   exposure    knocked down so garment highlights sit UNDER the holo screens
//   tint        a cool cast, matching the key/rim rig in ShipScene3D
//   selfGlow    a whisper of emissive so shadow sides never go fully black
//   roughness   forced matte — specular pings are the loudest sticker tell
// Tune here, verify in tests/ship-scene.html (which mounts the real scene).
const GRADE = { saturation: 0.58, exposure: 0.70, tint: [0.84, 0.91, 1.0], selfGlow: 0.06, roughness: 0.94 };
// Posture: the Meshy clips carry a built-in lean (measured 9/10 in the harness:
// hips-to-head about 6.5 deg sideways and 5 deg forward on every crew member,
// bind pose straight) and hang the arms 21-28 deg out from the body. Both read
// as "crooked" at ship distance. The corrector below keeps the SMOOTHED spine
// vertical (sway survives, the mean lean does not) and tucks the upper arms.
// Arms: the clips are asymmetric (one arm hangs ~25 deg out, the other ~38),
// so the tuck aims each upper arm at a TARGET hang angle instead of pulling
// both by a fixed amount; armTuckMax caps how far a gesture gets flattened.
const POSTURE = { spineTau: 1.2 /* s, EMA on the spine direction */, armTargetRad: 9 * Math.PI / 180, armTuckMaxRad: 32 * Math.PI / 180, workLean: 0.03, walkLean: 0.04 };
// Contact shadow ellipse (logical units, figure is FIGURE_HEIGHT tall).
const SHADOW = { w: 30, h: 7.5, y: 0.4, opacity: 0.62 };

function gradeIntoPlate(m) {
  if (!m || !('emissive' in m) || !m.color) return;
  if (m.map) {
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveMap = m.map;
    m.emissiveIntensity = GRADE.selfGlow;
  } else {
    m.emissiveIntensity = Math.min(m.emissiveIntensity ?? 0, GRADE.selfGlow);
  }
  m.color.multiply(new THREE.Color(GRADE.tint[0] * GRADE.exposure, GRADE.tint[1] * GRADE.exposure, GRADE.tint[2] * GRADE.exposure));
  if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, GRADE.roughness);
  if ('metalness' in m) m.metalness = 0;
  if ('envMapIntensity' in m) m.envMapIntensity = 0;
  // Saturation is a shader-side move: the albedo AND the self-glow both pass
  // through it, so the figure cannot re-saturate itself via emissive.
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPlateSat = { value: GRADE.saturation };
    const desat = (v) => `{ float l = dot(${v}.rgb, vec3(0.299, 0.587, 0.114)); ${v}.rgb = mix(vec3(l), ${v}.rgb, uPlateSat); }`;
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform vec3 diffuse;', 'uniform vec3 diffuse;\nuniform float uPlateSat;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  ' + desat('diffuseColor'))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  ' + desat('totalEmissiveRadiance'));
  };
  m.customProgramCacheKey = () => 'plate-grade';
  m.needsUpdate = true;
}

const loader = new GLTFLoader();
const loadGLB = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));

// One decode per URL pair per session; every mount then clones via SkeletonUtils-
// style deep clone. three's stock .clone() does not rebind skinned meshes, so we
// re-parse per figure instead (crew count is 4 — cost is a few MB once each).
export function createCrewFigure({ name, color, future = false }) {
  const spec = CREW_GLB[String(name || '')];
  if (future || !spec) return createAgentFigure({ name, color, future });

  const agentColor = new THREE.Color(color || '#2AABFF');
  const group = new THREE.Group();
  const rig = new THREE.Group(); // facing / lean pivot, model hangs under it
  group.add(rig);

  // Until the GLB lands (or if it never does) the procedural figure stands in.
  let proc = createAgentFigure({ name, color, future });
  group.add(proc.group);

  // ── Overhead furniture (ours, so it survives the proc→GLB swap) ────────────
  // One deterministic hash per crew member, reused for animation phase, pace and
  // the idle look-around. Stable across reloads so a character always behaves
  // like themselves.
  // Casual_Walk covers 0.383 body-heights per 4.23s cycle = 0.0905 bh/sec at
  // timeScale 1. Crew read at roughly 85 logical units tall, so the clip's own
  // pace is only ~7.7 u/s while the sim glides them far faster. Left alone the
  // legs cycle at one rate and the body travels at another, which is exactly
  // what makes a character look like it is skating rather than walking.
  const CLIP_NATURAL_SPEED = 0.0905 * 85;   // logical units/sec at timeScale 1
  let lastX = null;
  let NAME_HASH = 0;
  for (let i = 0; i < String(name || '').length; i++) NAME_HASH = (NAME_HASH * 31 + String(name).charCodeAt(i)) >>> 0;
  const PHASE01 = (NAME_HASH % 1000) / 1000;
  // Per-character pace lives at figure scope: update() needs it every frame, and
  // it used to be trapped inside the loader callback.
  const PACE = 0.90 + ((NAME_HASH >>> 10) % 1000) / 1000 * 0.20;   // 0.90-1.10

  const tagTexture = makeNameTexture(name, `#${agentColor.getHexString()}`);
  const tagMat = new THREE.SpriteMaterial({ map: tagTexture || null, transparent: true, opacity: 0, depthWrite: false });
  const tag = new THREE.Sprite(tagMat);
  tag.scale.set(28, 7, 1);
  tag.position.y = TAG_Y;
  group.add(tag);
  // Work glow: a soft additive pool at working height. "A prop for the working
  // state... it reads as working from far enough away that nobody needs to zoom
  // in." Only ever lit by a real receipt, never on a timer.
  const glowTex = makeSoftDot();
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, color: agentColor.clone(),
  });
  const workGlow = new THREE.Sprite(glowMat);
  workGlow.scale.set(26, 26, 1);
  workGlow.position.y = 20;
  group.add(workGlow);
  // Contact shadow: the one cue that makes a figure STAND on the painted deck
  // instead of floating in front of it. The camera looks straight into the
  // plate, so a floor-flat decal would be edge-on and invisible; a soft dark
  // ellipse billboarded at the feet, tucked just behind them, is the 2.5D
  // equivalent and reads correctly from the ship camera.
  const shadowMat = new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, depthWrite: false, color: 0x000000,
  });
  const contactShadow = new THREE.Sprite(shadowMat);
  contactShadow.scale.set(SHADOW.w, SHADOW.h, 1);
  contactShadow.position.set(0, SHADOW.y, -1.5);
  group.add(contactShadow);

  const statusMat = new THREE.MeshStandardMaterial({ color: 0x111318, emissive: STATUS_GRAY, emissiveIntensity: 0.5 });
  const statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), statusMat);
  statusLight.position.y = LIGHT_Y;
  statusLight.visible = false;
  group.add(statusLight);
  const colGreen = new THREE.Color(STATUS_GREEN);
  const colGray = new THREE.Color(STATUS_GRAY);

  let mixer = null;
  let walkAction = null;
  let idleAction = null;
  let workAction = null;
  let current = null;
  let lastT = null;
  let disposed = false;
  const ownedMaterials = [];
  const postureBones = {};
  let postureWrap = null;
  const spineEMA = new THREE.Vector3(0, 1, 0);
  let armTuckWeight = 1;   // eased to 0 while walking so the arm swing survives
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);

  // Runs after mixer.update: measure the spine in the wrap's frame, ease an
  // average, and counter-rotate the wrap (pivot = feet) so the mean posture is
  // upright. Then pull each upper arm toward the body by a fixed angle in the
  // model frame, converted into the bone's local space so the forearm follows.
  function correctPosture(dt, walking) {
    const b = postureBones;
    if (!postureWrap || !b.hips || !b.head) return;
    armTuckWeight += ((walking ? 0 : 1) - armTuckWeight) * Math.min(1, dt * 6);
    // Measure the spine in the BODY's own frame (inside the correction group,
    // so the current correction is factored out). That vector is the clip's
    // raw lean; the correction is SET, never accumulated, as the rotation that
    // carries the smoothed raw lean to vertical.
    postureWrap.updateMatrixWorld(true);
    _m.copy(postureWrap.matrixWorld).invert();
    b.hips.getWorldPosition(_v).applyMatrix4(_m);
    b.head.getWorldPosition(_w).applyMatrix4(_m);
    _w.sub(_v).normalize();
    const k = 1 - Math.exp(-dt / POSTURE.spineTau);
    spineEMA.lerp(_w, k).normalize();
    postureWrap.quaternion.setFromUnitVectors(spineEMA, UP);
    for (const arm of [b.leftArm, b.rightArm]) {
      if (!arm || !arm.parent) continue;
      arm.updateWorldMatrix(true, false);
      const child = arm.children.find((c) => c.isBone);
      if (!child) continue;
      arm.getWorldPosition(_v); child.getWorldPosition(_w);
      _w.sub(_v).normalize();                       // upper-arm direction, world
      const full = _w.angleTo(DOWN);                // current hang angle from straight down
      const ang = Math.min(POSTURE.armTuckMaxRad, Math.max(0, full - POSTURE.armTargetRad)) * armTuckWeight;
      if (ang < 1e-4 || full < 1e-4) continue;
      _q.setFromUnitVectors(_w, DOWN);              // full swing to vertical...
      _q.slerp(new THREE.Quaternion(), 1 - ang / full); // ...limited to what reaches the target
      arm.parent.getWorldQuaternion(_qp);
      // world-space delta -> bone-local: q_local = inv(parentWorld) * q * parentWorld
      _q.premultiply(_qp.clone().invert()).multiply(_qp);
      arm.quaternion.premultiply(_q);
    }
  }

  Promise.all([loadGLB(spec.walk), loadGLB(spec.idle)])
    .then(([walkGltf, idleGltf]) => {
      if (disposed) return;
      const model = walkGltf.scene;

      // Normalize: feet at y=0, centered, FIGURE_HEIGHT units tall.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = FIGURE_HEIGHT / (size.y || 1);
      const wrap = new THREE.Group();
      wrap.scale.setScalar(s);
      wrap.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
      wrap.add(model);
      wrap.rotation.y = MODEL_YAW;

      // Composite the scan into the painting (see gradeIntoPlate): the export
      // arrives front-lit, saturated and glossy, which is exactly what makes a
      // real character read as a sticker on a painted plate.
      model.traverse((o) => {
        if (o.isMesh && o.material) {
          o.frustumCulled = false; // skinned bounds lag the animation
          gradeIntoPlate(o.material);
          ownedMaterials.push(o.material);
        }
      });

      mixer = new THREE.AnimationMixer(model);
      const walkClip = walkGltf.animations?.[0];
      const idleClip = idleGltf.animations?.[0];
      // Four characters playing one idle clip in perfect lockstep reads as
      // uncanny long before anyone can say why - a crowd moving in unison is
      // the tell that they are puppets. Give each crew member a deterministic
      // phase offset and a slightly different pace, hashed from the name so it
      // is stable across reloads.
      const phase01 = PHASE01;
      const prime = (act, clip) => {
        if (!act) return act;
        act.timeScale = PACE;
        act.time = phase01 * (clip?.duration || 1);
        return act;
      };
      if (walkClip) walkAction = prime(mixer.clipAction(walkClip), walkClip);
      // The idle clip binds by bone name — both GLBs come from the same rig
      // pass on the same mesh, so names match. Guarded anyway: a bind failure
      // leaves walk-only, which still reads fine.
      try { if (idleClip) idleAction = prime(mixer.clipAction(idleClip), idleClip); } catch { idleAction = null; }
      // Optional third clip (work / typing) from a separate GLB sharing the rig.
      if (spec.work) loadGLB(spec.work).then((g) => {
        if (disposed) return;
        const clip = g.animations?.[0];
        try { if (clip) workAction = prime(mixer.clipAction(clip), clip); } catch { workAction = null; }
      }).catch(() => {});
      current = idleAction || walkAction;
      current?.play();

      // Posture corrector bones (Mixamo naming from the rig pass).
      model.traverse((o) => {
        if (!o.isBone) return;
        if (/^hips$/i.test(o.name)) postureBones.hips = o;
        else if (/^head$/i.test(o.name)) postureBones.head = o;
        else if (/^leftarm$/i.test(o.name)) postureBones.leftArm = o;
        else if (/^rightarm$/i.test(o.name)) postureBones.rightArm = o;
      });
      // The corrector pivots a group whose origin is the rig origin = feet
      // center, so a lean is removed by rotating the body about its feet.
      postureWrap = new THREE.Group();
      postureWrap.add(wrap);

      rig.add(postureWrap);
      // Swap: procedural stand-in out, real character + our tag/light in.
      group.remove(proc.group);
      proc.dispose();
      proc = null;
      tagMat.opacity = 1;
      statusLight.visible = true;
      shadowMat.opacity = SHADOW.opacity;
    })
    .catch(() => { /* GLB missing/broken — procedural figure stays, tag stays his */ });

  function setAction(next) {
    if (!next || next === current) return;
    next.enabled = true;
    // Deliberately NOT reset() - that snaps the clip back to t=0 and would put
    // the whole crew back in lockstep the first time they all change state.
    next.paused = false;
    next.play();
    if (current) current.crossFadeTo(next, 0.25, false);
    current = next;
  }

  function update(sprite, t) {
    if (proc) { proc.update(sprite, t); return; }
    const anim = sprite?.anim || 'idle';
    const facing = sprite?.facing === -1 ? -1 : 1;
    const time = (Number(t) || 0) * 0.001;
    const dt = lastT == null ? 0.016 : Math.min(0.1, Math.max(0, (t - lastT) * 0.001));
    lastT = t;
    const _x = Number(sprite?.x);
    const prevX = lastX;
    if (Number.isFinite(_x)) lastX = _x;

    group.scale.setScalar(sprite?.deck === 1 ? LOWER_DECK_SCALE : 1);

    // Facing + posture (same language as the procedural rig).
    const faceY = facing === 1 ? 0.35 : Math.PI - 0.35;
    rig.rotation.set(0, faceY, 0);

    if (anim === 'walk') {
      rig.rotation.x = POSTURE.walkLean;
      setAction(walkAction || idleAction);
      // Drive playback from the distance actually covered, not from an assumed
      // velocity: if something blocks the step, the legs slow with it.
      if (walkAction && dt > 0) {
        const x = Number(sprite?.x);
        if (Number.isFinite(x) && prevX != null) {
          const speed = Math.abs(x - prevX) / dt;
          const want = speed / CLIP_NATURAL_SPEED;
          const clamped = Math.max(0.6, Math.min(6, want)) * PACE;
          walkAction.timeScale += (clamped - walkAction.timeScale) * 0.25;
        }
      }
    } else if (anim === 'climb') {
      rig.rotation.y = Math.PI;
      setAction(walkAction || idleAction);
    } else if (anim === 'work') {
      rig.rotation.x = POSTURE.workLean; // a hint toward the console, not a hunch
      // Face the prop: three-quarter turn toward the back wall, side chosen by
      // the sprite's facing so the body reads as turned, not spun.
      rig.rotation.y = facing === 1 ? Math.PI * 0.72 : Math.PI * 1.28;
      setAction(workAction || idleAction || walkAction);
    } else {
      setAction(idleAction || walkAction);
    }
    mixer?.update(dt);
    correctPosture(dt, anim === 'walk' || anim === 'climb');

    // Work glow follows the receipt, with a low flicker so it reads as a console
    // being used rather than a lamp left on.
    const glowTarget = anim === 'work' ? 0.42 + 0.10 * Math.sin(time * 5.1 + PHASE01 * 6.28) : 0;
    glowMat.opacity += (glowTarget - glowMat.opacity) * 0.08;
    workGlow.visible = glowMat.opacity > 0.01;

    // Name plates: loud for whoever is actually working, quiet for everyone else.
    // "The moment everything has a badge, the one that matters is invisible."
    // Eased rather than snapped so a state change reads as a change, not a cut.
    if (!proc) {
      const tagTarget = anim === 'work' ? 1 : (sprite?.state === 'active' ? 0.62 : 0.2);
      tagMat.opacity += (tagTarget - tagMat.opacity) * 0.06;
    }

    // Status light: green pulse when working, agent color when active, dim gray idle.
    if (anim === 'work') {
      statusMat.emissive.copy(colGreen);
      statusMat.emissiveIntensity = 0.9 + Math.sin(time * 3.6) * 0.3;
      statusLight.scale.setScalar(1 + Math.sin(time * 3.6) * 0.18);
    } else if (sprite?.state === 'active') {
      statusMat.emissive.copy(agentColor);
      statusMat.emissiveIntensity = 0.8;
      statusLight.scale.setScalar(1);
    } else {
      statusMat.emissive.copy(colGray);
      statusMat.emissiveIntensity = 0.4;
      statusLight.scale.setScalar(1);
    }
  }

  function dispose() {
    disposed = true;
    if (proc) { proc.dispose(); proc = null; }
    mixer?.stopAllAction();
    for (const m of ownedMaterials) m.dispose?.();
    tagMat.dispose();
    if (tagTexture) tagTexture.dispose();
    glowTex.dispose(); glowMat.dispose();
    shadowMat.dispose();
    statusMat.dispose();
    statusLight.geometry.dispose();
    if (group.parent) group.parent.remove(group);
  }

  return { group, update, dispose };
}

// Soft radial dot, drawn once per figure. Returns null outside a DOM so the
// headless test harness and any SSR path stay safe.
function makeSoftDot() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}
