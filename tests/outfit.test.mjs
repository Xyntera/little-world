const B = 'http://localhost:8951'; let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const H = { 'content-type': 'application/json' };
const j = async (p, o) => { const r = await fetch(B + p, o); return { s: r.status, b: await r.json().catch(() => ({})) }; };
const join = look => j('/api/join', { method: 'POST', headers: H, body: JSON.stringify({ name: 'T', district: 'kozhikode', adult: true, look }) });
let L2; let r = await join({ preset: 5, skin: 6, hair: 7, hairColor: 3 });
const id = r.b.player.id, tok = r.b.token;
ok(JSON.stringify(r.b.player.look) === JSON.stringify({ preset: 5, skin: 6, hair: 7, hairColor: 3 }), 'legacy 4-field look stored exactly: ' + JSON.stringify(r.b.player.look));
const patch = body => j('/api/players/' + id + '/look', { method: 'PATCH', headers: Object.assign({ authorization: 'Bearer ' + tok }, H), body: typeof body === 'string' ? body : JSON.stringify(body) });
const look = async () => (await patch({})).b.player.look;
r = await patch({ outfit: 7, outfitVar: 2 }); ok(r.b.player.look.outfit === 7 && r.b.player.look.outfitVar === 2 && r.b.player.look.preset === 5 && r.b.player.look.skin === 6, 'partial patch keeps hair/skin/preset');
for (const [name, bad] of [['negative', -1], ['too big', 99], ['NaN-string', 'abc'], ['float', 2.5], ['object', { a: 1 }], ['array', [1]], ['null', null], ['bool', true], ['huge str', '9'.repeat(4000)], ['3-digit', '100'], ['Infinity', 1e999]]) {
  const before = JSON.stringify(await look()); r = await patch({ outfit: bad, hair: bad, skin: bad });
  ok(r.s === 200 && JSON.stringify(r.b.player.look) === before, 'invalid ' + name + ' ignored, current choice kept (got ' + JSON.stringify(r.b.player.look) + ')');
}
r = await patch({ outfit: '9', hair: '0' }); ok(r.b.player.look.outfit === 9 && r.b.player.look.hair === 0, 'digit strings accepted (old clients used numbers; strings tolerated)');
r = await patch({ outfit: 14, outfitVar: 2, hairColor: 0, preset: 7, skin: 0, hair: 7 }); const L = r.b.player.look; ok(L.outfit === 14 && L.outfitVar === 2 && L.preset === 7 && L.skin === 0 && L.hairColor === 0, 'upper and lower boundaries accepted');
r = await patch({ outfit: 15 }); ok(r.b.player.look.outfit === 14, '15 rejected not clamped to 14');
r = await patch({ evil: 'x'.repeat(5000), junk: { a: 1 } }); ok(!('evil' in r.b.player.look) && !('junk' in r.b.player.look), 'unknown keys dropped');
r = await patch('{not json'); ok(r.s >= 400 && r.s < 500, 'malformed JSON 4xx got ' + r.s);
r = await j('/api/players/' + id + '/look', { method: 'PATCH', headers: H, body: '{"outfit":3}' }); ok(r.s === 401, 'no token 401');
r = await join(); ok(JSON.stringify(r.b.player.look) === JSON.stringify({ preset: 0, skin: 3, hair: 0, hairColor: 0 }), 'join without look = old default');
r = await join({ preset: 99, skin: -5, junk: 'x'.repeat(5000) }); ok(JSON.stringify(r.b.player.look) === JSON.stringify({ preset: 0, skin: 3, hair: 0, hairColor: 0 }), 'join with invalid look falls back to defaults: ' + JSON.stringify(r.b.player.look));
r = await j('/api/world?city=kerala'); ok(r.s === 200, 'world ok');
// mixed old/new clients: an old client PATCHes only its 4 fields; it must not erase the new outfit
await patch({ outfit: 6, outfitVar: 1 });
r = await patch({ preset: 2, skin: 1, hair: 4, hairColor: 2 }); L2 = r.b.player.look;
ok(L2.outfit === 6 && L2.outfitVar === 1 && L2.preset === 2 && L2.skin === 1 && L2.hair === 4 && L2.hairColor === 2, 'old 4-field PATCH after new outfit keeps outfit: ' + JSON.stringify(L2));
r = await patch({ outfit: 0, outfitVar: 0 }); ok(r.b.player.look.outfit === 0 && r.b.player.look.hair === 4, 'new client can set Everyday (outfit 0) again');
r = await j('/api/players/' + id + '/look', { method: 'PATCH', headers: Object.assign({ authorization: 'Bearer ' + tok }, H), body: JSON.stringify({ preset: 1 }) }); ok(r.b.player.look.preset === 1, 'single-field patch ok');
await j('/api/players/' + id + '/ping', { method: 'POST', headers: Object.assign({ authorization: 'Bearer ' + tok }, H), body: JSON.stringify({ x: 1, z: 1, dir: 0, city: 'kerala' }) });
const w2 = await j('/api/world?city=kerala'); const me = w2.b.players.find(p => p.id === id); ok(me && me.look.preset === 1 && me.look.outfit === 0, 'world view shows persisted look');
console.log('pass', pass, 'fail', fail); process.exit(fail ? 1 : 0);
