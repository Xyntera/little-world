/* Ludo rules engine (2 players). Pure functions, original code. */
'use strict';
const crypto = require('crypto');

const RING = 52, FINISH = 56;
const STARTS = [0, 26];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const COLORS = ['red', 'blue'];
const IDLE_MS = 60000, WAIT_MS = 5 * 60000, BOT_DELAY = 1100;

const rngDefault = () => crypto.randomInt(1, 7);
const abs = (pl, p) => (STARTS[pl] + p) % RING;

function newGame(id, a, b, now) {
  return {
    id, status: b ? 'playing' : 'waiting',
    players: [a, b || null],           // { pid, name, bot }
    pieces: [[-1, -1, -1, -1], [-1, -1, -1, -1]],
    turn: 0, phase: 'roll', dice: null, sixes: 0, winner: null,
    log: [], created: now, turnAt: now, botAt: 0, rev: 1, rewarded: false,
  };
}
function addLog(g, s) { g.log.push(s); if (g.log.length > 8) g.log.shift(); }
const nameOf = (g, i) => (g.players[i] && g.players[i].name) || 'Player';

function moveTarget(g, pl, idx, d) {
  const p = g.pieces[pl][idx];
  if (p === FINISH) return null;
  if (p === -1) return d === 6 ? 0 : null;
  return p + d <= FINISH ? p + d : null;
}
function legalMoves(g) {
  if (g.status !== 'playing' || g.phase !== 'move' || !g.dice) return [];
  const out = [];
  for (let i = 0; i < 4; i++) if (moveTarget(g, g.turn, i, g.dice) !== null) out.push(i);
  return out;
}
function nextTurn(g, now) { g.turn = 1 - g.turn; g.phase = 'roll'; g.dice = null; g.sixes = 0; g.turnAt = now; }

function roll(g, now, rng) {
  if (g.status !== 'playing' || g.phase !== 'roll') throw new Error('not time to roll');
  const d = (rng || rngDefault)();
  g.rev++; g.turnAt = now;
  addLog(g, nameOf(g, g.turn) + ' rolled ' + d);
  if (d === 6 && g.sixes === 2) { addLog(g, 'Three sixes in a row: turn lost'); nextTurn(g, now); return d; }
  g.sixes = d === 6 ? g.sixes + 1 : 0;
  g.dice = d; g.phase = 'move';
  if (legalMoves(g).length === 0) {
    addLog(g, 'No move possible');
    nextTurn(g, now);
  }
  return d;
}

function move(g, idx, now) {
  const legal = legalMoves(g);
  if (!legal.includes(idx)) throw new Error('illegal move');
  const pl = g.turn, d = g.dice, q = moveTarget(g, pl, idx, d);
  g.pieces[pl][idx] = q; g.rev++; g.turnAt = now;
  let captured = false;
  if (q >= 0 && q <= 50 && !SAFE.has(abs(pl, q))) {
    const a = abs(pl, q), o = 1 - pl;
    for (let i = 0; i < 4; i++) {
      const op = g.pieces[o][i];
      if (op >= 0 && op <= 50 && abs(o, op) === a) { g.pieces[o][i] = -1; captured = true; }
    }
  }
  addLog(g, nameOf(g, pl) + ' moved a piece' + (q === FINISH ? ' home' : '') + (captured ? ' and captured' : ''));
  if (g.pieces[pl].every(p => p === FINISH)) {
    g.status = 'finished'; g.winner = pl; g.phase = 'done'; g.dice = null;
    addLog(g, nameOf(g, pl) + ' wins');
    return { captured, won: true };
  }
  if (d === 6 || captured || q === FINISH) { g.phase = 'roll'; g.dice = null; g.turnAt = now; addLog(g, nameOf(g, pl) + ' rolls again'); }
  else nextTurn(g, now);
  return { captured, won: false };
}

/* simple bot strategy: finish > capture > leave base > furthest piece */
function chooseMove(g) {
  const legal = legalMoves(g), pl = g.turn, d = g.dice;
  let best = legal[0], bestScore = -1;
  for (const i of legal) {
    const q = moveTarget(g, pl, i, d); let s = g.pieces[pl][i] + d;
    if (q === FINISH) s += 1000;
    else if (q <= 50 && !SAFE.has(abs(pl, q)) && g.pieces[1 - pl].some(op => op >= 0 && op <= 50 && abs(1 - pl, op) === abs(pl, q))) s += 500;
    else if (g.pieces[pl][i] === -1) s += 300;
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return best;
}

/* lazily advance: computer turns and idle humans. Call before reading state. */
function advance(g, now, rng) {
  let guard = 0;
  while (g.status === 'playing' && guard++ < 20) {
    const cur = g.players[g.turn];
    const idle = now - g.turnAt > IDLE_MS;
    if (cur.bot) {
      if (!g.botAt) g.botAt = g.turnAt + BOT_DELAY;
      if (now < g.botAt) break;
    } else if (!idle) break;
    const stamp = cur.bot ? g.botAt : now;
    if (g.phase === 'roll') roll(g, stamp, rng);
    else move(g, chooseMove(g), stamp);
    if (!cur.bot) addLog(g, nameOf(g, g.turn === undefined ? 0 : (1 - g.turn)) + ' was away: played automatically');
    g.botAt = 0;
    if (g.status === 'playing' && g.players[g.turn].bot) g.botAt = stamp + BOT_DELAY;
    if (!cur.bot) break;
  }
  return g;
}

function view(g, pid) {
  const you = g.players.findIndex(p => p && p.pid === pid);
  return {
    id: g.id, status: g.status, rev: g.rev, you,
    players: g.players.map((p, i) => p ? { name: p.name, bot: !!p.bot, color: COLORS[i] } : null),
    pieces: g.pieces, turn: g.turn, phase: g.phase, dice: g.dice,
    legal: you === g.turn ? legalMoves(g) : [], winner: g.winner, log: g.log, reward: g.reward || null, forfeit: !!g.forfeit,
    idleSeconds: Math.max(0, Math.round((IDLE_MS - (Date.now() - g.turnAt)) / 1000)),
  };
}

module.exports = { newGame, roll, move, legalMoves, advance, view, chooseMove, moveTarget, abs, SAFE, FINISH, RING, STARTS, IDLE_MS, WAIT_MS, BOT_DELAY, COLORS };
