// ── Crew procedural pose layers ───────────────────────────────────────────────
// The rigged crew (crewGLB.js) play walk / idle / work clips. The joints are
// all there — knees, ankles, elbows, wrists, neck — but a clip alone never
// reacts to the room. These layers run AFTER the mixer and the posture
// corrector every frame and steer the joints toward the world, each blended by
// a weight so the clip still leads:
//
//   1. head look-at      neck 30% / head 70% toward a target, clamped, eased
//   2. foot planting     two-bone analytic IK per leg onto a ground function
//   3. console reach     two-bone IK on each arm to a console plane while working
//   4. lean and recoil   spine pitch into velocity + a damped spring on impacts
//
// Everything is computed in the BODY frame: origin at the feet, +y up, +z the
// way the model faces, FIGURE_HEIGHT units tall. That is the frame just inside
// the facing pivot (`rig` in crewGLB.js), so "ahead" is simply +z and the
// host's facing / lean rotation is applied on top. Bone matrices are refreshed
// in that frame by temporarily detaching the posture wrap (see refresh()); the
// renderer recomputes the true world matrices before drawing.
//
// No per-frame allocations: every vector / quaternion below is scratch.
// Every bone lookup is guarded — a missing bone disables its layer only.

import * as THREE from 'three';

// Owner tuning. Angles in degrees, lengths in logical units (figure = 34 tall),
// times in seconds. `weight` on each layer is the master fader (0 = off).
export const POSE = {
  look: {
    weight: 1,            // master weight for host / work targets
    neckShare: 0.3, headShare: 0.7,
    yawMaxDeg: 70, pitchMaxDeg: 35,
    tau: 0.25,            // ease toward the target direction
    workAhead: 40, workUp: 10,   // console point: ahead of and above the feet
    idleWeight: 0.7, idleConeDeg: 60, idleMinS: 3, idleMaxS: 6, idleDist: 60,
  },
  feet: {
    weight: 1, walkWeight: 0.6, climbWeight: 0,
    minShift: 0.05,       // ignore ground offsets smaller than this (flat floor)
    maxShift: 12,         // never chase a ground more than this away
    pelvisFollow: 1,      // hips follow the lower foot so the legs can reach
  },
  reach: {
    weight: 0.7, height: 0.34, ahead: 9, spread: 9,
    bobHz: 3, bobAmp: 1.5,
    ease: 0.4,            // seconds to fade in / out around the work state
    maxExtend: 0.97,      // fraction of the arm length a target may pull to
  },
  lean: { weight: 1, maxDeg: 6, speedRef: 30, tau: 0.2 },
  recoil: { weight: 1, hz: 2.4, damping: 0.35, kick: 0.9, maxDeg: 18, headDip: 0.6 },
};

const DEG = Math.PI / 180;
const IDENT = new THREE.Quaternion();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const POLE_KNEE = new THREE.Vector3(0, 0, 1);
const POLE_ELBOW_L = new THREE.Vector3(0.5, -1, -0.3).normalize();
const POLE_ELBOW_R = new THREE.Vector3(-0.5, -1, -0.3).normalize();

// Scratch (module-level: figures are updated one at a time on the main thread).
const _pA = new THREE.Vector3(), _pB = new THREE.Vector3(), _pC = new THREE.Vector3();
const _qA = new THREE.Quaternion(), _qB = new THREE.Quaternion(), _qP = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qd = new THREE.Quaternion();
const _qr = new THREE.Quaternion(), _qk = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _d = new THREE.Vector3(), _dir = new THREE.Vector3(), _ab = new THREE.Vector3(), _perp = new THREE.Vector3();
const _nb = new THREE.Vector3(), _nc = new THREE.Vector3(), _tgt = new THREE.Vector3();
const _u1 = new THREE.Vector3(), _u2 = new THREE.Vector3();
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _off = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();

const BONE_NAMES = {
  hips: ['hips'],
  spineLo: ['spine02', 'spine2'],   // child of Hips on the Meshy rig
  spineHi: ['spine01', 'spine1'],
  neck: ['neck'], head: ['head'],
  lArm: ['leftarm'], lFore: ['leftforearm'], lHand: ['lefthand'],
  rArm: ['rightarm'], rFore: ['rightforearm'], rHand: ['righthand'],
  lUpLeg: ['leftupleg'], lLeg: ['leftleg'], lFoot: ['leftfoot'],
  rUpLeg: ['rightupleg'], rLeg: ['rightleg'], rFoot: ['rightfoot'],
};
const normName = (n) => String(n || '').replace(/^mixamorig[:_]?/i, '').replace(/[\s_:.]/g, '').toLowerCase();

