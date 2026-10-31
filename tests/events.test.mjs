import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const E = require('../events.js'); let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const T = Date.UTC(2026, 9, 24, 12, 0, 0), M = 60000, db = new Map();
const P = n => ({ id: 'p_' + n, name: n });
ok(E.list(db, T, 'kerala').length === 0, 'no invented events: empty list when nobody hosts');
let r = E.create(db, T, P('asha'), { kind: 'open-stage' }); ok(r.event && E.status(r.event, T) === 'live', 'host now -> live');
ok(r.event.endsAt - r.event.startsAt === 30 * M, '30 minute show');
ok(E.create(db, T, P('ben'), { kind: 'dance-night' }).code === 409, 'overlap with live show rejected');
ok(E.create(db, T, P('ben'), { kind: 'dance-night', startsAt: new Date(T + 31 * M).toISOString() }).event, 'back-to-back after end ok');
ok(E.create(db, T, P('ben'), { kind: 'nope' }).code === 400, 'unknown kind');
{ const par = E.create(db, T, P('ben'), { kind: 'open-stage', city: 'paris' }); ok(par.event && par.event.city === 'paris', 'paris has a stage: hosting works there'); }
ok(E.create(db, T, P('ben'), { kind: 'open-stage', city: 'atlantis' }).code === 400, 'unknown city rejected');
for (const bad of ['tomorrow', '2026-10-25', 12345, '2026-10-25T10:00:00', {}]) ok(E.create(db, T, P('cy'), { kind: 'open-stage', startsAt: bad }).code === 400, 'bad startsAt ' + JSON.stringify(bad));
ok(E.create(db, T, P('cy'), { kind: 'open-stage', startsAt: new Date(T - 5 * 60 * M).toISOString() }).code === 400, 'past');
ok(E.create(db, T, P('cy'), { kind: 'open-stage', startsAt: new Date(T + 49 * 60 * M).toISOString() }).code === 400, 'too far ahead');
// zone-correct: an offset-bearing time is the same instant as the UTC one (no offset table)
const z = E.create(db, T, P('cy'), { kind: 'folk-show', startsAt: '2026-10-25T19:00:00+05:30' }); ok(z.event && new Date(z.event.startsAt).toISOString() === '2026-10-25T13:30:00.000Z', 'IST offset -> 13:30Z');
const dst = E.create(new Map(), Date.UTC(2026, 2, 28, 12), P('x'), { kind: 'open-stage', startsAt: '2026-03-29T03:00:00+01:00' }); ok(dst.event && new Date(dst.event.startsAt).toISOString() === '2026-03-29T02:00:00.000Z', 'London 29 Mar 2026 03:00 +01:00 (just after the spring-forward) = 02:00Z');
const d2 = E.create(new Map(), Date.UTC(2026, 9, 24, 12), P('x'), { kind: 'open-stage', startsAt: '2026-10-25T01:30:00-04:00' }); ok(d2.event && new Date(d2.event.startsAt).toISOString() === '2026-10-25T05:30:00.000Z', 'New York 25 Oct 01:30 EDT = 05:30Z');
// host limit
ok(E.create(db, T, P('asha'), { kind: 'party-time', startsAt: new Date(T + 100 * M).toISOString() }).event, 'host second show ok');
ok(E.create(db, T, P('asha'), { kind: 'party-time', startsAt: new Date(T + 200 * M).toISOString() }).code === 409, 'third show for same host rejected');
// participation
const live = r.event.id;
ok(E.join(db, T, P('ben'), live, 'dancer').event.dancers.size === 2, 'dancer joins');
for (const n of ['d1', 'd2', 'd3', 'd4']) E.join(db, T, P(n), live, 'dancer');
ok(E.join(db, T, P('late'), live, 'dancer').code === 409, 'dancer slots cap 6');
ok(E.join(db, T, P('late'), live, 'audience').event.audience.size === 1, 'overflow joins as audience');
ok(E.join(db, T, P('late'), live, 'cheer').code === 400, 'bad role');
ok(E.join(db, T, P('asha'), live, 'audience').code === 409, 'host cannot go audience');
E.join(db, T, P('ben'), live, 'audience'); const v = E.view(db.get(live), T, 'p_ben'); ok(v.you === 'audience' && v.dancers.length === 5, 'switch dancer -> audience frees slot');
ok(E.leave(db, T, P('ben'), live).event && E.view(db.get(live), T, 'p_ben').you === null, 'leave');
ok(E.leave(db, T, P('asha'), live).code === 409, 'host cannot leave');
ok(E.cancel(db, T, P('ben'), live).code === 403, 'non-host cannot cancel');
ok(E.join(db, T, P('q'), 'ev_nope', 'audience').code === 404, 'unknown show 404');
ok(!JSON.stringify(E.view(db.get(live), T)).includes('p_'), 'view leaks no player ids');
// lifecycle over time
ok(E.status(db.get(live), T + 29 * M) === 'live' && E.status(db.get(live), T + 30 * M) === 'ended', 'ends at 30 min');
ok(E.join(db, T + 31 * M, P('q'), live, 'audience').code === 409, 'cannot join ended show');
ok(!E.list(db, T + 31 * M, 'kerala').some(e => e.id === live), 'ended not listed');
E.sweep(db, T + 45 * M); ok(!db.has(live), 'ended shows are purged');
const c = E.create(new Map(), T, P('h'), { kind: 'open-stage', startsAt: new Date(T + 10 * M).toISOString() }); const cdb = new Map([[c.event.id, c.event]]);
ok(E.cancel(cdb, T, P('h'), c.event.id).event.cancelled && E.list(cdb, T, 'kerala').length === 0, 'host cancels, delisted');
// presence: stale host, active filtering, physical vs signed-up
{
  const d = new Map(), host = P('h1'); const e = E.create(d, T, host, { kind: 'open-stage' }).event;
  const pres = (grace, active, onStage) => ({ inGrace: id => grace.includes(id), isActive: id => active.includes(id), isOnStage: id => onStage.includes(id) });
  E.join(d, T, P('a'), e.id, 'dancer'); E.join(d, T, P('b'), e.id, 'dancer'); E.join(d, T, P('c'), e.id, 'audience'); E.join(d, T, P('w'), e.id, 'audience');
  let l = E.list(d, T + M, 'kerala', null, pres(['p_h1', 'p_a', 'p_b', 'p_c'], ['p_h1', 'p_a', 'p_c'], ['p_a']))[0];
  ok(l.signedUpDancers === 2 && l.dancers.includes('a') && !l.dancers.includes('b'), 'signed-up dancers drop out when they stop pinging, host stays');
  ok(l.audienceCount === 1, 'audience counts only players still in the game, got ' + l.audienceCount);
  ok(l.onStageNow === 1, 'physical presence counted separately: ' + l.onStageNow);
  ok(!JSON.stringify(l).includes('p_'), 'no ids in presence view');
  l = E.list(d, T + 2 * M, 'kerala', null, pres([], [], []))[0]; ok(l && l.status === 'live', 'host grace: not cancelled before 3 minutes');
  ok(E.list(d, T + 4 * M, 'kerala', null, pres(['p_a'], ['p_a'], []))[0] === undefined, 'live show cancelled when host gone > 3 minutes');
  ok(d.get(e.id).cancelReason === 'host left', 'cancel reason kept');
  const d3 = new Map(); const up = E.create(d3, T, host, { kind: 'open-stage', startsAt: new Date(T + 60 * M).toISOString() }).event;
  ok(E.list(d3, T + 10 * M, 'kerala', null, pres([], [], [])).length === 1, 'upcoming show survives an offline host until its start');
  ok(E.join(d, T + 5 * M, P('z'), e.id, 'audience').code === 409, 'cannot join a cancelled show');
}
const B = process.env.BASE; if (B) {
  const H = { 'content-type': 'application/json' };
  const j = async (p, o) => { const r = await fetch(B + p, o); return { s: r.status, b: await r.json().catch(() => ({})) }; };
  const mk = async n => { const r = await j('/api/join', { method: 'POST', headers: H, body: JSON.stringify({ name: n, district: 'kozhikode', adult: true }) }); return { id: r.b.player.id, h: Object.assign({ authorization: 'Bearer ' + r.b.token }, H) }; };
  const a = await mk('EvA'), b = await mk('EvB');
  ok((await j('/api/events')).b.events.length === 0, 'api empty at start');
  ok((await j('/api/events?city=zzz')).s === 400, 'api unknown city 400');
  ok((await j('/api/players/' + a.id + '/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"kind":"open-stage"}' })).s === 401, 'no token 401');
  let x = await j('/api/players/' + a.id + '/events', { method: 'POST', headers: a.h, body: '{"kind":"dance-night"}' }); ok(x.s === 200 && x.b.event.status === 'live' && x.b.event.you === 'host', 'api host now');
  const eid = x.b.event.id;
  x = await j('/api/players/' + b.id + '/events/' + eid + '/join', { method: 'POST', headers: b.h, body: '{"role":"dancer"}' }); ok(x.s === 200 && x.b.event.dancers.length === 2 && x.b.event.you === 'dancer', 'api join dancer');
  x = await j('/api/players/' + b.id + '/events', { headers: b.h }); ok(x.s === 200 && x.b.events[0].you === 'dancer', 'api authed list shows my role');
  ok((await j('/api/players/' + b.id + '/events')).s === 401, 'authed list needs token');
  x = await j('/api/events'); ok(x.b.events.length === 1 && x.b.events[0].host.name === 'EvA' && !JSON.stringify(x.b).includes(a.id), 'api list public, no ids');
  x = await j('/api/players/' + b.id + '/events/' + eid + '/cancel', { method: 'POST', headers: b.h, body: '{}' }); ok(x.s === 403, 'api non-host cancel 403');
  x = await j('/api/players/' + a.id + '/events/' + eid + '/cancel', { method: 'POST', headers: a.h, body: '{}' }); ok(x.s === 200, 'api host cancel');
  ok((await j('/api/events')).b.events.length === 0, 'api empty after cancel');
  { const tk = await j('/api/players/' + a.id + '/events', { method: 'POST', headers: a.h, body: '{"kind":"music-hour","city":"tokyo"}' }); ok(tk.s === 200 && tk.b.event.city === 'tokyo', 'api host in tokyo: ' + tk.s);
    let tl = await j('/api/events?city=tokyo'); ok(tl.s === 200 && tl.b.stage === true && tl.b.events.length === 1, 'api tokyo list: stage true, one show');
    const am = await j('/api/players/' + a.id + '/events?city=kerala', { headers: a.h }); ok(am.s === 200 && (am.b.mine || []).some(e => e.city === 'tokyo'), 'authed list: mine includes shows in other cities');
    ok((await j('/api/players/' + a.id + '/events/' + tk.b.event.id + '/cancel', { method: 'POST', headers: a.h, body: '{}' })).s === 200, 'cancel tokyo show');
    ok((await j('/api/events?city=tokyo')).b.events.length === 0, 'tokyo empty after cancel'); }
  { const rs = await Promise.all(Array.from({ length: 5 }, (_, i) => mk('Cc' + i))); const lv = await j('/api/players/' + a.id + '/events', { method: 'POST', headers: a.h, body: '{"kind":"music-hour"}' }); const id2 = lv.b.event.id;
    const more = await Promise.all(Array.from({ length: 12 }, (_, i) => mk('Cd' + i))); const all = rs.concat(more);
    const res = await Promise.all(all.map(q => j('/api/players/' + q.id + '/events/' + id2 + '/join', { method: 'POST', headers: q.h, body: '{"role":"dancer"}' })));
    ok(res.filter(r => r.s === 200).length === 5 && res.filter(r => r.s === 409).length === 12, 'concurrent dancer joins: exactly 5 fit beside host (got ' + res.filter(r => r.s === 200).length + ')');
    const lst = await j('/api/events'); ok(lst.b.events[0].signedUpDancers <= 6 && lst.b.durable === false, 'cap held, durable false reported');
    await j('/api/players/' + a.id + '/events/' + id2 + '/cancel', { method: 'POST', headers: a.h, body: '{}' });
    console.log('TESTIDS ' + all.map(q => q.id).join(' ')); }
  { const fut = await j('/api/players/' + a.id + '/events', { method: 'POST', headers: a.h, body: JSON.stringify({ kind: 'open-stage', startsAt: new Date(Date.now() - 3600000).toISOString() }) }); ok(fut.s === 400, 'client-supplied past time rejected (server clock rules)'); }
  x = await j('/api/players/' + a.id + '/events', { method: 'POST', headers: a.h, body: '{bad' }); ok(x.s === 400, 'malformed 400');
  console.log('TESTIDS ' + a.id + ' ' + b.id);
}
// host travel: controlled clock, no real waiting. Host leaves Kerala; show ends only after the 3 minute grace.
{
  const T0 = Date.UTC(2026, 9, 24, 12, 0, 0), TTL = 60000, d = new Map(), host = { id: 'h1', name: 'Hosty' }, seen = new Map();
  const r0 = E.create(d, T0, host, { kind: 'open-stage' }); ok(r0.event, 'host show created for travel test');
  const rows = (t, city, pos) => [{ id: 'h1', city, lastSeen: t, pos: pos || { x: E.STAGE.x, z: E.STAGE.z } }];
  seen.set('h1', { city: 'kerala', t: T0 + 4 * 60000 }); // host last pinged in Kerala at +4 min, then left
  let pr = E.buildPresence(rows(T0 + 5 * 60000, 'tokyo'), seen, T0 + 5 * 60000, TTL); E.sweep(d, T0 + 5 * 60000, pr);
  ok(!r0.event.cancelled, 'host away 1 minute: show still on');
  ok(!pr.isActive('h1', 'kerala') && !pr.isOnStage('h1', 'kerala'), 'host in Tokyo is not active or on stage in Kerala');
  ok(pr.isActive('h1', 'tokyo'), 'per-city presence: the same host IS active in Tokyo');
  pr = E.buildPresence(rows(T0 + 7 * 60000, 'tokyo'), seen, T0 + 7 * 60000 + 1, TTL); E.sweep(d, T0 + 7 * 60000 + 1, pr);
  ok(r0.event.cancelled && r0.event.cancelReason === 'host left', 'host away more than 3 minutes: show ended');
  // per-city: a Tokyo show is kept alive by Tokyo pings and the Tokyo rect, not Kerala ones
  const r2 = E.create(d, T0 + 8 * 60000, host, { kind: 'open-stage', city: 'tokyo' }); ok(r2.event && r2.event.city === 'tokyo', 'tokyo show created');
  seen.set('h1', { city: 'tokyo', t: T0 + 10 * 60000 });
  pr = E.buildPresence(rows(T0 + 12 * 60000, 'tokyo', { x: E.STAGES.tokyo.x, z: E.STAGES.tokyo.z }), seen, T0 + 12 * 60000, TTL); E.sweep(d, T0 + 12 * 60000, pr);
  ok(!r2.event.cancelled, 'tokyo show kept alive by tokyo pings');
  ok(pr.isOnStage('h1', 'tokyo') && !pr.isOnStage('h1', 'kerala'), 'onStage uses the tokyo rect');
  seen.set('h1', { city: 'kerala', t: T0 + 12 * 60000 }); // now the host pings from Kerala only
  pr = E.buildPresence(rows(T0 + 12 * 60000 + 1000, 'kerala'), seen, T0 + 12 * 60000 + 1000, TTL); E.sweep(d, T0 + 12 * 60000 + 1000, pr);
  ok(r2.event.cancelled && r2.event.cancelReason === 'host left', 'a kerala ping does not keep a tokyo show alive');
  seen.set('h1', { city: 'kerala', t: T0 + 41 * 60000 });
  const r1 = E.create(d, T0 + 40 * 60000, host, { kind: 'open-stage' });
  pr = E.buildPresence(rows(T0 + 44 * 60000, 'kerala'), seen, T0 + 44 * 60000, TTL); E.sweep(d, T0 + 44 * 60000, pr);
  ok(!r1.event.cancelled, 'host in Kerala keeps the show (grace measured from last ping in the show city)');
}

