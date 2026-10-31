// voice travel: a player in voice who changes city moves to that city's room (v62),
// listenOnly preserved; full destination drops with a precise message (v63).
// Self-contained: spawns its own server on :8956 with VOICE_MAX=3 (small cap so
// "full" is cheap) and a throwaway data file, so it is safe to run repeatedly.
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path'; import fs from 'fs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8956, B = 'http://localhost:' + PORT;
const DATA = '/tmp/lk-vt-test-' + process.pid + '.json';
const srv = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: Object.assign({}, process.env, { PORT: String(PORT), VOICE_ENABLED: '1', VOICE_MAX: '3', DATA_FILE: DATA, PGSSL: 'false' }),
  stdio: 'ignore',
});
const cleanup = () => { try { srv.kill(); } catch {} try { fs.rmSync(DATA, { force: true }); } catch {} };
process.on('exit', cleanup);
let up = false;
for (let i = 0; i < 100 && !up; i++) { await new Promise(r => setTimeout(r, 100)); up = await fetch(B + '/api/health').then(r => r.ok).catch(() => false); }
if (!up) { console.log('FAIL server did not start'); cleanup(); process.exit(1); }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const H = { 'content-type': 'application/json' };
const j = async (p, o) => { const r = await fetch(B + p, o); return { s: r.status, b: await r.json().catch(() => ({})) }; };
const join = n => j('/api/join', { method: 'POST', headers: H, body: JSON.stringify({ name: n, district: 'none', adult: true }) });
const A = (t, b) => ({ method: 'POST', headers: Object.assign({ authorization: 'Bearer ' + t }, H), body: JSON.stringify(b || {}) });
const G = t => ({ headers: { authorization: 'Bearer ' + t } });
const ping = (p, city, x, z) => j('/api/players/' + p.player.id + '/ping', A(p.token, { city, x: x || 0, z: z || 0 }));
const vjoin = (p, lo) => j('/api/players/' + p.player.id + '/voice/join', A(p.token, lo ? { listenOnly: true } : {}));
const vget = p => j('/api/players/' + p.player.id + '/voice', G(p.token));

const tra = (await join('TrvA')).b, trb = (await join('TrvB')).b, lis = (await join('TrvL')).b;
await ping(tra, 'kerala'); await ping(trb, 'kerala'); await ping(lis, 'kerala');
let r = await vjoin(tra); ok(r.s === 200 && r.b.room === 'city:kerala', 'A joins kerala room: ' + r.s);
r = await vjoin(trb); ok(r.b.hear.includes(tra.player.id), 'B hears A in kerala');
// travel: A pings from london -> membership moves
await ping(tra, 'london', 10, 10);
r = await vget(tra);
ok(r.b.room === 'city:london', 'A now in london room after travel: ' + r.b.room);
r = await vget(trb);
ok(!r.b.hear.includes(tra.player.id) && !(r.b.members || []).some(m => m.id === tra.player.id), 'B no longer hears/sees A after A left');
// listenOnly preserved across a move
r = await vjoin(lis, true); ok(r.s === 200, 'L joins listen-only');
await ping(lis, 'dubai', 5, 5);
r = await vget(lis);
ok(r.b.room === 'city:dubai' && (r.b.members || []).find(m => m.id === lis.player.id).listenOnly === true, 'L moved to dubai with listenOnly=true');
// return: A comes back to kerala, mutual hearing restored
await ping(tra, 'kerala', 1, 1);
r = await vget(trb);
ok(r.b.hear.includes(tra.player.id), 'B hears A again after return');
// full destination (VOICE_MAX=3 here): fill london with 3, A travels -> precise drop
const f1 = (await join('TrvF1')).b, f2 = (await join('TrvF2')).b, f3 = (await join('TrvF3')).b;
await ping(f1, 'london'); await ping(f2, 'london'); await ping(f3, 'london');
await vjoin(f1); await vjoin(f2); await vjoin(f3);
await ping(tra, 'london', 20, 20);
r = await vget(tra);
ok(r.s === 409 && /voice room is full/.test(String(r.b.error)), 'full destination: precise 409 message: ' + JSON.stringify(r.b));
// voluntary leave keeps the generic message
await j('/api/players/' + lis.player.id + '/voice/leave', A(lis.token, {}));
r = await vget(lis);
ok(r.s === 409 && r.b.error === 'not in a voice room', 'after voluntary leave: generic 409: ' + JSON.stringify(r.b));
// A can rejoin after a slot frees (F1 leaves london room)
await j('/api/players/' + f1.player.id + '/voice/leave', A(f1.token, {}));
r = await vjoin(tra);
ok(r.s === 200 && r.b.room === 'city:london', 'A rejoins london after a slot freed: ' + r.s + ' ' + r.b.room);
console.log('pass', pass, 'fail', fail);
cleanup();
process.exit(fail ? 1 : 0);
