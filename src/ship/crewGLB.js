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
  // Muse: { walk: '/crew/muse.glb', idle: '/crew/muse_idle.glb' },
  // Scrappy: { walk: '/crew/scrappy.glb', idle: '/crew/scrappy_idle.glb' },
  // Slate: { walk: '/crew/slate.glb', idle: '/crew/slate_idle.glb' },
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
  const tagTexture = makeNameTexture(name, `#${agentColor.getHexString()}`);
  const tagMat = new THREE.SpriteMaterial({ map: tagTexture || null, transparent: true, opacity: 0, depthWrite: false });
  const tag = new THREE.Sprite(tagMat);
  tag.scale.set(28, 7, 1);
  tag.position.y = TAG_Y;
  group.add(tag);
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
      if (walkClip) walkAction = mixer.clipAction(walkClip);
      // The idle clip binds by bone name — both GLBs come from the same rig
      // pass on the same mesh, so names match. Guarded anyway: a bind failure
      // leaves walk-only, which still reads fine.
      try { if (idleClip) idleAction = mixer.clipAction(idleClip); } catch { idleAction = null; }
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
    next.reset().play();
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
    statusMat.dispose();
    statusLight.geometry.dispose();
    if (group.parent) group.parent.remove(group);
  }

  return { group, update, dispose };
}
