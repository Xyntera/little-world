/* Little World - independent 3D game inspired by Little Kerala. Three.js client wired to this app's own /api. */
import * as THREE from '/vendor/three.module.js';
import { buildWorld, DISTRICTS, WORLD, districtAt, districtZone, shoreXAt } from '/world.js';
import { buildCity, CITY_DEFS, CITY_AIRPORTS, LANDMARK_NAMES, LANDMARK_FACTS, CITY_ITEMS, STAGE_THEMES } from '/cities.js';
import { buildTransit } from '/transit.js';
import { LAND_PATH } from '/worldmap.js';
import { createDiscovery } from '/discovery.js';
import { cameraLineClear } from '/camera-clearance.js';
import { createLocalMap, drawExploreMap } from '/localmap.js';
import { syncBeat, beatNow, buildAvatar, animateAvatar, ridePose, setRidePose, SKIN_TONES, HAIR_COLORS, PRESETS } from '/avatar.js';
import { OUTFITS } from '/outfits.js';

const HAIR_STYLES = ['Short', 'Plait', 'Bun', 'Mullappoo', 'Curly', 'Ponytail', 'Long', 'Spiky'];
const ITEM_TYPES = [
  { name: 'flower', en: 'Flower', ml: 'പൂവ്', points: 5, w: .42 },
  { name: 'mango', en: 'Mango', ml: 'മാങ്ങ', points: 10, w: .3 },
  { name: 'jackfruit', en: 'Jackfruit', ml: 'ചക്ക', points: 15, w: .16 },
  { name: 'umbrella', en: 'Umbrella', ml: 'കുട', points: 25, w: .09 },
  { name: 'banana', en: 'Banana', ml: 'പഴം', points: 100, w: .03 },
];
const cityItem = t => (CITY_ITEMS[state.city] || {})[t.name];
const itemLabel = t => state.city === 'kerala' ? t.ml : (cityItem(t) ? cityItem(t)[0] : t.en);
const EMO = { wave: 'waves', laugh: 'laughs', dance: 'dances', party: 'parties', heart: 'sends love', clap: 'claps', bow: 'bows', bhangra: 'does bhangra', disco: 'goes disco', robot: 'does the robot', spin: 'spins', moonwalk: 'moonwalks', garba: 'does garba', kathak: 'dances kathak', salsa: 'dances salsa', breakdance: 'breakdances', ballet: 'dances ballet', hula: 'dances hula', jump: 'jumps', sit: 'sits' };
const DANCES = ['dance', 'party', 'bhangra', 'disco', 'robot', 'spin', 'moonwalk', 'garba', 'kathak', 'salsa', 'breakdance', 'ballet', 'hula', 'jump'];
const LS_KEY = 'lk.account.v1';
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const state = {
  account: null, points: 0, stage: 'intro', panel: 'none',
  monsoon: false, muted: false, apiDown: false, districtIdx: -1, city: 'kerala',
};

/* ---------- API ---------- */
async function api(path, opts) {
  const res = await fetch('/api' + path, Object.assign({
    headers: Object.assign({ 'Content-Type': 'application/json' },
      state.account && state.account.token ? { Authorization: 'Bearer ' + state.account.token } : {}),
  }, opts || {}));
  if (!res.ok) { let m = 'api ' + res.status; try { const j = await res.clone().json(); if (j && j.error) m = j.error; } catch {} const e = new Error(m); e.status = res.status; throw e; }
  return res.json();
}
const saveAccount = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state.account)); } catch {} };
const loadAccount = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } };

/* ---------- audio ---------- */
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } return AC; }
function chime(freqs, dur, type) {
  if (state.muted) return; const ac = audio(); if (!ac) return;
  freqs.forEach((f, i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, ac.currentTime + i * .07);
    g.gain.exponentialRampToValueAtTime(.22, ac.currentTime + i * .07 + .02);
    g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + i * .07 + (dur || .3));
    o.connect(g).connect(ac.destination);
    o.start(ac.currentTime + i * .07); o.stop(ac.currentTime + i * .07 + (dur || .3) + .05);
  });
}
let transitNode = null;
function transitSound(on, kind) { // 150i: crossing engine/ambience - air: low hum; sea: water noise. Follows the rainSound pattern; gain follows the crossing's own pacing (set in updatePlayer)
  const ac = audio(); if (!ac) return;
  if (on && !transitNode) {
    if (ac.state === 'suspended') ac.resume().catch(() => {}); // crossings start from a gate click (a user gesture), so resume is permitted
    const g = ac.createGain(); g.gain.value = 0;
    if (kind === 'air') {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 82;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      o.connect(f).connect(g).connect(ac.destination); o.start();
      transitNode = { o, g, kind };
    } else {
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * .5;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      src.connect(f).connect(g).connect(ac.destination); src.start();
      transitNode = { src, g, kind };
    }
  } else if (!on && transitNode) { try { (transitNode.o || transitNode.src).stop(); } catch {} transitNode = null; }
}
let rainNode = null;
function rainSound(on) {
  const ac = audio(); if (!ac) return;
  if (on && !rainNode) {
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * .5;
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = .4;
    const g = ac.createGain(); g.gain.value = state.muted ? 0 : .12;
    src.connect(f).connect(g).connect(ac.destination); src.start();
    rainNode = { src, g };
  } else if (!on && rainNode) { try { rainNode.src.stop(); } catch {} rainNode = null; }
  if (rainNode) rainNode.g.gain.value = state.muted ? 0 : .12;
}

/* ---------- toasts ---------- */
function pushToast(text, key, deco) {
  if (key) document.querySelectorAll('#toasts .lk-toast[data-key="' + key + '"]').forEach(n => n.remove());
  const el = document.createElement('div');
  el.className = 'lk-toast' + (deco ? ' lk-deco' : ''); el.textContent = text; if (key) el.dataset.key = key;
  $('toasts').appendChild(el); while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => el.remove(), 3400);
}

/* ---------- stage / panels ---------- */
function setStage(s) {
  state.stage = s;
  $('intro').hidden = s !== 'intro';
  $('play').hidden = s === 'intro';
  $('onboard').hidden = s !== 'onboard';
  $('district-tag').hidden = !(s === 'play');
  $('footnote').hidden = s !== 'play';
}
function setPanel(p) {
  state.panel = state.panel === p ? 'none' : p;
  if (state.panel !== 'none' && typeof hideArrival === 'function') hideArrival(); // a side panel owns the screen; don't float the arrival banner over it
  $('toasts').classList.toggle('is-panel', state.panel !== 'none'); // panels own the screen: decorative toasts hide behind them, must-see feedback (errors, refusals, confirmations) still shows
  $('panel-explore').hidden = state.panel !== 'explore';
  $('explore-discovery').hidden=!state._protoPrague;
  $('panel-discovery').hidden=state.panel!=='discovery';
  if(state.panel==='explore')drawExploreMap($('explore-map-preview'),worldData,player);
  if(state.panel==='explore'){
    const panel=$('panel-explore');
    panel.querySelectorAll('[data-srcset]').forEach(el=>{el.srcset=el.dataset.srcset;delete el.dataset.srcset;});
    panel.querySelectorAll('[data-src]').forEach(el=>{el.src=el.dataset.src;delete el.dataset.src;});
  }
  $('panel-board').hidden = state.panel !== 'board';
  $('panel-look').hidden = state.panel !== 'look';
  $('panel-help').hidden = state.panel !== 'help';
  $('panel-travel').hidden = state.panel !== 'travel';
  $('panel-localmap').hidden = state.panel !== 'localmap';
  if (state.panel === 'localmap') localMap.refresh(state.city);
  $('panel-passport').hidden = state.panel !== 'passport';
  if (state.panel === 'passport') renderPassport();
  $('panel-games').hidden = state.panel !== 'games';
  $('panel-ludo').hidden = state.panel !== 'ludo';
  $('panel-echo').hidden = state.panel !== 'echo';
  $('panel-freeze').hidden = state.panel !== 'freeze';
  $('panel-voice').hidden = state.panel !== 'voice';
  $('panel-events').hidden = state.panel !== 'events';
  if (state.panel === 'events') renderEvents();
  if (state.panel === 'ludo') ludoOpen(); else ludoStop();
  if (state.panel === 'echo') echoOpen(); else echoStop();
  if (state.panel === 'freeze') freezeOpen(); else freezeStop();
  if (state.panel === 'travel') renderTravel();
  if (state.panel === 'board') renderBoard();
  if (state.panel === 'look') renderLook();
}
function setPoints(n) {
  state.points = n;
  $('points-num').textContent = n;
  $('board-points').textContent = n;
  if (state.account) $('board-you-note').textContent = n > 15 ? state.account.name + ' · on the board' : 'Collect something to enter the board';
}

/* ================= 3D ================= */
let renderer, scene, camera, worldData, sun, hemi;
let player = null, playerVel = new THREE.Vector3();
const cam = { yaw: Math.PI, pitch: .42, dist: 8.2, fp: false, target: new THREE.Vector3() };
const keys = {};
const remotes = new Map();
const pickups = [];
const labelPool = [];
let rainPts = null;

function makeLabel(cls, html) {
  const el = document.createElement('div');
  el.className = 'lk-label3d ' + cls; el.innerHTML = html;
  $('labels').appendChild(el);
  return { el, pos: new THREE.Vector3(), visible: true };
}
const _v = new THREE.Vector3();
function placeLabel(l, x, y, z, inset) {
  _v.set(x, y, z).project(camera);
  if (_v.z > 1 || (inset && Math.abs(_v.x) > inset)) { l.el.style.display = 'none'; return; }
  l.el.style.display = 'block';
  l.el.style.left = ((_v.x * .5 + .5) * 100) + '%';
  l.el.style.top = ((-_v.y * .5 + .5) * 100) + '%';
}

function initThree() {
  const canvas = $('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const SMALL_SCREEN = matchMedia('(max-width: 640px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, SMALL_SCREEN ? 1.5 : 2)); // phone fill-rate cap: dpr3 phones render 1.8x fewer pixels; sharpness tradeoff verified on pixels before ship
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#8fd3ee');
  scene.fog = new THREE.Fog('#a8dcee', 90, 340);

  camera = new THREE.PerspectiveCamera(55, 1, .1, 900);

  hemi = new THREE.HemisphereLight('#bfe8ff', '#5f9f5a', .95);
  scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff2d8', 1.9);
  sun.position.set(-60, 90, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SMALL_SCREEN ? 1024 : 2048, SMALL_SCREEN ? 1024 : 2048); // 4x fewer shadow texels on phones; softens shadow edges slightly
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 400; sun.shadow.bias = -.0004;
  scene.add(sun); scene.add(sun.target);

  worldData = buildWorld(scene);

  // rain (hidden until monsoon)
  const rainGeo = new THREE.BufferGeometry();
  const N = 1400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = rand(-40, 40); pos[i * 3 + 1] = rand(0, 40); pos[i * 3 + 2] = rand(-40, 40); }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rainPts = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: '#cfe6f2', size: .14, transparent: true, opacity: .7 }));
  rainPts.visible = false; scene.add(rainPts);

  window.addEventListener('resize', sizeRenderer);
  sizeRenderer();
}
function sizeRenderer() {
  const w = $('stage').clientWidth || innerWidth, h = $('stage').clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

/* ---------- pickups ---------- */
function pickupModel(type) {
  const g = new THREE.Group();
  const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .7 }, o || {}));
  const ci = state.city === 'kerala' ? null : cityItem(type);
  if (ci && ci[1] !== 'flower') {
    const C = ci[2], G = THREE;
    const add = (geo, col, f) => { const m = new G.Mesh(geo, std(col || C, { emissive: C, emissiveIntensity: .25 })); if (f) f(m); g.add(m); return m; };
    switch (ci[1]) {
      case 'disc': add(new G.CylinderGeometry(.42, .42, .16, 12)); add(new G.CylinderGeometry(.32, .32, .1, 12), '#ffffff', m => m.position.y = .12); break;
      case 'ring': add(new G.TorusGeometry(.34, .14, 7, 12), null, m => m.rotation.x = Math.PI / 2); break;
      case 'crescent': add(new G.TorusGeometry(.4, .15, 7, 10, 3.6)); break;
      case 'long': add(new G.CylinderGeometry(.13, .13, 1.1, 8), null, m => m.rotation.z = 1.1); break;
      case 'dome': add(new G.SphereGeometry(.45, 10, 6, 0, 6.28, 0, 1.57)); add(new G.CylinderGeometry(.45, .45, .1, 10), '#e8e0cf', m => m.position.y = -.05); break;
      case 'gem': add(new G.OctahedronGeometry(.48)); break;
      case 'cup': add(new G.CylinderGeometry(.36, .26, .5, 10)); add(new G.TorusGeometry(.2, .05, 5, 8), '#e8e0cf', m => { m.position.set(.38, 0, 0); }); break;
      case 'box': add(new G.BoxGeometry(.7, .5, .5)); add(new G.BoxGeometry(.72, .1, .1), '#ffffff', m => m.position.y = .1); break;
      case 'coin': add(new G.CylinderGeometry(.45, .45, .1, 14), null, m => m.rotation.x = Math.PI / 2); break;
      case 'cone': add(new G.ConeGeometry(.42, .8, 8)); break;
      case 'ball': add(new G.SphereGeometry(.42, 10, 8)); add(new G.CylinderGeometry(.05, .05, .2, 5), '#5b4326', m => m.position.y = .5); break;
      default: add(new G.SphereGeometry(.4, 8, 6));
    }
  } else if (ci && ci[1] === 'flower') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .9, 5), std('#3a8c46')); stem.position.y = -.45; g.add(stem);
    for (let i = 0; i < 5; i++) { const pt = new THREE.Mesh(new THREE.SphereGeometry(.18, 7, 6), std(ci[2], { emissive: ci[2], emissiveIntensity: .3 })); pt.position.set(Math.cos(i / 5 * 6.28) * .26, .05, Math.sin(i / 5 * 6.28) * .26); g.add(pt); }
    const c0 = new THREE.Mesh(new THREE.SphereGeometry(.17, 8, 6), std('#ffd23f', { emissive: '#ffd23f', emissiveIntensity: .5 })); c0.position.y = .1; g.add(c0);
  } else if (type.name === 'flower') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .9, 5), std('#3a8c46')); stem.position.y = -.45; g.add(stem);
    for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.18, 7, 6), std('#ff8fb0', { emissive: '#ff8fb0', emissiveIntensity: .3 })); p.position.set(Math.cos(i / 5 * 6.28) * .26, .05, Math.sin(i / 5 * 6.28) * .26); g.add(p); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(.17, 8, 6), std('#ffd23f', { emissive: '#ffd23f', emissiveIntensity: .5 })); c.position.y = .1; g.add(c);
  } else if (type.name === 'mango') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.4, 10, 8), std('#ffb43a', { emissive: '#ff9d2a', emissiveIntensity: .3 })); m.scale.set(.85, 1.05, .8); g.add(m);
    const l = new THREE.Mesh(new THREE.BoxGeometry(.3, .04, .16), std('#3a8c46')); l.position.set(.1, .42, 0); l.rotation.z = .5; g.add(l);
  } else if (type.name === 'jackfruit') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.45, 9, 7), std('#7fae3f', { emissive: '#5a8c2f', emissiveIntensity: .25 })); m.scale.y = 1.25; g.add(m);
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(.07, .16, 4), std('#5a8c2f')); const a = i / 8 * 6.28; s.position.set(Math.cos(a) * .45, (i % 3 - 1) * .3, Math.sin(a) * .45); s.rotation.set(Math.sin(a), 0, -Math.cos(a)); g.add(s); }
  } else if (type.name === 'umbrella') {
    const c = new THREE.Mesh(new THREE.ConeGeometry(.62, .5, 10), std('#e8452c', { emissive: '#c22a1a', emissiveIntensity: .3 })); c.position.y = .2; g.add(c);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1, 5), std('#5b4326')); tip.position.y = -.3; g.add(tip);
    const top = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 5), std('#ffd23f')); top.position.y = .5; g.add(top);
  } else { // banana
    const m = new THREE.Mesh(new THREE.TorusGeometry(.42, .15, 7, 10, 2.4), std('#ffd23f', { emissive: '#e8b23d', emissiveIntensity: .4 })); m.rotation.z = -.6; g.add(m);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function buildBalls() {
  for (const b of balls) { scene.remove(b.mesh); disposeModel(b.mesh); }
  balls = (worldData.beachBalls || []).map(d => { const mesh = beachBallModel(); mesh.position.set(d.x, worldData.groundY(d.x, d.z) + .5, d.z); scene.add(mesh); return { id: d.id, x: d.x, z: d.z, vx: 0, vz: 0, owner: null, claimT: 0, mesh }; });
}
function adoptBalls(list) { // 118v: server-relayed ball states; my own owned balls stay locally simulated
  for (const row of list) { if (!Array.isArray(row) || row.length < 6) continue; const b = balls.find(b => b.id === row[0]); if (!b || b.owner === 'me') continue;
    if (row[5] && state.account && row[5] === state.account.playerId) continue; // my other tab owns it
    b.owner = row[5] || null; b.tx = +row[1]; b.tz = +row[2]; b.tvx = +row[3]; b.tvz = +row[4]; }
}
function updateBalls(dt) {
  if (!balls.length || !worldData || !worldData.clampSwim || !worldData.inSwim) return;
  for (const b of balls) {
    if (b.owner !== 'me' && b.tx !== undefined) { // remote-owned: ease toward the reported state
      b.vx = b.tvx || 0; b.vz = b.tvz || 0;
      b.x += (b.tx - b.x) * Math.min(1, dt * 8); b.z += (b.tz - b.z) * Math.min(1, dt * 8);
    } else {
      b.x += b.vx * dt; b.z += b.vz * dt;
      const fr = Math.exp(-dt * (worldData.inSwim(b.x, b.z) ? 3.2 : 2.0)); b.vx *= fr; b.vz *= fr;
      if (Math.hypot(b.vx, b.vz) < .05) { b.vx = 0; b.vz = 0; }
      if (player && !player.vkind && state.stage === 'play') { // on-foot push (vehicles drive past: documented simplification)
        const dx = b.x - player.x, dz = b.z - player.z, d = Math.hypot(dx, dz);
        if (d < .95 && d > 1e-4) {
          const ps = player.moving ? ((keys['shift'] || state.runTouch) ? 8.4 : 5.4) : 0;
          b.vx += dx / d * (2.2 + ps * .9) * dt * 6; b.vz += dz / d * (2.2 + ps * .9) * dt * 6;
          b.x = player.x + dx / d * .95; b.z = player.z + dz / d * .95;
          b.owner = 'me'; b.claimT = Date.now();
        }
      }
      for (const cc of worldData.colliders) { // circle vs world: push out + soft bounce
        if (cc.wallEast || cc.off) continue;
        if (cc.hw !== undefined) { const dx = b.x - cc.x, dz = b.z - cc.z, px = cc.hw + .5 - Math.abs(dx), pz = cc.hd + .5 - Math.abs(dz);
          if (px > 0 && pz > 0) { if (px < pz) { b.x = cc.x + (dx >= 0 ? 1 : -1) * (cc.hw + .5); b.vx = -b.vx * .4; } else { b.z = cc.z + (dz >= 0 ? 1 : -1) * (cc.hd + .5); b.vz = -b.vz * .4; } } }
        else { const dx = b.x - cc.x, dz = b.z - cc.z, d = Math.hypot(dx, dz), m = cc.r + .5;
          if (d < m && d > 1e-4) { b.x = cc.x + dx / d * m; b.z = cc.z + dz / d * m; const dot = (b.vx * dx + b.vz * dz) / d; if (dot < 0) { b.vx -= 1.4 * dot * dx / d; b.vz -= 1.4 * dot * dz / d; } } }
      }
      if (worldData.inSeaOpen && worldData.inSeaOpen(b.x, b.z) && !worldData.inSea(b.x, b.z)) { // 148 soak zone: past the swim band, inside BALL_OUT - heavy drag + gentle onshore wash-back (surf.ori/at give the water axis + waterline; gameplay arrangement, not a current model)
        const sf = worldData.surf; if (sf) { const wl = sf.ori === 'e' || sf.ori === 'w' ? sf.at(b.z) : sf.at(b.x); const sg = (sf.ori === 'e' || sf.ori === 's') ? -1 : 1; // onshore direction along the water axis
          const dr = Math.exp(-dt * .8); b.vx *= dr; b.vz *= dr; // 148: light open-sea drag - a running push (~8-10 u/s at the band edge after the accepted in-band friction) carries ~4-5u out before the wash-back wins (probe148ball-tuned)
          if (sf.ori === 'e' || sf.ori === 'w') b.vx += sg * 3 * dt; else b.vz += sg * 3 * dt;
          const ax = (sf.ori === 'e' || sf.ori === 'w') ? 'vx' : 'vz'; if (Math.sign(b[ax]) === Math.sign(sg) && Math.abs(b[ax]) > 2.5) b[ax] = Math.sign(b[ax]) * 2.5; } } // 148: cap only the ONSHORE wash-back speed - a seaward entry keeps its carry (dbg148: an uncapped-axis 2.5 clamp killed the soak at the first step)
      const cl = worldData.clampBall ? worldData.clampBall(b.x, b.z) : worldData.clampSwim(b.x, b.z); b.x = cl[0]; b.z = cl[1]; // 148: balls soak past the swim band into the BALL_OUT zone (was: never past the swim band)
      if (b.owner === 'me' && Date.now() - b.claimT > 4000 && !b.vx && !b.vz) b.owner = null; // release a resting ball
    }
    const inW = worldData.inSwim(b.x, b.z) || (worldData.inSeaOpen && worldData.inSeaOpen(b.x, b.z)), bob = inW ? Math.sin(performance.now() / 400 + b.x) * .06 : 0; // 148: float+bob in the open-sea soak zone too
    b.mesh.position.set(b.x, (inW ? .85 : worldData.groundY(b.x, b.z) + .5) + bob, b.z); // sea surface is y=1.0 (cities.js sea slab top); a floating ball rides ~2/3 emerged
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > .01) { _v.set(b.vz / sp, 0, -b.vx / sp); b.mesh.rotateOnWorldAxis(_v, Math.min(.35, sp * dt / .5)); }
  }
}
let waves = [], surfT = 0; // 118x: surfT advances in BOTH the RAF frame and __lk.step so probes see true animation
function buildWaves() { // 118x: stylized surf - 3 foam ribbons per shore city on the swim band; ambient visual only
  for (const w of waves) { scene.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); }
  waves = [];
  const sf = worldData && worldData.surf; if (!sf) return;
  const NS = 64;
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NS + 1) * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < NS; i++) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide }) /* DoubleSide: ribbon winding is orientation-dependent (east/north normals point down) */);
    mesh.renderOrder = 2; mesh.frustumCulled = false; // ribbon crosses the whole shore - skip culling
    scene.add(mesh);
    waves.push({ k, mesh, geo, NS });
  }
  updateWaves(0);
}
function updateWaves(dt) {
  if (!waves.length || !worldData || !worldData.surf) { if (waves.length && (!worldData || !worldData.surf)) for (const w of waves) w.mesh.visible = false; return; } // 195: hide stale ribbons on surf-less cities (they kept the PREVIOUS city's positions)
  surfT += dt;
  for (const w of waves) w.mesh.visible = true; // 195: a surf city restores them
  const sf = worldData.surf, dir = (sf.ori === 's' || sf.ori === 'e') ? 1 : -1, BASE = [2.0, 4.8, 7.6];
  for (const w of waves) {
    const ph = surfT * .9 + w.k * 2.1;
    const off0 = BASE[w.k] - 3.1 * (0.5 + 0.5 * Math.sin(ph));
    w.mesh.material.opacity = .14 + .34 * (0.5 + 0.5 * Math.sin(ph - .7));
    const p = w.geo.attributes.position.array;
    for (let i = 0; i <= w.NS; i++) {
      const l = -sf.lim + (2 * sf.lim) * i / w.NS, wl = sf.at(l);
      const hwl = .5 + .4 * (0.5 + 0.5 * Math.sin(l * 0.5 + ph * 2)); // patchy foam width
      const off = Math.max(off0 + 0.9 * Math.sin(l * 0.28 + ph * 1.3) + 0.45 * Math.sin(l * 0.11 - ph * 0.7), hwl); // scalloped crest; clamped so the WHOLE ribbon stays at/seaward of the waterline - it touches the beach and dissolves, never crosses it (Main pixel verdicts: low paved beach-access ramps share groundY with sand and cannot be told apart by elevation - containment wins over run-up)
      let landOff = off - hwl; // >= 0 by construction
      const waterOff = off + hwl;
      const lp = sf.ori === 's' ? [l, wl + landOff] : sf.ori === 'e' ? [wl + landOff, l] : sf.ori === 'w' ? [wl - landOff, l] : [l, wl - landOff];
      if (worldData.groundY(lp[0], lp[1]) > 0.98) landOff = 0.15; // raised/paved land at the waterline: start the foam just seaward, over the water surface
      let ax, az, bx, bz;
      if (sf.ori === 's') { ax = l; az = wl + landOff; bx = l; bz = wl + dir * waterOff; }
      else if (sf.ori === 'e') { ax = wl + landOff; az = l; bx = wl + dir * waterOff; bz = l; }
      else if (sf.ori === 'w') { ax = wl - landOff; az = l; bx = wl - dir * waterOff; bz = l; }
      else { ax = l; az = wl - landOff; bx = l; bz = wl - dir * waterOff; }
      const gyA = worldData.groundY(ax, az), gyB = worldData.groundY(bx, bz); const ya = Math.max(1.02, gyA + .04), yb = Math.max(1.02, gyB + .04); // land edge is AT the waterline now, over the slab: 1.02 floor everywhere // the y>=1.02 floor applies ONLY over the water slab (sea surface y=1.0, starts exactly at the waterline); on dry sand the wash HUGS the beach (was: floor floated foam .4u over low sand - Main 19:03 pixel verdict)
      const o = i * 6;
      p[o] = ax; p[o + 1] = ya; p[o + 2] = az; p[o + 3] = bx; p[o + 4] = yb; p[o + 5] = bz;
    }
    w.geo.attributes.position.needsUpdate = true;
  }
}
function spawnPickup(spot, forcedType, slot) {
  const total = ITEM_TYPES.reduce((s, t) => s + t.w, 0);
  let r = Math.random() * total, type = ITEM_TYPES[0];
  for (const t of ITEM_TYPES) { r -= t.w; if (r <= 0) { type = t; break; } }
  if (forcedType) type = forcedType;
  const model = pickupModel(type);
  model.position.set(spot.x, worldData.groundY() + 1.25, spot.z);
  scene.add(model);
  const label = makeLabel('lk-item-tag', itemLabel(type) + ' · <b>' + type.points + '</b>');
  const p = { model, label, type, x: spot.x, z: spot.z, t: rand(0, 9), alive: true, slot: slot === undefined ? null : slot };
  pickups.push(p);
  return p;
}
function seedPickups(cx, cz, n, radius) {
  for (let i = 0; i < n; i++) {
    const spot = worldData.itemSpots[Math.floor(Math.random() * worldData.itemSpots.length)];
    if (cx === null) spawnPickup({ x: spot.x + rand(-1, 1) * (state.city === 'kerala' ? 4 : 1), z: spot.z + rand(-1, 1) * (state.city === 'kerala' ? 4 : 1) });
    else { const zz = clamp(cz + rand(-radius, radius), WORLD.north + 5, WORLD.south - 5); spawnPickup({ x: clamp(cx + rand(-radius, radius), shoreXAt(zz) + 8, 60), z: zz }); }
  }
}
function disposeModel(m) { m.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
function removePickup(p) { scene.remove(p.model); disposeModel(p.model); if (p.label && p.label.el) p.label.el.remove(); const i = pickups.indexOf(p); if (i >= 0) pickups.splice(i, 1); }
/* ---------- 118v: playable beach balls (push physics; sync via ping/poll relay) ---------- */
let balls = [];
function beachBallModel() {
  const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .7 }, o || {})); // same idiom as pickupModel
  const g = new THREE.Group(), C = ['#e8452c', '#ffd23f', '#2f7bd9'];
  const base = new THREE.Mesh(new THREE.SphereGeometry(.5, 14, 12), std('#f4f4f4', { emissive: '#ffffff', emissiveIntensity: .15 })); base.castShadow = true; g.add(base);
  for (let i = 0; i < 3; i++) { const panel = new THREE.Mesh(new THREE.SphereGeometry(.505, 5, 12, i * 2.094, 1.05, 0, 6.283), std(C[i], { emissive: C[i], emissiveIntensity: .25 })); panel.castShadow = true; g.add(panel); }
  return g;
}
function slotSpot(sl) { return { x: sl.x, z: sl.z }; } // exact server-owned coordinates
// server decides what each pickup is worth; the client only places them. Falls back to local pickups if the server is unreachable.
let pickupSyncId = 0;
async function syncPickups() {
  if (state._protoPrague) { state._pickupsReady = true; return; } /* Update 168a: preview world has no spots - never pull the host city's slots over it */
  if (!state.account || !state.account.token) { state._pickupsReady = true; return; }
  const mine = ++pickupSyncId, city = state.city, gen = state._cityGen;
  try {
    const r = await api('/players/' + state.account.playerId + '/pickups?city=' + encodeURIComponent(city));
    if (mine !== pickupSyncId || city !== state.city || gen !== state._cityGen) return; // stale refresh: leave the new city's set and readiness alone
    for (const p of [...pickups]) removePickup(p);
    for (const sl of r.slots) { const t = ITEM_TYPES.find(x => x.name === sl.item); if (t) spawnPickup(slotSpot(sl), t, sl.id); }
    state._pickupsReady = true;
  } catch { if (gen === state._cityGen) state._pickupsReady = true; /* keep the local pickups as the ready fallback set */ }
}
function respawnPickup(p) {
  const spot = worldData.itemSpots[Math.floor(Math.random() * worldData.itemSpots.length)];
  const j = state.city === 'kerala' ? 3 : 1; p.x = spot.x + rand(-j, j); p.z = spot.z + rand(-j, j);
  p.model.position.set(p.x, worldData.groundY() + 1.25, p.z);
  p.alive = true; p.popT = undefined; p.growT = 0; p.model.visible = true; p.model.scale.set(.25, .25, .25); p.label.el.style.display = 'block';
}

