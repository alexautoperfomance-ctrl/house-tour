import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
// model.py coords (X east, Y north, Z up) -> three (x, z, -y)
const V = (x, y, z) => new THREE.Vector3(x, z, -y);

const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
let prCap = isTouch ? 1.5 : 2;
const setPR = q => renderer.setPixelRatio(Math.min(devicePixelRatio, prCap) * q);
setPR(isTouch ? 0.75 : 1); if (isTouch) $('pr').value = '0.75';
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.08, 800);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.495; orbit.minDistance = 4; orbit.maxDistance = 120;
const CENTER = V(13, 5.5, 2.5);
orbit.target.copy(CENTER); camera.position.copy(V(-6, -16, 14));

// ---------- sky, sun, environment ----------
const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
const su = sky.material.uniforms;
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
const sc = sun.shadow.camera; sc.left = sc.bottom = -26; sc.right = sc.top = 26; sc.near = 1; sc.far = 140;
sun.target.position.copy(CENTER); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a5a32, 0.35); scene.add(hemi);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function setSky(elev, azim, turb, ray) {
  su.turbidity.value = turb; su.rayleigh.value = ray; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.8;
  const p = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
  su.sunPosition.value.copy(p);
  sun.position.copy(CENTER).addScaledVector(p, 70);
  const s2 = new THREE.Scene(); const sk = new Sky(); sk.scale.setScalar(1000);
  for (const k in su) sk.material.uniforms[k].value = su[k].value; s2.add(sk);
  envRT?.dispose(); envRT = pmrem.fromScene(s2, 0, 0.1, 2000); scene.environment = envRT.texture;
}

// ---------- procedural textures ----------
function canvasTex(size, draw, rep = 1, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function noise(g, s, base, amp, n, rmax) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) { const v = rnd(-amp, amp); g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.beginPath(); g.arc(rnd(0, s), rnd(0, s), rnd(0.5, rmax), 0, 7); g.fill(); }
}
function planks(g, s, cols, gap, grain) { // cols = array of rgb
  const rows = 8; const h = s / rows;
  for (let r = 0; r < rows; r++) { let x = -rnd(0, s / 2);
    while (x < s) { const w = rnd(s * 0.35, s * 0.7); const c = cols[(Math.random() * cols.length) | 0];
      const k = rnd(0.85, 1.1); g.fillStyle = `rgb(${c[0] * k},${c[1] * k},${c[2] * k})`; g.fillRect(x, r * h, w, h);
      for (let i = 0; i < grain; i++) { g.strokeStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,240,220'},${rnd(.03, .1)})`;
        g.lineWidth = rnd(.5, 2); const y = r * h + rnd(0, h); g.beginPath(); g.moveTo(x, y);
        g.bezierCurveTo(x + w * .3, y + rnd(-3, 3), x + w * .6, y + rnd(-3, 3), x + w, y + rnd(-2, 2)); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, r * h, gap, h); x += w; }
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, r * h, s, gap); }
}
const T = {
  plaster: canvasTex(512, (g, s) => noise(g, s, '#d4d1c8', .05, 9000, 2.5)),
  concrete: canvasTex(512, (g, s) => { noise(g, s, '#8e8d88', .09, 12000, 3); g.fillStyle = 'rgba(0,0,0,.25)';
    for (let i = 0; i < 20; i++) { g.beginPath(); g.arc(rnd(0, s), rnd(0, s), rnd(1, 3), 0, 7); g.fill(); } }),
  floor: canvasTex(1024, (g, s) => planks(g, s, [[150, 108, 70], [160, 118, 78], [138, 98, 62]], 2, 18)),
  oak: canvasTex(1024, (g, s) => planks(g, s, [[120, 74, 40], [134, 84, 46], [108, 66, 36]], 4, 22)),
  deck: canvasTex(512, (g, s) => planks(g, s, [[96, 64, 40], [86, 58, 36]], 4, 10)),
  panel: canvasTex(512, (g, s) => { noise(g, s, '#2a2d31', .04, 4000, 2); g.fillStyle = 'rgba(0,0,0,.6)';
    for (let i = 0; i < 4; i++) g.fillRect(i * s / 4, 0, 3, s); g.fillRect(0, 0, s, 3); }),
  grass: canvasTex(512, (g, s) => { g.fillStyle = '#3d5a22'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26000; i++) { const h = rnd(70, 105), l = rnd(18, 38); g.strokeStyle = `hsl(${h},${rnd(35, 60)}%,${l}%)`;
      g.lineWidth = 1; const x = rnd(0, s), y = rnd(0, s); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y - rnd(3, 8)); g.stroke(); } }),
  paving: canvasTex(512, (g, s) => { noise(g, s, '#77756f', .07, 6000, 2); g.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i <= 4; i++) { g.fillRect(i * s / 4, 0, 2, s); g.fillRect(0, i * s / 2, s, 2); } }),
};
// texture scale: metres per tile
const TS = { plaster: 2, concrete: 3, floor: 2.4, oak: 1.6, deck: 2.4, panel: 2.4, grass: 4, paving: 2 };

