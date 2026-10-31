/* Little Kerala 3D world - original procedural build, low-poly cartoon style.
   A miniature Kerala: sea to the west, land strip, eastern hills, 14 district
   zones north->south, each with a signature landmark, signboard and greenery. */
import * as THREE from '/vendor/three.module.js';
import { mergeStatic } from '/merge.js';
import { buildAirport, buildFerry, buildFerryDock, AIRPORT_HALF, AIRPORT_COLLIDERS } from '/transport.js';

export const DISTRICTS = [
  ['kasaragod', 'Kasaragod', 'കാസർഗോഡ്'], ['kannur', 'Kannur', 'കണ്ണൂർ'],
  ['wayanad', 'Wayanad', 'വയനാട്'], ['kozhikode', 'Kozhikode', 'കോഴിക്കോട്'],
  ['malappuram', 'Malappuram', 'മലപ്പുറം'], ['palakkad', 'Palakkad', 'പാലക്കാട്'],
  ['thrissur', 'Thrissur', 'തൃശ്ശൂർ'], ['ernakulam', 'Ernakulam', 'എറണാകുളം'],
  ['idukki', 'Idukki', 'ഇടുക്കി'], ['kottayam', 'Kottayam', 'കോട്ടയം'],
  ['alappuzha', 'Alappuzha', 'ആലപ്പുഴ'], ['pathanamthitta', 'Pathanamthitta', 'പത്തനംതിട്ട'],
  ['kollam', 'Kollam', 'കൊല്ലം'], ['thiruvananthapuram', 'Thiruvananthapuram', 'തിരുവനന്തപുരം'],
];

export const WORLD = {
  zoneH: 64,
  north: -448,            // z of northern edge
  get south() { return this.north + DISTRICTS.length * this.zoneH; },
  shoreX: -52,            // waterline
  eastX: 105,             // hills begin beyond
};
export const districtZone = i => ({ z0: WORLD.north + i * WORLD.zoneH, z1: WORLD.north + (i + 1) * WORLD.zoneH, zc: WORLD.north + i * WORLD.zoneH + WORLD.zoneH / 2 });

/* ---------- tilted shoreline (real-geography anchor: the Kerala coast runs NW->SE; sourced coastal-city longitudes drift
   eastward from Kasaragod 75.00 E to Thiruvananthapuram 76.94 E - see dev/HK-SOURCES.md Update 80). TILT_DX is a compressed
   arrangement (true-scale drift would be ~436 units, wider than the world), NOT to scale, NOT surveyed. WORLD.shoreX stays
   the mid-map (z=0) waterline value; shoreXAt(z) is the waterline at world z. ---------- */
export const TILT_DX = 40; // endpoint-to-endpoint drift (Kasaragod->Thiruvananthapuram), kept as the overall compression constant
// Update 87: the waterline is no longer one straight tilted line - it is a piecewise-linear curve through sourced coastal
// waypoints (town coordinates per marine district, MediaWiki API fetch-verified; ledger Update 87), mapped through the same
// compressed lat/lon->world transform as Update 80 (z: 12.5N->-448 .. 8.524N->448; x: 75.00E->-72 .. 76.94E->-32). Monotone
// eastward, max +-4u departure from the old straight line. Town coords sit near (not exactly on) the waterline; still NOT
// a surveyed shoreline. [z, x] north->south:
export const SHORE_PTS = [
  [-448, -72],        // Kasaragod 12.5N 75.00E (Update 80)
  [-307.04, -64.36],  // Kannur 11.8745N 75.3704E
  [-166.06, -55.84],  // Kozhikode 11.2489N 75.7839E
  [-61.90, -53.22],   // Ponnani 10.7867N 75.9108E (Update 86 source)
  [-4.06, -50.35],    // Chavakkad (Thrissur coast) 10.53N 76.05E
  [130.89, -45.87],   // Kochi (Ernakulam coast) 9.9312N 76.2673E - shapes the coast only; the mouth stays band-anchored (Update 84)
  [230.31, -44.58],   // Alappuzha 9.49N 76.33E
  [364.80, -38.72],   // Kollam 8.8932N 76.6141E
  [448, -32],         // Thiruvananthapuram 8.524N 76.94E (Update 80)
];
export const shoreXAt = z => {
  if (z <= SHORE_PTS[0][0]) return SHORE_PTS[0][1];
  for (let i = 1; i < SHORE_PTS.length; i++) { const [z1, x1] = SHORE_PTS[i], [z0, x0] = SHORE_PTS[i - 1];
    if (z <= z1) return x0 + (x1 - x0) * (z - z0) / (z1 - z0); }
  return SHORE_PTS[SHORE_PTS.length - 1][1];
};
// Extruded shore-parallel strip: land-thickness band between shore-relative +wA..+wB, sampled at the given z stations
// (same shape-space y=-z convention as the land slab). Replaces the rotated boxes that assumed a constant tilt.
const shoreStrip = (zs, wA, wB, color, yTop, thick, opts) => {
  const sh = new THREE.Shape();
  zs.forEach((z, k) => { const x = shoreXAt(z) + wA; k ? sh.lineTo(x, -z) : sh.moveTo(x, -z); });
  for (let k = zs.length - 1; k >= 0; k--) sh.lineTo(shoreXAt(zs[k]) + wB, -zs[k]);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, M(color, opts));
  m.position.y = yTop - thick; m.receiveShadow = true; m.castShadow = false;
  return m;
};
export const shoreAngleAt = z => { // Update 88: LOCAL shoreline angle of the segment containing z (shore-parallel props must follow the local bend, not the endpoint average)
  for (let i = 1; i < SHORE_PTS.length; i++) { const [z1, x1] = SHORE_PTS[i], [z0, x0] = SHORE_PTS[i - 1];
    if (z <= z1) return Math.atan2(x1 - x0, z1 - z0); }
  const [z1, x1] = SHORE_PTS[SHORE_PTS.length - 1], [z0, x0] = SHORE_PTS[SHORE_PTS.length - 2];
  return Math.atan2(x1 - x0, z1 - z0);
};
const WP_ZS = SHORE_PTS.map(p => p[0]); // all waypoint stations

/* ---------- inland water (real-geography anchors, sourced fact-level: dev/HK-SOURCES.md Update 79) ----------
   Vembanad: largest lake in Kerala, spans the Alappuzha/Kottayam districts -> basin at those zones, behind the barrier beach.
   Periyar (longest, 244 km), Bharathappuzha/Nila (second, 209 km, Palakkad+Malappuram, sea at Ponnani) and Pamba
   (third, 176 km, Pathanamthitta+Alappuzha, into Vembanad) -> east-to-sea/bank bands at those zones (Update 86).
   Primitive rectangles, gameplay arrangement at real-relative positions, NOT surveyed shorelines; no dataset derivation. */
export const LAKE = { z0: 40, z1: 256, w0: 10, w1: 26 }; // Vembanad: ernakulam-mouth to alappuzha south; shore-relative: barrier island 0..10, lake 10..26 east of shoreXAt(z)
export const MOUTH = { z0: 40, z1: 50 }; // Kochi backwater mouth (Update 84): the barrier is broken here - sea meets the lake at ernakulam's latitude
// Three named rivers, each as the same flat axis-aligned band idiom (wadeable read, no colliders; the x=34 road passes
// over the bends - bridge read). Primitive rectangles at sourced RELATIVE courses, NOT surveyed channels.
export const RIVER = [
  // Periyar (Update 79/84): longest river in Kerala (244 km), Sivagiri hills (Idukki) -> Ernakulam -> Vembanad backwaters.
  { x0: 44, x1: 104, z0: 90, z1: 98 }, // idukki arm
  { x0: 36, x1: 52, z0: 38, z1: 98 }, // bend
  { x0: shoreXAt(42) + LAKE.w1 + .5, x1: 44, z0: 38, z1: 46 }, // ernakulam arm ends at the lake's east bank (Periyar joins the backwaters), not the open sea
  // Bharathappuzha / Nila (Update 86): second-longest (209 km), westward through the Palakkad Gap across Palakkad and
  // Malappuram districts, empties into the Arabian Sea at Ponnani (south Malappuram coast) - this river DOES reach the sea.
  { x0: 44, x1: 104, z0: -76, z1: -68 }, // palakkad arm (south of the fort, clear of its moat)
  { x0: 36, x1: 52, z0: -148, z1: -68 }, // bend
  { x0: shoreXAt(-144), x1: 52, z0: -148, z1: -140 }, // malappuram arm meets the waterline at Ponnani's latitude (mid-span waterline; <=.4 overhang/gap at the ends, Update-84 bank idiom)
  // Pamba (Update 86): third-longest (176 km), Pulachimalai (Peerumedu plateau, Idukki ghats) -> Pathanamthitta ->
  // Alappuzha (Kuttanad), empties into Vembanad (main branch at Kainakary).
  { x0: 44, x1: 104, z0: 266, z1: 274 }, // pathanamthitta arm (north of the paddy landmark)
  { x0: 36, x1: 52, z0: 232, z1: 274 }, // bend
  { x0: shoreXAt(236) + LAKE.w1 + .5, x1: 52, z0: 232, z1: 240 }, // alappuzha arm ends at the lake's east bank (Kainakary idiom; mid-span bank, <=.5 end slack as Update 84)
];