/* ---------- player ---------- */
function spawnPlayer(x, z) {
  if (player) { scene.remove(player.group); disposeModel(player.group); if (player.nameTag) player.nameTag.el.remove(); }
  const group = buildAvatar(state.account ? state.account.look : null);
  group.position.set(x, worldData.groundY(), z);
  scene.add(group);
  player = { group, x, z, dir: 0, moving: false, nameTag: null };
  if (state.account) {
    const d = DISTRICTS[state.account.district];
    player.nameTag = makeLabel('lk-nametag', esc(state.account.name) + (state.city === 'kerala' && d ? ' <span>(' + d[2] + ')</span>' : ''));
  }
  cam.target.set(x, 1.6, z);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- vehicles ---------- */
const FLY = { minStart: .12, minThrust: .35, taperBelow: .4, climbDrain: .045, hoverDrain: .012, fall: 3.5, refill: .06, reserve: .02 };
const VEH = { car: { speed: 15, label: 'Car', hide: true }, scooter: { speed: 10.5, label: 'Scooter', hide: false }, roadster: { speed: 20, label: 'Roadster-style car', hide: true }, supercar: { speed: 21, label: 'Wedge supercar', hide: true }, suv: { speed: 14, label: 'SUV', hide: true }, pickup: { speed: 13, label: 'Pickup truck', hide: true }, van: { speed: 12, label: 'Van', hide: true }, taxi: { speed: 13, label: 'Taxi (in-game, no fares)', hide: true, color: '#f2c21b' }, bike: { speed: 17, label: 'Sport bike', hide: false }, bicycle: { speed: 8, label: 'Bicycle', hide: false }, boat: { speed: 9, label: 'Boat', hide: false }, flyster: { speed: 20, label: 'Sky Roadster-style (fictional)', hide: true, fly: true, color: '#22d3c5' } };
function buildVehicle(kind, color) {
  const g = new THREE.Group();
  const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .6 }, o || {}));
  const add = (geo, c, f, o) => { const m = new THREE.Mesh(geo, std(c, o)); if (f) f(m); m.castShadow = true; g.add(m); return m; };
  const wheel = (x, y, z, r) => add(new THREE.CylinderGeometry(r, r, .28, 12), '#1c1c1c', m => { m.rotation.z = Math.PI / 2; m.position.set(x, y, z); });
  const GL = { roughness: .15, transparent: true, opacity: .42 };
  const cabin = (y, zf, zb, w) => { // seats + wheel visible through transparent glass
    add(new THREE.BoxGeometry(w, .5, .5), '#3a3f4a', m => m.position.set(-w * .65, y, zb));
    add(new THREE.BoxGeometry(w, .5, .5), '#3a3f4a', m => m.position.set(w * .65, y, zb));
    add(new THREE.BoxGeometry(w * 2.6, .35, .45), '#3a3f4a', m => m.position.set(0, y - .1, zb - .55));
    add(new THREE.TorusGeometry(.17, .03, 6, 10), '#15171c', m => { m.position.set(-w * .65, y + .25, zf); m.rotation.x = 1.1; });
    add(new THREE.BoxGeometry(w * 3, .18, .3), '#22262e', m => m.position.set(0, y + .05, zf + .3));
  };
  const lamp = (x, y, z, c) => add(new THREE.BoxGeometry(.4, .14, .08), '#fff7c2', m => m.position.set(x, y, z), { emissive: c || '#fff2a0', emissiveIntensity: .85 });
  const tail = (x, y, z) => add(new THREE.BoxGeometry(.4, .12, .06), '#ff3b30', m => m.position.set(x, y, z), { emissive: '#ff2a1a', emissiveIntensity: .7 });
  if (kind === 'flyster') { // fictional flying Roadster-style car: roadster body, perimeter thruster nozzles, tank behind the seat, glow underside
    const r = buildVehicle('roadster', color);
    const mk = (geo, c, f, o) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .5 }, o || {}))); f(m); m.castShadow = true; r.add(m); };
    // thruster layout inspired by the public description (corner nozzles, front yaw nozzles, rear nozzles, gas tank behind the seat); fictional, no Tesla assets
    const glow = { emissive: '#4de8ff', emissiveIntensity: 1 };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mk(new THREE.CylinderGeometry(.2, .26, .3, 8), '#2a2d34', m => m.position.set(sx * 1.0, .32, sz * 1.5));
      mk(new THREE.CylinderGeometry(.14, .14, .05, 8), '#7ff7ff', m => m.position.set(sx * 1.0, .16, sz * 1.5), glow);
    }
    for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(.22, .14, .3), '#2a2d34', m => { m.position.set(sx * .55, .72, 1.95); m.rotation.y = sx * .5; });
    for (const sx of [-1, 1]) {
      mk(new THREE.CylinderGeometry(.24, .3, .5, 8), '#2a2d34', m => { m.rotation.x = Math.PI / 2; m.position.set(sx * .5, .62, -2.3); });
      mk(new THREE.CylinderGeometry(.17, .17, .05, 8), '#7ff7ff', m => { m.rotation.x = Math.PI / 2; m.position.set(sx * .5, .62, -2.58); }, glow);
    }
    mk(new THREE.CylinderGeometry(.34, .34, 1.1, 10), '#c9ced6', m => { m.rotation.z = Math.PI / 2; m.position.set(0, .98, -1.0); });
    mk(new THREE.BoxGeometry(1.4, .06, 2.6), '#7ff7ff', m => m.position.set(0, .22, 0), { emissive: '#4de8ff', emissiveIntensity: .6, transparent: true, opacity: .55 });
    return r;
  }
  if (kind === 'car') { // compact hatchback: short, upright, sloped rear glass
    add(new THREE.BoxGeometry(1.6, .6, 3.1), color, m => m.position.y = .62);
    add(new THREE.BoxGeometry(1.5, .5, 1.6), color, m => m.position.set(0, 1.12, -.2));
    add(new THREE.BoxGeometry(1.52, .38, 1.3), '#9fd3f0', m => m.position.set(0, 1.14, -.15), GL);
    add(new THREE.BoxGeometry(1.5, .45, .5), color, m => { m.position.set(0, 1.02, -1.1); m.rotation.x = -.5; });
    cabin(.95, .35, -.3, .35); lamp(-.5, .68, 1.56); lamp(.5, .68, 1.56); tail(-.55, .75, -1.57); tail(.55, .75, -1.57);
    [[-.85, .36, 1.0], [.85, .36, 1.0], [-.85, .36, -1.0], [.85, .36, -1.0]].forEach(w => wheel(w[0], w[1], w[2], .36));
  } else if (kind === 'roadster') { // open two-seater: long low hood, no roof, driver visible, light bar, swept fenders
    add(new THREE.BoxGeometry(1.85, .36, 4.1), color, m => m.position.y = .48);
    add(new THREE.BoxGeometry(1.5, .26, 1.5), color, m => { m.position.set(0, .7, 1.25); m.rotation.x = .06; });
    add(new THREE.BoxGeometry(1.7, .3, 1.0), color, m => m.position.set(0, .72, -1.5));
    add(new THREE.BoxGeometry(1.4, .3, .08), '#9fd3f0', m => { m.position.set(0, .98, .35); m.rotation.x = -.6; }, GL);
    add(new THREE.BoxGeometry(.5, .48, .45), '#2a2d34', m => m.position.set(-.4, .75, -.45));
    add(new THREE.BoxGeometry(.5, .48, .45), '#2a2d34', m => m.position.set(.4, .75, -.45));
    add(new THREE.BoxGeometry(.28, .42, .26), '#e8e2cf', m => m.position.set(-.4, 1.1, -.45));
    add(new THREE.BoxGeometry(.22, .22, .22), '#c98f6b', m => m.position.set(-.4, 1.42, -.45));
    add(new THREE.BoxGeometry(1.2, .06, .12), '#e8f6ff', m => m.position.set(0, .66, 2.04), { emissive: '#bfe8ff', emissiveIntensity: .9 });
    add(new THREE.BoxGeometry(1.7, .04, .4), '#1c1c1c', m => m.position.set(0, 1.0, -2.0));
    tail(-.7, .6, -2.06); tail(.7, .6, -2.06);
    [[-.95, .37, 1.3], [.95, .37, 1.3], [-.98, .4, -1.3], [.98, .4, -1.3]].forEach(w => wheel(w[0], w[1], w[2], w[2] > 0 ? .37 : .42));
  } else if (kind === 'supercar') { // low wedge, tilted nose, big rear wing, side intakes
    add(new THREE.BoxGeometry(1.95, .3, 4.3), color, m => m.position.y = .42);
    add(new THREE.BoxGeometry(1.8, .24, 1.7), color, m => { m.position.set(0, .56, 1.5); m.rotation.x = .22; });
    add(new THREE.BoxGeometry(1.5, .34, 1.6), '#9fd3f0', m => { m.position.set(0, .8, -.2); m.rotation.x = -.05; }, GL);
    add(new THREE.BoxGeometry(1.2, .1, 1.1), color, m => m.position.set(0, .98, -.35));
    add(new THREE.BoxGeometry(.5, .2, .9), '#15171c', m => m.position.set(-1.0, .5, -.9));
    add(new THREE.BoxGeometry(.5, .2, .9), '#15171c', m => m.position.set(1.0, .5, -.9));
    add(new THREE.BoxGeometry(2.0, .06, .55), '#15171c', m => m.position.set(0, 1.12, -2.0));
    add(new THREE.BoxGeometry(.08, .35, .3), '#15171c', m => m.position.set(-.7, .9, -1.95));
    add(new THREE.BoxGeometry(.08, .35, .3), '#15171c', m => m.position.set(.7, .9, -1.95));
    lamp(-.6, .52, 2.16, '#bfe8ff'); lamp(.6, .52, 2.16, '#bfe8ff'); tail(-.6, .62, -2.18); tail(.6, .62, -2.18);
    cabin(.68, 0, -.25, .3);
    [[-1.0, .38, 1.4], [1.0, .38, 1.4], [-1.05, .42, -1.35], [1.05, .42, -1.35]].forEach(w => wheel(w[0], w[1], w[2], w[2] > 0 ? .38 : .44));
  } else if (kind === 'taxi') {
    add(new THREE.BoxGeometry(1.75, .6, 3.8), color, m => m.position.y = .65);
    add(new THREE.BoxGeometry(1.55, .6, 1.9), color, m => m.position.set(0, 1.2, -.2));
    add(new THREE.BoxGeometry(1.58, .42, 1.6), '#9fd3f0', m => m.position.set(0, 1.22, -.2), GL); cabin(1.05, .45, -.3, .4);
    add(new THREE.BoxGeometry(.7, .2, .3), '#fff7c2', m => m.position.set(0, 1.6, -.2), { emissive: '#fff2a0', emissiveIntensity: .9 });
    add(new THREE.BoxGeometry(1.76, .12, 3.8), '#1c1c1c', m => m.position.y = .85);
    add(new THREE.BoxGeometry(.4, .2, .08), '#fff7c2', m => m.position.set(-.6, .7, 1.92), { emissive: '#fff2a0', emissiveIntensity: .8 });
    add(new THREE.BoxGeometry(.4, .2, .08), '#fff7c2', m => m.position.set(.6, .7, 1.92), { emissive: '#fff2a0', emissiveIntensity: .8 });
    [[-.9, .38, 1.2], [.9, .38, 1.2], [-.9, .38, -1.2], [.9, .38, -1.2]].forEach(w => wheel(w[0], w[1], w[2], .38));
  } else if (kind === 'bike') {
    add(new THREE.BoxGeometry(.5, .4, 1.9), color, m => m.position.y = .6);
    add(new THREE.BoxGeometry(.55, .45, .7), color, m => m.position.set(0, .95, .55));
    add(new THREE.BoxGeometry(.9, .07, .07), '#222', m => m.position.set(0, 1.2, .8));
    add(new THREE.BoxGeometry(.45, .1, .8), '#2a2a2a', m => m.position.set(0, .88, -.35));
    add(new THREE.BoxGeometry(.4, .3, .5), color, m => m.position.set(0, .9, -.95));
    wheel(0, .36, .85, .36); wheel(0, .36, -.85, .36);
    add(new THREE.BoxGeometry(.28, .2, .08), '#fff7c2', m => m.position.set(0, 1.0, 1.1), { emissive: '#fff2a0', emissiveIntensity: .9 });
  } else if (kind === 'bicycle') {
    add(new THREE.BoxGeometry(.08, .08, 1.5), color, m => m.position.y = .75);
    add(new THREE.BoxGeometry(.08, .7, .08), color, m => m.position.set(0, .7, .75));
    add(new THREE.BoxGeometry(.7, .05, .05), '#222', m => m.position.set(0, 1.1, .75));
    add(new THREE.BoxGeometry(.15, .05, .35), '#2a2a2a', m => m.position.set(0, 1.05, -.45));
    wheel(0, .4, .75, .4); wheel(0, .4, -.75, .4);
  } else if (kind === 'suv' || kind === 'van') {
    const van = kind === 'van', L = van ? 4.2 : 3.9, H = van ? 1.5 : 1.0;
    add(new THREE.BoxGeometry(1.9, .7, L), color, m => m.position.y = .8);
    add(new THREE.BoxGeometry(1.8, H * .75, van ? L - .7 : L * .62), color, m => m.position.set(0, 1.3 + (H - 1) * .3, van ? -.3 : -.5));
    add(new THREE.BoxGeometry(1.84, H * .4, van ? 1.2 : L * .5), '#9fd3f0', m => m.position.set(0, 1.45 + (H - 1) * .35, van ? .7 : -.4), GL);
    if (!van) { add(new THREE.BoxGeometry(.06, .08, L * .5), '#222', m => m.position.set(-.8, 1.95, -.4)); add(new THREE.BoxGeometry(.06, .08, L * .5), '#222', m => m.position.set(.8, 1.95, -.4)); add(new THREE.CylinderGeometry(.42, .42, .2, 10), '#1c1c1c', m => { m.rotation.x = Math.PI / 2; m.position.set(0, 1.1, -L / 2 - .12); }); }
    else { add(new THREE.BoxGeometry(.04, .8, 1.6), '#cfcab8', m => m.position.set(-.96, 1.35, -.9)); add(new THREE.BoxGeometry(1.6, .12, .12), '#e2a52b', m => m.position.set(0, 1.1, -L / 2 - .02)); }
    cabin(1.15, L * .12, -.2, .4);
    add(new THREE.BoxGeometry(.45, .2, .08), '#fff7c2', m => m.position.set(-.65, .85, L / 2 + .02), { emissive: '#fff2a0', emissiveIntensity: .8 });
    add(new THREE.BoxGeometry(.45, .2, .08), '#fff7c2', m => m.position.set(.65, .85, L / 2 + .02), { emissive: '#fff2a0', emissiveIntensity: .8 });
    [[-1, .45, L * .3], [1, .45, L * .3], [-1, .45, -L * .3], [1, .45, -L * .3]].forEach(w => wheel(w[0], w[1], w[2], .46));
  } else if (kind === 'pickup') {
    add(new THREE.BoxGeometry(1.9, .6, 4.4), color, m => m.position.y = .75);
    add(new THREE.BoxGeometry(1.8, .8, 1.5), color, m => m.position.set(0, 1.35, .7));
    add(new THREE.BoxGeometry(1.84, .4, 1.3), '#9fd3f0', m => m.position.set(0, 1.45, .75), GL); cabin(1.15, 1.1, .45, .4);
    add(new THREE.BoxGeometry(.06, .3, 1.8), '#3a3d44', m => m.position.set(-.9, 1.5, -1.25)); add(new THREE.BoxGeometry(.06, .3, 1.8), '#3a3d44', m => m.position.set(.9, 1.5, -1.25));
    add(new THREE.BoxGeometry(1.7, .35, 1.8), '#3a3d44', m => m.position.set(0, 1.18, -1.25));
    add(new THREE.BoxGeometry(.45, .2, .08), '#fff7c2', m => m.position.set(-.65, .85, 2.22), { emissive: '#fff2a0', emissiveIntensity: .8 });
    add(new THREE.BoxGeometry(.45, .2, .08), '#fff7c2', m => m.position.set(.65, .85, 2.22), { emissive: '#fff2a0', emissiveIntensity: .8 });
    [[-1, .46, 1.4], [1, .46, 1.4], [-1, .46, -1.4], [1, .46, -1.4]].forEach(w => wheel(w[0], w[1], w[2], .48));
  } else if (kind === 'boat') {
    add(new THREE.BoxGeometry(1.7, .6, 3.6), color, m => m.position.y = .2);
    add(new THREE.ConeGeometry(.85, 1.4, 4), color, m => { m.position.set(0, .2, 2.5); m.rotation.set(Math.PI / 2, Math.PI / 4, 0); });
    add(new THREE.BoxGeometry(1.2, .6, 1.2), '#f2f0e6', m => m.position.set(0, .8, -.6));
    add(new THREE.BoxGeometry(1.0, .3, .06), '#9fd3f0', m => m.position.set(0, .9, .02), { roughness: .15 });
  } else {
    add(new THREE.BoxGeometry(.5, .35, 1.7), color, m => m.position.y = .55);
    add(new THREE.BoxGeometry(.55, .5, .5), color, m => m.position.set(0, .8, .75));
    add(new THREE.BoxGeometry(.9, .08, .08), '#222', m => m.position.set(0, 1.25, .62));
    add(new THREE.BoxGeometry(.5, .12, .7), '#2a2a2a', m => m.position.set(0, .82, -.15));
    wheel(0, .33, .75, .33); wheel(0, .33, -.75, .33);
    add(new THREE.BoxGeometry(.25, .18, .08), '#fff7c2', m => m.position.set(0, .95, .98), { emissive: '#fff2a0', emissiveIntensity: .8 });
  }
  return g;
}
const VEH_COLORS = ['#d94b3d', '#2f7fd1', '#e8b923', '#2fa86a', '#8a4fc7'];
function setVehicle(holder, kind, seed) {
  // holder: { group (avatar), veh (vehicle group or null), vkind }
  if (holder === player && !kind) occRestore(); // 149: x-ray clones must not outlive the driven vehicle

  if (holder.vkind === kind && !(holder === player && holder.pk && !kind)) return;
  if (holder === player && holder.pk) releaseParked(kind);
  if (holder === player) player.alt = 0;
  if (holder.veh) { scene.remove(holder.veh); holder.veh = null; }
  holder.vkind = kind || null;
  holder.group.visible = true;
  setRidePose(holder.group, !!(kind && VEH[kind] && !VEH[kind].hide));
  if (kind && VEH[kind]) {
    holder.veh = buildVehicle(kind, VEH[kind].color || VEH_COLORS[Math.abs(seed | 0) % VEH_COLORS.length]);
    holder.veh.position.copy(holder.group.position); holder.veh.rotation.y = holder.group.rotation.y;
    scene.add(holder.veh);
    holder.group.visible = !VEH[kind].hide;
  }
}
function syncVehicle(holder) {
  if (!holder.veh) return;
  const g = holder.group;
  holder.veh.position.set(g.position.x, g.position.y, g.position.z);
  holder.veh.rotation.y = g.rotation.y;
  const lean = holder._lean || 0; holder.veh.rotation.z = lean; g.rotation.z = lean; // bank rider and vehicle together into turns
  if (holder.vkind === 'flyster') { const alt = holder.alt || 0; g.position.y += alt; holder.veh.position.y = g.position.y; holder.veh.rotation.z = lean + Math.sin(performance.now() / 500) * .03 * (alt > .3 ? 1 : 0); }
  if (holder.vkind === 'scooter' || holder.vkind === 'bike') g.position.y += .45;
  if (holder.vkind === 'bicycle') g.position.y += .5;
  if (holder.vkind === 'boat') { const bob = Math.sin(performance.now() / 600) * .06; holder.veh.position.y = .85 + bob; g.position.y = 1.15 + bob; }
  if (holder.vkind === 'scooter' || holder.vkind === 'bike' || holder.vkind === 'bicycle') { // riding pose; bicycle pedals by distance
    const dx = g.position.x - (holder._ppx === undefined ? g.position.x : holder._ppx), dz = g.position.z - (holder._ppz === undefined ? g.position.z : holder._ppz);
    holder._ppx = g.position.x; holder._ppz = g.position.z;
    holder._ped = (holder._ped || 0) + Math.hypot(dx, dz) * 1.5;
    ridePose(g, holder.vkind, holder._ped);
  }
}
function idSeed(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
function toggleRide(kind) {
  if (!player || state.transit) return; // 150: the route vehicle is the crossing
  if ((player.alt || 0) > .3) { pushToast('Land first.', 'fly'); return; }
  if (state.taxi) cancelTaxi();
  const next = player.vkind === kind ? null : kind;
  const B = worldData.boat;
  if (next === 'boat') {
    if (!B) { pushToast('Boats are in coastal cities with a harbour. Try New York, Sydney or Dubai.'); return; }
    if (!B.nearShore(player.x, player.z)) { pushToast('Walk to the water to board a boat.'); return; }
    [player.x, player.z] = B.toWater(player.x, player.z);
  } else if (player.vkind === 'boat') {
    if (!B || !B.nearShore(player.x, player.z)) { pushToast('Sail back to the shore to get off.'); return; }
    [player.x, player.z] = B.toLand(player.x, player.z);
  }
  if (next && next !== 'boat' && worldData.inSwim && worldData.inSwim(player.x, player.z)) { pushToast('Climb out of the water first.'); return; } // 118t: no mounting vehicles while swimming (pool or sea)
  setVehicle(player, next, idSeed(state.account ? state.account.playerId : 'x'));
  document.querySelectorAll('#ride-menu [data-veh]').forEach(b => b.classList.toggle('is-on', b.dataset.veh === next)); $('btn-ride').classList.toggle('is-on', !!next); $('ride-menu').classList.remove('open');
  pushToast(next ? VEH[next].label + ' on. Tap it again to get off.' : 'On foot', null, true);
  ping();
}


/* ---------- in-game taxi service (free, no fares, local visuals) ---------- */
function taxiPlaces() {
  const ps = (worldData.places || []).filter(p => p.name && p.name !== 'Pool' && !/^Harbour/.test(p.name));
  // Generated quarters can share a name. Compass labels distinguish stops without inventing local names.
  const counts = new Map(); for (const p of ps) counts.set(p.name, (counts.get(p.name) || 0) + 1);
  const sector = p => (p.z < 0 ? 'north' : 'south') + (p.x < 0 ? 'west' : 'east');
  return ps.map(p => ({ name: p.name, taxiLabel: p.name.replace(/ \(.*$/, '') + (counts.get(p.name) > 1 ? ' (' + sector(p) + ')' : ''), x: p.x, z: p.z, r: p.r || 0, d: Math.hypot(p.x - player.x, p.z - player.z) })).sort((u, v) => u.d - v.d).slice(0, 8);
}
function openTaxiPanel() {
  if (state.journey) return;
  $('ride-menu').classList.remove('open');
  if (!player) return;
  if ((player.alt || 0) > .3) { pushToast('Land first.', 'fly'); return; }
  if (state.taxi) { cancelTaxi('Taxi cancelled.'); return; }
  if (player.vkind === 'boat') { pushToast('Come ashore first, taxis do not sail.', 'taxi'); return; }
  if (worldData.inPool && worldData.inPool(player.x, player.z)) { pushToast('Climb out of the pool first.', 'taxi'); return; }
  const ps = taxiPlaces();
  if (!ps.length) { pushToast('No taxi stops here yet.', 'taxi'); return; }
  const box = $('taxi-panel'); box.innerHTML = '<div class="lk-sub">Free taxi to...</div>';
  const bay0 = taxiPickupBay();
  ps.forEach(p => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lk-ridebtn'; const drop = taxiDropoff(p.x, p.z, p.r || 0, bay0 ? bay0.x : player.x, bay0 ? bay0.z : player.z); b.textContent = p.taxiLabel + ' · ' + Math.round(p.d) + ' m from you' + (!drop ? ' · no road route' : drop.walk > 6 ? ' · taxi drops ~' + drop.walk + ' m from the stop' : ''); if (!drop) { b.disabled = true; b.style.opacity = .45; } b.onclick = () => { box.classList.remove('open'); startTaxi(p); }; box.appendChild(b); });
  const c = document.createElement('button'); c.type = 'button'; c.className = 'lk-ridebtn'; c.textContent = 'Cancel'; c.onclick = () => box.classList.remove('open'); box.appendChild(c);
  box.classList.add('open');
}
function startTaxi(p) {
  if (player.vkind) setVehicle(player, null, 0);
  document.querySelectorAll('#ride-menu [data-veh]').forEach(b => b.classList.remove('is-on'));
  const bay = taxiPickupBay(); // the cab only uses the road network - pickup happens at a legal roadside bay
  if (!bay) { pushToast('No clear roadside pickup here. Step closer to a road and try again.', 'taxi', true); return; }
  const drop = taxiDropoff(p.x, p.z, p.r || 0, bay.x, bay.z); // reachability is bay->curb: the player walks to the bay, the cab drives the roads
  if (!drop) { pushToast('No clear road for a taxi to ' + p.name.replace(/ \(.*$/, '') + ' right now. Try walking or another stop.', 'taxi', true); return; }
  const horiz = bay.ax ? bay.ax === 'z' : (bay.z === 0 || bay.z === 40 || Math.abs(Math.abs(bay.z) - 78) < .01);
  let ax = bay.x, az = bay.z, heading = horiz ? Math.PI / 2 : 0;
  for (const s of [1, -1]) { const cx = horiz ? bay.x + s * 24 : bay.x, cz = horiz ? bay.z : bay.z + s * 24; // roll in along the corridor, never across a field
    if (worldData.roadAsphalt(cx, cz, -1.4) && !taxiBlockedAt(cx, cz, 2.4)) { ax = cx; az = cz; heading = Math.atan2(bay.x - cx, bay.z - cz); break; } }
  const car = buildVehicle('taxi', VEH.taxi.color);
  car.position.set(ax, worldData.groundY(), az); car.rotation.y = heading; scene.add(car);
  state.taxi = { phase: 'arrive', bay, target: p, drop, car, stuckT: 0, lastD: 1e9 };
  pushToast(bay.walk > 8 ? 'Taxi coming to the roadside ~' + bay.walk + ' m from you. Meet it there - free, no fare.' : 'Taxi on the way to you. Free, no fare.', 'taxi', true);
}
function disposeTaxiCar(car) {
  scene.remove(car); disposeModel(car);
  // Incoming cabs own their materials; unlike parked cars, they are never reused.
  const materials = new Set();
  car.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
  materials.forEach(m => m.dispose());
}
function cancelTaxi(msg) {
  const t = state.taxi; if (!t) return;
  if (t.car) { disposeTaxiCar(t.car); t.car = null; }
  state.taxi = null;
  if (player.vkind === 'taxi') setVehicle(player, null, 0);
  $('btn-ride').classList.remove('is-on');
  if (msg) pushToast(msg, 'taxi');
}
/* taxi waypoint routing: A* over a coarse occupancy grid so rides do not get stuck on buildings */
function taxiBlockedAt(x, z, m) {
  if (worldData.plaza && Math.hypot(x - worldData.plaza.x, z - worldData.plaza.z) < worldData.plaza.r + m) return true; // the landmark plaza is for walking: taxis detour, never cut across
  if (poolRectHit(x, z, Math.max(m, 2.19))) return true; // taxi corner sweep 2.19 (hx 1.04, hz 1.93): no heading can overhang water
  if (onStageRect(x, z, m)) return true;
  const [cx, cz] = worldData.clamp(x, z); if (Math.abs(cx - x) > .01 || Math.abs(cz - z) > .01) return true;
  for (const c of worldData.colliders) { if (c.off || c.wallEast) continue;
    if (c.hw) { if (Math.abs(x - c.x) < c.hw + m && Math.abs(z - c.z) < c.hd + m) return true; continue; } // box footprint, same axes as physics pushout
    if (Math.hypot(x - c.x, z - c.z) < c.r + m) return true; }
  return false;
}
function taxiClearLine(x0, z0, x1, z1, m) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d));
  for (let i = 1; i < n; i++) { const t = i / n; if (taxiBlockedAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, m)) return false; }
  return true;
}
const TAXI_MARGINS = [2.2, 1.6, 1.45]; // cleanest-first; bottom stays above the 1.35 vehicle body margin
/* curbside drop-off: a named stop is the PLACE; the taxi stops at the nearest point that has a
   clear full footprint (>= taxi corner sweep 2.19 + epsilon) AND is reachable at the cleanest
   route margin, and the player walks the rest. The car never enters dense plaza furniture. */
function taxiClearanceAt(x, z) {
  let cl = 6;
  for (const c of worldData.colliders) { if (c.off || c.wallEast) continue; const d = Math.hypot(x - c.x, z - c.z) - c.r; if (d < cl) cl = d; }
  return cl;
}
function taxiGrid(margin) {
  const cache = worldData._taxiG || (worldData._taxiG = {});
  return cache[margin] || (cache[margin] = (() => {
    const CS = 2;
    const minX = worldData.clamp(-1e9, 0)[0], maxX = worldData.clamp(1e9, 0)[0];
    const minZ = worldData.clamp(0, -1e9)[1], maxZ = worldData.clamp(0, 1e9)[1];
    const w = Math.max(2, Math.ceil((maxX - minX) / CS)), h = Math.max(2, Math.ceil((maxZ - minZ) / CS));
    const blocked = new Uint8Array(w * h), road = new Uint8Array(w * h);
    for (let gz = 0; gz < h; gz++) for (let gx = 0; gx < w; gx++) {
      const cx = minX + (gx + .5) * CS, cz = minZ + (gz + .5) * CS;
      if (taxiBlockedAt(cx, cz, margin)) blocked[gz * w + gx] = 1;
      if (worldData.roadAsphalt && worldData.roadAsphalt(cx, cz, -1.4)) road[gz * w + gx] = 1; else blocked[gz * w + gx] = 1; // HARD RULE: the cab occupies asphalt only - fields/plazas are ineligible, not merely expensive
    }
    return { minX, minZ, w, h, blocked, road, CS };
  })());
}
function taxiCellOf(G, x, z) { return [Math.min(G.w - 1, Math.max(0, Math.floor((x - G.minX) / G.CS))), Math.min(G.h - 1, Math.max(0, Math.floor((z - G.minZ) / G.CS)))]; }
function taxiFree(G, gx, gz) { return gx >= 0 && gz >= 0 && gx < G.w && gz < G.h && !G.blocked[gz * G.w + gx]; }
function taxiNearestFree(G, gx, gz) { if (taxiFree(G, gx, gz)) return [gx, gz];
  for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) === r && taxiFree(G, gx + dx, gz + dz)) return [gx + dx, gz + dz]; }
  return null; }
