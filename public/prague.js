import { terrainRibbon } from './terrain-ribbon.js';
import { ribbonStrip } from './ribbon-strip.js';
import { polygonQuery } from './polygon-query.js';
import { nearOutline } from './near-outline.js';
import { colliderBlocks } from './collider-blocks.js';
/* Update 166 - Prague real-geography group builder (row 15; LOCAL-ONLY under ODbL public-rollout hold).
   PURE geometry: builds a THREE.Group from public/prague-geography.json (OSM derivative, untracked/gitignored,
   never deployed - delhi-roads.json precedent). Sourced anchors: castle 50.09N 14.40E (west-bank hill),
   Charles Bridge 50.08639N 14.41194E, Vltava = OSM rel 19221 (identity corroborated via named centerline way
   25318649, dev/research/prague-PROVENANCE.txt). Transform: dev/harness/praguegeo165.py (9.5 m/u at 50.09N).
   NOT YET a playable place: no colliders, no worldData contract, no fabric/buildings, no spots/places.
   Castle is a STUB composition (massing only, not landmark-quality) pending the sourced builder pass. */
import * as THREE from '/vendor/three.module.js';
import { mergeStatic } from '/merge.js';
import { addFacade, finalizeFacades } from '/cities.js';

const ROAD = { // width in metres -> game units at 9.5 m/u; staggered y layers kill ribbon z-fighting (delhi STYLE pattern)
  primary: { w: 20, c: '#3f4148', y: .82 }, primary_link: { w: 12, c: '#3f4148', y: .825 },
  secondary: { w: 16, c: '#45484f', y: .83 }, secondary_link: { w: 10, c: '#45484f', y: .835 },
  tertiary: { w: 12, c: '#45484f', y: .84 }, tertiary_link: { w: 8, c: '#45484f', y: .845 },
  residential: { w: 10, c: '#4a4d55', y: .85 }, unclassified: { w: 10, c: '#4a4d55', y: .855 },
  living_street: { w: 8, c: '#55585c', y: .86 }, service: { w: 6, c: '#55585c', y: .865 },
  pedestrian: { w: 5, c: '#cfc8b2', y: .87 }, footway: { w: 3, c: '#d8d2bd', y: .875 },
  steps: { w: 2, c: '#d8d2bd', y: .88 }, corridor: { w: 1.5, c: '#d8d2bd', y: .885 },
};
const MPU = 9.5;
//231 local stylized surface detail, one shader per existing material. No textures or added meshes.
function surfaceDetail(mat,water=false){
 mat.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vSurfaceNormal;varying vec3 vSurfaceWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvSurfaceWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vSurfaceNormal=normalize(mat3(modelMatrix)*normal);');
  shader.fragmentShader='varying vec3 vSurfaceNormal;varying vec3 vSurfaceWorld;\n'+shader.fragmentShader;
  const effect=water?`vec2 q=vSurfaceWorld.xz;
   float ripple=sin(q.x*5.0+sin(q.y*2.0))*sin(q.y*7.0+q.x*.7);
   float glint=smoothstep(.72,.98,ripple);
   diffuseColor.rgb*=.94+.025*ripple;diffuseColor.rgb+=vec3(.025,.04,.04)*glint;`:
  `vec3 q=vSurfaceWorld;
   vec3 n=abs(normalize(vSurfaceNormal));
   vec2 uv=n.y>.65?q.xz:n.x>n.z?q.zy:q.xy;
   uv*=vec2(3.0,4.0);float row=floor(uv.y);uv.x+=mod(row,2.0)*.5;
   vec2 brick=floor(uv),f=fract(uv);float edge=min(min(f.x,1.-f.x),min(f.y,1.-f.y));
   float aa=max(fwidth(uv.x),fwidth(uv.y));
   float mortar=1.-smoothstep(.025,.065+aa,edge);
   float detail=1.-smoothstep(.18,.65,aa);
   float grain=fract(sin(dot(brick,vec2(12.9898,78.233)))*43758.5453);
   diffuseColor.rgb*=.81+grain*.22;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.61,mortar*.45*detail);`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+effect);
 };
 mat.customProgramCacheKey=()=>water?'prague-water231':'prague-stone236';
}


function ribbon(pts, wU, color, y) { // flat road ribbon along a polyline. 192: ONE continuous miter-joined strip per way
  // (shared joint edges) - the independent per-segment quads left wedge gaps + z-fighting overlaps at every
  // polyline corner (the jagged/sawtooth edges, Main-visible caveat). Miter = normal of the averaged direction,
  // acute joins beveled at 1.25x miter limit (263). Drape: densified to <=1.2u so the strip follows the hill (186).
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: .95, metalness: 0 });
  const Y = typeof y === 'function' ? y : () => y;
  const dp = [pts[0]]; // densified polyline
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], L = Math.hypot(x2 - x1, z2 - z1);
    if (L < .05) continue;
    const SUB = Math.max(1, Math.ceil(L / 1.2));
    for (let k = 1; k <= SUB; k++) dp.push([x1 + (x2 - x1) * k / SUB, z1 + (z2 - z1) * k / SUB]);
  }
  if (dp.length < 2) return group;
  let {pos,idx}=ribbonStrip(dp,wU,Y);
  if(typeof y==='function'){pos=terrainRibbon(pos,idx,Y);idx=Array.from({length:pos.length/3},(_,i)=>i);}
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  //264 shared height-field normals keep overlapping ribbons from showing triangle lighting seams.
  if(typeof y==='function'){const p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),e=.01,dx=(Y(x+e,z)-Y(x-e,z))/(2*e),dz=(Y(x,z+e)-Y(x,z-e))/(2*e),l=Math.hypot(dx,1,dz);n.setXYZ(i,-dx/l,1/l,-dz/l);}
  }
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; group.add(m);
  return group;
}

/* Update 186 - Hradcany hill: the castle stands on the Hradcany headland ~68m above the Vltava level
   near the Charles Bridge (headland ~250m ASL, river ~182m ASL - old-prague.com, ledger). 68m at the
   9.5 m/u geography scale = 7.2u. Profile: flat-top rounded-rect plateau under the complex + apron,
   smoothstep skirt. SCHEMATIC MASSING (no elevation dataset imported; ODbL/derived-data holds recorded) -
   but the profile function is the SINGLE SOURCE for the terrain skin, walkable groundY, street lift and
   fabric exclusion, so geometry and contact stay consistent by construction. */
const HILL = { cx: -4, cz: -26, rx: 34, rz: 20, skirt: 14, h: 7.2 };
/* ONE solids list shared by the 199 render-clipping AND the collider list - colliders always match the
   clipped/visible footprint. Capsule circle rows approximate the rotated bodies (app.js colliders are
   AABB/circle-only, cross-city contract; the 174 rotated-pier precedent). MODULE scope: populated by
   buildPragueGroup (castle composition), consumed by buildPragueWorld's collider list after it awaits the group. */
const LANDSOLIDS = { circles: [], rects: [], walls: [], palace: null };
const hillY = (x, z) => {
  const qx = Math.abs(x - HILL.cx) - HILL.rx, qz = Math.abs(z - HILL.cz) - HILL.rz;
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  if (sd >= HILL.skirt) return 0;
  const t = 1 - sd / HILL.skirt; return HILL.h * t * t * (3 - 2 * t); // smoothstep: flat on the plateau, eases to 0 at the skirt toe
};

function nearLine(x,z,pts){let best={d:Infinity,x,z};for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],ll=dx*dx+dz*dz||1;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/ll)),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(x-px,z-pz);if(d<best.d)best={d,x:px,z:pz};}return best;}