export function findPoseBones(model) {
  const bones = {};
  if (!model) return bones;
  model.traverse((o) => {
    if (!o.isBone) return;
    const n = normName(o.name);
    for (const key in BONE_NAMES) if (!bones[key] && BONE_NAMES[key].includes(n)) bones[key] = o;
  });
  return bones;
}

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const smooth = (x) => x * x * (3 - 2 * x);

// Read a bone's body-frame position and rotation from its (refreshed) matrixWorld.
// Never getWorldPosition(): that re-walks the real ancestors and would undo the
// detached frame.
function readBone(bone, p, q) { bone.matrixWorld.decompose(p, q, _s); }
function posOf(bone, p) { return p.setFromMatrixPosition(bone.matrixWorld); }

// Apply a body-frame rotation delta to a bone: local = inv(parent) * delta * parent.
function applyDelta(bone, qDelta, qParent) {
  _qd.copy(qParent).invert().multiply(qDelta).multiply(qParent);
  bone.quaternion.premultiply(_qd);
}

// Two-bone analytic IK (law of cosines in the plane of a-b-c).
//   a: root bone (hip / shoulder), b: mid (knee / elbow), c: end (ankle / wrist)
//   target: body-frame point for c; w: blend 0..1; pole: bend hint used only
//   when the chain is straight; offset: body-frame shift already applied to the
//   chain's root (hips moved) but not yet in the matrices.
function solveTwoBone(a, b, c, target, w, pole, offset, maxExtend) {
  if (w <= 0 || !a || !b || !c || !a.parent) return;
  readBone(a.parent, _v, _qP);
  readBone(a, _pA, _qA); _pA.add(offset);
  posOf(b, _pB).add(offset);
  posOf(c, _pC).add(offset);
  const l1 = _pA.distanceTo(_pB), l2 = _pB.distanceTo(_pC);
  if (l1 < 1e-4 || l2 < 1e-4) return;
  _d.subVectors(target, _pA);
  let d = _d.length();
  if (d < 1e-4) return;
  _dir.copy(_d).multiplyScalar(1 / d);
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * maxExtend);
  // Bend plane: keep the clip's own knee / elbow side; fall back to the pole
  // when the limb is straight and the plane is undefined.
  _ab.subVectors(_pB, _pA);
  _perp.copy(_ab).addScaledVector(_dir, -_ab.dot(_dir));
  if (_perp.lengthSq() < 1e-4 * l1 * l1) _perp.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_perp.lengthSq() < 1e-8) return;
  _perp.normalize();
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _nb.copy(_pA).addScaledVector(_dir, l1 * cosA).addScaledVector(_perp, l1 * sinA);
  // Root bone: swing the current a->b onto a->newB.
  _u1.copy(_ab).normalize();
  _u2.subVectors(_nb, _pA).normalize();
  _q1.setFromUnitVectors(_u1, _u2);
  if (w < 1) _q1.slerp(IDENT, 1 - w);
  applyDelta(a, _q1, _qP);
  // Where the chain now is (rigid under q1), without re-reading matrices.
  _nb.copy(_ab).applyQuaternion(_q1).add(_pA);
  _nc.subVectors(_pC, _pB).applyQuaternion(_q1).add(_nb);
  // Mid bone: swing b->c onto b->target (the reach-clamped target).
  _tgt.copy(_pA).addScaledVector(_dir, d);
  _u1.subVectors(_nc, _nb).normalize();
  _u2.subVectors(_tgt, _nb).normalize();
  if (_u1.lengthSq() < 0.5 || _u2.lengthSq() < 0.5) return;
  _q2.setFromUnitVectors(_u1, _u2);
  if (w < 1) _q2.slerp(IDENT, 1 - w);
  _qB.copy(_q1).multiply(_qA);            // a's new body-frame rotation = b's parent
  applyDelta(b, _q2, _qB);
}

