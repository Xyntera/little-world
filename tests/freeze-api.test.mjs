// Freeze Beat API: matchmaking, play/stop phases, fouls, reaction clamping,
// tie rounds, bot games, forfeit, auth. Self-contained: spawns its own
// server on :8960 with a throwaway data file and fast test timing.
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path'; import fs from 'fs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8960, B = 'http://localhost:' + PORT;
const DATA = '/tmp/lk-freeze-test-' + process.pid + '.json';
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore',
  env: Object.assign({}, process.env, { PORT: String(PORT), DATA_FILE: DATA, PGSSL: 'false',
    FREEZE_PLAY_MIN_MS: '120', FREEZE_PLAY_SPAN_MS: '60', FREEZE_STOP_MS: '1600',
    FREEZE_BOT_MIN_MS: '80', FREEZE_BOT_SPAN_MS: '120', FREEZE_BOT_FOUL_P: '0' }) });
const cleanup = () => { try { srv.kill(); } catch {} try { fs.rmSync(DATA, { force: true }); } catch {} };
process.on('exit', cleanup);
let up = false;
for (let i = 0; i < 100 && !up; i++) { await new Promise(r => setTimeout(r, 100)); up = await fetch(B + '/api/health').then(r => r.ok).catch(() => false); }
if (!up) { console.log('FAIL server did not start'); cleanup(); process.exit(1); }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'content-type': 'application/json' };
const j = async (p, o) => { const r = await fetch(B + p, o); return { s: r.status, b: await r.json().catch(() => ({})) }; };
const mk = async n => { const r = await j('/api/join', { method: 'POST', headers: H, body: JSON.stringify({ name: n, district: 'none', adult: true }) }); return { id: r.b.player.id, h: Object.assign({ authorization: 'Bearer ' + r.b.token }, H) }; };
const view = async (pl) => (await j('/api/players/' + pl.id + '/freeze', { headers: pl.h })).b.game;
const tap = async (pl, ms) => j('/api/players/' + pl.id + '/freeze/tap', { method: 'POST', headers: pl.h, body: JSON.stringify(ms === undefined ? {} : { reactionMs: ms }) });
const waitPhase = async (pl, phase, tries = 80) => { for (let i = 0; i < tries; i++) { const g = await view(pl); if (!g || g.phase === phase || g.status === 'finished') return g; await sleep(50); } return view(pl); };

const a = await mk('FrA'), b = await mk('FrB');
ok((await j('/api/players/' + a.id + '/freeze')).s === 401, 'freeze poll needs a token');
ok((await view(a)) === null, 'no game at first');
let r = await j('/api/players/' + a.id + '/freeze/new', { method: 'POST', headers: a.h, body: '{}' });
ok(r.s === 201 && r.b.game.status === 'waiting', 'open game waits: ' + r.s);
ok(r.b.game.playUntil === undefined && r.b.game.playMs === undefined, 'stop timing not exposed during play');
r = await j('/api/players/' + b.id + '/freeze/new', { method: 'POST', headers: b.h, body: '{}' });
ok(r.s === 201 && r.b.game.status === 'playing' && r.b.game.round === 1 && r.b.game.phase === 'play', 'second player matches in, round 1 dancing: ' + r.s);
r = await j('/api/players/' + a.id + '/freeze/new', { method: 'POST', headers: a.h, body: '{}' });
ok(r.s === 409, 'already in a game: 409');

// round 1: A fouls (taps during play), B taps clean after stop -> B wins the round
r = await tap(a);
ok(r.s === 200 && r.b.game.fouled[0] === true, 'tap during music = false start, recorded: ' + JSON.stringify(r.b.error || r.b.game.fouled));
r = await tap(a);
ok(r.s === 409, 'cannot act twice in a round');
await waitPhase(b, 'stop');
r = await tap(b, 140);
ok(r.s === 200, 'B tapped after stop');
let g = await view(a);
ok(g && g.round === 2 && g.players[1].wins === 1 && (g.phase === 'play' || g.phase === 'stop'), 'clean tap beats a foul, round 2 starts: ' + JSON.stringify(g && { round: g.round, wins: g.players.map(p => p.wins) }));
ok(g.last && g.last.reactions && Object.values(g.last.reactions).every(v => v === null || typeof v === 'number'), 'reaction results revealed only after resolve');

