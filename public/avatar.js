/* Little Kerala 3D avatar - blocky cartoon figure, customizable, procedural walk cycle. */
import * as THREE from '/vendor/three.module.js';
import { dressAvatar, setRidePose } from '/outfits.js';

const SKIN_TONES = ['#f6d7b8', '#eec39a', '#dfa878', '#c98d5c', '#b0703f', '#8d5327', '#6f3d1c', '#4e2a12'];
const HAIR_COLORS = ['#1b1410', '#3a2a1a', '#6b4a2a', '#8a8a8a'];
const PRESETS = [
  { name: 'Boy', shirt: '#f4f1e6', pants: '#2a6db5' }, { name: 'Girl', shirt: '#e85d75', pants: '#f4f1e6' },
  { name: 'Tourist', shirt: '#3d9be9', pants: '#e8e0c8' }, { name: 'Student', shirt: '#ffffff', pants: '#3b3f8c' },
  { name: 'Farmer', shirt: '#e8d44d', pants: '#7a5a2e' }, { name: 'Office', shirt: '#dfe6ee', pants: '#3a4149' },
  { name: 'Elder', shirt: '#c9c2b0', pants: '#5c5546' }, { name: 'Sporty', shirt: '#35c46f', pants: '#20242c' },
];
const mat = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: .85, metalness: 0 }, opts || {}));
const bx = (w, h, d, color) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.castShadow = true; return m; };

function hairMesh(style, color) {
  const g = new THREE.Group();
  const add = (mesh, x, y, z, ry) => { mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry; g.add(mesh); return mesh; };
  const C = color;
  switch (style) {
    case 1: // Plait
      add(bx(.66, .22, .66, C), 0, .3, 0); add(bx(.18, .9, .18, C), 0, -.35, -.38); break;
    case 2: // Bun
      add(bx(.66, .2, .66, C), 0, .3, 0); { const b = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), mat(C)); b.castShadow = true; add(b, 0, .42, -.3); } break;
    case 3: // Mullappoo (plait + jasmine)
      add(bx(.66, .22, .66, C), 0, .3, 0); add(bx(.18, .8, .18, C), 0, -.3, -.38);
      for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 5), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: .3 })); add(f, 0, .05 - i * .2, -.49); }
      break;
    case 4: // Curly
      for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.21, 7, 6), mat(C)); s.castShadow = true; add(s, Math.cos(i / 7 * 6.3) * .26, .32 + (i % 2) * .1, Math.sin(i / 7 * 6.3) * .26); }
      add(bx(.5, .18, .5, C), 0, .3, 0); break;
    case 5: // Ponytail
      add(bx(.66, .22, .66, C), 0, .3, 0); { const t = bx(.2, .7, .2, C); t.rotation.x = .5; add(t, 0, .05, -.45); } break;
    case 6: // Long
      add(bx(.66, .22, .66, C), 0, .3, 0); add(bx(.6, .75, .18, C), 0, -.15, -.36); break;
    case 7: // Spiky
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(.12, .34, 5), mat(C)); s.castShadow = true; add(s, -.24 + i * .12, .4, 0); }
      add(bx(.62, .16, .62, C), 0, .28, 0); break;
    default: // Short
      add(bx(.66, .22, .66, C), 0, .3, 0); add(bx(.66, .14, .2, C), 0, .22, .3);
  }
  return g;
}

