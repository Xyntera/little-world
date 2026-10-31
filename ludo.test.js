const assert = require('assert');
const L = require('./ludo.js');
const mk = () => L.newGame('g', { pid: 'a', name: 'A' }, { pid: 'b', name: 'B' }, 0);
let g = mk(); const seq = a => { let i = 0; return () => a[i++]; };
// cannot leave base without 6
L.roll(g, 1, seq([3])); assert.equal(g.turn, 1, 'no move -> passes'); 
// 6 leaves base, gives extra turn
g = mk(); L.roll(g, 1, seq([6])); assert.deepEqual(L.legalMoves(g), [0, 1, 2, 3]); L.move(g, 0, 2); assert.equal(g.pieces[0][0], 0); assert.equal(g.phase, 'roll'); assert.equal(g.turn, 0);
// normal move passes turn
L.roll(g, 3, seq([4])); L.move(g, 0, 4); assert.equal(g.pieces[0][0], 4); assert.equal(g.turn, 1);
// capture on non-safe: p0 at ring 4 (abs 4). p1 piece at progress q with abs=(26+q)%52=? want abs 5: q=31.
g = mk(); g.pieces[0][0] = 4; g.pieces[1][0] = 31; g.turn = 0; L.roll(g, 1, seq([1])); L.move(g, 0, 2); assert.equal(g.pieces[1][0], -1, 'captured'); assert.equal(g.turn, 0, 'extra turn on capture');
// no capture on safe square (abs 8): p0 progress 8 safe
g = mk(); g.pieces[0][0] = 5; g.pieces[1][0] = (8 - 26 + 52) % 52; g.turn = 0; L.roll(g, 1, seq([3])); L.move(g, 0, 2); assert.equal(g.pieces[1][0], (8 - 26 + 52) % 52, 'safe: not captured');
// exact finish
g = mk(); g.pieces[0] = [54, 56, 56, 56]; g.turn = 0; L.roll(g, 1, seq([3])); assert.equal(g.turn, 1, 'overshoot: no legal move');
g = mk(); g.pieces[0] = [54, 56, 56, 56]; g.turn = 0; L.roll(g, 1, seq([2])); const r = L.move(g, 0, 2); assert.ok(r.won); assert.equal(g.status, 'finished'); assert.equal(g.winner, 0);
// three sixes forfeit
g = mk(); g.pieces[0][0] = 10; g.sixes = 2; L.roll(g, 1, seq([6])); assert.equal(g.turn, 1); 
// illegal move rejected
g = mk(); L.roll(g, 1, seq([6])); assert.throws(() => L.move(g, 9, 2)); 
// roll twice not allowed
g = mk(); L.roll(g, 1, seq([6])); assert.throws(() => L.roll(g, 2, seq([1])));
// bot plays after delay only
g = L.newGame('g', { pid: 'a', name: 'A' }, { pid: 'bot', name: 'Computer', bot: true }, 0); g.turn = 1; g.turnAt = 0;
L.advance(g, 100, seq([6])); assert.equal(g.turn, 1, 'bot waits'); assert.equal(g.pieces[1][0], -1);
L.advance(g, 5000, seq([6, 2, 5, 5, 5, 5, 5, 5])); assert.ok(g.turn === 0 || g.phase === 'roll');
// idle human gets auto-played
g = mk(); g.turnAt = 0; L.advance(g, L.IDLE_MS + 5, seq([2])); assert.equal(g.turn, 1, 'idle human: auto roll with no move passes');
// full random bot-vs-bot game terminates with a winner
g = L.newGame('g', { pid: 'x', name: 'X', bot: true }, { pid: 'y', name: 'Y', bot: true }, 0); let t = 0, n = 0;
while (g.status === 'playing' && n++ < 20000) { t += 2000; g.botAt = 0; L.advance(g, t); }
assert.equal(g.status, 'finished'); assert.ok(g.winner === 0 || g.winner === 1);
console.log('ludo rules ok; random bot game finished in', n, 'steps');