/* Update 107: REAL course shapes for two more rivers, from OpenStreetMap waypoints (fetch-verified; dev/HK-SOURCES.md
   Update 107; ODbL attribution obligation recorded there - public-rollout licence review hold rides Update 83/86).
   Chaliyar (fourth-longest, 169 km, Wikipedia): Nilambur ghats -> through Malappuram -> forms the 17 km
   Malappuram-Kozhikode boundary -> last 10 km Kozhikode city -> sea at Beypore (11.1616N 75.8030E, mouth verified);
   this river DOES reach the sea - west end meets the waterline at shoreXAt(-196).
   Achankovil (128 km, Wikipedia): Devarmala/Konni ghats reach -> Pathanamthitta -> Kuttanad, joins the Pamba at
   Veeyapuram (9.3167N 76.4667E) - it does NOT reach the sea; west end joins the Pamba bend at (52,236) like the
   real confluence upstream of the Pamba's Vembanad entry.
   Waypoints [x,z] upstream->downstream, drawn as the Update-90 Klang/Gombak idiom (rotated flat boxes, width 8,
   wadeable, no colliders, the road passes over = bridge read). Course shape is the OSM polyline decimated
   (Douglas-Peucker 1.2u in game space; meanders below ~1.2u are sub-width and not representable), then each axis
   normalized independently into this schematic frame (Update-80 compressed-transform convention; the district
   bands are equal-height gameplay bands, NOT latitude-true) - real relative course shape at band-anchored
   endpoints, NOT survey scale. */
export const RIVER_CURVES = [
  { name: 'Chaliyar', w: 8, pts: [[86.45, -136.0],[92.08, -136.97],[91.86, -143.35],[95.45, -146.35],[94.75, -148.32],[97.51, -149.33],[96.55, -151.84],[101.03, -152.34],[97.07, -154.79],[101.89, -157.53],[99.57, -159.86],[102.64, -159.93],[101.63, -161.94],[103.86, -166.87],[95.04, -169.79],[96.13, -171.71],[91.34, -175.4],[86.81, -174.56],[87.48, -176.37],[67.5, -183.96],[64.09, -182.62],[65.25, -184.21],[61.68, -184.61],[61.59, -186.1],[53.8, -184.88],[45.53, -186.98],[32.4, -185.48],[29.61, -182.46],[25.15, -183.03],[23.75, -181.46],[17.58, -183.1],[9.34, -182.07],[10.0, -179.97],[2.79, -177.55],[-17.92, -183.11],[-23.55, -182.05],[-24.13, -183.82],[-35.91, -188.36],[-44.32, -188.32],[-46.54, -192.35],[-57.64, -196.0]] },
  { name: 'Achankovil', w: 8, pts: [[103.98, 303.0],[100.32, 320.9],[99.7, 318.34],[98.73, 321.16],[97.26, 316.69],[96.21, 319.51],[94.11, 312.8],[92.7, 318.35],[91.81, 317.36],[91.38, 324.63],[91.07, 320.07],[90.52, 322.28],[85.3, 310.16],[84.96, 311.57],[74.83, 263.14],[72.9, 277.71],[70.55, 273.05],[68.69, 279.64],[64.7, 271.63],[63.59, 274.96],[63.14, 270.82],[62.2, 278.18],[59.43, 260.29],[59.14, 261.95],[57.99, 259.1],[57.0, 265.64],[55.68, 260.38],[53.6, 261.93],[52.01, 236.2]] },
];
const LAKE_ZS = [LAKE.z0, 130.89, 230.31, LAKE.z1]; // stations inside the Vembanad span (Kochi + Alappuzha bends, Update 87)
const inRect = (x, z, r, m) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
const inLake = (x, z, m) => { const rel = x - shoreXAt(z), q = m || 0;
  return (rel > LAKE.w0 - q && rel < LAKE.w1 + q && z > LAKE.z0 - q && z < LAKE.z1 + q) // the basin east of the barrier island
    || (rel > -q && rel < LAKE.w1 + q && z > MOUTH.z0 - q && z < MOUTH.z1 + q); }; // the mouth channel, full width
const inRiver = (x, z, m) => RIVER.some(r => inRect(x, z, r, m || 0)) || RIVER_CURVES.some(c => { // curve bands: segment-distance like the Update-90 city rivers
  const h = c.w / 2 + (m || 0), p = c.pts;
  for (let i = 1; i < p.length; i++) { const [x0, z0] = p[i - 1], [x1, z1] = p[i];
    const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz;
    let t = L2 ? ((x - x0) * dx + (z - z0) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
    if (Math.hypot(x - (x0 + t * dx), z - (z0 + t * dz)) < h) return true; }
  return false; });
const inWater = (x, z, m) => inLake(x, z, m) || inRiver(x, z, m);

const M = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: .9, metalness: 0 }, opts || {}));
const box = (w, h, d, color, opts) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color, opts));
const flatQuad = (corners, color) => { // flush ground-tint quad from [[x,z] NW,NE,SE,SW]; same shape-space y=-z convention as the land slab
  const sh = new THREE.Shape();
  corners.forEach(([x, z], k) => (k ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
  sh.closePath();
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, M(color));
};
const cyl = (rt, rb, h, seg, color, opts) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(color, opts));
const sph = (r, color, opts, ws, hs) => new THREE.Mesh(new THREE.SphereGeometry(r, ws || 10, hs || 8), M(color, opts));
const sphLo = (r, color, opts) => sph(r, color, opts, 6, 5); // tiny/distant decoration spheres: 48 tris vs 140
const cone = (r, h, seg, color, opts) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), M(color, opts));
const put = (parent, mesh, x, y, z, ry) => { mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------- text board (canvas texture) ---------- */
function textBoard(lines, w, h, bg, fg, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 10; g.strokeRect(8, 8, c.width - 16, c.height - 16);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const big = lines[0], small = lines[1];
  g.font = 'bold 92px Georgia, serif';
  g.fillText(big, c.width / 2, small ? c.height * .38 : c.height / 2, c.width - 60);
  if (small) { g.font = 'bold 64px system-ui, sans-serif'; g.fillStyle = sub || '#ffd98a'; g.fillText(small, c.width / 2, c.height * .74, c.width - 60); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, .3), new THREE.MeshStandardMaterial({ map: tex, roughness: .85 }));
}

function signboard(parent, en, ml, x, z, ry) {
  const grp = new THREE.Group();
  put(grp, cyl(.14, .17, 4.4, 6, '#7a5230'), -3.6, 2.2, 0);
  put(grp, cyl(.14, .17, 4.4, 6, '#7a5230'), 3.6, 2.2, 0);
  put(grp, textBoard([ml, en], 8.6, 3.2, '#123f37', '#ffe9a8', '#ffffff'), 0, 4.6, 0);
  grp.position.set(x, 0, z); grp.rotation.y = ry || 0;
  parent.add(grp); return grp;
}