export function buildAvatar(look) {
  const L = Object.assign({ preset: 0, skin: 3, hair: 0, hairColor: 0, outfit: 0, outfitVar: 0 }, look || {});
  const skin = SKIN_TONES[Math.max(0, Math.min(7, +L.skin || 0))];
  const hairC = HAIR_COLORS[Math.max(0, Math.min(3, +L.hairColor || 0))];
  const preset = PRESETS[Math.max(0, Math.min(7, +L.preset || 0))];

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  // legs (pivot at hip y=.78)
  const legL = new THREE.Group(), legR = new THREE.Group();
  const mkLeg = () => { const m = bx(.26, .78, .3, preset.pants); m.position.y = -.39; return m; };
  legL.add(mkLeg()); legR.add(mkLeg());
  const shoeL = bx(.28, .16, .42, '#2c2c34'); shoeL.position.set(0, -.74, .06); legL.add(shoeL);
  const shoeR = shoeL.clone(); legR.add(shoeR);
  legL.position.set(-.17, .78, 0); legR.position.set(.17, .78, 0);
  body.add(legL, legR);

  // torso
  const torso = bx(.72, .72, .42, preset.shirt); torso.position.y = 1.16; body.add(torso);

  // arms (pivot at shoulder y=1.46)
  const armL = new THREE.Group(), armR = new THREE.Group();
  const mkArm = () => { const m = bx(.2, .66, .22, preset.shirt); m.position.y = -.3; const hand = bx(.18, .16, .2, skin); hand.position.y = -.68; const g = new THREE.Group(); g.add(m, hand); return g; };
  armL.add(mkArm()); armR.add(mkArm());
  armL.position.set(-.47, 1.46, 0); armR.position.set(.47, 1.46, 0);
  body.add(armL, armR);

  // head
  const headG = new THREE.Group(); headG.position.y = 1.88;
  const head = bx(.62, .58, .56, skin); headG.add(head);
  const eyeL = bx(.07, .1, .03, '#22180f'); eyeL.position.set(-.13, .03, .29); headG.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = .13; headG.add(eyeR);
  const smile = bx(.16, .045, .03, '#8a4a3a'); smile.position.set(0, -.14, .29); headG.add(smile);
  const hair = hairMesh(+L.hair || 0, hairC); hair.position.y = .05; headG.add(hair);
  body.add(headG);
  dressAvatar({ body, legL, legR, armL, armR, headG, hair }, L);

  // soft blob shadow helper (real shadows also on)
  root.userData = { body, legL, legR, armL, armR, headG, preset, look: L };
  return root;
}


