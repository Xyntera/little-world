/* Freeze Beat rules engine (2 players). Pure functions, original code.
 * Musical statues for the stage: the beat plays, and the instant it stops
 * both players tap Freeze. Fastest reaction takes the round; tapping while
 * the music is still playing is a false start and loses the round.
 * First to 3 round wins takes the game. Just for fun: no points, no stakes.
 * Reactions are measured against the server's own stop timestamp; client
 * clocks are never trusted. In-memory only: a game lives minutes and is
 * gone on restart. Timing constants are env-overridable for tests. */
'use strict';
const crypto = require('crypto');

const num = (k, d) => { const v = Number(process.env[k]); return Number.isFinite(v) && v > 0 ? v : d; };
const CFG = {
  PLAY_MIN_MS: num('FREEZE_PLAY_MIN_MS', 3000), PLAY_SPAN_MS: num('FREEZE_PLAY_SPAN_MS', 4000),
  STOP_MS: num('FREEZE_STOP_MS', 6000),          // how long after the stop a tap still counts
  REACT_TIE_MS: num('FREEZE_TIE_MS', 120),        // reactions closer than this are a tied round: polling and network timing make finer distinctions meaningless
  WIN_TARGET: 3, MAX_ROUND: 8,                   // first to 3 wins; hard cap, then most wins / draw
  WAIT_MS: 5 * 60000, DONE_KEEP_MS: 10 * 60000,
  BOT_MIN_MS: num('FREEZE_BOT_MIN_MS', 260), BOT_SPAN_MS: num('FREEZE_BOT_SPAN_MS', 650),
  BOT_FOUL_P: Number(process.env.FREEZE_BOT_FOUL_P || 0.06),
};

const rngDefault = n => crypto.randomInt(n);

function newGame(id, a, b, now) {
  return {
    id, status: b ? 'playing' : 'waiting',
    players: [a, b || null].map(p => p && { pid: p.pid, name: p.name, bot: !!p.bot, wins: 0 }),
    round: 0, phase: b ? 'play' : 'lobby', phaseAt: now, playUntil: 0,
    taps: {}, fouls: {}, botActAt: null, botWillFoul: false,
    last: null,                       // { reactions: {pid: ms|null}, fouls: [pid], winner: 0|1|null }
    winner: null, forfeit: false, draw: false, log: [], created: now, rev: 1,
  };
}
function addLog(g, s) { g.log.push(s); if (g.log.length > 8) g.log.shift(); }
const nameOf = (g, i) => (g.players[i] && g.players[i].name) || 'Player';

function startRound(g, now, rng) {
  const r = rng || rngDefault;
  g.round++; g.phase = 'play'; g.phaseAt = now;
  g.playUntil = now + CFG.PLAY_MIN_MS + r(CFG.PLAY_SPAN_MS);
  g.taps = {}; g.fouls = {}; g.rev++;
  const bot = g.players.find(p => p && p.bot);
  g.botWillFoul = !!(bot && r(1000) / 1000 < CFG.BOT_FOUL_P);
  g.botActAt = bot && g.botWillFoul ? now + 400 + r(Math.max(1, CFG.PLAY_MIN_MS - 800)) : null;
  addLog(g, 'Round ' + g.round + ': dance!');
}

function start(g, now, rng) { startRound(g, now, rng); }

function join(g, me, now, rng) {
  if (g.status !== 'waiting') throw new Error('game already started');
  g.players[1] = { pid: me.pid, name: me.name, bot: !!me.bot, wins: 0 };
  g.status = 'playing';
  startRound(g, now, rng);
}

const acted = (g, p) => !p || g.taps[p.pid] !== undefined || g.fouls[p.pid];

/* reportedMs is the client's self-measured reaction from the moment it
 * rendered the stop cue to the tap; the server clamps it to what its own
 * clock allows (0 .. time since stop), so network and poll delay never
 * count against a player and nobody can claim faster than possible. */
function freeze(g, pid, now, reportedMs) {
  if (g.status !== 'playing') throw new Error('game not in progress');
  const i = g.players.findIndex(p => p && p.pid === pid);
  if (i < 0) throw new Error('not in this game');
  if (acted(g, g.players[i])) throw new Error('already played this round');
  if (g.phase === 'play') { g.fouls[pid] = true; g.rev++; addLog(g, nameOf(g, i) + ' froze too early!'); }
  else if (g.phase === 'stop') {
    const serverDelta = now - g.phaseAt;
    const rep = Number(reportedMs);
    g.taps[pid] = Number.isFinite(rep) && rep >= 0 ? Math.min(rep, serverDelta) : serverDelta;
    g.rev++;
  }
  else throw new Error('round is over');
  if (g.players.every(p => acted(g, p))) resolve(g, now, rngDefault);
}

/* round outcome: a clean tap always beats a foul or a miss; between clean
 * taps the lower reaction wins, but reactions within REACT_TIE_MS are a
 * tied round (replayed), because polling/network timing cannot honestly
 * rank human reactions finer than that. */