/* ---------- vegetation ---------- */
function palm(scale) {
  const g = new THREE.Group();
  let x = 0, y = 0;
  const lean = rnd(-.16, .16), seg = 5;
  for (let i = 0; i < seg; i++) {
    const t = cyl(.16 - i * .012, .2 - i * .012, 1.5, 6, '#8a6844');
    t.position.set(x, y + .75, 0); t.rotation.z = lean * i * .5; g.add(t);
    x += Math.sin(lean * i * .5) * 1.4; y += Math.cos(lean * i * .5) * 1.42;
  }
  const top = new THREE.Group(); top.position.set(x, y + .2, 0);
  for (let i = 0; i < 7; i++) {
    const fr = new THREE.Mesh(new THREE.ConeGeometry(.5, 3.6, 4), M('#2f9e4f', { roughness: .8 }));
    fr.geometry.translate(0, 1.5, 0);
    fr.rotation.set(Math.PI / 2 + rnd(-.5, -.1), 0, (i / 7) * Math.PI * 2);
    fr.rotation.order = 'ZYX'; fr.rotation.z = (i / 7) * Math.PI * 2; fr.rotation.x = rnd(.9, 1.35);
    top.add(fr);
  }
  for (let i = 0; i < 3; i++) put(top, sphLo(.22, '#6b4a26'), rnd(-.3, .3), -.25, rnd(-.3, .3));
  g.add(top); g.scale.setScalar(scale || 1);
  return g;
}
function leafyTree(scale, cTop) {
  const g = new THREE.Group();
  put(g, cyl(.22, .3, 2.2, 6, '#7a5230'), 0, 1.1, 0);
  put(g, sph(1.7, cTop || '#2f8f46', undefined, 8, 6), 0, 3.1, 0).scale.y = .85;
  put(g, sph(1.1, cTop || '#2f8f46', undefined, 8, 6), 1.1, 2.5, .5);
  put(g, sph(.9, cTop || '#2f8f46', undefined, 8, 6), -1, 2.6, -.4);
  g.scale.setScalar(scale || 1); return g;
}
function bush(color) { const g = new THREE.Group(); const r1 = rnd(.5, .8), r2 = rnd(.3, .5); const a = put(g, sphLo(1, color || '#3aa655'), 0, .45, 0); a.scale.setScalar(r1); const b2 = put(g, sphLo(1, color || '#3aa655'), .5, .3, .2); b2.scale.setScalar(r2); return g; } // unit spheres + scale so instanced bushes can share geometry; same rnd order, same world-space result
function flowerPatch() {
  const g = new THREE.Group();
  const cols = ['#ff7d9c', '#ffffff', '#ffd23f', '#ff9d5c'];
  for (let i = 0; i < 4; i++) { put(g, cyl(.03, .03, .5, 4, '#3a8c46'), rnd(-.4, .4), .25, rnd(-.4, .4)); put(g, sphLo(.12, cols[i % 4], { emissive: cols[i % 4], emissiveIntensity: .25 }), rnd(-.4, .4), .55, rnd(-.4, .4)); }
  return g;
}
function hayHut() {
  const g = new THREE.Group();
  put(g, cyl(1.5, 1.7, 1.6, 8, '#c9a24b'), 0, .8, 0);
  put(g, cone(2.1, 1.7, 8, '#b08a35'), 0, 2.35, 0);
  return g;
}
function cow() {
  const g = new THREE.Group(); const white = '#f4efe4';
  put(g, box(1.9, 1, .9, white), 0, 1.15, 0);
  put(g, box(.6, .6, .55, white), 1.2, 1.5, 0);
  put(g, box(.15, .15, .05, '#2c2c2c'), 1.51, 1.55, .15); put(g, box(.15, .15, .05, '#2c2c2c'), 1.51, 1.55, -.15);
  [[-.7, .3], [-.7, -.3], [.7, .3], [.7, -.3]].forEach(p => put(g, cyl(.09, .09, .8, 5, white), p[0], .4, p[1]));
  put(g, cone(.1, .4, 4, '#d9c9a8'), 1.25, 1.9, .25); put(g, cone(.1, .4, 4, '#d9c9a8'), 1.25, 1.9, -.25);
  return g;
}
function bench() {
  const g = new THREE.Group();
  put(g, box(2.2, .18, .7, '#e8853d'), 0, .75, 0);
  put(g, box(2.2, .8, .16, '#e8853d'), 0, 1.25, -.33);
  [[-.9, .25], [.9, .25], [-.9, -.25], [.9, -.25]].forEach(p => put(g, box(.12, .75, .12, '#3b3f46'), p[0], .37, p[1]));
  return g;
}
function chayakada() {
  const g = new THREE.Group();
  put(g, box(4.4, 2.2, 3, '#f2e6c8'), 0, 1.1, 0);
  put(g, box(4.8, .3, 3.6, '#c9563c'), 0, 2.35, 0).rotation.z = .06;
  put(g, box(1.4, 1.4, .1, '#5b3a24'), 0, .9, 1.51);
  put(g, textBoard(['ചായക്കട', 'Chayakada'], 3.6, 1.1, '#123f37', '#ffe9a8'), 0, 3.1, 1.2);
  put(g, box(2.6, .8, .8, '#8a6844'), 1.2, .4, 1.9);
  return g;
}
function autoRickshaw(color) {
  const g = new THREE.Group(); const c = color || '#f2c230';
  put(g, box(1.5, .9, 2.6, c), 0, .95, 0);
  put(g, box(1.5, .55, 1.5, '#22262b'), 0, 1.65, -.4);
  put(g, box(1.3, .5, .6, '#2c6e49'), 0, 1.15, 1.05);
  put(g, cyl(.34, .34, .2, 10, '#22262b').rotateZ(Math.PI / 2), 0, .34, 1.35);
  put(g, cyl(.34, .34, .2, 10, '#22262b').rotateZ(Math.PI / 2).rotateY(Math.PI / 2), -.62, .34, -.7);
  put(g, cyl(.34, .34, .2, 10, '#22262b').rotateZ(Math.PI / 2).rotateY(Math.PI / 2), .62, .34, -.7);
  return g;
}
function motorbike() {
  const g = new THREE.Group();
  put(g, cyl(.42, .42, .18, 12, '#22262b').rotateX(Math.PI / 2).rotateY(Math.PI / 2), 0, .42, 1);
  put(g, cyl(.42, .42, .18, 12, '#22262b').rotateX(Math.PI / 2).rotateY(Math.PI / 2), 0, .42, -1);
  put(g, box(.4, .4, 1.2, '#c23b2e'), 0, .85, .1);
  put(g, box(.38, .2, .8, '#2c2c34'), 0, 1, -.55);
  put(g, cyl(.05, .05, 1.1, 5, '#9aa2ab').rotateX(.4), 0, 1, .85);
  return g;
}
function jeep(color) {
  const g = new THREE.Group(); const c = color || '#3f7d4e';
  put(g, box(1.9, .9, 3.6, c), 0, .95, 0);
  put(g, box(1.8, .7, 1.8, c), 0, 1.7, -.4);
  put(g, box(1.7, .6, .1, '#bcd8e8'), 0, 1.6, .65);
  [[-.8, 1.2], [.8, 1.2], [-.8, -1.2], [.8, -1.2]].forEach(p => put(g, cyl(.42, .42, .3, 10, '#22262b').rotateZ(Math.PI / 2), p[0], .42, p[1]));
  return g;
}
function elephantStatue() {
  const g = new THREE.Group(); const gr = '#8f9aa3';
  put(g, box(2.6, 1.7, 1.5, gr), 0, 1.7, 0);
  put(g, box(1, 1, 1, gr), 1.7, 2, 0);
  put(g, cyl(.22, .3, 1.4, 6, gr).rotateX(.5), 2.25, 1.2, 0);
  put(g, box(.1, .8, .5, '#c9a24b'), 1.7, 2.6, 0);
  [[-.9, .5], [-.9, -.5], [.9, .5], [.9, -.5]].forEach(p => put(g, cyl(.28, .32, 1.1, 7, gr), p[0], .55, p[1]));
  return g;
}