// box-project UVs in world space (1 tile = TS m)
function worldUV(mesh, tile) {
  const g = mesh.geometry = mesh.geometry.clone(); mesh.updateWorldMatrix(true, false);
  const p = g.attributes.position, n = g.attributes.normal; if (!n) return;
  const m = mesh.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(m);
  const uv = new Float32Array(p.count * 2), v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); w.fromBufferAttribute(n, i).applyMatrix3(nm);
    const ax = Math.abs(w.x), ay = Math.abs(w.y), az = Math.abs(w.z); let a, b;
    if (ay >= ax && ay >= az) { a = v.x; b = v.z; } else if (ax >= az) { a = v.z; b = v.y; } else { a = v.x; b = v.y; }
    uv[i * 2] = a / tile; uv[i * 2 + 1] = b / tile; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function makeMat(name, old) {
  const c = old.color.clone(); const M = (o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0 }, o));
  switch (name) {
    case 'plaster': return [M({ map: T.plaster, color: 0xffffff, roughness: 0.92, bumpMap: T.plaster, bumpScale: 0.6 }), 'plaster'];
    case 'white': return [M({ map: T.plaster, color: 0xf2f2ee, roughness: 0.9 }), 'plaster'];
    case 'dark': return [M({ map: T.panel, color: 0xffffff, roughness: 0.55, metalness: 0.35 }), 'panel'];
    case 'concrete': case 'stone': return [M({ map: T.concrete, color: name === 'stone' ? 0xfaf6ee : 0xffffff, roughness: 0.85, bumpMap: T.concrete, bumpScale: 0.8 }), 'concrete'];
    case 'plinth': return [M({ map: T.concrete, color: 0x555555, roughness: 0.8 }), 'concrete'];
    case 'floor': return [M({ map: T.floor, color: 0xffffff, roughness: 0.45 }), 'floor'];
    case 'deck': return [M({ map: T.deck, color: 0xffffff, roughness: 0.75 }), 'deck'];
    case 'wood': return [M({ map: T.oak, color: 0xffffff, roughness: 0.6 }), 'oak'];
    case 'roof': return [M({ map: T.concrete, color: 0x606468, roughness: 0.9 }), 'concrete'];
    case 'glass': case 'rail': return [new THREE.MeshPhysicalMaterial({ color: 0xdfeff2, roughness: 0.03, metalness: 0, transparent: true,
      opacity: name === 'rail' ? 0.18 : 0.22, envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1 }), null];
    case 'frame': case 'gate': return [M({ roughness: 0.4, metalness: 0.6 }), null];
    case 'grass': return [M({ map: T.grass, color: 0xffffff, roughness: 0.95 }), 'grass'];
    case 'paving': return [M({ map: T.paving, color: 0xffffff, roughness: 0.85 }), 'paving'];
    case 'lamp': return [M({ emissive: 0xffd9a0, emissiveIntensity: 0.0, roughness: 0.3 }), null];
    case 'leaf': case 'pine': return [M({ roughness: 0.9, flatShading: true }), null];
    case 'trunk': return [M({ roughness: 0.8 }), null];
    case 'fabric': return [M({ roughness: 1 }), null];
    default: return [M({}), null];
  }
}

