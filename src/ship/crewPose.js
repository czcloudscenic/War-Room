// ── Crew procedural pose layers ───────────────────────────────────────────────
// The rigged crew (crewGLB.js) play walk / idle / work clips. The joints are
// all there — knees, ankles, elbows, wrists, neck — but a clip alone never
// reacts to the room. These layers run AFTER the mixer and the posture
// corrector every frame and steer the joints toward the world, each blended by
// a weight so the clip still leads:
//
//   1. head look-at      neck 30% / head 70% toward a target, clamped, eased
//   2. foot planting     two-bone analytic IK per leg onto a ground function
//   3. console reach     two-bone IK on each arm to a point off its own shoulder
//   4. lean and recoil   spine pitch into velocity + a damped spring on impacts
//
// Every two-bone solve runs inside anatomical joint limits (POSE.limits): a
// soft reach ceiling, a clamped hinge angle, a hinge DIRECTION taken from the
// limb's rest pose at bind time, and a cone on the root ball joint. Without
// them the IK could drive an elbow straight or backwards, which shears the
// skinned sleeve off the forearm and is what "not one solid figure" looks like.
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
    // A standing leg is legitimately near-straight: because the chord of a
    // two-bone chain goes flat near full length, 0.99 of the chain is still
    // 16 deg of knee flex, while the 0.92 that suits an arm would be a visible
    // squat that lifts the feet off the deck. The knee's shear guard is the
    // hinge-direction clamp plus kneeMinDeg below, not a short leg.
    maxExtend: 0.99,
  },
  reach: {
    weight: 0.7,
    // The hand target is measured from that arm's OWN shoulder as a share of
    // its chain length (upper arm + forearm), NOT in figure units. The old
    // console point (0.34 of stature, 9 ahead) sits about 1.7 arm-lengths from
    // the shoulder of a 34-unit figure, so every working frame ended pinned at
    // maxExtend with the elbow locked dead straight — which is where a skinned
    // sleeve visibly comes apart from the forearm. sqrt(drop^2+ahead^2+out^2)
    // = 0.83, comfortably inside maxExtend even at the top of the typing bob,
    // so the elbow keeps a working bend at all times.
    drop: 0.55, ahead: 0.62, out: 0.05,
    bobHz: 3, bobAmp: 0.035,   // typing bob, also a share of the arm length
    ease: 0.4,            // seconds to fade in / out around the work state
    maxExtend: 0.90,      // fraction of the arm length a target may pull to
  },
  // ── The pelvis (added 2026-09-17) ──────────────────────────────────────
  // The oldest bug in the ship: nothing ever drove the Hips bone, so a
  // character stood perfectly square on two straight legs and walked as if
  // the legs were hinged to a board. Real hips do four things while walking
  // (counter-rotate, drop on the swing side, shift over the stance foot, and
  // rise and fall twice per stride) and one thing while standing (take the
  // weight on one leg — contrapposto — and swap every few seconds).
  hips: {
    weight: 1,
    // walking, driven by the stride phase read off the feet
    yawMaxDeg: 4,         // pelvis leads with the swinging leg's hip (the retargeted walk already carries half of this)
    rollMaxDeg: 3,        // that same hip drops; the stance hip carries
    swayAmp: 0.030,       // lateral shift over the stance foot, as a share of height
    bobAmp: 0.013,        // rise at mid-stance, dip at double support
    counterSpineDeg: 6,   // shoulders oppose the pelvis, or it reads as a lurch
    strideRef: 0.20,      // foot separation at full stride, share of height
    liftRef: 0.045,       // swing-foot clearance, share of height
    tau: 0.09,            // ease, so a change of gait is not a snap
    // standing
    standEveryS: 5.5, standEveryJitterS: 3,
    standRollDeg: 3,      // the weighted hip rides HIGH
    standSwayAmp: 0.028,  // and the body shifts over it
    standYawDeg: 3,
    standTau: 1.1,        // slow, so the shift is a settle and not a twitch
  },
  lean: { weight: 1, maxDeg: 6, speedRef: 30, tau: 0.2 },
  recoil: { weight: 1, hz: 2.4, damping: 0.35, kick: 0.9, maxDeg: 18, headDip: 0.6 },
  // ── Anatomical joint limits (added 2026-09-17) ──────────────────────────
  // "They're still not one solid figure": in close-up the sleeve and the
  // forearm came apart at the elbow. The skin weights are clean — it was the
  // IK driving joints into poses a body cannot hold. A joint at (or a hair
  // past) 180 deg shears the skinned mesh at the joint, and nothing in the
  // solver said which WAY a hinge may fold, so a target behind the hand could
  // hinge an elbow backwards. Every two-bone solve now runs inside:
  //   maxExtend   how far along the chain a target may pull, eased so the last
  //               stretch is asymptotic and the limb never snaps straight
  //   bend range  the middle joint's angle away from straight, clamped both ways
  //   cone        the root ball joint, clamped about its REST direction, so no
  //               single frame can swing a limb behind the torso
  //   pole        the hinge DIRECTION, taken from the limb's own rest bend
  //               (derived once at bind time, never per frame)
  limits: {
    elbowMinDeg: 6, elbowMaxDeg: 150,   // bend away from straight, degrees
    kneeMinDeg: 6, kneeMaxDeg: 150,     // (a knee's bend is backwards by definition
                                        //  of the pole: the knee itself points forward)
    shoulderConeDeg: 90, hipConeDeg: 60,  // root ball joint, from its rest direction
    poleMaxDeg: 75,     // how far the clip's own bend may stray from the rest hinge
    easeFrom: 0.85,     // share of the reach window where the soft stretch starts
  },
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
const _ref = new THREE.Vector3(), _t = new THREE.Vector3(), _pS = new THREE.Vector3();
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