function taxiCurbPoints() { // legal taxi stops: road centre-line points with a clear whole-car footprint, cached per city
  if (worldData._curbs) return worldData._curbs;
  const pts = [];
  if (worldData.roadAsphalt && worldData.roads) {
    const minX = worldData.clamp(-1e9, 0)[0] + 2, maxX = worldData.clamp(1e9, 0)[0] - 2;
    const minZ = worldData.clamp(0, -1e9)[1] + 2, maxZ = worldData.clamp(0, 1e9)[1] - 2;
    for (const rd of worldData.roads) {
      if (rd.pts) { // 176: real-network cities (Prague) carry road polylines, not axis segments - sample along the arc, same legal-stop tests; ax follows the dominant axis for the bay-orientation heuristic
        for (let i = 0; i + 1 < rd.pts.length; i++) { const [x1, z1] = rd.pts[i], [x2, z2] = rd.pts[i + 1]; const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 2));
          for (let k = 0; k <= n; k++) { const x = x1 + (x2 - x1) * k / n, z = z1 + (z2 - z1) * k / n; if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
            if (worldData.roadAsphalt(x, z, -1.4) && !taxiBlockedAt(x, z, 2.4)) pts.push([x, z, Math.abs(x2 - x1) > Math.abs(z2 - z1) ? 'z' : 'x']); } }
        continue;
      }
      const lo = Math.max(rd.from, rd.ax === 'z' ? minX : minZ), hi = Math.min(rd.to, rd.ax === 'z' ? maxX : maxZ);
      for (let t = lo; t <= hi; t += 2) { const x = rd.ax === 'z' ? t : rd.c, z = rd.ax === 'z' ? rd.c : t;
        if (worldData.roadAsphalt(x, z, -1.4) && !taxiBlockedAt(x, z, 2.4)) pts.push([x, z, rd.ax]); }
    }
  }
  return worldData._curbs = pts;
}
function taxiPickupBay() { // where the taxi legally waits for THIS hail: nearest clear roadside point to the player
  let best = null, bd = 1e18;
  for (const [x, z, ax] of taxiCurbPoints()) { const d = Math.hypot(x - player.x, z - player.z); if (d < bd) { bd = d; best = { x, z, ax }; } }
  return best ? { x: best.x, z: best.z, ax: best.ax, walk: Math.round(bd) } : null;
}
function taxiDropoff(tx, tz, r, fromX, fromZ) {
  // curbside drop-off: the taxi stops ON the road network at the clear point nearest the stop;
  // the last walk from curb to the stop is disclosed in the panel and on arrival
  const cands = taxiCurbPoints().map(([x, z]) => ({ x, z, d: Math.hypot(x - tx, z - tz) })).sort((u, v) => u.d - v.d).slice(0, 6);
  for (const c of cands) if (taxiRoute(fromX, fromZ, c.x, c.z, TAXI_MARGINS[0], 5)) return { x: c.x, z: c.z, walk: Math.round(c.d) };
  return null; // no reachable curbside on asphalt: the ride is declined honestly
}
function taxiRoute(fx, fz, tx, tz, margin, arriveR) {
  margin = margin || TAXI_MARGINS[0];
  const G = taxiGrid(margin);
  const s0 = taxiCellOf(G, fx, fz), g0 = taxiCellOf(G, tx, tz);
  const S = taxiNearestFree(G, s0[0], s0[1]);
  // goal: any free cell inside the arrival ring counts (large stops can have a blocked center);
  // pick the ring candidate nearest the start, fall back to nearest free cell to the center
  let T = null, goalPt = null;
  if (arriveR) {
    const rr = Math.max(4, arriveR - 2);
    let best = 1e18;
    for (let a = 0; a < 24; a++) {
      const px = tx + Math.sin(a / 24 * 2 * Math.PI) * rr, pz = tz + Math.cos(a / 24 * 2 * Math.PI) * rr;
      const [gx, gz] = taxiCellOf(G, px, pz);
      if (taxiFree(G, gx, gz)) { const dd = Math.hypot(px - fx, pz - fz); if (dd < best) { best = dd; T = [gx, gz]; goalPt = [px, pz]; } }
    }
  }
  if (!T) T = taxiNearestFree(G, g0[0], g0[1]);
  if (!S || !T) return null;
  const W = G.w, H = G.h, idx = (x, z) => z * W + x;
  const dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  dist[idx(S[0], S[1])] = 0;
  const heap = [[0, S[0], S[1]]]; // [f, gx, gz] binary min-heap
  const push = e => { heap.push(e); for (let i = heap.length - 1; i > 0;) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[j], heap[i]] = [heap[i], heap[j]]; i = j; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; for (let i = 0;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const heur = (x, z) => { const dx = Math.abs(x - T[0]), dz = Math.abs(z - T[1]); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let found = false, guard = W * H * 2, pops = 0;
  while (heap.length && guard-- > 0) {
    const [, cx, cz] = pop(); const ci = idx(cx, cz); pops++;
    if (closed[ci]) continue; closed[ci] = 1;
    if (cx === T[0] && cz === T[1]) { found = true; break; }
    for (const [dx, dz, cost] of DIRS) {
      const nx = cx + dx, nz = cz + dz;
      if (!taxiFree(G, nx, nz)) continue;
      if (dx && dz && (!taxiFree(G, cx + dx, cz) || !taxiFree(G, cx, cz + dz))) continue; // no corner cutting
      const ni = idx(nx, nz), nd = dist[ci] + cost; // only asphalt cells are expandable (see taxiGrid): the taxi drives the roads, hard constraint
      if (nd < dist[ni]) { dist[ni] = nd; prev[ni] = ci; push([nd + heur(nx, nz), nx, nz]); }
    }
  }
  if (!found) return null;
  const cells = []; for (let ci = idx(T[0], T[1]); ci >= 0; ci = prev[ci]) cells.push([ci % W, (ci / W) | 0]);
  cells.reverse();
  const pts = cells.map(([gx, gz]) => [G.minX + (gx + .5) * G.CS, G.minZ + (gz + .5) * G.CS]);
  pts[0] = [fx, fz]; // anchor smoothing at the car's TRUE position, not the snapped free cell centre:
                     // the drive heads straight from the car to route[0], so the first leg must be the
                     // one clear-line covers - a snapped centre can sit past a pool/stage corner and
                     // strand the car reverting at the water edge (sydney old town square refusal)
  pts.push(goalPt || [tx, tz]);
  const roadLine = (x0, z0, x1, z1) => { if (!worldData.roadAsphalt) return true;
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d));
    for (let k = 0; k <= n; k++) { const t = k / n; if (!worldData.roadAsphalt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, -1.4)) return false; }
    return true; };
  const out = [pts[0]]; let a = pts[0], i = 1;
  while (i < pts.length) { let j = pts.length - 1, tried = 0;
    for (; j > i; j--) { if (taxiClearLine(a[0], a[1], pts[j][0], pts[j][1], margin) && roadLine(a[0], a[1], pts[j][0], pts[j][1])) break; if (++tried >= 30) { j = i; break; } } // road-true shortcuts are found near the far end; don't quadratic-scan field cuts
    out.push(pts[j]); a = pts[j]; i = j + 1; }
  out.shift();
  out.unshift([fx, fz]); // keep the true start as route[0]: when the shortcut pass collapses the entry segment, the first drive target is a real corner whose incoming arm is the car's actual approach - it must be flaggable too
  for (let k = 1; k < out.length - 1; k++) { // sharp corners get a tight-approach flag ONLY where a pivot-in-place fits the asphalt (body diagonal 2.19); at narrow junctions it cannot, so the natural early-shift arc through the junction box is the feasible turn
    const a1 = Math.atan2(out[k][0] - out[k - 1][0], out[k][1] - out[k - 1][1]), a2 = Math.atan2(out[k + 1][0] - out[k][0], out[k + 1][1] - out[k][1]);
    let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da;
    if (da <= .45 || !worldData.roadAsphalt) continue;
    const fits = (cx, cz) => { // body-diagonal pivot disc must sit fully on asphalt
      if (!worldData.roadAsphalt(cx, cz, 0)) return false;
      for (let q = 0; q < 8; q++) if (!worldData.roadAsphalt(cx + Math.sin(q / 8 * 2 * Math.PI) * 2.19, cz + Math.cos(q / 8 * 2 * Math.PI) * 2.19, 0)) return false;
      return true; };
    let bp = fits(out[k][0], out[k][1]) ? out[k] : null; // corner cuts across a junction box are unsteerable: shift the turn point to the wide side so the body aligns before entering the new arm
    for (let q = 0; q < 8 && !bp; q++) for (const rr of [1.5, 3]) { const cx = out[k][0] + Math.sin(q / 8 * 2 * Math.PI) * rr, cz = out[k][1] + Math.cos(q / 8 * 2 * Math.PI) * rr;
      if (fits(cx, cz) && roadLine(out[k - 1][0], out[k - 1][1], cx, cz) && roadLine(cx, cz, out[k + 1][0], out[k + 1][1])) { bp = [cx, cz]; break; } }
    if (bp) out[k] = [bp[0], bp[1], 'c']; }
  return out.length ? out : null;
}
function taxiStep(dt) {
  const t = state.taxi; if (!t) return null;
  if (state.stage !== 'play') { cancelTaxi(); return null; }
  if (t.phase === 'arrive') { // roll in to the roadside bay along the corridor
    const goal = t.bay || player;
    const dx = goal.x - t.car.position.x, dz = goal.z - t.car.position.z, d = Math.hypot(dx, dz);
    if (d < 1.2) { t.car.position.set(goal.x, t.car.position.y, goal.z); t.phase = 'wait'; t.waitT = 0;
      if (Math.hypot(player.x - goal.x, player.z - goal.z) >= 2.6) pushToast('Your taxi is waiting at the roadside' + (t.bay && t.bay.walk > 8 ? ', ~' + t.bay.walk + ' m from you' : '') + '.', 'taxi', true);
      return null; }
    const s = Math.min(d, 13 * dt); t.car.position.x += dx / d * s; t.car.position.z += dz / d * s; t.car.rotation.y = Math.atan2(dx, dz);
    t.stuckT += dt; if (t.stuckT > 8) cancelTaxi('The taxi could not reach the roadside. Try again.');
    return null;
  }
  if (t.phase === 'wait') { // parked at the bay; the player walks the last steps to the cab
    const d = Math.hypot(player.x - t.car.position.x, player.z - t.car.position.z);
    if (d < 2.6) { // board AT the cab (player snaps to it: you get in the car, not into the field beside it), facing the corridor so the swept body can leave a narrow bay
      player.x = t.car.position.x; player.z = t.car.position.z; player.dir = t.car.rotation.y;
      disposeTaxiCar(t.car); t.car = null; setVehicle(player, 'taxi', 0); $('btn-ride').classList.add('is-on'); t.phase = 'drive';
      pushToast('Hop in: heading to ' + (t.target.taxiLabel || t.target.name.replace(/ \(.*$/, '')) + '.', 'taxi', true); return null; }
    t.waitT = (t.waitT || 0) + dt; if (t.waitT > 120) cancelTaxi('Your taxi waited and left.');
    return null;
  }
  const goal = t.drop || t.target;
  const ddx = goal.x - player.x, ddz = goal.z - player.z, d = Math.hypot(ddx, ddz);
  const arriveR = t.drop ? 5 : Math.max(8, (t.target.r || 0) + 5);
  if (d < arriveR) { const n = t.target.taxiLabel || t.target.name.replace(/ \(.*$/, '');
    cancelTaxi(t.drop && t.drop.walk > 6 ? 'Dropped off near ' + n + '. The last ~' + t.drop.walk + ' m are on foot.' : 'Arrived at ' + n + '. Free ride, no fare.');
    return null; }
  const moved = Math.hypot(player.x - (t.bx == null ? player.x : t.bx), player.z - (t.bz == null ? player.z : t.bz));
  t.bx = player.x; t.bz = player.z;
  // stuck = not actually MOVING - a detour route legitimately drives away from the goal for a while
  if (moved < .02) t.stuckT += dt; else t.stuckT = Math.max(0, t.stuckT - dt * 2);
  if (t.stuckT > 2.5) {
    if ((t.marginI || 0) < TAXI_MARGINS.length - 1 || !t.rerouted) {
      if ((t.marginI || 0) < TAXI_MARGINS.length - 1) t.marginI = (t.marginI || 0) + 1; else t.rerouted = true;
      t.route = null; t.stuckT = 0; t.lastD = 1e9; t.progD = null; return null;
    }
    cancelTaxi('The taxi could not get closer. Dropped you here.'); return null;
  }
  t.driveT = (t.driveT || 0) + dt; // absolute budget: replan looser, then give up, so a ride can never wander forever
  if (t.driveT > 25 && (t.marginI || 0) < TAXI_MARGINS.length - 1) { t.marginI = (t.marginI || 0) + 1; t.route = null; t.driveT = 0; t.stuckT = 0; t.lastD = 1e9; t.progD = null; return null; }
  if (!t.route) { t.route = taxiRoute(player.x, player.z, goal.x, goal.z, TAXI_MARGINS[t.marginI || 0], arriveR);
    if (!t.route) { cancelTaxi('No clear road route from here - the cab stays on asphalt. Dropped you here.'); return null; } }
  while (t.route.length > 1 && Math.hypot(t.route[0][0] - player.x, t.route[0][1] - player.z) < (t.route[0][2] === 'c' ? 0.5 : 1.6)) t.route.shift();

  // progress-aware give-up: margin replans reset driveT, so a genuinely long but steadily approaching
  // route (a quarter reachable only by a perimeter road) outlived the old flat cap and was cancelled
  // metres short with a misleading "no clear way". Runs AFTER the route exists and is shifted, so the
  // baseline is planned-route remaining (a detour following its plan counts even while it drives away
  // from the goal), falling back to goal distance. Cancel only when the last 12s brought no advance,
  // or at a hard total cap - stuck detection (stuckT) is unchanged and still fires first.
  t.totalT = (t.totalT || 0) + dt;
  let adv;
  if (t.route && t.route.length) { adv = Math.hypot(t.route[0][0] - player.x, t.route[0][1] - player.z);
    for (let i = 1; i < t.route.length; i++) adv += Math.hypot(t.route[i][0] - t.route[i - 1][0], t.route[i][1] - t.route[i - 1][1]); }
  else adv = Math.hypot(goal.x - player.x, goal.z - player.z);
  if (t.progD == null || adv < t.progD - 8) { t.progD = adv; t.progT = t.totalT; }
  if ((t.totalT > 40 && t.totalT - (t.progT || 0) > 12) || t.totalT > 150) { cancelTaxi('The taxi could not find a clear way there. Dropped you here.'); return null; }
  // blocked-frame recovery (taxi-local steering; physics unchanged): if revert physics stopped us,
  // probe escalating heading offsets around the desired heading, then replan once offsets run out
  if (moved < .02) {
    t.blockedN = (t.blockedN || 0) + 1;
    if (t.blockedN > 4) {
      const seq = [.5, -.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3];
      t.avoidI = (t.avoidI || 0) + 1; t.blockedN = 0;
      if (t.avoidI > seq.length) { t.avoidI = 0; t.avoid = 0; t.route = null; }
      else t.avoid = seq[t.avoidI - 1];
    }
  } else { t.blockedN = 0; t.avoidI = 0; t.avoid = 0; }
  if (!t.route) { t.route = taxiRoute(player.x, player.z, goal.x, goal.z, TAXI_MARGINS[t.marginI || 0], arriveR); // the avoid-probe replan path used to fall through to a null deref
    if (!t.route) { cancelTaxi('No clear road route from here - the cab stays on asphalt. Dropped you here.'); return null; } }
  const dx = t.route[0][0] - player.x, dz = t.route[0][1] - player.z, dw = Math.hypot(dx, dz) || 1;
  const hd = Math.atan2(dx / dw, dz / dw) + (t.avoid || 0);
  const dYaw = Math.abs(((hd - player.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  t.crawl = !!(t.route[0][2] === 'c' && dw < 1.8) || !!(t.crawl && dYaw > 0.22); // crawl from a flagged sharp corner until the body has finished the yaw swing - at full speed the lerp slews the body diagonally into the new arm and a corner leaves the asphalt near the edge
  return [Math.sin(hd), Math.cos(hd)];
}

/* ---------- remotes ---------- */
async function pollWorld() {
  if (!state.account || state.apiDown) return;
  if (state.transit) return; // 150: no origin-room remotes rendered in the transit scene, no cross-mutation
  if (state._protoPrague) return; // 170: preview is LOCAL-ONLY (Main 6:30): no host-room remotes, presence, goal or ball state leaks into the preview, and the preview never repaints from the host room
  const _pg = state._cityGen, _pc = state.city; // 150f: lifecycle pin - see guard after the await
  try {
    const _t0 = Date.now(); const r = await api('/world?city=' + state.city + '&near=' + encodeURIComponent(state.account.playerId)); if (state.transit || state._protoPrague || _pg !== state._cityGen || _pc !== state.city) { window.__lkStalePoll = (window.__lkStalePoll || 0) + 1; return; } // 150e+f/170: a poll from an earlier scene/mode (pre-transit, pre-abort, pre-arrival, pre-travel, pre-preview) must never repaint the current one - no origin remotes, no stale presence count
    if (r.now) syncBeat(r.now, _t0, Date.now());
    const seen = new Set();
    for (const rp of r.players) {
      if (state.account && rp.id === state.account.playerId) { state.selfPv = (!player || !player.pk) && Date.now() > (state.selfPvIgnore || 0) ? (rp.pos.pv || null) : null; continue; }
      seen.add(rp.id);
      let R = remotes.get(rp.id);
      const d = state.city === 'kerala' ? DISTRICTS.findIndex(x => x[0] === rp.district) : -1;
      if (!R) {
        const group = buildAvatar(rp.look);
        group.position.set(rp.pos.x || 0, worldData.groundY(rp.pos.x || 0, rp.pos.z || 0), rp.pos.z || 0);
        scene.add(group);
        const base = esc(rp.name) + (d >= 0 ? ' <span>(' + DISTRICTS[d][2] + ')</span>' : '');
        R = { base, emote: null, group, veh: null, vkind: null, tag: makeLabel('lk-nametag lk-nametag-remote', base), tx: rp.pos.x || 0, tz: rp.pos.z || 0, dir: rp.pos.dir || 0, moving: !!rp.pos.moving };
        remotes.set(rp.id, R);
      } else {
        const nx = rp.pos.x || 0, nz = rp.pos.z || 0, nowT = Date.now();
        { // remote run derivation: the protocol carries no run flag, so measure target displacement
          // between world polls. Walk 5.4 vs run 8.4 units/sec separates cleanly at the ~3.5s poll
          // cadence; EMA + hysteresis keeps the classification stable through stop/start mixes.
          if (R.posT) { const dtp = (nowT - R.posT) / 1000;
            if (dtp > .25) { const inst = Math.hypot(nx - R.tx, nz - R.tz) / dtp;
              if (inst > 30) { R.spd = undefined; R.run = false; } // teleport/travel jump, not motion: re-init next poll
              else { R.spd = R.spd === undefined ? inst : R.spd + (inst - R.spd) * .4;
                R.run = R.run ? R.spd > 6.2 : R.spd > 7.0; } } }
          R.posT = nowT; }
        R.tx = nx; R.tz = nz; R.dir = rp.pos.dir || 0; R.moving = !!rp.pos.moving;
        const lk = JSON.stringify(rp.look || null);
        if (R.lk !== lk) { // the player changed their look: rebuild their avatar in place so everyone sees it
          const old = R.group, ng = buildAvatar(rp.look);
          ng.position.copy(old.position); ng.rotation.y = old.rotation.y; ng.visible = old.visible; setRidePose(ng, !!(R.vkind && VEH[R.vkind] && !VEH[R.vkind].hide));
          scene.add(ng); scene.remove(old); disposeModel(old); R.group = ng; R.lk = lk;
        }
      }
      if (R.lk === undefined) R.lk = JSON.stringify(rp.look || null);
      R.pv = rp.pos.pv || null; R.alt = rp.pos.y || 0;
      setVehicle(R, rp.pos.veh && VEH[rp.pos.veh] ? rp.pos.veh : null, idSeed(rp.id));
      if ((rp.emote || null) !== R.emote) { R.emote = rp.emote || null; R.tag.el.innerHTML = R.base + (R.emote ? ' <span class="lk-emote">· ' + EMO[R.emote] + '</span>' : ''); }
    }
    for (const [id, R] of remotes) {
      if (!seen.has(id)) { if (R.veh) { scene.remove(R.veh); disposeModel(R.veh); } scene.remove(R.group); disposeModel(R.group); R.tag.el.remove(); remotes.delete(id); }
    }
    $('presence-num').textContent = r.online || 1;
    if (r.goal) { $('goal-num').textContent = r.goal.points + '/' + r.goal.target; $('goal-bar').style.width = Math.min(100, r.goal.points / r.goal.target * 100) + '%'; if (state._round !== undefined && r.goal.rounds > state._round && state._roundCity === state.city) { pushToast('🎉 City goal reached! ' + ((CITY_DEFS[state.city] || {}).name || 'Kerala') + ' collected 500 points together', null, true); chime([523, 659, 784, 1047], .5); } state._round = r.goal.rounds; state._roundCity = state.city; }
    if (r.bb && r.bb.length && r.city === state.city) adoptBalls(r.bb); // 118v
  } catch { /* keep last known */ }
}
const TAB_ID = Math.random().toString(36).slice(2, 12);
async function ping() {
  if (!state.account || !state.account.token || !player) return;
  const g = state._cityGen, c = state.city; // a ping sent before travel must never ack the new city
  try {
    const pr = await api('/players/' + state.account.playerId + '/ping', {
      method: 'POST',
      body: JSON.stringify((state.transit || state._protoPrague) // 150/170: the broadcast stays the frozen departure snapshot - the origin avatar stands at the gate; transit/preview coords/altitude/vehicle never reach the origin room
        ? { x: +(state.transit ? state.transit.snap : state._protoSnap).x.toFixed(1), z: +(state.transit ? state.transit.snap : state._protoSnap).z.toFixed(1), dir: +(state.transit ? state.transit.snap : state._protoSnap).dir.toFixed(2), moving: false, city: state.city, veh: null, pv: null, tab: TAB_ID, y: 0 }
        : { x: +player.x.toFixed(1), z: +player.z.toFixed(1), dir: +player.dir.toFixed(2), moving: player.moving, city: state.city, veh: player.vkind || null, pv: player.pk ? player.pk.id : null, tab: TAB_ID, y: +(player.alt || 0).toFixed(1), bb: balls.length ? balls.filter(b => b.owner === 'me').map(b => [b.id, +b.x.toFixed(1), +b.z.toFixed(1), +b.vx.toFixed(1), +b.vz.toFixed(1)]) : undefined }), // 118v
    });
    if (g === state._cityGen && c === state.city) { state._pingAckGen = g; V.travelPending = false; } // server has accepted our position in this city: movement tracking is reset, and voice may reconnect here
    if (pr && pr.pvDenied && player.pk) { setVehicle(player, null, 0); pushToast('That vehicle is taken.', 'park'); }
  } catch {}
}

/* ---------- collect ---------- */
async function resyncPoints() { // applies only if it is still the latest resync requested, so an older response can never clobber a newer score
  const sq = (state._ptsSeq = (state._ptsSeq || 0) + 1);
  try { const me = await api('/players/' + state.account.playerId); if (sq === state._ptsSeq) setPoints(me.player.points); } catch {}
}
async function onCollect(p) {
  const cty = state.city, gen = state._cityGen; // pinned: response handlers must not touch a city the player has since left
  p.alive = false; p.popT = 0; p.label.el.style.display = 'none'; // pop-out below replaces the old instant vanish; label still hides at once
  fireSparkles(p.x, worldData.groundY() + 1.25, p.z);
  if (p.slot === null) setTimeout(() => { if (state.city === cty) respawnPickup(p); }, rand(16000, 35000));
  const pending = p.slot === null && !!state.account, ptsBefore = state.points; // slot-less (fallback) collects: the server alone decides the award, so no number until it answers
  if (pending) { popup('···', p.x, p.z); pushToast(itemLabel(p.type) + ' ···', 'collect', true); }
  else {
    setPoints(state.points + p.type.points);
    popup('+' + p.type.points, p.x, p.z);
    { const now = Date.now(), nm = p.type.name; // identical pickups in a burst aggregate into one refreshing toast instead of stacking duplicates
      if (state._ct && state._ct.nm === nm && now - state._ct.at < 2500) state._ct.sum += p.type.points; else state._ct = { nm, sum: p.type.points };
      state._ct.at = now;
      pushToast('+' + state._ct.sum + (state.city === 'kerala' ? ' പോയിന്റ് · ' : ' points · ') + itemLabel(p.type), 'collect'); }
  }
  chime(p.type.points >= 100 ? [523, 659, 784, 1047] : p.type.points >= 25 ? [523, 659, 784] : [523, 659], .32);
  if (!state.account) return;
  try {
    const r = await api('/players/' + state.account.playerId + '/collect', { method: 'POST', body: JSON.stringify(p.slot === null ? { item: p.type.name, city: cty } : { slot: p.slot, city: cty, x: +player.x.toFixed(2), z: +player.z.toFixed(2) }) });
    if (gen !== state._cityGen) { await resyncPoints(); return; } // resolved after travel: never apply the old city's response to the new city
    state._ptsSeq = (state._ptsSeq || 0) + 1; // this success is newer than any in-flight resync: a late resync must not apply over it
    setPoints(r.player.points);
    if (pending) { const d = r.player.points - ptsBefore; if (d > 0) { popup('+' + d, p.x, p.z); pushToast('+' + d + (cty === 'kerala' ? ' പോയിന്റ് · ' : ' points · ') + itemLabel(p.type), 'collect', true); } } // show the value the server actually awarded
    if (p.slot !== null && r.next) { const nx = r.next, city = cty; setTimeout(() => { if (city !== state.city) return; removePickup(p); const t = ITEM_TYPES.find(x => x.name === nx.item); if (t) spawnPickup(slotSpot(nx), t, nx.id); }, r.readyIn); }
  } catch (e) {
    const st = e && e.status;
    if (st === 410) { pushToast('Little World was updated. Reload this page to keep collecting (your login and points are kept).'); return; }
    if (p.slot !== null && st === 409) { removePickup(p); syncPickups(); }
    else if (st !== 429) state.apiDown = true;
    await resyncPoints(); // drop the optimistic points the server did not accept (latest-resync-wins, safe across travel)
  }
}
function popup(text, x, z) {
  const el = document.createElement('div');
  el.className = 'lk-popup'; el.textContent = text;
  $('labels').appendChild(el);
  _v.set(x, 2.4, z).project(camera);
  el.style.left = ((_v.x * .5 + .5) * 100) + '%';
  el.style.top = ((-_v.y * .5 + .5) * 100) + '%';
  setTimeout(() => el.classList.add('go'), 20);
  setTimeout(() => el.remove(), 1500);
}

/* ---------- input ---------- */
function bindInput() {
  const canvas = $('canvas');
  addEventListener('keydown', e => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    keys[e.key.toLowerCase()] = true;
    if (!e.repeat && state.stage === 'play' && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) { if (e.key.toLowerCase() === 'e') useParkedButton(); else if (e.key.toLowerCase() === 'f') toggleFP(); else if (e.key.toLowerCase() === 'c') toggleRide('car'); else if (e.key.toLowerCase() === 'x') toggleRide('scooter'); else if (e.key.toLowerCase() === 'v') toggleRide('roadster'); else if (e.key.toLowerCase() === 'b') toggleRide('boat'); else if (e.key.toLowerCase() === 'n') toggleRide('suv'); else if (e.key.toLowerCase() === 'm') toggleRide('supercar'); }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  // drag to look (mouse + right-half touch), left-half touch = joystick
  let drag = null, joy = null;
  const joyBase = $('joy'), joyKnob = $('joy-knob');
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && e.clientX < innerWidth * .45) {
      joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
      joyBase.style.left = (e.clientX - 55) + 'px'; joyBase.style.top = (e.clientY - 55) + 'px';
      joyBase.hidden = false;
    } else {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (drag && e.pointerId === drag.id) {
      cam.yaw -= (e.clientX - drag.x) * .0052;
      cam.pitch = cam.fp && !(player && player.vkind) ? clamp(cam.pitch + (e.clientY - drag.y) * .003, -1.25, 1.25) : clamp(cam.pitch + (e.clientY - drag.y) * .003, .12, 1.1);
      drag.x = e.clientX; drag.y = e.clientY;
    } else if (joy && e.pointerId === joy.id) {
      joy.dx = clamp((e.clientX - joy.x0) / 46, -1, 1);
      joy.dy = clamp((e.clientY - joy.y0) / 46, -1, 1);
      joyKnob.style.transform = 'translate(' + joy.dx * 30 + 'px,' + joy.dy * 30 + 'px)';
    }
  });
  const end = e => {
    if (drag && e.pointerId === drag.id) drag = null;
    if (joy && e.pointerId === joy.id) { joy = null; joyBase.hidden = true; joyKnob.style.transform = ''; }
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist + e.deltaY * .01, 4.5, 15); }, { passive: false });
  state._joy = () => joy;
  // A released key/touch may never reach this tab after focus changes. Stop stale input on return.
  const resetInput = () => {
    for (const k of Object.keys(keys)) delete keys[k];
    state.runTouch = state.flyUp = state.flyDown = false;
    drag = joy = null; joyBase.hidden = true; joyKnob.style.transform = '';
  };
  addEventListener('blur', resetInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });
}

/* ---------- movement ---------- */
function updatePlayer(dt) {
  if (!player) return;
  if (state.transit) state.transit.tEl = (state.transit.tEl || 0) + dt; // 150h: crossing clock advances whether or not the vehicle is moving (landing beat must complete even at a stop)
  { const show = state.stage === 'play'; if (state._rideShown !== show) { state._rideShown = show; $('ride-bar').style.display = show ? 'flex' : 'none'; } }
  let ix = 0, iz = 0;
  if (keys['w'] || keys['arrowup']) iz += 1;
  if (keys['s'] || keys['arrowdown']) iz -= 1;
  if (keys['a'] || keys['arrowleft']) ix -= 1;
  if (keys['d'] || keys['arrowright']) ix += 1;
  const joy = state._joy && state._joy();
  if (joy) { ix += joy.dx; iz -= joy.dy; }
  if (state.journey) { ix = 0; iz = 0; if (player) player.moving = false; }
  { const tv = taxiStep(dt); if (tv) { const sn = Math.sin(cam.yaw), cs = Math.cos(cam.yaw); ix = sn * tv[1] - cs * tv[0]; iz = sn * tv[0] + cs * tv[1]; } }
  const mag = Math.hypot(ix, iz);
  player.moving = mag > .12;
  if (!player.moving) player._sp = .35;
  if (player.moving) {
    ix /= Math.max(1, mag); iz /= Math.max(1, mag);
    const swim = !player.vkind && worldData.inSwim && worldData.inSwim(player.x, player.z); // 118t: pool OR sea swim band
    let run = player.vkind ? VEH[player.vkind].speed : swim ? 2.8 : ((keys['shift'] || state.runTouch) ? 8.4 : 5.4);
    if (state.transit) { // 150h: crossing pacing beats (simulated clock, so stepped probes see the same values as real play)
      const t = state.transit;
      if (t.kind === 'sea') run *= 1.5; // open-water pace: the old city-boat 9 u/s made an 87s crossing; 13.5 lands ~58s (air unchanged at 20, ~39s)
      if (t.landT != null) { t._spd = Math.max(0, 1 - (t.tEl - t.landT) / 1.4); run *= t._spd; } // landing beat: ease to a stop over ~1.4s
      else { t._spd = .35 + .65 * Math.min(1, (t.tEl || 0) / 1.2); run *= t._spd; } // takeoff beat: spool up over ~1.2s
    }
    if (player.vkind === 'taxi' && state.taxi && state.taxi.phase === 'drive' && state.taxi.crawl) run = Math.min(run, 2.5);
    // on-foot start ramp (~0.18 s) so walking eases in; top speeds are unchanged
    if (!player.vkind) { player._sp = Math.min(1, (player._sp == null ? .35 : player._sp) + dt / .18); run *= player._sp; }
    const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
    const vx = (sin * iz - cos * ix) * run, vz = (cos * iz + sin * ix) * run;
    player._px = player.x; player._pz = player.z; player._pd = player.dir;
    player.x += vx * dt; player.z += vz * dt;
    const targetDir = Math.atan2(vx, vz);
    let d = targetDir - player.dir;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    player.dir += d * Math.min(1, dt * (player.vkind ? 5 : 12));
    // banking: lean the vehicle (and rider) into turns, proportional to the turn being made; two-wheelers lean most
    { const leanK = ({ scooter: .3, bike: .3, bicycle: .25, boat: .12 })[player.vkind] || (player.vkind ? .08 : 0);
      const lt = Math.max(-1, Math.min(1, d)) * leanK;
      player._lean = (player._lean || 0) + (lt - (player._lean || 0)) * Math.min(1, dt * 7); }
  }
  if (!player.moving || !player.vkind) player._lean = (player._lean || 0) * Math.max(0, 1 - dt * 7);
  if (player.vkind === 'flyster') {
    // limited-burst flight (fictional game values): a thrust-gas tank drains while climbing or hovering, thrust tapers when it runs low,
    // an empty tank cushions a controlled descent, and the tank refills on the ground. Landing still only happens on clear ground.
    if (player.gas == null) player.gas = 1;
    const wantUp = (keys[' '] || state.flyUp) ? 1 : 0, dn = (keys['x'] || state.flyDown) ? 1 : 0, was = player.alt || 0;
    const up = wantUp && (player.gas > FLY.minStart || was > .3) && player.gas > 0 ? 1 : 0;
    if (wantUp && !up && was <= .3 && (state.gasToastAt || 0) < Date.now()) { state.gasToastAt = Date.now() + 4000; pushToast('Thrust tank too low to lift off. It refills on the ground.', 'fly'); }
    else if (was > .3 && !parkSpotClearLand(player.x, player.z) && player.gas <= FLY.reserve + .001 && (state.reserveToastAt || 0) < Date.now()) { state.reserveToastAt = Date.now() + 6000; pushToast('Low-reserve hover. Steer to clear ground to land.', 'fly'); }
    const factor = FLY.minThrust + (1 - FLY.minThrust) * Math.min(1, player.gas / FLY.taperBelow);
    let alt = was;
    if (up) alt += 9 * factor * dt; else if (dn) alt -= 9 * dt;
    else if (was > .6 && player.gas <= 0) alt -= Math.min(FLY.fall, 1 + was * .3) * dt;
    if (!up && !dn && was > 0 && was < .6) alt = 0;
    const safeHere = parkSpotClearLand(player.x, player.z);
    if (alt <= .05) { // landing: only on clear ground (never pool or water); otherwise hover
      if (safeHere) alt = 0; else { alt = Math.max(alt, 2.2); if (was > 2.3 || dn) pushToast('No safe place to land here (pool, water or buildings). Hovering.', 'fly'); }
    }
    player.alt = Math.min(40, Math.max(0, alt));
    if (player.alt > .3) { // draining: climbing costs most, hovering a little; a reserve keeps the hover over unsafe ground
      const rate = (up && player.alt < 39.9) ? FLY.climbDrain : FLY.hoverDrain;
      const floor = (!safeHere && player.alt <= 2.4) ? FLY.reserve : 0;
      player.gas = Math.max(floor, player.gas - rate * dt);
      if (player.gas < .2 && !state.gasLowToast) { state.gasLowToast = true; pushToast('Thrust gas low. Land soon, thrust is fading.', 'fly'); }
    } else { player.gas = Math.min(1, player.gas + FLY.refill * dt); if (player.gas > .5) state.gasLowToast = false; }
  }
  const flying = player.vkind === 'flyster' && (player.alt || 0) > 1.5, overRoofs = false; // building heights are not modelled, so flying cars collide with every building footprint
  // collisions
  const onBoat = player.vkind === 'boat' && worldData.boat;
  { // resolve collisions and the map edge together: overlapping colliders next to the edge could push each other back inside, so repeat a few passes and fall back to the last valid position
    const cols = onBoat ? worldData.boat.colliders : worldData.colliders, clampFn = onBoat ? worldData.boat.clamp : (!player.vkind && worldData.clampSwim ? worldData.clampSwim : worldData.clamp); // 118t: on-foot players may wade into the sea swim band; vehicles/taxis keep the dry clamp
    const pr = onBoat || !player.vkind ? .45 : ({ scooter: .8, bike: .9, bicycle: .55 }[player.vkind] || 1.35); // vehicles keep a wider body margin than pedestrians
    const scanCols = pad => !onBoat && worldData.colliderScan ? worldData.colliderScan(() => player, pad) : cols; //210 Prague static-block broad phase; order/live push position retained
    const push = () => { if (overRoofs) return; for (const c of scanCols(pr)) {
      if (c.wallEast || c.off) continue;
      if (c.hw) { // box footprint (buildings): expand by body margin and push out along the least-penetrated axis, so corners are covered as tightly as faces
        const bdx = player.x - c.x, bdz = player.z - c.z, ex = c.hw + pr, ez = c.hd + pr;
        if (Math.abs(bdx) < ex && Math.abs(bdz) < ez) {
          if (ex - Math.abs(bdx) < ez - Math.abs(bdz)) player.x = c.x + Math.sign(bdx || 1) * ex; else player.z = c.z + Math.sign(bdz || 1) * ez;
        }
        continue;
      }
      const dx = player.x - c.x, dz = player.z - c.z, dist = Math.hypot(dx, dz), min = c.r + pr;
      if (dist < min && dist > .0001) { player.x = c.x + dx / dist * min; player.z = c.z + dz / dist * min; }
    } };
    for (let pass = 0; pass < 4; pass++) { push(); [player.x, player.z] = clampFn(player.x, player.z); }
    if (!overRoofs && player._px !== undefined && Array.from(scanCols(.3)).some(c => !c.wallEast && !c.off && (c.hw ? (Math.abs(player.x - c.x) < c.hw + .3 && Math.abs(player.z - c.z) < c.hd + .3) : Math.hypot(player.x - c.x, player.z - c.z) < c.r + .3))) { player.x = player._px; player.z = player._pz; }
  }
  if (player.vkind && !onBoat && !flying && player._px !== undefined && poolBodyHit(player.x, player.z, player.dir, player.vkind)) { player.x = player._px; player.z = player._pz; player.dir = player._pd; }
  if (player.vkind === 'taxi' && state.taxi && state.taxi.phase === 'drive' && player._px !== undefined && taxiBodyOffRoad(player.x, player.z, player.dir)) { player.x = player._px; player.z = player._pz; player.dir = player._pd; } // ride cabs: the whole swept body stays on the asphalt union - no field/kerb cutting at turns; blocked-frame probe + budgets in taxiStep keep progress or refuse honestly // revert heading too: turning in place can swing the body over water without moving the centre // whole oriented footprint stays off the water (was centre-point only: wheels/body visibly overhung the pond edge)
  if (player.vkind && !onBoat && !flying && player._px !== undefined && onStageRect(player.x, player.z, .6) && !onStageRect(player._px, player._pz, .6)) { player.x = player._px; player.z = player._pz; } // vehicles may leave but never enter the stage platform, ramp or court
  const swimming = !player.vkind && worldData.inSwim && worldData.inSwim(player.x, player.z); // 118t: pool OR sea swim band
  if (swimming !== !!state._swim) { state._swim = swimming; if (swimming) pushToast(worldData.inSea && worldData.inSea(player.x, player.z) ? 'Swimming. Head back to the shore to get out.' : 'Swimming. Walk out any side.', 'swim', true); } // 118t: sea-specific exit hint
  player.group.position.set(player.x, worldData.groundY(player.x, player.z) - (swimming ? .45 : 0), player.z);
  player.group.rotation.y = player.dir;
  animateAvatar(player.group, dt, player.moving && !player.vkind, (keys['shift'] || state.runTouch) ? 1.4 : 1, swimming, player.vkind ? null : myEmote);
  splashStep(dt, player.x, player.z, swimming && player.moving);
  syncVehicle(player);
  updateParked(); updateGate();
  if (transitNode) { const t = state.transit, lvl = (!t || state.muted) ? 0 : (player.moving ? .04 + .08 * (t._spd == null ? 1 : t._spd) : .03); const ac2 = audio(); if (ac2) transitNode.g.gain.setTargetAtTime(lvl, ac2.currentTime, .15); } // 150i: engine/ambience swells with the crossing's own pacing, idles low, respects mute
  if (state.transit) { const bc = worldData.transit && worldData.transit.beacon; // 150: reaching the beacon completes the crossing; 150h: as a short landing beat, not an instant cut
    if (bc) { const bd = Math.hypot(player.x - bc.x, player.z - bc.z), t = state.transit;
      if (t.landT == null && bd < bc.r) { t.landT = t.tEl || 0; pushToast((t.kind === 'air' ? 'Landing in ' : 'Sailing into ') + t.label + '...', null, true); chime([330, 392, 523], .4); }
      if (t.landT != null && bd > bc.r * 2.5) { t.landT = null; } // veered away mid-beat: landing cancels, crossing continues
      if (t.landT != null && (t.tEl || 0) - t.landT > 1.5) { arriveTransit(); return; } } }

  // district detection
  const idx = state.transit ? -2 : districtAt(player.x, player.z); // Update 83: 2D partition lookup (east rectangles + coastal bands); 150: transit coords are not in any city district
  if (state.city !== 'kerala') {
    if (state.districtIdx !== -2 || state.transit) { state.districtIdx = -2; $('dt-en').textContent = state.transit ? ((state.transit.kind === 'air' ? 'Flight to ' : 'Crossing to ') + state.transit.label) : (state._protoPrague ? 'Prague (proto)' : ((CITY_DEFS[state.city] || {}).name || state.city)); $('dt-ml').textContent = state._protoPrague ? 'local preview · progress frozen' : ''; } // 150: crossing label replaces the city tag mid-transit
  } else if (idx >= 0 && idx < DISTRICTS.length && idx !== state.districtIdx) {
    state.districtIdx = idx;
    const d = DISTRICTS[idx];
    $('dt-en').textContent = d[1]; $('dt-ml').textContent = d[2];
    if (state.stage === 'play' && state.account) pushToast(d[2] + ' ജില്ലയിലേക്ക് സ്വാഗതം!', null, true);
  }
}

/* ---------- camera ---------- */
const _cr = new THREE.Raycaster(), _cd = new THREE.Vector3(), _cr2 = new THREE.Raycaster(), _cd2 = new THREE.Vector3();
const _vR = new THREE.Vector3(), _dR = new THREE.Vector3();
// 153: occlusion must be detected from BOTH directions. A FrontSide triangle only registers when a ray
// approaches its front, so a ray whose ORIGIN sits inside an occluder (vehicle under a canopy proxy, camera
// jammed inside a wall) exits through backfaces and misses entirely - the 149 origin-inside miss. The reverse
// ray approaches the same surfaces from outside and catches them. Returns the distance from `from` to the
// first surface crossing along the segment, or null.
function occSegment(from, dirUnit, far, oc) {
  _cr.set(from, dirUnit); _cr.far = far;
  const h = _cr.intersectObjects(oc, true)[0];
  if (h) return { d: h.distance, fwd: true };
  _cr2.set(_vR.copy(from).addScaledVector(dirUnit, far), _dR.copy(dirUnit).negate()); _cr2.far = far;
  const h2 = _cr2.intersectObjects(oc, true)[0];
  return h2 ? { d: far - h2.distance, fwd: false } : null;
}
// Update 149: driving camera occlusion - local x-ray for the driven vehicle.
// Measured (probe149occ): after mergeStatic, worldData.occluders are ghost meshes / empty group shells -
// sydney keeps its visible building geometry in ~9 merged material buckets, so fading "the blocking mesh"
// would either do nothing (ghost) or fade a whole city-wide bucket (global transparency). De-merging into
// per-cell buckets would raise draw calls against the 79a mobile perf hold. So while the view line to the
// driven vehicle is blocked, the LOCAL player's vehicle + rider render through the blocker instead:
// per-mesh material clones (shared materials untouched, remote players untouched, nothing global),
// restored on unblock / vehicle exit / mode or city change.
const occStash = new Map(); // mesh -> { orig, renderOrder }
function occXrayOn(root) {
  if (!root) return;
  root.traverse(o => {
    if (!o.isMesh || occStash.has(o)) return;
    occStash.set(o, { orig: o.material, renderOrder: o.renderOrder });
    const m = o.material.clone(); m.transparent = true; m.opacity = .85; m.depthTest = false; m.depthWrite = false;
    o.material = m; o.renderOrder = 997;
  });
}
function occRestore() {
  for (const [o, s] of occStash) { o.material.dispose(); o.material = s.orig; o.renderOrder = s.renderOrder; }
  occStash.clear();
}
//248 reusable scratch for optional shoulder checks, never shared with centered camera scratch.
const shoulderBase=new THREE.Vector3(),shoulderSide=new THREE.Vector3(),shoulderCandidate=new THREE.Vector3(),shoulderMid={x:0,z:0};
function updateCamera(dt) {
  if (!player || window.__lkFreeCam) return;
  //247 remove only the previous optional side offset before the unchanged centered camera update.
  if(cam._sideOffset){camera.position.sub(cam._sideOffset);cam._sideOffset.set(0,0,0);}
  { const tgt = player.moving ? Math.min(1, ((player.vkind && VEH[player.vkind] ? VEH[player.vkind].speed : (keys['shift'] || state.runTouch) ? 8.4 : 5.4)) / 21) : 0; // speed-feel signal: normalized to fastest vehicle so on-foot stays subtle
    cam._spd = (cam._spd || 0) + (tgt - (cam._spd || 0)) * Math.min(1, dt * 3); }
  const vk = player.vkind, big = vk && vk !== 'scooter' && vk !== 'bicycle', dd = cam.dist * (big ? 1.3 : 1) * (1 + .18 * (cam._spd || 0)); // pull back slightly with speed
  const swimNow = !vk && worldData.inSwim && worldData.inSwim(player.x, player.z); // 118t // avatar rides .45 lower while swimming; keep the eye with it
  cam.target.lerp(_v.set(player.x, worldData.groundY(player.x, player.z) + (player.vkind === 'flyster' ? 1.7 : big ? 2.4 : 1.55) + (player.alt || 0) - (swimNow ? .45 : 0), player.z), 1 - Math.exp(-dt * 6));
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  // first person applies on foot only; any vehicle temporarily renders third person and FP resumes on exit
  { // 201b: enclosed-space auto-FP (Prague nave): save the user's fp preference on entry, restore on exit; fires only on transitions, so a manual toggle while inside sticks until the next crossing
    const indoorNow = !vk && !!((worldData.indoors && worldData.indoors(player.x, player.z)) || (worldData.narrowView && worldData.narrowView(player.x, player.z)));
    if (indoorNow !== cam._indoorPrev) {
      if (indoorNow) { cam._fpSaved = cam.fp; cam._pitchSaved = cam.pitch; if (!cam.fp) { cam.fp = true; cam.pitch = worldData.narrowView && worldData.narrowView(player.x,player.z) ? .05 : clamp(cam.pitch - .3, -.85, .85); } } // 201c: settle near eye level on auto-entry, like the manual toggle
      else if (cam._fpSaved !== undefined) { cam.fp = cam._fpSaved; if (cam._pitchSaved !== undefined) cam.pitch = cam._pitchSaved; cam._fpSaved = undefined; cam._pitchSaved = undefined; } // 201c: restore the saved pitch too
      cam._indoorPrev = indoorNow;
      const vb = $('btn-view'); if (vb) { vb.classList.toggle('is-on', cam.fp); vb.setAttribute('aria-pressed', cam.fp ? 'true' : 'false'); } // 201c: keep the View button in sync with auto-FP (Main 11:14)
    }
  }
  const fpMode = cam.fp && !vk;
  if (!fpMode && cam._fpMode && cam.fp && vk && cam.pitch < .3) cam.pitch = .42; // vehicle forced us back to third person: restore a usable framing once
  cam._fpMode = fpMode;
  if (vk && cam.fp && !cam._vehNoted) { cam._vehNoted = true; pushToast('First person pauses while you ride - it resumes when you step off.', null, true); }
  if (!vk) cam._vehNoted = false;
  player.group.visible = !fpMode && !(player.vkind && VEH[player.vkind] && VEH[player.vkind].hide); // respect per-vehicle avatar visibility, same as remote players
  if (fpMode) {
    const fx = Math.sin(cam.yaw) * cp, fy = -sp, fz = Math.cos(cam.yaw) * cp; // same forward the orbit camera looks along
    camera.position.lerp(_v.set(cam.target.x + fx * .18, cam.target.y + .12, cam.target.z + fz * .18), 1 - Math.exp(-dt * 12));
    { // gentle head bob while moving on foot on the ground; envelope eases in/out, frozen airborne or swimming
      const grounded = !(player.alt > .05) && !swimNow;
      const bobT = grounded && player.moving ? (keys['shift'] || state.runTouch ? 1 : .62) : 0;
      cam._bobA = (cam._bobA || 0) + (bobT - (cam._bobA || 0)) * Math.min(1, dt * 4);
      cam._bob = (cam._bob || 0) + dt * 8.5 * cam._bobA;
      camera.position.y += Math.sin(cam._bob * 2) * .045 * cam._bobA;
    }
    camera.lookAt(cam.target.x + fx * 4, cam.target.y + .12 + fy * 4, cam.target.z + fz * 4);
  } else {
    const ox = -Math.sin(cam.yaw) * cp * dd, oz = -Math.cos(cam.yaw) * cp * dd;
    _v.set(cam.target.x + ox, cam.target.y + sp * dd, cam.target.z + oz);
    { // camera collision: pull the camera in along the view line so it never sits inside a building or prop
      const cols = worldData.colliders; if (cols) {
        const tx = cam.target.x, tz = cam.target.z; let f = 1, rf = 1;
        // Footprint sampling is ground-only; riding uses the actual 3D occluder ray below.
        // This avoids pulling an airborne camera toward a building footprint far below it.
        for (let s = 1; !vk && s <= 12; s++) {
          const t = s / 12, px = tx + (_v.x - tx) * t, pz = tz + (_v.z - tz) * t; let hit = false;
          for (const k of (worldData.colliderScan ? worldData.colliderScan(() => ({x:px,z:pz}), 2.3) : cols)) { if (k.wallEast) continue; if (Math.hypot(k.x - px, k.z - pz) < (k.r < 1.4 ? (k.r > .55 ? 2.3 : 1.5) : k.r * .85 + .4)) { hit = true; break; } }
          if (hit) { f = (s - 1) / 12; break; }
        }
        { const oc = worldData.occluders; if (oc && oc.length) { const seg = occSegment(cam.target, _cd.set(_v.x - tx, _v.y - cam.target.y, _v.z - tz).normalize(), dd, oc);
          if (seg && seg.fwd) rf = Math.max(1.1, seg.d - .6) / dd; // 153: pull-in only on a true forward crossing - with the target inside the occluder it would drag the camera inside too
          if (vk && seg && seg.d < dd - .3) { occXrayOn(player.veh); if (player.group.visible) occXrayOn(player.group); cam._occX = .35; } // 149+153: blocked while driving (either ray direction) -> x-ray the local vehicle + rider
        } }
        { const _minD = worldData.camMinDist ? worldData.camMinDist(tx, tz) : 3.4; // 201: per-city interior floor (Prague nave); absent -> 3.4 everywhere, other cities byte-identical
      const occT = (f < 1 || rf < 1) ? 1 - (f = Math.min(Math.max(Math.min(1, _minD / Math.max(dd, _minD)), f), rf)) : 0; cam._occ = (cam._occ || 0) + (occT - (cam._occ || 0)) * Math.min(1, dt * 6); if (occT > 0) _v.set(tx + (_v.x - tx) * f, cam.target.y + (_v.y - cam.target.y) * f + (vk ? 0 : (1 - f) * 1.4), tz + (_v.z - tz) * f); } // smooth the lookAt offset so passing a building edge doesn't snap the view
      } }
    { /* 189+191: terrain sight-line lift (Prague 187, Main 8:49 + 190 response): on a convex slope the
         orbit line can clip the ground and hide the avatar. 189 cleared the line to the TARGET (head
         height) only and under-lifted (a single-pass need applied at the camera end raises a sample at
         t by only t*lift); the shoulder still hid the whole body. 191: the FEET line must clear too
         (a vertical body column is visible when its lowest sight-line clears). Required lift for a
         straight line is exactly max(need/t) over samples; cap it at 3.5u and, if the cap leaves the
         line occluded, pull the camera in along the same direction (composing with the building
         pull-in above) until both lines clear, never closer than ~3.2u. yaw/dist inputs untouched;
         the per-frame recompute eases back out when the slope no longer demands it. Flat cities: both
         lines sit above groundY+.55/+.35 at every sample, never engages (verified on the postcard
         config - byte-identical still). */
      const gyT = worldData.groundY;
      if (gyT) {
        const feetY = gyT(player.x, player.z) + (player.alt || 0) + .2;
        const reqLift = () => {
          let lift = 0;
          for (let s2 = 1; s2 <= 8; s2++) {
            const t2 = s2 / 9, sx = cam.target.x + (_v.x - cam.target.x) * t2, sz = cam.target.z + (_v.z - cam.target.z) * t2;
            const g = gyT(sx, sz);
            const nH = (g + .55 - (cam.target.y + (_v.y - cam.target.y) * t2)) / t2;
            const nF = (g + .35 - (feetY + (_v.y - feetY) * t2)) / t2;
            if (nH > lift) lift = nH; if (nF > lift) lift = nF;
          }
          return lift;
        };
        let lift = reqLift();
        if (lift > 3.5) { // too much sky for a follow cam: pull in along the line instead
          const bx = _v.x - cam.target.x, by = _v.y - cam.target.y, bz = _v.z - cam.target.z;
          const minF = Math.min(.8, 3.2 / Math.max(3.2, Math.hypot(bx, by, bz)));
          let f = .85, done = false;
          for (; f >= minF - .001; f -= .15) {
            _v.set(cam.target.x + bx * f, cam.target.y + by * f, cam.target.z + bz * f);
            lift = reqLift(); if (lift <= 3.5) { done = true; break; }
          }
          if (!done) { _v.set(cam.target.x + bx * minF, cam.target.y + by * minF, cam.target.z + bz * minF); lift = reqLift(); }
        }
        if (lift > 0) _v.y += Math.min(lift, 3.5);
      } }
    cam._occX = Math.max(0, (cam._occX || 0) - dt); if (!cam._occX && occStash.size) occRestore(); // 149
    camera.position.lerp(_v, 1 - Math.exp(-dt * (camera.position.distanceTo(_v) > 6 ? 5 : 8)));
    { // transition clamp: the eased camera can still cut through an occluder mid-move (or leave the
      // vehicle hidden behind one during the transition). Keep the target->camera segment clear every
      // frame: if geometry sits between the look target and the lerped camera, pull the camera to just
      // in front of it. No new camera motion - the accepted pull-in path and easing are unchanged.
      const oc2 = worldData.occluders;
      if (oc2 && oc2.length) {
        _cd2.set(camera.position.x - cam.target.x, camera.position.y - cam.target.y, camera.position.z - cam.target.z);
        const cdist = _cd2.length();
        if (cdist > .5) {
          const seg2 = occSegment(cam.target, _cd2.normalize(), cdist, oc2); // 153: two-way - a lerped camera inside the occluder must clamp too (wall-jam first frame)
          // forward crossing: stay just in front of the surface (never pushed through it, even at close range)
          if (seg2 && seg2.fwd && seg2.d < cdist - .05) { const nf = Math.max(.45, seg2.d - .6);
            camera.position.set(cam.target.x + _cd2.x * nf, cam.target.y + _cd2.y * nf, cam.target.z + _cd2.z * nf); }
        }
      } }
    { // 189: the eased camera itself must stay above the terrain skin mid-move (teleports, city loads, fast drops)
      const gyC = worldData.groundY; if (gyC) { const gm = gyC(camera.position.x, camera.position.z) + .35; if (camera.position.y < gm) camera.position.y = gm; } }
    { const oc = cam._occ || 0, ahead = oc * 1.2; camera.lookAt(cam.target.x + Math.sin(cam.yaw) * ahead, cam.target.y + (state.city === 'kerala' ? 0 : 1.1) - oc * 1.0, cam.target.z + Math.cos(cam.yaw) * ahead); }
  }
  { const fovT = (state._protoPrague&&!fpMode&&innerWidth<640?72:55) * (1 + .1 * (cam._spd || 0)); // mild speed FOV stretch, smoothed
    if (Math.abs(camera.fov - fovT) > .02) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); } }
  { //247 local-preview narrow on-foot shoulder. Centered fallback is the original camera, not a new pull-in.
    const enabled=state._protoPrague&&!fpMode&&!vk&&innerWidth<640;
    cam._sideAmount=enabled?Math.min(1.3,(cam._sideAmount||0)+dt*3):0;
    if(!cam._sideOffset)cam._sideOffset=new THREE.Vector3();
    if(cam._sideAmount){
      const base=shoulderBase.copy(camera.position),side=shoulderSide.set(-Math.cos(cam.yaw)*cam._sideAmount,0,Math.sin(cam.yaw)*cam._sideAmount),candidate=shoulderCandidate.copy(base).add(side);
      const mid=shoulderMid;mid.x=(cam.target.x+candidate.x)/2;mid.z=(cam.target.z+candidate.z)/2;
      const radius=Math.hypot(candidate.x-cam.target.x,candidate.z-cam.target.z)/2+1.6;
      const scan=()=>worldData.colliderScan?worldData.colliderScan(()=>mid,radius):(worldData.colliders||[]);
      let clear=cameraLineClear(cam.target,candidate,scan())&&cameraLineClear(base,candidate,scan());
      for(let i=1;clear&&i<=16;i++){const t=i/16,x=cam.target.x+(candidate.x-cam.target.x)*t,z=cam.target.z+(candidate.z-cam.target.z)*t,y=cam.target.y+(candidate.y-cam.target.y)*t;if(worldData.groundY&&(y<worldData.groundY(x,z)+.35||base.y<worldData.groundY(base.x+side.x*t,base.z+side.z*t)+.35))clear=false;}
      if(clear){camera.position.copy(candidate);cam._sideOffset.copy(side);const oc=cam._occ||0,ahead=oc*1.2;camera.lookAt(cam.target.x+Math.sin(cam.yaw)*ahead+side.x*.5,cam.target.y+1.1-oc,cam.target.z+Math.cos(cam.yaw)*ahead+side.z*.5);}
      else cam._sideAmount=0;
    }
  }
  sun.position.set(cam.target.x - 60, 90, cam.target.z - 40);
  sun.target.position.copy(cam.target);
}
function toggleFP() {
  cam.fp = !cam.fp;
  if (cam.fp) cam.pitch = worldData.narrowView && worldData.narrowView(player.x,player.z) ? .05 : clamp(cam.pitch - .3, -.85, .85); // settle near eye level when entering first person
  else cam.pitch = cam.pitch < .3 ? .42 : clamp(cam.pitch, .12, 1.1); // hand the orbit camera a usable framing, not an FP pitch
  const b = $('btn-view'); if (b) { b.classList.toggle('is-on', cam.fp); b.setAttribute('aria-pressed', cam.fp ? 'true' : 'false'); }
}