/* ---------- emote and dance poses (original procedural animation, no third-party assets) ---------- */
const sm = x => x * x * (3 - 2 * x);
let beatOff = 0, beatRtt = 1e9;
/* server-derived beat: offset between this device clock and the server clock, from the lowest-latency /api/world samples */
export function syncBeat(serverNow, t0, t1) { const rtt = t1 - t0; if (rtt <= beatRtt * 1.5 + 20) { const o = serverNow + rtt / 2 - t1; beatOff = beatRtt === 1e9 ? o : beatOff + (o - beatOff) * .3; beatRtt = Math.min(rtt, beatRtt * 1.05 + 1); } }
export const beatNow = () => Date.now() + beatOff;
export const MOVES = {
  wave(u, t) { u.armR.rotation.x = -2.7; u.armR.rotation.z = Math.sin(t * 9) * .4; u.armL.rotation.x = .05; u.headG.rotation.z = Math.sin(t * 3) * .05; },
  laugh(u, t) { u.body.position.y = Math.abs(Math.sin(t * 13)) * .05; u.headG.rotation.x = -.3; u.body.rotation.z = Math.sin(t * 22) * .03; u.armL.rotation.x = -.4; u.armR.rotation.x = -.4; },
  clap(u, t) { const k = Math.abs(Math.sin(t * 9)); u.armL.rotation.x = u.armR.rotation.x = -1.35; u.armL.rotation.z = -.05 - k * .5; u.armR.rotation.z = .05 + k * .5; u.body.position.y = Math.abs(Math.sin(t * 9)) * .02; },
  bow(u, t) { const a = .95 * sm(Math.min(1, Math.max(0, Math.sin((t % 4) * .8) * 1.6))); u.body.rotation.x = a; u.body.position.y = .78 * (1 - Math.cos(a)); u.body.position.z = -.78 * Math.sin(a) * 0; u.legL.rotation.x = u.legR.rotation.x = -a; u.armL.rotation.x = u.armR.rotation.x = .2; u.headG.rotation.x = .1; },
  heart(u, t) { u.armL.rotation.x = u.armR.rotation.x = -2.9; u.armL.rotation.z = -.55 - Math.sin(t * 5) * .06; u.armR.rotation.z = .55 + Math.sin(t * 5) * .06; u.body.position.y = Math.abs(Math.sin(t * 5)) * .05; u.headG.rotation.z = Math.sin(t * 2.5) * .12; },
  dance(u, t) { const s = Math.sin(t * 6); u.body.rotation.z = s * .09; u.body.position.y = Math.abs(Math.cos(t * 6)) * .07; u.armL.rotation.x = -2.0 + s * .6; u.armR.rotation.x = -2.0 - s * .6; u.armL.rotation.z = -.3; u.armR.rotation.z = .3; u.legL.rotation.x = s * .45; u.legR.rotation.x = -s * .45; u.headG.rotation.z = s * .1; },
  party(u, t) { const j = Math.abs(Math.sin(t * 7)); u.body.position.y = j * .34; u.armL.rotation.x = u.armR.rotation.x = -2.9 + Math.sin(t * 14) * .25; u.armL.rotation.z = -.35; u.armR.rotation.z = .35; u.legL.rotation.x = -j * .7; u.legR.rotation.x = j * .5; u.headG.rotation.x = -.15; },
  bhangra(u, t) { const s = Math.sin(t * 8), c = Math.cos(t * 8); u.body.position.y = Math.abs(c) * .2; u.body.rotation.z = s * .1; u.armR.rotation.x = -2.8 + s * .35; u.armR.rotation.z = .35; u.armL.rotation.x = -.3 - Math.max(0, -s) * 1.2; u.armL.rotation.z = -.6; u.legL.rotation.x = Math.max(0, s) * -.9; u.legR.rotation.x = Math.max(0, -s) * -.9; u.headG.rotation.z = -s * .18; u.headG.rotation.x = Math.abs(c) * .1; },
  disco(u, t) { const b = Math.floor(t * 2.6) % 2, s = Math.sin(t * 5.2 * Math.PI); u.body.rotation.z = (b ? .1 : -.1); u.body.position.y = Math.abs(s) * .06; if (b) { u.armR.rotation.x = -.3; u.armR.rotation.z = 2.5; u.armL.rotation.x = .1; u.armL.rotation.z = -.15; } else { u.armL.rotation.x = -.3; u.armL.rotation.z = -2.5; u.armR.rotation.x = .1; u.armR.rotation.z = .15; } u.legL.rotation.x = b ? .0 : -.45; u.legR.rotation.x = b ? -.45 : 0; u.headG.rotation.z = b ? .15 : -.15; },
  robot(u, t) { const k = Math.floor(t * 3.2) % 4, q = [[-1.57, 0], [-1.57, -1.57], [0, -1.57], [0, 0]][k]; u.armL.rotation.x = q[0]; u.armR.rotation.x = q[1]; u.armL.rotation.z = -.05; u.armR.rotation.z = .05; u.legL.rotation.x = u.legR.rotation.x = 0; u.headG.rotation.y = [0, .6, 0, -.6][k]; u.body.rotation.y = [0, .25, 0, -.25][k]; u.body.position.y = 0; },
  spin(u, t) { u.body.rotation.y = t * 6.5; u.armL.rotation.x = u.armR.rotation.x = 0; u.armL.rotation.z = -1.45; u.armR.rotation.z = 1.45; u.legL.rotation.x = Math.sin(t * 6.5) * .2; u.legR.rotation.x = -Math.sin(t * 6.5) * .2; u.body.position.y = .03 + Math.abs(Math.sin(t * 3.25)) * .04; },
  moonwalk(u, t) { const s = Math.sin(t * 4.2); u.body.rotation.x = -.12; u.body.position.y = .02; u.legL.rotation.x = s * .55; u.legR.rotation.x = -s * .55; u.armL.rotation.x = -s * .35; u.armR.rotation.x = s * .35; u.armR.rotation.z = .2; u.armL.rotation.z = -.2; u.headG.rotation.x = .1; },
  garba(u, t) { const s = Math.sin(t * 5), c = Math.cos(t * 5); u.body.rotation.y = Math.sin(t * 2.5) * .9; u.armL.rotation.x = -2.5; u.armR.rotation.x = -2.5; u.armL.rotation.z = -.5 + s * .25; u.armR.rotation.z = .5 + s * .25; u.armL.rotation.y = s * .6; u.armR.rotation.y = s * .6; u.body.position.y = Math.abs(c) * .1; u.legL.rotation.x = Math.max(0, s) * -.5; u.legR.rotation.x = Math.max(0, -s) * -.5; u.headG.rotation.z = s * .08; },
  kathak(u, t) { const s = Math.sin(t * 12), s2 = Math.sin(t * 1.5); u.body.rotation.z = Math.sin(t * 6) * .06; u.body.rotation.y = s2 * .5; u.body.position.y = Math.abs(s) * .04; u.armR.rotation.x = -2.9; u.armR.rotation.z = .4; u.armL.rotation.x = -1.5; u.armL.rotation.z = -.25; u.legL.rotation.x = Math.max(0, s) * -.7; u.legR.rotation.x = Math.max(0, -s) * -.7; u.headG.rotation.z = .18; }, // swift footwork, one arm raised, one extended, gentle turn - kathak-inspired
  salsa(u, t) { const s = Math.sin(t * 6); u.body.position.x = s * .12; u.body.rotation.z = s * .08; u.armL.rotation.x = -1.2; u.armL.rotation.z = -.5; u.armR.rotation.x = -1.2; u.armR.rotation.z = .5; u.armL.rotation.y = s * .3; u.armR.rotation.y = s * .3; u.legL.rotation.x = Math.max(0, Math.sin(t * 12)) * -.4; u.legR.rotation.x = Math.max(0, -Math.sin(t * 12)) * -.4; u.headG.rotation.y = Math.sin(t * 3) * .2; }, // partner-frame arms, hip sway, quick side steps
  breakdance(u, t) { const s = Math.sin(t * 7); u.body.rotation.x = .25; u.body.position.y = Math.abs(Math.cos(t * 7)) * .08; u.armL.rotation.x = -1.8 + s * 1.2; u.armR.rotation.x = -1.8 - s * 1.2; u.armL.rotation.z = -.5; u.armR.rotation.z = .5; u.legL.rotation.x = s * .6; u.legR.rotation.x = -s * .6; u.headG.rotation.x = Math.sin(t * 14) * .1; }, // top-rock: forward lean, big opposite arm swings, cross steps
  ballet(u, t) { u.body.rotation.y = t * 2.2; u.body.position.y = .06 + Math.abs(Math.sin(t * 2.2)) * .03; u.armL.rotation.x = -2.7; u.armR.rotation.x = -2.7; u.armL.rotation.z = -.7; u.armR.rotation.z = .7; u.legR.rotation.x = 1.1; u.legL.rotation.x = 0; u.headG.rotation.x = -.1; }, // slow pirouette with arabesque leg and rounded overhead arms
  hula(u, t) { const s = Math.sin(t * 4); u.body.rotation.z = s * .1; u.body.position.x = s * .08; u.armL.rotation.x = -1.6 + s * .5; u.armR.rotation.x = -1.6 - s * .5; u.armL.rotation.z = -.8; u.armR.rotation.z = .8; u.legL.rotation.x = -.12 + Math.max(0, Math.sin(t * 8)) * -.18; u.legR.rotation.x = -.12 + Math.max(0, -Math.sin(t * 8)) * -.18; u.headG.rotation.z = Math.sin(t * 2) * .08; }, // hip sway with alternating arm waves, soft knee bounce
  jump(u, t) { const p = (t * 2.2) % 1, h = Math.sin(p * Math.PI); u.body.position.y = h * .75; u.armL.rotation.x = u.armR.rotation.x = -2.8 * h - .1; u.armL.rotation.z = -.3 * h; u.armR.rotation.z = .3 * h; u.legL.rotation.x = -h * .6; u.legR.rotation.x = h * .35; u.headG.rotation.x = -.2 * h; },
};
MOVES.sit = (u, t) => { u.body.position.y = -.32; u.legL.rotation.x = u.legR.rotation.x = -1.45; u.armL.rotation.x = u.armR.rotation.x = -.25; u.headG.rotation.x = .05; };

