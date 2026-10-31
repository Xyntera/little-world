/* Little World - merge static meshes that share a material into few draw calls. Optional spatial cells keep frustum culling useful. */
import * as THREE from '/vendor/three.module.js';
import { indexStatic } from './indexed-static.js';

export function mergeStatic(root, skip, cell, indexed = false) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), victims = [];
  const skipSet = new Set(); for (const g of skip) g.traverse(o => skipSet.add(o));
  root.traverse(o => {
    if (!o.isMesh || skipSet.has(o) || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.material.map || o.material.transparent) return;
    const m = o.material;
    const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); const cellKey = cell ? Math.floor(wp.x / cell) + ':' + Math.floor(wp.z / cell) : '';
    const key = [cellKey, m.type, m.color.getHex(), m.emissive ? m.emissive.getHex() : 0, m.emissiveIntensity, m.roughness, m.metalness, m.flatShading, m.side, o.castShadow, o.receiveShadow].join('|');
    let b = buckets.get(key); if (!b) { b = { mat: m, cast: o.castShadow, recv: o.receiveShadow, pos: [], nor: [] }; buckets.set(key, b); }
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!g.attributes.normal) g.computeVertexNormals();
    b.pos.push(g.attributes.position.array); b.nor.push(g.attributes.normal.array);
    victims.push(o); g.dispose();
  });
  for (const o of victims) { o.parent.remove(o); o.geometry.dispose(); }
  for (const b of buckets.values()) {
    const cat = arrs => { let n = 0; for (const a of arrs) n += a.length; const out = new Float32Array(n); let k = 0; for (const a of arrs) { out.set(a, k); k += a.length; } return out; };
    const geo = new THREE.BufferGeometry();
    const position = cat(b.pos), normal = cat(b.nor);
    const compact = indexed ? indexStatic(position, normal) : null;
    geo.setAttribute('position', new THREE.BufferAttribute(compact ? compact.position : position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(compact ? compact.normal : normal, 3));
    if (compact) geo.setIndex(new THREE.BufferAttribute(compact.index, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; root.add(mesh);
  }
}
