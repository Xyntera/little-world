/* Little World city-style outfits: original box/lathe designs, no third-party assets. Each style adds its own silhouette
   (robes, coats, hats, scarves, bags), not just a colour swap. Styles are free and chosen by the player. */
import * as THREE from '/vendor/three.module.js';

const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .85, metalness: 0 }, o || {}));
const bx = (w, h, d, c, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)); m.castShadow = true; return m; };
const cyl = (rt, rb, h, c, seg) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat(c)); m.castShadow = true; return m; };
const sph = (r, c, o) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), mat(c, o)); m.castShadow = true; return m; };
const at = (m, x, y, z, rx, ry, rz) => { m.position.set(x, y, z); if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz; return m; };

/* leg covers swing with the legs (children of legL/legR, origin at hip, feet at y=-.78) */
function legWrap(P, w, d, top, bottom, color) { // box from y=-top to y=-bottom
  const m = bx(w, bottom - top, d, color); m.position.y = -(top + bottom) / 2; P.legL.add(m); const r = m.clone(); P.legR.add(r); return [m, r];
}
const long = (...ms) => { for (const m of ms.flat()) m.userData.long = true; return ms; }; // hem/skirt parts that fold away in the seated riding pose
function sleeves(P, len, color, w) { // covers the arm tube (arm pivot at shoulder, tube centre y=-.3, length .66)
  for (const a of [P.armL, P.armR]) { const m = bx(w || .25, len, .27, color); m.position.y = -len / 2 + .03; a.add(m); }
}
function torsoBox(P, w, h, d, y, color) { const m = bx(w, h, d, color); m.position.y = y; P.body.add(m); return m; }
function hat(P, m, y) { m.position.y += y == null ? .33 : y; P.headG.add(m); return m; }
function hideHair(P) { P.hair.visible = false; }