/* ---------- remotes anim ---------- */
const splashes = []; let splashT = 0;
function splashStep(dt, x, z, on) {
  splashT -= dt;
  if (on && splashT <= 0 && splashes.length < 12) {
    splashT = .45;
    const m = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 20), new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, worldData.groundY() + .06, z); m.userData.age = 0; scene.add(m); splashes.push(m);
  }
  for (let i = splashes.length - 1; i >= 0; i--) {
    const m = splashes[i]; m.userData.age += dt; const k = m.userData.age / .9;
    m.scale.setScalar(1 + k * 3); m.material.opacity = Math.max(0, .8 * (1 - k));
    if (k >= 1) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); splashes.splice(i, 1); }
  }
}
function updateRemotes(dt) {
  for (const R of remotes.values()) {
    const g = R.group;
    const dx = R.tx - g.position.x, dz = R.tz - g.position.z;
    const dist = Math.hypot(dx, dz);
    const moving = dist > .05;
    const k = R.vkind ? 3 : 7;
    if (dist > (R.vkind ? 30 : 12)) { g.position.set(R.tx, worldData.groundY(R.tx, R.tz), R.tz); }
    else { g.position.x += dx * Math.min(1, dt * k); g.position.z += dz * Math.min(1, dt * k); }
    g.position.y = worldData.groundY(R.tx, R.tz) - (!R.vkind && worldData.inSwim && worldData.inSwim(R.tx, R.tz) ? .45 : 0); // 118t-2p rev: inPool -> inSwim - the 118t remote sink covered POOLS only; sea-band remotes rendered the crawl pose at UNSUNK standing height (Main 19:12 pixel verdict: B frame showed the torso/legs floating with a separated shadow)
    let d = R.dir - g.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    g.rotation.y += d * Math.min(1, dt * 8);
    { const sw = !R.vkind && worldData.inSwim && worldData.inSwim(R.tx, R.tz); animateAvatar(g, dt, moving && !R.vkind, R.run && !R.vkind ? 1.6 : 1, sw, R.vkind ? null : R.emote); } // 118t: remote swimmers in the sea band too
    syncVehicle(R);
  }
}

/* ---------- labels ---------- */
function updateLabels() {
  //251 label projection runs before renderer.render, which otherwise updates the camera matrix later.
  camera.updateMatrixWorld();
  if (player && player.nameTag) { const fpNow = cam.fp && !player.vkind; player.nameTag.el.style.display = fpNow ? 'none' : ''; if (!fpNow) { const swm = !player.vkind && worldData.inSwim && worldData.inSwim(player.x, player.z); placeLabel(player.nameTag, swm ? player.x + Math.sin(player.dir) * .8 : player.x, player.group.position.y + (swm ? 1.7 : 3.25), swm ? player.z + Math.cos(player.dir) * .8 : player.z); } } // 118t/u: anchor to actual avatar height; while swimming the crawl pose lies flat, so the tag moves to the HEAD (forward .8u, just above the surface) instead of floating at standing height over the body centre
  for (const R of remotes.values()) { const rsw = !R.vkind && worldData.inSwim && worldData.inSwim(R.tx, R.tz); placeLabel(R.tag, rsw ? R.group.position.x + Math.sin(R.dir) * .8 : R.group.position.x, R.group.position.y + (rsw ? 1.7 : 3.25), rsw ? R.group.position.z + Math.cos(R.dir) * .8 : R.group.position.z); } // 118t/u: same swim-head anchor for remote nametags
  // pickup labels: only the 3 nearest within 28 units, and never clipped at the screen edge (they used to pile up and overflow on phones)
  const near = [];
  for (const p of pickups) {
    if (!p.alive) { continue; }
    const dx = p.x - camera.position.x, dz = p.z - camera.position.z, d2 = dx * dx + dz * dz;
    const pdx = player ? p.x - player.x : 99, pdz = player ? p.z - player.z : 99;
    if (d2 > 784 || pdx * pdx + pdz * pdz < 30.25) p.label.el.style.display = 'none'; else near.push([d2, p]);
  }
  near.sort((a, b) => a[0] - b[0]);
  near.forEach(([, p], i) => { if (i < 3) placeLabel(p.label, p.x, p.model.position.y + 1.05, p.z, .82); else p.label.el.style.display = 'none'; });
}