// round 2: both tap within the tie band -> round replays (same round number, no win)
await waitPhase(a, 'stop');
await tap(a, 200); await tap(b, 260);
g = await view(a);
ok(g && g.round === 3 && g.players[0].wins === 0 && g.players[1].wins === 1 && g.last.winner === null, 'reactions inside the tie band replay the round: ' + JSON.stringify(g && { round: g.round, wins: g.players.map(p => p.wins), last: g.last }));

// round 3: reported reaction is honoured, and clamped to the server window
await waitPhase(a, 'stop');
const t0 = Date.now();
await tap(a, 5);
await sleep(300); // B reacts genuinely slower, outside the tie band
r = await tap(b, 999999);
const serverDelta = Date.now() - t0 + 200; // upper slack over the true delta
g = await view(a);
const ra = g && g.last && g.last.reactions;
ok(g.last.winner === 0 && g.players[0].wins === 1, 'faster honest reaction wins the round');
ok(ra && ra[Object.keys(ra)[0]] !== undefined, 'reactions published after resolve');
ok(g.last.reactions[Object.keys(g.last.reactions)[0]] === 5, 'small reported reaction stored as reported (5ms): ' + JSON.stringify(g.last.reactions));
ok(g.last.reactions[Object.keys(g.last.reactions)[1]] <= serverDelta && g.last.reactions[Object.keys(g.last.reactions)[1]] < 900, 'inflated reported reaction clamped to the server window: ' + JSON.stringify(g.last.reactions));

// round 4: nobody taps -> round resolves on the stop timeout as a miss, replayed
g = await waitPhase(a, 'stop');
await sleep(1900);
g = await waitPhase(a, 'play');
ok(g && g.round === 5 && g.players[0].wins === 1 && g.players[1].wins === 1, 'double miss replays the round after the stop window: ' + JSON.stringify(g && { round: g.round, wins: g.players.map(p => p.wins) }));

// B leaves -> forfeit, A wins
r = await j('/api/players/' + b.id + '/freeze/leave', { method: 'POST', headers: b.h, body: '{}' });
ok(r.s === 200 && r.b.game === null, 'B left cleanly');
g = await view(a);
ok(g && g.status === 'finished' && g.forfeit === true && g.winner === 0, 'leaving forfeits to the other player');
r = await j('/api/players/' + a.id + '/freeze/nope', { method: 'POST', headers: a.h, body: '{}' });
ok(r.s === 404, 'unknown freeze action: 404');

// bot game: clearly labeled, plays itself, human wins with honest fast reports
r = await j('/api/players/' + a.id + '/freeze/new', { method: 'POST', headers: a.h, body: JSON.stringify({ mode: 'computer' }) });
ok(r.s === 201 && r.b.game.status === 'playing' && r.b.game.players[1].bot === true && r.b.game.players[1].name === 'Computer', 'bot opponent clearly labeled: ' + JSON.stringify(r.b.game.players));
let done = null;
for (let i = 0; i < 240 && !done; i++) {
  g = await view(a);
  if (!g) break;
  if (g.status === 'finished') { done = g; break; }
  if (g.phase === 'stop' && !g.tapped[0]) await tap(a, 30);
  await sleep(50);
}
ok(done && done.status === 'finished', 'bot game reaches a finish: ' + JSON.stringify(done && { winner: done.winner, draw: done.draw }));
ok(done && done.winner === 0, 'honest 30ms reports beat the bot: ' + JSON.stringify(done && done.players.map(p => p.wins)));

console.log('freeze-api: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