function resolve(g, now, rng) {
  const clean = p => !!(p && !g.fouls[p.pid] && g.taps[p.pid] !== undefined);
  const ca = clean(g.players[0]), cb = clean(g.players[1]);
  let rw = null;
  if (ca && cb) { const d = g.taps[g.players[0].pid] - g.taps[g.players[1].pid]; rw = Math.abs(d) <= CFG.REACT_TIE_MS ? null : (d < 0 ? 0 : 1); }
  else if (ca !== cb) rw = ca ? 0 : 1;
  g.last = {
    reactions: Object.fromEntries(g.players.filter(Boolean).map(p => [p.pid, g.taps[p.pid] !== undefined ? g.taps[p.pid] : null])),
    fouls: g.players.filter(p => p && g.fouls[p.pid]).map(p => p.pid),
    winner: rw,
  };
  g.rev++; g.phaseAt = now;
  if (rw === null) {
    if (g.round >= CFG.MAX_ROUND) { // cap applies to tied rounds too: finish by rounds taken
      g.status = 'finished'; g.phase = 'done';
      const wa2 = g.players[0].wins, wb2 = g.players[1].wins;
      if (wa2 === wb2) { g.draw = true; addLog(g, wa2 + '-' + wb2 + ' after ' + g.round + ' rounds - a draw'); }
      else { g.winner = wa2 > wb2 ? 0 : 1; addLog(g, nameOf(g, g.winner) + ' wins ' + Math.max(wa2, wb2) + '-' + Math.min(wa2, wb2)); }
      return;
    }
    addLog(g, ca && cb ? 'Too close to call - again!' : 'Nobody takes that one - again!'); startRound(g, now, rng); return;
  }
  g.last.winner = rw;
  g.players[g.last.winner].wins++;
  addLog(g, nameOf(g, g.last.winner) + ' takes round ' + g.round + (g.taps[g.players[g.last.winner].pid] !== undefined ? ' (' + g.taps[g.players[g.last.winner].pid] + 'ms)' : ''));
  const wa = g.players[0].wins, wb = g.players[1].wins;
  if (wa >= CFG.WIN_TARGET || wb >= CFG.WIN_TARGET) {
    g.status = 'finished'; g.phase = 'done'; g.winner = wa > wb ? 0 : 1;
    addLog(g, nameOf(g, g.winner) + ' wins ' + Math.max(wa, wb) + '-' + Math.min(wa, wb) + '!');
    return;
  }
  if (g.round >= CFG.MAX_ROUND) {
    g.status = 'finished'; g.phase = 'done';
    if (wa === wb) { g.draw = true; addLog(g, wa + '-' + wb + ' after ' + g.round + ' rounds - a draw'); }
    else { g.winner = wa > wb ? 0 : 1; addLog(g, nameOf(g, g.winner) + ' wins ' + Math.max(wa, wb) + '-' + Math.min(wa, wb)); }
    return;
  }
  startRound(g, now, rng);
}

/* lazily advance: stop the beat when the play window ends, let the bot act,
 * resolve on the stop timeout. Call before reading state. */
function advance(g, now, rng) {
  if (g.status !== 'playing') return g;
  const r = rng || rngDefault;
  const bot = g.players.find(p => p && p.bot);
  if (g.phase === 'play') {
    if (bot && g.botWillFoul && g.botActAt !== null && now >= g.botActAt && !acted(g, bot)) {
      g.fouls[bot.pid] = true; g.rev++; addLog(g, bot.name + ' froze too early!');
    }
    if (now >= g.playUntil) {
      // the beat truly stopped at playUntil, not at whatever request happens
      // to notice first - reactions and the stop window measure from there
      g.phase = 'stop'; g.phaseAt = g.playUntil; g.rev++;
      g.botActAt = bot && !g.fouls[bot.pid] ? g.playUntil + CFG.BOT_MIN_MS + r(CFG.BOT_SPAN_MS) : null;
      addLog(g, 'Beat stopped - FREEZE!');
    }
    return g;
  }
  if (g.phase === 'stop') {
    if (bot && g.botActAt !== null && now >= g.botActAt && !acted(g, bot)) { g.taps[bot.pid] = Math.max(0, g.botActAt - g.phaseAt); g.rev++; } // bot's scheduled reaction stands as its 'human' reaction, not poll timing
    if (g.players.every(p => acted(g, p))) { resolve(g, now, r); return g; }
    if (now >= g.phaseAt + CFG.STOP_MS) { resolve(g, now, r); return g; } // no tap counts as slowest
  }
  return g;
}

function view(g, pid) {
  const you = g.players.findIndex(p => p && p.pid === pid);
  return {
    id: g.id, status: g.status, rev: g.rev, you,
    players: g.players.map(p => p ? { name: p.name, bot: !!p.bot, wins: p.wins } : null),
    round: g.round, phase: g.phase, winTarget: CFG.WIN_TARGET,
    stopMs: g.phase === 'stop' ? Math.max(0, g.phaseAt + CFG.STOP_MS - Date.now()) : 0,
    // playUntil is deliberately not exposed: the surprise is the game
    tapped: g.players.map(p => !!(p && g.taps[p.pid] !== undefined)),
    fouled: g.players.map(p => !!(p && g.fouls[p.pid])),
    last: g.last, winner: g.winner, draw: g.draw, forfeit: g.forfeit, log: g.log,
  };
}

module.exports = { newGame, join, start, freeze, resolve, advance, view, CFG };
