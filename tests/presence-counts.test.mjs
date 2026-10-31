// Exact presence counting past the old 200-row cap: 250 recently-active players must be counted exactly.
const B = 'http://localhost:8960'; let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
import { spawn } from 'child_process';
import fs from 'fs';
const now = Date.now();
const players = {};
for (let i = 0; i < 150; i++) players['pc_k' + i] = { id: 'pc_k' + i, name: 'K' + i, district: 'none', city: 'kerala', points: 0, look: {}, pos: { x: i % 50, z: 0, dir: 0 }, lastSeen: now - 1000, createdAt: now };
for (let i = 0; i < 80; i++) players['pc_t' + i] = { id: 'pc_t' + i, name: 'T' + i, district: 'none', city: 'tokyo', points: 0, look: {}, pos: null, lastSeen: now - 1000, createdAt: now };
for (let i = 0; i < 20; i++) players['pc_n' + i] = { id: 'pc_n' + i, name: 'N' + i, district: 'none', points: 0, look: {}, pos: null, lastSeen: now - 1000, createdAt: now }; // no city -> kerala
for (let i = 0; i < 5; i++) players['pc_s' + i] = { id: 'pc_s' + i, name: 'S' + i, district: 'none', city: 'tokyo', points: 0, look: {}, pos: null, lastSeen: now - 3600000, createdAt: now }; // stale
fs.writeFileSync('/tmp/lk-pcount.json', JSON.stringify({ players, districts: {}, cities: {} }));
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: '8960', DATA_FILE: '/tmp/lk-pcount.json' }, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let up = false;
for (let i = 0; i < 40; i++) { await sleep(500); try { const r = await fetch(B + '/api/health'); if (r.ok) { up = true; break; } } catch {} }
if (!up) { console.log('server did not start'); process.exit(1); }
const cities = (await (await fetch(B + '/api/cities')).json()).cities;
const ker = cities.find(c => c.id === 'kerala'), tok = cities.find(c => c.id === 'tokyo'), lon = cities.find(c => c.id === 'london');
ok(ker && ker.online === 170, 'kerala exact 170 (150 + 20 cityless), got ' + (ker && ker.online));
ok(tok && tok.online === 80, 'tokyo exact 80 (stale excluded), got ' + (tok && tok.online));
ok(lon && lon.online === 0, 'london 0, got ' + (lon && lon.online));
const pres = await (await fetch(B + '/api/presence')).json();
ok(pres.exploringTogether === 250, 'exploringTogether exact 250, got ' + pres.exploringTogether);
const world = await (await fetch(B + '/api/world?city=kerala')).json();
ok(world.online === 170, 'world kerala online exact 170, got ' + world.online);
ok(world.exploringTogether === 250, 'world exploringTogether exact 250, got ' + world.exploringTogether);
ok(world.players.length === 60, 'world list capped at 60 for the city, got ' + world.players.length);
const wtok = await (await fetch(B + '/api/world?city=tokyo')).json();
ok(wtok.online === 80 && wtok.players.length === 0, 'tokyo online 80, no pos -> empty list, got ' + wtok.online + '/' + wtok.players.length);
const lb = await (await fetch(B + '/api/leaderboards')).json();
const lbk = lb.cities.find(c => c.id === 'kerala');
ok(lbk && lbk.online === 170, 'leaderboards kerala online exact 170, got ' + (lbk && lbk.online));
srv.kill();
console.log('presence-counts: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
