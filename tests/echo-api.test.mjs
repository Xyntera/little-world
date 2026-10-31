// Echo Dance API: matchmaking, watch/input phases, submit, resolve, forfeit, auth.
// Self-contained: spawns its own server on :8959 with a throwaway data file.
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path'; import fs from 'fs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8959, B = 'http://localhost:' + PORT;
const DATA = '/tmp/lk-echo-test-' + process.pid + '.json';
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore',
  env: Object.assign({}, process.env, { PORT: String(PORT), DATA_FILE: DATA, PGSSL: 'false' }) });
const cleanup = () => { try { srv.kill(); } catch {} try { fs.rmSync(DATA, { force: true }); } catch {} };
process.on('exit', cleanup);
let up = false;
for (let i = 0; i < 100 && !up; i++) { await new Promise(r => setTimeout(r, 100)); up = await fetch(B + '/api/health').then(r => r.ok).catch(() => false); }
if (!up) { console.log('FAIL server did not start'); cleanup(); process.exit(1); }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const H = { 'content-type': 'application/json' };
const j = async (p, o) => { const r = await fetch(B + p, o); return { s: r.status, b: await r.json().catch(() => ({})) }; };
const mk = async n => { const r = await j('/api/join', { method: 'POST', headers: H, body: JSON.stringify({ name: n, district: 'none', adult: true }) }); return { id: r.b.player.id, h: Object.assign({ authorization: 'Bearer ' + r.b.token }, H) }; };
const a = await mk('EcA'), b = await mk('EcB');
ok((await j('/api/players/' + a.id + '/echo')).s === 401, 'echo poll needs a token');
ok((await j('/api/players/' + a.id + '/echo', { headers: a.h })).b.game === null, 'no game at first');
let r = await j('/api/players/' + a.id + '/echo/new', { method: 'POST', headers: a.h, body: '{}' });
ok(r.s === 201 && r.b.game.status === 'waiting', 'open game waits: ' + r.s);
r = await j('/api/players/' + b.id + '/echo/new', { method: 'POST', headers: b.h, body: '{}' });
ok(r.s === 201 && r.b.game.status === 'playing' && r.b.game.round === 1 && r.b.game.seq.length === 3, 'second player matches in, round 1 dealt');
r = await j('/api/players/' + a.id + '/echo/new', { method: 'POST', headers: a.h, body: '{}' });
ok(r.s === 409, 'already in a game: 409');
const seq = r.b.game.seq || (await j('/api/players/' + a.id + '/echo', { headers: a.h })).b.game.seq;
r = await j('/api/players/' + a.id + '/echo/submit', { method: 'POST', headers: a.h, body: JSON.stringify({ seq: ['dance', 'dance', 'dance'] }) });
ok(r.s === 409 && /watch first/.test(r.b.error), 'submit during watch rejected: ' + JSON.stringify(r.b.error));
// wait out the watch window (1.2s + 3*0.8s = 3.6s)
await new Promise(r2 => setTimeout(r2, 4000));
let va = (await j('/api/players/' + a.id + '/echo', { headers: a.h })).b.game;
ok(va.phase === 'input' && va.seq === undefined && va.seqLen === 3, 'input phase: sequence hidden, length known');
const correct = va._seq; // not served; use the earlier watch-phase copy
r = await j('/api/players/' + a.id + '/echo/submit', { method: 'POST', headers: a.h, body: JSON.stringify({ seq }) });
ok(r.s === 200 && r.b.game.submitted[0] === true, 'A submitted');
ok(r.b.game.phase === 'input', 'waiting on B');
r = await j('/api/players/' + b.id + '/echo/submit', { method: 'POST', headers: b.h, body: JSON.stringify({ seq }) });
ok(r.s === 200 && r.b.game.round === 2, 'both correct -> round 2');
// this time B slips (real watch copy for round 2)
await new Promise(r2 => setTimeout(r2, 100));
const vb = (await j('/api/players/' + b.id + '/echo', { headers: b.h })).b.game;
const seq2 = vb.seq;
await new Promise(r2 => setTimeout(r2, 4600));
const bad = seq2.slice(); bad[0] = bad[0] === 'dance' ? 'party' : 'dance';
await j('/api/players/' + a.id + '/echo/submit', { method: 'POST', headers: a.h, body: JSON.stringify({ seq: seq2 }) });
r = await j('/api/players/' + b.id + '/echo/submit', { method: 'POST', headers: b.h, body: JSON.stringify({ seq: bad }) });
ok(r.b.game.status === 'finished' && r.b.game.winner === 0 && !r.b.game.draw, 'B slips -> A wins');
r = await j('/api/players/' + b.id + '/echo/leave', { method: 'POST', headers: b.h, body: '{}' });
ok(r.s === 200 && r.b.game === null, 'leave after finish clears');
// bot mode
r = await j('/api/players/' + b.id + '/echo/new', { method: 'POST', headers: b.h, body: '{"mode":"computer"}' });
ok(r.s === 201 && r.b.game.status === 'playing' && r.b.game.players[1].bot === true, 'bot game starts immediately');
const vb2 = (await j('/api/players/' + b.id + '/echo', { headers: b.h })).b.game; const seqb = vb2.seq;
await new Promise(r2 => setTimeout(r2, 4000));
r = await j('/api/players/' + b.id + '/echo/submit', { method: 'POST', headers: b.h, body: JSON.stringify({ seq: seqb }) });
ok(r.s === 200, 'bot game submit ok');
await new Promise(r2 => setTimeout(r2, 4500));
const vb3 = (await j('/api/players/' + b.id + '/echo', { headers: b.h })).b.game;
ok(vb3.round >= 2 || vb3.status === 'finished', 'bot submitted too; round resolved (round ' + vb3.round + ' status ' + vb3.status + ')');
r = await j('/api/players/' + b.id + '/echo/leave', { method: 'POST', headers: b.h, body: '{}' });
ok(r.s === 200, 'leave bot game');
console.log('pass', pass, 'fail', fail);
cleanup();
process.exit(fail ? 1 : 0);