// --- restart persistence: boot grace, change sink, row round-trip ---
{
  const T0 = Date.UTC(2026, 9, 26, 12, 0, 0), M2 = 60000;
  const pres = (grace, active, onStage) => ({ inGrace: id => grace.includes(id), isActive: id => active.includes(id), isOnStage: id => onStage.includes(id) });
  // bootAt grace: a restored live show (started before boot) is not cancelled during the 3-minute reconnect window
  const d = new Map(), host = P('hosty');
  const e = E.create(d, T0, host, { kind: 'dance-night' }).event; // live from T0
  const boot = T0 + 10 * M2; // server restarts 10 minutes into the show
  let ch = E.sweep(d, boot + 2 * M2, pres([], [], []), boot);
  ok(!e.cancelled && ch.cancelled.length === 0, 'restart: show survives during the 3-minute host reconnect window');
  ch = E.sweep(d, boot + 4 * M2, pres([], [], []), boot);
  ok(e.cancelled && e.cancelReason === 'host left' && ch.cancelled[0] === e, 'restart: no host ping within 3 minutes of boot cancels the show');
  // host who pings after the restart keeps the show
  const d2 = new Map(); const e2 = E.create(d2, T0, host, { kind: 'dance-night' }).event;
  E.sweep(d2, boot + 4 * M2, pres(['p_hosty'], ['p_hosty'], []), boot);
  ok(!e2.cancelled, 'restart: host ping inside the window keeps the show');
  // without a bootAt the old rule applies (startsAt + grace)
  const d3 = new Map(); const e3 = E.create(d3, T0, host, { kind: 'dance-night' }).event;
  E.sweep(d3, T0 + 4 * M2, pres([], [], []), 0);
  ok(e3.cancelled, 'explicit bootAt 0: startsAt + grace governs');
  // change sink sees cancellations and deletions
  const seen = []; E.setChangeSink(c => seen.push(c));
  const d4 = new Map(); const e4 = E.create(d4, T0, host, { kind: 'dance-night' }).event;
  E.sweep(d4, T0 + 4 * M2, pres([], [], []), 0); // cancels
  E.sweep(d4, T0 + 15 * M2, pres([], [], []), 0); // deletes (>10 min after cancel)
  ok(seen.length === 2 && seen[0].cancelled[0] === e4 && seen[1].deleted[0] === e4.id, 'change sink reports cancelled then deleted');
  E.setChangeSink(null);
  // row round-trip preserves membership and lifecycle
  const d5 = new Map(); const e5 = E.create(d5, T0, host, { kind: 'folk-show' }).event;
  E.join(d5, T0, P('ada'), e5.id, 'dancer'); E.join(d5, T0, P('bob'), e5.id, 'audience');
  const row = E.showRow(e5), su = [{ player_id: 'p_ada', role: 'dancer', name: 'ada' }, { player_id: 'p_bob', role: 'audience', name: 'bob' }];
  const back = E.fromRow(row, su);
  ok(back.id === e5.id && back.startsAt === e5.startsAt && back.endsAt === e5.endsAt && back.city === e5.city && back.kind === e5.kind, 'row round-trip: identity and times');
  ok(back.dancers.get('p_ada') === 'ada' && back.audience.has('p_bob') && back.dancers.get(back.host.id) === 'hosty', 'row round-trip: dancers, audience, host');
  ok(E.status(back, T0) === 'live' && !back.cancelled, 'row round-trip: status survives');
  const c5 = E.cancel(d5, T0 + M2, host, e5.id).event;
  const backC = E.fromRow(E.showRow(c5), su);
  ok(backC.cancelled && backC.cancelledAt === c5.cancelledAt && E.status(backC, T0 + M2) === 'cancelled', 'row round-trip: cancelled state survives');
  // a restored cancelled show is purged after the same 10-minute keep window
  const d6 = new Map([[backC.id, backC]]);
  E.sweep(d6, T0 + 12 * M2, null, T0 + 11 * M2);
  ok(!d6.has(backC.id), 'restored cancelled show deleted 10 minutes after cancel');
}