// Force the angle between unit `v` and unit `ref` into [acos(cosHi), acos(cosLo)]
// (cosLo <= cosHi). v is rotated inside the v/ref plane, so a bend hint that
// started perpendicular to the chain stays perpendicular to it. When v is
// exactly opposite ref that plane is undefined and v snaps to ref.
function clampAngle(v, ref, cosLo, cosHi) {
  const c = clamp(v.dot(ref), -1, 1);
  if (c >= cosLo && c <= cosHi) return v;
  const want = c < cosLo ? cosLo : cosHi;
  _t.copy(v).addScaledVector(ref, -c);
  if (_t.lengthSq() < 1e-10) return v.copy(ref);
  _t.normalize();
  return v.copy(ref).multiplyScalar(want).addScaledVector(_t, Math.sqrt(Math.max(0, 1 - want * want)));
}

// Base of the triangle (l1, l2) whose apex — the middle joint — opens to theta.
const chord = (l1, l2, theta) => Math.sqrt(Math.max(1e-9, l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(theta)));

// Asymptotic ceiling: below easeFrom * cap nothing changes, above it the last
// stretch compresses and never actually arrives. A hard clamp is what made a
// reaching arm SNAP to straight and hold there; this makes it ease and stop short.
function softMax(d, cap, easeFrom) {
  const s = cap * easeFrom;
  if (d <= s) return d;
  const span = Math.max(1e-6, cap - s);
  return s + span * Math.tanh((d - s) / span);
}

// Per-limb constants derived ONCE at bind time from the rest pose (see limbRest):
//   pole     which side the middle joint already sits on (the hinge direction)
//   restDir  the root bone's rest direction, centre of its ball-joint cone
// Live angle limits are read from POSE each solve so they stay tunable.
const _lim = { maxExtend: 1, bendMin: 0, bendMax: Math.PI, coneCos: -1, poleCos: -1, easeFrom: 0.85 };
function limitsFor(kind) {
  const L = POSE.limits;
  const arm = kind === 'arm';
  _lim.maxExtend = clamp(Number(arm ? POSE.reach.maxExtend : POSE.feet.maxExtend) || 0.9, 0.1, 0.999);
  _lim.bendMin = clamp(arm ? L.elbowMinDeg : L.kneeMinDeg, 0, 90) * DEG;
  _lim.bendMax = clamp(arm ? L.elbowMaxDeg : L.kneeMaxDeg, _lim.bendMin / DEG + 1, 179) * DEG;
  _lim.coneCos = Math.cos(clamp(arm ? L.shoulderConeDeg : L.hipConeDeg, 1, 180) * DEG);
  _lim.poleCos = Math.cos(clamp(L.poleMaxDeg, 1, 180) * DEG);
  _lim.easeFrom = clamp(L.easeFrom, 0.1, 0.99);
  return _lim;
}