// ---------- ground & extra trees ----------
const big = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: T.grass.clone(), roughness: 1, color: 0xdddddd }));
big.material.map.repeat.set(150, 150); big.material.map.needsUpdate = true;
big.rotation.x = -Math.PI / 2; big.position.y = -0.5; big.receiveShadow = true; scene.add(big);
function addTrees() {
  const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 3, 7), crownG = new THREE.IcosahedronGeometry(1.8, 1), pineG = new THREE.ConeGeometry(1.5, 6, 8);
  const tm = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 });
  const lm = new THREE.MeshStandardMaterial({ color: 0x3f6a25, roughness: 0.9, flatShading: true });
  const pm = new THREE.MeshStandardMaterial({ color: 0x1f4524, roughness: 0.9, flatShading: true });
  const spots = [[-12, -8], [-14, 6], [-10, 20], [40, -10], [42, 4], [38, 20], [30, -22], [5, -24], [-6, -20], [20, -30], [-18, -18], [46, -24]];
  for (const [x, y] of spots) {
    const s = rnd(0.8, 1.3), pine = Math.random() < 0.45;
    const t = new THREE.Mesh(trunkG, tm); t.position.copy(V(x, y, -0.5 + 1.5 * s)); t.scale.setScalar(s);
    const c = new THREE.Mesh(pine ? pineG : crownG, pine ? pm : lm); c.position.copy(V(x, y, -0.5 + (pine ? 5 : 4) * s)); c.scale.setScalar(s);
    for (const m of [t, c]) { m.castShadow = true; scene.add(m); }
  }
}
addTrees();

// ---------- rooms (from model.py: OX=12.2, OY=0.4) ----------
const F1 = 0, F2 = 3.3, FG = -0.15;
const ROOMS = {
  ext: [['С улицы', [16, 30, 1.7], [17, 8, 2.5]], ['Из сада', [30, -14, 1.7], [18, 5, 3]], ['Сверху', [18.5, -2, 38], [18.5, 6.5, 0]]],
  gf: [['Холл', [16.6, 8.6, F1], [17, 3, F1 + 1.4]], ['Гостиная (второй свет)', [19.5, 1.2, F1], [24.5, 4.5, F1 + 2.4]],
    ['Кухня', [22.5, 4.6, F1], [18, 3, F1 + 1.0]], ['Гостевая спальня 1', [15.6, 3.4, F1], [13.2, 1.2, F1 + 1.2]],
    ['Гостевая спальня 2', [15.6, 6.8, F1], [13.2, 4.6, F1 + 1.2]], ['Санузел гостевой', [20.4, 9.8, F1], [21.9, 11.3, F1 + 1]],
    ['Предбанник', [23.2, 7.2, F1], [24.9, 8.2, F1 + 1.2]], ['Сауна', [23.2, 9.5, F1], [25.2, 11.0, F1 + 0.8]],
    ['Гараж на 4 авто', [10.8, 9.2, FG], [2, 13.5, FG + 1.2]], ['Терраса (сад)', [25, -2.5, -0.25], [18, 2, 1.5]]],
  sf: [['Галерея', [17.8, 7.0, F2], [24.5, 3.5, F2 - 0.5]], ['Спальня мастер', [21.2, 2.6, F2], [16.6, 0.8, F2 + 1.2]],
    ['Санузел мастер', [19.9, 5.9, F2], [21.4, 4.0, F2 + 1.0]], ['Спальня 2', [15.6, 8.4, F2], [13, 11, F2 + 1.2]],
    ['Ванная', [19.2, 8.6, F2], [20.4, 11.3, F2 + 1]], ['Спальня 3', [21.4, 8.8, F2], [25, 11, F2 + 1.2]],
    ['Терраса 2 этажа', [15.8, 5.5, 3.3], [12.8, 0.5, 3.2]]],
};
const ROOM_POLY = [ // [name, x1,y1,x2,y2, floor] global
  ['Тамбур', 18.34, 9.96, 20.18, 11.72, 1], ['Санузел гостевой', 20.3, 9.44, 22.28, 11.72, 1], ['Кладовая', 18.34, 6.6, 19.78, 8.04, 1],
  ['Кухня-гостиная', 17.32, 0.4, 25.48, 6.4, 1], ['Гостевая спальня 1', 12.2, 0.4, 15.8, 3.82, 1], ['Гостевая спальня 2', 12.2, 3.94, 15.8, 7.36, 1],
  ['Тамбур гаража', 12.2, 7.56, 15.8, 9.2, 1], ['Котельная', 12.2, 9.32, 13.94, 11.72, 1], ['Постирочная', 14.06, 9.32, 15.8, 11.72, 1],
  ['Предбанник', 22.48, 6.6, 25.48, 8.6, 1], ['Сауна', 22.48, 8.72, 25.48, 11.72, 1], ['Гараж', 0.4, 8, 11.8, 14.6, 1],
  ['Холл', 16, 3, 22.3, 11.72, 1],
  ['Санузел мастер', 19.72, 3.82, 21.68, 6.4, 2], ['Гардеробная', 16, 3.82, 18.18, 6.4, 2], ['Спальня мастер', 16, 0.4, 21.68, 6.4, 2],
  ['Спальня 2', 12.2, 7.56, 15.8, 11.72, 2], ['Ванная', 18.34, 8.2, 20.76, 11.72, 2], ['Спальня 3', 20.88, 8.2, 25.48, 11.72, 2],
  ['Галерея', 16, 6.6, 25.48, 8.2, 2], ['Второй свет', 21.8, 0.4, 25.48, 6.6, 2], ['Терраса', 11.8, 0, 15.6, 7.16, 2],
];
function roomAt(p) { const x = p.x, y = -p.z, f = p.y > 3.1 ? 2 : 1;
  if (x < 0 || x > 26.5 || y < -0.5 || y > 15.2) return 'Участок';
  for (const r of ROOM_POLY) if (r[5] === f && x >= r[1] && x <= r[3] && y >= r[2] && y <= r[4]) return (f === 2 ? '2 эт. · ' : '1 эт. · ') + r[0];
  return f === 2 ? '2 этаж' : 'Участок'; }


