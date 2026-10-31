// Update 118e: river band outline math (pure, no THREE) - shared by the renderer (cities.js) and dev/harness/bandcheck.mjs.
// The outline follows the inRiver h=4 tube boundary exactly: offset polylines, ROUND JOINS (arc on the bend's outside,
// offset-line intersection on the inside), semicircle terminal caps - polygonal arc sampling (max 11.25 deg steps,
// chord deviation <= ~4*(1-cos(5.6deg)) ~= 2cm from the mathematical tube; rendered = approximation of the tube).
export function riverReaches(RIVERW) { // split segments into connected polylines (a course may leave and re-enter the window: disjoint reaches)
  const reaches = []; let cur = [];
  for (const [x0, z0, x1, z1] of RIVERW) {
    if (cur.length && (cur[cur.length - 1][0] !== x0 || cur[cur.length - 1][1] !== z0)) { reaches.push(cur); cur = []; }
    if (!cur.length) cur.push([x0, z0]);
    cur.push([x1, z1]);
  }
  if (cur.length) reaches.push(cur);
  return reaches;
}
export function bandOutline(pts, H, caps) { // pts [[x,z]...] connected polyline -> outline [[x,z]...] of the radius-H tube (closed ring, no repeat of first point). caps: optional {start:false,end:false} to SQUARE OFF a terminal (no semicircle cap bulge) - Update 118p: shoreline-flush river terminals (bangkok sea junction); default both true = historical behavior
  const n = pts.length, dirs = [], nrms = [];
  for (let i = 0; i < n - 1; i++) { const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dz) || 1; dirs.push([dx / l, dz / l]); nrms.push([-dz / l, dx / l]); }
  const arc = (cx, cz, a0, da, r) => { const st = Math.max(2, Math.ceil(Math.abs(da) / (Math.PI / 16))), o = []; for (let k = 1; k <= st; k++) { const a = a0 + da * k / st; o.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } return o; };
  const side = (sgn) => {
    const o = [];
    for (let i = 0; i < n; i++) {
      const j = Math.min(i, n - 2);
      if (i === 0 || i === n - 1) { o.push([pts[i][0] + sgn * H * nrms[j][0], pts[i][1] + sgn * H * nrms[j][1]]); continue; }
      const d0 = dirs[i - 1], d1 = dirs[i], n0 = nrms[i - 1], n1 = nrms[i];
      const cross = d0[0] * d1[1] - d0[1] * d1[0];
      if ((cross < 0) === (sgn > 0)) { // outside of the bend: round join
        const a0 = Math.atan2(sgn * n0[1], sgn * n0[0]), a1 = Math.atan2(sgn * n1[1], sgn * n1[0]);
        let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        o.push([pts[i][0] + sgn * H * n0[0], pts[i][1] + sgn * H * n0[1]], ...arc(pts[i][0], pts[i][1], a0, da, H));
      } else { // inside of the bend: intersection of the two offset lines
        const ox = sgn * H * n0[0], oz = sgn * H * n0[1], ex = sgn * H * n1[0], ez = sgn * H * n1[1];
        const den = d0[0] * d1[1] - d0[1] * d1[0];
        if (Math.abs(den) > 1e-9) { const t = ((ex - ox) * d1[1] - (ez - oz) * d1[0]) / den; o.push([pts[i][0] + ox + t * d0[0], pts[i][1] + oz + t * d0[1]]); }
        else o.push([pts[i][0] + ox, pts[i][1] + oz]);
      }
    }
    return o;
  };
  const cap = (pt, d, nrm, fromSgn) => { // semicircle at a polyline end, from the fromSgn offset point around through +d (end cap) or -d (start cap)
    const a0 = Math.atan2(fromSgn * nrm[1], fromSgn * nrm[0]);
    const am = Math.atan2(d[1], d[0]); // direction the cap must bulge toward
    const mid1 = a0 + Math.PI / 2, mid2 = a0 - Math.PI / 2;
    const dAng = (a, b) => { let t = a - b; while (t > Math.PI) t -= 2 * Math.PI; while (t < -Math.PI) t += 2 * Math.PI; return Math.abs(t); };
    const da = dAng(mid1, am) < dAng(mid2, am) ? Math.PI : -Math.PI;
    return arc(pt[0], pt[1], a0, da, H);
  };
  const L = side(1), R = side(-1);
  const endCap = caps && caps.end === false ? [] : cap(pts[n - 1], dirs[n - 2], nrms[n - 2], 1); // L[n-1] -> R[n-1] bulging toward +dir
  const startCap = caps && caps.start === false ? [] : cap(pts[0], [-dirs[0][0], -dirs[0][1]], nrms[0], -1); // R[0] -> L[0] bulging toward -dir
  return [...L, ...endCap, ...R.slice().reverse(), ...startCap];
}