// createPoseLayers() is built with the figure and bound once the GLB lands.
//   figureHeight  logical height (34)
//   seed          per-character hash, so ambient glances differ but are stable
export function createPoseLayers({ figureHeight = 34, seed = 1 } = {}) {
  let bones = null;
  let wrap = null;            // posture wrap: root of the body frame
  let hasSpine = false, hasHead = false, hasLegs = false, hasArms = false;

  // xorshift32 — deterministic ambient glances per crew member.
  let rs = (seed >>> 0) || 1;
  const rand = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };

  // Host inputs.
  const hostLook = new THREE.Vector3();
  let hostLookOn = false, hostLookW = 1;
  let groundFn = null;
  let pendingKick = 0;

  // Eased state.
  let lookYaw = 0, lookPitch = 0, lookW = 0;
  const glance = new THREE.Vector3(0, figureHeight * 0.9, POSE.look.idleDist);
  let glanceAt = -Infinity;
  let reachRamp = 0;
  let lean = 0;
  let recoilP = 0, recoilV = 0;

  const lookTarget = new THREE.Vector3();   // body frame, this frame
  const handL = new THREE.Vector3(), handR = new THREE.Vector3();
  const footTarget = new THREE.Vector3();

  // Clip pose snapshot. The mixer rewrites every TRACKED bone each frame, but a
  // bone the current clip leaves alone would keep our delta and drift a little
  // further every frame. So the layers save the post-clip pose of every bone
  // they touch and restore() puts it back before the next mixer.update().
  const saved = [];          // [{ bone, q: Quaternion, p: Vector3 | null }]
  let hasSaved = false;

  function bind(model, postureWrap) {
    bones = findPoseBones(model);
    wrap = postureWrap;
    const b = bones;
    saved.length = 0; hasSaved = false;
    for (const key in b) if (b[key]) saved.push({ bone: b[key], q: new THREE.Quaternion(), p: key === 'hips' ? new THREE.Vector3() : null });
    hasSpine = !!(b.spineLo && b.spineHi && b.spineLo.parent && b.spineHi.parent);
    hasHead = !!(b.neck && b.head && b.neck.parent && b.head.parent === b.neck);
    hasLegs = !!(b.hips && b.lUpLeg && b.lLeg && b.lFoot && b.rUpLeg && b.rLeg && b.rFoot
      && b.lLeg.parent === b.lUpLeg && b.lFoot.parent === b.lLeg && b.rLeg.parent === b.rUpLeg && b.rFoot.parent === b.rLeg);
    hasArms = !!(b.lArm && b.lFore && b.lHand && b.rArm && b.rFore && b.rHand
      && b.lFore.parent === b.lArm && b.lHand.parent === b.lFore && b.rFore.parent === b.rArm && b.rHand.parent === b.rFore);
  }

  // Recompute the subtree's matrixWorld with the posture wrap as the root, so
  // every bone.matrixWorld is expressed in the body frame. The renderer's own
  // scene.updateMatrixWorld() overwrites these before drawing.
  function refresh() {
    const p = wrap.parent;
    wrap.parent = null;
    wrap.updateMatrixWorld(true);
    wrap.parent = p;
  }

  // ── Host API ────────────────────────────────────────────────────────────────
  // Target is in the frame the figure's group.position lives in (the host's
  // scene units); null clears it and the look fades out.
  function setLookTarget(target, weight = 1) {
    if (!target) { hostLookOn = false; return; }
    hostLook.set(Number(target.x) || 0, Number(target.y) || 0, Number(target.z) || 0);
    hostLookW = clamp(Number(weight) || 0, 0, 1);
    hostLookOn = true;
  }
  // fn(x, z) -> ground y under a foot, in the same frame as group.position.
  function setGroundFn(fn) { groundFn = typeof fn === 'function' ? fn : null; }
  // A hull impact: kicks the spine spring. strength 1 ≈ a firm jolt.
  function impulse(strength = 1) { pendingKick += Number(strength) || 0; }

  // Scene (group's parent frame) <-> body frame.
  function toBody(out, p, ctx) {
    return out.copy(p).sub(ctx.group.position).multiplyScalar(1 / ctx.scale).applyQuaternion(_qr.copy(ctx.rig.quaternion).invert());
  }
  function toScene(out, pBody, ctx) {
    return out.copy(pBody).applyQuaternion(ctx.rig.quaternion).multiplyScalar(ctx.scale).add(ctx.group.position);
  }

  // ── Layers ──────────────────────────────────────────────────────────────────
  function legsLayer(ctx) {
    const P = POSE.feet;
    const w = P.weight * (ctx.anim === 'walk' ? P.walkWeight : ctx.anim === 'climb' ? P.climbWeight : 1);
    if (!hasLegs || w <= 0) return;
    const b = bones;
    // Ground offset under each ankle, body-frame units. Default ground = the
    // figure's own feet, i.e. no change.
    let gyL = 0, gyR = 0;
    if (groundFn) {
      posOf(b.lFoot, _v); toScene(_w, _v, ctx);
      const gl = groundFn(_w.x, _w.z);
      if (Number.isFinite(gl)) gyL = (gl - ctx.group.position.y) / ctx.scale;
      posOf(b.rFoot, _v); toScene(_w, _v, ctx);
      const gr = groundFn(_w.x, _w.z);
      if (Number.isFinite(gr)) gyR = (gr - ctx.group.position.y) / ctx.scale;
    }
    gyL = clamp(gyL, -P.maxShift, P.maxShift);
    gyR = clamp(gyR, -P.maxShift, P.maxShift);
    if (Math.abs(gyL) < P.minShift && Math.abs(gyR) < P.minShift) return;
    // Pelvis follows the lower foot so that leg keeps its length; the other
    // leg bends. Applied to the Hips bone in its parent's local space.
    const shift = Math.min(gyL, gyR) * P.pelvisFollow * w;
    _off.set(0, 0, 0);
    if (Math.abs(shift) > 1e-4 && b.hips.parent) {
      _m.copy(b.hips.parent.matrixWorld).invert();
      posOf(b.hips, _v); _w.copy(_v); _w.y += shift;
      _v.applyMatrix4(_m); _w.applyMatrix4(_m);
      b.hips.position.add(_w.sub(_v));
      _off.set(0, shift, 0);
    }
    // Once the pelvis moves, BOTH feet need solving (the flat-ground foot must
    // stay put while the hips drop past it).
    const shifted = Math.abs(_off.y) > 1e-4;
    if (shifted || Math.abs(gyL) >= P.minShift) {
      posOf(b.lFoot, footTarget); footTarget.y += gyL;
      solveTwoBone(b.lUpLeg, b.lLeg, b.lFoot, footTarget, w, POLE_KNEE, _off, 0.999);
    }
    if (shifted || Math.abs(gyR) >= P.minShift) {
      posOf(b.rFoot, footTarget); footTarget.y += gyR;
      solveTwoBone(b.rUpLeg, b.rLeg, b.rFoot, footTarget, w, POLE_KNEE, _off, 0.999);
    }
  }

  function spineLayer(ctx) {
    const L = POSE.lean, R = POSE.recoil;
    const dt = ctx.dt;
    // Lean into velocity while moving.
    const moving = ctx.anim === 'walk' || ctx.anim === 'climb';
    const leanWant = moving ? Math.min(L.maxDeg, L.maxDeg * (ctx.speed / Math.max(1e-3, L.speedRef))) * DEG * L.weight : 0;
    lean += (leanWant - lean) * (1 - Math.exp(-dt / L.tau));
    // Recoil: second-order spring on spine pitch, kicked by impulse().
    if (pendingKick) { recoilV += pendingKick * R.kick; pendingKick = 0; }
    const om = 2 * Math.PI * R.hz;
    recoilV += (-om * om * recoilP - 2 * R.damping * om * recoilV) * dt;
    recoilP = clamp(recoilP + recoilV * dt, -R.maxDeg * DEG, R.maxDeg * DEG);
    if (Math.abs(recoilP) < 1e-5 && Math.abs(recoilV) < 1e-5) { recoilP = 0; recoilV = 0; }
    const pitch = lean + recoilP * R.weight;
    if (!hasSpine || Math.abs(pitch) < 1e-5) return;
    const b = bones;
    _q1.setFromAxisAngle(X_AXIS, pitch * 0.5);
    readBone(b.spineLo.parent, _v, _qP);
    readBone(b.spineLo, _v, _qA);
    applyDelta(b.spineLo, _q1, _qP);
    if (b.spineHi.parent === b.spineLo) _qB.copy(_q1).multiply(_qA);   // new parent rotation
    else readBone(b.spineHi.parent, _v, _qB);
    applyDelta(b.spineHi, _q1, _qB);
  }

  function armsLayer(ctx) {
    const P = POSE.reach;
    const dt = ctx.dt;
    const want = ctx.anim === 'work' ? 1 : 0;
    reachRamp = clamp(reachRamp + (want > reachRamp ? 1 : -1) * dt / Math.max(1e-3, P.ease), 0, 1);
    const w = smooth(reachRamp) * P.weight;
    if (!hasArms || w <= 0.001) return;
    const b = bones;
    const y = P.height * figureHeight;
    const bob = Math.sin(2 * Math.PI * P.bobHz * ctx.time + ctx.phase) * P.bobAmp;
    handL.set(P.spread, y + bob, P.ahead);
    handR.set(-P.spread, y - bob, P.ahead);
    _off.set(0, 0, 0);
    solveTwoBone(b.lArm, b.lFore, b.lHand, handL, w, POLE_ELBOW_L, _off, P.maxExtend);
    solveTwoBone(b.rArm, b.rFore, b.rHand, handR, w, POLE_ELBOW_R, _off, P.maxExtend);
  }

  function headLayer(ctx) {
    const P = POSE.look, R = POSE.recoil;
    const dt = ctx.dt;
    if (!hasHead) return;
    const b = bones;
    // Pick this frame's target (body frame) and weight.
    let wantW = 0;
    if (hostLookOn) { toBody(lookTarget, hostLook, ctx); wantW = hostLookW * P.weight; }
    else if (ctx.lookAt && Number.isFinite(ctx.lookAt.x)) { toBody(lookTarget, ctx.lookAt, ctx); wantW = P.weight; }
    else if (ctx.anim === 'work') { lookTarget.set(0, P.workUp, P.workAhead); wantW = P.weight; }
    else if (ctx.anim === 'idle') {
      if (ctx.time >= glanceAt) {
        const half = P.idleConeDeg * 0.5 * DEG;
        const yaw = (rand() * 2 - 1) * half, pitch = (rand() * 0.8 - 0.45) * half;
        glance.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
          .multiplyScalar(P.idleDist).add(_v.set(0, figureHeight * 0.9, 0));
        glanceAt = ctx.time + P.idleMinS + rand() * Math.max(0, P.idleMaxS - P.idleMinS);
      }
      lookTarget.copy(glance); wantW = P.idleWeight * P.weight;
    }
    const k = 1 - Math.exp(-dt / Math.max(1e-3, P.tau));
    if (wantW > 0) {
      posOf(b.head, _v);
      _dir.subVectors(lookTarget, _v);
      if (_dir.lengthSq() > 1e-6) {
        _dir.normalize();
        // Angles relative to the body's chest direction (+z of the body frame).
        const yaw = clamp(Math.atan2(_dir.x, _dir.z), -P.yawMaxDeg * DEG, P.yawMaxDeg * DEG);
        const pitch = clamp(Math.asin(clamp(_dir.y, -1, 1)), -P.pitchMaxDeg * DEG, P.pitchMaxDeg * DEG);
        lookYaw += (yaw - lookYaw) * k;
        lookPitch += (pitch - lookPitch) * k;
      }
    }
    lookW += (wantW - lookW) * k;
    const dip = recoilP * R.headDip * R.weight;
    if (lookW < 0.002 && Math.abs(dip) < 1e-5) return;
    // Rotation carrying +z to the eased direction: yaw about y, then pitch.
    _e.set(-lookPitch, lookYaw, 0, 'YXZ');
    _q1.setFromEuler(_e);
    readBone(b.neck.parent, _v, _qP);
    readBone(b.neck, _v, _qA);
    _q2.copy(IDENT).slerp(_q1, P.neckShare * lookW);
    applyDelta(b.neck, _q2, _qP);
    _qB.copy(_q2).multiply(_qA);                  // neck's new rotation = head's parent
    _q2.copy(IDENT).slerp(_q1, P.headShare * lookW);
    if (Math.abs(dip) > 1e-5) _q2.premultiply(_qk.setFromAxisAngle(X_AXIS, dip));
    applyDelta(b.head, _q2, _qB);
  }

  // Call before mixer.update(): undoes last frame's deltas on every bone the
  // layers touch, so nothing accumulates on bones the clip does not track.
  function restore() {
    if (!hasSaved) return;
    for (let i = 0; i < saved.length; i++) {
      const s = saved[i];
      s.bone.quaternion.copy(s.q);
      if (s.p) s.bone.position.copy(s.p);
    }
  }
  function save() {
    for (let i = 0; i < saved.length; i++) {
      const s = saved[i];
      s.q.copy(s.bone.quaternion);
      if (s.p) s.p.copy(s.bone.position);
    }
    hasSaved = true;
  }

  // ctx: { dt, time, anim, speed, phase, group, rig, scale, lookAt }
  function apply(ctx) {
    if (!bones || !wrap) return;
    save();
    refresh();
    legsLayer(ctx);
    spineLayer(ctx);
    refresh();
    armsLayer(ctx);
    headLayer(ctx);
  }

  return { bind, restore, apply, setLookTarget, setGroundFn, impulse };
}
