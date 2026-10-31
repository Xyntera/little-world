const B = 'http://localhost:8951'; let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const H = { 'content-type': 'application/json' };
const j = async (p, o) => { const r = await fetch(B + p, o); return { s: r.status, b: await r.json().catch(() => ({})) }; };
const join = n => j('/api/join', { method: 'POST', headers: H, body: JSON.stringify({ name: n, district: 'kozhikode', adult: true }) });
const A = (t, b) => ({ method: 'POST', headers: Object.assign({ authorization: 'Bearer ' + t }, H), body: JSON.stringify(b || {}) });
const host = (await join('TrvHost')).b, d = (await join('TrvDancer')).b;
const ping = (p, city) => j('/api/players/' + p.player.id + '/ping', A(p.token, { x: 0, z: 0, dir: 0, city }));
await ping(host, 'kerala'); await ping(d, 'kerala');
let r = await j('/api/players/' + host.player.id + '/events', A(host.token, { kind: 'open-stage', startsAt: 'now' })); ok(r.s === 200 || r.s === 201, 'host show created ' + r.s);
const eid = (r.b.event || {}).id; r = await j('/api/players/' + d.player.id + '/events/' + eid + '/join', A(d.token, { role: 'dancer' })); ok(r.s === 200, 'dancer join ' + r.s);
let l = (await j('/api/events?city=kerala')).b.events[0]; ok(l.signedUpDancers === 2, 'both signed up while in Kerala: ' + l.signedUpDancers);
await ping(d, 'tokyo'); l = (await j('/api/events?city=kerala')).b.events[0]; ok(l.signedUpDancers === 1, 'dancer who traveled to Tokyo is not counted as present: ' + l.signedUpDancers);
await ping(d, 'kerala'); l = (await j('/api/events?city=kerala')).b.events[0]; ok(l.signedUpDancers === 2, 'counted again after coming back: ' + l.signedUpDancers);
console.log('pass', pass, 'fail', fail);

process.exitCode = fail ? 1 : 0;