/* ---------- stage: perform + watch ---------- */
const onStage = (x, z) => { const s = worldData.stage; return !!(s && Math.abs(x - s.x) < s.w / 2 && Math.abs(z - s.z) < s.d / 2); };
const stageSpots = new Map(); // remoteId -> spotlight cone
let mySpot = null;
function makeSpot() {
  const m = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = Math.PI; // wide end down
  return m;
}
function stageChipEl() {
  let el = document.getElementById('stage-chip');
  if (!el) {
    el = document.createElement('div'); el.id = 'stage-chip';
    el.style.cssText = 'position:fixed;left:50%;bottom:172px;transform:translateX(-50%);background:#1e2430ee;color:#fff;padding:8px 14px;border-radius:20px;font-size:14px;z-index:30;display:none;align-items:center;gap:10px;max-width:92vw;text-align:center';
    document.body.appendChild(el);
  }
  return el;
}
let stageT = 0;
function stageTick(dt) {
  const wb = worldData && worldData.stage && worldData.stage.beams;
  if (wb) { const t = performance.now() / 1000; for (let i = 0; i < wb.length; i++) { wb[i].rotation.x = .55 + Math.cos(t * .45 + i * 1.7) * .22; wb[i].rotation.z = Math.sin(t * .6 + i * 2.1) * .5; } }
  if (performance.now() - liveShowT > 15000) { liveShowT = performance.now(); pollLiveShow(); }
  stageT -= dt; if (stageT > 0) return; stageT = .3;
  const chip = stageChipEl();
  if (!worldData.stage || !player) { chip.style.display = 'none'; return; }
  { // group dancing: count nearby players doing the same move; they already share one beat clock
    let n = 0; if (myEmote && DANCES.includes(myEmote)) { n = 1; for (const R of remotes.values()) if (R.emote === myEmote && !R.vkind && Math.hypot(R.group.position.x - player.x, R.group.position.z - player.z) < 12) n++; }
    if (n !== state._crew) { if (n > 1) pushToast('In sync with ' + (n - 1) + ' other dancer' + (n > 2 ? 's' : '') + '.', 'dance', true); state._crew = n; }
  }
  if (myEmote && ((myEmote !== 'sit' && performance.now() - myEmoteAt > (myEmote === 'jump' ? 6000 : DANCES.includes(myEmote) ? 8000 : 4000)) || player.moving)) { myEmote = null; }
  if (myEmote !== state._emoBtn) { state._emoBtn = myEmote; document.querySelectorAll('[data-emote]').forEach(b => b.classList.toggle('lk-on', b.dataset.emote === myEmote)); const sb2 = $('btn-sit'); if (sb2) sb2.classList.toggle('is-on', myEmote === 'sit'); }
  const mePerforming = onStage(player.x, player.z) && DANCES.includes(myEmote);
  const performers = [];
  for (const [id, R] of remotes) {
    const perf = onStage(R.group.position.x, R.group.position.z) && DANCES.includes(R.emote);
    if (perf) performers.push(R);
    if (perf && !stageSpots.has(id)) { const m = makeSpot(); scene.add(m); stageSpots.set(id, m); }
    if (!perf && stageSpots.has(id)) { scene.remove(stageSpots.get(id)); stageSpots.get(id).geometry.dispose(); stageSpots.get(id).material.dispose(); stageSpots.delete(id); }
  }
  for (const [id, R] of remotes) { const m = stageSpots.get(id); if (m) m.position.set(R.group.position.x, R.group.position.y + 5.6, R.group.position.z); }
  if (mePerforming && !mySpot) { mySpot = makeSpot(); scene.add(mySpot); }
  if (!mePerforming && mySpot) { scene.remove(mySpot); mySpot.geometry.dispose(); mySpot.material.dispose(); mySpot = null; }
  if (mySpot) mySpot.position.set(player.x, player.group.position.y + 5.6, player.z);
  const s = worldData.stage;
  const nearStage = Math.hypot(player.x - s.x, player.z - s.z) < 34;
  if (mePerforming) {
    let watching = 0;
    for (const R of remotes.values()) if (!onStage(R.group.position.x, R.group.position.z) && Math.hypot(R.group.position.x - s.x, R.group.position.z - s.z) < 30) watching++;
    chip.innerHTML = ''; chip.appendChild(document.createTextNode('You are performing · ' + watching + ' nearby'));
    chip.style.display = 'flex';
  } else if (performers.length && nearStage) {
    chip.innerHTML = ''; chip.appendChild(document.createTextNode(performers.map(R => R.base).join(', ') + ' is performing'));
    const b = document.createElement('button'); b.textContent = 'Clap';
    b.style.cssText = 'margin-left:10px;padding:4px 12px;border:0;border-radius:14px;background:#ffd24a;color:#3a2c00;font-weight:600;cursor:pointer';
    b.onclick = () => sendEmote('clap');
    chip.appendChild(b); chip.style.display = 'flex';
  } else if (nearStage && onStage(player.x, player.z)) {
    chip.innerHTML = ''; chip.appendChild(document.createTextNode((liveShow ? liveShow.title + ' is on - ' : '') + 'You are on stage - use Dance or Party to perform'));
    chip.style.display = 'flex';
  } else if (nearStage && liveShow) {
    chip.innerHTML = ''; chip.appendChild(document.createTextNode(liveShow.title + ' is on - hosted by ' + liveShow.host.name));
    chip.style.display = 'flex';
  } else chip.style.display = 'none';
}
let liveShow = null, liveShowT = 0;
async function pollLiveShow() {
  if (state.stage !== 'play') { liveShow = null; return; }
  try { const d = await api('/events?city=' + encodeURIComponent(state.city || 'kerala')); liveShow = d.stage ? (d.events.find(e => e.status === 'live') || null) : null; } catch { liveShow = null; }
}

/* ---------- main loop ---------- */
let lastT = 0;
const discovery=createDiscovery({getPlayer:()=>player,getWorld:()=>worldData,getCity:()=>state._protoPrague?'prague':state.city,onMap:()=>setPanel('localmap'),onReveal:(seen,finished,trail)=>{
 const body=$('discovery-stories');body.replaceChildren();for(const [i,item] of trail.entries()){const card=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=(item.found?'Found · ':item.current?'Next · ':'Locked · ')+item.title;p.textContent=item.found?seen[i].story:item.current?item.clue:'Find the earlier fragment to reveal this story.';card.className='discovery-journal-card';card.append(h,p);if(item.found){const note=document.createElement('p');note.className='discovery-observation';note.textContent='You noticed: '+seen[i].observation;card.append(note);}body.append(card);}if(finished){const ending=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');ending.className='discovery-journal-card discovery-ending';h.textContent="The keeper's last note";p.textContent='A pointed roof. Water on both sides. Two unequal towers. In this fictional tale, those small details are the key: the keeper was never guarding treasure, but the habit of paying attention. The brass token is yours to imagine.';ending.append(h,p);body.append(ending);}
 $('discovery-summary').textContent=finished?'Complete: all three fragments found. Session only; no points or stamps.':seen.length+' / 3 fragments found. Your next stop is below. Page refresh clears this trail.';$('discovery-continue').textContent=finished?'Back to the world':'Continue trail';setPanel('discovery');
}});
const localMap = createLocalMap({ getDiscovery:()=>state._protoPrague?discovery.mapStops:[],  getLandmarkName: () => state._protoPrague ? null : LANDMARK_NAMES[state.city], getWorld: () => worldData, getPlayer: () => player, getCityName: () => state._protoPrague ? 'Prague (proto)' : state.city === 'kerala' ? 'Kerala' : (CITY_DEFS[state.city] || {}).name || 'City', onChoose: () => setPanel('none') });
let localMapLast = 0;
/* 151b: perf qualification overlay - open any city with ?perf=1 and it shows live fps + renderer load,
   so an actual-phone visit produces numbers for the 79a/runtime qualification hold (no test campaign needed). */
let perfEl = null, perfAcc = 0, perfN = 0, perfLast = 0;
if (typeof location !== 'undefined' && /[?&]perf=1/.test(location.search)) {
  perfEl = document.createElement('div');
  perfEl.style.cssText = 'position:absolute;top:44px;left:8px;z-index:40;background:rgba(11,51,44,.9);color:#f4eed6;font:12px/1.5 monospace;padding:6px 10px;border-radius:8px;pointer-events:none;white-space:pre';
  document.body.appendChild(perfEl);
}
function perfTick(t) {
  if (!perfEl) return;
  perfAcc += t - (perfLast || t); perfLast = t; perfN++;
  if (perfAcc >= 500) { const fps = Math.round(perfN / perfAcc * 1000), ri = renderer.info.render;
    perfEl.textContent = fps + ' fps · ' + ri.calls + ' draws · ' + (ri.triangles / 1000).toFixed(0) + 'k tris · ' + (state.transit ? 'transit' : state.city || '-');
    perfAcc = 0; perfN = 0; }
}
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (t - lastT) / 1000 || .016); lastT = t;
  perfTick(t);
  updatePlayer(dt);
  updateCamera(dt);
  updateRemotes(dt);
  updateBalls(dt); // 118v
  updateWaves(dt); // 118x
  if (t - localMapLast > 250) { localMap.tick(state.city, cam.yaw);discovery.tick();if(state.panel==='explore')drawExploreMap($('explore-map-preview'),worldData,player); localMapLast = t; }
  { const lh = $('landmark-hint'), nm = (state.transit || state._protoPrague) ? null : LANDMARK_NAMES[state.city]; if (lh) { if (state._protoPrague && player && state.stage === 'play') { lh.hidden = false; const t = 'Prague (proto) · local dev preview · schematic geography · no stamps or points in preview'; if (lh.textContent !== t) lh.textContent = t; } else if (state.transit && player) { /* Update 168a: proto branch first - nm null above keeps the stamp/arrival branch unreachable in preview */ lh.hidden = false; const bc = worldData.transit && worldData.transit.beacon; const d = bc ? Math.max(0, Math.round(Math.hypot(player.x - bc.x, player.z - bc.z) - bc.r)) : 0; const t = (state.transit.kind === 'air' ? 'Flight to ' : 'Crossing to ') + state.transit.label + ' · ' + d + ' m to the beacon' + ' · schematic crossing, just you out here'; if (lh.textContent !== t) lh.textContent = t; } else if (nm && player && state.stage === 'play') { lh.hidden = false; const dist = Math.round(Math.hypot(player.x, player.z + 26)); const t = 'Landmark (low-poly): ' + nm + ' · ' + dist + ' m' + ((state._passport && state._passport[state.city]) ? ' · ★ stamped in your passport' : ' · ☆ walk up to stamp it') + ((state._travFound && state._travFound[state.city]) ? ' · ☺ little traveler met' : ' · ☺ find the little traveler'); if (lh.textContent !== t) lh.textContent = t;
      // landmark arrival moment: first entry into the landmark disc per city visit - client-side only, session state only
      if (state._lmCity !== state.city) { state._lmCity = state.city; state._lmR = 0; state._lmArrived = false; hideArrival(); }
      if (!state._lmR) { let r = 0; for (const c of (worldData.colliders || [])) if (c.x === 0 && c.z === -26 && !c.off && c.r > r) r = c.r; state._lmR = r || 8; }
      if (!state._lmArrived && dist <= state._lmR + 1.5) { state._lmArrived = true; showArrival(nm); fireSparkles(player.x, 1.1, player.z); } // disc edge + small margin: fires at the walkable boundary for solid landmarks, at the structure base for walk-through towers
    } else lh.hidden = true; } }
  const time = t / 1000;
  if (state._trav && player && state.stage === 'play') { const tv = state._trav;
    tv.group.position.y = tv.y + Math.sin(time * 2) * .06; // idle bob
    if (!(state._travFound && state._travFound[state.city]) && Math.hypot(player.x - tv.x, player.z - tv.z) < 2.5) { (state._travFound = state._travFound || {})[state.city] = 1; pushToast('You found the little traveler! ☺', 'trav', true); fireSparkles(tv.x, 1, tv.z); if (Object.keys(state._travFound).length >= Object.keys(LANDMARK_NAMES).length && !state._travDone) { state._travDone = true; setTimeout(() => pushToast('You met every little traveler in the world! ☺', 'travall', true), 3600); } } } // session-only find; no points, no persistence
  for (const p of pickups) {
    if (!p.alive) { // collect pop-out: quick overshoot then shrink away while rising; ends hidden with scale reset
      if (p.popT !== undefined) { p.popT += dt; const k = p.popT / .3;
        if (k >= 1) { p.model.visible = false; p.model.scale.set(1, 1, 1); p.popT = undefined; }
        else { const u = k < .4 ? 1 + .45 * (k / .4) : 1.45 * Math.max(0, 1 - (k - .4) / .6);
          p.model.scale.set(u, u, u); p.model.position.y = worldData.groundY() + 1.25 + k * 1.1; } }
      continue; }
    if (p.growT !== undefined) { p.growT += dt; const k = Math.min(1, p.growT / .35); // respawn grow-in: fast ease-out, tiny settle overshoot
      const u = .25 + .75 * (1 - (1 - k) * (1 - k)) + .12 * Math.sin(k * Math.PI);
      if (k >= 1) { p.model.scale.set(1, 1, 1); p.growT = undefined; } else p.model.scale.set(u, u, u); }
    p.model.rotation.y += dt * 1.4;
    p.model.position.y = worldData.groundY() + 1.25 + Math.sin(time * 2 + p.t) * .22;
    if (!state._pickupsReady || state._pingAckGen !== state._cityGen || Date.now() < (state._collectHoldUntil || 0)) continue;
    const dx = p.x - (player ? player.x : 1e9), dz = p.z - (player ? player.z : 1e9);
    if (dx * dx + dz * dz < 4.6) onCollect(p);
  }
  for (const c of worldData.clouds) { c.position.x += dt * .7; if (c.position.x > 220) c.position.x = -220; }
  for (const b of worldData.butterflies) {
    b.userData.t += dt;
    b.userData.w1.rotation.y = Math.sin(b.userData.t * 14) * .8;
    b.userData.w2.rotation.y = -Math.sin(b.userData.t * 14) * .8;
    b.position.x += Math.sin(b.userData.t * .7) * dt * 1.2;
    b.position.z += Math.cos(b.userData.t * .5) * dt * 1.2;
    b.position.y = 2.2 + Math.sin(b.userData.t * 1.7) * .5;
  }
  if (rainPts && rainPts.visible) {
    const arr = rainPts.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= dt * 26;
      if (arr[i + 1] < 0) { arr[i] = camera.position.x + rand(-40, 40); arr[i + 1] = 38; arr[i + 2] = camera.position.z + rand(-40, 40); }
    }
    rainPts.geometry.attributes.position.needsUpdate = true;
  }
  sparksTick(dt);
  updateLabels();
  stageTick(dt);
  renderer.render(scene, camera);
}

/* ---------- landmark arrival moment (client-side only; no points, no persistence, no sharing) ---------- */
let arrivalTimer = 0;
function showArrival(nm) {
  const el = $('landmark-arrival'); if (!el) return;
  (state._passport = state._passport || {})[state.city] = nm; // session-only landmark stamps; never persisted, no points
  if (Object.keys(state._passport).length >= Object.keys(LANDMARK_NAMES).length && !state._passportDone) { state._passportDone = true; for (let i = 1; i <= 3; i++) setTimeout(() => { if (player) fireSparkles(player.x, 1.1 + i * .5, player.z); }, i * 450); } // full passport: one extra sparkle salute, session flag only
  $('la-name').textContent = nm;
  const fact = LANDMARK_FACTS[state.city];
  $('la-sub').textContent = (CITY_DEFS[state.city] ? CITY_DEFS[state.city].name : '') + (fact ? ' · ' + fact : '');
  const panelOpen = state.panel && state.panel !== 'none';
  el.hidden = !!panelOpen; // stamp lands either way; the banner yields to any open side panel
  if (!panelOpen) { clearTimeout(arrivalTimer); arrivalTimer = setTimeout(hideArrival, 5500); }
}
function hideArrival() { const el = $('landmark-arrival'); if (el) el.hidden = true; clearTimeout(arrivalTimer); }
/* ---------- little traveler hide-and-seek (client-side, session-only; no points, no persistence, no sharing) ---------- */
function spawnTraveler(id) {
  let a = 0; for (const ch of id) a = (a * 31 + ch.charCodeAt(0)) % 628; a /= 100; // deterministic per-city angle
  let dr = 0; for (const c of (worldData.colliders || [])) if (c.x === 0 && c.z === -26 && !c.off && c.r > dr) dr = c.r; dr = (dr || 8) + 5.5;
  let x = 0, z = 0, ok = false;
  for (let i = 0; i < 12 && !ok; i++) { x = Math.sin(a) * dr; z = -26 + Math.cos(a) * dr; ok = true;
    for (const c of (worldData.colliders || [])) { if (c.off || typeof c.x !== 'number' || typeof c.r !== 'number') continue; if (Math.hypot(x - c.x, z - c.z) < c.r + .8) { ok = false; break; } }
    if (!ok) a += .55; }
  const g = new THREE.Group(), mm = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
  const add = (m, px, py, pz) => { m.position.set(px, py, pz); m.castShadow = true; g.add(m); };
  add(new THREE.Mesh(new THREE.CylinderGeometry(.28, .34, .7, 8), mm('#7a4ae8')), 0, .55, 0); // body
  add(new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 8), mm('#f2c98a')), 0, 1.1, 0); // head
  add(new THREE.Mesh(new THREE.ConeGeometry(.3, .42, 8), mm('#e83a6a')), 0, 1.42, 0); // hat
  add(new THREE.Mesh(new THREE.BoxGeometry(.3, .34, .16), mm('#3a6ae8')), 0, .62, -.3); // little backpack
  const gy = worldData.groundY ? worldData.groundY(x, z) : 0;
  g.position.set(x, gy, z); worldData.group.add(g);
  state._trav = { x, z, y: gy, group: g };
}
let sparks = null;
function fireSparkles(x, y, z) {
  if (!sparks) {
    const n = 70, pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sparks = { pts: new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffd873', size: .2, transparent: true, opacity: .95 })), vel: new Float32Array(n * 3), t: 0 };
    sparks.pts.visible = false; scene.add(sparks.pts);
  }
  const a = sparks.pts.geometry.attributes.position.array, v = sparks.vel;
  for (let i = 0; i < a.length; i += 3) {
    a[i] = x; a[i + 1] = y; a[i + 2] = z;
    const an = Math.random() * 6.283, sp = 1.5 + Math.random() * 3;
    v[i] = Math.cos(an) * sp; v[i + 1] = 2.5 + Math.random() * 3.5; v[i + 2] = Math.sin(an) * sp;
  }
  sparks.t = 1.4; sparks.pts.material.opacity = .95; sparks.pts.visible = true;
  sparks.pts.geometry.attributes.position.needsUpdate = true;
}
function sparksTick(dt) {
  if (!sparks || !sparks.pts.visible) return;
  sparks.t -= dt;
  const a = sparks.pts.geometry.attributes.position.array, v = sparks.vel;
  for (let i = 0; i < a.length; i += 3) { v[i + 1] -= dt * 6; a[i] += v[i] * dt; a[i + 1] += v[i + 1] * dt; a[i + 2] += v[i + 2] * dt; if (a[i + 1] < .1) a[i + 1] = .1; }
  sparks.pts.material.opacity = Math.max(0, sparks.t / 1.4) * .95;
  sparks.pts.geometry.attributes.position.needsUpdate = true;
  if (sparks.t <= 0) sparks.pts.visible = false;
}

/* ---------- monsoon ---------- */
function setMonsoon(on) {
  state.monsoon = on;
  rainPts.visible = on;
  const atmosphere=worldData.group&&worldData.group.getObjectByName('prague-atmosphere');if(atmosphere)atmosphere.visible=!on;
  scene.background.set(on ? '#5e7d8c' : (worldData.sky || '#8fd3ee'));
  scene.fog.color.set(on ? '#6e8b99' : (worldData.fog || '#a8dcee'));
  scene.fog.near = on ? 40 : 90; scene.fog.far = on ? 200 : 340;
  sun.intensity = on ? .8 : (worldData.sun ? worldData.sun[1] : 1.9); hemi.intensity = on ? .55 : .95;
  $('btn-monsoon').classList.toggle('is-on', on);
  rainSound(on);
  if (on) pushToast('മഴ വന്നു! Monsoon rain', null, true);
}

/* ---------- leaderboard ---------- */
let boardTab = 'cities';
async function renderBoard() {
  let data = null;
  try { data = await api('/leaderboards'); $('presence-num').textContent = state.city ? ($('presence-num').textContent || 1) : 1; } catch { data = null; }
  document.querySelectorAll('[data-board]').forEach(b => b.classList.toggle('is-on', b.dataset.board === boardTab));
  let rows = [];
  if (boardTab === 'districts') {
    const ds = data ? data.districts : DISTRICTS.map(([id, en, ml]) => ({ id, name: en, malayalam: ml, points: 0 }));
    const myId = state.account && DISTRICTS[state.account.district] ? DISTRICTS[state.account.district][0] : null;
    rows = ds.map(d => ({ name: d.name, sub: d.malayalam, points: d.points, you: d.id === myId && d.points > 0 }));
  } else if (boardTab === 'countries') {
    const by = {};
    for (const c of (data ? data.cities : [])) { by[c.country] = by[c.country] || { name: c.country, sub: '', points: 0, online: 0 }; by[c.country].points += c.points; by[c.country].online += c.online; }
    rows = Object.values(by).sort((a, b) => b.points - a.points).map(c => ({ name: c.name, sub: c.online + ' online', points: c.points }));
  } else {
    rows = (data ? data.cities : []).map(c => ({ name: c.name, sub: c.country + ' · ' + c.online + ' online', points: c.points, you: c.id === state.city }));
  }
  $('board-list').innerHTML = rows.length ? rows.map((d, i) =>
    '<li class="lk-board-row' + (d.you ? ' is-you' : '') + '"><span class="lk-rank">' + (i + 1) + '</span>' +
    '<span class="lk-board-name"><strong>' + esc(d.name) + '</strong><span class="lk-ml">' + esc(d.sub || '') + '</span></span>' +
    '<span class="lk-score">' + d.points + '</span></li>').join('') : '<li class="lk-sub">Board unavailable right now.</li>';
}

/* ---------- look panel ---------- */
let lookDraft = null;
function chipRow(el, items, selected, onPick, render) {
  el.innerHTML = '';
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lk-chip' + (i === selected ? ' is-on' : '');
    if (render) render(b, it, i); else b.textContent = typeof it === 'string' ? it : it.name;
    b.onclick = () => { onPick(i); renderLook(); applyLookDraft(); };
    el.appendChild(b);
  });
}
function renderLook() {
  if (!lookDraft) lookDraft = Object.assign({ preset: 0, skin: 3, hair: 0, hairColor: 0 }, state.account ? state.account.look : null);
  chipRow($('look-outfits'), OUTFITS, lookDraft.outfit | 0, i => { lookDraft.outfit = i; lookDraft.outfitVar = 0; });
  chipRow($('look-outfitvars'), (OUTFITS[lookDraft.outfit | 0].pal || []).length > 1 ? ['Style A', 'Style B', 'Style C'] : [], lookDraft.outfitVar | 0, i => lookDraft.outfitVar = i);
  chipRow($('look-presets'), PRESETS, lookDraft.preset, i => lookDraft.preset = i);
  chipRow($('look-skins'), SKIN_TONES, lookDraft.skin, i => lookDraft.skin = i, (b, c) => { b.style.background = c; b.classList.add('lk-chip-swatch'); });
  chipRow($('look-hairs'), HAIR_STYLES, lookDraft.hair, i => lookDraft.hair = i);
  chipRow($('look-haircolors'), HAIR_COLORS, lookDraft.hairColor, i => lookDraft.hairColor = i, (b, c) => { b.style.background = c; b.classList.add('lk-chip-swatch'); });
  lookPreviewStart();
}
/* turntable preview inside the Look panel: the panel covers the whole screen on phones, so the player could not see the outfit before saving */
let lookPrev = null;
function lookPreviewStart() {
  const host = $('look-preview'); if (!host) return;
  if (!lookPrev) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(190, 200);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#ffffff', '#6a7a88', 1.15)); const dl = new THREE.DirectionalLight('#ffffff', 1.5); dl.position.set(3, 6, 5); sc.add(dl);
    const cm = new THREE.PerspectiveCamera(30, 190 / 200, .1, 50); cm.position.set(0, 1.25, 6.2); cm.lookAt(0, 1.05, 0);
    lookPrev = { r, sc, cm, g: null, key: '' }; host.appendChild(r.domElement);
  }
  const tick = () => {
    if ($('panel-look').hidden || !lookPrev) { lookPrev && (lookPrev.running = false); return; }
    const key = JSON.stringify(lookDraft);
    if (key !== lookPrev.key) { if (lookPrev.g) { lookPrev.sc.remove(lookPrev.g); disposeModel(lookPrev.g); } lookPrev.g = buildAvatar(lookDraft); lookPrev.sc.add(lookPrev.g); lookPrev.key = key; }
    lookPrev.g.rotation.y += .012; lookPrev.r.render(lookPrev.sc, lookPrev.cm); requestAnimationFrame(tick);
  };
  if (!lookPrev.running) { lookPrev.running = true; requestAnimationFrame(tick); }
}
function applyLookDraft() {
  if (!player) return;
  const pos = { x: player.x, z: player.z, dir: player.dir };
  scene.remove(player.group);
  player.group = buildAvatar(lookDraft); setRidePose(player.group, !!(player.vkind && VEH[player.vkind] && !VEH[player.vkind].hide));
  player.group.position.set(pos.x, worldData.groundY(pos.x, pos.z), pos.z);
  player.group.rotation.y = pos.dir;
  scene.add(player.group);
}
async function saveLook() {
  if (!lookDraft) return;
  if (state.account) {
    state.account.look = lookDraft; saveAccount();
    try { await api('/players/' + state.account.playerId + '/look', { method: 'PATCH', body: JSON.stringify(lookDraft) }); } catch {}
  }
  setPanel('none');
  pushToast('Look saved');
}

/* ---------- join ---------- */
async function join(name, districtIdx) {
  const d = DISTRICTS[districtIdx] || null;
  const look = { preset: 0, skin: 3, hair: 0, hairColor: 0 };
  try {
    const r = await api('/join', { method: 'POST', body: JSON.stringify({ name, district: d ? d[0] : 'none', adult: true, look }) });
    state.account = { playerId: r.player.id, token: r.token, name: r.player.name, district: districtIdx, look: r.player.look };
    saveAccount();
    setPoints(r.player.points);
  } catch {
    state.account = { playerId: null, token: null, name, district: districtIdx, look };
    saveAccount();
    setPoints(state.points + 15);
    state.apiDown = true;
  }
  state.districtIdx = -1;
  const { zc } = districtZone(districtIdx >= 0 ? districtIdx : 3);
  spawnPlayer(-20, zc + 8);
  seedPickups(-20, zc + 8, 10, 26); syncPickups();
  setStage('play');
  startPresence();
  pushToast('Welcome! +15 points', null, true);
  state.panel = 'none'; setPanel('travel');
  chime([392, 523, 659], .4);
}


document.addEventListener('click', e => { if (e.target && e.target.id === 'btn-enter') useParkedButton(); });
for (const [id, k] of [['btn-fup', 'flyUp'], ['btn-fdown', 'flyDown']]) { const e = document.getElementById(id); if (!e) continue; e.addEventListener('pointerdown', ev => { ev.preventDefault(); state[k] = true; }); for (const t of ['pointerup', 'pointerleave', 'pointercancel']) e.addEventListener(t, () => { state[k] = false; }); }
/* ---------- parked vehicles: walk up and get in (per city, not Kerala) ---------- */
const PARK_KINDS = ['taxi', 'roadster', 'supercar', 'suv', 'pickup', 'van', 'bike', 'car', 'flyster'];
const PARK_COLORS = { flyster: '#22d3c5', roadster: '#c8372d', supercar: '#2f7fd1', suv: '#2c3e50', pickup: '#2fa86a', van: '#e8e4d8', bike: '#8a4fc7', car: '#d94b3d' };
const parked = [];
function clearParked() {
  for (const p of parked) { scene.remove(p.mesh); disposeModel(p.mesh); }
  parked.length = 0; if (typeof parkMarker !== 'undefined' && parkMarker) parkMarker.visible = false; const b = $('btn-enter'); if (b) b.style.display = 'none';
}
function poolRectHit(x, z, m) { const p = worldData.pool; return !!(p && Math.abs(x - p.x) < p.hw + m && Math.abs(z - p.z) < p.hd + m); } // vehicle body margin off the water, not just the centre point
const VEH_FOOT = { car: [.99, 1.6], scooter: [.45, 1.08], roadster: [1.12, 2.15], supercar: [1.25, 2.32], suv: [1.14, 2.09], pickup: [1.14, 2.23], van: [1.14, 2.17], taxi: [1.04, 1.93], bike: [.45, 1.21], bicycle: [.35, 1.15], flyster: [1.26, 2.37] }; // measured mesh xz half-extents (side, forward)
function taxiBodyOffRoad(x, z, dir) { // any oriented corner off the asphalt union = violation (centre-band routing alone lets the body cut fields at turns)
  if (!worldData.roadAsphalt) return false;
  const ft = VEH_FOOT.taxi, hx = ft[0], hz = ft[1], s = Math.sin(dir), c = Math.cos(dir);
  for (const a of [-1, 1]) for (const b of [-1, 1]) if (!worldData.roadAsphalt(x + a * hx * c + b * hz * s, z - a * hx * s + b * hz * c, 0)) return true;
  return false; }
