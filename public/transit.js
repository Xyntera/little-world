/* Little World - Update 150 S150a: piloted inter-city transit scene (LABELLED SCHEMATIC open sea/sky -
   NOT real route geography; see dev/TRAVEL-DESIGN.md). buildTransit returns the worldData-shaped object
   app.js already consumes, so updatePlayer/updateCamera/updateBalls keep working unchanged. */
import * as THREE from '/vendor/three.module.js';

const SKY = '#8fd0f0', FOG = '#c4e4f0', SEA = '#3f8fbf', SUN = ['#fff2d8', 1.9];
export const TRANSIT_LIM = 400; // bounded arena, much larger than a city; crossing progress = distance toward the beacon

export function buildTransit(scene, kind) { // kind: 'air' | 'sea'
  const world = new THREE.Group(); scene.add(world);
  const colliders = [], occluders = [], clouds = [], places = [];
  const seaMat = new THREE.MeshStandardMaterial({ color: SEA, roughness: .35, metalness: 0 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(TRANSIT_LIM * 2 + 200, TRANSIT_LIM * 2 + 200, 32, 32), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = .5; sea.receiveShadow = true; world.add(sea);
  // clouds (cities.js ~2334 pattern): flat-shaded squashed white spheres drifting high
  let s = 987654; const R = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x80000000;
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(3 + R() * 2, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }));
    a.scale.y = .5; c.add(a);
    c.position.set((R() * 2 - 1) * TRANSIT_LIM, 55 + R() * 25, (R() * 2 - 1) * TRANSIT_LIM);
    world.add(c); clouds.push(c);
  }
  // destination beacon: tall glowing pillar + ring on the water, due "north" (-z); arrival radius 12.
  // S150g: fog:false on the beacon materials - scene fog (far 340) would fully hide it from spawn 780
  // units out; a lighthouse beacon the pilot can actually see is the crossing's core navigation aid.
  const bg = new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#ffd24a', emissiveIntensity: 1, roughness: .5, fog: false });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 160, 10), bg);
  pillar.position.set(0, 80.5, -TRANSIT_LIM); world.add(pillar);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, 3.2, 260, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: .22, fog: false, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.set(0, 130, -TRANSIT_LIM); world.add(beam); // soft light shaft above the pillar, visible the whole crossing
  const ring = new THREE.Mesh(new THREE.TorusGeometry(10, .6, 8, 40), bg.clone());
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 1.1, -TRANSIT_LIM); world.add(ring);
  places.push({ name: 'Destination', x: 0, z: -TRANSIT_LIM, r: 12 });
  const lim = TRANSIT_LIM - 5;
  return {
    group: world, colliders, occluders, itemSpots: [], places, clouds, butterflies: [],
    sky: SKY, fog: FOG, sun: SUN,
    groundY: () => .5,
    clamp: (x, z) => [Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, z))],
    inSea: () => true, inSeaOpen: () => true, inSwim: () => kind === 'sea', // open water everywhere; swim only for sea crossings (ball soak predicates stay honest)
    transit: { kind, beacon: { x: 0, z: -TRANSIT_LIM, r: 12 } },
  };
}