/* palettes: 3 variants per style [main, second, accent] */
export const OUTFITS = [
  { name: 'Everyday', desc: 'Your base outfit', pal: [['#000', '#000', '#000']] },
  { name: 'Kerala', city: 'kerala', desc: 'Mundu, gold-border kasavu, shoulder cloth',
    pal: [['#f7f1df', '#d9a521', '#f7f1df'], ['#f7f1df', '#d9a521', '#c0392b'], ['#fff8e6', '#b8860b', '#2e7d5b']],
    build(P, c) {
      const [m, g, s] = c;
      long(legWrap(P, .36, .4, 0, .7, m), legWrap(P, .385, .43, .55, .7, g)); // mundu wrap with gold border hem
      torsoBox(P, .78, .3, .48, .84, m); torsoBox(P, .8, .06, .5, .98, g); // waist wrap and border
      const sash = bx(.2, .85, .1, s); at(sash, -.08, 1.12, .24, 0, 0, -.75); P.body.add(sash); // neriyathu shoulder cloth
      const tail = bx(.22, .3, .1, s); at(tail, .26, 1.26, -.24, 0, 0, 0); P.body.add(tail);
    } },
  { name: 'Mumbai', city: 'mumbai', desc: 'Kurta with dupatta and cross bag',
    pal: [['#2f9e8f', '#f4c542', '#2b2b4f'], ['#e86a4a', '#fff1d0', '#2b2b4f'], ['#6c5ce7', '#f4c542', '#222']],
    build(P, c) {
      const [k, d, b] = c;
      torsoBox(P, .78, .95, .48, 1.0, k); legWrap(P, .31, .34, 0, .45, k); sleeves(P, .38, k);
      torsoBox(P, .8, .08, .5, 1.43, d);
      const dup = bx(.18, .9, .08, d); at(dup, 0, 1.12, .26, 0, 0, .6); P.body.add(dup);
      const strap = bx(.07, .95, .5, b); at(strap, .0, 1.15, 0, 0, 0, -.62); strap.scale.z = 1.02; P.body.add(strap);
      const bag = bx(.3, .26, .14, b); bag.position.set(.46, .78, .12); P.body.add(bag);
    } },
  { name: 'Delhi', city: 'delhi', desc: 'Winter nehru jacket and woollen shawl',
    pal: [['#6d4c41', '#c9a24b', '#2e3a59'], ['#2e3a59', '#e0e0e0', '#8e2c2c'], ['#3e5c4a', '#c9a24b', '#e8dcc0']],
    build(P, c) {
      const [j, tr, sh] = c;
      torsoBox(P, .78, .72, .46, 1.16, j); sleeves(P, .66, j, .24);
      for (let i = 0; i < 4; i++) { const b = sph(.03, tr); b.position.set(0, 1.4 - i * .16, .24); P.body.add(b); }
      const col = bx(.5, .1, .46, j); col.position.set(0, 1.55, 0); P.body.add(col);
      const shawl = bx(.86, .26, .56, sh); shawl.position.set(0, 1.55, -.02); P.body.add(shawl);
      const tail = bx(.34, .6, .08, sh); at(tail, -.22, 1.2, .3, 0, 0, .12); P.body.add(tail);
      legWrap(P, .29, .33, 0, .7, '#e8dcc0');
    } },
  { name: 'Dubai', city: 'dubai', desc: 'Kandura with ghutra and agal (or abaya)',
    pal: [['#fbfaf5', '#1b1b1b', '#fbfaf5'], ['#e9dcc4', '#1b1b1b', '#e9dcc4'], ['#202026', '#d4af37', '#202026']],
    build(P, c, v) {
      const [r, a, h] = c;
      torsoBox(P, .78, .5, .48, 1.2, r); const sk = cyl(.42, .5, .8, r, 12); sk.position.y = .45; sk.scale.z = .75; P.body.add(sk); long(sk); sleeves(P, .68, r);
      legWrap(P, .3, .34, 0, .45, r);
      if (v === 2) { const trim = cyl(.505, .515, .06, a, 12); trim.position.y = .08; trim.scale.z = .75; P.body.add(trim); long(trim); const veil = bx(.7, .12, .66, r); hat(P, veil, .24); const dr = bx(.7, .6, .1, r); at(dr, 0, -.05, -.34); P.headG.add(dr); hideHair(P); }
      else { const g = bx(.72, .24, .68, h); hat(P, g, .26); const lap = bx(.72, .5, .12, h); at(lap, 0, -.1, -.34); P.headG.add(lap); const ag = cyl(.34, .34, .06, a, 14); at(ag, 0, .4, 0); P.headG.add(ag); hideHair(P); }
    } },
  { name: 'London', city: 'london', desc: 'Long overcoat, scarf and bowler hat',
    pal: [['#3b3f4a', '#8e1b2b', '#1c1c20'], ['#7b5e3b', '#27408b', '#2a1d10'], ['#1f2f4a', '#e0e0e0', '#101018']],
    build(P, c) {
      const [co, sc, hc] = c;
      torsoBox(P, .8, .75, .46, 1.14, co); sleeves(P, .68, co, .25);
      long(legWrap(P, .31, .35, 0, .55, co)); // coat skirt that swings
      for (let i = 0; i < 2; i++) { const b = sph(.035, '#d8c27a'); b.position.set(-.1 + i * .2, 1.12 - 0.0, .24); P.body.add(b); }
      const lap = bx(.22, .3, .06, co); at(lap, -.2, 1.42, .24, 0, 0, .3); P.body.add(lap); const lap2 = lap.clone(); at(lap2, .2, 1.42, .24, 0, 0, -.3); P.body.add(lap2);
      const sf = bx(.56, .16, .52, sc); sf.position.set(0, 1.56, 0); P.body.add(sf); const st = bx(.16, .5, .06, sc); st.position.set(.18, 1.28, .27); P.body.add(st);
      hat(P, bx(.5, .06, .5, hc), .26); hat(P, cyl(.2, .22, .22, hc, 12), .38); hideHair(P);
    } },
  { name: 'Paris', city: 'paris', desc: 'Breton stripes, beret and silk scarf',
    pal: [['#f4f1e6', '#1d2b53', '#c0392b'], ['#1d2b53', '#f4f1e6', '#e8b04a'], ['#f4f1e6', '#c0392b', '#1b1b1b']],
    build(P, c) {
      const [a, b, sc] = c;
      for (let i = 0; i < 5; i++) { const s = bx(.75, .07, .45, i % 2 ? a : b); s.position.set(0, 0.86 + i * .15, 0); P.body.add(s); }
      sleeves(P, .6, a, .23); for (let i = 0; i < 3; i++) for (const arm of [P.armL, P.armR]) { const st = bx(.245, .06, .26, b); st.position.y = -.05 - i * .2; arm.add(st); }
      const nk = bx(.52, .14, .5, sc); nk.position.set(0, 1.55, 0); P.body.add(nk); const kn = bx(.14, .3, .06, sc); at(kn, -.15, 1.38, .26, 0, 0, .2); P.body.add(kn);
      const bere = cyl(.38, .32, .14, '#7a1f2b', 14); hat(P, bere, .3); bere.rotation.z = .12; hat(P, sph(.04, '#7a1f2b'), .44);
      legWrap(P, .285, .33, 0, .8, '#232733');
    } },
  { name: 'New York', city: 'newyork', desc: 'Belted trench, beanie and messenger bag',
    pal: [['#c8a97a', '#2b2b30', '#ff6b35'], ['#2b2f3a', '#8a8a92', '#ffd23f'], ['#e2d9c8', '#1e1e24', '#2a7de1']],
    build(P, c) {
      const [t, d, bn] = c;
      torsoBox(P, .8, .8, .48, 1.12, t); sleeves(P, .68, t, .25); long(legWrap(P, .31, .36, 0, .52, t));
      const belt = bx(.82, .09, .5, d); belt.position.set(0, .95, 0); P.body.add(belt); const bk = bx(.12, .1, .03, '#d8c27a'); bk.position.set(0, .95, .26); P.body.add(bk);
      const l1 = bx(.24, .38, .06, t); at(l1, -.22, 1.38, .25, 0, 0, .35); P.body.add(l1); const l2 = l1.clone(); at(l2, .22, 1.38, .25, 0, 0, -.35); P.body.add(l2);
      const bean = cyl(.34, .36, .2, bn, 12); hat(P, bean, .3); hat(P, cyl(.37, .37, .08, d, 12), .22); hat(P, sph(.07, bn), .46);
      const bs = bx(.07, .95, .5, d); at(bs, 0, 1.15, 0, 0, 0, .6); P.body.add(bs); const bag = bx(.34, .26, .12, d); bag.position.set(-.5, .72, .1); P.body.add(bag);
    } },
  { name: 'Tokyo', city: 'tokyo', desc: 'Oversized layered jacket, bucket hat, hair clips',
    pal: [['#8ec5ff', '#f4f1e6', '#ff7aa8'], ['#2b2b30', '#ff4f6d', '#f4f1e6'], ['#f6d86b', '#2b2b30', '#7ad6c1']],
    build(P, c) {
      const [j, i, a] = c;
      torsoBox(P, .98, .76, .58, 1.14, j); sleeves(P, .55, j, .34);
      const under = bx(.78, .16, .5, i); under.position.set(0, .78, 0); P.body.add(under);
      const hood = bx(.7, .12, .44, i); hood.position.set(0, 1.54, -.02); P.body.add(hood);
      const pk = bx(.28, .2, .06, a); pk.position.set(-.2, 1.0, .31); P.body.add(pk);
      legWrap(P, .31, .34, 0, .62, '#2b2e3c');
      for (const l of [P.legL, P.legR]) { const pl = bx(.32, .2, .46, '#f4f1e6'); pl.position.set(0, -.68, .07); l.add(pl); }
      const bucket = cyl(.3, .36, .24, a, 12); hat(P, bucket, .3); hat(P, cyl(.5, .5, .04, a, 14), .2);
      for (let k = 0; k < 2; k++) { const clip = bx(.12, .05, .03, '#ffffff'); at(clip, -.28, .0 - k * .08, .3, 0, 0, .5 - k); P.headG.add(clip); }
    } },
  { name: 'Sydney', city: 'sydney', desc: 'Beach tee, board shorts, wide sunhat, shades',
    pal: [['#f7f7f2', '#2f9ed6', '#e8c07d'], ['#ff8c42', '#1d6b8f', '#f7f7f2'], ['#38c6a0', '#f4f1e6', '#d9a066']],
    build(P, c) {
      const [t, s, h] = c;
      torsoBox(P, .76, .66, .45, 1.17, t); sleeves(P, .24, t, .26);
      legWrap(P, .32, .35, 0, .38, s);
      for (const l of [P.legL, P.legR]) { const f = bx(.28, .1, .42, '#e8c07d'); f.position.set(0, -.74, .06); l.add(f); }
      hat(P, cyl(.5, .5, .04, h, 16), .24); hat(P, cyl(.3, .32, .2, h, 14), .34); hat(P, cyl(.325, .325, .05, s, 14), .26);
      const sg = bx(.46, .1, .04, '#1a1a1f'); sg.position.set(0, .04, .3); P.headG.add(sg);
      const bd = bx(.14, 1.3, .06, '#fbfbf5'); at(bd, .3, 1.35, -.32, 0, 0, .12); P.body.add(bd); const st = bx(.14, .9, .07, s); at(st, .3, 1.35, -.32, 0, 0, .12); st.scale.y = .08; P.body.add(st);
    } },
  { name: 'Rio', city: 'rio', desc: 'Football-style jersey, shorts and sunglasses',
    pal: [['#ffd400', '#0a8f3c', '#0b3d91'], ['#0a8f3c', '#ffd400', '#0b3d91'], ['#1c75d8', '#ffffff', '#ffd400']],
    build(P, c) {
      const [j, tr, sh] = c;
      torsoBox(P, .76, .7, .45, 1.15, j); sleeves(P, .3, j, .25);
      const col = bx(.5, .08, .46, tr); col.position.set(0, 1.5, 0); P.body.add(col); const band = bx(.78, .1, .47, tr); band.position.set(0, 1.0, 0); P.body.add(band);
      legWrap(P, .31, .35, 0, .42, sh); legWrap(P, .315, .355, .36, .42, tr);
      const sg = bx(.46, .1, .04, '#14141a'); sg.position.set(0, .04, .3); P.headG.add(sg);
      for (const a of [P.armL, P.armR]) { const bnd = bx(.24, .06, .26, tr); bnd.position.y = -.3; a.add(bnd); }
    } },
  { name: 'Cairo', city: 'cairo', desc: 'Galabeya robe and wrapped turban',
    pal: [['#e8d7b0', '#a8452a', '#f7f1df'], ['#2c4a6b', '#e8d7b0', '#f7f1df'], ['#a67c52', '#2c2c2c', '#f7f1df']],
    build(P, c) {
      const [r, tr, tb] = c;
      torsoBox(P, .78, .5, .48, 1.2, r); const sk = cyl(.41, .48, .76, r, 12); sk.position.y = .45; sk.scale.z = .75; P.body.add(sk); long(sk); sleeves(P, .68, r, .27);
      legWrap(P, .3, .34, 0, .45, r);
      const bd = bx(.5, .06, .06, tr); bd.position.set(0, 1.42, .25); P.body.add(bd);
      for (let i = 0; i < 3; i++) { const w = cyl(.35 - i * .02, .35 - i * .02, .09, tb, 14); hat(P, w, .27 + i * .08); w.rotation.z = (i - 1) * .06; }
      hat(P, sph(.17, tb), .6); hideHair(P);
    } },
  { name: 'Cape Town', city: 'capetown', desc: 'Wax-print jacket, bold beanie, warm scarf',
    pal: [['#e8590c', '#ffd43b', '#1c7ed6'], ['#2f9e44', '#ffd43b', '#c2255c'], ['#7048e8', '#fcc419', '#f8f9fa']],
    build(P, c) {
      const [j, p1, p2] = c;
      torsoBox(P, .8, .66, .48, 1.16, j); sleeves(P, .6, j, .25);
      for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) { const d = bx(.16, .16, .03, k ? p2 : p1); d.rotation.z = .785; d.position.set(-.2 + i * .2, 1.0 + k * .2, .245); P.body.add(d); }
      const sf = bx(.58, .16, .54, p2); sf.position.set(0, 1.55, 0); P.body.add(sf);
      const be = cyl(.32, .35, .22, p1, 12); hat(P, be, .3); const stripe = cyl(.355, .355, .06, p2, 12); hat(P, stripe, .28);
      legWrap(P, .285, .33, 0, .8, '#2b3a55');
    } },
  { name: 'Singapore', city: 'singapore', desc: 'Batik shirt, light trousers and cap',
    pal: [['#2aa5a0', '#f4c542', '#f4f1e6'], ['#c2255c', '#f4f1e6', '#1b1b1b'], ['#2c5aa0', '#f4a261', '#f4f1e6']],
    build(P, c) {
      const [s, m, cap] = c;
      torsoBox(P, .76, .7, .45, 1.15, s); sleeves(P, .3, s, .25);
      for (let i = 0; i < 6; i++) { const d = bx(.12, .12, .03, m); d.rotation.z = .785; d.position.set(-.26 + (i % 3) * .26, 1.0 + Math.floor(i / 3) * .26, .235); P.body.add(d); }
      legWrap(P, .285, .33, 0, .8, '#e3dccb'); const cp = cyl(.34, .36, .16, cap, 12); hat(P, cp, .3); const br = bx(.5, .04, .3, cap); br.position.set(0, .22, .4); P.headG.add(br);
      const ln = bx(.06, .32, .04, '#ffffff'); ln.position.set(.0, 1.3, .24); P.body.add(ln); const tag = bx(.14, .18, .03, m); tag.position.set(0, 1.08, .24); P.body.add(tag);
    } },
  { name: 'Istanbul', city: 'istanbul', desc: 'Tulip-pattern waistcoat, scarf and flat cap',
    pal: [['#8e2c2c', '#e8c07d', '#2b4c7e'], ['#2b4c7e', '#e8c07d', '#c0392b'], ['#4a6b3f', '#e8c07d', '#8e2c2c']],
    build(P, c) {
      const [w, g, sc] = c;
      torsoBox(P, .8, .7, .48, 1.15, '#f4f1e6'); sleeves(P, .66, '#f4f1e6', .24);
      const vest = bx(.82, .66, .5, w); vest.position.set(0, 1.15, 0); P.body.add(vest); const gap = bx(.14, .68, .52, '#f4f1e6'); gap.position.set(0, 1.15, 0); P.body.add(gap);
      for (let i = 0; i < 2; i++) for (const sx of [-1, 1]) { const t = bx(.08, .14, .03, g); t.position.set(sx * .28, 1.05 + i * .2, .26); P.body.add(t); }
      const sf = bx(.56, .14, .5, sc); sf.position.set(0, 1.55, 0); P.body.add(sf); const tl = bx(.12, .46, .05, sc); at(tl, .14, 1.32, .26, 0, 0, -.1); P.body.add(tl);
      hat(P, cyl(.37, .4, .12, '#3a3a40', 12), .3); const vz = bx(.5, .04, .28, '#3a3a40'); vz.position.set(0, .22, .38); P.headG.add(vz);
      legWrap(P, .285, .33, 0, .8, '#2b2f3a');
    } },
];

/* seated riding pose on exposed vehicles (scooter, bike, bicycle, boat): long hems fold away so legs are not buried in the seat */
export function setRidePose(group, on) { group.traverse(o => { if (o.userData && o.userData.long) o.visible = !on; }); }

/* apply: P = avatar parts {body, legL, legR, armL, armR, headG, hair}; look.outfit 0..N, look.outfitVar 0..2 */
export function dressAvatar(P, look) {
  const i = Math.max(0, Math.min(OUTFITS.length - 1, (look && +look.outfit) | 0));
  const o = OUTFITS[i]; if (!o.build) return;
  const v = Math.max(0, Math.min(2, (look && +look.outfitVar) | 0));
  // hide the base shirt/pants colour show-through: base shells stay as an inner layer
  o.build(P, o.pal[v], v);
}
