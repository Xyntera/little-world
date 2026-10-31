/* DEV-ONLY isolated prototype: real OpenStreetMap road geometry (India Gate / Kartavya Path slice)
   overlaid on the generated Delhi city. Activated only with ?proto=delhi on loadCity('delhi').
   Data file /delhi-roads.json is UNTRACKED (ODbL redistribution decision pending) and never deployed.
   Provenance: dev/research/delhi-roads-PROVENANCE.txt (Overpass POST, osm_base 2026-10-29T20:37:19Z).
   Second city of the row-13 real-roads line after the NY ?proto=ny precedent (v129). */
import * as THREE from '/vendor/three.module.js';
import { addFacade, facadeOf } from '/cities.js';

const LAT0 = 28.61286, LON0 = 77.22931;             // bbox centre = extrasDelhi anchor (India Gate)
const M_PER_U = 6.36;                               // 1400 m span -> ~220 game units (same convention as NY)
const M_LAT = 111320, M_LON = 111320 * Math.cos(LAT0 * Math.PI / 180);
// alignment offset (game units): minimises road culling around preserved set pieces (offline optimiser, dev/harness/delhialign.mjs)
const OFF_X = 0, OFF_Z = -26;
const toXZ = (lat, lon) => [ (lon - LON0) * M_LON / M_PER_U + OFF_X, -(lat - LAT0) * M_LAT / M_PER_U + OFF_Z ];
// preserved gameplay targets (fixed coords from cities.js extrasDelhi build sites (extraspos probe, labels minus hd+2) + landmark plaza + spawn): [x, z, keep-clear radius]
const PROTECTED = [ [0, -26, 13], [-57.28, -18.5, 13], [26.27, -14.13, 12], [93.43, -12.71, 13], [0, 10, 3],
  [50, -50, 28], /* Update 146: delhi AIRPORT (50,-50) r17/place r28 - the first A/B still showed the sweep removing the transport feature (NY never faced this: its airport sits outside the slice box). Roads yield to the preserved airport complex. */
  [-17, -58, 10] /* Haveli stage (punched-city gameplay venue) w12 d8 + margin */ ];
const nearPiece = (x, z, extra) => { for (const [px, pz, pr] of PROTECTED) if (Math.hypot(x - px, z - pz) < pr + extra) return true; return false; };

const STYLE = { // width in metres, colour, y layer (staggered: overlapping ribbons must not z-fight).
  // Layers start at .82: base-city ground slabs top out at .76 (measured 2026-10-27: asphalt .69, amber .75, cream .76), so +.06 clearance kills overlay-vs-base fighting without a visible float.
  primary:   { w: 20, c: '#3f4148', y: .82 }, primary_link: { w: 12, c: '#3f4148', y: .835 },
  secondary: { w: 16, c: '#45484f', y: .85 }, residential:  { w: 12, c: '#4a4d55', y: .865 },
  service:   { w: 8,  c: '#55585c', y: .88 }, pedestrian:   { w: 6,  c: '#cfc8b2', y: .895 },
  footway:   { w: 3,  c: '#d8d2bd', y: .91 }, steps:        { w: 2,  c: '#d8d2bd', y: .925 },
  corridor:  { w: 1.5,c: '#d8d2bd', y: .94 },
};

function attributionChip() {
  if (document.querySelector('#osm-attr')) return;
  const el = document.createElement('a');
  el.id = 'osm-attr'; el.href = 'https://www.openstreetmap.org/copyright'; el.target = '_blank'; el.rel = 'noreferrer';
  el.textContent = 'Road data \u00a9 OpenStreetMap contributors, ODbL';
  el.style.cssText = 'position:fixed;left:8px;bottom:34px;z-index:40;background:rgba(20,36,32,.82);color:#eaf4ee;font:12px/1.35 system-ui,sans-serif;padding:5px 9px;border-radius:8px;text-decoration:none;transition:all .6s';
  document.body.appendChild(el);
  setTimeout(() => { el.textContent = '\u00a9 OpenStreetMap \u00b7 ODbL'; el.style.opacity = '.75'; el.title = 'Road data \u00a9 OpenStreetMap contributors, ODbL - tap for details'; }, 5000); // collapses but stays findable per OSMF attribution guideline
}