// --- write ordering + upcoming-show grace across restart ---
{
  const T0 = Date.UTC(2026, 9, 26, 12, 0, 0), M2 = 60000;
  // restored UPCOMING show: grace measured from its start, not from boot
  const d = new Map(), host = P('up');
  const e = E.create(d, T0, host, { kind: 'party-time', startsAt: new Date(T0 + 60 * M2).toISOString() }).event;
  const boot = T0 + 30 * M2; // restart 30 min before the show starts
  const pres = (grace, active) => ({ inGrace: id => grace.includes(id), isActive: id => active.includes(id), isOnStage: () => false });
  E.sweep(d, boot + 10 * M2, pres([], []), boot);
  ok(!e.cancelled, 'restart: upcoming show untouched during boot window');
  E.sweep(d, T0 + 62 * M2, pres([], []), boot);
  ok(!e.cancelled, 'restart: upcoming show lives through its start + 2 minutes without the host');
  E.sweep(d, T0 + 64 * M2, pres([], []), boot);
  ok(e.cancelled && e.cancelReason === 'host left', 'restart: upcoming show cancelled 3 minutes after its start without the host');
  // serialWriter: strict order, slow writes first; failures isolate and are reported once
  const order = [], errs = [];
  const w = E.serialWriter(err => errs.push(err.message));
  const slow = new Promise(r => setTimeout(r, 30));
  const p1 = w(async () => { await slow; order.push('cancel-save'); });
  const p2 = w(async () => { order.push('delete'); });
  await Promise.all([p1, p2]);
  ok(order.join(',') === 'cancel-save,delete', 'serialWriter: a slow cancel save lands before a later delete (no resurrection), got ' + order.join(','));
  let threw = false;
  await w(async () => { throw new Error('pg down'); }).catch(() => { threw = true; });
  ok(threw && errs.length === 1 && errs[0] === 'pg down', 'serialWriter: caller sees the failure, onError fires once');
  await w(async () => { order.push('after-failure'); });
  ok(order[2] === 'after-failure', 'serialWriter: later writes still run after a failure');
}