export const DANCE_MOVES = ['dance', 'party', 'bhangra', 'disco', 'robot', 'spin', 'moonwalk', 'garba', 'kathak', 'salsa', 'breakdance', 'ballet', 'hula', 'jump'];
function clearMove(u) {
  u.body.rotation.set(0, 0, 0); u.body.position.set(0, u.body.position.y, 0);
  for (const a of [u.armL, u.armR, u.legL, u.legR, u.headG]) a.rotation.set(0, 0, 0);
  u.moved = false;
}

export function animateAvatar(root, dt, moving, speedFactor, swim, emote) {
  const u = root.userData;
  if (emote && MOVES[emote] && !moving && !swim) {
    if (!u.moved || u.moveName !== emote) { clearMove(u); u.et = 0; u.moveName = emote; }
    u.moved = true; u.et = (beatNow() % 600000) / 1000; /* shared wall clock: everyone doing the same move is in step */
    u.body.position.y = 0; u.body.position.z = 0; MOVES[emote](u, u.et);
    return;
  }
  if (u.moved) clearMove(u);
  if (swim) { // surface crawl: body pitched flat, alternating windmill arms, flutter kick, torso roll, head up
    u.t = (u.t || 0) + dt * (moving ? 5.2 : 1.6);
    const t = u.t, bob = Math.sin(t * 1.3) * .04;
    u.body.rotation.x += (1.25 - u.body.rotation.x) * Math.min(1, dt * 8);
    u.body.rotation.z = Math.sin(t) * (moving ? .22 : .06);
    u.body.position.y = .38 + bob;
    u.armL.rotation.x = moving ? t - Math.PI : -2.6 + Math.sin(t) * .25;
    u.armR.rotation.x = moving ? t : -2.6 - Math.sin(t) * .25;
    u.legL.rotation.x = Math.sin(t * 2.6) * (moving ? .4 : .12); u.legR.rotation.x = -Math.sin(t * 2.6) * (moving ? .4 : .12);
    u.headG.rotation.x = -1.0; u.swimming = true;
    return;
  }
  if (u.swimming) { u.swimming = false; u.body.rotation.x = 0; u.body.rotation.z = 0; u.headG.rotation.x = 0; }
  u.t = (u.t || 0) + dt * (moving ? 9 * (speedFactor || 1) : 2);
  const s = Math.sin(u.t), c = Math.cos(u.t);
  // Time-based pose easing: walking starts and stops gently at different frame rates.
  // This changes the visible pose only, never movement speed or collision response.
  // speedFactor >= 1.3 (shift/run touch) reads as a run: deeper lean, wider stride, bigger bounce, arms pulled in.
  // Idle gets slow head wander and a gentle weight sway. Walk (speedFactor 1) numbers are unchanged from r120:
  // from rest state every added term eases 0 -> 0, so the plain-walk pose stream is byte-identical.
  const run = moving && (speedFactor || 1) >= 1.3;
  const ease = 1 - Math.exp(-dt / .08);
  const approach = (part, target) => { part.rotation.x += (target - part.rotation.x) * ease; };
  approach(u.legL, moving ? s * (run ? .95 : .75) : 0); approach(u.legR, moving ? -s * (run ? .95 : .75) : 0);
  approach(u.armL, moving ? -s * (run ? .85 : .65) : Math.sin(u.t) * .05);
  approach(u.armR, moving ? s * (run ? .85 : .65) : -Math.sin(u.t) * .05);
  u.body.position.y += ((moving ? Math.abs(c) * (run ? .1 : .07) : Math.sin(u.t) * .015) - u.body.position.y) * ease;
  u.headG.rotation.x += ((run ? -.12 : 0) - u.headG.rotation.x) * ease;
  u.body.rotation.x += ((run ? .16 : 0) - u.body.rotation.x) * ease;
  u.armL.rotation.z += ((run ? -.12 : 0) - u.armL.rotation.z) * ease;
  u.armR.rotation.z += ((run ? .12 : 0) - u.armR.rotation.z) * ease;
  u.headG.rotation.y += ((moving ? 0 : Math.sin(u.t * .47) * .3 + Math.sin(u.t * .19) * .15) - u.headG.rotation.y) * ease;
  u.body.rotation.z += ((moving ? (run ? s * .05 : 0) : Math.sin(u.t * .5) * .02) - u.body.rotation.z) * ease;
}

