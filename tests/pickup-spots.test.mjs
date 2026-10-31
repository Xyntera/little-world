// pickup spots must never land on a stage platform or its ramp (they collide with shows).
// Self-contained: spawns its own server on :8957 with a throwaway data file.
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path'; import fs from 'fs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8957, B = 'http://localhost:' + PORT;
const DATA = '/tmp/lk-pick-test-' + process.pid + '.json';
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore',
  env: Object.assign({}, process.env, { PORT: String(PORT), DATA_FILE: DATA, PGSSL: 'false' }) });
const cleanup = () => { try { srv.kill(); } catch {} try { fs.rmSync(DATA, { force: true }); } catch {} };
process.on('exit', cleanup);
let up = false;
for (let i = 0; i < 100 && !up; i++) { await new Promise(r => setTimeout(r, 100)); up = await fetch(B + '/api/health').then(r => r.ok).catch(() => false); }
if (!up) { console.log('FAIL server did not start'); cleanup(); process.exit(1); }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const STAGES = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'stages.json'), 'utf8')).stages;
const SPOT_CITIES = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'spots.json'), 'utf8')));
const onStage = (x, z, st) => (Math.abs(x - st.x) < st.w / 2 + .5 && Math.abs(z - st.z) < st.d / 2 + .5) ||
  (Math.abs(x - st.x) < 3 && (z - (st.z + st.d / 2)) >= 0 && (z - (st.z + st.d / 2)) <= 3.5);
const H = { 'content-type': 'application/json' };
const j = async (p, o) => { const r = await fetch(B + p, o); return { s: r.status, b: await r.json().catch(() => ({})) }; };
const jr = await j('/api/join', { method: 'POST', headers: H, body: JSON.stringify({ name: 'PickChk', district: 'none', adult: true }) });
const ah = { authorization: 'Bearer ' + jr.b.token };
let total = 0;
for (const city of SPOT_CITIES) {
  const r = await j('/api/players/' + jr.b.player.id + '/pickups?city=' + city, { headers: ah });
  ok(r.s === 200 && r.b.slots.length > 0, city + ': slots served (' + (r.b.slots || []).length + ')');
  const bad = (r.b.slots || []).filter(sl => onStage(sl.x, sl.z, STAGES[city]));
  total += (r.b.slots || []).length;
  ok(bad.length === 0, city + ': no slot on the stage platform or ramp' + (bad.length ? ' - ' + JSON.stringify(bad[0]) : ''));
}
ok(total > 300, 'coverage: slots sampled across cities (' + total + ')');
// known regression coordinates (were on platforms pre-fix) must never be served
const KNOWN = { paris: [[-13.56, 15.18], [-18.63, 11.82]], tokyo: [[-15.68, 19.78]], sydney: [[-17.16, 13.85]], rio: [[-22.78, 9.54]], singapore: [[-17.03, 16.62]], istanbul: [[-13.51, 17.55]] };
for (const [city, pts] of Object.entries(KNOWN)) {
  const r = await j('/api/players/' + jr.b.player.id + '/pickups?city=' + city, { headers: ah });
  for (const [x, z] of pts) ok(!(r.b.slots || []).some(sl => Math.abs(sl.x - x) < .01 && Math.abs(sl.z - z) < .01), city + ': regression spot ' + x + ',' + z + ' not served');
}
console.log('pass', pass, 'fail', fail);
cleanup();
process.exit(fail ? 1 : 0);