// --- reconcile: failed write A + successful write B; truthful until fully synced ---
{
  const T0 = Date.UTC(2026, 9, 26, 12, 0, 0);
  const d = new Map(); const hA = P('hA'), hB = P('hB');
  const eA = E.create(d, T0, hA, { kind: 'open-stage' }).event;
  const eB = E.create(d, T0, hB, { kind: 'music-hour', city: 'paris' }).event;
  E.join(d, T0, P('da'), eA.id, 'dancer'); E.join(d, T0, P('aa'), eA.id, 'audience');
  const calls = [], ghosts = []; let failA = true;
  const fake = {
    async saveShow(e) { if (failA && e.id === eA.id) throw new Error('pg down'); calls.push(['show', e.id, e.cancelled]); },
    async saveSignup(sid, pid, role, name) { calls.push(['signup', sid, pid, role, name]); },
    async syncSignups(sid, memberIds) { ghosts.push([sid, memberIds.slice().sort()]); },
    async deleteShows(ids) { calls.push(['del', ids.slice()]); },
  };
  let threw = false; try { await E.reconcileShows(d, fake, []); } catch { threw = true; }
  ok(threw && !calls.some(c => c[0] === 'show' && c[1] === eB.id), 'reconcile: failure on show A stops the pass before B - no partial pass that could fake clean');
  failA = false; const dels = [['ev_gone1', 'ev_gone2']];
  await E.reconcileShows(d, fake, dels);
  ok(dels.length === 0 && calls.some(c => c[0] === 'del' && c[1].includes('ev_gone1')), 'reconcile: queued deletions retried first (before upserts, so nothing resurrects)');
  const delIdx = calls.findIndex(c => c[0] === 'del'), upIdx = calls.findIndex(c => c[0] === 'show');
  ok(delIdx > -1 && upIdx > delIdx, 'reconcile: deletes land before upserts');
  const suA = calls.filter(c => c[0] === 'signup' && c[1] === eA.id);
  ok(suA.some(c => c[2] === 'p_da' && c[3] === 'dancer' && c[4] === 'da'), 'reconcile: dancer names preserved');
  ok(suA.some(c => c[2] === 'p_aa' && c[3] === 'audience'), 'reconcile: audience membership re-upserted');
  ok(ghosts.some(g => g[0] === eA.id && g[1].join(',') === ['p_aa', 'p_da', 'p_hA'].sort().join(',')), 'reconcile: syncSignups gets exact live membership so ghost rows are removed');
  ok(calls.some(c => c[0] === 'show' && c[1] === eB.id), 'reconcile: show B written after A succeeds');
  // restart-equivalence: what the store recorded rebuilds the same in-memory show
  const suRows = suA.map(c => ({ player_id: c[2], role: c[3], name: c[4] }));
  const back = E.fromRow(E.showRow(eA), suRows);
  ok(back.dancers.get('p_da') === 'da' && back.audience.has('p_aa') && back.dancers.get(back.host.id) === 'hA' && back.startsAt === eA.startsAt, 'reconcile + restart rebuild: identical membership and lifecycle');
}