// Rest-pose facts for one two-bone chain, in the body frame. Called from bind()
// only: the hinge direction must NOT be re-derived per frame, or a frame that
// already broke the joint would teach the solver that broken is correct.
function limbRest(a, b, c, fallbackPole) {
  if (!a || !b || !c) return null;
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
  posOf(a, pA); posOf(b, pB); posOf(c, pC);
  const l1 = pA.distanceTo(pB), l2 = pB.distanceTo(pC);
  if (l1 < 1e-5 || l2 < 1e-5) return null;
  const restDir = pB.clone().sub(pA).normalize();
  const pole = fallbackPole.clone().normalize();
  const ac = pC.clone().sub(pA);
  if (ac.lengthSq() > 1e-8) {
    ac.normalize();
    const perp = pB.clone().sub(pA);
    perp.addScaledVector(ac, -perp.dot(ac));
    // Accept the rig's own bend only if it is a real offset AND it agrees with
    // anatomy; a rig modelled dead straight (or with noise at the joint) falls
    // back to the constant.
    if (perp.length() > 0.02 * l1 && perp.clone().normalize().dot(pole) > 0) pole.copy(perp.normalize());
  }
  return { pole, restDir, l1, l2 };
}

// Two-bone analytic IK (law of cosines in the plane of a-b-c), inside the
// joint limits above.
//   a: root bone (hip / shoulder), b: mid (knee / elbow), c: end (ankle / wrist)
//   target: body-frame point for c; w: blend 0..1; limb: limbRest() record;
//   offset: body-frame shift already applied to the chain's root (hips moved)
//   but not yet in the matrices; lim: limitsFor() record.
function solveTwoBone(a, b, c, target, w, limb, offset, lim) {
  if (w <= 0 || !a || !b || !c || !a.parent || !limb) return;
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
  // Reach window. The far end is the tighter of maxExtend and the minimum
  // bend; the near end is the maximum bend (an elbow cannot fold flat).
  const near = Math.max(Math.abs(l1 - l2) + 1e-3, chord(l1, l2, Math.PI - lim.bendMax));
  const far = Math.max(near + 1e-3, Math.min((l1 + l2) * lim.maxExtend, chord(l1, l2, Math.PI - lim.bendMin)));
  d = softMax(d, far, lim.easeFrom);
  if (d < near) d = near;
  // Bend plane. Start from the clip's own knee / elbow side, then clamp that
  // to the rest hinge direction: the clip may choose within poleMaxDeg, it may
  // never fold the joint the other way. When the rest hinge is parallel to the
  // reach direction the hinge axis is genuinely undefined (reaching straight
  // along the elbow's own axis) and the clip's side stands.
  _ab.subVectors(_pB, _pA);
  _ref.copy(limb.pole).addScaledVector(_dir, -limb.pole.dot(_dir));
  const refOk = _ref.lengthSq() > 1e-6;
  if (refOk) _ref.normalize();
  _perp.copy(_ab).addScaledVector(_dir, -_ab.dot(_dir));
  if (_perp.lengthSq() < 1e-6 * l1 * l1) { if (!refOk) return; _perp.copy(_ref); }
  else { _perp.normalize(); if (refOk) clampAngle(_perp, _ref, lim.poleCos, 1); }
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  // Root bone: swing the current a->b onto the solved direction, then hold the
  // ball joint inside its cone so a limb can never swing behind the torso.
  _u2.copy(_dir).multiplyScalar(cosA).addScaledVector(_perp, sinA).normalize();
  clampAngle(_u2, limb.restDir, lim.coneCos, 1);
  _u1.copy(_ab).normalize();
  _q1.setFromUnitVectors(_u1, _u2);
  if (w < 1) _q1.slerp(IDENT, 1 - w);
  applyDelta(a, _q1, _qP);
  // Where the chain now is (rigid under q1), without re-reading matrices.
  _nb.copy(_ab).applyQuaternion(_q1).add(_pA);
  _nc.subVectors(_pC, _pB).applyQuaternion(_q1).add(_nb);
  // Mid bone: swing b->c onto b->target (the reach-clamped target), with the
  // joint angle itself clamped — the cone above can leave the chain unable to
  // close on the target, and without this the hinge would take up the slack by
  // going straight.
  _tgt.copy(_pA).addScaledVector(_dir, d);
  _u1.subVectors(_nc, _nb);
  _u2.subVectors(_tgt, _nb);
  if (_u1.lengthSq() < 1e-10 || _u2.lengthSq() < 1e-10) return;
  _u1.normalize(); _u2.normalize();
  _ref.subVectors(_pA, _nb);
  if (_ref.lengthSq() > 1e-10) {
    _ref.normalize();
    // Interior angle at the middle joint, between b->a and b->c: allowed range
    // is [PI - bendMax, PI - bendMin], and cos runs the other way.
    clampAngle(_u2, _ref, Math.cos(Math.PI - lim.bendMin), Math.cos(Math.PI - lim.bendMax));
  }
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
  // Rest-pose facts per limb, derived once in bind(): hinge direction and the
  // centre of the root ball joint's cone.
  const limbs = { lArm: null, rArm: null, lLeg: null, rLeg: null };

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
    // Joint limits: measure the rest pose ONCE, in the body frame. Which way a
    // knee or an elbow folds is a fact about the rig, not about this frame's
    // target, so it is read here and never again.
    limbs.lArm = limbs.rArm = limbs.lLeg = limbs.rLeg = null;
    if (wrap) {
      refresh();
      if (hasArms) {
        limbs.lArm = limbRest(b.lArm, b.lFore, b.lHand, POLE_ELBOW_L);
        limbs.rArm = limbRest(b.rArm, b.rFore, b.rHand, POLE_ELBOW_R);
      }
      if (hasLegs) {
        limbs.lLeg = limbRest(b.lUpLeg, b.lLeg, b.lFoot, POLE_KNEE);
        limbs.rLeg = limbRest(b.rUpLeg, b.rLeg, b.rFoot, POLE_KNEE);
      }
    }
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

  // Pelvis state: eased stride signals plus the standing weight-shift clock.
  const hipS = { u: 0, lift: 0, side: 1, sideEased: 1, nextShift: 2 };

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
    const lim = limitsFor('leg');
    if (shifted || Math.abs(gyL) >= P.minShift) {
      posOf(b.lFoot, footTarget); footTarget.y += gyL;
      solveTwoBone(b.lUpLeg, b.lLeg, b.lFoot, footTarget, w, limbs.lLeg, _off, lim);
    }
    if (shifted || Math.abs(gyR) >= P.minShift) {
      posOf(b.rFoot, footTarget); footTarget.y += gyR;
      solveTwoBone(b.rUpLeg, b.rLeg, b.rFoot, footTarget, w, limbs.rLeg, _off, lim);
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

  // The hand target hangs off that arm's OWN shoulder, in arm-lengths, so it is
  // reachable by construction on every character and the elbow never has to
  // lock out to get there. `side` is +1 for the body's left (+x).
  function reachHand(out, a, limb, side, bob) {
    const P = POSE.reach;
    const len = limb.l1 + limb.l2;
    posOf(a, _pS);
    out.set(_pS.x + side * P.out * len, _pS.y - (P.drop + bob) * len, _pS.z + P.ahead * len);
  }

  function armsLayer(ctx) {
    const P = POSE.reach;
    const dt = ctx.dt;
    const want = ctx.anim === 'work' ? 1 : 0;
    reachRamp = clamp(reachRamp + (want > reachRamp ? 1 : -1) * dt / Math.max(1e-3, P.ease), 0, 1);
    const w = smooth(reachRamp) * P.weight;
    if (!hasArms || w <= 0.001 || !limbs.lArm || !limbs.rArm) return;
    const b = bones;
    const bob = Math.sin(2 * Math.PI * P.bobHz * ctx.time + ctx.phase) * P.bobAmp;
    const lim = limitsFor('arm');
    _off.set(0, 0, 0);
    reachHand(handL, b.lArm, limbs.lArm, 1, bob);
    solveTwoBone(b.lArm, b.lFore, b.lHand, handL, w, limbs.lArm, _off, lim);
    reachHand(handR, b.rArm, limbs.rArm, -1, -bob);
    solveTwoBone(b.rArm, b.rFore, b.rHand, handR, w, limbs.rArm, _off, lim);
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
  // Pelvis. Runs FIRST: the feet layer plants the feet against whatever the
  // pelvis just did, which is the right order (hips lead, feet answer).
  function hipsLayer(ctx) {
    const P = POSE.hips;
    if (!hasLegs || !(P.weight > 0)) return;
    const b = bones;
    const dt = Math.max(0, Math.min(0.1, ctx.dt || 0.016));
    // Height from the pelvis: on these rigs Hips sits at ~0.53 of stature.
    posOf(b.hips, _pA);
    const height = Math.max(1e-3, _pA.y / 0.53);
    posOf(b.lFoot, _pB); posOf(b.rFoot, _pC);

    const walking = ctx.anim === 'walk' || ctx.anim === 'climb';
    let yawDeg = 0, rollDeg = 0, swayX = 0, bobY = 0, counterDeg = 0;

    if (walking) {
      // Stride phase straight off the feet: no clip times, no assumptions.
      // u  > 0  left foot is forward     lift > 0  left foot is in the air
      const u = clamp((_pB.z - _pC.z) / (P.strideRef * height), -1, 1);
      const lift = clamp((_pB.y - _pC.y) / (P.liftRef * height), -1, 1);
      const k = 1 - Math.exp(-dt / Math.max(1e-3, P.tau));
      hipS.u += (u - hipS.u) * k;
      hipS.lift += (lift - hipS.lift) * k;
      // The body's LEFT is +x (facing +z, up +y). A positive rotation about Y
      // carries +x toward -z, so leading with the left hip is a NEGATIVE yaw.
      yawDeg = -P.yawMaxDeg * hipS.u;
      // Positive roll about +z lifts +x, so the airborne side drops.
      rollDeg = -P.rollMaxDeg * hipS.lift;
      // Weight travels over the planted (lower) foot.
      swayX = -P.swayAmp * height * hipS.lift;
      // Highest with the feet together, lowest at double support: twice a stride.
      bobY = P.bobAmp * height * (0.5 - Math.abs(hipS.u));
      counterDeg = P.counterSpineDeg * hipS.u;
    } else {
      // Standing: take the weight on one leg and swap every few seconds.
      hipS.nextShift -= dt;
      if (hipS.nextShift <= 0) {
        hipS.side = -hipS.side;
        hipS.nextShift = P.standEveryS + (ctx.time % 1) * P.standEveryJitterS;
      }
      const k = 1 - Math.exp(-dt / Math.max(1e-3, P.standTau));
      hipS.sideEased += (hipS.side - hipS.sideEased) * k;
      const w = hipS.sideEased;
      // Weighted hip rides high, body settles over it, a little off-square.
      rollDeg = P.standRollDeg * w;
      swayX = P.standSwayAmp * height * w;
      yawDeg = P.standYawDeg * w;
      counterDeg = -P.standRollDeg * 0.5 * w;
      hipS.u += (0 - hipS.u) * Math.min(1, dt * 4);
      hipS.lift += (0 - hipS.lift) * Math.min(1, dt * 4);
    }

    const wgt = P.weight;
    // Rotation, in the body frame, applied through the pelvis's parent.
    //
    // Hips is the ROOT bone: both thighs and the spine hang off it. Rotating
    // it alone tilts the whole lower body, and the feet layer then drags the
    // feet back to the deck, so the thighs end up wrenched against a pelvis
    // that moved without them. That is the twist at the hip. A real pelvis
    // tilts and turns UNDER the legs; the legs stay planted. So the same
    // delta, inverted, goes straight back onto each thigh, and only the
    // pelvis (and what rides on it above the waist) actually moves.
    if (Math.abs(yawDeg) > 1e-3 || Math.abs(rollDeg) > 1e-3) {
      _e.set(0, yawDeg * wgt * Math.PI / 180, rollDeg * wgt * Math.PI / 180, 'YZX');
      _qA.setFromEuler(_e);
      readBone(b.hips.parent, _pC, _qP);
      applyDelta(b.hips, _qA, _qP);
      _qB.copy(_qA).invert();
      readBone(b.hips, _pC, _qP);            // the pelvis AFTER its delta = the thighs' parent
      applyDelta(b.lUpLeg, _qB, _qP);
      applyDelta(b.rUpLeg, _qB, _qP);
    }
    // Translation: build the offset in the body frame, convert to the parent's
    // local space as a delta (same trick the feet layer uses for pelvisFollow).
    if (Math.abs(swayX) > 1e-4 || Math.abs(bobY) > 1e-4) {
      _off.set(swayX * wgt, bobY * wgt, 0);
      posOf(b.hips, _v); _w.copy(_v).add(_off);
      _m.copy(b.hips.parent.matrixWorld).invert();
      _v.applyMatrix4(_m); _w.applyMatrix4(_m);
      b.hips.position.add(_w.sub(_v));
    }
    // Shoulders oppose the pelvis, or the whole torso reads as a lurch.
    if (hasSpine && Math.abs(counterDeg) > 1e-3) {
      _e.set(0, counterDeg * wgt * Math.PI / 180, 0, 'YZX');
      _qB.setFromEuler(_e);
      readBone(b.spineHi.parent, _pC, _qP);
      applyDelta(b.spineHi, _qB, _qP);
    }
  }

  function apply(ctx) {
    if (!bones || !wrap) return;
    save();
    refresh();
    hipsLayer(ctx);
    refresh();
    legsLayer(ctx);
    spineLayer(ctx);
    refresh();
    armsLayer(ctx);
    headLayer(ctx);
  }

  // How strongly the reach layer owns the arms this frame, 0..1. crewGLB's
  // correctPosture() tucks the same upper-arm bones; it fades its tuck out by
  // this, so exactly one layer writes a shoulder at a time.
  function armReachWeight() { return POSE.reach.weight > 0 ? smooth(reachRamp) : 0; }

  return { bind, restore, apply, setLookTarget, setGroundFn, impulse, armReachWeight };
}