export async function buildPragueGroup() {
  const res = await fetch('/prague-geography.json');
  if (!res.ok) return { ok: false, err: res.status };
  const geo = await res.json();
  const group = new THREE.Group(); group.name = 'prague-geo';
  //233 lightweight stylized atmosphere: one static dome, no textures/postprocessing/animation.
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
   vertexShader:'varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`varying vec3 vSky;void main(){vec3 d=normalize(vSky);float h=smoothstep(-.08,.75,d.y);
    vec3 c=mix(vec3(.78,.86,.84),vec3(.27,.57,.79),h);
    float sun=dot(d,normalize(vec3(-.60,.90,-.40)));
    c+=vec3(.12,.09,.035)*pow(max(sun,0.),18.);
    gl_FragColor=vec4(c,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  const skyDome=new THREE.Mesh(new THREE.SphereGeometry(440,24,12),skyMat);skyDome.name='prague-atmosphere';skyDome.frustumCulled=false;skyDome.renderOrder=-10;group.add(skyDome);
  // ground slab
  const ground = new THREE.Mesh(new THREE.BoxGeometry(260, 1.2, 260), new THREE.MeshStandardMaterial({ color: '#a8b088', roughness: 1 }));
  ground.position.set(12, 0, 12); group.add(ground); // 173: x,z -118..142 - covers the full +/-110 movement clamp + castle (-24) + fabric (+-106) + every street/river pt (Main 6:46: source extrema alone left sky beside the castle)
  { // 186: terrain skin - the visible ground follows hillY (the flat slab stays as the base/foundation)
    //231 keep original 1.625u samples around the hill, replace coplanar outer grid with four quads.
    const step=260/160,lo=-118,hi=142;
    const xa=lo+Math.floor((-52-lo)/step)*step,xb=lo+Math.ceil((44-lo)/step)*step;
    const za=lo+Math.floor((-60-lo)/step)*step,zb=lo+Math.ceil((8-lo)/step)*step;
    const terrainMat=new THREE.MeshStandardMaterial({color:'#a8b088',roughness:1});
    function patch(x0,x1,z0,z1,nx,nz){const tg=new THREE.PlaneGeometry(x1-x0,z1-z0,nx,nz);tg.rotateX(-Math.PI/2);const tp=tg.attributes.position,cx=(x0+x1)/2,cz=(z0+z1)/2;for(let i=0;i<tp.count;i++)tp.setY(i,.605+hillY(tp.getX(i)+cx,tp.getZ(i)+cz));tg.computeVertexNormals();const m=new THREE.Mesh(tg,terrainMat);m.position.set(cx,0,cz);m.receiveShadow=true;group.add(m);}
    patch(xa,xb,za,zb,Math.round((xb-xa)/step),Math.round((zb-za)/step));
    patch(lo,xa,lo,hi,1,1);patch(xb,hi,lo,hi,1,1);patch(xa,xb,lo,za,1,1);patch(xa,xb,zb,hi,1,1);

  }
  // Vltava: one water polygon per outer ring (ShapeGeometry), bed slightly darker under it
  for (const ring of geo.river_rings) {
    if (ring.length < 3) continue;
    const sh = new THREE.Shape(); ring.forEach(([x, z], i) => i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)); sh.closePath();
    const g2 = new THREE.ShapeGeometry(sh); g2.rotateX(-Math.PI / 2);
    const bed = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: '#3a6a8a', roughness: 1 })); bed.position.y = .62; group.add(bed);
    const waterMat=new THREE.MeshStandardMaterial({color:'#5fbadb',roughness:.4});surfaceDetail(waterMat,true);const wat = new THREE.Mesh(g2.clone(), waterMat); wat.position.y = .68; group.add(wat);
  }
  // streets: class-filtered ribbons (v1 renders every class; class filter param comes with placement work)
  let drawn = 0;
  const CC = [4.13, -35.92], CROT = 0.3534, CAX = [0.9382, -0.3461]; /* 200: REAL cathedral fit (way 1568419039:
     125.2x59.6m, axis -20.2deg, centroid) - superseded the 167 convention anchor FOR THE COMPOSITION ONLY
     (no live app.js consumer, grounded 10:24; geo.anchors.castle stays the projection anchor). */
  /* 201 nave shell segments [t0, t1, across-s] in the rotated cathedral frame (s = +2.925 south face /
     -2.925 north face; wall thickness .45, mesh hw 3.15 - the 200 capsule r 2.75 under-covered the 6.3-deep
     box: corrected here). Door gaps from the mapped corridor-way shell crossings. */
  /* Door gaps are 2.4u game-scaled portals: a mapped 1.6u real portal minus the flanking wall-circle
     margins (r .35 + body .45 each side) leaves NO walkable channel (201 north-door probe), so gaps are
     widened to keep a ~.8u channel; the two south crossings 1.72u apart (450591591/1214753783 + 450586572)
     merge into ONE 3.3u Golden-Gate-scaled portal (recorded). */
  /* 202 CORRECTION: 200 used a mirrored x/z axis. Correct real-fit axis [.9382,-.3461].
     Actual palace and nave shells do not overlap; remove 201d compensating cut and 201i invented landing.
     See ledger202 for superseded portal/interlock/apse claims. */
  const palaceOuterClipped = geo.palace ? geo.palace.outer : null;
  const NAVEWALLS = [[-6.6,6.6,-2.925],[-6.6,6.6,2.925]];
  // Two mapped west approaches (entry ~s-.98 and exit ~s+.55) merge into game-scaled opening.
  const WESTWALLS = [[-2.925,-2.25],[1.75,2.925]];
  const NAVEDOORS = []; // old north/south crossings were artifacts of mirrored axis, retracted.
  LANDSOLIDS.circles.length = LANDSOLIDS.rects.length = 0; LANDSOLIDS.walls = []; LANDSOLIDS.palace = null; // rebuild-safe
  {
    /* 201: the nave is ENTERABLE - wall capsule rows (r .35 every .6u) along the shell segments with the
       sourced door gaps (corridor-way shell crossings: S t~-5.1/-3.38, N t~.96/4.73 - dev/research/prague-cathedral-interior.json).
       Rows built from NAVEWALLS below (one data source for meshes + colliders + clipping; 197 contract). */
    // 203: source footprint wall bands. Circle rows sampled along both band edges, radius .10.
    for(const part of geo.cathedral203.walls)for(const ring of [part.outer,...part.holes])for(let i=0;i+1<ring.length;i++){const a=ring[i],b=ring[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(len/.25));for(let j=0;j<=n;j++)LANDSOLIDS.circles.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n,.10]);}
    // 204: old displaced tower floor circles removed; sourced upper parts begin above retained game hall.
    LANDSOLIDS.circles.push([3.06,-41.83,.85]);
    /* 200 palace: REAL footprint rings (geo.palace, relation 6311645; outer minus inner courtyard hole).
       Render clipping tests the rings exactly; colliders follow the walls as circle rows (r .55 every .6u,
       capsule approx). 201f: tunnel 32119975 opened; other palace passages remain unmodeled. */
    if (geo.palace) {
      LANDSOLIDS.palace = { outer: palaceOuterClipped }; // 201d: the CLIPPED ring (one source for colliders + render clip + mesh)
      LANDSOLIDS.walls = []; // collider-only: clip tests the rings exactly (inLandmark below), so wall-hugging paths stay visible up to the wall
      // 201f: keyhole footprint preserves mapped inner void + widened tunnel; centers kept >= .7u inside
      // the ring so the .15 clip margin never reaches past the wall; wall circles above cover the boundary band.
      {
        const xs = palaceOuterClipped.map(p => p[0]), zs = palaceOuterClipped.map(p => p[1]); // 201d: clipped
        const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
        for (let fx = x0 + .7; fx < x1; fx += 1) for (let fz = z0 + .7; fz < z1; fz += 1) {
          let deep = true;
          for (const [ox, oz] of [[.7, 0], [-.7, 0], [0, .7], [0, -.7], [.5, .5], [-.5, .5], [.5, -.5], [-.5, -.7]]) if (!inPoly(fx + ox, fz + oz, palaceOuterClipped)) { deep = false; break; } // 201d: clipped
          if (deep) LANDSOLIDS.circles.push([fx, fz, .55]);
        }
      }
      for (const ring of [palaceOuterClipped]) for (let i = 0; i < ring.length; i++) { // 201d: clipped
        const [ax, az] = ring[i], [bx3, bz3] = ring[(i + 1) % ring.length], L = Math.hypot(bx3 - ax, bz3 - az);
        for (let d = 0; d <= L; d += .5) LANDSOLIDS.walls.push([ax + (bx3 - ax) * d / (L || 1), az + (bz3 - az) * d / (L || 1), .3]);
      }
    }
    for(const q of geo.fabric216||[])for(const c of q.colliders)LANDSOLIDS.circles.push(c);
    // 202b: clipped source Provost polygon, same ring as mesh. Boundary rows cover this shallow solid.
    const PR=geo.provost202b||[];for(let i=0;i+1<PR.length;i++){const a=PR[i],b=PR[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.max(1,Math.ceil(len/.35));for(let j=0;j<=n;j++)LANDSOLIDS.circles.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n,.16]);}

  }
  const inLandmark = (x, z) => LANDSOLIDS.circles.some(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) < sr + .15) || LANDSOLIDS.rects.some(([x0, z0, x1, z1]) => x >= x0 - .15 && x <= x1 + .15 && z >= z0 - .15 && z <= z1 + .15)
    || (LANDSOLIDS.palace && inPoly(x, z, LANDSOLIDS.palace.outer));
  const clipLandmark = pts => { // 199: drawn ways must not render THROUGH solid landmark meshes; 200: shared LANDSOLIDS. RENDER-ONLY; the convention-vs-real displacement limitation is RESOLVED by the 200 real fit (remaining: indoor corridor ways under real buildings - correct semantics, recorded)
    const runs = []; let cur = [];
    for (const q of pts) {
      if (inLandmark(q[0], q[1])) { if (cur.length > 1) runs.push(cur); cur = []; }
      else cur.push(q);
    }
    if (cur.length > 1) runs.push(cur);
    return runs;
  };
  for (const [cls, pts] of geo.ways) {
    const st = ROAD[cls]; if (!st) continue;
    for (const run of clipLandmark(pts)) { group.add(ribbon(run, st.w / MPU, st.c, (x, z) => st.y + hillY(x, z))); drawn++; } // 186: ribbons follow the hill (per-vertex y); 199: split runs around landmark solids
  }
  if(geo.gameWalk216)group.add(ribbon(geo.gameWalk216,1.05,'#d8d2bd',(x,z)=>.892+hillY(x,z))); //216 explicit game-clearance walkway, not exact source centerline
  /* Update 200 - Prague Castle composition REWORK (replaces the 171 convention-anchored placement). Fitted to the
     REAL cathedral polygon (OSM way 1568419039, dev/research/prague-cathedral.json: 125.2x59.6m = the sourced
     124x60, principal axis -20.2deg off east, centroid game (4.13,-35.92)) and the real flanking ranges
     (dev/research/prague-castle-buildings.json; Old Royal Palace relation 6311645 -> x 7.7..17.3, z -37.2..-28.4).
     The 167 anchor convention is superseded FOR THE COMPOSITION ONLY (no live app.js consumer, grounded 10:24;
     geo.anchors.castle stays as the projection anchor). Sizes sourced (en.wikipedia.org/wiki/St._Vitus_Cathedral,
     .../Prague_Castle). Skipped (recorded): the 26x23m south chapel (485764471) and the courtyard obelisk -
     annex/catalog detail beyond the landmark read. Colliders come from LANDSOLIDS below (defined before the ways
     loop so 199's render clipping shares one source). */
  // CC/CROT/CAX + LANDSOLIDS are defined before the ways loop (shared with render clipping)
  const CBASE = .6 + HILL.h; // 186: the whole complex stands on the flat plateau top (hillY = HILL.h across the footprint)
  const stone = new THREE.MeshStandardMaterial({ color: '#c8b898', roughness: .9 }), roofm = new THREE.MeshStandardMaterial({ color: '#3a7a5a', roughness: .8 });
  const broof = new THREE.MeshStandardMaterial({ color: '#a84830', roughness: .9, flatShading: true });
  const put2 = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  const putR = (m, x, y, z, ry) => { m.rotation.y = ry; return put2(m, x, y, z); };
  const gable = (w, d, rise, color) => { // 173: explicit fitted gable prism (169 fabric idiom, Main 6:46)
    const rvx = new Float32Array([-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 0, d / 2, -w / 2, 0, d / 2, -w / 2, rise, 0, w / 2, rise, 0]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(rvx, 3));
    g.setIndex([0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 0, 4, 3, 1, 5, 2]); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true, side: THREE.DoubleSide }));
    if (d > w) m.rotation.y = Math.PI / 2;
    m.castShadow = true; return m;
  };
  const putGable = (w, d, rise, color, x, y, z, ry) => { const m = gable(w, d, rise, color); m.position.set(x, y, z); if (ry) m.rotation.y = (d > w ? Math.PI / 2 : 0) + ry; group.add(m); return m; };
  const B = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), c);
  // St Vitus: rotated to the corrected real axis; 202: ENTERABLE nave - shell walls with sourced door gaps (NAVEWALLS,
  // shared with the colliders), open west front + solid east wall, gable roof (its bottom face is the interior ceiling),
  // eastern choir apse, Great South Tower (102.8m), twin west front towers (82m)
  // 203: wall geometry, floor and ceiling use the actual saved source outline, not rectangular fit.
  const sourceShape=(outer,holes=[])=>{const sh=new THREE.Shape();outer.forEach(([x,z],i)=>i?sh.lineTo(x,-z):sh.moveTo(x,-z));for(const ring of holes){const h=new THREE.Path();ring.forEach(([x,z],i)=>i?h.lineTo(x,-z):h.moveTo(x,-z));sh.holes.push(h);}return sh;};
  for(const part of geo.cathedral203.walls){const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(part.outer,part.holes),{depth:5.5,bevelEnabled:false}),stone);m.rotation.x=-Math.PI/2;m.position.y=CBASE;m.castShadow=m.receiveShadow=true;group.add(m);}
  // West entrance lintel follows game portal, opaque above2.6u, no floor-level blocking.
  putR(B(.6,2.9,3.35,stone),CC[0]+CAX[0]*-6.03-CAX[1]*-.225,CBASE+4.05,CC[1]+CAX[1]*-6.03+CAX[0]*-.225,CROT);
  /* 201c: interior substance (Main 11:14 - "dark flat untextured masses"): stone floor slab just under the
     ribbon layers (top at hillY+.86, corridor ribbons .885 stay above), a light schematic column arcade
     (design cue, not a mapped replica - the real arcade positions are unmapped in our extract; colliders
     from the same constants), and warm interior point lights (the hall is fully sun-shadowed). */
  for(const [y,depth,color] of [[CBASE+.23,.06,'#9a917e'],[CBASE+5.5,.12,'#cfc4a8']]){const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(geo.cathedral203.footprint),{depth,bevelEnabled:false}),new THREE.MeshStandardMaterial({color,roughness:.95}));m.rotation.x=-Math.PI/2;m.position.y=y;m.receiveShadow=true;group.add(m);}
  const colm = new THREE.MeshStandardMaterial({ color: '#d4c8ac', roughness: .85 });
  for (const cs of [-2.55, 2.55]) for (const ct of [-3.5, 0, 3.5]) {
    putR(new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, 4.6, 8), colm), CC[0] + CAX[0] * ct - CAX[1] * cs, CBASE + 2.3, CC[1] + CAX[1] * ct + CAX[0] * cs, CROT);
    LANDSOLIDS.circles.push([CC[0] + CAX[0] * ct - CAX[1] * cs, CC[1] + CAX[1] * ct + CAX[0] * cs, .3]);
  }
  /* 201g: Gothic architectural read, not a surveyed interior. Pointed stained-glass decorative panels,
     west rose cue and overhead crossed rib bays. Original colored facets, no copied art or texture.
     Fixed dimensions are game composition choices; panels sit on opaque walls (not true apertures).
     Sources: cathedral official works-of-art (stained glass); Radio Prague Builders (ribs + west rose).
     All additions remain above 2.8u, no changed foot-level solids or mapped circulation. */
  const glassCols = ['#537da4','#9c4960','#b6a75c','#4c8d87','#7b659e','#b67854'];
  const glassM = glassCols.map(color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.5,roughness:.6,side:THREE.DoubleSide}));
  const lead = new THREE.MeshStandardMaterial({color:'#3f4240',roughness:.85});
  const paneTri = (pts,mi,parent) => {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pts.flat()),3));g.setIndex([0,1,2]);g.computeVertexNormals();parent.add(new THREE.Mesh(g,glassM[mi%glassM.length]));
  };
  const pointed = (ct,cs) => {
    const pg = new THREE.Group();pg.scale.x=.65; const outline=[[-.56,0],[.56,0],[.56,1.35],[.32,1.76],[0,2.04],[-.32,1.76],[-.56,1.35]];
    const center=[0,.92,0];
    for(let i=0;i<outline.length;i++){let a=outline[i],b=outline[(i+1)%outline.length];paneTri([center,[...a,0],[...b,0]],i+Math.round(ct+5),pg);}
    for(const pts of [outline.concat([outline[0]]),[[0,0],[0,1.98]],[[-.56,.69],[.56,.69]],[[-.56,1.32],[.56,1.32]]]){
      const curve=new THREE.CatmullRomCurve3(pts.map(([x,y])=>new THREE.Vector3(x,y,.008)),false,'centripetal');
      pg.add(new THREE.Mesh(new THREE.TubeGeometry(curve,pts.length*3,.035,5,false),lead));
    }
    putR(pg,CC[0]+CAX[0]*ct-CAX[1]*cs,CBASE+2.92,CC[1]+CAX[1]*ct+CAX[0]*cs,CROT);
  };
  for(const [t,sv] of geo.cathedral203.panels||[])pointed(t,sv+(sv>0?-.48:.48)); // procedural panels fitted to source cross-sections, not surveyed windows
  // West rose sits in the solid west front, inside and outside; radial colored sectors + stone/lead tracery.
  for(const te of [-6.42,-5.55]) {
    const rose=new THREE.Group(),R=1.12;
    for(let i=0;i<12;i++) {const a=i*Math.PI/6,b=(i+1)*Math.PI/6;paneTri([[0,0,0],[R*Math.cos(a),R*Math.sin(a),0],[R*Math.cos(b),R*Math.sin(b),0]],i,rose);
      const bar=B(R,.035,.035,lead);bar.position.set(R/2*Math.cos(a),R/2*Math.sin(a),.015);bar.rotation.z=a;rose.add(bar);}
    const rim=new THREE.Mesh(new THREE.TorusGeometry(R,.075,6,36),colm);rose.add(rim);
    rose.rotation.y=CROT+Math.PI/2;rose.position.set(CC[0]+CAX[0]*te,CBASE+3.8,CC[1]+CAX[1]*te);group.add(rose);
  }
  const ribmat = new THREE.MeshStandardMaterial({color:'#b3a68b',roughness:.9});
  const rib = (points) => {const curve=new THREE.CatmullRomCurve3(points.map(([t,y,s])=>new THREE.Vector3(CC[0]+CAX[0]*t-CAX[1]*s,CBASE+y,CC[1]+CAX[1]*t+CAX[0]*s)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,28,.065,6,false),ribmat);mesh.castShadow=true;group.add(mesh);};
  for(const ct of [-3.5,0,3.5]) rib([[ct,4.3,-2.2],[ct,4.9,-1.3],[ct,5.35,0],[ct,4.9,1.3],[ct,4.3,2.2]]);
  for(const [a,b] of [[-3.5,0],[0,3.5]]) for(const side of [-1,1]) rib([[a,4.3,side*2.2],[(3*a+b)/4,4.95,side*1.1],[(a+b)/2,5.35,0],[(a+3*b)/4,4.95,-side*1.1],[b,4.3,-side*2.2]]);
  for (const lt of [-4, 0, 4]) { const pl = new THREE.PointLight('#ffd9a0', 2.4, 14, 1); pl.position.set(CC[0] + CAX[0] * lt, CBASE + 3.4, CC[1] + CAX[1] * lt); group.add(pl); } // 2.4: down-facing interior surfaces get ONLY the hemisphere's green ground tint (#5f9f5a) otherwise - the warm interior light must dominate (201c diag)
  /* 201e: altar platform + two candle stands as the east-end focal point (schematic cues - the real altar is
     unmapped in our extract). Placement is VERIFIED clear of every mapped interior ribbon (checked against the
     corridor/footway/steps/pedestrian segs in the nave frame): altar at t 5.7 s .65 sits between the choir
     pedestrian floor (s <= 0), the south footway (ends t 5.3) and the south steps (s >= 1.9); stands at s 1.35
     clear the s 1.4 corridor (ends t 4.5) and the s >= 2.5 footway. NO pews: the mapped mid-nave is dense
     circulation (spine + side corridors + door connectors) - benches would sit ON mapped routes. */
  putR(B(.9, .9, .5, colm), CC[0] + CAX[0] * 4.5 - CAX[1] * -.35, CBASE + .45, CC[1] + CAX[1] * 4.5 + CAX[0] * -.35, CROT);
  LANDSOLIDS.circles.push([CC[0] + CAX[0] * 4.5 - CAX[1] * -.35, CC[1] + CAX[1] * 4.5 + CAX[0] * -.35, .5]);
  for (const ct of [4.0,5.0]) {
    putR(new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 1.6, 6), colm), CC[0] + CAX[0] * ct - CAX[1] * -.55, CBASE + .8, CC[1] + CAX[1] * ct + CAX[0] * -.55, CROT);
    LANDSOLIDS.circles.push([CC[0] + CAX[0] * ct - CAX[1] * -.55, CC[1] + CAX[1] * ct + CAX[0] * -.55, .15]);
  }
  {const cap=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(geo.cathedral203.footprint),{depth:.18,bevelEnabled:false}),roofm);cap.rotation.x=-Math.PI/2;cap.position.y=CBASE+5.62;cap.castShadow=true;group.add(cap);} // 203 flat source-outline roof, not real roof replica
  // 204: source-part upper silhouette.40m datum is mapped to5.62u above tall game hall;
  // lower tower footprints remain walkable game space. Not a surveyed interior or elevation mesh.
  const roofColor=c=>c==='copper'?'#487466':c==='sand'?'#c8b898':c;
  for(const q of geo.cathedral204||[]){
    if(q.bodyTop>5.63){const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(q.ring),{depth:q.bodyTop-5.62,bevelEnabled:false}),stone);m.rotation.x=-Math.PI/2;m.position.y=CBASE+5.62;m.castShadow=m.receiveShadow=true;group.add(m);}
    const mat=new THREE.MeshStandardMaterial({color:roofColor(q.color),roughness:.86,side:THREE.DoubleSide});
    const r=q.rect,c=[r.reduce((a,p)=>a+p[0],0)/4,r.reduce((a,p)=>a+p[1],0)/4],v=[],ix=[];
    const tri=(a,b,c)=>{const n=v.length/3;v.push(...a,...b,...c);ix.push(n,n+1,n+2);};
    const pt=(p,y)=>[p[0],CBASE+y,p[1]];
    if(['gabled','hipped'].includes(q.shape)){
      let a=r[0],b=r[1],d=r[3];if(Math.hypot(b[0]-a[0],b[1]-a[1])<Math.hypot(d[0]-a[0],d[1]-a[1])){r.push(r.shift());a=r[0];b=r[1];}
      let u=[(r[0][0]+r[3][0])/2,(r[0][1]+r[3][1])/2],w=[(r[1][0]+r[2][0])/2,(r[1][1]+r[2][1])/2];
      if(q.shape==='hipped'){u=u.map((n,i)=>n*.84+c[i]*.16);w=w.map((n,i)=>n*.84+c[i]*.16);}
      tri(pt(r[0],q.bodyTop),pt(r[1],q.bodyTop),pt(w,q.top));tri(pt(r[0],q.bodyTop),pt(w,q.top),pt(u,q.top));tri(pt(r[2],q.bodyTop),pt(r[3],q.bodyTop),pt(u,q.top));tri(pt(r[2],q.bodyTop),pt(u,q.top),pt(w,q.top));tri(pt(r[3],q.bodyTop),pt(r[0],q.bodyTop),pt(u,q.top));tri(pt(r[1],q.bodyTop),pt(r[2],q.bodyTop),pt(w,q.top));
    }else if(['onion','dome'].includes(q.shape)){
      const rx=Math.hypot(r[1][0]-r[0][0],r[1][1]-r[0][1])/2,rz=Math.hypot(r[3][0]-r[0][0],r[3][1]-r[0][1])/2;
      const profile=q.shape==='onion'?[[0,1],[.2,1.22],[.45,.8],[.72,.3],[1,0]]:[[0,1],[.4,.9],[.75,.6],[1,0]];
      for(let j=0;j+1<profile.length;j++)for(let i=0;i<16;i++){const p=(k,l)=>{const [h,sc]=profile[l],an=k*Math.PI/8;return [c[0]+rx*sc*Math.cos(an),CBASE+q.bodyTop+(q.top-q.bodyTop)*h,c[1]+rz*sc*Math.sin(an)];};tri(p(i,j),p(i+1,j),p(i+1,j+1));tri(p(i,j),p(i+1,j+1),p(i,j+1));}
    }else for(let i=0;i<q.ring.length-1;i++)tri(pt(q.ring[i],q.bodyTop),pt(q.ring[i+1],q.bodyTop),pt(c,q.shape==='pyramidal'?q.top:q.bodyTop));
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(v),3));g.setIndex(ix);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.castShadow=m.receiveShadow=true;group.add(m);
  }
  // Real flanking ranges (replace the 171 oversized 323m schematic wings): Old Royal Palace (east, relation 6311645),
  // the north range (civic 1568419100 + Kapitulni dekanstvi 1568419127, ~-19deg), the Powder Tower, the Old Provostry (south, 28.8deg)
  if (geo.palace) { // 200: the REAL palace footprint as an extruded prism (cities.js:391 ExtrudeGeometry precedent); flat cap (real roofs vary - recorded simplification); 201d: west corner clipped at the nave east wall (above)
    const sh = new THREE.Shape(); palaceOuterClipped.forEach(([px, pz], i) => (i ? sh.lineTo(px, -pz) : sh.moveTo(px, -pz)));
    // 201f: earlier self-intersection claim retracted. Simple mapped inner ring + game-width tunnel
    // are cut out of the same ring used by mesh, collision fill, boundary rows and ribbon clipping.
    const pal = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 4.5, bevelEnabled: false }), stone);
    pal.rotation.x = -Math.PI / 2; pal.position.y = CBASE; pal.castShadow = pal.receiveShadow = true; group.add(pal);
    // Covered mapped tunnel: retain upper palace mass, avatar clears the 2.8u underside.
    for (const ring of geo.palace.passageRoofs || []) {
      const rs = new THREE.Shape(); ring.forEach(([x,z],i) => i ? rs.lineTo(x,-z) : rs.moveTo(x,-z));
      const rm = new THREE.Mesh(new THREE.ExtrudeGeometry(rs,{depth:1.7,bevelEnabled:false}),stone);
      rm.rotation.x=-Math.PI/2; rm.position.y=CBASE+2.8; rm.castShadow=rm.receiveShadow=true; group.add(rm);
    }
    const passageLight = new THREE.PointLight('#ffdfb0',2.0,7,1); passageLight.position.set(12.7,CBASE+2.3,-30.2); group.add(passageLight);
    const passageFloor = new THREE.Mesh(new THREE.PlaneGeometry(2.4,2.1), new THREE.MeshStandardMaterial({color:'#c9bfa7',roughness:.95}));
    passageFloor.rotation.x=-Math.PI/2; passageFloor.rotation.z=-Math.atan2(.268,.620);
    passageFloor.position.set(12.692,CBASE+.025,-30.178); passageFloor.receiveShadow=true; group.add(passageFloor);
 // (sx,sy) -> (x, 0, -sy): shape y = -world z
  }
  // 202: separate north ranges from each saved footprint's rotated rectangle, not one reversed-axis wing.
  for(const q of geo.fabric216||[]){const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(q.ring),{depth:q.h,bevelEnabled:false}),stone);m.rotation.x=-Math.PI/2;m.position.y=CBASE;m.castShadow=m.receiveShadow=true;group.add(m);const cap=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(q.ring),{depth:.12,bevelEnabled:false}),new THREE.MeshStandardMaterial({color:'#a84830',roughness:.95}));cap.rotation.x=-Math.PI/2;cap.position.y=CBASE+q.h;group.add(cap);}
  putR(B(1.9, 6, 1.9, stone), 3.06, CBASE + 3, -41.83, 0); putR(new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.8, 4), broof), 3.06, CBASE + 6 + 1.4, -41.83, 0); // Powder Tower
  if(geo.provost202b){const sh=new THREE.Shape();geo.provost202b.forEach(([x,z],i)=>i?sh.lineTo(x,-z):sh.moveTo(x,-z));const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:4,bevelEnabled:false}),stone);m.rotation.x=-Math.PI/2;m.position.y=CBASE;m.castShadow=m.receiveShadow=true;group.add(m);} // 202b no intruding gable

  //206 mapped small arch bridge north of Charles westgate. One band drives visible deck and dry walk mask.
  if(geo.bridge206){const q=geo.bridge206,[a,b]=q.pts,dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),yaw=-Math.atan2(dz,dx);const mat=new THREE.MeshStandardMaterial({color:'#baae90',roughness:.95});putR(B(L+.55,.18,q.width,mat),(a[0]+b[0])/2,.80,(a[1]+b[1])/2,yaw);for(const sd of [-1,1])putR(B(L+.55,.22,.10,mat),(a[0]+b[0])/2-dz/L*sd*q.width/2,1.02,(a[1]+b[1])/2+dx/L*sd*q.width/2,yaw);}
  //207 source-connected Charles centerline replaces shifted point-anchor rectangle.
  const bpts=geo.bridge207.pts,bmat=new THREE.MeshStandardMaterial({color:'#a89878',roughness:.9});
  group.add(ribbon(bpts,geo.bridge207.width,'#a89878',1.20));
  // Shared segment deck slabs; overlaps at joints are below the continuous top ribbon.
  for(let i=0;i+1<bpts.length;i++){const a=bpts[i],b=bpts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),yaw=-Math.atan2(dz,dx);putR(B(L+.04,.44,geo.bridge207.width,bmat),(a[0]+b[0])/2,.97,(a[1]+b[1])/2,yaw);for(const side of [-1,1])putR(B(L+.04,.27,.09,bmat),(a[0]+b[0])/2-dz/L*side*.78,1.33,(a[1]+b[1])/2+dx/L*side*.78,yaw);}
  //207 unequal Lesser Town pair: source footprints above2.6u; game portal lower bodies retreat from narrow source gap.
  for(const q of geo.bridge207.towers){const tall=q.id===839278891,base=.62,body=tall?q.h:1.8,roofRise=tall?2.1:1.3,mat=new THREE.MeshStandardMaterial({color:tall?'#b3a58b':'#c2b69c',roughness:.95});
    // Source gap ~.6u cannot fit .9u avatar. Lower block inner face deliberately recessed for2u game gate.
    const x0=Math.min(...q.ring.map(p=>p[0])),x1=Math.max(...q.ring.map(p=>p[0]));
    const z0=tall?Math.min(...q.ring.map(p=>p[1])):7.75,z1=tall?5.35:Math.max(...q.ring.map(p=>p[1]));
    put2(B(x1-x0,2.6,z1-z0,mat),(x0+x1)/2,base+1.3,(z0+z1)/2);LANDSOLIDS.rects.push([x0,z0,x1,z1]);
    if(body>2.6){const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(q.ring),{depth:body-2.6,bevelEnabled:false}),mat);m.rotation.x=-Math.PI/2;m.position.y=base+2.6;group.add(m);}
    const r=q.rect,cx=q.cx,cz=q.cz,rr=Math.max(...r.map(p=>Math.hypot(p[0]-cx,p[1]-cz)));putR(new THREE.Mesh(new THREE.ConeGeometry(rr,roofRise,4),new THREE.MeshStandardMaterial({color:'#414741',roughness:.9})),cx,base+Math.max(body,2.6)+roofRise/2,cz,Math.PI/4);
    if(tall){for(const [x,z] of r)put2(new THREE.Mesh(new THREE.ConeGeometry(.10,.85,5),bmat),x,base+body+.42,z);}
  }
  put2(B(1.15,.65,2.4,bmat),51.55,3.55,6.55); // stylized gate lintel,3.2u underside, not measured arch
  {const q=geo.bridge207.east,base=1.2,top=47/9.5-1.9,r=q.rect,w=Math.hypot(r[1][0]-r[0][0],r[1][1]-r[0][1]),d=Math.hypot(r[3][0]-r[0][0],r[3][1]-r[0][1]);
    const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(q.ring),{depth:top-2.6,bevelEnabled:false}),bmat);m.rotation.x=-Math.PI/2;m.position.y=base+2.6;group.add(m);
    // Lower piers kept outside game2u passage around source path. Source min_height9m not used as avatar clearance.
    for(const side of [-1,1]){const z=q.cz+side*1.0;put2(B(1.0,2.6,.40,bmat),q.cx,base+1.3,z);LANDSOLIDS.rects.push([q.cx-.5,z-.2,q.cx+.5,z+.2]);}
    put2(B(1.12,.35,2.4,bmat),q.cx,base+2.6,q.cz);
    putR(new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.72,1.9,4),new THREE.MeshStandardMaterial({color:'#3f4544',roughness:.9})),q.cx,base+top+.95,q.cz,Math.PI/4);
  }
  //250 stylized upper gate facade relief, not surveyed window/cornice locations.
  // All ornaments stay above the existing 2.6u game portal clearance; no floor solids change.
  const gateDark=new THREE.MeshStandardMaterial({color:'#394449',roughness:.9});
  const gateTrim=new THREE.MeshStandardMaterial({color:'#c8b898',roughness:.95});
  {const q=geo.bridge207.east,y=1.2+2.6;
    for(const dy of [0,.42])put2(B(1.23,.10,2.46,gateTrim),q.cx,y+dy,q.cz);
    for(const side of [-1,1])for(const zoff of [-.66,.66]){
      put2(B(.035,.26,.14,gateDark),q.cx+side*.59,y+.22,q.cz+zoff);
      put2(B(.055,.055,.23,gateTrim),q.cx+side*.605,y+.055,q.cz+zoff);
    }
    // shallow stone corbels below the projecting upper cornice
    for(const side of [-1,1])for(const zoff of [-.9,-.3,.3,.9])put2(B(.16,.16,.13,gateTrim),q.cx+side*.59,y+.31,q.cz+zoff);
  }
  for(const q of geo.bridge207.towers){
    const tall=q.id===839278891,body=Math.max(q.h,2.6),y=.62+body;
    const x0=Math.min(...q.ring.map(p=>p[0])),x1=Math.max(...q.ring.map(p=>p[0])),z0=Math.min(...q.ring.map(p=>p[1])),z1=Math.max(...q.ring.map(p=>p[1]));
    put2(B(x1-x0+.15,.12,z1-z0+.15,gateTrim),(x0+x1)/2,y-.03,(z0+z1)/2);
    if(tall)for(const side of [-1,1]){
      put2(B(.035,.68,.22,gateDark),side<0?x0-.025:x1+.025,y-.72,q.cz);
      put2(B(.07,.08,.34,gateTrim),side<0?x0-.035:x1+.035,y-1.08,q.cz);
    }
  }
  // Piers/statue posts stay schematic spacing along arc, not replica placement.
  const cum=[0];for(let i=1;i<bpts.length;i++)cum.push(cum.at(-1)+Math.hypot(bpts[i][0]-bpts[i-1][0],bpts[i][1]-bpts[i-1][1]));
  const atBridge=d=>{let i=1;while(cum[i]<d&&i<cum.length-1)i++;const f=(d-cum[i-1])/(cum[i]-cum[i-1]),a=bpts[i-1],b=bpts[i];return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,Math.atan2(b[1]-a[1],b[0]-a[0])];};
  for(let k=1;k<=15;k++){const [x,z,an]=atBridge(cum.at(-1)*k/16);putR(B(.65,.9,1.7,bmat),x,.3,z,-an);for(const side of [-1,1])put2(B(.14,.48,.14,bmat),x-Math.sin(an)*side*.7,1.66,z+Math.cos(an)*side*.7);}
  { //212 game pier deck+piles, north of bridge at z16, not a mapped actual pier
    const dkMat = new THREE.MeshStandardMaterial({ color: '#8a6f4d', roughness: .95 }), dkDark = new THREE.MeshStandardMaterial({ color: '#6d5638', roughness: .95 });
    const dk = new THREE.Mesh(new THREE.BoxGeometry(5.6, .16, 1.6), dkMat); dk.position.set(102.2, .70, 16); dk.castShadow = true; group.add(dk);
    for (const px of [99.8, 102.2, 104.6]) for (const pz of [15.45, 16.55]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.1, 6), dkDark); post.position.set(px, .35, pz); post.castShadow = true; group.add(post);
    }
  }
  { /* Update 188 - end-of-navigable-water marker at the z=110 end of the drawn water. 193 ORIENTATION
       CORRECTION (Main 9:26): real-world north is -z in this slice (castle anchor lat 50.09 -> z -26,
       bridge lat 50.0865 -> z +16.3), so z=110 is the real-SOUTH (upstream, Smichov-side) end - the 188
       "north trim" label was inverted. The drawn Vltava continues past the boat bound (z 130 ring vs
       z 110 clamp): the bound was INVISIBLE (Main 8:46: open UX limitation). A safety-boom float line
       at z 110 makes the stop visible. SCHEMATIC marker, not a placed replica: the real next structure
       DOWNSTREAM (real north, the OTHER in-game end at z -71) is the Stvanice weir/lock (rkm 50.69,
       ~2km beyond the trim - cs.wikipedia.org/wiki/Zdymadlo_%C5%A0tvanice, ledger). */
    const boomMat = new THREE.MeshStandardMaterial({ color: '#e8a020', roughness: .7 });
    for (let bx2 = 64; bx2 <= 104; bx2 += 2) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .5, 8), boomMat);
      f.position.set(bx2, .68 + .12, 110); f.castShadow = true; group.add(f);
    }
  }
  { /* Update 194 - schematic quay-wall edge along the in-trim historic banks. SOURCED character: the
       central-Prague Vltava is EMBANKED - raised granite-block quay walls built progressively 1841-1912,
       primarily as flood protection, the wall rising from the water with a stone cornice + railing
       (cs.wikipedia.org/wiki/Vltavsk%C3%A1_n%C3%A1b%C5%99e%C5%BE%C3%AD_v_Praze,
       prague-boats.cz/smetana-embankment, archmap.cz/cs/objekt/77535 - exact URLs in the ledger).
       SCHEMATIC: low stone edge (water .68 -> lip .88, ~1.9m at the 9.5 m/u ground scale; the sources
       give no wall freeboard, so no real-world height claim). VISUAL ONLY - no collider: a wall collider
       would break the 181/185 walk-up boat boarding (qualified both directions), so the lip reads as a
       step-over curb into the existing wade behavior; a real contact change is a design fork for Main.
       Gaps: the 184 pier + 185 boarding bulge mouth (x 96..106.5, z 17..25.5) and the deck band (the
       flat deck underside is .7; the wall reads as meeting the bridge abutment). In-trim city reach
       only (z -56..56): the drawn water and the real embankments both continue (Rasinovo 1878-1906,
       Holesovice 1900-12 - ledger), but walling empty banks would float in nothing. */
    const ring0 = geo.river_rings[0];
    const qChains = []; let qCur = [];
    for (const [x, z] of ring0) { if (z >= -56 && z <= 56) qCur.push([x, z]); else { if (qCur.length > 1) qChains.push(qCur); qCur = []; } }
    if (qCur.length > 1) qChains.push(qCur);
    const inQuayGap = (x, z) => (x > 96 && x < 106.5 && z > 17 && z < 25.5) || (() => { return nearLine(x,z,geo.bridge207.pts).d<1.3; })();
    const quayMat = new THREE.MeshStandardMaterial({ color: '#8d8a80', roughness: 1, side: THREE.DoubleSide });
    const QTOP = .88, QBOT = .5, QTH = .09; // lip height / buried toe / half-thickness
    for (const ch of qChains) {
      const qn = ch.length, qPos = [], qIdx = [];
      for (let i = 0; i < qn; i++) {
        const [x, z] = ch[i], [px, pz] = ch[Math.max(0, i - 1)], [qx, qz] = ch[Math.min(qn - 1, i + 1)];
        let qdx = qx - px, qdz = qz - pz; const qdl = Math.hypot(qdx, qdz) || 1; qdx /= qdl; qdz /= qdl;
        const qnx = -qdz * QTH, qnz = qdx * QTH;
        qPos.push(x - qnx, QBOT, z - qnz, x - qnx, QTOP, z - qnz, x + qnx, QTOP, z + qnz, x + qnx, QBOT, z + qnz); // inner-bottom, inner-top, outer-top, outer-bottom
        if (i) { const qmx = (x + ch[i - 1][0]) / 2, qmz = (z + ch[i - 1][1]) / 2; if (!inQuayGap(qmx, qmz)) { const qa = (i - 1) * 4, qb = i * 4; qIdx.push(qa, qb, qb + 1, qa, qb + 1, qa + 1, qa + 1, qb + 1, qb + 2, qa + 1, qb + 2, qa + 2, qa + 2, qb + 2, qb + 3, qa + 2, qb + 3, qa + 3); } }
      }
      const quayG = new THREE.BufferGeometry();
      quayG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(qPos), 3));
      quayG.setIndex(qIdx); quayG.computeVertexNormals();
      group.add(new THREE.Mesh(quayG, quayMat));
    }
  }

  //209 closed source-way street edge footprints. No relation courtyards inferred or public access promise.
  const houseWall=new THREE.MeshStandardMaterial({color:'#c5b89c',roughness:.96}),houseRoof=new THREE.MeshStandardMaterial({color:'#99543b',roughness:.95,side:THREE.DoubleSide}),housePane=new THREE.MeshStandardMaterial({color:'#35484d',roughness:.9});
  for(const q of [...(geo.fabric209||[]),...(geo.fabric212||[])]){const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(q.ring),{depth:q.h,bevelEnabled:false}),houseWall);mesh.rotation.x=-Math.PI/2;mesh.position.y=.62;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    const roof=new THREE.Mesh(new THREE.ExtrudeGeometry(sourceShape(q.ring),{depth:.06,bevelEnabled:false}),houseRoof);roof.rotation.x=-Math.PI/2;roof.position.y=.62+q.h;group.add(roof);
    // Only explicitly tagged gabled/hipped: rectangle ridge approximation above polygon cap, not a surveyed roof.
    if(['gabled','hipped'].includes(q.roofShape)){const r=q.rect,c=[r.reduce((v,p)=>v+p[0],0)/4,r.reduce((v,p)=>v+p[1],0)/4];let w=Math.hypot(r[1][0]-r[0][0],r[1][1]-r[0][1]),d=Math.hypot(r[3][0]-r[0][0],r[3][1]-r[0][1]);const m=gable(w,d,.35,'#99543b');m.rotation.y=-Math.atan2(r[1][1]-r[0][1],r[1][0]-r[0][0]);m.position.set(c[0],.62+q.h,c[1]);group.add(m);}
    for(let i=0;i+1<q.ring.length;i++){const a=q.ring[i],b=q.ring[i+1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<.45)continue;const cols=Math.max(1,Math.floor(L/.65)),floors=Math.max(1,Math.floor(q.h/.5));for(let f=0;f<floors;f++)for(let k=0;k<cols;k++){const t=(k+.5)/cols,m=B(.15,.21,.025,housePane);m.rotation.y=-Math.atan2(dz,dx);m.position.set(a[0]+dx*t-dz/L*.018,.62+(f+.6)*q.h/floors,a[1]+dz*t+dx/L*.018);group.add(m);}}
    for(const c of q.colliders)LANDSOLIDS.circles.push(c);
  }
  const edgeDist = streetIndex(geo); // 176
  const fabric = buildFabric(group, geo, edgeDist);
  mergeStatic(group, [skyDome], undefined, true); //242 exact position+normal indexing, unchanged triangles/material buckets
  const stoneColors=new Set([0xa89878,0xc8b898,0xb3a58b,0xc2b69c,0xbaae90]);
  group.traverse(o=>{if(o.isMesh&&o.material&&o.material.color&&stoneColors.has(o.material.color.getHex()))surfaceDetail(o.material);});
  { // 195: the two Certovka footbridge decks (plank boxes under the drawn footway ribbons, matching the onFootBridge bands)
    const fm = new THREE.MeshStandardMaterial({ color: '#7a6248', roughness: 1 });
    for (const [fx, fz, fw] of [[56.9, 18.9, 4.4], [53.27, 47.95, 4.3]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(fw, .1, 1.2), fm);
      f.position.set(fx, .84, fz); f.castShadow = true; group.add(f);
    }
  }
  return { ok: true, group, stats: { ways: drawn, rings: geo.river_rings.length, fabric: fabric.count }, fabric: fabric.placed };
}