// Riding pose for the visible-vehicle kinds (scooter, sport bike, bicycle): riders used to stand
// bolt-upright in the idle pose on a moving vehicle. Fixed pose per kind; bicycle pedals by distance
// travelled (phase passed in), so the legs stop when the wheels stop. Boats are excluded on purpose:
// standing on a small open skiff reads naturally. Applied after animateAvatar each frame (syncVehicle),
// so mount snaps with the vehicle spawn and dismount eases back through animateAvatar's own easing.
export function ridePose(root, kind, phase) {
  const u = root.userData;
  if (kind === 'bicycle') {
    const s = Math.sin(phase);
    u.legL.rotation.x = -.45 + s * .75; u.legR.rotation.x = -.45 - s * .75;
    u.armL.rotation.x = u.armR.rotation.x = -1.05;
    u.body.rotation.x = .28; u.headG.rotation.x = -.16;
  } else if (kind === 'bike') { // sport bike: forward tuck
    u.legL.rotation.x = u.legR.rotation.x = -1.05;
    u.armL.rotation.x = u.armR.rotation.x = -1.15;
    u.body.rotation.x = .5; u.headG.rotation.x = -.3;
  } else if (kind === 'scooter') { // braced stance, hands to the bar
    u.legL.rotation.x = u.legR.rotation.x = -.55;
    u.armL.rotation.x = u.armR.rotation.x = -.95;
    u.body.rotation.x = .12; u.headG.rotation.x = -.08;
  }
}

export function setAvatarLook(root, look) {
  const parent = root.parent;
  const pos = root.position.clone(), rot = root.rotation.y;
  const fresh = buildAvatar(look);
  fresh.position.copy(pos); fresh.rotation.y = rot;
  if (parent) { parent.remove(root); parent.add(fresh); }
  return fresh;
}

export { setRidePose };
export { SKIN_TONES, HAIR_COLORS, PRESETS };
