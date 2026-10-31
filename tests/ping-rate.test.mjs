import { spawn } from 'child_process';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const T = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' | ' + extra : '')); };
import path from 'path'; import { fileURLToPath } from 'url'; const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function boot(port, env, tag) {
  const s = spawn('node', ['server.js'], { cwd: REPO, env: { ...process.env, PORT: String(port), DATA_FILE: `/tmp/lk-${tag}.json`, VOICE_ENABLED: '0', ...env }, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://localhost:${port}/api/health`); if (r.ok) return s; } catch {} await sleep(300); }
  throw new Error('boot fail ' + tag);
}
const join = async port => { const r = await fetch(`http://localhost:${port}/api/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'T' + Math.random().toString(36).slice(2, 6), district: 'none', adult: true }) }); const j = await r.json(); return { id: j.player.id, token: j.token }; };
const ping = (port, id, token, body) => fetch(`http://localhost:${port}/api/players/${id}/ping`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body || { x: 1, z: 2, city: 'kerala' }) }).then(r => r.status);

// ---- boot1: small player bucket (8/3s), huge IP bucket ----
let s1 = await boot(8961, { PING_RL_PLAYER: '8', PING_RL_WIN: '3000', PING_RL_IP: '1000' }, 'rl1');
const A = await join(8961), B = await join(8961);

// 1. valid-token spam: first 8 pass, then 429
let codes = []; for (let i = 0; i < 16; i++) codes.push(await ping(8961, A.id, A.token));
T('player bucket: 8 pass then 429', codes.slice(0, 8).every(c => c === 200) && codes.slice(8).every(c => c === 429), codes.join(','));

// 2. other player unaffected
T('other player unaffected', (await ping(8961, B.id, B.token)) === 200);

// 3. invalid token cannot touch A's bucket: spam bad tokens, then window reset, A gets full 8 again
let bad = []; for (let i = 0; i < 12; i++) bad.push(await ping(8961, A.id, 'deadbeef'.repeat(6)));
T('bad token all 401', bad.every(c => c === 401), bad.join(','));
await sleep(3200);
let again = []; for (let i = 0; i < 9; i++) again.push(await ping(8961, A.id, A.token));
T('quota intact after bad-token spam (8 ok, 9th 429)', again.slice(0, 8).every(c => c === 200) && again[8] === 429, again.join(','));

// 4. unknown id spam: 404s, no effect on A
let unk = []; for (let i = 0; i < 6; i++) unk.push(await ping(8961, 'p_nonexistent', 'deadbeef'.repeat(6)));
T('unknown id 404', unk.every(c => c === 404), unk.join(','));

// 5. window actually resets (already shown in 3) + normal cadence passes
await sleep(3200);
let cad = []; for (let i = 0; i < 5; i++) { cad.push(await ping(8961, A.id, A.token)); await sleep(400); }
T('normal cadence 5x400ms all 200', cad.every(c => c === 200), cad.join(','));

// 6. ping still persists pos/city (regression on actual behavior)
await sleep(3200);
await ping(8961, A.id, A.token, { x: 12.5, z: -7.5, dir: 1, moving: true, city: 'mumbai', veh: 'bicycle' });
const me = await (await fetch(`http://localhost:8961/api/players/${A.id}`, { headers: { authorization: 'Bearer ' + A.token } })).json();
// 7. presence path intact: world shows the player with persisted pos/veh
const w = await (await fetch(`http://localhost:8961/api/world?city=mumbai`)).json();
const wrow = (w.players || []).find(p => p.id === A.id);
T('city persisted after limiter', me.player.city === 'mumbai', me.player.city);
T('world lists pinged player with pos/veh', !!wrow && Math.abs((wrow.pos && wrow.pos.x) - 12.5) < 0.01 && wrow.pos.veh === 'bicycle', JSON.stringify(wrow || null));
s1.kill();

// ---- boot2: small IP bucket (15/3s), huge player bucket ----
let s2 = await boot(8962, { PING_RL_PLAYER: '1000', PING_RL_WIN: '3000', PING_RL_IP: '20' }, 'rl2');
const C = await join(8962), D = await join(8962);
let mix = [];
for (let i = 0; i < 12; i++) mix.push(await ping(8962, C.id, C.token));
for (let i = 0; i < 13; i++) mix.push(await ping(8962, D.id, 'badtoken'.repeat(5)));
T('IP bucket: mixed valid+invalid capped at 20/3s (env floor), rest 429', mix.slice(0, 20).filter(c => c === 429).length === 0 && mix.slice(20).every(c => c === 429), mix.join(','));
// IP 429 says nothing about id validity: response identical shape for valid C vs unknown id once limited
const r1 = await ping(8962, C.id, C.token), r2 = await ping(8962, 'p_unknown', 'x'.repeat(48));
T('post-limit responses identical (no auth oracle)', r1 === 429 && r2 === 429, r1 + '/' + r2);
s2.kill();
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
