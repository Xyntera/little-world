// Freeze Beat rules engine: deterministic unit coverage with injected rng + fake clock.
import F from '../freeze.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const rng = () => 0; // deterministic: min play window, bot never fouls (p-roll 0 < p only if p>0)
const A = { pid: 'a', name: 'A' }, B = { pid: 'b', name: 'B' };

// tap ordering: first honest tap wins when reactions differ beyond the tie band
let now = 100000;
let g = F.newGame('g', A, B, now); F.start(g, now, rng);
now = g.playUntil + 400; F.advance(g, now);
F.freeze(g, 'a', now, 120);
F.freeze(g, 'b', now + 50, 300);
ok(g.players[0].wins === 1 && g.round === 2, 'faster reaction takes the round');

// reported reactions are clamped to the server stop window
now = g.playUntil + 500; F.advance(g, now);
F.freeze(g, 'a', now, 99999);
ok(g.taps['a'] === 500, 'inflated report clamped to server delta');
F.freeze(g, 'b', now + 10, 10);
ok(g.last.reactions['b'] === 10, 'small honest report kept');

// false start loses to any clean tap; double foul replays
g = F.newGame('g2', A, B, now); F.start(g, now, rng);
F.freeze(g, 'a', now + 100, undefined); // during play: foul
now = g.playUntil + 200; F.advance(g, now);
F.freeze(g, 'b', now, 250);
ok(g.players[1].wins === 1, 'foul loses to clean tap');
g = F.newGame('g3', A, B, now); F.start(g, now, rng);
F.freeze(g, 'a', now + 100); F.freeze(g, 'b', now + 200);
ok(g.round === 2 && g.players[0].wins === 0 && g.players[1].wins === 0, 'double foul replays the round');

// tie band: reactions within REACT_TIE_MS replay, and the cap ends a tie-heavy game
g = F.newGame('g4', A, B, now); F.start(g, now, rng);
let guard = 0;
while (g.status === 'playing' && guard++ < 50) {
  now = g.playUntil + 100; F.advance(g, now);
  F.freeze(g, 'a', now, 200); F.freeze(g, 'b', now + 20, 250); // 50ms apart: always a tie
}
ok(g.status === 'finished' && g.draw === true && g.round === F.CFG.MAX_ROUND, 'all-tie game ends at the round cap as a draw: round ' + g.round);

// cap resolves by rounds taken when one side is ahead
g = F.newGame('g5', A, B, now); F.start(g, now, rng);
g.round = F.CFG.MAX_ROUND; g.players[0].wins = 2; g.players[1].wins = 1; // final round, A ahead
now = g.playUntil + 300; F.advance(g, now);
F.freeze(g, 'a', now, 200); F.freeze(g, 'b', now + 20, 230); // tie on the final round
ok(g.status === 'finished' && g.winner === 0, 'tie on the final round finishes by rounds taken');

// first to WIN_TARGET ends immediately
g = F.newGame('g6', A, B, now); F.start(g, now, rng);
g.players[0].wins = F.CFG.WIN_TARGET - 1;
now = g.playUntil + 300; F.advance(g, now);
F.freeze(g, 'a', now, 100); F.freeze(g, 'b', now + 30, 500);
ok(g.status === 'finished' && g.winner === 0 && g.players[0].wins === F.CFG.WIN_TARGET, 'reaching the win target ends the game');

// no-tap timeout counts as a miss, not a crash
g = F.newGame('g7', A, B, now); F.start(g, now, rng);
now = g.playUntil + 100; F.advance(g, now);
now += F.CFG.STOP_MS + 1000; F.advance(g, now);
ok(g.round === 2 && g.last.winner === null, 'double miss replays after the stop window');

// playUntil never leaks through the view
now = g.playUntil + 10; F.advance(g, now);
const v = F.view(g, 'a');
ok(!('playUntil' in v) && !('botActAt' in v) && !('botWillFoul' in v), 'stop timing internals not exposed');

console.log('freeze-rules: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
