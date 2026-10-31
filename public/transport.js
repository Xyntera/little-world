/* Little World - airports and ferries (original procedural models, no third-party assets). */
import * as THREE from '/vendor/three.module.js';
import { put, box, cyl, sph, cone } from '/world.js';

const glass = { roughness: .35, metalness: 0, emissive: '#7fc4e8', emissiveIntensity: .7 };
const lit = c => ({ emissive: c, emissiveIntensity: .45 });

export function buildPlane(body = '#f4f1e6', accent = '#e8452c') {
  const p = new THREE.Group();
  const fus = put(p, cyl(.9, .9, 9, 12, body), 0, 1.5, 0); fus.rotation.x = Math.PI / 2;
  const nose = put(p, cone(.9, 2, 12, body), 0, 1.5, 5.4); nose.rotation.x = Math.PI / 2;
  const tail = put(p, cone(.9, 2.4, 12, body), 0, 1.7, -5.7); tail.rotation.x = -Math.PI / 2;
  put(p, box(11, .18, 1.9, accent), 0, 1.3, .6);                    // wings
  put(p, box(.3, 2, 1.6, accent), 0, 2.9, -5);                      // fin
  put(p, box(4, .15, 1.1, accent), 0, 1.9, -5.2);                   // tailplane
  for (const s of [-1, 1]) put(p, cyl(.4, .4, 1.5, 8, '#8a9098'), s * 3.2, .9, 1.3).rotation.x = Math.PI / 2;
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) put(p, box(.04, .32, .42, '#2a4a66'), s * .9, 1.85, -3 + i * .75);
  put(p, box(.9, .45, .04, '#2a4a66'), 0, 1.95, 4.4);               // cockpit glass
  for (const x of [-1.2, 1.2]) put(p, cyl(.1, .1, .8, 6, '#2b2b30'), x, .45, .6);
  put(p, cyl(.1, .1, .8, 6, '#2b2b30'), 0, .45, 3.4);
  return p;
}

// airport: terminal + tower + apron + short runway + parked jet. Footprint about 34 x 30, origin at centre.
export function buildAirport() {
  const g = new THREE.Group();
  put(g, box(40, .12, 34, '#6c7078'), 0, .035, .5).castShadow = false;              // apron (top .715: keeps the raised quarter-lane tops (.70) submerged where a lane overruns the airfield - the .65->.66 lane raise had made them exactly coplanar, herringbone stripes on the tarmac)
  put(g, box(36, .14, 7, '#2e3238'), 0, .06, 13).castShadow = false;               // runway strip
  for (let i = -7; i <= 7; i++) put(g, box(1.6, .15, .35, '#f4f1e6'), i * 2.4, .08, 13).castShadow = false;
  put(g, box(18, 4.2, 7, '#f1ede2', lit('#8a8678')), -6, 2.1, -9);                                  // terminal
  put(g, box(19.4, .5, 8.4, '#4a6a8a'), -6, 4.4, -9);                               // roof
  put(g, box(16, 2.2, .2, '#9ed3ee', glass), -6, 2, -5.4);                          // glass wall
  put(g, box(5, .4, 3, '#4a6a8a'), -6, 3.2, -4.3);                                  // canopy over doors
  for (const x of [-12, 0]) put(g, cyl(.15, .15, 3, 6, '#cfd6dc'), x, 1.5, -3);
  put(g, box(2.6, 8, 2.6, '#d9d4c6'), 8, 4, -9);                                    // control tower
  put(g, box(4.2, 1.6, 4.2, '#9ed3ee', glass), 8, 8.7, -9);
  put(g, box(5, .3, 5, '#4a6a8a'), 8, 9.7, -9);
  put(g, cyl(.08, .08, 2, 5, '#cfd6dc'), 8, 10.8, -9); put(g, sph(.2, '#ff4d3d', { emissive: '#ff4d3d', emissiveIntensity: 1 }), 8, 11.9, -9);
  put(g, box(10, 2.4, .35, '#1d5a7a', lit('#1d5a7a')), -6, 5.9, -5.2);                              // sign board
  put(g, box(8.6, 1.4, .1, '#ffd23f', lit('#ffd23f')), -6, 5.9, -5.0);
  put(g, box(1.8, 1.0, .1, '#143b52'), -9.4, 5.9, -4.95);                           // small plane emblem
  put(g, box(.5, .12, 1.4, '#ffd23f'), -9.4, 5.9, -4.9);
  const jet = buildPlane(); jet.position.set(-10, .1, 3); g.add(jet);
  const jet2 = buildPlane('#dde6ee', '#2f7fd1'); jet2.position.set(10, .1, 3); jet2.rotation.y = .12; g.add(jet2);
  for (const x of [-16, -5, 5, 16]) { put(g, cyl(.06, .06, 2.6, 5, '#555'), x, 1.3, 10.4); put(g, sph(.18, '#ffe9a0', { emissive: '#ffd23f', emissiveIntensity: .9 }), x, 2.7, 10.4); }
  return g;
}

export function buildFerry(hull = '#1f4f7a') {
  const g = new THREE.Group();
  put(g, box(5, 1.6, 14, hull), 0, .6, 0);
  put(g, cone(2.5, 3.2, 4, hull), 0, .6, 8.4).rotation.set(Math.PI / 2, Math.PI / 4, 0);
  put(g, box(5.2, .3, 14.2, '#f2f0e6'), 0, 1.5, 0);
  put(g, box(4.2, 1.8, 8, '#f2f0e6'), 0, 2.5, -1);
  put(g, box(4.3, .7, 7.6, '#2a4a66', glass), 0, 2.7, -1);
  put(g, box(3.2, 1.2, 4, '#f2f0e6'), 0, 4.0, -2);
  put(g, box(3.3, .5, 3.6, '#2a4a66', glass), 0, 4.1, -2);
  put(g, cyl(.45, .55, 1.6, 8, '#e8b923'), 0, 5.2, -3.5);
  put(g, box(5.1, .3, .3, '#e8452c'), 0, 1.0, 0);
  return g;
}

// a short stone jetty that carries a ferry berth; returns group facing +x (water side at +x)
export function buildFerryDock() {
  const g = new THREE.Group();
  put(g, box(16, .5, 4.2, '#8a6a46'), 0, 0, 0).castShadow = false;
  for (let k = -3; k <= 3; k++) for (const s of [-1, 1]) put(g, cyl(.2, .2, 1.8, 6, '#5a4630'), k * 2.4, -.6, s * 2.1);
  put(g, box(5, 2.8, 3.2, '#e9e5da'), -4, 1.6, 0);          // ticket hut
  put(g, box(5.6, .3, 3.8, '#2f7fd1'), -4, 3.1, 0);
  put(g, box(3.6, .9, .1, '#143b52'), -4, 2.6, 1.7);
  put(g, box(3.2, .5, .1, '#ffd23f'), -4, 2.6, 1.76);
  return g;
}

// shared footprint helpers (airport-local coordinates, origin at centre, terminal on -z, apron toward +z)
export const AIRPORT_HALF = { x: 20, z: 17 };
export const AIRPORT_COLLIDERS = [[-12, -9, 5], [-6, -9, 5], [0, -9, 5], [8, -9, 2.2],
  ...[-10, 10].flatMap(x => [[x, -.5, 1.7], [x, 2.5, 1.7], [x, 5.5, 1.7], [x, 8.5, 1.7], [x - 3.4, 3.5, 2.1], [x + 3.4, 3.5, 2.1], [x - 5.2, 3.5, 1.2], [x + 5.2, 3.5, 1.2]])];