/* Update 167 - buildPragueWorld: full worldData contract for the Prague slice (LOCAL-ONLY held module).
   Consumed via the proto=prague shim (app.js) which gates on localhost BEFORE importing, builds completely,
   then swaps atomically (Main 6:13 constraints). Empty roads/places/itemSpots are scaffold limits, NOT playable-complete. */
const DEF = { sky: '#a4d0ee', fog: '#a4d0ee', sun: ['#ffe8b8', 2] }; // game shapes: fog color string (app.js:1557), sun [color,intensity] (app.js:1918)
const S = 110, SX_E = 125; // 183: the S=110 symmetric bound CUT the east bridgehead (east tower 114.9, deck end 117.2, street block to x 124) - the east clamp is now 125 (1.2u past the last street point); other bounds unchanged

function simplifyRing(ring, step = 4) { const out = ring.filter((_, i) => i % step === 0); if (out[out.length - 1] !== ring[ring.length - 1]) out.push(ring[ring.length - 1]); return out; }
const polygonQueries=new WeakMap();
function inPoly(x,z,poly){let query=polygonQueries.get(poly);if(!query){query=polygonQuery(poly);polygonQueries.set(poly,query);}return query(x,z);}

export async function buildPragueWorld(scene) {
  const res = await fetch('/prague-geography.json');
  if (!res.ok) return { ok: false, err: 'geo-' + res.status };
  const geo = await res.json();
  const built = await buildPragueGroup();
  if (!built.ok) return built;
  const group = built.group;
  const ring = geo.river_rings[0] || [];
  const clampRing = ring; /* 185 ROOT FIX: physics ring = the DRAWN ring (the water mesh is built from the raw ring; simplifyRing step 4 cut the bank ~1u inward - the physics/visual shoreline mismatch Main flagged 8:16). */
  const onBridge=(x,z)=>nearLine(x,z,geo.bridge207.pts).d<=geo.bridge207.width/2;
  //212 GAME pier relocated north of bridge to clear source east-bank buildings. Not a real quay or ferry route.
  // Geometry/collider/band use x99.4..105,z15.2..16.8 (walk band inset.2/.15); source buildings remain solid.
  const DKX0 = 99.6, DKX1 = 104.8, DKZ = 16, DKHW = .65;
  const onDock = (x, z) => x >= DKX0 && x <= DKX1 && Math.abs(z - DKZ) <= DKHW;
  const sideRings = geo.river_rings.slice(1).filter(r => r.length > 2); /* 195+198: side water bodies - Certovka channel
     (way 156392957) and the Kampa park pond (way 637849081, dev/research/prague-kampa-pond.json, same ODbL extract).
     Walk physics covers ALL water bodies; boats stay MAIN-RING ONLY (a ~1.1-1.5u mill channel with low footbridges
     cannot take the standard boat; the pond is 1.9x1.3u). */
  /* 195: the two drawn footways that cross the channel get footbridge bands (real crossings: the mill
     footbridge at z~19 and the Hlahol-side footbridge at z~48) - walkable at ribbon height .89, dry. */
  const onBridge206=(x,z)=>{if(!geo.bridge206)return false;const [a,b]=geo.bridge206.pts,dx=b[0]-a[0],dz=b[1]-a[1],ll=dx*dx+dz*dz,t=((x-a[0])*dx+(z-a[1])*dz)/ll;return t>=-.25/Math.sqrt(ll)&&t<=1+.25/Math.sqrt(ll)&&Math.abs((x-a[0])*dz-(z-a[1])*dx)/Math.sqrt(ll)<=geo.bridge206.width/2;};
  const onFootBridge = (x, z) => onBridge206(x,z) || (Math.abs(x - 56.9) < 1.8 && Math.abs(z - 18.9) < 1.0) || (Math.abs(x - 53.27) < 1.75 && Math.abs(z - 47.95) < .95);
  const inRiver = (x, z) => !onBridge(x, z) && !onFootBridge(x, z) && ((ring.length > 2 && inPoly(x, z, clampRing)) || sideRings.some(pr => inPoly(x, z, pr)));
  const inMainRiver = (x, z) => !onBridge(x, z) && ring.length > 2 && inPoly(x, z, clampRing); // 195: boat predicate - byte-identical to the pre-195 inRiver
  // nearest point on ring boundary for push-out
  const pushOut = (x, z) => {
    let best = null, bd = 1e9;
    for (const pr of [clampRing, ...sideRings]) for (let i = 0; i + 1 < pr.length; i++) { // 195/198: nearest bank over ALL water bodies
      const [ax, az] = pr[i], [cx2, cz2] = pr[i + 1];
      const dx = cx2 - ax, dz = cz2 - az, L2 = dx * dx + dz * dz || 1e-6;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const px = ax + t * dx, pz = az + t * dz, d = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (d < bd) { bd = d; best = [px, pz]; }
    }
    if (!best) return [x, z];
    const d = Math.sqrt(bd) || 1e-6; // boundary->player points INWARD; push to the opposite (land) side
    const ux = (x - best[0]) / d, uz = (z - best[1]) / d;
    let nx = best[0] - ux, nz = best[1] - uz;
    if (inRiver(nx, nz)) { nx = best[0] - ux * 2; nz = best[1] - uz * 2; } // thin spur: step wider
    return [clX(nx), Math.max(-S, Math.min(S, nz))];
  };
  const clX = x => Math.max(-S, Math.min(SX_E, x));
  const dockPt = (x, z) => [Math.max(DKX0, Math.min(DKX1, x)), Math.max(DKZ - DKHW, Math.min(DKZ + DKHW, z))]; // 185
  const clamp = (x, z) => { x = clX(x); z = Math.max(-S, Math.min(S, z)); if (onDock(x, z)) return [x, z];
    if (inRiver(x, z)) { const [dx2, dz2] = dockPt(x, z); if (Math.hypot(x - dx2, z - dz2) < 1.6) return [dx2, dz2]; return pushOut(x, z); } // 185: stepping off the pier pushes back ONTO it (water is unwalkable everywhere - Main 8:16: interaction behavior)
    return [x, z]; }; // 184: pier band walkable
  /* 181: Vltava boat - the standard game boat on the REAL river channel. Game service INSPIRED by real Prague river
     transport, NOT a route replica (real PID ferries P1-P6 all run outside the historic center - ledger 178 sources).
     The river (21.5u at the bridge) is the only measured surface that fits game-scale vehicles (cab sweep 2.19u > every street).
     The boat CANNOT pass under the bridge: the drawn deck underside sits .7u over the water with 15 piers, and the standard
     game boat's cabin top is ~1.95u - the scale tension is VISIBLE, same root issue as the taxi (Main 7:29). A navigation
     arch is a bridge-geometry decision for Main, not silently changed here. */
  const nearestRingPt = (x, z) => {
    let best = null, bd = 1e9;
    for (let i = 0; i + 1 < clampRing.length; i++) {
      const [ax, az] = clampRing[i], [cx2, cz2] = clampRing[i + 1];
      const dx = cx2 - ax, dz = cz2 - az, L2 = dx * dx + dz * dz || 1e-6;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const px = ax + t * dx, pz = az + t * dz, d = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (d < bd) { bd = d; best = [px, pz]; }
    }
    return best ? { p: best, d: Math.sqrt(bd) } : null;
  };
  const pushIn = (x, z, wet) => { // nearest point satisfying wet(), stepping in from the ring boundary (mirrors pushOut)
    const n = nearestRingPt(x, z); if (!n) return [x, z];
    const dx = x - n.p[0], dz = z - n.p[1], d = Math.hypot(dx, dz) || 1e-6;
    for (const st of [1.5, 2.5, 3.5, 5, 7]) for (const side of [1, -1]) {
      const nx = n.p[0] + side * dx / d * st, nz = n.p[1] + side * dz / d * st;
      if (wet(nx, nz)) return [clX(nx), Math.max(-S, Math.min(S, nz))];
    }
    return [x, z];
  };
  const boatClamp = (x, z) => {
    x = clX(x); z = Math.max(-S, Math.min(108, z)); /* 188: navigable water ends 1u ahead of the z 110 safety boom (visible bound, was the generic invisible S clamp) */
    if (inMainRiver(x, z)) { const n = nearestRingPt(x, z); return n && n.d >= 1 ? [x, z] : pushIn(x, z, inMainRiver); } // hull stays 1u off the banks (195: main ring only - boats cannot enter the Certovka)
    if (inPoly(x, z, clampRing)) { // deck band intrusion: push back out the NEARER band face (no teleport along the bank)
      const n=nearLine(x,z,geo.bridge207.pts),dx=x-n.x,dz=z-n.z,L=Math.hypot(dx,dz)||1;
      return [n.x+dx/L*(geo.bridge207.width/2+.9),n.z+dz/L*(geo.bridge207.width/2+.9)];
    }
    return pushIn(x, z, (px, pz) => inPoly(px, pz, clampRing));
  };
  const boat = { // contract mirrors the cities.js coastal boat (nearShore/toWater/toLand/clamp/colliders)
    nearShore: (x, z) => { const n = nearestRingPt(x, z); return !!n && n.d < 4; },
    toWater: (x, z) => pushIn(x, z, inMainRiver), // 195: boarding pushes into the main channel (the basin mouth overlaps it)
    toLand: (x, z) => pushOut(x, z),
    clamp: boatClamp,
    colliders: [{ x: 102.2, z: 16, hw: 2.8, hd: .8 }], /*212 relocated game pier remains a STANDARD boat obstacle (app.js collider push-out, least-penetrated axis, body margin .45) - consistent contact behavior instead of a patch band (Main 8:23). Channel containment otherwise stays the clamp's job; real bridge piers in the water and the weir are NOT modeled - recorded */
  };
  const colliders = []; // 200: castle solids from the shared LANDSOLIDS (real fit); bridge deck edges handled by the clamp band
  for (const [sx, sz, sr] of LANDSOLIDS.circles) colliders.push({ x: sx, z: sz, r: sr });
  for (const [sx, sz, sr] of LANDSOLIDS.walls || []) colliders.push({ x: sx, z: sz, r: sr }); // 200 palace wall rows
  for (const [x0, z0, x1, z1] of LANDSOLIDS.rects) colliders.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2 });
  for (const bld of (built.fabric || [])) colliders.push({ x: bld.x, z: bld.z, hw: bld.hw, hd: bld.hd }); // 168: fabric buildings are solid
  const edgeDist = streetIndex(geo); // 176 (separate build from the fabric pass: this function's own scope; ~0.2s dev-load cost, recorded)
  const narrowRings=[...(geo.fabric209||[]),...(geo.fabric212||[]),...(geo.fabric216||[])].map(q=>q.ring);
  const wd = {
    group, colliders, colliderScan:colliderBlocks(colliders), itemSpots: [], clouds: [], butterflies: [],
    //205 read-only map metadata, separate from taxi/paid/progression places. No auto-travel.
    mapPlaces:[{name:'St Vitus west approach',x:-3.24,z:-32.78,r:.8},{name:'Lesser Town bridge approach',x:53.72,z:7.12,r:1},{name:'East-bank game boat pier',x:102.2,z:16,r:1}],
    mapGuide:geo.guide215,mapGuideLabel:'Local game walk: eastern approach to bridge',
    mapSourceBuildings:[...(geo.fabric212||[]),...(geo.fabric216||[])].filter(q=>q.clearanceRemovedArea>.001).map(q=>q.sourceRing),
    mapBounds:[-110,125,-110,110],mapMetersPerUnit:9.5,
    mapWater:geo.river_rings,mapBuildings:[geo.cathedral203.footprint,geo.provost202b,geo.palace.outer,...[...(geo.fabric209||[]),...(geo.fabric212||[]),...(geo.fabric216||[])].map(q=>q.ring)],
    mapNote:'© OpenStreetMap · ODbL · partial schematic slice',

    sky: DEF.sky, fog: DEF.fog, sun: DEF.sun, stage: null,
    onRoad: (x, z) => edgeDist(x, z) <= 0, roadAsphalt: (x, z, pad) => edgeDist(x, z) <= (pad || 0), plaza: { x: 0, z: -26, r: 20 }, /* 176: REAL street network predicates (the placeholder color string under roadAsphalt would have thrown on the first hail) */
    roads: geo.ways.filter(([cls]) => ROAD[cls]).map(([cls, pts]) => ({ pts })), /* 176: real street polylines (contract parity + future vehicle/spots use). TAXI FINDING: the standard cab needs hw >= 1.4u asphalt (app.js -1.4 predicate, 2.19u corner sweep) but real Prague streets render hw 0.08-1.05u - no cab fits; Prague keeps road vehicles out and the hail panel honestly says 'No taxi stops here yet' (no places); 181 adds the standard boat on the river instead (walk + boat, still no road vehicles). A metric-scaled vehicle is a design fork for Main, not silently invented. */
    //209 near source street walls auto-FP uses existing preference save/restore, not an indoor/access claim.
    narrowView:(x,z)=>nearOutline(x,z,narrowRings,1.35),
    occluders: [], airport: null, ferry: null, parkRectGuard: false, noPark: null,
    camMinDist: (x, z) => { // 201: inside the nave shell the 3.4u orbit floor leaves the camera buried in the walls (hall is 5.85u wide) - tighter interior pull-in floor (app.js hook; other cities unchanged)
      const dx = x - 4.13, dz = z + 35.92, t = dx * 0.9382 - dz * 0.3461, s2 = dx * 0.3461 + dz * 0.9382; // CC/CAX from the composition (same constants)
      return (Math.abs(t) < 6.7 && Math.abs(s2) < 2.85) ? 2.2 : 3.4;
    },
    indoors: (x, z) => { // 201b: the nave hall - app.js auto-switches to first person inside (a 5.85u hall frames badly in third person at ANY floor: the avatar fills the view, Main 11:11); the user's fp preference is saved/restored across the transition
      const dx = x - 4.13, dz = z + 35.92, t = dx * 0.9382 - dz * 0.3461, s2 = dx * 0.3461 + dz * 0.9382;
      return inPoly(x,z,geo.cathedral203.footprint) || (Math.hypot(x-12.7,z+30.2)<1.9 && x>11.8 && x<13.8 && !inPoly(x,z,geo.palace.outer));
    },
    groundY: (x, z) => (x === undefined ? .62 : (onDock(x, z) ? .78 : onBridge(x, z) ? 1.2 : onFootBridge(x, z) ? .89 : .62 + hillY(x, z))), /* 195: footbridge bands walk at ribbon height */ // 186: dock/bridge heights first (hillY is 0 there anyway), then .62 + the Hradcany hill; the 184 pier corner ordering is preserved by checking onDock first
    clamp, clampSwim: clamp, clampBall: clamp,
    spawn: { x: 96.2, z: 17.35, yaw: Math.atan2(-3.28,-.78) }, //213 LOCAL preview arrival on source bridge west of east tower, faces west. Old117,21.9 entry requires212unmapped detour; obstruction not erased.
    beachBalls: [], surf: null, /* 195 ROOT FIX: was [] - a truthy empty array passed buildWaves' `if (!sf) return` gate; Array.prototype.at made sf.at(NaN) return undefined, writing all-NaN foam-ribbon positions (the intermittent computeBoundingSphere NaN warnings - trigger was the LAZY bounding-sphere compute, cull-order dependent; positions were NaN on every Prague boot). No Prague surf exists (inSwim false), so null is the honest value. */
    inPool: () => false, inSwim: () => false, inSea: () => false, inSeaOpen: () => false, inRiver,
    pool: null, harbour: null, waterDepth: 0, boat, /* 181 */
  };
  return { ok: true, worldData: wd, stats: { ways: built.stats.ways, rings: built.stats.rings, colliders: colliders.length } };
}