// sauna interior: oak/aspen lining + benches (not present in GLB)
function saunaFit() {
  const m = new THREE.MeshStandardMaterial({ map: T.oak.clone(), color: 0xf0c890, roughness: 0.7 }); m.map.repeat.set(1, 1);
  const x1 = 22.5, x2 = 25.46, y1 = 8.74, y2 = 11.7, H = 2.6, t = 0.02;
  const box = (ax, ay, az, bx, by, bz) => { const g = new THREE.BoxGeometry(bx - ax, bz - az, by - ay); const o = new THREE.Mesh(g, m);
    o.position.copy(V((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)); o.castShadow = o.receiveShadow = true; scene.add(o); worldUV(o, 1.6); colliders.push(o); };
  box(x1, y1, 0, x1 + t, y2, H); box(x2 - t, y1, 0, x2, y2, H); box(x1, y2 - t, 0, x2, y2, H); box(x1, y1, H - t, x2, y2, H);
  box(x1, y1, 0, x1 + 0.9, y1 + t, H);
  box(x1 + 0.05, y2 - 0.65, 0.85, x2 - 0.05, y2 - 0.05, 0.9); box(x1 + 0.05, y2 - 1.15, 0.42, x2 - 0.05, y2 - 0.65, 0.47);
  const stove = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 }));
  stove.position.copy(V(x2 - 0.4, y1 + 0.4, 0.4)); stove.castShadow = true; scene.add(stove);
  const lamp = new THREE.PointLight(0xffa860, 2.5, 4, 1.5); lamp.position.copy(V(x1 + 1.5, y2 - 0.4, 2.2)); scene.add(lamp);
}
// ---------- load model ----------
const colliders = [], upper = [], lampMats = [];
const evLights = new THREE.Group(); scene.add(evLights); evLights.visible = false;
const NOCOLL = /^(ground|drive|path|street|fence|wire|Icosphere|Cone)/;
new GLTFLoader().load('house_model.glb', gltf => {
  const root = gltf.scene; scene.add(root); root.updateMatrixWorld(true);
  const cache = {}; const box = new THREE.Box3();
  root.traverse(o => {
    if (!o.isMesh) return; const mn = o.material.name || '';
    if (!cache[mn]) cache[mn] = makeMat(mn, o.material);
    const [mat, tk] = cache[mn]; o.material = mat; if (tk) worldUV(o, TS[tk]);
    if (mn === 'lamp') lampMats.push(mat);
    const glass = mn === 'glass' || mn === 'rail';
    o.castShadow = !glass && !/^(ground|drive|path|street)/.test(o.name); o.receiveShadow = true;
    if (glass) o.renderOrder = 2;
    if (!NOCOLL.test(o.name)) colliders.push(o);
    box.setFromObject(o); const cy = (box.min.y + box.max.y) / 2;
    const tree = ['leaf', 'pine', 'trunk'].includes(mn) || /^(Icosphere|Cone|Cylinder)/.test(o.name);
    if (!tree && box.min.y > 2.8 && cy > 3.0) upper.push(o);
  });
  // warm interior lights for evening
  const LP = [[20, 3, 2.7], [23.6, 3, 5.6], [17, 9, 2.7], [14, 2, 2.7], [14, 5.6, 2.7], [21.3, 10.5, 2.7], [24, 7.5, 2.7], [24, 10, 2.5],
    [6, 11, 2.7], [18.8, 2, 6], [14, 9.6, 6], [19.5, 10, 6], [23, 10, 6], [20, 7.4, 6], [20.6, 5, 6], [18, 12.4, 2.6]];
  for (const [x, y, z] of LP) { const l = new THREE.PointLight(0xffb36b, 6, 9, 1.6); l.position.copy(V(x, y, z)); evLights.add(l); }
  saunaFit(); $('loader').remove(); window.__loaded = true; setDay(false);
}, e => { if (e.total) $('pct').textContent = Math.round(e.loaded / e.total * 100) + '%'; },
  err => { $('pct').textContent = 'ошибка: ' + err.message; console.error(err); });