function poolBodyHit(x, z, dir, kind) { // oriented actual footprint vs pool water rect: SAT on 4 axes, so no heading can overhang
  const p = worldData.pool; if (!p) return false;
  const ft = VEH_FOOT[kind] || [1.1, 2], hx = ft[0], hz = ft[1], s = Math.sin(dir), c = Math.cos(dir);
  const corners = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) corners.push([x + a * hx * c + b * hz * s, z - a * hx * s + b * hz * c]);
  const axes = [[1, 0], [0, 1], [s, c], [c, -s]];
  for (const ax of axes) { let mnA = 1e9, mxA = -1e9, mnB = 1e9, mxB = -1e9;
    for (const q of corners) { const d = q[0] * ax[0] + q[1] * ax[1]; if (d < mnA) mnA = d; if (d > mxA) mxA = d; }
    for (const q of [[p.x - p.hw, p.z - p.hd], [p.x + p.hw, p.z - p.hd], [p.x + p.hw, p.z + p.hd], [p.x - p.hw, p.z + p.hd]]) { const d = q[0] * ax[0] + q[1] * ax[1]; if (d < mnB) mnB = d; if (d > mxB) mxB = d; }
    if (mxA < mnB || mxB < mnA) return false; }
  return true;
}
function onStageRect(x, z, m) { const s = worldData.stage; return !!(s && Math.abs(x - s.x) < s.w / 2 + m && z - s.z > -s.d / 2 - m && z - s.z < s.d / 2 + 12 + m); }
function parkSpotClear(x, z, kind, dir) { // whole ORIENTED body of this kind must clear road asphalt and pool water - center-only checks let bodies overhang
  if (worldData.noPark && worldData.noPark(x, z)) return false; // e.g. the roundabout island: drivable-around ground, not a parking bay
  if (worldData.roadAsphalt && kind && VEH_FOOT[kind]) { const ft = VEH_FOOT[kind], s = Math.sin(dir || 0), c = Math.cos(dir || 0);
    for (const a of [-1, 1]) for (const b of [-1, 1]) if (worldData.roadAsphalt(x + a * ft[0] * c + b * ft[1] * s, z - a * ft[0] * s + b * ft[1] * c, .3)) return false; }
  else if (worldData.roadAsphalt && worldData.roadAsphalt(x, z, 2.3)) return false;
  if (worldData.pool && kind && poolBodyHit(x, z, dir || 0, kind)) return false;
  else if (worldData.inPool && worldData.inPool(x, z)) return false;
  if (worldData.inRiver) { const ft = (kind && VEH_FOOT[kind]) || [1.1, 2], s = Math.sin(dir || 0), c = Math.cos(dir || 0); // whole oriented footprint stays out of the river band (Update 111: parked vehicles stood in the moved london/paris channels, main 10:15)
    if (worldData.inRiver(x, z, .5)) return false;
    for (const a of [-1, 1]) for (const b of [-1, 1]) if (worldData.inRiver(x + a * ft[0] * c + b * ft[1] * s, z - a * ft[0] * s + b * ft[1] * c, .5)) return false; }
  const [cx, cz] = worldData.clamp(x, z); if (Math.abs(cx - x) > .01 || Math.abs(cz - z) > .01) return false;
  if (onStageRect(x, z, 4)) return false;
  for (const c of worldData.colliders) { if (c.wallEast) continue; if (c.hw !== undefined) { if (worldData.parkRectGuard && Math.abs(x - c.x) < c.hw + 3.4 && Math.abs(z - c.z) < c.hd + 3.4) return false; continue; } if (Math.hypot(x - c.x, z - c.z) < c.r + 3.4) return false; }
  if (worldData.harbour && worldData.boat && worldData.boat.nearShore && worldData.boat.nearShore(x, z)) return false;
  return true;
}
function parkSpotClearLand(x, z) { // for landing: ground, not pool, inside the playable area, not inside a collider
  if (onStageRect(x, z, 1.5)) return false;
  if (worldData.inPool && worldData.inPool(x, z)) return false;
  const [cx, cz] = worldData.clamp(x, z); if (Math.abs(cx - x) > .01 || Math.abs(cz - z) > .01) return false;
  for (const c of worldData.colliders) { if (c.wallEast || c.off) continue; if (c.hw !== undefined) { if (worldData.parkRectGuard && Math.abs(x - c.x) < c.hw + 1.6 && Math.abs(z - c.z) < c.hd + 1.6) return false; continue; } if (Math.hypot(x - c.x, z - c.z) < c.r + 1.6) return false; }
  return true;
}
function buildParked() {
  clearParked();
  const sx = worldData.spawn.x, sz = worldData.spawn.z, pts = [];
  for (const r of [13, 18, 23, 28, 34, 40]) for (let k = 0; k < 12; k++) { const an = k * .5236 + r * .37; pts.push([sx + Math.sin(an) * r, sz + Math.cos(an) * r]); }
  for (const kind of PARK_KINDS) {
    let spotDir = 0;
    const spot = pts.find(([x, z]) => { const d0 = Math.atan2(sx - x, sz - z) + (parked.length % 2 ? .5 : -.5); const ok = parkSpotClear(x, z, kind, d0) && parked.every(p => Math.hypot(p.bx - x, p.bz - z) > 7); if (ok) spotDir = d0; return ok; });
    if (!spot) continue;
    const i = parked.length, id = state.city + ':' + i, dir = spotDir;
    const mesh = buildVehicle(kind, kind === 'taxi' ? VEH.taxi.color : PARK_COLORS[kind]);
    mesh.position.set(spot[0], worldData.groundY(), spot[1]); mesh.rotation.y = dir; scene.add(mesh);
    const col = { x: spot[0], z: spot[1], r: kind === 'bike' ? .9 : 1.9, off: false };
    worldData.colliders.push(col);
    parked.push({ id, kind, bx: spot[0], bz: spot[1], dir, mesh, col });
  }
}
function parkedBusy(p) { if (state.selfPv === p.id && player.pk !== p) return true; for (const R of remotes.values()) if (R.pv === p.id) return true; return false; }
function nearestParked() {
  let best = null, bd = 4.6;
  for (const p of parked) { if (player.pk === p || parkedBusy(p)) continue; const d = Math.hypot(p.bx - player.x, p.bz - player.z); if (d < bd) { bd = d; best = p; } }
  return best;
}
let parkMarker = null;
function markParked(p) {
  if (!parkMarker) { parkMarker = new THREE.Mesh(new THREE.ConeGeometry(.35, .7, 4), new THREE.MeshBasicMaterial({ color: '#ffd24a' })); parkMarker.rotation.x = Math.PI; scene.add(parkMarker); }
  parkMarker.visible = !!p; if (p) parkMarker.position.set(p.bx, worldData.groundY() + 3.1 + Math.sin(performance.now() / 250) * .15, p.bz);
}
function enterParked() {
  if (!player || state.taxi || player.pk) return;
  if (player.vkind) setVehicle(player, null, 0);
  if (worldData.inPool && worldData.inPool(player.x, player.z)) { pushToast('Climb out of the pool first.', 'park'); return; }
  const p = nearestParked(); if (!p) return;
  player.x = p.bx; player.z = p.bz; player.dir = p.dir;
  setVehicle(player, p.kind, 0);
  scene.remove(player.veh); disposeModel(player.veh);
  player.veh = p.mesh; p.mesh.visible = true; p.col.off = true; player.pk = p;
  $('btn-ride').classList.add('is-on');
  pushToast('Driving the ' + VEH[p.kind].label + '. Tap Get out to leave it at its bay.', 'park', true);
  ping();
}
function releaseParked(nextKind) {
  const p = player.pk; if (!p) return;
  player.pk = null; player.veh = null; state.selfPv = null; state.selfPvIgnore = Date.now() + 4000;
  if (!nextKind) {
    const f = player.dir, rx = Math.cos(f), rz = -Math.sin(f);
    for (const s of [2.4, -2.4]) {
      const x = player.x + rx * s, z = player.z + rz * s, [cx, cz] = worldData.clamp(x, z);
      if (Math.abs(cx - x) > .01 || Math.abs(cz - z) > .01) continue;
      if (worldData.inPool && worldData.inPool(x, z)) continue;
      if (worldData.colliders.some(c => !c.wallEast && !c.off && Math.hypot(x - c.x, z - c.z) < c.r + .5)) continue;
      player.x = x; player.z = z; break;
    }
  }
  if (p.kind === 'flyster') player.gas = 1;
  p.mesh.position.set(p.bx, worldData.groundY(), p.bz); p.mesh.rotation.y = p.dir; p.mesh.visible = !parkedBusy(p); p.col.off = parkedBusy(p);
  if (!nextKind) clearOfParked(p);
  $('btn-ride').classList.remove('is-on');
  if (!nextKind) pushToast(VEH[p.kind].label + ' returned to its bay.', 'park', true);
}
function clearOfParked(p) {
  const m = p.mesh; m.updateMatrixWorld(true);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const c = Math.cos(p.dir), sn = Math.sin(p.dir);
  m.traverse(o => { if (!o.geometry) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox, e = o.matrixWorld.elements;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const dx = e[0] * x + e[4] * y + e[8] * z + e[12] - p.bx, dz = e[2] * x + e[6] * y + e[10] * z + e[14] - p.bz;
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz; x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); z0 = Math.min(z0, lz); z1 = Math.max(z1, lz); } });
  const dx = player.x - p.bx, dz = player.z - p.bz, lx = c * dx - sn * dz, lz = sn * dx + c * dz, M = .55;
  if (lx < x0 - M || lx > x1 + M || lz < z0 - M || lz > z1 + M) return;
  const cand = [[x1 + M + .3, lz], [x0 - M - .3, lz], [lx, z1 + M + .3], [lx, z0 - M - .3]];
  for (const [nx, nz] of cand) {
    const x = p.bx + c * nx + sn * nz, z = p.bz - sn * nx + c * nz, [cx, cz] = worldData.clamp(x, z);
    if (Math.abs(cx - x) > .01 || Math.abs(cz - z) > .01) continue;
    if (worldData.inPool && worldData.inPool(x, z)) continue;
    if (worldData.colliders.some(q => q !== p.col && !q.wallEast && !q.off && Math.hypot(x - q.x, z - q.z) < q.r + .5)) continue;
    player.x = x; player.z = z; return;
  }
}
function updateParked() {
  if (!parked.length || !player) { if (parkMarker) parkMarker.visible = false; return; }
  const me = state.account && state.account.playerId;
  for (const p of parked) {
    if (player.pk === p) continue;
    const busy = parkedBusy(p); p.mesh.visible = !busy; p.col.off = busy;
  }
  if (player.pk) for (const [id, R] of remotes) if (R.pv === player.pk.id && me && id < me) { setVehicle(player, null, 0); pushToast('Someone else got in first.', 'park'); break; }
  { const fl = player.vkind === 'flyster'; { const g = $('gas'); if (g) { g.style.display = fl ? '' : 'none'; if (fl) { const v = Math.round((player.gas == null ? 1 : player.gas) * 100); g.firstElementChild.style.width = v + '%'; g.setAttribute('aria-label', 'Thrust gas ' + v + ' percent'); g.classList.toggle('low', v < 20); } } } for (const id of ['btn-fup', 'btn-fdown']) { const e = $(id); if (e) e.style.display = fl ? '' : 'none'; } }
  const b = $('btn-enter'); if (!b) return;
  const swim = !player.vkind && worldData.inSwim && worldData.inSwim(player.x, player.z); // 118t: pool OR sea swim band
  if (player.pk) { markParked(null); b.style.display = ''; b.textContent = 'Get out'; }
  else if (!player.vkind && !swim && !state.taxi) { const p = nearestParked(); markParked(p); if (p) { b.style.display = ''; b.textContent = 'Get in: ' + VEH[p.kind].label.replace(/ \(.*$/, ''); } else b.style.display = 'none'; }
  else { markParked(null); b.style.display = 'none'; }
}
function useParkedButton() { if (!player || state.journey || state.transit) return; /* 150 */ if (player.pk && (player.alt || 0) > .3) { pushToast('Land first, then get out.', 'park'); return; } if (player.pk) setVehicle(player, null, 0); else enterParked(); }

/* ---------- Update 150: piloted inter-city crossings (design + isolation requirements: dev/TRAVEL-DESIGN.md) ----------
   LABELLED SCHEMATIC open sea/sky - NOT real route geography. Local-only v1: no shared transit presence;
   the broadcast stays the frozen departure snapshot (the origin avatar stands at the gate until arrival). */
function loadTransit(dest, apIdx, kind, label) {
  cam._sideAmount=0;if(cam._sideOffset)cam._sideOffset.set(0,0,0); //249 new camera basis
  // Same teardown/restore ordering as loadCity, incl. the 149 occRestore path.
  if (state.taxi) cancelTaxi();
  if (player && player.pk) setVehicle(player, null, 0); else occRestore();
  if (worldData && worldData.group) { scene.remove(worldData.group); worldData.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  for (const p of pickups) { scene.remove(p.model); disposeModel(p.model); p.label.el.remove(); } pickups.length = 0;
  for (const b of balls) { scene.remove(b.mesh); disposeModel(b.mesh); } balls = [];
  for (const R of remotes.values()) { if (R.veh) { scene.remove(R.veh); disposeModel(R.veh); } scene.remove(R.group); disposeModel(R.group); R.tag.el.remove(); }
  remotes.clear();
  clearParked();
  state.transit = { kind, dest, apIdx, label, from: state.city, snap: { x: player.x, z: player.z, dir: player.dir } };
  worldData = buildTransit(scene, kind);
  { const h = document.querySelector('.lk-hints'); if (h) { if (!state._hints0) state._hints0 = h.innerHTML; h.innerHTML = kind === 'air'
    ? '<span>WASD to steer</span><span class="lk-dot">·</span><span>Space to climb</span><span class="lk-dot">·</span><span>X to descend</span><span class="lk-dot">·</span><span>Reach the beacon</span>'
    : '<span>WASD to sail</span><span class="lk-dot">·</span><span>Reach the beacon</span>'; } // 150: crossing controls replace the on-foot hints
    for (const id of ['btn-run', 'btn-jump', 'btn-sit', 'btn-ride']) { const b = $(id); if (b) b.style.display = 'none'; }
    $('toasts').innerHTML = ''; // 150e: no stale journey toast (e.g. a previous "Turned back") survives into a new crossing
    { const pn = $('presence-num'); if (pn) { if (!state._pres0) state._pres0 = { n: pn.textContent }; pn.textContent = '1'; const dim = pn.parentElement && pn.parentElement.querySelector('.lk-pill-dim'); if (dim) { if (!state._presDim0) state._presDim0 = dim.textContent; dim.textContent = 'on this crossing'; } } } } // 150e: crossing is local-only - no shared-presence implication
  scene.background.set(worldData.sky); scene.fog.color.set(worldData.fog);
  sun.color.set(worldData.sun[0]); sun.intensity = worldData.sun[1];
  setVehicle(player, kind === 'air' ? 'flyster' : 'boat', 0);
  player.gas = 1;
  player.x = 0; player.z = 380; player.dir = Math.PI / 2; // facing -z, toward the beacon
  player.alt = kind === 'air' ? 18 : 0;
  cam.yaw = Math.PI; cam.pitch = .3; cam.dist = 16;
  cam.target.set(0, 3, 380);
  $('brand-city').textContent = (kind === 'air' ? 'Flight to ' : 'Crossing to ') + label;
  transitSound(true, kind);
  ping();
}
function arriveTransit() {
  { const h = document.querySelector('.lk-hints'); if (h && state._hints0) h.innerHTML = state._hints0; for (const id of ['btn-run', 'btn-jump', 'btn-sit', 'btn-ride']) { const b = $(id); if (b) b.style.display = ''; } const pn = $('presence-num'); if (pn) { if (state._pres0) { pn.textContent = state._pres0.n; state._pres0 = null; } const dim = pn.parentElement && pn.parentElement.querySelector('.lk-pill-dim'); if (dim && state._presDim0) { dim.textContent = state._presDim0; state._presDim0 = null; } } } // 150: restore on-foot HUD + presence pill (pollWorld refreshes the count)
  const t = state.transit; if (!t) return; state.transit = null;
  transitSound(false);
  setVehicle(player, null, 0); player.alt = 0; // the route vehicle never persists into the destination city
  enterPlace(t.dest, placeName(t.dest));
  const g = t.kind === 'air' ? ((worldData.airports && worldData.airports[t.apIdx || 0]) || worldData.airport) : worldData.ferry;
  if (g) { const [ax, az] = worldData.clamp ? worldData.clamp(g.arrive[0], g.arrive[1]) : g.arrive; player.x = ax; player.z = az; player.group.position.set(ax, worldData.groundY(ax, az), az); if (g.yaw !== undefined) cam.yaw = g.yaw; cam.target.set(ax, 1.5, az); }
  chime([392, 523, 659], .35);
  ping(); pollWorld();
}
function abortTransit() {
  { const h = document.querySelector('.lk-hints'); if (h && state._hints0) h.innerHTML = state._hints0; for (const id of ['btn-run', 'btn-jump', 'btn-sit', 'btn-ride']) { const b = $(id); if (b) b.style.display = ''; } const pn = $('presence-num'); if (pn) { if (state._pres0) { pn.textContent = state._pres0.n; state._pres0 = null; } const dim = pn.parentElement && pn.parentElement.querySelector('.lk-pill-dim'); if (dim && state._presDim0) { dim.textContent = state._presDim0; state._presDim0 = null; } } } // 150: restore on-foot HUD + presence pill (pollWorld refreshes the count)
  const t = state.transit; if (!t) return; state.transit = null;
  transitSound(false);
  setVehicle(player, null, 0); player.alt = 0;
  loadCity(t.from);
  const [ax, az] = worldData.clamp ? worldData.clamp(t.snap.x, t.snap.z) : [t.snap.x, t.snap.z];
  player.x = ax; player.z = az; player.dir = t.snap.dir; player.group.position.set(ax, worldData.groundY(ax, az), az);
  cam.target.set(ax, 1.5, az);
  pushToast('Turned back - still in ' + placeName(t.from) + '.', null, true);
  ping(); pollWorld();
}
function startCrossing(kind, dest, apIdx, label) {
  if (state.journey || state.transit || !nearGate()) return;
  $('panel-gate').hidden = true; setPanel('none'); $('ride-menu') && $('ride-menu').classList.remove('open');
  loadTransit(dest, apIdx, kind, label || placeName(dest));
  pushToast(kind === 'air' ? 'Taking the controls - fly to the beacon.' : 'Taking the helm - sail to the beacon.', null, true);
}

/* ---------- travel (Little World) ---------- */
function loadCity(id) {
  //249 a world load positions the camera afresh: no old shoulder offset belongs to the new world.
  cam._sideAmount=0;if(cam._sideOffset)cam._sideOffset.set(0,0,0);
  state._protoPrague = false; /* 168a: the preview flag dies with the world it described - traveling onward restores normal city behavior */
  { const gl = document.querySelector('.lk-goal'); if (gl) gl.style.display = ''; const hs = document.querySelector('.lk-hints span'); if (hs && state._protoHints) { hs.textContent = state._protoHints; state._protoHints = null; } } /* 175: restore host HUD texts the preview replaced */
  if (state._protoPres) { const pn = $('presence-num'); if (pn) { pn.textContent = state._protoPres.n; const dim = pn.parentElement && pn.parentElement.querySelector('.lk-pill-dim'); if (dim && state._protoPres.d) dim.textContent = state._protoPres.d; } state._protoPres = null; } // 170: restore the real presence pill
  if (worldData && worldData.group) { scene.remove(worldData.group); worldData.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  for (const p of pickups) { scene.remove(p.model); disposeModel(p.model); p.label.el.remove(); }
  pickups.length = 0;
  for (const b of balls) { scene.remove(b.mesh); disposeModel(b.mesh); } balls = []; // 118v
  for (const R of remotes.values()) { if (R.veh) { scene.remove(R.veh); disposeModel(R.veh); } scene.remove(R.group); disposeModel(R.group); R.tag.el.remove(); }
  remotes.clear();
  const prevCity = state.city;
  state.city = id; state.districtIdx = -1; state._round = undefined;
  if (V.on && prevCity && prevCity !== id) { // voice city boundary: stop sending to the room you just left; the next poll builds the new city's connections
    for (const pid of [...V.peers.keys()]) voiceClosePeer(pid);
    V.travelPending = true; // no reconnecting (poll rebuild or stale in-flight signals) until a ping acks THIS city - a failed/slow ping must never revive the old room
    beatNow();
  }
  if (id !== 'kerala') { cam.pitch = .24; cam.dist = innerWidth < 640 ? 16 : 12; }
  if (state.taxi) cancelTaxi();
  if (player && player.pk) setVehicle(player, null, 0);
  clearParked();
  const nyProtoReq = id === 'newyork' && new URLSearchParams(location.search).get('proto') === 'ny';
  const delhiProtoReq = id === 'delhi' && new URLSearchParams(location.search).get('proto') === 'delhi'; /* Update 146: row-13 second city (NY precedent) - same dev-only opt-in mechanics */
  const nyNmAdded = (nyProtoReq || delhiProtoReq) && !new URLSearchParams(location.search).has('nomerge');
  if (nyNmAdded) { const q = new URLSearchParams(location.search); q.set('nomerge', '1'); history.replaceState(null, '', '?' + q.toString()); } // unmerged build so the road overlay can sweep; re-merged right after
  worldData = id === 'kerala' ? buildWorld(scene) : buildCity(scene, id);
  if (nyNmAdded) { const q = new URLSearchParams(location.search); q.delete('nomerge'); history.replaceState(null, '', q.toString() ? '?' + q.toString() : location.pathname); } // sync restore: the flag never outlives the build, no async cleanup race
  if (delhiProtoReq) { const wd = worldData; import('/delhiproto.js').then(m => { if (worldData !== wd) return { ok: false, err: 'stale-city' }; return m.overlay(scene, wd, { pickups, parked, isStale: () => worldData !== wd }); }).then(r => { console.log('delhi-proto', JSON.stringify(r)); if (r && r.ok && worldData === wd) {
    if (state.taxi) state.taxi.route = null;
    import('/merge.js').then(mm => { if (worldData !== wd) return; mm.mergeStatic(wd.group, [...(wd.clouds || []), ...(wd.butterflies || [])]); console.log('delhi-proto remerged'); }); } }).catch(e => console.log('delhi-proto failed', e && e.message)); }
  if (nyProtoReq) { const wd = worldData; import('/nyproto.js').then(m => { if (worldData !== wd) return { ok: false, err: 'stale-city' }; return m.overlay(scene, wd, { pickups, parked, isStale: () => worldData !== wd }); }).then(r => { console.log('ny-proto', JSON.stringify(r)); if (r && r.ok && worldData === wd) {
    // A route planned during the fetch used the old collider grid. Replan on the next step.
    if (state.taxi) state.taxi.route = null;
    import('/merge.js').then(mm => { if (worldData !== wd) return; mm.mergeStatic(wd.group, [...(wd.clouds || []), ...(wd.butterflies || [])]); console.log('ny-proto remerged'); }); } }).catch(e => console.log('ny-proto failed', e && e.message)); }
  /* Update 167: Prague LOCAL-DEV opt-in (Main 6:13 constraints) - gate evaluates BEFORE any import or state change:
     production hostnames never attempt the held-module fetch; absent/failed/stale module leaves the host world untouched;
     the Prague world is built COMPLETELY (buildPragueWorld resolves) before the atomic swap. Held files stay untracked. */
  const pragueProtoReq = new URLSearchParams(location.search).get('proto') === 'prague' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1') && !state._pragueProtoDone; /* 168a: one-shot per page session - later travels load their real cities */
  if (pragueProtoReq) { const wd = worldData; import('/prague.js').then(m => m.buildPragueWorld(scene)).then(r => {
    if (worldData !== wd) return; // stale city change during build - discard
    if (!r || !r.ok) { console.log('prague-proto failed', r && r.err); return; } // host world intact
    for (const pk of [...pickups]) removePickup(pk); clearParked(); // host entities reference host world - clear before swap
    scene.remove(wd.group); wd.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    state._protoSnap = player ? { x: player.x, z: player.z, dir: player.dir } : { x: 0, z: 0, dir: 0 }; // 170: frozen broadcast snapshot BEFORE the preview respawn (150 transit pattern)
    for (const [rid, R] of remotes) { if (R.veh) { scene.remove(R.veh); disposeModel(R.veh); } scene.remove(R.group); disposeModel(R.group); R.tag.el.remove(); remotes.delete(rid); } // host-room avatars leave the preview
    state._protoPrague = true; state._pragueProtoDone = true; hideArrival();
    { const pn = $('presence-num'); if (pn) { state._protoPres = { n: pn.textContent, d: pn.parentElement && pn.parentElement.querySelector('.lk-pill-dim') && pn.parentElement.querySelector('.lk-pill-dim').textContent }; pn.textContent = '1'; const dim = pn.parentElement && pn.parentElement.querySelector('.lk-pill-dim'); if (dim) dim.textContent = 'in local preview'; } } if (state._trav) { scene.remove(state._trav.group); state._trav = null; } /* 168a: consistent preview identity - no host landmark/traveler/stamp state survives the swap */
    worldData = r.worldData; scene.add(worldData.group);
    buildBalls(); // 170: preview world has its own (empty) ball set - host balls leave with the host world
    if (V.on) voiceLeave(); // 172 (Main 6:42): leave the host voice room at swap - preview never silently interacts with it
    scene.background.set(worldData.sky); scene.fog.color.set(worldData.fog); sun.color.set(worldData.sun[0]); sun.intensity = worldData.sun[1]; // apply the swapped world's atmosphere (1556/1918 conventions)
    spawnPlayer(worldData.spawn.x, worldData.spawn.z);
    if (Number.isFinite(worldData.spawn.yaw)) { player.dir=cam.yaw=worldData.spawn.yaw; cam.pitch=.48; cam.dist=6.5;
      cam.target.set(player.x,worldData.groundY(player.x,player.z)+1.55,player.z);
      camera.position.set(player.x-Math.sin(cam.yaw)*Math.cos(cam.pitch)*cam.dist,cam.target.y+Math.sin(cam.pitch)*cam.dist,player.z-Math.cos(cam.yaw)*Math.cos(cam.pitch)*cam.dist);camera.lookAt(cam.target);
    } //213 local Prague arrival only; no other-world or saved-position change
    $('brand-city').textContent = 'Prague (proto)'; $('dt-en').textContent = 'Prague (proto)'; $('dt-ml').textContent = 'local preview · progress frozen'; /* 169: bottom-left district tag joins the preview identity (Main 6:22/6:27) */
    { const gl = document.querySelector('.lk-goal'); if (gl) gl.style.display = 'none'; const hs = document.querySelector('.lk-hints span'); if (hs) { state._protoHints = hs.textContent; hs.textContent = 'Local preview - nothing to collect'; } } /* 175 (Main 6:53): a frozen host goal bar + collect prompt are confusing in a preview with no collectibles - hide/replace while the preview lives, restored at the next loadCity entry */
    console.log('prague-proto', JSON.stringify(r.stats));
  }).catch(e => console.log('prague-proto failed', e && e.message)); }
  if (!state.monsoon) { scene.background.set(worldData.sky || '#8fd3ee'); scene.fog.color.set(worldData.fog || '#a8dcee'); }
  sun.color.set(worldData.sun ? worldData.sun[0] : '#fff2d8'); sun.intensity = state.monsoon ? .8 : (worldData.sun ? worldData.sun[1] : 1.9); // per-city climate tint (design inspiration), monsoon override preserved
  if (id === 'kerala') {
    const zc = districtZone(state.account && state.account.district >= 0 ? state.account.district : 3).zc;
    spawnPlayer(-20, zc + 8); seedPickups(-20, zc + 8, 10, 26);
  } else {
    spawnPlayer(worldData.spawn.x, worldData.spawn.z); seedPickups(null, null, 40, 0); buildParked(); buildBalls(); buildWaves(); /* 118v, 118x */
  }
  state._cityGen = (state._cityGen || 0) + 1; state._pickupsReady = false; // generation guard: responses from before this load must not touch this city
  state._pingAckGen = (state.account && state.account.token) ? -1 : state._cityGen; // logged-in: collects gate on the arrival ping ack; logged-out: nothing to ack
  state._collectHoldUntil = Date.now() + 1500; // UX-only: no instant auto-collect at the spawn point after travel
  syncPickups();
  { const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(cam.target.x - Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + sp * cam.dist, cam.target.z - Math.cos(cam.yaw) * cp * cam.dist); camera.lookAt(cam.target); }
  state._trav = null; if (id !== 'kerala' && LANDMARK_NAMES[id]) spawnTraveler(id);
  $('brand-city').textContent = id === 'kerala' ? 'Kerala' : CITY_DEFS[id].name;
  ping(); pollWorld();
}
const PLACE_LL = { kerala: [10.5, 76.3], mumbai: [19.08, 72.88], delhi: [28.61, 77.21], dubai: [25.2, 55.27], london: [51.51, -0.13], paris: [48.86, 2.35], newyork: [40.71, -74.01], tokyo: [35.68, 139.69], sydney: [-33.87, 151.21], rio: [-22.91, -43.17], cairo: [30.04, 31.24], capetown: [-33.92, 18.42], singapore: [1.35, 103.82], istanbul: [41.01, 28.98], rome: [41.9, 12.5], berlin: [52.52, 13.4], moscow: [55.75, 37.62], beijing: [39.9, 116.4], seoul: [37.57, 126.98], bangkok: [13.76, 100.5], hongkong: [22.32, 114.17], losangeles: [34.05, -118.24], mexicocity: [19.43, -99.13], buenosaires: [-34.6, -58.38], toronto: [43.65, -79.38], madrid: [40.4169, -3.7033], lisbon: [38.72528, -9.15], amsterdam: [52.37278, 4.89361], marrakesh: [31.63, -8.00889], lima: [-12.06, -77.0375], bogota: [4.711, -74.072], bogotadowntown: [4.59796, -74.07524], lagosisland: [6.4508, 3.3902], /* Update 123: district pin at the SOURCED Primatial Cathedral coordinate (MediaWiki API) - the real district position, explicit on the map */ /* pin coordinate sourced 29 Oct 2026: 4.7110 N, 74.0720 W (30yearweather.com/bogota; corroborated worldcitiesencyclopedia.com/city/bogota-colombia) */ auckland: [-36.8485, 174.7633], lagos: [6.455, 3.394], stockholm: [59.3294, 18.0687], kualalumpur: [3.14778, 101.69528], /* pin coordinate sourced 29 Oct 2026: 3.14778 N, 101.69528 E (en.wikipedia.org/wiki/Kuala_Lumpur; corroborated geodatos.net/en/coordinates/malaysia/kuala-lumpur 3.1412 N, 101.68653 E) */ /* pin coordinate sourced 29 Oct 2026: 59.32938 N, 18.06871 E (geonames.org/2673730/stockholm; corroborated en.wikipedia.org/wiki/Stockholm 59.32944 N, 18.06861 E) */ /* pin coordinate sourced 29 Oct 2026: 6.45407 N, 3.39467 E (geodatos.net/en/coordinates/nigeria/lagos; corroborated en.wikipedia.org/wiki/Lagos 6.45611 N, 3.39361 E; coordmap.com's 6.5244 N disagrees, not used) */ /* pin coordinate sourced 29 Oct 2026: 36.8485 S, 174.7633 E (longitude-latitude-maps.com/city/153_8,Auckland,Auckland,New+Zealand; corroborated en.wikipedia.org/wiki/Auckland 36.8492 S, 174.7653 E) */ nairobi: [-1.28639, 36.81722], jakarta: [-6.18, 106.83], athens: [37.98, 23.73] };
function enterPlace(id, name) {
  if (state.journey && !state._journeyGo) return;
  if (id !== state.city) { loadCity(id); pushToast('Welcome to ' + name, null, true); chime([392, 523, 659], .35); }
  try { localStorage.setItem('lk.lastCity', id); } catch {}
  setPanel('none');
}

/* ---------- airports and ferries (free, in-game, no booking) ---------- */
const PLANE_SVG = '<svg viewBox="0 0 120 56"><ellipse cx="58" cy="30" rx="48" ry="8" fill="#f4f1e6"/><path d="M104 30 L118 22 L112 31 Z" fill="#f4f1e6"/><path d="M12 30 L2 14 L16 22 Z" fill="#e8452c"/><path d="M50 30 L72 6 L80 6 L68 30 Z" fill="#e8452c"/><path d="M50 32 L72 52 L80 52 L68 32 Z" fill="#c93a24"/><g fill="#2a4a66"><rect x="30" y="26" width="4" height="4"/><rect x="38" y="26" width="4" height="4"/><rect x="92" y="26" width="6" height="4"/></g></svg>';
const SHIP_SVG = '<svg viewBox="0 0 120 56"><path d="M4 34 H116 L102 50 H20 Z" fill="#1f4f7a"/><rect x="26" y="22" width="62" height="12" fill="#f2f0e6"/><rect x="34" y="12" width="36" height="10" fill="#f2f0e6"/><rect x="62" y="4" width="8" height="8" fill="#e8b923"/><g fill="#2a4a66"><rect x="30" y="25" width="6" height="4"/><rect x="42" y="25" width="6" height="4"/><rect x="54" y="25" width="6" height="4"/><rect x="66" y="25" width="6" height="4"/><rect x="40" y="15" width="6" height="4"/><rect x="52" y="15" width="6" height="4"/></g><path d="M0 52 Q15 46 30 52 T60 52 T90 52 T120 52" stroke="#bfe4f0" stroke-width="3" fill="none"/></svg>';
const placeName = id => id === 'kerala' ? 'Kerala' : (CITY_DEFS[id] ? CITY_DEFS[id].name : id);
const isCoastal = id => id === 'kerala' || !!(CITY_DEFS[id] && CITY_DEFS[id].water);
function nearGate() {
  if (!player || !worldData || player.vkind || state.taxi || state.journey || state.transit) return null; // 150
  for (const [k, g] of [...(worldData.airports || (worldData.airport ? [worldData.airport] : [])).map(a => ['air', a]), ['sea', worldData.ferry]]) if (g && Math.hypot(player.x - g.x, player.z - g.z) < g.r) { state._gateHere = g; return k; }
  return null;
}
function updateGate() {
  const b = $('btn-gate'); if (!b) return;
  if (state.transit) { b.style.display = ''; b.textContent = 'Turn back'; return; } // 150
  const k = nearGate();
  if (k !== state._gate) { state._gate = k; }
  if (!k) { b.style.display = 'none'; return; }
  b.style.display = ''; b.textContent = k === 'air' ? 'Fly somewhere' : 'Take the ferry';
}
function openGate(kind) {
  const list = $('gate-list'); list.innerHTML = '';
  $('gate-eyebrow').textContent = kind === 'air' ? 'AIRPORT' : 'FERRY';
  $('gate-title').textContent = kind === 'air' ? 'Where to?' : 'Where to by sea?';
  $('gate-sub').textContent = (kind === 'air' ? 'Short flight, about six seconds.' : 'A slower sailing, about ten seconds. Ferries run between coastal places only.') + ' Free, in-game only. No tickets or booking.';
  // Kerala has four international airports (Kannur, Kozhikode, Kochi, Thiruvananthapuram); each is its own destination
  const KAP = [['Kannur', 'CNN'], ['Kozhikode', 'CCJ'], ['Kochi', 'COK'], ['Thiruvananthapuram', 'TRV']];
  const here = state._gateHere;
  const dests = [];
  for (const id of ['kerala', ...Object.keys(CITY_DEFS)]) {
    if (kind === 'sea') { if (id !== state.city && isCoastal(id)) dests.push([id, 0, placeName(id), 'Ferry dock']); continue; }
    if (id === 'kerala') KAP.forEach(([n, c], i) => { const wa = state.city === 'kerala' && worldData.airports && worldData.airports[i]; if (wa && here && wa.x === here.x && wa.z === here.z) return; dests.push([id, i, 'Kerala: ' + n, 'Airport ' + c]); });
    else if (id !== state.city) { const ap = CITY_AIRPORTS[id]; dests.push([id, 0, placeName(id), ap ? ap.code + ' \u00b7 ' + ap.name : 'Airport']); }
  }
  dests.sort((a, b) => a[2].localeCompare(b[2]));
  if (!isCoastal(state.city) && kind === 'sea') { list.innerHTML = '<li class="lk-sub">No ferry from here.</li>'; }
  for (const [id, ai, label, sub] of dests) {
    const li = document.createElement('li'), b = document.createElement('button'); b.className = 'lk-city';
    b.innerHTML = '<strong>' + esc(label) + '</strong><span>' + esc(sub) + '</span>';
    b.onclick = () => { const pi = $('gate-pilot'); if (pi && pi.checked) startCrossing(kind, id, ai, label); else startJourney(kind, id, ai, label); }; li.appendChild(b); list.appendChild(li); // 150: pilot-it-myself toggle
  }
  $('panel-gate').hidden = false;
  if (state.account && state.account.token) api('/players/' + state.account.playerId + '/events').then(d => {
    const mine = d.mine || [];
    if (mine.length) { const w = document.createElement('li'); w.className = 'lk-sub'; w.textContent = 'You are hosting a show in ' + placeName(mine[0].city) + '. If you are away from that city for more than 3 minutes it ends.'; list.prepend(w); }
  }).catch(() => {});
}
function startJourney(kind, dest, apIdx, label) {
  if (state.journey || state.transit || !nearGate()) return; state.journey = true; // 150
  $('panel-gate').hidden = true; setPanel('none'); $('ride-menu') && $('ride-menu').classList.remove('open');
  const j = $('journey'), secs = kind === 'air' ? 6 : 10, deadline = Date.now() + secs * 1000;
  j.classList.toggle('sea', kind === 'sea'); j.style.setProperty('--jt', secs + 's');
  $('j-vehicle').innerHTML = kind === 'air' ? PLANE_SVG : SHIP_SVG; $('j-vehicle').style.animation = 'none'; void $('j-vehicle').offsetWidth; $('j-vehicle').style.animation = '';
  $('j-text').textContent = (kind === 'air' ? 'Flying to ' : 'Sailing to ') + (label || placeName(dest));
  $('j-sub').textContent = kind === 'air' ? 'Fasten your seatbelt.' : 'Enjoy the sea breeze.';
  j.hidden = false; chime([330, 392, 494], .3);
  let done = false;
  const finish = () => {
    if (done) return; done = true; document.removeEventListener('visibilitychange', onVis);
    try {
      state._journeyGo = true; enterPlace(dest, placeName(dest)); state._journeyGo = false;
      const g = kind === 'air' ? ((worldData.airports && worldData.airports[apIdx || 0]) || worldData.airport) : worldData.ferry;
      if (g && player) { const [ax, az] = worldData.clamp ? worldData.clamp(g.arrive[0], g.arrive[1]) : g.arrive; player.x = ax; player.z = az; player.group.position.set(ax, worldData.groundY(ax, az), az); if (g.yaw !== undefined) cam.yaw = g.yaw; cam.target.set(ax, 1.5, az); }
      $('j-text').textContent = 'Welcome to ' + placeName(dest);
    } catch (e) { console.error(e); state._journeyGo = false; pushToast('The trip hit a problem. You are still where you were.'); }
    setTimeout(() => { $('journey').hidden = true; state.journey = false; }, 900);
  };
  const onVis = () => { if (!document.hidden && Date.now() >= deadline) finish(); };
  document.addEventListener('visibilitychange', onVis);
  setTimeout(finish, secs * 1000);
}
let evPoll = 0, evKind = 'open-stage', evStart = 0;
const EV_STARTS = [['Now', 0], ['In 15 min', 15], ['In 1 hour', 60]];
async function renderEvents() {
  clearTimeout(evPoll);
  if (state.panel !== 'events') return;
  const list = $('events-list'), host = $('events-host');
  let data;
  try { data = state.account ? await api('/players/' + state.account.playerId + '/events?city=' + encodeURIComponent(state.city || 'kerala')) : await api('/events?city=' + encodeURIComponent(state.city || 'kerala')); } catch { list.innerHTML = '<li class="lk-sub">Events are not available right now.</li>'; return; }
  const me = state.account && state.account.playerId;
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  list.innerHTML = '';
  if (!data.stage) { host.innerHTML = ''; list.innerHTML = '<li class="lk-sub">No stage in this city yet.</li>'; return; }
  host.innerHTML = '';
  const kinds = Object.entries(data.kinds);
  const mkChips = (rows, cur, on) => { const d = document.createElement('div'); d.className = 'lk-chips'; rows.forEach(([k, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lk-chip' + (k === cur ? ' is-on' : ''); b.textContent = label; b.onclick = () => { on(k); renderEvents(); }; d.appendChild(b); }); return d; };
  const nt = document.createElement('p'); nt.className = 'lk-sub'; nt.textContent = 'Shows are saved while they run: an ended or cancelled show expires after 10 minutes, and cleanup usually follows within a minute - it can take longer if the database is unreachable. If the game restarts, your show comes back and the host has 3 minutes to return before it ends. Signing up is a list - you still walk onto the stage and dance.'; host.appendChild(nt);
  const h = document.createElement('h2'); h.className = 'lk-h2'; h.textContent = 'HOST A SHOW'; host.appendChild(h);
  host.appendChild(mkChips(kinds, evKind, k => evKind = k));
  host.appendChild(mkChips(EV_STARTS.map(([l, m]) => [m, l]), evStart, m => evStart = +m));
  const go = document.createElement('button'); go.className = 'lk-btn'; go.type = 'button'; go.textContent = 'Put it on the stage';
  go.onclick = async () => {
    if (!state.account) return pushToast('Join first to host a show');
    try { await api('/players/' + me + '/events', { method: 'POST', body: JSON.stringify({ kind: evKind, city: state.city || 'kerala', startsAt: evStart ? new Date(Date.now() + evStart * 60000).toISOString() : 'now' }) }); pushToast('Show added'); }
    catch (e) { pushToast(String(e.message || 'Could not add the show')); }
    renderEvents();
  };
  host.appendChild(go);
  const hl = document.createElement('h2'); hl.className = 'lk-h2'; hl.textContent = 'ON THE STAGE'; host.appendChild(hl);
  if (!data.events.length) { const li = document.createElement('li'); li.className = 'lk-sub'; li.textContent = 'No shows yet. Nobody has put one on - be the first.'; list.appendChild(li); }
  for (const e of data.events) {
    const li = document.createElement('li'); li.className = 'lk-ev' + (e.status === 'live' ? ' is-live' : '');
    const t = document.createElement('strong'); t.textContent = e.title + (e.status === 'live' ? ' - on now' : '');
    const w = document.createElement('span'); w.textContent = fmt.format(new Date(e.startsAt)) + ' · ' + e.host.name + ' · ' + e.signedUpDancers + '/' + e.dancerSlots + ' signed up to dance' + (e.status === 'live' && e.onStageNow !== null ? ' · ' + e.onStageNow + ' on the stage now' : '') + ' · ' + e.audienceCount + ' signed up to watch';
    li.append(t, w);
    const row = document.createElement('div'); row.className = 'lk-ev-row';
    const act = (label, path, body, toast) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lk-btn lk-btn-ghost'; b.textContent = label; b.onclick = async () => { try { await api('/players/' + me + '/events/' + e.id + '/' + path, { method: 'POST', body: JSON.stringify(body || {}) }); if (toast) pushToast(toast); } catch (er) { pushToast(String(er.message || 'Not possible')); } renderEvents(); }; row.appendChild(b); };
    if (me) {
      if (e.you === 'host') act('Cancel show', 'cancel');
      else { if (e.you !== 'dancer') act('Dance in it', 'join', { role: 'dancer' }, 'You are on the list. Walk onto the stage and dance.'); if (e.you !== 'audience') act('Watch', 'join', { role: 'audience' }); if (e.you) act('Leave', 'leave'); }
    }
    if (row.children.length) li.appendChild(row);
    list.appendChild(li);
  }
  evPoll = setTimeout(renderEvents, 10000);
}
async function renderTravel() {
  const list = $('travel-list'); list.innerHTML = '<li class="lk-sub">Loading places…</li>';
  let rows;
  try { rows = (await api('/cities')).cities; } catch { rows = Object.keys(CITY_DEFS).map(id => ({ id, name: CITY_DEFS[id].name, country: '', online: 0, points: 0 })); rows.unshift({ id: 'kerala', name: 'Kerala', country: 'India', online: 0, points: 0 }); }
  rows = rows.map(c => c.id === 'kerala' ? Object.assign({}, c, { name: 'Kerala' }) : c).sort((a, b) => a.name.localeCompare(b.name));
  // map: land outlines only, pins only for places that are actually built
  const NS = 'http://www.w3.org/2000/svg', svg = $('world-map'); svg.innerHTML = '';
  const mk = (t, a, par) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (par || svg).appendChild(e); return e; };
  mk('rect', { x: 0, y: 0, width: 360, height: 180, fill: '#12394a' });
  mk('path', { d: LAND_PATH, fill: '#3b6b55', stroke: 'none' });
  for (const c of rows) {
    const ll = PLACE_LL[c.id]; if (!ll) continue;
    const g = mk('g', { 'data-place-id': c.id, tabindex: 0, role: 'button', 'aria-label': 'Go to ' + c.name, style: 'cursor:pointer' });
    mk('circle', { cx: ll[1] + 180, cy: 90 - ll[0], r: c.id === state.city ? 4.2 : (c.parent ? 2.3 : 3.2), fill: c.parent ? '#12394a' : (c.id === state.city ? '#ffd23f' : '#ff8a4c'), stroke: c.parent ? '#ff8a4c' : '#fff', 'stroke-width': c.parent ? 1.2 : 0.8 }, g); /* Update 123: district pins are smaller + hollow - a district is not another city */
    mk('circle', { cx: ll[1] + 180, cy: 90 - ll[0], r: 7, fill: 'transparent' }, g);
    const go = () => enterPlace(c.id, c.name); g.onclick = go; g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') go(); };
    const t = mk('title', {}, g); t.textContent = c.name + (c.parent ? ' (district of ' + (((rows.find(r => r.id === c.parent) || {}).name) || c.parent) + ')' : '');
  }
  list.innerHTML = '';
  for (const c of rows) {
    const li = document.createElement('li'); li.dataset.placeId = c.id;
    li.dataset.search = [c.name, c.country || '', LANDMARK_NAMES[c.id] || '', (STAGE_THEMES[c.id] || {}).name || ''].join(' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const b = document.createElement('button'); b.className = 'lk-city' + (c.id === state.city ? ' is-here' : '') + (c.parent ? ' lk-district' : '');
    const lm = LANDMARK_NAMES[c.id];
    const st = (STAGE_THEMES[c.id] || {}).name || 'City stage';
    const live = (c.live || []).map(k => (EVENT_KINDS || {})[k] || k);
    b.innerHTML = '<strong>' + esc(c.name) + '</strong><span>' + esc(c.parent ? ('District of ' + (((rows.find(r => r.id === c.parent) || {}).name) || c.parent) + (c.note ? ' - ' + c.note : '')) : (c.country || '')) + '</span><em>' + (lm ? esc(lm) + ' stand-in' : '') + ((state._passport && state._passport[c.id]) ? ' ★' : '') + ((state._travFound && state._travFound[c.id]) ? ' · ☺' : '') + '</em><em>' + esc(st) + ' · ' + (c.online || 0) + ' online · ' + (c.points || 0) + ' pts</em>' + (live.length ? '<em class="lk-live">Live now: ' + esc(live.join(' + ')) + '</em>' : '');
    b.onclick = () => enterPlace(c.id, c.name);
    li.appendChild(b); list.appendChild(li);
  }
  const search = $('travel-search'), status = $('travel-results');
  const applySearch = () => {
    const query = search.value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const words = query.split(/\s+/).filter(Boolean), shown = new Set();
    for (const li of list.children) { const match = words.every(w => li.dataset.search.includes(w)); li.hidden = !match; if (match) shown.add(li.dataset.placeId); }
    for (const pin of svg.querySelectorAll('[data-place-id]')) { const match = shown.has(pin.dataset.placeId); pin.style.display = match ? '' : 'none'; pin.setAttribute('tabindex', match ? '0' : '-1'); }
    status.textContent = shown.size ? shown.size + ' of ' + rows.length + ' places' : 'No places match. Try a city, country or landmark.';
  };
  search.oninput = applySearch; applySearch();
}
function renderPassport() {
  const got = state._passport || {}, ids = Object.keys(LANDMARK_NAMES);
  const tn = Object.keys(state._travFound || {}).length;
  $('passport-count').textContent = Object.keys(got).length + ' of ' + ids.length + ' landmark stamps' + (tn ? ' · ' + tn + ' of ' + ids.length + ' little travelers met' : '') + '. Both reset when you refresh or close the game.' + (Object.keys(got).length >= ids.length ? ' Passport complete!' : '');
  const list = $('passport-list'); list.innerHTML = '';
  ids.map(id => ({ id, name: (CITY_DEFS[id] || {}).name || id, lm: LANDMARK_NAMES[id] })).sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
    const li = document.createElement('li'), d = document.createElement('div');
    d.className = 'lk-stamp' + (got[c.id] ? ' is-got' : '');
    d.innerHTML = '<strong>' + esc(c.name) + '</strong><span class="lk-mark' + (got[c.id] ? '' : ' is-no') + '">' + (got[c.id] ? '★' : '☆') + '</span><em>' + esc(c.lm) + '</em>' + (state._travFound && state._travFound[c.id] ? '<em>☺ little traveler met</em>' : '');
    li.appendChild(d); list.appendChild(li);
  });
}
function enterWorld() {
  let last = null; try { last = localStorage.getItem('lk.lastCity'); } catch {}
  if (last && (last === 'kerala' || CITY_DEFS[last])) { loadCity(last); }
  else { if (state.city === 'kerala') loadCity('newyork'); state.panel = 'none'; setPanel('travel'); }
}
let myEmote = null, myEmoteAt = 0;
async function sendEmote(e) {
  if (state.journey) return;
  if (!state.account || !state.account.token) return;
  if (myEmote === e) { myEmote = null; try { await api('/players/' + state.account.playerId + '/emote', { method: 'POST', body: JSON.stringify({ emote: 'none' }) }); } catch {} return; }
  myEmote = e; myEmoteAt = performance.now();
  if (player && player.nameTag) { player._base = player._base || player.nameTag.el.innerHTML; player.nameTag.el.innerHTML = player._base + ' <span class="lk-emote">· ' + EMO[e] + '</span>'; setTimeout(() => { if (player && player.nameTag) player.nameTag.el.innerHTML = player._base; }, 4000); }
  try { await api('/players/' + state.account.playerId + '/emote', { method: 'POST', body: JSON.stringify({ emote: e }) }); } catch {}
}

/* ---------- presence ---------- */
let presenceStarted = false;
function startPresence() {
  if (presenceStarted) return; presenceStarted = true;
  pollWorld();
  const loop = (fn, slow, fast) => { const t = () => { const riding = (player && player.vkind) || [...remotes.values()].some(R => R.vkind); setTimeout(() => { fn(); t(); }, riding ? fast : slow); }; t(); };
  loop(pollWorld, 3500, 1200);
  loop(ping, 4000, 1000);
}

/* ---------- boot ---------- */
function boot() {
  initThree();
  bindInput();

  // districts into select
  const sel = $('ob-district');
  DISTRICTS.forEach((d, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = d[1] + ' · ' + d[2];
    sel.appendChild(o);
  });

  const refreshJoinBtn = () => { $('ob-join').disabled = !($('ob-adult').checked && $('ob-name').value.trim()); };
  sel.onchange = refreshJoinBtn; $('ob-adult').onchange = refreshJoinBtn;
  $('ob-name').oninput = refreshJoinBtn;
  $('ob-join').onclick = () => join($('ob-name').value.trim().slice(0, 24) || 'Guest', +sel.value);

  $('intro-skip').onclick = () => {
    audio(); // unlock audio on gesture
    const acc = loadAccount();
    if (acc && acc.playerId) {
      state.account = acc;
      setPoints(acc.points || 15);
      if (acc.playerId) api('/players/' + acc.playerId).then(r => setPoints(r.player.points)).catch(() => {});
      state.districtIdx = -1;
      const { zc } = districtZone(acc.district >= 0 ? acc.district : 3);
      spawnPlayer(-20, zc + 8);
      seedPickups(-20, zc + 8, 10, 26); syncPickups();
      setStage('play');
      startPresence();
      enterWorld();
    } else setStage('onboard');
  };
  $('intro-copy').onclick = async () => { try { await navigator.clipboard.writeText(location.href); pushToast('Link copied'); } catch {} };
  $('intro-wa').href = 'https://wa.me/?text=' + encodeURIComponent('Come explore: walk, ride and collect across ' + Object.keys(CITY_DEFS).length + ' cities and Kerala in the browser. ' + location.href);

  $('points-pill').onclick = () => setPanel('board');
  $('btn-help').onclick = () => setPanel('help');
  $('btn-events').onclick = () => setPanel('events');
  $('btn-travel').onclick = () => setPanel('travel');
  $('btn-localmap').onclick = () => setPanel('localmap');
  $('btn-explore').onclick = () => setPanel('explore');
  $('explore-world').onclick = () => $('btn-travel').click();
  $('explore-map').onclick = () => setPanel('localmap');
  $('explore-map-inline').onclick = () => setPanel('localmap');
  $('discovery-continue').onclick=()=>{discovery.start();setPanel('none');};
  $('explore-discovery').onclick=()=>{if(discovery.start())setPanel('none');};
  $('explore-close').onclick = () => setPanel('none');
  $('map-marker').onclick = () => setPanel('localmap');
  $('btn-passport').onclick = () => setPanel('passport');
  $('btn-gate').onclick = () => { if (state.transit) { abortTransit(); return; } const k = nearGate(); if (k) openGate(k); }; // 150: during a crossing the button turns the player back $('gate-close').onclick = () => { $('panel-gate').hidden = true; };
  $('btn-games').onclick = () => setPanel('games');
  $('btn-voice').onclick = () => setPanel('voice');
  voiceWire();
  ludoWire(); echoWire();
freezeWire();
gamesWire();
  document.querySelectorAll('[data-board]').forEach(b => b.onclick = () => { boardTab = b.dataset.board; renderBoard(); });
  document.querySelectorAll('[data-emote]').forEach(b => b.onclick = () => sendEmote(b.dataset.emote));

  // Mobile menu: on narrow screens the top utility row and the emote row move
  // into one Menu sheet. Nodes are moved (not duplicated), so every existing
  // handler, hidden flag and is-on/lk-on state keeps working. Desktop unchanged.
  const mmenuQ = window.matchMedia('(max-width: 640px)');
  const setMobileMenu = open => {
    $('mmenu').hidden = !open;
    $('btn-menu').setAttribute('aria-expanded', String(open));
  };
  function applyMenuMode() {
    const on = mmenuQ.matches;
    const icons = document.querySelector('.lk-hud-icons'), emotes = document.querySelector('.lk-emotes');
    const tools = $('mmenu-tools'), emo = $('mmenu-emotes');
    if (on) { [...icons.children].forEach(b => tools.appendChild(b)); [...emotes.children].forEach(b => emo.appendChild(b)); }
    else { [...tools.children].forEach(b => icons.appendChild(b)); [...emo.children].forEach(b => emotes.appendChild(b)); setMobileMenu(false); }
    $('btn-menu').hidden = !on;
    document.body.classList.toggle('lk-mmenu-on', on);
  }
  $('btn-menu').onclick = () => setMobileMenu($('mmenu').hidden);
  $('mmenu').addEventListener('click', e => { if (e.target.closest('button')) setMobileMenu(false); });
  document.addEventListener('click', e => { const m = $('mmenu'); if (!m.hidden && !e.target.closest('#mmenu') && !e.target.closest('#btn-menu')) setMobileMenu(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('mmenu').hidden) {
      setMobileMenu(false); $('btn-menu').focus(); e.preventDefault();
    }
  });
  if (mmenuQ.addEventListener) mmenuQ.addEventListener('change', applyMenuMode);
  applyMenuMode();
{ const rb = $('btn-run'); if (rb) { rb.addEventListener('pointerdown', ev => { ev.preventDefault(); state.runTouch = true; }); for (const t of ['pointerup', 'pointerleave', 'pointercancel']) rb.addEventListener(t, () => { state.runTouch = false; }); }
  const jb = $('btn-jump'); if (jb) jb.onclick = () => sendEmote('jump');
  const sb = $('btn-sit'); if (sb) sb.onclick = () => sendEmote('sit'); }
  $('btn-look').onclick = () => setPanel('look');
  $('btn-view').onclick = () => toggleFP();
  $('btn-monsoon').onclick = () => setMonsoon(!state.monsoon);
  $('btn-ride').onclick = () => $('ride-menu').classList.toggle('open'); $('btn-calltaxi').onclick = openTaxiPanel; document.querySelectorAll('#ride-menu [data-veh]').forEach(b => { b.onclick = () => toggleRide(b.dataset.veh); });
  $('btn-mute').onclick = () => { state.muted = !state.muted; $('btn-mute').textContent = state.muted ? 'Muted' : 'Sound'; if (rainNode) rainNode.g.gain.value = state.muted ? 0 : .12; if (transitNode) transitNode.g.gain.value = state.muted ? 0 : .03; };
  $('btn-full').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => setPanel('none'));
  $('look-save').onclick = saveLook;

  // ambient world behind intro: spawn a temp camera focus mid-map
  seedPickups(null, null, 48, 0);
  spawnPlayer(-20, districtZone(3).zc + 8);
  requestAnimationFrame(loop);
  setStage('intro');
}
/* ---------- Voice (WebRTC mesh, up to VOICE_MAX (default 8), opt-in) ---------- */
const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }];
const V = { on: false, stream: null, peers: new Map(), muted: false, blocked: new Set(), timer: null, members: [], listenOnly: false, hearSet: new Set(), inSet: new Set(), ac: null, pan: new Map(), lisT: null };
try { JSON.parse(localStorage.getItem('lk.voice.blocked') || '[]').forEach(x => V.blocked.add(x)); } catch {}
const vApi = (p, body) => api('/players/' + state.account.playerId + '/voice' + p, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });
function voiceWire() {
  fetch('/api/health').then(r => r.json()).then(h => { $('btn-voice').hidden = !h.voice; $('btn-mic').hidden = !h.voice; if (h.voiceMax) $('voice-max-n').textContent = h.voiceMax; }).catch(() => {});
  $('voice-join').onclick = () => voiceJoin(false);
  $('voice-listen').onclick = () => voiceJoin(true);
  $('voice-leave').onclick = () => voiceLeave(); $('voice-tap').onclick = voiceTap;
  $('btn-mic').onclick = () => micToggle();
  $('voice-mute').onclick = () => { V.muted = !V.muted; if (V.stream) V.stream.getAudioTracks().forEach(t => t.enabled = !V.muted); voiceRender(); };
}
function micBtnRender() { // on-screen mic toggle (tap to talk, tap again to mute; off until tapped)
  const b = $('btn-mic'); if (!b || b.hidden) return;
  const live = V.on && !V.listenOnly, on = live && !V.muted;
  b.textContent = on ? 'Mic on' : (live ? 'Muted' : 'Mic');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.classList.toggle('lk-mic-live', on);
}
async function micToggle() {
  if (!state.account || !state.account.token) { pushToast('Join the game first'); return; }
  if (!window.RTCPeerConnection) { pushToast('This browser does not support voice chat.'); return; }
  if (V.busy) return;
  if (!V.on) { await voiceJoin(false); }
  else if (V.listenOnly) {
    V.busy = true;
    try { // preflight permission BEFORE leaving: a denied upgrade must keep the listen-only session and never claim the mic
      let probe = null;
      try { probe = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch { pushToast('Microphone not allowed. Still listening.'); return; }
      probe.getTracks().forEach(t => t.stop());
      try { await vApi('/leave', {}); } catch {}
      voiceCleanup();
    } finally { V.busy = false; }
    await voiceJoin(false);
  }
  else { V.muted = !V.muted; if (V.stream) V.stream.getAudioTracks().forEach(t => t.enabled = !V.muted); voiceRender(); }
  micBtnRender();
}
async function voiceJoin(listenOnly) {
  if (state._protoPrague) { pushToast('Voice is off in this local preview.'); return; } // 172 (Main 6:42): voice stays out of the host room while the preview lives
  if (!state.account || !state.account.token) { pushToast('Join the game first'); return; }
  if (!window.RTCPeerConnection) { pushToast('This browser does not support voice chat.'); return; }
  if (!listenOnly && !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { pushToast('Microphone is not available here. You can join listen-only.'); return; }
  if (V.busy) return; // a join/upgrade is already in flight - never double-join
  V.busy = true;
  try {
  V.listenOnly = listenOnly; V.muted = false;
  if (!listenOnly) {
    try { V.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { pushToast('Microphone not allowed. You can join listen-only.'); return; }
  }
  let jr;
  try { jr = await vApi('/join', { listenOnly }); } catch (e) { pushToast(e.message); voiceCleanup(); return; }
  if (jr && jr.hear) { V.hearSet = new Set(jr.hear); V.inSet = new Set(jr.inbound || []); }
  try { if (!V.ac && (window.AudioContext || window.webkitAudioContext)) { V.ac = new (window.AudioContext || window.webkitAudioContext)(); if (V.ac.state === 'suspended') V.ac.resume().catch(() => {}); } } catch {}
  V.on = true; $('voice-intro').hidden = true; $('voice-live').hidden = false;
  clearInterval(V.timer); V.timer = setInterval(voicePoll, 1000); clearInterval(V.st); V.st = setInterval(voiceStats, 2000); clearInterval(V.lisT); V.lisT = setInterval(voiceListener, 100); voicePoll();
  } finally { V.busy = false; }
}
function voiceCleanup() {
  clearInterval(V.timer); V.timer = null; clearInterval(V.st); V.st = null; V.on = false; V.busy = false;
  clearInterval(V.lisT); V.lisT = null;
  for (const id of [...V.pan.keys()]) voiceDetach(id);
  for (const [id, p] of V.peers) { try { p.pc.close(); } catch {} if (p.audio) p.audio.remove(); }
  V.peers.clear(); V.hearSet = new Set(); V.inSet = new Set();
  if (V.ac) { try { V.ac.close(); } catch {} V.ac = null; }
  if (V.stream) { V.stream.getTracks().forEach(t => t.stop()); V.stream = null; }
  $('voice-intro').hidden = false; $('voice-live').hidden = true; $('btn-voice').textContent = 'Voice'; micBtnRender();
}
async function voiceLeave() { try { await vApi('/leave', {}); } catch {} voiceCleanup(); }
let voiceGenSeq = 0;
function voiceAttach(id, p, stream) { // audible peer: route through a spatial panner (nearby-voice design); fallback to a plain audio element
  if (V.ac) {
    try {
      const src = V.ac.createMediaStreamSource(stream);
      const pan = V.ac.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 2; pan.maxDistance = 20; pan.rolloffFactor = 1.4;
      const g = V.ac.createGain(); g.gain.value = V.blocked.has(id) ? 0 : 1;
      src.connect(pan); pan.connect(g); g.connect(V.ac.destination);
      V.pan.set(id, { src, pan, g }); return;
    } catch {}
  }
  if (!p.audio) { p.audio = document.createElement('audio'); p.audio.autoplay = true; p.audio.setAttribute('playsinline', ''); document.body.appendChild(p.audio); }
  p.audio.srcObject = stream; p.audio.muted = V.blocked.has(id);
  p.audio.play().then(() => { p.needTap = false; voiceRender(); }).catch(() => { p.needTap = true; voiceRender(); });
}
function voiceDetach(id) { const n = V.pan.get(id); if (n) { try { n.src.disconnect(); n.pan.disconnect(); n.g.disconnect(); } catch {} V.pan.delete(id); } }
function voicePosUpdate(pos) { // place heard voices in the world (1s poll cadence, smoothed)
  if (!V.ac) return; const t = V.ac.currentTime;
  for (const [id, n] of V.pan) { const q = pos && pos[id]; if (q) { n.pan.positionX.setTargetAtTime(q[0], t, .3); n.pan.positionY.setTargetAtTime(1.6, t, .3); n.pan.positionZ.setTargetAtTime(q[1], t, .3); } }
}
function voiceListener() { // keep the Web Audio listener glued to the player
  if (!V.ac || !V.on || !player) return; const L = V.ac.listener, t = V.ac.currentTime;
  if (!L.positionX) return;
  L.positionX.setTargetAtTime(player.x, t, .08); L.positionY.setTargetAtTime(1.6, t, .08); L.positionZ.setTargetAtTime(player.z, t, .08);
  L.forwardX.setTargetAtTime(Math.sin(cam.yaw), t, .08); L.forwardY.setTargetAtTime(0, t, .08); L.forwardZ.setTargetAtTime(Math.cos(cam.yaw), t, .08);
  L.upX.setTargetAtTime(0, t, .08); L.upY.setTargetAtTime(1, t, .08); L.upZ.setTargetAtTime(0, t, .08);
}
function voiceClosePeer(id) { const p = V.peers.get(id); if (!p) return; voiceDetach(id); try { p.pc.close(); } catch {} if (p.audio) p.audio.remove(); V.peers.delete(id); }
function voiceDiag(s, p) { // outcome only: no audio, no ids, no addresses
  fetch('/api/voice-diag', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ s, ice: p.pc.iceConnectionState, ms: Date.now() - p.t0, role: p.lower ? 'caller' : 'callee' }) }).catch(() => {});
}
function voicePeer(id, gen, lower) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const p = { pc, audio: null, state: 'new', pending: [], gen, rgen: 0, lower, t0: Date.now(), rx: 0, rxAt: 0, flowing: false, needTap: false, diag: false, audible: V.hearSet.has(id), trackStream: null };
  V.peers.set(id, p);
  if (V.stream) V.stream.getTracks().forEach(t => pc.addTrack(t, V.stream)); else pc.addTransceiver('audio', { direction: 'recvonly' });
  const send = data => vApi('/signal', { to: id, data: Object.assign({ g: p.gen, f: p.rgen }, data) }).catch(() => {});
  p.send = send;
  pc.onicecandidate = e => { if (e.candidate) send({ c: e.candidate }); };
  pc.onconnectionstatechange = () => { p.state = pc.connectionState; if (!p.diag && (p.state === 'connected' || p.state === 'failed')) { p.diag = true; voiceDiag(p.state, p); } voiceRender(); };
  pc.ontrack = e => {
    const stream = e.streams[0] || new MediaStream([e.track]);
    p.trackStream = stream;
    if (p.audible) voiceAttach(id, p, stream); // inbound-only peers send us nothing we play; the connection exists so they hear us
  };
  return p;
}
async function voiceStats() {
  for (const [id, p] of V.peers) {
    if (p.pc.connectionState !== 'connected') continue;
    try {
      const st = await p.pc.getStats(); let rx = 0;
      st.forEach(r => { if (r.type === 'inbound-rtp' && (r.kind || r.mediaType) === 'audio') rx += r.bytesReceived || 0; });
      if (rx > p.rx) p.rxAt = Date.now(); p.rx = rx; p.flowing = Date.now() - p.rxAt < 4000 && rx > 0;
    } catch {}
  }
  voiceRender();
}
async function voicePoll() {
  if (!V.on || V.busy) return;
  V.busy = true;
  try { await voicePollInner(); } catch {} finally { V.busy = false; }
}
async function voicePollInner() {
  let r;
  try { r = await vApi(''); } catch (e) { if (e.status === 409) { voiceCleanup(); pushToast(/voice room is full/.test(e.message) ? e.message : 'You left the voice room (connection paused too long). Tap Voice to rejoin.'); } return; }
  V.members = r.members;
  const me = state.account.playerId;
  const hearNew = new Set(r.hear || []), inNew = new Set(r.inbound || []);
  const ids = new Set([...hearNew, ...inNew]); // connect only to voices nearby and to those nearby enough to hear us - not the whole room
  for (const [id, p] of [...V.peers]) { if (!ids.has(id)) { voiceDetach(id); voiceClosePeer(id); } else if (p.audible !== hearNew.has(id)) { p.audible = hearNew.has(id); if (p.audible && p.trackStream) voiceAttach(id, p, p.trackStream); if (!p.audible) { voiceDetach(id); if (p.audio) { p.audio.remove(); p.audio = null; } } } }
  V.hearSet = hearNew; V.inSet = inNew;
  voicePosUpdate(r.pos);
  if (V.travelPending) { voiceRender(); return; } // between cities: view updates are fine, connections wait for this city's ping ack
  // the lower id calls. A stuck or failed call is rebuilt with a newer generation.
  for (const m of r.members) {
    if (m.id === me || me > m.id || !ids.has(m.id)) continue;
    let p = V.peers.get(m.id);
    if (p && (p.pc.connectionState === 'failed' || (p.pc.connectionState !== 'connected' && Date.now() - p.t0 > 15000))) { if (!p.diag) { p.diag = true; voiceDiag('timeout', p); } voiceClosePeer(m.id); p = null; }
    if (!p) {
      p = voicePeer(m.id, Date.now() * 100 + (++voiceGenSeq % 100), true);
      const off = await p.pc.createOffer(); await p.pc.setLocalDescription(off);
      p.send({ d: p.pc.localDescription });
    }
  }
  for (const sg of r.signals) {
    if (!ids.has(sg.from) || !sg.data) continue;
    const g = sg.data.g || 0, f = sg.data.f || 0, lowerIsThem = sg.from < me;
    let p = V.peers.get(sg.from);
    if (lowerIsThem) { // they call us: a newer generation replaces our side, an older one is ignored
      if (p && g < p.rgen) continue;
      if (!p || g > p.rgen) { voiceClosePeer(sg.from); p = voicePeer(sg.from, g, false); p.rgen = g; }
    } else { // we call them: accept only replies to our current call
      if (!p || f !== p.gen) continue;
    }
    try {
      if (sg.data.d) {
        await p.pc.setRemoteDescription(sg.data.d);
        for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
        if (sg.data.d.type === 'offer') { const an = await p.pc.createAnswer(); await p.pc.setLocalDescription(an); p.send({ d: p.pc.localDescription }); }
      } else if (sg.data.c) { if (p.pc.remoteDescription) await p.pc.addIceCandidate(sg.data.c).catch(() => {}); else p.pending.push(sg.data.c); }
    } catch {}
  }
  voiceRender();
}
function voiceTap() { if (V.ac && V.ac.state === 'suspended') V.ac.resume().then(() => voiceRender()).catch(() => {}); for (const p of V.peers.values()) if (p.audio) p.audio.play().then(() => { p.needTap = false; voiceRender(); }).catch(() => {}); }
function voicePeerLabel(p) {
  if (!p) return 'connecting';
  if (p.needTap) return 'connected · tap "Turn on sound"';
  if (p.pc.connectionState === 'failed') return 'could not connect (your networks may block voice)';
  if (p.pc.connectionState === 'disconnected') return 'connection dropped, retrying';
  if (p.pc.connectionState === 'connected') return p.flowing ? 'connected · audio arriving' : 'connected · waiting for audio';
  return 'connecting';
}
function voiceRender() {
  if (!V.on) return;
  $('btn-voice').textContent = V.listenOnly ? 'Voice: listening' : (V.muted ? 'Voice: muted' : 'Voice: LIVE');
  const others = V.members.filter(m => m.id !== state.account.playerId);
  const linked = others.filter(m => V.peers.has(m.id));
  const conn = linked.filter(m => { const p = V.peers.get(m.id); return p && p.pc.connectionState === 'connected'; });
  const flow = conn.filter(m => V.peers.get(m.id).flowing && V.hearSet.has(m.id));
  let msg;
  if (!others.length) msg = 'You are in the room. Waiting for someone else to join.';
  else if (!linked.length) msg = 'No voices near you yet. ' + others.length + (others.length === 1 ? ' person is' : ' people are') + ' in this city\'s voice room.';
  else if (!conn.length) msg = 'Connecting to ' + linked.length + ' nearby ' + (linked.length === 1 ? 'voice' : 'voices') + '. Nobody can hear anyone yet.';
  else msg = 'Connected to ' + conn.length + ' of ' + linked.length + ' nearby. Audio arriving from ' + flow.length + '.' + (others.length > linked.length ? ' ' + others.length + ' total in the room - you hear the nearest.' : '') + (V.listenOnly ? '' : (V.muted ? ' Your mic is muted.' : ' Your mic is sent to connected people.'));
  if ([...V.peers.values()].some(p => p.needTap)) msg += ' Your browser is blocking sound: tap "Turn on sound".';
  $('voice-status').textContent = msg;
  $('voice-tap').hidden = ![...V.peers.values()].some(p => p.needTap);
  $('voice-mute').hidden = V.listenOnly; $('voice-mute').textContent = V.muted ? 'Unmute mic' : 'Mute mic';
  micBtnRender();
  const ul = $('voice-list'); ul.innerHTML = '';
  for (const m of V.members) {
    const li = document.createElement('li'); const me = m.id === state.account.playerId; const p = V.peers.get(m.id);
    li.innerHTML = '<span>' + esc(m.name) + (me ? ' (you)' : '') + (m.listenOnly ? ' · listening' : '') + (!me && V.hearSet.has(m.id) ? ' · nearby' : '') + (!me && V.peers.has(m.id) ? ' · ' + voicePeerLabel(p) : (!me ? ' · in the room' : '')) + '</span>';
    if (!me) {
      const mb = document.createElement('button'); mb.className = 'lk-mini'; mb.textContent = V.blocked.has(m.id) ? 'Unmute' : 'Mute'; mb.setAttribute('aria-label', (V.blocked.has(m.id) ? 'Unmute ' : 'Mute ') + m.name);
      mb.onclick = () => { if (V.blocked.has(m.id)) V.blocked.delete(m.id); else V.blocked.add(m.id); try { localStorage.setItem('lk.voice.blocked', JSON.stringify([...V.blocked])); } catch {} if (p && p.audio) p.audio.muted = V.blocked.has(m.id); const n = V.pan.get(m.id); if (n) n.g.gain.value = V.blocked.has(m.id) ? 0 : 1; voiceRender(); };
      const rb = document.createElement('button'); rb.className = 'lk-mini'; rb.textContent = 'Report'; rb.setAttribute('aria-label', 'Report ' + m.name);
      rb.onclick = async () => { const why = prompt('What happened? (short note, saved for the site owner)'); if (why === null) return; try { await vApi('/report', { target: m.id, reason: why }); V.blocked.add(m.id); if (p && p.audio) p.audio.muted = true; const n = V.pan.get(m.id); if (n) n.g.gain.value = 0; pushToast('Reported and muted ' + m.name); voiceRender(); } catch { pushToast('Could not send report'); } };
      li.appendChild(mb); li.appendChild(rb);
    }
    ul.appendChild(li);
  }
}
window.__voice = V;
/* ---------- Ludo ---------- */
let ludoTimer = null, ludoG = null, ludoBusy = false, ludoRewarded = null;
const LUDO_COL = ['#e0483b', '#2f7bd9'];
const LUDO_START = [0, 26], LUDO_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
function ludoStop() { clearInterval(ludoTimer); ludoTimer = null; }
function ludoOpen() {
  ludoStop(); ludoPoll();
  ludoTimer = setInterval(ludoPoll, 1500);
}
async function ludoCall(path, body) {
  if (!state.account || !state.account.token) { pushToast('Join first to play'); return; }
  if (ludoBusy) return; ludoBusy = true;
  try {
    const r = await api('/players/' + state.account.playerId + '/ludo' + path, body ? { method: 'POST', body: JSON.stringify(body) } : undefined);
    ludoG = r.game; ludoRender();
  } catch (e) { pushToast(String(e.message || e)); await ludoPoll(true); }
  ludoBusy = false;
}
async function ludoPoll(force) {
  if (ludoBusy && !force) return;
  if (!state.account || !state.account.token) { ludoG = null; ludoRender(); return; }
  try { const r = await api('/players/' + state.account.playerId + '/ludo'); if (!ludoG || !r.game || r.game.rev !== ludoG.rev || r.game.status !== ludoG.status || true) { ludoG = r.game; ludoRender(); } } catch {}
}
function ludoWire() {
  $('ludo-find').onclick = () => ludoCall('/new', { mode: 'human' });
  $('ludo-bot').onclick = () => ludoCall('/new', { mode: 'computer' });
  $('ludo-roll').onclick = () => ludoCall('/roll', {});
  $('ludo-leave').onclick = () => { ludoCall('/leave', {}); };
}