/* ---------- landmarks (one per district) ---------- */
const LANDMARK_BUILDERS = {
  'bekal-fort'(g) { // Kasaragod: round laterite fort by the sea
    put(g, cyl(9, 10, 4.5, 18, '#a5502e'), 0, 2.25, 0);
    put(g, cyl(9.4, 9.4, .9, 18, '#8f4426'), 0, 4.95, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(g, cyl(1.6, 1.9, 5.6, 8, '#a5502e'), Math.cos(a) * 9.4, 2.8, Math.sin(a) * 9.4); }
    put(g, cyl(2.2, 2.5, 7.5, 8, '#b45a34'), 0, 3.7, 0);
    put(g, cyl(.08, .08, 3.4, 4, '#6b4a26'), 0, 9.2, 0); put(g, box(1.6, 1, .06, '#e8452c'), .85, 10.2, 0);
    return { r: 11.5 };
  },
  'st-angelo'(g) { // Kannur: red fort walls
    put(g, box(14, 4, 10, '#a5502e'), 0, 2, 0);
    put(g, box(14.8, 1, 10.8, '#8f4426'), 0, 4.4, 0);
    [[-6.4, -4.4], [6.4, -4.4], [-6.4, 4.4], [6.4, 4.4]].forEach(p => put(g, cyl(1.7, 2, 5.4, 8, '#a5502e'), p[0], 2.7, p[1]));
    put(g, box(3, 3.2, 1, '#6e3418'), 0, 1.6, 5.05);
    return { r: 9.5 };
  },
  'banasura'(g) { // Wayanad: reservoir with islands
    put(g, cyl(12, 12, .5, 20, '#3f8fbf', { roughness: .3 }), 0, .1, 0);
    put(g, cone(4.5, 5, 9, '#4c9a54'), -4, 2.4, -3); put(g, cone(3, 3.6, 8, '#57a85e'), 4.5, 1.7, 2); put(g, cone(2.2, 2.6, 7, '#4c9a54'), 1, 1.2, -5);
    put(g, cyl(1.2, 1.2, 1.4, 8, '#c9b58a'), 9, .7, 6);
    return { r: 13 };
  },
  'pier'(g) { // Kozhikode: old pier pillars into the sea
    for (let i = 0; i < 6; i++) { put(g, cyl(.4, .45, 3.2, 7, '#8a8378'), -1.2, 1, -i * 3.2); put(g, cyl(.4, .45, 3.2, 7, '#8a8378'), 1.2, 1, -i * 3.2); }
    put(g, box(3.6, .4, 8, '#a89f90'), 0, 2.4, -2);
    const boat = new THREE.Group(); put(boat, box(1.4, .7, 4.2, '#c9563c'), 0, .4, 0); put(boat, box(1, .5, 1.2, '#f2e6c8'), 0, .9, -.6); boat.position.set(5, .3, -6); g.add(boat);
    return { r: 6 };
  },
  'kottakkunnu'(g) { // Malappuram: hill park with stage
    put(g, cyl(10, 13, 3.4, 14, '#54a05c'), 0, 1.7, 0);
    put(g, box(6, .7, 4, '#d9b06a'), 0, 3.75, -1);
    put(g, box(6.4, .5, .8, '#b06a3d'), 0, 4.2, -2.8);
    for (let i = 0; i < 3; i++) put(g, box(5 - i, .4, .8, '#e8853d'), 0, 4 + i * .5, .5 + i * .9);
    put(g, textBoard(['കോട്ടക്കുന്ന്', 'Kottakkunnu'], 5.4, 1.6, '#123f37', '#ffe9a8'), 0, 5.6, -2.9);
    return { r: 13.5 };
  },
  'palakkad-fort'(g) {
    put(g, box(13, 3.6, 13, '#9c8d7a'), 0, 1.8, 0);
    put(g, box(13.8, .9, 13.8, '#857664'), 0, 4, 0);
    put(g, cyl(13.2, 13.2, .35, 4, '#3f8fbf', { roughness: .35 }), 0, .18, 0).rotation.y = Math.PI / 4;
    put(g, box(2.6, 2.6, 1, '#5f5344'), 0, 1.3, 6.55);
    return { r: 10 };
  },
  'thrissur-round'(g) { // circular maidan + temple roofs
    put(g, cyl(11, 11, .3, 22, '#d9c58f'), 0, .15, 0);
    const t = new THREE.Group();
    put(t, box(5, 2.6, 5, '#f2e6c8'), 0, 1.3, 0);
    put(t, cone(4.4, 2.4, 4, '#b06a3d'), 0, 3.8, 0).rotation.y = Math.PI / 4;
    put(t, cone(2.6, 1.8, 4, '#c9563c'), 0, 5.4, 0).rotation.y = Math.PI / 4;
    t.position.set(0, .3, 0); g.add(t);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; put(g, cyl(.16, .16, 1.8, 5, '#8a6844'), Math.cos(a) * 10.4, 1.05, Math.sin(a) * 10.4); }
    return { r: 12 };
  },
  'chinese-nets'(g) { // Fort Kochi
    for (let i = 0; i < 3; i++) {
      const n = new THREE.Group();
      put(n, cyl(.18, .22, 6, 6, '#6e4f2e'), 0, 3, 0);
      put(n, cyl(.12, .12, 7.5, 5, '#6e4f2e').rotateZ(-.9), 2.6, 4.9, 0);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshStandardMaterial({ color: '#e8e2d2', transparent: true, opacity: .55, side: THREE.DoubleSide }));
      net.position.set(5.2, 2.6, 0); net.rotation.z = .5; n.add(net);
      put(n, box(.5, .5, .5, '#5b4326'), -1.3, 3.4, 0);
      n.position.set(i * 5 - 5, 0, 0); n.rotation.y = -.4; g.add(n);
    }
    return { r: 8 };
  },
  'munnar'(g) { // tea terraces
    const mk = (x, z, r, h) => {
      const hill = put(g, cyl(r * .55, r, h, 12, '#4c9a54'), x, h / 2, z);
      for (let i = 1; i <= 4; i++) { const ring = put(g, cyl(r * (.55 + .45 * (1 - i / 5)) + .1, r * (.55 + .45 * (1 - i / 5)) + .1, .22, 12, '#2f7d3f'), x, h * i / 5, z); }
      return hill;
    };
    mk(-5, -2, 7, 9); mk(5, 3, 5.5, 6.5); mk(2, -6, 3.6, 4.4);
    put(g, box(2.4, 1.8, 2, '#f2e6c8'), -6, 9.9, -2); put(g, cone(1.9, 1.2, 4, '#c9563c'), -6, 11.4, -2).rotation.y = Math.PI / 4;
    return { r: 12 };
  },
  'houseboat'(g) { // Kumarakom: kettuvallam
    put(g, box(2.6, .8, 9, '#6e4f2e'), 0, .5, 0);
    const roof = put(g, cyl(1.5, 1.5, 6.4, 10, '#c9a24b').rotateX(Math.PI / 2), 0, 1.5, -.4); roof.scale.y = .62;
    put(g, box(.9, .5, 1.4, '#5b4326'), 0, 1.3, 4);
    put(g, cyl(.06, .06, 2.4, 4, '#5b4326').rotateX(.3), 0, 1.8, 4.6);
    return { r: 5.5, floats: true };
  },
  'paddy'(g) { // Alappuzha: paddy + canal
    put(g, box(16, .24, 12, '#7fbf3f'), 0, .12, 0);
    for (let i = -2; i <= 2; i++) put(g, box(.5, .26, 12, '#5f9f2f'), i * 3.2, .13, 0);
    put(g, box(16, .3, 2.2, '#3f8fbf', { roughness: .3 }), 0, .15, 7.4);
    return { r: 9 };
  },
  'snakeboat'(g) { // Aranmula
    const b = new THREE.Group();
    put(b, box(1.6, .55, 12, '#4a3320'), 0, .35, 0);
    put(b, cyl(.5, .18, 2.8, 6, '#4a3320').rotateX(-.6), 0, 1.3, -6.4);
    for (let i = 0; i < 6; i++) { put(b, sph(.3, '#c98d5c'), 0, .95, -4 + i * 1.5); put(b, box(.5, .5, .3, '#f2e6c8'), 0, .7, -4 + i * 1.5); }
    put(b, box(1.2, 1.1, 1.4, '#e8452c'), 0, 1.3, 2.6);
    g.add(b);
    return { r: 7, floats: true };
  },
  'ashtamudi'(g) { // Kollam: lake arms + canoes
    put(g, cyl(10, 10, .4, 18, '#3f8fbf', { roughness: .3 }), 0, .1, 0);
    put(g, box(14, .4, 3.4, '#3f8fbf', { roughness: .3 }), 8, .1, 3).rotation.y = .5;
    put(g, box(12, .4, 3, '#3f8fbf', { roughness: .3 }), -7, .1, -4).rotation.y = -.4;
    for (let i = 0; i < 3; i++) { const c = new THREE.Group(); put(c, box(.9, .4, 3.4, ['#c9563c', '#3f7d4e', '#e8b23d'][i]), 0, .25, 0); c.position.set(rnd(-6, 6), .35, rnd(-5, 5)); c.rotation.y = rnd(0, 6); g.add(c); }
    return { r: 12 };
  },
  'lighthouse'(g) { // Kovalam
    for (let i = 0; i < 5; i++) put(g, cyl(1.7 - i * .14, 1.85 - i * .14, 2.2, 12, i % 2 ? '#f4f1e6' : '#d43d2a'), 0, 1.1 + i * 2.2, 0);
    put(g, cyl(1.1, 1.1, 1.4, 10, '#2c2c34'), 0, 11.6, 0);
    put(g, cyl(.85, .85, .9, 10, '#ffd23f', { emissive: '#ffd23f', emissiveIntensity: .9 }), 0, 11.5, 0);
    put(g, cone(1.3, 1, 10, '#d43d2a'), 0, 12.8, 0);
    put(g, box(3.4, 1.6, 2.4, '#f2e6c8'), 3.4, .8, 0); put(g, cone(2.2, 1.1, 4, '#c9563c'), 3.4, 2.1, 0).rotation.y = Math.PI / 4;
    return { r: 5 };
  },
  'airport'(g) { // miniature runway (bonus, Kannur side unused)
    put(g, box(6, .2, 30, '#3b3f46'), 0, .1, 0);
    for (let i = -4; i <= 4; i++) put(g, box(.5, .22, 1.6, '#f4f1e6'), 0, .11, i * 3);
    const p = new THREE.Group();
    put(p, cyl(.5, .5, 4.6, 10, '#f4f1e6').rotateX(Math.PI / 2), 0, .8, 0);
    put(p, box(3.6, .14, 1.1, '#e8452c'), 0, .9, 0);
    put(p, box(.14, 1, .9, '#e8452c'), 0, 1.3, -2.2);
    p.position.set(6, 0, 4); p.rotation.y = .6; g.add(p);
    return { r: 8 };
  },
};
// district -> landmark kind + placement: 'sea' (x=-44), 'mid' (x=+16), 'hill' (x=+66)
const DISTRICT_LANDMARKS = [
  ['bekal-fort', 'sea'], ['st-angelo', 'sea'], ['banasura', 'hill'], ['pier', 'sea'],
  ['kottakkunnu', 'mid'], ['palakkad-fort', 'inland'], ['thrissur-round', 'mid'], ['chinese-nets', 'sea'],
  ['munnar', 'hill'], ['houseboat', 'sea'], ['paddy', 'inland'], ['snakeboat', 'sea'],
  ['ashtamudi', 'sea'], ['lighthouse', 'sea'],
];
const LX = { sea: -38, mid: 18, hill: 66, inland: 66 };
// Inland districts (no Arabian Sea coast - Update 81): their N-S band ORDER is already truthful (each sits between its real
// coastal neighbors). Update 83 makes placement 2D: each inland district is an EAST RECTANGLE (x >= RECT_X) whose z-span
// completes the sourced adjacencies the 1D band order cannot express - Wayanad borders Malappuram (S), so wayanad's rect runs
// through kozhikode's east strip to malappuram's band edge; Idukki borders Pathanamthitta (S), so idukki's rect runs through
// kottayam's east strip and alappuzha's north-half east strip to pathanamthitta's rect (split at the alappuzha band midline,
// schematic; kottayam's real SE reach subsumed, documented). Border sources: district-article adjacency (dev/HK-SOURCES.md
// Updates 81/83). The vacated west strips of inland bands belong to the sourced coastal neighbors, split at the band midline
// (schematic). Rectangles are stylized placement, NOT surveyed shapes.
const INLAND_D = new Set([2, 5, 8, 11]); // wayanad, palakkad, idukki, pathanamthitta
const RECT_X = 60; // schematic E-W split: inland districts own the highlands east strip, coastal districts the mid+lowland west of it
export const INLAND_RECT = { 2: [-320, -192], 5: [-128, -64], 8: [64, 224], 11: [224, 320] }; // district index -> [zNorth, zSouth]
export const WEST_OWNER = { 2: [1, 3], 5: [4, 6], 8: [7, 9], 11: [10, 12] }; // inland band -> [north coastal idx, south coastal idx]
// Update 85: the E-W split stops being a vertical line and follows the Western Ghats direction. Both of Kerala's long
// boundaries drift EAST going south (coast: Update 80 sources; highland edge: Wayanad E 76-26'35" -> Pathanamthitta E
// 77-17'30", keralatourism.org / industry.kerala.gov.in - ledger Update 85), the highland rate ~.72x the coast rate from
// those sourced endpoints. Magnitude compressed like the coast; a schematic tilted split, NOT a surveyed boundary.
export const GHATS_DX = 29;
export const ghatsXAt = z => RECT_X + GHATS_DX * (z / (WORLD.south - WORLD.north));
// 2D district lookup: east rectangles first (x >= RECT_X), then coastal bands; an inland band's west strip resolves to its
// sourced coastal neighbors (midline split). Returns the DISTRICTS index, or -1 outside the map.
export const districtAt = (x, z) => {
  const gx = ghatsXAt(z); // the tilted highland split (Update 85)
  if (x >= gx) for (const i of [2, 5, 8, 11]) { const r = INLAND_RECT[i]; if (z >= r[0] && z < r[1]) return i; }
  const b = Math.floor((z - WORLD.north) / WORLD.zoneH);
  if (b < 0 || b >= DISTRICTS.length) return -1;
  const w = WEST_OWNER[b];
  return (w && x < gx) ? (z < districtZone(b).zc ? w[0] : w[1]) : b;
};
const LANDMARK_LABELS = {
  'bekal-fort': 'Bekal Fort', 'st-angelo': 'St. Angelo Fort', 'banasura': 'Banasura hills',
  'pier': 'Sea pier', 'kottakkunnu': 'Kottakkunnu park', 'palakkad-fort': 'Palakkad Fort',
  'thrissur-round': 'Thrissur Round', 'chinese-nets': 'Chinese fishing nets', 'munnar': 'Munnar hills',
  'houseboat': 'Houseboat jetty', 'paddy': 'Paddy fields', 'snakeboat': 'Snake boat jetty',
  'ashtamudi': 'Ashtamudi lake', 'lighthouse': 'Lighthouse beach',
};

