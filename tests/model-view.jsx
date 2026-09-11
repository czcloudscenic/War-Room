// ── Model viewer harness: ?src=/hull/hull-meshy.glb&yaw=0.6&pitch=0.15 ──────
// Loads one GLB, frames it, reports its bounds in the bar. No login.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const p = new URLSearchParams(location.search);
const src = p.get('src') || '/hull/hull-meshy.glb';
const yaw = parseFloat(p.get('yaw') || '0.55'), pitch = parseFloat(p.get('pitch') || '0.18');
const W = 1180, H = 664;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
document.getElementById('root').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0e14);
const camera = new THREE.PerspectiveCamera(35, W / H, 0.01, 10000);
scene.add(new THREE.HemisphereLight(0x8fb4d8, 0x0b0d12, 0.9));
const key = new THREE.DirectionalLight(0xcfe0f5, 2.2); key.position.set(-2, 3, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0x4fa8e8, 1.4); rim.position.set(3, 2, -3); scene.add(rim);
new GLTFLoader().load(src, (g) => {
  const m = g.scene; scene.add(m);
  const box = new THREE.Box3().setFromObject(m); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
  m.position.sub(c);
  const r = Math.max(size.x, size.y, size.z);
  const d = r * 1.35;
  camera.position.set(Math.sin(yaw) * d, Math.sin(pitch) * d, Math.cos(yaw) * d); camera.lookAt(0, 0, 0);
  let meshes = 0, tris = 0; m.traverse(o => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  document.getElementById('bar').textContent = `${src} · size ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} · meshes ${meshes} · tris ${Math.round(tris)}`;
  window.__model = { size: [size.x, size.y, size.z], meshes, tris };
  renderer.render(scene, camera);
}, undefined, (e) => { document.getElementById('bar').textContent = 'load failed: ' + e; });
function loop() { renderer.render(scene, camera); requestAnimationFrame(loop); } loop();