function setDay(ev) {
  if (ev) { setSky(2.5, 235, 8, 2.5); sun.color.set(0xff9a5a); sun.intensity = 0.7; hemi.intensity = 0.12; renderer.toneMappingExposure = 0.75;
    scene.environmentIntensity = 0.35; evLights.visible = true; lampMats.forEach(m => m.emissiveIntensity = 3); }
  else { setSky(38, 200, 4, 1.2); sun.color.set(0xfff4e5); sun.intensity = 3.2; hemi.intensity = 0.35; renderer.toneMappingExposure = 0.9;
    scene.environmentIntensity = 1; evLights.visible = false; lampMats.forEach(m => m.emissiveIntensity = 0); }
}

// ---------- modes ----------
let mode = 'orbit'; const yawPitch = { yaw: 0, pitch: 0 }; let floorY = 0; const EYE = 1.6;
function setMode(m, keepFloor) {
  mode = m; $('mOrbit').classList.toggle('on', m === 'orbit'); $('mWalk').classList.toggle('on', m === 'walk');
  orbit.enabled = m === 'orbit'; $('joy').style.display = m === 'walk' && isTouch ? 'block' : 'none';
  if (m === 'orbit') { if (document.pointerLockElement) document.exitPointerLock(); orbit.target.copy(CENTER); }
  else { const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yawPitch.yaw = e.y; yawPitch.pitch = e.x; if (!keepFloor) floorY = camera.position.y - EYE; }
  $('help').innerHTML = m === 'orbit' ? (isTouch ? 'Палец — вращение, щипок — масштаб, два пальца — сдвиг' : 'ЛКМ — вращение, колесо — масштаб, ПКМ — сдвиг')
    : (isTouch ? 'Джойстик — ходьба, проведите по экрану — обзор' : 'Клик — захват мыши, WASD/стрелки — ходьба, Shift — быстрее, Esc — отпустить');
}
$('mOrbit').onclick = () => setMode('orbit'); $('mWalk').onclick = () => setMode('walk');
$('menuBtn').onclick = () => $('panel').classList.toggle('hidden');

function lookFrom(p, t) { camera.position.copy(p); camera.lookAt(t); }
function goto(item, group) {
  const [, p, t] = item;
  if (group === 'ext') { setMode('orbit'); lookFrom(V(...p), V(...t)); orbit.target.copy(V(...t)); if (item[0] === 'Сверху') orbit.target.copy(V(18.5, 6.5, 0)); return; }
  if (group === 'sf' && $('hide2').checked) { $('hide2').checked = false; applyHide(); }
  lookFrom(V(p[0], p[1], p[2] + EYE), V(...t)); floorY = p[2]; setMode('walk', true);
  if (isTouch) $('panel').classList.add('hidden');
}
for (const g of ['ext', 'gf', 'sf']) for (const it of ROOMS[g]) { const b = document.createElement('button'); b.textContent = it[0]; b.onclick = () => goto(it, g); $(g).appendChild(b); }
function applyHide() { const h = $('hide2').checked; upper.forEach(o => o.visible = !h); }
$('hide2').onchange = () => { applyHide(); if ($('hide2').checked && mode === 'orbit') { lookFrom(V(18.5, -6, 30), V(18.5, 6.5, 0)); orbit.target.copy(V(18.5, 6.5, 0)); } };
$('evening').onchange = e => setDay(e.target.checked);
function applyShadow() { const v = +$('shq').value; renderer.shadowMap.enabled = v > 0; sun.castShadow = v > 0;
  if (v) { sun.shadow.mapSize.set(v, v); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
$('shq').onchange = applyShadow; $('pr').onchange = e => { setPR(+e.target.value); renderer.setSize(innerWidth, innerHeight); };
if (isTouch) { $('shq').value = '1024'; } applyShadow();

// ---------- walk input ----------
const keys = {}; addEventListener('keydown', e => keys[e.code] = true); addEventListener('keyup', e => keys[e.code] = false);
renderer.domElement.addEventListener('click', () => { if (mode === 'walk' && !isTouch) renderer.domElement.requestPointerLock?.(); });
addEventListener('mousemove', e => { if (mode === 'walk' && document.pointerLockElement) look(e.movementX, e.movementY, 0.0022); });
function look(dx, dy, k) { yawPitch.yaw -= dx * k; yawPitch.pitch = THREE.MathUtils.clamp(yawPitch.pitch - dy * k, -1.4, 1.4); }
const joy = { x: 0, y: 0, id: null }; let lookTouch = null;
$('joy').addEventListener('touchstart', e => { e.preventDefault(); joy.id = e.changedTouches[0].identifier; }, { passive: false });
addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { const r = $('joy').getBoundingClientRect(); let dx = t.clientX - (r.left + 60), dy = t.clientY - (r.top + 60);
      const l = Math.hypot(dx, dy); if (l > 45) { dx *= 45 / l; dy *= 45 / l; } joy.x = dx / 45; joy.y = dy / 45;
      $('knob').style.transform = `translate(${dx}px,${dy}px)`; }
    else if (mode === 'walk' && lookTouch && t.identifier === lookTouch.id) { look(t.clientX - lookTouch.x, t.clientY - lookTouch.y, 0.005); lookTouch.x = t.clientX; lookTouch.y = t.clientY; }
  } }, { passive: true });