/* Update 176 - real-network taxi roads (user instruction Oct 26: taxis drive by road, not across fields).
   One shared street SEGMENT index (1u grid, exact point-segment distance, per-class half-width) backs
   roadAsphalt/onRoad AND the fabric siting clearance. app.js taxiGrid treats roadAsphalt(cx,cz,-1.4)
   as the hard asphalt rule, so cabs drive the REAL streets and the real bridge deck only. Lanes with
   hw < 1.4 (footway/path/steps/cycleway/service) drop out of the cab grid by construction - the
   pedestrianized Old Town core stays walk-only, matching reality. */
function streetIndex(geo) {
  const idx = new Map(), segs = []; const key = (x, z) => ((x + 300) | 0) * 1000 + ((z + 300) | 0);
  for (const [cls, wpts] of geo.ways) { const st = ROAD[cls]; if (!st) continue; const hw = st.w / MPU / 2;
    for (let i = 0; i + 1 < wpts.length; i++) { const [x1, z1] = wpts[i], [x2, z2] = wpts[i + 1]; segs.push([x1, z1, x2, z2, hw]);
      const x0 = Math.min(x1, x2) - 3.2, x9 = Math.max(x1, x2) + 3.2, z0 = Math.min(z1, z2) - 3.2, z9 = Math.max(z1, z2) + 3.2;
      for (let gx = Math.floor(x0); gx <= Math.ceil(x9); gx++) for (let gz = Math.floor(z0); gz <= Math.ceil(z9); gz++) { const kk = key(gx, gz); if (!idx.has(kk)) idx.set(kk, []); idx.get(kk).push(segs.length - 1); } } }
  return (x, z) => { // signed distance to the nearest real street EDGE (negative = inside the asphalt band); Infinity when none nearby
    let best = Infinity;
    for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) { const cell = idx.get(key(x + gx, z + gz)); if (!cell) continue;
      for (const si of cell) { const [x1, z1, x2, z2, hw] = segs[si]; const dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz || 1e-6;
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / L2));
        const d = Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz)) - hw; if (d < best) best = d; } }
    return best;
  };
}

