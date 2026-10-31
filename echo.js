/* Echo Dance rules engine (2 players). Pure functions, original code.
 * Watch the server's sequence of dance moves, then tap it back from memory.
 * Both players get the same sequence each round; a player who slips while the
 * other is perfect loses the game. Just for fun: no points, no stakes.
 * In-memory only: a game lives minutes and is gone on restart. */
'use strict';
const crypto = require('crypto');

const MOVES = ['dance', 'party', 'bhangra', 'disco', 'robot', 'spin', 'moonwalk', 'garba'];
const WATCH_BASE_MS = 1200, WATCH_PER_MOVE_MS = 800, INPUT_MS = 25000;
const MAX_ROUND = 10, MAX_ATTEMPTS = 3, WAIT_MS = 5 * 60000, DONE_KEEP_MS = 10 * 60000;

const rngDefault = n => crypto.randomInt(n);

function newGame(id, a, b, now) {
  return {
    id, status: b ? 'playing' : 'waiting',
    players: [a, b || null],            // { pid, name, bot }
    round: 0, attempts: 0, phase: b ? 'watch' : 'lobby', seq: [], subs: {}, phaseAt: now,
    winner: null, forfeit: false, draw: false, log: [], created: now, rev: 1,
  };
}
function addLog(g, s) { g.log.push(s); if (g.log.length > 8) g.log.shift(); }
const nameOf = (g, i) => (g.players[i] && g.players[i].name) || 'Player';
const watchMs = g => WATCH_BASE_MS + WATCH_PER_MOVE_MS * g.seq.length;

function deal(g, now, rng) {
  const n = g.round + 2, r = rng || rngDefault;
  g.seq = Array.from({ length: n }, () => MOVES[r(MOVES.length)]);
  g.subs = {}; g.phase = 'watch'; g.phaseAt = now; g.rev++;
  addLog(g, 'Round ' + g.round + ': watch ' + n + ' moves');
}

function start(g, now, rng) { g.round = 1; g.attempts = 0; deal(g, now, rng); }

function join(g, me, now, rng) {
  if (g.status !== 'waiting') throw new Error('game already started');
  g.players[1] = me; g.status = 'playing'; g.round = 1; g.attempts = 0;
  deal(g, now, rng);
}

function botRecall(g, rng) {
  const r = rng || rngDefault, err = Math.min(0.3, 0.05 + 0.02 * g.round);
  return g.seq.map(m => (r(1000) / 1000 < err) ? MOVES[r(MOVES.length)] : m);
}

function submit(g, pid, arr, now) {
  if (g.status !== 'playing') throw new Error('game not in progress');
  if (g.phase !== 'input') throw new Error(g.phase === 'watch' ? 'watch first' : 'round is over');
  const i = g.players.findIndex(p => p && p.pid === pid);
  if (i < 0) throw new Error('not in this game');
  if (g.subs[pid]) throw new Error('already submitted');
  if (!Array.isArray(arr) || arr.length !== g.seq.length || !arr.every(m => MOVES.includes(m))) throw new Error('must be the ' + g.seq.length + ' moves, in order');
  g.subs[pid] = { ok: arr.every((m, k) => m === g.seq[k]) };
  g.rev++;
  if (g.players.every(p => p && g.subs[p.pid])) resolve(g, now); // all in (bots included)
}

function resolve(g, now, rng) {
  const okOf = i => { const p = g.players[i]; return !!(p && p.bot ? g.subs[p.pid] && g.subs[p.pid].ok : g.subs[p.pid] && g.subs[p.pid].ok); };
  const a = okOf(0), b = okOf(1);
  g.rev++; g.phaseAt = now;
  if (a && b) {
    if (g.round >= MAX_ROUND) { g.status = 'finished'; g.phase = 'done'; g.draw = true; addLog(g, 'Both perfect through round ' + MAX_ROUND + ' - a draw'); return; }
    g.round++; g.attempts = 0; addLog(g, 'Both got it - round ' + g.round); deal(g, now, rng); return;
  }
  if (a !== b) {
    g.status = 'finished'; g.phase = 'done'; g.winner = a ? 0 : 1;
    addLog(g, nameOf(g, g.winner) + ' remembered, ' + nameOf(g, 1 - g.winner) + ' slipped - ' + nameOf(g, g.winner) + ' wins'); return;
  }
  g.attempts++;
  if (g.attempts >= MAX_ATTEMPTS) { g.status = 'finished'; g.phase = 'done'; g.draw = true; addLog(g, 'Both slipped again - a draw'); return; }
  addLog(g, 'Both slipped - watch a new set of ' + (g.round + 2));
  deal(g, now, rng);
}

/* lazily advance: phase timers, bot submission, timeouts. Call before reading state. */
function advance(g, now, rng) {
  if (g.status !== 'playing') return g;
  if (g.phase === 'watch' && now >= g.phaseAt + watchMs(g)) { g.phase = 'input'; g.phaseAt = now; g.rev++; }
  if (g.phase === 'input') {
    const bot = g.players.find(p => p && p.bot);
    if (bot && !g.subs[bot.pid] && now >= g.phaseAt + 3000 + (bot.pid.length % 5) * 800) {
      g.subs[bot.pid] = { ok: botRecall(g, rng).every((m, k) => m === g.seq[k]) }; g.rev++;
      if (g.players.every(p => !p || g.subs[p.pid])) { resolve(g, now, rng); return g; }
    }
    if (now >= g.phaseAt + INPUT_MS) resolve(g, now, rng); // missing submissions count as slips
  }
  return g;
}

function view(g, pid) {
  const you = g.players.findIndex(p => p && p.pid === pid);
  return {
    id: g.id, status: g.status, rev: g.rev, you,
    players: g.players.map(p => p ? { name: p.name, bot: !!p.bot } : null),
    round: g.round, attempts: g.attempts, phase: g.phase,
    seq: g.phase === 'watch' ? g.seq : undefined, // hidden again once the watch window ends
    seqLen: g.seq.length,
    watchMs: g.phase === 'watch' ? Math.max(0, g.phaseAt + watchMs(g) - Date.now()) : 0,
    inputMs: g.phase === 'input' ? Math.max(0, g.phaseAt + INPUT_MS - Date.now()) : 0,
    submitted: g.players.map(p => !!(p && g.subs[p.pid])),
    winner: g.winner, draw: g.draw, forfeit: g.forfeit, log: g.log,
  };
}

module.exports = { newGame, join, start, submit, resolve, advance, view, deal, botRecall, MOVES, WATCH_BASE_MS, WATCH_PER_MOVE_MS, INPUT_MS, MAX_ROUND, MAX_ATTEMPTS, WAIT_MS, DONE_KEEP_MS };
