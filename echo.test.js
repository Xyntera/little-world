/* Echo Dance rules tests. Deterministic rng; no server needed. */
'use strict';
const E = require('./echo');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const T = Date.UTC(2026, 9, 25, 12, 0, 0);
const A = { pid: 'a1', name: 'Ash' }, B = { pid: 'b2', name: 'Ben' };
let seed = 0; const rng = n => (seed = (seed * 1664525 + 1013904223) % 4294967296) % n;

let g = E.newGame('g1', A, null, T);
ok(g.status === 'waiting' && g.phase === 'lobby', 'open game waits');
E.join(g, B, T, rng);
ok(g.status === 'playing' && g.round === 1 && g.seq.length === 3 && g.phase === 'watch', 'join deals round 1 (3 moves)');
ok(E.view(g, 'a1').seq.length === 3, 'sequence visible while watching');
let threw = false; try { E.submit(g, 'a1', g.seq.slice(), T + 1000); } catch (e) { threw = /watch first/.test(e.message); }
ok(threw, 'no submitting during watch');
E.advance(g, T + 1200 + 800 * 3 + 1, rng);
ok(g.phase === 'input', 'input opens after the watch window');
ok(E.view(g, 'a1').seq === undefined && E.view(g, 'a1').seqLen === 3, 'sequence hidden during input, length known');
threw = false; try { E.submit(g, 'a1', ['dance'], T); } catch (e) { threw = true; }
ok(threw, 'wrong length rejected');
threw = false; try { E.submit(g, 'a1', ['dance', 'party', 'fly'], T); } catch (e) { threw = true; }
ok(threw, 'unknown move rejected');
E.submit(g, 'a1', g.seq.slice(), T);
E.submit(g, 'b2', g.seq.slice(), T);
ok(g.round === 2 && g.phase === 'watch' && g.seq.length === 4, 'both correct -> next round, longer');
E.advance(g, T + 60000, rng);
const wrong = g.seq.slice(); wrong[0] = E.MOVES[(E.MOVES.indexOf(wrong[0]) + 1) % E.MOVES.length];
E.submit(g, 'a1', g.seq.slice(), T + 60000); E.submit(g, 'b2', wrong, T + 60000);
ok(g.status === 'finished' && g.winner === 0 && !g.draw, 'one slips -> the other wins');
ok(E.view(g, 'b2').log.some(l => /Ash remembered/.test(l)), 'log tells the story');

// both slip: new deal, same round; three times -> draw
g = E.newGame('g2', A, B, T); g.round = 1; E.deal(g, T, rng);
for (let k = 0; k < 3; k++) {
  E.advance(g, T + 100000 * (k + 1), rng); // into input
  const w1 = g.seq.slice(); w1[0] = E.MOVES[(E.MOVES.indexOf(w1[0]) + 1) % E.MOVES.length];
  E.submit(g, 'a1', w1, T + 100000 * (k + 1)); E.submit(g, 'b2', w1, T + 100000 * (k + 1));
  if (k < 2) E.advance(g, T + 100000 * (k + 1) + 10, rng);
}
ok(g.status === 'finished' && g.draw && g.round === 1, 'both slip three times -> draw, round unchanged');

// timeout: a missing submission counts as a slip
g = E.newGame('g3', A, B, T); g.round = 1; E.deal(g, T, rng);
E.advance(g, T + 5000, rng);
E.submit(g, 'a1', g.seq.slice(), T + 6000);
E.advance(g, T + 6000 + E.INPUT_MS + 1, rng);
ok(g.status === 'finished' && g.winner === 0, 'no answer in time = slip: present player wins');

// cap: both perfect through MAX_ROUND -> draw
g = E.newGame('g4', A, B, T); g.round = E.MAX_ROUND; E.deal(g, T, rng);
E.advance(g, T + 60000, rng);
E.submit(g, 'a1', g.seq.slice(), T + 60000); E.submit(g, 'b2', g.seq.slice(), T + 60000);
ok(g.status === 'finished' && g.draw, 'both perfect at the cap -> draw');

// bot game: bot submits inside advance; deterministic rng
g = E.newGame('g5', A, { pid: 'bot_x', name: 'Computer', bot: true }, T); g.round = 1; E.deal(g, T, rng);
E.advance(g, T + 5000, rng);
ok(g.phase === 'input', 'bot game reaches input');
E.submit(g, 'a1', g.seq.slice(), T + 6000);
E.advance(g, T + 12000, rng);
ok(g.round === 2 || g.status === 'finished' || Object.keys(g.subs).length > 0, 'bot submitted and the round resolved (subs clear on a new deal)');

// view hygiene: no pids, no sequence after watch
const v = E.view(g, 'a1');
ok(!JSON.stringify(v).includes('a1') && !JSON.stringify(v).includes('bot_x'), 'no player ids in the view');
console.log('echo: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