/* Update 168 - block-fitted fabric along the REAL street network (schematic massing, Prague palette).
   Sampling: step along eligible ways, offset to both sides, reject on river/street/building/castle/bridge overlap.
   Axis-aligned boxes only (facade system is axis-aligned) - wedge gaps along diagonal streets are a recorded
   schematic limit, not surveyed fabric. Narrow-lane clearances follow the accepted lagosisland Broad St language. */
const PALETTE = ['#e8d8b0', '#d9c49a', '#c9a87a', '#d4b48c', '#e0c9a0'], ROOFS = ['#b5543a', '#a84830', '#c06038'];
const ELIG = { primary: 1, primary_link: 1, secondary: 1, secondary_link: 1, tertiary: 1, tertiary_link: 1, residential: 1, unclassified: 1, pedestrian: 1, living_street: 1 }; // lanes included: the Old Town core fronts pedestrian lanes
function seeded(seed) { let s2 = seed; return () => (s2 = (s2 * 1664525 + 1013904223) % 4294967296) / 4294967296; }

function buildFabric(group, geo, edgeDist) {
  const R = seeded(20261030);
  const ring = geo.river_rings[0] || [];
  const placed = []; // {x,z,hw,hd}
  const collides = (x, z, hw, hd) => {
    for (const b of placed) if (Math.abs(x - b.x) < hw + b.hw + .8 && Math.abs(z - b.z) < hd + b.hd + .8) return true;
    return false;
  };
  const allRings = geo.river_rings.filter(r => r.length > 2); // 195: fabric must stay out of the Certovka too (was river_rings[0] only)
  /* 196: the closing-pass exploration loop (Main 9:59: prove ONE connected playable route with traversable
     footbridge endpoints). Follows drawn ways: Charles deck west end -> out through the tower-gate passage ->
     south through Kampa -> Hlahol-side footbridge B -> north through Mala Strana -> mill footbridge A -> back.
     Schematic fabric must not BLOCK the drawn walking network on this loop: candidates intersecting the
     corridor are rejected (the 166 fabric-over-streets approximation is otherwise retained, recorded). */
  const ROUTE = [[63.3, 10.9], [60.2, 10.3], [62.5, 15], [62.5, 24], [62.5, 32], [62, 40], [60, 45], [56, 47.95], [51.5, 47.95], [49.5, 44], [50, 37], [50, 30], [49, 26], [48.5, 22], [51, 19.5], [54.5, 18.9], [59, 18.9], [61.5, 15], [63.3, 10.9]];
  const routeDist = (x, z) => {
    let best = 1e9;
    for (let i = 0; i + 1 < ROUTE.length; i++) {
      const [ax, az] = ROUTE[i], [bx2, bz2] = ROUTE[i + 1], dx = bx2 - ax, dz = bz2 - az, L2 = dx * dx + dz * dz || 1e-6;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
    }
    return best;
  };
  const [cx0, cz0] = geo.anchors.castle, [bx0, bz0] = geo.anchors.charles_bridge_mid;
  const inDeck=(x,z,m)=>nearLine(x,z,geo.bridge207.pts).d<geo.bridge207.width/2+m;
  let count = 0; const DBG = { river: 0, farStreet: 0, bounds: 0, castle: 0, bridge: 0, collide: 0, nodepth: 0, tried: 0 };
  const CAP = 260;
  for (const [cls, pts] of geo.ways) { // sample along the WHOLE polyline arc, not per segment (OSM node splits are short)
    if (!ELIG[cls] || count >= CAP) continue;
    const st = ROAD[cls], roadHalf = st.w / MPU / 2;
    const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const TL = cum[cum.length - 1];
    const at = sp => { let k = 1; while (k < cum.length - 1 && cum[k] < sp) k++; const segL = cum[k] - cum[k - 1] || 1e-6, f = (sp - cum[k - 1]) / segL; const [ax, az] = pts[k - 1], [bx2, bz2] = pts[k]; return { x: ax + (bx2 - ax) * f, z: az + (bz2 - az) * f, ux: (bx2 - ax) / segL, uz: (bz2 - az) / segL }; };
    for (const side of [-1, 1]) {
      let sp = 2 + R() * 2;
      while (sp < TL - 2 && count < CAP) {
        const w = 3 + R() * 3, h = 1.1 + R() * 1.5, cLen = w / 2; //208 game-scale neighborhood roofs, not80-150m placeholder towers
        const tc = sp + cLen;
        sp = tc + cLen + .4 + R() * 1.6;
        if (tc + cLen > TL - 2 || R() < .2) continue;
        const pt = at(tc), ux = pt.ux, uz = pt.uz, nx = -uz, nz = ux;
        const along = Math.abs(ux) >= Math.abs(uz) ? 'x' : 'z';
        DBG.tried++;
        let depth = 0, cX = 0, cZ = 0, fhw = 0, fhd = 0;
        for (let d = 2 + R() * 2.5; d >= 1.0; d -= .3) {
          const perp = d / 2;
          fhw = along === 'x' ? w / 2 : perp; fhd = along === 'x' ? perp : w / 2;
          const off = roadHalf + .3 + perp;
          cX = pt.x + nx * side * off; cZ = pt.z + nz * side * off;
          let bad = false;
          if (routeDist(cX, cZ) < Math.max(fhw, fhd) + .8) { bad = true; DBG.route = (DBG.route || 0) + 1; } // 196: keep the closing route traversable
          for (const [ox, oz] of [[fhw, fhd], [-fhw, fhd], [fhw, -fhd], [-fhw, -fhd], [0, 0]]) {
            for (const pr of allRings) if (inPoly(cX + ox, cZ + oz, pr)) { bad = true; DBG.river++; break; } // 195: all water bodies
            if (inDeck(cX + ox, cZ + oz, 2.5)) { bad = true; DBG.bridge++; break; } // bridge corridor + approaches stay clear
          }
          if (!bad) {
            const ext = Math.abs(nx) * fhw + Math.abs(nz) * fhd, tH = Math.abs(ux) * fhw + Math.abs(uz) * fhd;
            for (const tt of [-tH, 0, tH]) {
              const qx = cX + nx * side * ext + ux * tt, qz = cZ + nz * side * ext + uz * tt;
              if (edgeDist(qx, qz) <= .15 || (ring.length > 2 && inPoly(qx, qz, ring))) { bad = true; DBG.farStreet++; break; }
            }
          }
          if (!bad) { depth = d; break; }
        }
        if (!depth) { DBG.nodepth++; continue; }
        if((cX+fhw>42&&cX-fhw<63&&cZ+fhd>-1&&cZ-fhd<18)||(geo.fabric212||[]).some(q=>q.ring.some(([x,z])=>x>cX-fhw-.4&&x<cX+fhw+.4&&z>cZ-fhd-.4&&z<cZ+fhd+.4)))continue; //209 remove generic bridgehead boxes, source footprints replace them
        if (Math.abs(cX) > 106 || Math.abs(cZ) > 106) { DBG.bounds++; continue; }
        if (Math.hypot(cX - cx0, cZ - cz0) < 30 || [[0, 0], [fhw, fhd], [-fhw, fhd], [fhw, -fhd], [-fhw, -fhd]].some(([ox, oz]) => hillY(cX + ox, cZ + oz) > .005)) { DBG.castle++; continue; } // 186: also keep fabric off the hill skirt (buildings stay on flat ground, so facade/base code needs no lift) // 179: complex footprint (171 rect) + fabric-free apron r30 - the castle was INVISIBLE at street level behind 8-16u fabric walls (fromsouth still: solid wall at z -38..-48); real Hradcany grounds are open courtyards/gardens, real streets still cross the apron (no slab: paving would cover them)
        if ([...geo.bridge207.towers,geo.bridge207.east].some(t=>Math.hypot(cX-t.cx,cZ-t.cz)<Math.max(fhw,fhd)+2)||Math.hypot(cX - bx0, cZ - bz0) < 6) { DBG.bridge++; continue; }
        if (collides(cX, cZ, fhw, fhd)) { DBG.collide++; continue; }
        placed.push({ x: cX, z: cZ, hw: fhw, hd: fhd });
        const col = PALETTE[(R() * PALETTE.length) | 0], roof = ROOFS[(R() * ROOFS.length) | 0];
        const base = new THREE.Mesh(new THREE.BoxGeometry(fhw * 2, h, fhd * 2), new THREE.MeshStandardMaterial({ color: col, roughness: .95 }));
        base.position.set(cX, .6 + h / 2, cZ); base.castShadow = true; base.receiveShadow = true; group.add(base);
        const rw2 = Math.max(fhw,fhd) * 2, rd2 = Math.min(fhw,fhd) * 2, rise = Math.min(.8,Math.min(fhw, fhd) * .35 + .2); /* 169: real gable prism (Main 6:27 floating-pyramid defect) - eaves AT cap level, contact by construction */
        const rvx = new Float32Array([-rw2 / 2, 0, -rd2 / 2, rw2 / 2, 0, -rd2 / 2, rw2 / 2, 0, rd2 / 2, -rw2 / 2, 0, rd2 / 2, -rw2 / 2, rise, 0, rw2 / 2, rise, 0]);
        const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rvx, 3));
        rg.setIndex([0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 0, 4, 3, 1, 5, 2]); rg.computeVertexNormals();
        const prism = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: roof, roughness: .9, flatShading: true, side: THREE.DoubleSide }));
        if (fhd > fhw) prism.rotation.y = Math.PI / 2; // ridge follows the longer plan axis
        prism.position.set(cX, .6 + h, cZ); prism.castShadow = true; group.add(prism);
        //208 original facade helper assumes8u+ buildings; resized panels must stay below these lower eaves.
        const pane=new THREE.MeshStandardMaterial({color:'#35484d',roughness:.9});
        const floors=Math.max(1,Math.floor(h/.65));
        //261 schematic windows on both wall axes: no more permanently blank long side.
        // Placement stays below eaves, inside each wall span; visual only, not surveyed openings.
        for(const axis of ['x','z']){const half=axis==='x'?fhw:fhd,depth=axis==='x'?fhd:fhw,cols=Math.max(1,Math.floor(half*2/.65));
          for(let f=0;f<floors;f++)for(let c=0;c<cols;c++)for(const side of [-1,1]){const m=new THREE.Mesh((axis==='x'?new THREE.BoxGeometry(.22,.30,.035):new THREE.PlaneGeometry(.22,.30)),pane),along=-half+(c+.5)*half*2/cols;
            m.rotation.y=axis==='x'?0:side*Math.PI/2;m.position.set(cX+(axis==='x'?along:side*(depth+.02)),.6+(f+.6)*h/floors,cZ+(axis==='x'?side*(depth+.02):along));group.add(m);}
        }
        count++;
      }
    }
  }
  finalizeFacades(group);
  if (typeof window !== 'undefined') window.__fabDebug = DBG;
  return { count, placed };
                                                                }