// --- reconcile reads CURRENT state; swept tombstones are never upserted again ---
{
  const T0 = Date.UTC(2026, 9, 26, 12, 0, 0), M2 = 60000;
  const d = new Map(), host = P('hx');
  const e = E.create(d, T0, host, { kind: 'open-stage' }).event;
  E.cancel(d, T0 + M2, host, e.id);
  const ch = E.sweep(d, T0 + 12 * M2, null, T0 + 11 * M2); // past the 10-min keep window: removed from memory
  ok(ch.deleted.includes(e.id) && !d.has(e.id), 'tombstone: swept show leaves memory when its deletion is queued');
  const calls = [];
  const fake = {
    async saveShow(ev) { calls.push(['show', ev.id]); },
    async saveSignup(sid, pid) { calls.push(['signup', sid, pid]); },
    async syncSignups() {}, async deleteShows(ids) { calls.push(['del', ids.slice()]); },
  };
  await E.reconcileShows(d, fake, [ch.deleted]); // the queued tombstone goes through reconcile
  ok(calls.some(c => c[0] === 'del' && c[1].includes(e.id)), 'tombstone: queued deletion is retried');
  ok(!calls.some(c => (c[0] === 'show' || c[0] === 'signup') && c[1] === e.id), 'tombstone: deleted show is never upserted again (reconcile iterates current memory only)');
  // a cancel that lands AFTER a reconcile is enqueued wins: reconcile reads live maps at execution
  const d2 = new Map(); const e2 = E.create(d2, T0, host, { kind: 'open-stage' }).event;
  E.cancel(d2, T0 + 2 * M2, host, e2.id); // cancelled before the (serialized) reconcile runs
  const seen = [];
  await E.reconcileShows(d2, { async saveShow(ev) { seen.push(ev.cancelled); }, async saveSignup() {}, async syncSignups() {}, async deleteShows() {} }, []);
  ok(seen[0] === true, 'reconcile persists the current cancelled state, not a stale pre-cancel snapshot');
}
console.log(`events: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