renderer.domElement.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (mode === 'walk') lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY }; }, { passive: true });
addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; $('knob').style.transform = ''; }
  if (lookTouch && t.identifier === lookTouch.id) lookTouch = null; } });

// ---------- collision ----------
const ray = new THREE.Raycaster(); const DOWN = new THREE.Vector3(0, -1, 0);
function visibleColl() { return colliders.filter(o => o.visible); }
function groundAt(p, from = 0.5) { // highest walkable surface below head, max step 0.45
  ray.set(new THREE.Vector3(p.x, floorY + from + 0.45, p.z), DOWN); ray.far = from + 3;
  const h = ray.intersectObjects(visibleColl(), false).find(i => i.face && Math.abs(i.face.normal.y) > 0.3 || true);
  return h ? h.point.y : null;
}
function blocked(pos, dir, dist) {
  for (const hgt of [0.55, 1.2]) { ray.set(new THREE.Vector3(pos.x, floorY + hgt, pos.z), dir); ray.far = dist + 0.28;
    if (ray.intersectObjects(visibleColl(), false).length) return true; }
  return false;
}
function walk(dt) {
  let f = 0, s = 0;
  if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1; if (keys.KeyD || keys.ArrowRight) s += 1; if (keys.KeyA || keys.ArrowLeft) s -= 1;
  if (!isTouch) { if (keys.KeyQ) yawPitch.yaw += dt * 1.8; if (keys.KeyE) yawPitch.yaw -= dt * 1.8; }
  f -= joy.y; s += joy.x;
  const sp = (keys.ShiftLeft || keys.ShiftRight ? 3.2 : 1.6) * dt;
  const fw = new THREE.Vector3(-Math.sin(yawPitch.yaw), 0, -Math.cos(yawPitch.yaw)), rt = new THREE.Vector3(-fw.z, 0, fw.x);
  const mv = fw.multiplyScalar(f).add(rt.multiplyScalar(s)); if (mv.lengthSq() > 1) mv.normalize(); mv.multiplyScalar(sp);
  const p = camera.position;
  for (const ax of [new THREE.Vector3(mv.x, 0, 0), new THREE.Vector3(0, 0, mv.z)]) { const d = ax.length(); if (d < 1e-5) continue;
    const dir = ax.clone().normalize(); if (!blocked(p, dir, d)) p.add(ax); }
  if (colliders.length && mv.lengthSq() > 0) { const g = groundAt(p); if (g !== null && g > floorY - 3) floorY += (g - floorY) * Math.min(1, dt * 12); }
  p.y = floorY + EYE;
  camera.quaternion.setFromEuler(new THREE.Euler(yawPitch.pitch, yawPitch.yaw, 0, 'YXZ'));
}

// ---------- loop ----------
setMode('orbit');
const clock = new THREE.Clock(); let lastRoom = '';
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (mode === 'orbit') orbit.update(); else walk(dt);
  const r = roomAt(camera.position); if (r !== lastRoom) { $('room').textContent = r; lastRoom = r; }
  renderer.render(scene, camera);
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
window.__tour = { goto: (g, i) => goto(ROOMS[g][i], g), setDay, setMode, camera, ROOMS };