const EVENT_KINDS = { 'open-stage': 'Open Stage', 'dance-night': 'Dance Night', 'music-hour': 'Music Hour', 'folk-show': 'Folk Show', 'party-time': 'Party Time' };

/* ---------- Echo Dance ---------- */
let echoTimer = null, echoG = null, echoBusy = false, echoAnimRev = 0, echoPick = [];
const ECHO_MOVES = ['dance', 'party', 'bhangra', 'disco', 'robot', 'spin', 'moonwalk', 'garba'];
const ECHO_LABEL = { dance: 'Dance', party: 'Party', bhangra: 'Bhangra', disco: 'Disco', robot: 'Robot', spin: 'Spin', moonwalk: 'Moonwalk', garba: 'Garba' };
function echoStop() { clearInterval(echoTimer); echoTimer = null; }
function echoOpen() { echoStop(); echoPoll(); echoTimer = setInterval(echoPoll, 1500); }
async function echoCall(path, body) {
  if (!state.account || !state.account.token) { pushToast('Join first to play'); return; }
  if (echoBusy) return; echoBusy = true;
  try {
    const r = await api('/players/' + state.account.playerId + '/echo' + path, body ? { method: 'POST', body: JSON.stringify(body) } : undefined);
    echoG = r.game; echoRender();
  } catch (e) { pushToast(String(e.message || e)); await echoPoll(); }
  finally { echoBusy = false; }
}
async function echoPoll() {
  if (!state.account || !state.account.token) { echoG = null; echoRender(); return; }
  try { const r = await api('/players/' + state.account.playerId + '/echo'); echoG = r.game; echoRender(); } catch {}
}
function echoRender() {
  const g = echoG, menu = $('echo-menu'), game = $('echo-game');
  // mobile watch mode: compact top banner (CSS, <=520px) so the dancing avatar stays visible below
  $('panel-echo').classList.toggle('echo-watch', !!(g && g.status === 'playing' && g.phase === 'watch'));
  menu.hidden = !!g; game.hidden = !g;
  if (!g) { echoAnimRev = 0; echoPick = []; return; }
  const names = g.players.map((p, i) => p ? p.name + (i === g.you ? ' (you)' : '') : 'Waiting…');
  let st;
  if (g.status === 'waiting') st = 'Waiting for another dancer to join… (the computer is available if nobody comes)';
  else if (g.status === 'finished') st = g.forfeit ? (g.winner === g.you ? 'They left - you win!' : 'Game over.') : g.draw ? "A draw - nobody's memory gave in!" : (g.winner === g.you ? 'You remembered best - you win!' : names[g.winner] + ' remembered best.');
  else if (g.phase === 'watch') st = 'Round ' + g.round + ' - watch the ' + g.seqLen + ' moves…';
  else st = 'Round ' + g.round + ' - tap the ' + g.seqLen + ' moves in order' + (g.submitted[g.you] ? ' (submitted - waiting for ' + (names[1 - g.you] || 'the other dancer') + ')' : '') + ' · ' + Math.ceil(g.inputMs / 1000) + 's';
  $('echo-status').textContent = st;
  $('echo-leave').textContent = g.status === 'finished' ? 'Back to menu' : 'Leave game';
  // watch animation: play the served sequence once per round, big in the middle
  const big = $('echo-big');
  if (g.status === 'playing' && g.phase === 'watch' && g.seq && echoAnimRev !== g.rev) {
    echoAnimRev = g.rev; echoPick = [];
    let k = 0; big.textContent = '…';
    const stepIt = () => {
      if (!echoG || echoG.rev !== g.rev || k >= g.seq.length) { if (echoG && echoG.rev === g.rev) big.textContent = ''; return; }
      const mv = g.seq[k++];
      big.textContent = ECHO_LABEL[mv];
      myEmote = mv; myEmoteAt = performance.now(); // local-only avatar dance; not broadcast, auto-clears like a manual emote
      setTimeout(stepIt, 800);
    };
    setTimeout(stepIt, 600);
  }
  if (g.phase !== 'watch' && big.textContent === '…') big.textContent = '';
  // input pad
  const pad = $('echo-pad'); pad.innerHTML = '';
  const canInput = g.status === 'playing' && g.phase === 'input' && !g.submitted[g.you];
  for (const m of ECHO_MOVES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lk-chip'; b.textContent = ECHO_LABEL[m];
    b.disabled = !canInput; b.style.opacity = canInput ? '1' : '.45';
    b.onclick = () => { if (echoG && echoPick.length < echoG.seqLen) { echoPick.push(m); $('echo-picked').textContent = echoPick.map(x => ECHO_LABEL[x]).join(' · '); $('echo-submit').disabled = echoPick.length !== echoG.seqLen; } };
    pad.appendChild(b);
  }
  if (!canInput && g.phase !== 'input') $('echo-picked').textContent = '';
  else if (!canInput) $('echo-picked').textContent = 'Submitted.';
  $('echo-submit').hidden = !canInput; $('echo-clear').hidden = !canInput;
  $('echo-submit').disabled = echoPick.length !== g.seqLen;
  $('echo-log').innerHTML = g.log.slice().reverse().map(l => '<li>' + esc(l) + '</li>').join('');
}
function echoWire() {
  $('echo-find').onclick = () => echoCall('/new', { mode: 'human' });
  $('echo-bot').onclick = () => echoCall('/new', { mode: 'computer' });
  $('echo-leave').onclick = () => { echoCall('/leave', {}); };
  $('echo-clear').onclick = () => { echoPick = []; $('echo-picked').textContent = ''; echoRender(); };
  $('echo-submit').onclick = () => { if (echoG && echoPick.length === echoG.seqLen) { const seq = echoPick.slice(); echoPick = []; echoCall('/submit', { seq }); } };
  $('ludo-toecho').onclick = e => { e.preventDefault(); setPanel('echo'); };
  $('echo-toludo').onclick = e => { e.preventDefault(); setPanel('ludo'); };
}