export async function overlay(scene, worldData, extra = {}) {
  // idempotent: city rebuilds re-run this hook; a previous overlay group must not stack
  // (leak: +1 scene child and duplicated road ribbons per proto reload).
  const prev = scene.getObjectByName('delhi-proto-roads');
  if (prev) {
    (prev.parent || scene).remove(prev);
    prev.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); } });
  }
  const res = await fetch('/delhi-roads.json');
  if (!res.ok) return { ok: false, err: res.status };
  const data = await res.json();
  if (extra.isStale && extra.isStale()) return { ok: false, err: 'stale-city' }; // travelled away mid-fetch: never mutate another city's world
  // Parked bays live outside the city group. Keep their collider identity and
  // leave room for their largest vehicle body when rebuilding block interiors.
  const bays = extra.parked || [];
  const ways = Array.isArray(data) ? data : data.ways; // wrapped format carries ODbL metadata
  const byClass = {};
  const DROP = new Set((new URLSearchParams(location.search).get('delhidrop') || '').split(',').filter(Boolean)); // test-only class filter (?delhidrop=footway,steps)
  for (const [cls, line] of ways) { if (DROP.has(cls)) continue; (byClass[cls] = byClass[cls] || []).push(line); }
  const group = new THREE.Group(); group.name = 'delhi-proto-roads';
  let tris = 0, drawn = 0, culled = 0;
  const segs = []; // [x0,z0,x1,z1,halfWidthUnits]
  for (const cls of Object.keys(byClass)) {
    const st = STYLE[cls] || { w: 3, c: '#888', y: .955 };
    const hw = (st.w / M_PER_U) / 2;
    const pos = [];
    for (const line of byClass[cls]) {
      for (let i = 0; i + 1 < line.length; i++) {
        const [x0, z0] = toXZ(line[i][0], line[i][1]), [x1, z1] = toXZ(line[i + 1][0], line[i + 1][1]);
        const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
        if (L < 0.01) continue;
        /* Update 146b (Main 2:16 diagnosis: wholesale segment drops severed through-roads at protected zones -
           79 dropped segments had 553u OUTSIDE every radius): TRIM each segment at the protected circles instead
           of dropping it whole. Roads now terminate AT the piece boundary; only fully-covered sub-intervals drop. */
        const l2 = dx * dx + dz * dz;
        let spans = [[0, 1]];
        for (const [px, pz, pr] of PROTECTED) {
          const R = pr + hw, fx = x0 - px, fz = z0 - pz;
          const B = 2 * (fx * dx + fz * dz), Cq = fx * fx + fz * fz - R * R, disc = B * B - 4 * l2 * Cq;
          if (disc <= 0) continue;
          const sq = Math.sqrt(disc);
          const a = Math.max(0, (-B - sq) / (2 * l2)), b2 = Math.min(1, (-B + sq) / (2 * l2));
          if (a >= b2) continue;
          const next = [];
          for (const [s, e] of spans) { if (s < a) next.push([s, Math.min(e, a)]); if (e > b2) next.push([Math.max(s, b2), e]); }
          spans = next;
          if (!spans.length) break;
        }
        if (!spans.length) { culled += L; continue; } // fully inside protected zones: roads yield to preserved set pieces
        culled += L * (1 - spans.reduce((acc, [s, e]) => acc + e - s, 0));
        for (const [s0, e0] of spans) {
          const sx = x0 + dx * s0, sz = z0 + dz * s0, ex = x0 + dx * e0, ez = z0 + dz * e0, sL = L * (e0 - s0);
          if (sL < 0.01) continue;
          segs.push([sx, sz, ex, ez, hw]);
          const nx = -dz / L * hw, nz = dx / L * hw;
          pos.push(sx + nx, st.y, sz + nz, sx - nx, st.y, sz - nz, ex + nx, st.y, ez + nz);
          pos.push(ex + nx, st.y, ez + nz, sx - nx, st.y, sz - nz, ex - nx, st.y, ez - nz);
          tris += 2;
        }
      }
      drawn++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: st.c }));
    mesh.castShadow = mesh.receiveShadow = false;
    group.add(mesh);
  }
  worldData.group.add(group); // world-owned: torn down with the city, no cross-city residue
  attributionChip();

  // sweep needs individual meshes: a merged static world (default) must be rebuilt with ?nomerge
  const merged = [...worldData.group.children].some(c => c.isMesh && !(c.geometry && c.geometry.parameters) && c.geometry && c.geometry.boundingSphere && c.geometry.boundingSphere.radius > 60);
  if (merged) { worldData.delhiProto = { group, ways: drawn, tris, merged: true }; return { ok: false, err: 'merged-world', ways: drawn, tris }; }

  /* ---- aligned slice: clear procedural content inside the slice bbox, keep ground + landmark,
     rebuild block interiors as simple blocks with colliders so roads are the walkable network ---- */
  const X0 = -109, X1 = 109, Z0 = -109, Z1 = 109; // Delhi bbox maps to a ~220x220u square (NY's was avenue-elongated)
  const inBox = (x, z) => x > X0 && x < X1 && z > Z0 && z < Z1;
  const roadDist = (x, z) => { // distance from point to nearest road EDGE (negative = on road)
    let best = 1e9;
    for (const [x0, z0, x1, z1, hw] of segs) {
      const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz;
      let t = ((x - x0) * dx + (z - z0) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)) - hw;
      if (d < best) best = d;
    }
    return best;
  };
  const world = worldData.group;
  const removed = { meshes: 0, colliders: 0 };
  const dispose = o => o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(mm => mm.dispose()); });
  for (const child of [...world.children]) {
    if (child === group || child.name === 'delhi-proto-roads') continue; // the overlay's own ribbons are not sweep targets
    const p = child.position;
    if (!inBox(p.x, p.z)) continue;
    const prm = child.geometry && child.geometry.parameters;
    if (prm && Math.max(prm.width || 0, prm.depth || 0, (prm.radiusTop || 0) * 2) > 60) continue; // ground/land/water bases
    if (nearPiece(p.x, p.z, 2)) continue; // preserved set pieces + landmark + spawn (roads culled around them instead)
    world.remove(child); dispose(child); removed.meshes++;
  }
  worldData.colliders = worldData.colliders.filter(c => {
    if (bays.some(p => p.col === c)) return true;
    if (c.wallEast || !inBox(c.x, c.z)) return true;
    if (nearPiece(c.x, c.z, 2)) return true;
    removed.colliders++; return false;
  });
  // neutralize pool/swim zones inside the slice (their visuals are gone)
  if (worldData.inPool) { const old = worldData.inPool; worldData.inPool = (x, z) => inBox(x, z) ? false : old(x, z); }

  // block-interior blocks in the game's own facade grammar (Delhi 'flat' roofs, delhi palette)
  const palette = ['#d6a27c', '#c97a52', '#e3c9a0', '#b66a4a']; // CITY_DEFS.delhi.bld
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000;
  const placed = [];
  for (let gx = X0 + 4; gx < X1 - 4; gx += 3.2) for (let gz = Z0 + 4; gz < Z1 - 4; gz += 3.2) {
    const x = gx + rnd() * 2 - 1, z = gz + rnd() * 2 - 1;
    const clear = roadDist(x, z);
    if (clear < 3.2) continue;                                 // keep roads + sidewalks open
    if (worldData.roadAsphalt && worldData.roadAsphalt(x, z, 2.5)) continue;    // keep procedural taxi corridors drivable (taxis stay procedural in v1)
    const half = Math.min(3.6, clear - 1.3);                   // footprint fits the real block with sidewalk margin
    if (half < 1.9) continue;
    // whole footprint + 1u must stay road-free (roads bend; centre clearance alone is not enough)
    let okCorners = true;
    for (const [cx, cz] of [[x - half, z - half], [x + half, z - half], [x - half, z + half], [x + half, z + half]]) if (roadDist(cx, cz) < 0.2) { okCorners = false; break; }
    if (!okCorners) continue;
    if (bays.some(p => Math.hypot(x - p.bx, z - p.bz) < half * Math.SQRT2 + 3.5)) continue;
    if (nearPiece(x, z, half + 2.5)) continue;                 // corridor between towers and preserved set pieces
    if (placed.some(p => Math.hypot(x - p[0], z - p[1]) < p[2] + half + 2.2)) continue; // walkable corridor between footprints
    placed.push([x, z, half]);
    if (placed.length >= 56) break;
  }
  const buildings = [];
  for (const [x, z, half] of placed) {
    const w = half * 2 * (0.78 + rnd() * .22), d = half * 2 * (0.78 + rnd() * .22);
    const col = palette[(rnd() * palette.length) | 0];
    const h = 6 + rnd() * 14; // Delhi hmax 12 class, lower than Manhattan towers
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col }));
    tower.position.set(x, .6 + h / 2, z); tower.castShadow = tower.receiveShadow = true;
    world.add(tower);
    // roof: flat parapet (STYLE.delhi.roof = 'flat')
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + .4, .5, d + .4), new THREE.MeshLambertMaterial({ color: '#8a6a4a' }));
    cap.position.set(x, .6 + h + .25, z); cap.castShadow = false; world.add(cap);
    addFacade(world, facadeOf('delhi'), rnd, x, z, w, d, h); // delhi facade grammar
    // rectangular footprint collision: perimeter circle rows (game collision is circle-based)
    const r = .8, step = 1.3;
    for (let ix = -w / 2; ix <= w / 2 + .01; ix += step) { worldData.colliders.push({ x: x + ix, z: z - d / 2, r }, { x: x + ix, z: z + d / 2, r }); }
    for (let iz = -d / 2 + step; iz <= d / 2 - step + .01; iz += step) { worldData.colliders.push({ x: x - w / 2, z: z + iz, r }, { x: x + w / 2, z: z + iz, r }); }
    worldData.colliders.push({ x, z, r: Math.min(w, d) * .32 });
    buildings.push([+x.toFixed(1), +z.toFixed(1), +w.toFixed(1), +d.toFixed(1)]);
  }
  // A taxi menu opened while the slice fetched may have cached the old colliders.
  delete worldData._taxiG; delete worldData._curbs;

  // merge-compatible: re-merge the rebuilt world so draw calls drop back to normal levels
  const { mergeStatic } = await import('/merge.js');
  mergeStatic(world, [...(worldData.clouds || []), ...(worldData.butterflies || [])]);

  // pickups inside the slice relocate onto road centrelines
  let pickupsMoved = 0;
  for (const p of (extra.pickups || [])) {
    if (!inBox(p.x, p.z)) continue;
    const s = segs[(rnd() * segs.length) | 0], t = .2 + rnd() * .6;
    p.x = s[0] + (s[2] - s[0]) * t; p.z = s[1] + (s[3] - s[1]) * t;
    if (p.model) p.model.position.set(p.x, worldData.groundY(p.x, p.z) + 1.25, p.z);
    pickupsMoved++;
  }

  worldData.delhiProto = { group, ways: drawn, tris, bbox: [28.60657, 77.22215, 28.61915, 77.23647], mPerUnit: M_PER_U, offset: [OFF_X, OFF_Z], culledM: Math.round(culled * M_PER_U), segs, removed, buildings, pickupsMoved, remerged: true };
  return { ok: true, ways: drawn, tris, removed, buildings: buildings.length, culledM: Math.round(culled * 6.36), pickupsMoved, remerged: true };
}