/* ---------- main build ---------- */
export function buildWorld(scene) {
  const colliders = [];   // {x,z,r}
  const itemSpots = [];   // collectible spawn candidates
  const places = [];      // named taxi stops / travel markers
  const world = new THREE.Group(); scene.add(world);

  // water (the Arabian sea + base)
  const water = put(world, box(700, .6, WORLD.south - WORLD.north + 700, '#2f9fd0', { roughness: .25, metalness: .05 }), -230, -.35, 0);
  water.receiveShadow = true; water.castShadow = false;

  // land: one extruded slab whose west edge IS the tilted shoreline, with the Vembanad basin cut as a hole
  // (shape-space y = -worldZ: rotateX(-PI/2) maps shape XY -> world XZ and the extrusion to +y)
  {
    const P = (x, z) => [x, -z];
    const shp = new THREE.Shape();
    shp.moveTo(...P(shoreXAt(WORLD.north - 4), WORLD.north - 4));
    shp.lineTo(...P(WORLD.eastX + 40, WORLD.north - 4));
    shp.lineTo(...P(WORLD.eastX + 40, WORLD.south + 4));
    shp.lineTo(...P(shoreXAt(WORLD.south + 4), WORLD.south + 4));
    for (const z of [...WP_ZS].reverse()) { if (z > LAKE.z1 && z < WORLD.south) shp.lineTo(...P(shoreXAt(z), z)); } // south-of-lake waypoints (Kollam)
    // west edge north->south with the Vembanad embayment: the shoreline steps east to the lake's east bank for the lake's
    // whole span (Update 84) - no hole; the barrier island is a separate mesh, so the mouth opens sea<->lake.
    // Update 87: the edge samples every sourced waypoint (WP_ZS) instead of following one straight tilt.
    shp.lineTo(...P(shoreXAt(LAKE.z1), LAKE.z1));
    shp.lineTo(...P(shoreXAt(LAKE.z1) + LAKE.w1, LAKE.z1));
    for (const z of [230.31, 130.89]) shp.lineTo(...P(shoreXAt(z) + LAKE.w1, z)); // the bank follows the shoreline bends (Update 87)
    shp.lineTo(...P(shoreXAt(LAKE.z0) + LAKE.w1, LAKE.z0));
    shp.lineTo(...P(shoreXAt(LAKE.z0), LAKE.z0));
    for (const z of [...WP_ZS].reverse()) { if (z < LAKE.z0 && z > WORLD.north) shp.lineTo(...P(shoreXAt(z), z)); } // north-of-lake waypoints
    shp.closePath();
    const lgeo = new THREE.ExtrudeGeometry(shp, { depth: 1.2, bevelEnabled: false });
    lgeo.rotateX(-Math.PI / 2);
    const land = new THREE.Mesh(lgeo, M('#55a85c'));
    land.position.y = -.6; land.receiveShadow = true; land.castShadow = false; world.add(land);
  }
  // Vembanad lake plate (recessed like the sea) + sand rim banks, following the piecewise shoreline (Update 87 strips;
  // Update-80/84 rotated boxes assumed a constant tilt); collider discs keep players on the banks
  world.add(shoreStrip(LAKE_ZS, -.5, LAKE.w1 + .2, '#3f8fbf', -.05, .6, { roughness: .3 })); // lake plate, top at -.05 like Update 80
  // barrier ISLAND between the sea and the lake (Vypin idiom): a separate land mesh broken at the Kochi mouth
  world.add(shoreStrip([MOUTH.z1, 130.89, 230.31, LAKE.z1], -.1, LAKE.w0 + .2, '#55a85c', .6, 1.2)); // top at .6 like the land slab
  put(world, box(LAKE.w1 + 3, .08, 1.8, '#e8d9a8'), shoreXAt(LAKE.z0) + 13, .63, LAKE.z0 - .75).castShadow = false; // headland rim (Fort Kochi side)
  put(world, box(LAKE.w1 + 3, .08, 1.8, '#e8d9a8'), shoreXAt(LAKE.z1) + 13, .63, LAKE.z1 + .75).castShadow = false;
  world.add(shoreStrip(LAKE_ZS, LAKE.w1 + .25, LAKE.w1 + 1.75, '#e8d9a8', .67, .08)); // east-bank sand rim follows the bends
  colliders.push({ x: shoreXAt(45) + 13, z: 45, r: 12 }); // the mouth channel is look-not-walk
  for (const cz of [60, 84, 108, 132, 156, 180, 204, 228, 252]) colliders.push({ x: shoreXAt(cz) + 18, z: cz, r: 10 });
  // Periyar river: flat water bands ON the land (wadeable read, no colliders); the x=34 main road passes over them (bridge read)
  for (const r of RIVER) put(world, box(r.x1 - r.x0, .07, r.z1 - r.z0, '#3f8fbf', { roughness: .3 }), (r.x0 + r.x1) / 2, .66, (r.z0 + r.z1) / 2).castShadow = false;
  for (const c of RIVER_CURVES) for (let i = 1; i < c.pts.length; i++) { // curved river bands, Update-90 idiom: +2 length so segments overlap at the joints; drawn before the road so asphalt reads as bridges
    const [x0, z0] = c.pts[i - 1], [x1, z1] = c.pts[i];
    const rm = put(world, box(Math.hypot(x1 - x0, z1 - z0) + 2, .07, c.w, '#3f8fbf', { roughness: .3 }), (x0 + x1) / 2, .66, (z0 + z1) / 2);
    rm.rotation.y = -Math.atan2(z1 - z0, x1 - x0); rm.castShadow = false; }
  // beach band follows the piecewise shoreline (Update 87 strip; was one rotated box at the constant tilt)
  // beach band, Update 107a/107b: notched at BOTH sea-reaching river mouths so each channel visibly opens into the sea:
  // Chaliyar at z -196 (gap -200.5..-191.5) and Bharathappuzha/Nila at Ponnani z -144 (gap -148.5..-139.5, the Update-86 arm's z -148..-140 + .5)
  const BEACH_ZS = [WORLD.north - 4, ...WP_ZS, WORLD.south + 4];
  const beachBetween = (a, b) => [a].concat(BEACH_ZS.filter(z => z > a && z < b), [b]);
  for (const [a, b] of [[WORLD.north - 4, -200.5], [-191.5, -148.5], [-139.5, WORLD.south + 4]])
    world.add(shoreStrip(beachBetween(a, b), 0, 9, '#e8d9a8', .66, 1.26)).receiveShadow = false;

  // social stage: walkable platform with canopy, backdrop, speakers, mic and bench arcs; dancing on it = performing
  const stage = { x: 14, z: 0, w: 16, d: 10, h: .9, ramp: 3 }; // west of the x=34 road: road - spur path - audience court - aisle - ramp
  {
    const top = .62 + stage.h;
    put(world, box(stage.w, stage.h, stage.d, '#8a5a34'), stage.x, top - stage.h / 2, stage.z);
    put(world, box(stage.w, .08, stage.d, '#a9744b'), stage.x, top + .04, stage.z).castShadow = false;
    for (let i = -3; i <= 3; i++) put(world, box(.1, .025, stage.d - .4, '#96613a'), stage.x + i * 2.2, top + .09, stage.z).castShadow = false;
    // front ramp (walk up from +z side) - footprint unchanged
    const ramp = put(world, box(6, stage.h, stage.ramp, '#8a5a34'), stage.x, top - stage.h / 2, stage.z + stage.d / 2 + stage.ramp / 2);
    ramp.rotation.x = -Math.atan2(stage.h, stage.ramp);
    // fabric backdrop panel with gold bands (kasavu-inspired, our own pattern)
    const bz = stage.z - stage.d / 2 + .3;
    put(world, box(stage.w - 1.2, 4.2, .16, '#f0e6cf'), stage.x, top + 2.55, bz);
    put(world, box(stage.w - 1.2, .3, .2, '#c99a3a'), stage.x, top + 4.55, bz);
    put(world, box(stage.w - 1.2, .3, .2, '#c99a3a'), stage.x, top + .6, bz);
    // scalloped dark-green valance across the canopy front edge
    for (let i = 0; i < 7; i++) put(world, box(1.55, .75, .14, '#1e4d3a'), stage.x - stage.w / 2 + 1.45 + i * 2.18, top + 5.35, stage.z + stage.d / 2 - .7);
    // canopy: four posts + gabled roof (two sloped slabs meeting at a ridge)
    for (const [px, pz] of [[-stage.w / 2 + .6, -stage.d / 2 + .5], [stage.w / 2 - .6, -stage.d / 2 + .5], [-stage.w / 2 + .6, stage.d / 2 - .6], [stage.w / 2 - .6, stage.d / 2 - .6]]) {
      put(world, cyl(.14, .18, 5.6, 6, '#6d4426'), stage.x + px, top + 2.8, stage.z + pz);
      colliders.push({ x: stage.x + px, z: stage.z + pz, r: .45 });
    }
    const slope = .32, slabD = (stage.d + 2.6) / 2;
    const roofM = M('#b3502e');
    const r1 = put(world, new THREE.Mesh(new THREE.BoxGeometry(stage.w + 2.6, .16, slabD), roofM), stage.x, top + 5.9 + Math.tan(slope) * slabD / 2, stage.z - slabD / 2 + .2);
    r1.rotation.x = slope;
    const r2 = put(world, new THREE.Mesh(new THREE.BoxGeometry(stage.w + 2.6, .16, slabD), roofM), stage.x, top + 5.9 + Math.tan(slope) * slabD / 2, stage.z + slabD / 2 - .2);
    r2.rotation.x = -slope;
    // speaker stacks at the front corners of the stage floor
    for (const sx of [-stage.w / 2 + 1.15, stage.w / 2 - 1.15]) {
      put(world, box(1.15, 1.5, .9, '#22262b'), stage.x + sx, top + .79, stage.z + stage.d / 2 - 1);
      put(world, box(.9, .75, .7, '#2c3138'), stage.x + sx, top + 1.92, stage.z + stage.d / 2 - 1);
    }
    // mic stand near the front-center of the stage
    put(world, cyl(.16, .2, .08, 8, '#2c3138'), stage.x, top + .12, stage.z + 1.4);
    put(world, cyl(.04, .04, 1.45, 6, '#2c3138'), stage.x, top + .85, stage.z + 1.4);
    put(world, sph(.13, '#3a3f46'), stage.x, top + 1.62, stage.z + 1.4);
    // audience: three arcs of low wooden benches facing the stage, split around the ramp aisle
    for (let row = 0; row < 3; row++) {
      const rr = 8.5 + row * 2.6;
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        const a = side * (.42 + k * .42);
        const bx = stage.x + Math.sin(a) * rr, bz2 = stage.z + stage.d / 2 + 1 + Math.cos(a) * rr * .82;
        const seat = put(world, box(1.9, .16, .55, '#a9744b'), bx, .62 + .42, bz2, a);
        put(world, box(.18, .42, .45, '#8a5a34'), bx - Math.cos(a) * .7, .62 + .21, bz2 + Math.sin(a) * .7, a);
        put(world, box(.18, .42, .45, '#8a5a34'), bx + Math.cos(a) * .7, .62 + .21, bz2 - Math.sin(a) * .7, a);
        seat.castShadow = false;
        colliders.push({ x: bx, z: bz2, r: .85 });
      }
    }
    // animated coloured light beams (cheap translucent cones, swept in app.js)
    const beams = [];
    ['#ffd9a0', '#ff9db4', '#a0e8c8'].forEach((c, i) => {
      const bm = new THREE.Mesh(new THREE.ConeGeometry(2.4, 9.5, 10, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .15, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      bm.position.set(stage.x - 4.5 + i * 4.5, top + 2.9, stage.z + 1.6);
      bm.castShadow = false; world.add(bm); beams.push(bm);
    });
    stage.beams = beams;
  }
  // audience court: paved pad under the bench arcs, and a spur path from the main road to the court
  put(world, box(28, .07, 15, '#d8c9a0'), stage.x, .655, stage.z + stage.d / 2 + 8.5).castShadow = false;
  put(world, box(19, .08, 4, '#454a52'), 24.5, .68, stage.z + stage.d / 2 + 14.5).castShadow = false; // meets the road at x=34, behind the last bench row; aisle leads north to the ramp

  // district tint patches + signboards + landmarks
  DISTRICTS.forEach((d, i) => {
    const { z0, zc } = districtZone(i), z1 = z0 + WORLD.zoneH;
    const inland = INLAND_D.has(i);
    if (!inland) { // coastal patch trapezoid (Update 85): west edge follows the shoreline (the Vembanad east bank for 7/9/10);
      // east edge follows the tilted ghats line for 3/9/10 (they cede their east strips to the inland districts), else the map edge
      const wE = z => (i === 7 || i === 9 || i === 10) ? shoreXAt(z) + LAKE.w1 + 2 : shoreXAt(z) + 6;
      const eE = [3, 9, 10].includes(i) ? z => ghatsXAt(z) - 1 : () => WORLD.eastX - 1;
      const patch = put(world, flatQuad([[wE(z0), z0 + .75], [eE(z0), z0 + .75], [eE(z1), z1 - .75], [wE(z1), z1 - .75]], i % 2 ? '#58ad5f' : '#54a45b'), 0, .65, 0);
      patch.castShadow = false;
      patch.userData.fill = { kind: 'patch', district: i };
    }

    const [kind, band] = DISTRICT_LANDMARKS[i];
    const lx = band === 'sea' ? shoreXAt(zc) + 14 : LX[band], lz = zc; // the sea band follows the shoreline; 'inland' (55) puts palakkad-fort/paddy on their east patches
    const lg = new THREE.Group(); lg.position.set(lx, .62, lz); world.add(lg);
    const meta = LANDMARK_BUILDERS[kind](lg);
    if (!meta.floats) colliders.push({ x: lx, z: lz, r: meta.r });
    else lg.position.y = 0;
    places.push({ name: LANDMARK_LABELS[kind] + ' (' + d[1] + ')', x: lx, z: lz, r: Math.max(meta.r || 6, 8) });

    const sbz = inland ? (INLAND_RECT[i][0] + INLAND_RECT[i][1]) / 2 - 14 : zc - 14;
    const sbx = (i === 9 || i === 10) ? shoreXAt(zc - 14) + LAKE.w1 + 7 : inland ? (ghatsXAt(sbz) + WORLD.eastX) / 2 : -20; // alappuzha/kottayam boards stand east of the Vembanad bank; inland boards centered on their tilted rectangles (Update 85)
    signboard(world, d[1], d[2], sbx, sbz, .5);
    colliders.push({ x: sbx, z: sbz, r: 4.5 });

    // collectible spots per district
    for (let s = 0; s < 6; s++) {
      let sx = 0, sz = 0, guard = 0;
      // district-consistent by construction (Update 85): the slot AND its 2-unit west margin must resolve to its own
      // district - with the tilted ghats line, kozhikode's coastal draws (x <= 58) can cross into wayanad's rectangle
      do { sx = inland ? rnd(RECT_X + 2, 100) : rnd(shoreXAt(zc) + 10, 58); sz = inland ? rnd(INLAND_RECT[i][0] + 4, INLAND_RECT[i][1] - 4) : rnd(zc - 26, zc + 26); } while ((inWater(sx, sz, 10) || districtAt(sx, sz) !== i || districtAt(sx - 2, sz) !== i) && ++guard < 40);
      if (!inWater(sx, sz, 10) && districtAt(sx, sz) === i && districtAt(sx - 2, sz) === i) itemSpots.push({ x: sx, z: sz, district: d[0] });
    }
  });

  // Update 85 partition fills (AFTER the district loop - no itemSpots-stream effect): trapezoids whose shared inland edge
  // follows the tilted ghats line; west strips tinted as their sourced coastal neighbors (band-midline split, schematic);
  // strips inside the Vembanad span clip at the lake's east bank (fixes the Update-84 tint quad floating over the lake at
  // idukki's band - the strip box spanned shore+5..60 across the widened basin).
  for (const i of INLAND_D) {
    const { z0, zc } = districtZone(i), z1 = z0 + WORLD.zoneH, [no, so] = WEST_OWNER[i];
    [[z0, zc, no], [zc, z1, so]].forEach(([za, zb, oi]) => {
      const onLake = za >= LAKE.z0 && zb <= LAKE.z1;
      const wE = z => shoreXAt(z) + (onLake ? LAKE.w1 + 1 : 6);
      const s = put(world, flatQuad([[wE(za), za + .75], [ghatsXAt(za) - 1, za + .75], [ghatsXAt(zb) - 1, zb - .75], [wE(zb), zb - .75]], oi % 2 ? '#58ad5f' : '#54a45b'), 0, .65, 0);
      s.castShadow = false;
      s.userData.fill = { kind: 'strip', owner: oi, band: i };
    });
    const [rn, rs] = INLAND_RECT[i];
    const rc = put(world, flatQuad([[ghatsXAt(rn) + 1, rn + .75], [WORLD.eastX - 1, rn + .75], [WORLD.eastX - 1, rs - .75], [ghatsXAt(rs) + 1, rs - .75]], i % 2 ? '#58ad5f' : '#54a45b'), 0, .65, 0);
    rc.castShadow = false;
    rc.userData.fill = { kind: 'rect', district: i };
  }

  // main road north-south at x=+34 with dashes
  put(world, box(6, .08, WORLD.south - WORLD.north, '#454a52'), 34, .68, 0).castShadow = false;
  for (let z = WORLD.north + 4; z < WORLD.south - 4; z += 6) put(world, box(.5, .09, 2.4, '#e8e2d2'), 34, .69, z).castShadow = false;

  // eastern hills (decorative barrier)
  for (let z = WORLD.north; z < WORLD.south; z += 26) {
    const h = rnd(14, 30), r = rnd(16, 26);
    const hill = put(world, cone(r, h, 9, z % 52 < 26 ? '#3f7d4e' : '#478a54'), WORLD.eastX + rnd(8, 30), h / 2 - .5, z + rnd(-6, 6));
    hill.castShadow = false;
  }
  colliders.push({ x: WORLD.eastX + 20, z: 0, r: 1, wallEast: true });

  // airport (east side) and ferry dock (shore), each on a clear zone boundary
  let DOCK = null; const AIRPORTS = [];
  { const clearAt = (x, z, r) => !colliders.some(k => !k.wallEast && Math.hypot(k.x - x, k.z - z) < k.r + r);
    // Kerala's international airports sit by their districts, listed north to south (Kannur, Kozhikode, Kochi, Thiruvananthapuram)
    const APS = [[1, 'Kannur', 'CNN'], [3, 'Kozhikode', 'CCJ'], [7, 'Kochi', 'COK'], [13, 'Thiruvananthapuram', 'TRV']];
    for (const [di, name, code] of APS) { const zc = WORLD.north + di * WORLD.zoneH + WORLD.zoneH / 2;
      for (const dz of [0, 8, -8, 16, -16, 24, -24]) { const z = zc + dz; if (clearAt(80, z, 24)) { AIRPORTS.push({ x: 80, z, name, code }); break; } } }
    for (let i = DISTRICTS.length - 4; i > 0 && !DOCK; i--) { const z = WORLD.north + i * WORLD.zoneH, dx = shoreXAt(z) + (z > LAKE.z0 - 20 && z < LAKE.z1 + 20 ? LAKE.w1 + 20 : 6); if (clearAt(dx, z, 14) && AIRPORTS.every(a => Math.abs(z - a.z) > 40)) DOCK = { x: dx, z }; } // Vembanad-span docks sit on the walkable east bank (Kumarakom idiom), others on the shore
    for (const AIRPORT of AIRPORTS) { const a = buildAirport(); a.position.set(AIRPORT.x, .62, AIRPORT.z); a.rotation.y = -Math.PI / 2; world.add(a);
      for (const [lx, lz, r] of AIRPORT_COLLIDERS) colliders.push({ x: AIRPORT.x - lz, z: AIRPORT.z + lx, r }); }
    if (DOCK) { const d = buildFerryDock(); d.position.set(DOCK.x - 4, .62, DOCK.z); world.add(d); const f = buildFerry(); f.position.set(DOCK.x - 20, .3, DOCK.z + 5); f.rotation.y = 0; world.add(f); colliders.push({ x: DOCK.x - 8, z: DOCK.z, r: 2 }); colliders.push({ x: DOCK.x - 20, z: DOCK.z + 5, r: 6 }); }
  }
  // vegetation + props scattered on land
  const GEO_ANCHORS = [[14, -216, 19], [shoreXAt(-200) + 6, -200, 22], [56, 10, 20], [56, districtZone(13).zc - 22, 20]]; // football ground (Kozhikode), Kozhikode Beach, stadiums (Kochi, Thiruvananthapuram) - keep vegetation off
  const avoid = (x, z) => inWater(x, z, 3) || GEO_ANCHORS.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar) || (AIRPORTS.some(a => Math.hypot(x - a.x, z - a.z) < 28)) || (DOCK && Math.hypot(x - DOCK.x, z - DOCK.z) < 14) || Math.abs(x - 34) < 6 || (Math.abs(x - stage.x) < 17 && Math.abs(z - (stage.z + 4)) < 18) || DISTRICT_LANDMARKS.some((k, i) => { const { zc } = districtZone(i); const lx = k[1] === 'sea' ? shoreXAt(zc) + 14 : LX[k[1]]; return Math.hypot(x - lx, z - zc) < 16; });
  // Vegetation instancing: the same factories run at the same points in the same Math.random sequence,
  // but instead of adding hundreds of standalone meshes, each plant's per-mesh world matrices are
  // collected and drawn as shared-geometry InstancedMesh parts (one draw per structural mesh index).
  const vegParts = new Map();
  const vegCollect = (key, g, x, z, ry) => {
    g.position.set(x, .62, z); g.rotation.y = ry; g.updateMatrixWorld(true);
    const meshes = []; g.traverse(o => { if (o.isMesh) meshes.push(o); });
    meshes.forEach((m, i) => {
      const k = key + ':' + i;
      if (!vegParts.has(k)) vegParts.set(k, { geo: m.geometry, mat: m.material, cast: m.castShadow, recv: m.receiveShadow, mats: [] });
      vegParts.get(k).mats.push(m.matrixWorld.clone());
    });
  };
  let palms = 0;
  for (let tries = 0; tries < 900 && palms < 150; tries++) {
    const z = rnd(WORLD.north + 6, WORLD.south - 6), x = rnd(shoreXAt(z) + 7, WORLD.eastX - 8);
    if (avoid(x, z)) continue;
    const p = palm(rnd(.85, 1.35)), ry = rnd(0, 6.3);
    vegCollect('palm', p, x, z, ry);
    colliders.push({ x, z, r: .7 }); palms++;
  }
  for (let tries = 0, n = 0; tries < 500 && n < 70; tries++) {
    const z = rnd(WORLD.north + 6, WORLD.south - 6), x = rnd(shoreXAt(z) + 8, WORLD.eastX - 10);
    if (avoid(x, z)) continue;
    const ts = rnd(.8, 1.4), tc = Math.random() < .3 ? '#3f9e57' : '#2f8f46';
    const t = leafyTree(ts, tc), ry2 = rnd(0, 6.3);
    vegCollect('tree:' + tc, t, x, z, ry2);
    colliders.push({ x, z, r: .8 }); n++;
  }
  for (let tries = 0, n = 0; tries < 400 && n < 90; tries++) {
    const z = rnd(WORLD.north + 4, WORLD.south - 4), x = rnd(shoreXAt(z) + 6, WORLD.eastX - 8);
    if (avoid(x, z)) continue;
    const isBush = Math.random() < .5; const b = isBush ? bush() : flowerPatch();
    vegCollect(isBush ? 'bush' : 'flower', b, x, z, 0); n++;
  }
  for (const p of vegParts.values()) {
    const im = new THREE.InstancedMesh(p.geo, p.mat, p.mats.length);
    p.mats.forEach((mtx, i) => im.setMatrixAt(i, mtx));
    im.castShadow = p.cast; im.receiveShadow = p.recv; im.instanceMatrix.needsUpdate = true;
    world.add(im);
  }
  vegParts.clear();

  // villages: chayakada + huts + benches + vehicles at some districts
  DISTRICTS.forEach((d, i) => {
    const { zc } = districtZone(i);
    if (i % 2 === 0) {
      const ck = chayakada(); ck.position.set(44, .62, zc - 18); ck.rotation.y = Math.PI; world.add(ck);
      colliders.push({ x: 44, z: zc - 18, r: 3.4 });
    }
    if (i % 3 === 0) { const h = hayHut(); h.position.set(52, .62, zc + 16); world.add(h); colliders.push({ x: 52, z: zc + 16, r: 2 }); }
    if (i % 2 === 1) { const b = bench(); b.position.set(28, .62, zc + 10); b.rotation.y = -Math.PI / 2; world.add(b); colliders.push({ x: 28, z: zc + 10, r: 1.2 }); }
    if (i % 4 === 1) { const c = cow(); c.position.set(48, .62, zc + 4); c.rotation.y = rnd(0, 6.3); world.add(c); colliders.push({ x: 48, z: zc + 4, r: 1.4 }); }
    if (i % 4 === 2) { const v = autoRickshaw(); v.position.set(40, .62, zc + 4); v.rotation.y = rnd(-.4, .4); world.add(v); colliders.push({ x: 40, z: zc + 4, r: 1.6 }); } // Update 107a: zc+8 put the alappuzha rickshaw's body over the Update-86 Pamba arm's north bank edge (z 232); +4 is dry bank, same rnd draws
    if (i % 4 === 3) { const v = motorbike(); v.position.set(40, .62, zc - 8); v.rotation.y = rnd(-.4, .4) + 1.5; world.add(v); colliders.push({ x: 40, z: zc - 8, r: 1.2 }); }
    if (i % 5 === 4) { const v = jeep(); v.position.set(44, .62, zc - 2); v.rotation.y = rnd(-.3, .3); world.add(v); colliders.push({ x: 44, z: zc - 2, r: 2 }); }
    if (i === 12) { const e = elephantStatue(); e.position.set(52, .62, zc + 20); e.rotation.y = -1.2; world.add(e); colliders.push({ x: 52, z: zc + 20, r: 2.2 }); }
  });

  // football turfs: near Kottakkunnu (Malappuram), Kochi and Thiruvananthapuram (those two inside the stadium rings below)
  [4, 7, 13].forEach(i => {
    const { zc } = districtZone(i);
    const t = new THREE.Group();
    put(t, box(18, .1, 12, '#2f8f46'), 0, .05, 0).castShadow = false;
    put(t, box(18, .11, .4, '#f4f1e6'), 0, .06, -6).castShadow = false; put(t, box(18, .11, .4, '#f4f1e6'), 0, .06, 6).castShadow = false;
    put(t, box(.4, .11, 12, '#f4f1e6'), -9, .06, 0).castShadow = false; put(t, box(.4, .11, 12, '#f4f1e6'), 9, .06, 0).castShadow = false;
    [[-9], [9]].forEach(px => { put(t, cyl(.12, .12, 2.4, 5, '#f4f1e6'), px[0], 1.2, -1.8); put(t, cyl(.12, .12, 2.4, 5, '#f4f1e6'), px[0], 1.2, 1.8); put(t, box(.12, .12, 3.8, '#f4f1e6'), px[0], 2.4, 0); });
    t.position.set(56, .62, zc - 22); world.add(t);
    colliders.push({ x: 56 - 9, z: zc - 22, r: 1 }, { x: 56 + 9, z: zc - 22, r: 1 });
  });

  // --- real-geography anchors (user request): Kozhikode Beach, Kozhikode football ground, Kochi stadium ---
  const vbx = shoreXAt(194) + LAKE.w1 + 7; // signboard just east of the lake bank
  signboard(world, 'Vembanad Lake', 'വേമ്പനാട് കായൽ', vbx, 194, .5);
  colliders.push({ x: vbx, z: 194, r: 4.5 });
  places.push({ name: 'Vembanad Lake (Alappuzha)', x: vbx, z: 194, r: 12 });
  signboard(world, 'Periyar River', 'പെരിയാർ നദി', 56, 52, .5);
  colliders.push({ x: 56, z: 52, r: 4.5 });
  {
    const kz = districtZone(3).zc;                    // Kozhikode zone
    // Kozhikode Beach: wide sand apron + lit promenade on the shore south of the pier
    const bz = kz + 24;
    const bsh = shoreXAt(bz), bry = shoreAngleAt(bz); // beach apron follows the LOCAL shoreline angle (Update 88; the Update-87 constant-tilt rotation cut triangular wedges into the curved shore/beach here)
    // apron split at the Chaliyar mouth (world z gap -200.5..-191.5; bz = -200): the Update-107a beach-band notch left
    // this second tan surface crossing the channel end (main 9:44). Two boxes: z -220..-200.5 and -191.5..-180, same x/rotation.
    put(world, box(16, .1, 19.5, '#e8d9a8'), bsh + 6, .66, -210.25, bry).castShadow = false;
    put(world, box(16, .1, 11.5, '#e8d9a8'), bsh + 6, .66, -185.75, bry).castShadow = false;
    // promenade split at the Chaliyar mouth too (z gap -200.5..-191.5): the channel's penultimate segment swings
    // east under its span (Update 107b top-down caught the tan strip crossing the blue); lamps at bz+-12 stay on their halves
    put(world, box(3.4, .12, 17.5, '#c9b184'), bsh + 8.5, .68, -209.25, bry).castShadow = false;
    put(world, box(3.4, .12, 9.5, '#c9b184'), bsh + 8.5, .68, -186.75, bry).castShadow = false;
    for (const dz of [-12, 12]) {
      put(world, cyl(.09, .11, 3.4, 6, '#3a3230'), shoreXAt(bz + dz) + 8.5, .68 + 1.7, bz + dz);
      put(world, sph(.3, '#ffe9b0', { emissive: '#ffd27a', emissiveIntensity: .5 }), shoreXAt(bz + dz) + 8.5, .68 + 3.5, bz + dz);
      colliders.push({ x: shoreXAt(bz + dz) + 8.5, z: bz + dz, r: .4 });
    }
    signboard(world, 'Kozhikode Beach', 'കോഴിക്കോട് ബീച്ച്', shoreXAt(bz - 17) + 10, bz - 17, .5);
    colliders.push({ x: shoreXAt(bz - 17) + 10, z: bz - 17, r: 4.5 });
    places.push({ name: 'Kozhikode Beach', x: bsh + 8, z: bz, r: 12 });

    // Football ground (Kozhikode): full pitch with centre line, circle and goals
    const fx = 14, fz = kz + 8;
    put(world, box(22, .09, 32, '#2f8f46'), fx, .66, fz).castShadow = false;
    const line = (w, d, x, z) => put(world, box(w, .1, d, '#f4f1e6'), x, .67, z).castShadow = false;
    line(22, .35, fx, fz - 16); line(22, .35, fx, fz + 16); line(.35, 32, fx - 11, fz); line(.35, 32, fx + 11, fz);
    line(22, .3, fx, fz);                                                              // halfway
    for (const pz of [fz - 16, fz + 16]) {                                             // penalty boxes
      line(12, .3, fx, pz + (pz < fz ? 5 : -5));
      line(.3, 5, fx - 6, pz + (pz < fz ? 2.5 : -2.5));
      line(.3, 5, fx + 6, pz + (pz < fz ? 2.5 : -2.5));
    }
    put(world, cyl(3, 3, .1, 20, '#f4f1e6'), fx, .67, fz).castShadow = false;          // centre circle ring base
    put(world, cyl(2.6, 2.6, .11, 20, '#2f8f46'), fx, .675, fz).castShadow = false;    // green fill -> ring effect
    for (const gz of [fz - 16, fz + 16]) {
      for (const gx of [fx - 3, fx + 3]) put(world, cyl(.12, .12, 2.4, 5, '#f4f1e6'), gx, .66 + 1.2, gz);
      put(world, box(6.4, .12, .12, '#f4f1e6'), fx, .66 + 2.4, gz);
      colliders.push({ x: fx, z: gz, r: 1.2 });
    }
    places.push({ name: 'EMS-inspired football ground (Kozhikode)', x: fx, z: fz, r: 14 });

    // Stadium (Kochi): stands ring + floodlights around the Ernakulam turf
    const ez = districtZone(7).zc, sx = 56, sz = ez - 22;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      const st = new THREE.Group();
      st.position.set(sx + Math.cos(a) * 13, .66, sz + Math.sin(a) * 13);
      st.rotation.y = -a + Math.PI / 2; world.add(st);
      // three tiers rising outward: reads as bleacher seating facing the pitch
      for (let t = 0; t < 3; t++) {
        const h = 1.1 * (t + 1);
        put(st, box(8, h, 1.5, t % 2 ? '#4a6a8a' : (k % 2 ? '#c8b06a' : '#b09a58')), 0, h / 2, t * 1.5).castShadow = false;
      }
      colliders.push({ x: sx + Math.cos(a) * 14.2, z: sz + Math.sin(a) * 14.2, r: 4.8 });
    }
    for (const [cx2, cz2] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
      put(world, cyl(.16, .2, 9, 6, '#5a6068'), sx + cx2, .66 + 4.5, sz + cz2);
      put(world, box(2.2, 1, .5, '#fff4c8', { emissive: '#ffeeaa', emissiveIntensity: .8 }), sx + cx2, .66 + 9.2, sz + cz2).castShadow = false;
      colliders.push({ x: sx + cx2, z: sz + cz2, r: .5 });
    }
    places.push({ name: 'JLN-inspired stadium (Kochi)', x: sx, z: sz, r: 17 });

    // Stadium (Thiruvananthapuram): same open-bowl idiom as Kochi around the district-13 turf, but the ring is rotated
    // 22.5 deg so no stand sits on the NE diagonal toward the Thiruvananthapuram airport edge-light columns (nearest
    // collider-disc gap ~0.5); teal/sand palette to read distinct from Kochi's blue/gold. Gameplay arrangement.
    const tvc = districtZone(13).zc, tvx = 56, tvz = tvc - 22;
    for (let k = 0; k < 8; k++) {
      const a = (k + .5) * Math.PI / 4;
      const st = new THREE.Group();
      st.position.set(tvx + Math.cos(a) * 13, .66, tvz + Math.sin(a) * 13);
      st.rotation.y = -a + Math.PI / 2; world.add(st);
      for (let t = 0; t < 3; t++) {
        const h = 1.1 * (t + 1);
        put(st, box(8, h, 1.5, t % 2 ? '#3a6a62' : (k % 2 ? '#d0bd8a' : '#b8a470')), 0, h / 2, t * 1.5).castShadow = false;
      }
      colliders.push({ x: tvx + Math.cos(a) * 14.2, z: tvz + Math.sin(a) * 14.2, r: 4.8 });
    }
    for (const [px3, pz3] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
      put(world, cyl(.16, .2, 9, 6, '#5a6068'), tvx + px3, .66 + 4.5, tvz + pz3);
      put(world, box(2.2, 1, .5, '#fff4c8', { emissive: '#ffeeaa', emissiveIntensity: .8 }), tvx + px3, .66 + 9.2, tvz + pz3).castShadow = false;
      colliders.push({ x: tvx + px3, z: tvz + pz3, r: .5 });
    }
    places.push({ name: 'Greenfield-inspired stadium (Thiruvananthapuram)', x: tvx, z: tvz, r: 17 });
  }

  // sky clouds
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(rnd(0, 3));
    for (let j = 0; j < n; j++) { const s = sphLo(rnd(2.4, 4.6), '#ffffff', { roughness: 1 }); s.castShadow = false; s.position.set(j * rnd(2.4, 3.4) - n * 1.5, rnd(-.6, .6), rnd(-1, 1)); c.add(s); }
    c.position.set(rnd(-140, 160), rnd(34, 58), rnd(WORLD.north, WORLD.south));
    world.add(c); clouds.push(c);
  }

  // butterflies
  const butterflies = [];
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(.5, .4), new THREE.MeshBasicMaterial({ color: ['#ff9d5c', '#7dc4ff', '#ffd23f'][i % 3], side: THREE.DoubleSide }));
    const w2 = w1.clone(); w1.position.x = -.25; w2.position.x = .25; b.add(w1, w2);
    b.position.set(rnd(-40, 60), rnd(1.5, 3.5), rnd(WORLD.north + 20, WORLD.south - 20));
    b.userData = { w1, w2, t: rnd(0, 9) }; world.add(b); butterflies.push(b);
  }

  if (typeof location === 'undefined' || !new URLSearchParams(location.search).has('nomerge')) mergeStatic(world, [...clouds, ...butterflies, ...(stage.beams || [])], 48);
  places.push({ name: 'Kerala stage', x: stage.x, z: stage.z, r: 18 });
  if (DOCK) places.push({ name: 'Ferry dock', x: DOCK.x, z: DOCK.z, r: 11 });
  for (const a of AIRPORTS) places.push({ name: a.name + ' (' + a.code + ')', x: a.x, z: a.z, r: 17 });
  // kerala's drawn roads: the x=34 north-south main road (half 3) and the stage spur path z=19.5, x 15..34 (half 2)
  const roadAsphalt = (x, z, pad) => { const p = pad || 0;
    return (Math.abs(x - 34) < 3 + p && z > WORLD.north && z < WORLD.south)
        || (Math.abs(z - (stage.z + stage.d / 2 + 14.5)) < 2 + p && x > 15 - p && x < 34 + p); };
  const roads = [{ ax: 'x', c: 34, from: WORLD.north + 4, to: WORLD.south - 4 }, { ax: 'z', c: stage.z + stage.d / 2 + 14.5, from: 15, to: 34 }];
  return {
    group: world, colliders, itemSpots, places, clouds, butterflies, roadAsphalt, roads,
    stage,
    airports: AIRPORTS.map(a => ({ x: a.x, z: a.z, arrive: [a.x - 8, a.z], yaw: Math.PI / 2, r: 17, name: a.name, code: a.code })),
    airport: AIRPORTS[0] && { x: AIRPORTS[0].x, z: AIRPORTS[0].z, arrive: [AIRPORTS[0].x - 8, AIRPORTS[0].z], yaw: Math.PI / 2, r: 17, name: AIRPORTS[0].name, code: AIRPORTS[0].code },
    ferry: DOCK && { x: DOCK.x, z: DOCK.z, arrive: [DOCK.x + 3, DOCK.z], r: 11 },
    groundY: (x, z) => {
      if (x === undefined) return .62;
      const onPlat = Math.abs(x - stage.x) < stage.w / 2 && Math.abs(z - stage.z) < stage.d / 2;
      if (onPlat) return .62 + stage.h;
      const rz = z - (stage.z + stage.d / 2); // ramp in front of the stage
      if (Math.abs(x - stage.x) < 3 && rz >= 0 && rz <= stage.ramp) return .62 + stage.h * (1 - rz / stage.ramp);
      return .62;
    },
    clamp(x, z) {
      x = Math.max(shoreXAt(z) + 3.5, Math.min(WORLD.eastX - 6, x));
      z = Math.max(WORLD.north + 3, Math.min(WORLD.south - 3, z));
      return [x, z];
    },
  };
}

export { palm, leafyTree, textBoard, signboard, put, box, cyl, sph, cone, M };