/* ---------- Freeze Beat ---------- */
let freezeTimer = null, freezeG = null, freezeBusy = false, freezeSeenRound = 0, freezeSeenAt = 0;
let freezeActx = null, freezeBeatIt = null, freezeSound = false;
try { freezeSound = localStorage.getItem('lk_freeze_sound') === '1'; } catch (e) {}
function freezeBeatStop() { clearInterval(freezeBeatIt); freezeBeatIt = null; }
function freezeBeatStart() {
  if (!freezeSound || freezeBeatIt) return;
  try {
    freezeActx = freezeActx || new (window.AudioContext || window.webkitAudioContext)();
    if (freezeActx.state === 'suspended') freezeActx.resume();
    let step = 0;
    freezeBeatIt = setInterval(() => { // original generated kick pattern, no audio assets
      const t = freezeActx.currentTime;
      const o = freezeActx.createOscillator(), gn = freezeActx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(step % 4 === 0 ? 160 : 110, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      gn.gain.setValueAtTime(0.22, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(gn); gn.connect(freezeActx.destination); o.start(t); o.stop(t + 0.16);
      step++;
    }, 240);
  } catch (e) {}
}
function freezeStop() { clearInterval(freezeTimer); freezeTimer = null; freezeBeatStop(); }
function freezeOpen() { freezeStop(); freezePoll(); freezeTimer = setInterval(freezePoll, 500); }
async function freezeCall(path, body) {
  if (!state.account || !state.account.token) { pushToast('Join first to play'); return; }
  if (freezeBusy) return; freezeBusy = true;
  try {
    const r = await api('/players/' + state.account.playerId + '/freeze' + path, body ? { method: 'POST', body: JSON.stringify(body) } : undefined);
    freezeG = r.game; freezeRender();
  } catch (e) { pushToast(String(e.message || e)); await freezePoll(); }
  finally { freezeBusy = false; }
}
async function freezePoll() {
  if (!state.account || !state.account.token) { freezeG = null; freezeRender(); return; }
  try { const r = await api('/players/' + state.account.playerId + '/freeze'); freezeG = r.game; freezeRender(); } catch (e) {}
}
function freezeRender() {
  const g = freezeG, menu = $('freeze-menu'), game = $('freeze-game');
  $('panel-freeze').classList.toggle('freeze-live', !!(g && g.status === 'playing'));
  menu.hidden = !!g; game.hidden = !g;
  if (!g) { freezeSeenRound = 0; freezeBeatStop(); return; }
  const names = g.players.map((p, i) => p ? (p.bot && p.name !== 'Computer' ? p.name + ' (computer)' : p.name) + (i === g.you ? ' (you)' : '') : 'Waiting…');
  let st;
  if (g.status === 'waiting') st = 'Waiting for another dancer… (the computer is available if nobody comes)';
  else if (g.status === 'finished') st = g.forfeit ? (g.winner === g.you ? 'They left - you win!' : 'Game over.') : g.draw ? 'A draw - nobody froze best!' : (g.winner === g.you ? 'You froze fastest - you win!' : names[g.winner] + ' froze fastest.');
  else if (g.phase === 'play') st = 'Round ' + g.round + ' - dance! Freeze the instant the beat stops.' + (g.fouled[g.you] ? ' Too early - this round is lost.' : '');
  else st = 'Round ' + g.round + ' - FREEZE NOW!' + (g.tapped[g.you] ? ' Frozen - waiting…' : '');
  $('freeze-status').textContent = st;
  $('freeze-score').textContent = g.status === 'waiting' ? '' : names.map((n, i) => n + ' ' + '●'.repeat(g.players[i].wins) + '○'.repeat(Math.max(0, g.winTarget - g.players[i].wins))).join('  ·  ');
  $('freeze-leave').textContent = g.status === 'finished' ? 'Back to menu' : 'Leave game';
  const playing = g.status === 'playing' && g.phase === 'play';
  if (playing) freezeBeatStart(); else freezeBeatStop(); // silence is the stop cue's other half
  const big = $('freeze-big');
  if (g.status === 'playing' && g.phase === 'stop') {
    // key on the ROUND, not the rev: the other player's tap bumps rev mid-window
    // and must not restart this device's reaction clock
    if (freezeSeenRound !== g.round) { freezeSeenRound = g.round; freezeSeenAt = performance.now(); myEmote = null; } // reaction measured from the cue on this device; avatar freezes locally
    big.textContent = 'FREEZE!'; big.className = 'freeze-stopcue';
  } else if (g.status === 'playing' && g.phase === 'play') {
    big.textContent = g.fouled[g.you] ? 'Too early!' : 'Dance…'; big.className = 'freeze-playcue';
    if (!g.fouled[g.you]) { myEmote = 'dance'; myEmoteAt = performance.now(); } // local-only avatar dance; not broadcast, auto-clears like a manual emote
  } else { big.textContent = ''; big.className = ''; freezeSeenRound = 0; }
  const tapLive = g.status === 'playing' && (g.phase === 'play' || g.phase === 'stop') && !g.tapped[g.you] && !g.fouled[g.you];
  $('freeze-tap').hidden = g.status !== 'playing'; // end state shows no dead button
  $('freeze-tap').disabled = !tapLive;
  $('freeze-sound').textContent = 'Sound: ' + (freezeSound ? 'on' : 'off');
  $('freeze-log').innerHTML = g.log.slice().reverse().map(l => '<li>' + esc(l) + '</li>').join('');
}

function gamesWire() {
  $('games-ludo').onclick = () => setPanel('ludo');
  $('games-echo').onclick = () => setPanel('echo');
  $('games-freeze').onclick = () => setPanel('freeze');
  $('ludo-togames').onclick = e => { e.preventDefault(); setPanel('games'); };
  $('echo-togames').onclick = e => { e.preventDefault(); setPanel('games'); };
  $('freeze-togames').onclick = e => { e.preventDefault(); setPanel('games'); };
}
function freezeWire() {
  $('freeze-find').onclick = () => freezeCall('/new', { mode: 'human' });
  $('freeze-bot').onclick = () => freezeCall('/new', { mode: 'computer' });
  $('freeze-leave').onclick = () => freezeCall('/leave', {});
  $('freeze-sound').onclick = () => { freezeSound = !freezeSound; try { localStorage.setItem('lk_freeze_sound', freezeSound ? '1' : '0'); } catch (e) {} if (!freezeSound) freezeBeatStop(); freezeRender(); };
  $('freeze-tap').onclick = () => {
    if (!freezeG || freezeG.status !== 'playing') return;
    if (freezeG.phase === 'stop' && freezeSeenAt) { const ms = Math.round(performance.now() - freezeSeenAt); freezeSeenAt = 0; freezeCall('/tap', { reactionMs: ms }); }
    else freezeCall('/tap', {}); // during the music this is a false start and loses the round
  };
  $('freeze-toludo').onclick = e => { e.preventDefault(); setPanel('ludo'); };
  $('freeze-toecho').onclick = e => { e.preventDefault(); setPanel('echo'); };
  $('ludo-tofreeze').onclick = e => { e.preventDefault(); setPanel('freeze'); };
  $('echo-tofreeze').onclick = e => { e.preventDefault(); setPanel('freeze'); };
}
function ludoXY(g, pl, prog, idx) {
  const cx = 150, cy = 150;
  if (prog === -1) { const bx = pl === 0 ? 60 : 240, by = pl === 0 ? 38 : 262; return [bx + (idx % 2) * 22 - 11, by + Math.floor(idx / 2) * 22 - 11]; }
  if (prog === 56) { return [cx + (pl === 0 ? -34 : 34) + (idx - 1.5) * 7, cy + 34]; }
  const ang = a => (a / 52) * Math.PI * 2 - Math.PI / 2;
  if (prog <= 50) { const a = ang((LUDO_START[pl] + prog) % 52); return [cx + 118 * Math.cos(a), cy + 118 * Math.sin(a)]; }
  const a = ang((LUDO_START[pl] + 50) % 52), r = 118 - (prog - 50) * 16; return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function ludoRender() {
  const g = ludoG;
  $('ludo-menu').hidden = !!g; $('ludo-game').hidden = !g;
  if (!g) return;
  const NS = 'http://www.w3.org/2000/svg', svg = $('ludo-board'); svg.innerHTML = '';
  const el = (t, a, parent) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (parent || svg).appendChild(e); return e; };
  el('circle', { cx: 150, cy: 150, r: 128, fill: '#0f3a32', stroke: 'rgba(255,255,255,.2)' });
  for (let i = 0; i < 52; i++) {
    const a = (i / 52) * Math.PI * 2 - Math.PI / 2, safe = LUDO_SAFE.includes(i);
    el('circle', { cx: 150 + 118 * Math.cos(a), cy: 150 + 118 * Math.sin(a), r: safe ? 6 : 4.5, fill: i === 0 ? LUDO_COL[0] : i === 26 ? LUDO_COL[1] : safe ? '#ffd23f' : 'rgba(255,255,255,.25)' });
  }
  for (let pl = 0; pl < 2; pl++) for (let k = 1; k <= 5; k++) { const [x, y] = ludoXY(g, pl, 50 + k, 0); el('circle', { cx: x, cy: y, r: 4.5, fill: LUDO_COL[pl], opacity: .4 }); }
  for (let pl = 0; pl < 2; pl++) { const [bx, by] = ludoXY(g, pl, -1, 0); el('rect', { x: bx - 22, y: by - 22, width: 66, height: 66, rx: 12, fill: LUDO_COL[pl], opacity: .18 }); }
  const names = g.players.map((p, i) => p ? p.name + (i === g.you ? ' (you)' : '') : 'Waiting…');
  g.pieces.forEach((arr, pl) => arr.forEach((prog, idx) => {
    const [x, y] = ludoXY(g, pl, prog, idx);
    const movable = pl === g.you && g.legal.includes(idx);
    const c = el('circle', { cx: x, cy: y, r: movable ? 10 : 8, fill: LUDO_COL[pl], stroke: movable ? '#ffd23f' : '#fff', 'stroke-width': movable ? 3 : 1.5 });
    c.setAttribute('aria-label', (pl === g.you ? 'Your' : 'Their') + ' ' + g.players[pl].color + ' piece ' + (idx + 1) + (prog === -1 ? ', at base' : prog === 56 ? ', home' : ', on the board') + (movable ? ', can move' : ''));
    if (movable) { c.setAttribute('role', 'button'); c.setAttribute('tabindex', '0'); c.style.cursor = 'pointer'; c.setAttribute('class', 'ludo-movable'); const go = () => ludoCall('/move', { piece: idx }); c.addEventListener('click', go); c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); }
  }));
  const T = (x, y, t, fill) => { const e = el('text', { x, y, 'text-anchor': 'middle', fill, 'font-size': 11, 'font-weight': 700 }); e.textContent = t; };
  T(60, 100, names[0].slice(0, 14), '#ffb3ab'); T(240, 200, names[1].slice(0, 14), '#a9cdf5');
  const done = pl => g.pieces[pl].filter(p => p === 56).length;
  T(150, 146, 'Home', '#f3ead2'); T(150, 162, done(0) + ' - ' + done(1), '#ffd23f');
  const mine = g.turn === g.you;
  let st;
  if (g.status === 'waiting') st = 'Waiting for another player to join… (the computer is available if nobody comes)';
  else if (g.status === 'finished') st = g.winner === g.you ? 'You won!' + (g.reward && g.reward.pid ? ' +' + g.reward.points + ' points' : '') : (g.players[g.winner].name + ' won.');
  else st = mine ? (g.phase === 'roll' ? 'Your turn: roll the dice.' : 'Your turn: tap a glowing piece to move it.') : 'Waiting for ' + g.players[g.turn].name + '…';
  $('ludo-status').textContent = st;
  $('ludo-roll').hidden = !(g.status === 'playing' && mine && g.phase === 'roll');
  $('ludo-leave').textContent = g.status === 'finished' ? 'Back to menu' : 'Leave game';
  $('ludo-dice').textContent = g.dice ? (mine ? 'You' : g.players[g.turn].name) + ' rolled ' + g.dice : '';
  $('ludo-log').innerHTML = g.log.slice().reverse().map(l => '<li>' + esc(l) + '</li>').join('');
  if (g.status === 'finished' && g.you >= 0 && ludoRewarded !== g.id) { ludoRewarded = g.id; if (g.reward && g.reward.pid === state.account.playerId) { setPoints(state.points + g.reward.points); chime([523, 659, 784], .4); } }
}
document.addEventListener('DOMContentLoaded', boot);
{ const cl = document.getElementById('credits-link'); if (cl) cl.onclick = e => { e.preventDefault(); setPanel('help'); }; }
window.__lk = { discovery, loadTransit, abortTransit, arriveTransit, pollWorld, setVehicle, get transitSound() { return transitNode ? { kind: transitNode.kind, gain: +transitNode.g.gain.value.toFixed(3), ac: audio() && audio().state } : null; }, /* 150i */ /* 150 */ occDebug: () => ({ xr: occStash.size, hold: +(cam._occX || 0).toFixed(2) }), /* 149 */ voice: V, ping, cam, taxiRoute, taxiDropoff, taxiCurbPoints, taxiGrid, get worldData() { return worldData; }, remotes, beatNow, FLY, splashes, parkSpotClearLand, buildVehicle, scene, camera, parked, enterParked, useParkedButton, loadCity, startTaxi, taxiPlaces, openTaxiPanel, step(dt) { updatePlayer(dt); discovery.tick(); updateRemotes(dt); updateCamera(dt); updateBalls(dt); updateWaves(dt); updateLabels(); } /* 118v 118x */, get remotes() { return remotes; }, state, pickups, cam, get balls() { return balls; }, get waves() { return waves; }, get player() { return player; }, get scene() { return scene; }, get camera() { return camera; }, get world() { return worldData; }, get renderer() { return renderer; }, respawnPickup, get sparks() { return sparks; }, get freeze() { return { g: freezeG, beat: !!freezeBeatIt, sound: freezeSound, actx: freezeActx ? freezeActx.state : null }; } };
