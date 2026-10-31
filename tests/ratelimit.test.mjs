import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { hit, MAX_KEYS } = require('../ratelimit');
let pass = 0, fail = 0; const T = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' | ' + extra : '')); };
const now = 1_000_000;

// 1. parity within cap: allow max, deny max+1, window reset
{ const m = new Map(); let r = []; for (let i = 0; i < 5; i++) r.push(hit(m, 'a', now + i * 100, 1000, 3));
  T('allow 3, deny 4th/5th', r.join(',') === 'true,true,true,false,false', r.join(','));
  T('window reset', hit(m, 'a', now + 1200, 1000, 3) === true); }

// 2. expired keys evicted first past the cap
{ const m = new Map(); for (let i = 0; i < MAX_KEYS + 5; i++) m.set('old' + i, { t: now - 5000, n: 1 });
  hit(m, 'fresh', now, 1000, 3);
  T('expired evicted past cap', m.size <= MAX_KEYS + 1 && m.has('fresh'), 'size=' + m.size); }

// 3. fresh-key flood: hard bound holds
{ const m = new Map(); for (let i = 0; i < MAX_KEYS + 5000; i++) hit(m, 'f' + i, now, 60000, 3);
  T('hard bound under fresh flood', m.size <= MAX_KEYS, 'size=' + m.size); }

// 4. evicted key restarts its window (degrades fail-open per key, still bounded)
{ const m = new Map(); hit(m, 'victim', now, 60000, 3); hit(m, 'victim', now, 60000, 3);
  for (let i = 0; i < MAX_KEYS + 100; i++) hit(m, 'g' + i, now, 60000, 3);
  const survived = m.has('victim');
  if (!survived) { let seq = [10, 20, 30, 40].map(d => hit(m, 'victim', now + d, 60000, 3)); // restart: counts fresh from 1, capped at max again
    T('evicted key restarts, still capped', seq.join(',') === 'true,true,true,false', seq.join(',')); }
  else T('evicted key restarts, still capped', m.get('victim').n <= 3, 'survived with n=' + m.get('victim').n); }

// 5. bound never exceeds cap even mixing expired+fresh over repeated floods
{ const m = new Map(); let worst = 0;
  for (let round = 0; round < 5; round++) { for (let i = 0; i < MAX_KEYS + 2000; i++) hit(m, 'r' + round + '_' + i, now + round * 100, 60000, 3); worst = Math.max(worst, m.size); }
  T('repeated floods stay under cap', worst <= MAX_KEYS, 'worst=' + worst); }

// 6. map isolation: each protection family has its own Map - flooding one cannot evict another
{ const pingMap = new Map(), collectMap = new Map();
  hit(collectMap, 'victim:s', now, 60000, 3); hit(collectMap, 'victim:s', now, 60000, 3);
  for (let i = 0; i < MAX_KEYS + 500; i++) hit(pingMap, 'ip' + i, now, 60000, 3);
  T('flood on one map leaves another untouched', collectMap.has('victim:s') && collectMap.get('victim:s').n === 2, 'n=' + (collectMap.get('victim:s') || {}).n); }

console.log(`\nratelimit: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
