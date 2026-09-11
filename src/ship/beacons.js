// ── Attention beacons ────────────────────────────────────────────────────────
// "The single most useful thing this world can do is tell you, without being
// read, that something wants you." Tall, coloured unlike anything else on the
// ship, readable at a glance without moving the camera.
//
// Strictly real data: a beacon only exists while a count from ShipRoute is above
// zero. Nothing here runs on a timer, and idle stays silent by design — the
// moment everything has a badge, the one that matters is invisible.
import * as THREE from 'three';
import { STATIONS } from '../core/shipStations.js';

const LX = (x) => x - 640;
const LY = (y) => 360 - y;

// Which station owns which alert. Approvals are client comms; blocked work is
// the pipeline's problem.
export const ALERT_STATION = { approvals: 'comm', blocked: 'pipeline' };
const ALERT_COLOR = { approvals: 0xbf5af2, blocked: 0xE5E5EA };

function columnTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 8; c.height = 128;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 8, 128);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

export function createBeacons() {
  const group = new THREE.Group();
  const tex = columnTexture();
  const items = {};

  for (const [kind, stationId] of Object.entries(ALERT_STATION)) {
    const st = STATIONS.find((s) => s.id === stationId);
    if (!st) continue;
    const x = LX((st.px / 100) * 1280);
    const y = LY((st.py / 100) * 720);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, color: new THREE.Color(ALERT_COLOR[kind]),
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(9, 150, 1);
    sp.position.set(x, y + 75, 30);   // in front of the plate, rising from the post
    sp.visible = false;
    sp.renderOrder = 5;
    group.add(sp);
    items[kind] = { sprite: sp, mat };
  }

  function update(t, alerts) {
    const s = t * 0.001;
    for (const kind of Object.keys(items)) {
      const it = items[kind];
      const n = Number(alerts?.[kind] || 0);
      // Two-beat pulse: unmistakable without being a strobe.
      const beat = 0.42 + 0.26 * Math.max(0, Math.sin(s * 2.1)) + 0.08 * Math.sin(s * 5.7);
      const target = n > 0 ? beat : 0;
      it.mat.opacity += (target - it.mat.opacity) * 0.09;
      it.sprite.visible = it.mat.opacity > 0.015;
    }
  }

  function dispose() {
    for (const it of Object.values(items)) it.mat.dispose();
    tex?.dispose();
    if (group.parent) group.parent.remove(group);
  }

  return { group, update, dispose };
}
