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
  Sean: { walk: '/crew/sean.glb', idle: '/crew/sean_idle.glb' },
  Muse: { walk: '/crew/muse.glb', idle: '/crew/muse_idle.glb' },
  Scrappy: { walk: '/crew/scrappy.glb', idle: '/crew/scrappy_idle.glb' },
  Slate: { walk: '/crew/slate.glb', idle: '/crew/slate_idle.glb' },
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
  let NAME_HASH = 0;
  for (let i = 0; i < String(name || '').length; i++) NAME_HASH = (NAME_HASH * 31 + String(name).charCodeAt(i)) >>> 0;
  const PHASE01 = (NAME_HASH % 1000) / 1000;

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
  let current = null;
  let lastT = null;
  let disposed = false;
  const ownedMaterials = [];

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

      // A faint self-glow keeps the character readable against the dark
      // painting (same trick that saved the procedural crew), without the
      // signature-color garment tint — the real wardrobe carries identity now.
      model.traverse((o) => {
        if (o.isMesh && o.material) {
          o.frustumCulled = false; // skinned bounds lag the animation
          if ('emissive' in o.material && o.material.map) {
            o.material.emissive = new THREE.Color(0xffffff);
            o.material.emissiveMap = o.material.map;
            o.material.emissiveIntensity = 0.22;
          }
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
      const pace = 0.90 + ((NAME_HASH >>> 10) % 1000) / 1000 * 0.20;   // 0.90-1.10
      const prime = (act, clip) => {
        if (!act) return act;
        act.timeScale = pace;
        act.time = phase01 * (clip?.duration || 1);
        return act;
      };
      if (walkClip) walkAction = prime(mixer.clipAction(walkClip), walkClip);
      // The idle clip binds by bone name — both GLBs come from the same rig
      // pass on the same mesh, so names match. Guarded anyway: a bind failure
      // leaves walk-only, which still reads fine.
      try { if (idleClip) idleAction = prime(mixer.clipAction(idleClip), idleClip); } catch { idleAction = null; }
      current = idleAction || walkAction;
      current?.play();

      rig.add(wrap);
      // Swap: procedural stand-in out, real character + our tag/light in.
      group.remove(proc.group);
      proc.dispose();
      proc = null;
      tagMat.opacity = 1;
      statusLight.visible = true;
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

    group.scale.setScalar(sprite?.deck === 1 ? LOWER_DECK_SCALE : 1);

    // Facing + posture (same language as the procedural rig).
    const faceY = facing === 1 ? 0.35 : Math.PI - 0.35;
    rig.rotation.set(0, faceY, 0);
    // Idle crew used to hold a post perfectly still, which reads as a prop.
    // An occasional slow glance costs nothing and, per the notes, "anything that
    // looks at something reads as aware". Period and direction are hashed, so
    // the crew never glance together.
    let lookY = 0;
    if (anim !== 'walk' && anim !== 'climb') {
      const period = 9 + (NAME_HASH % 7);                 // 9-15s per character
      const u = ((time / period) + PHASE01) % 1;
      if (u < 0.30) {
        const dir = ((NAME_HASH >>> 3) & 1) ? 1 : -1;
        const swing = Math.sin((u / 0.30) * Math.PI);     // ease out and back
        lookY = dir * swing * 0.40;
      }
    }
    rig.rotation.y += lookY;

    if (anim === 'walk') {
      rig.rotation.x = 0.04;
      setAction(walkAction || idleAction);
    } else if (anim === 'climb') {
      rig.rotation.y = Math.PI;
      setAction(walkAction || idleAction);
    } else if (anim === 'work') {
      rig.rotation.x = 0.1; // lean into the console
      setAction(idleAction || walkAction);
    } else {
      setAction(idleAction || walkAction);
    }
    mixer?.update(dt);

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
