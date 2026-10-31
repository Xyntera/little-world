// Fixed-window rate buckets with a HARD memory bound.
// hit(map, key, now, windowMs, max) -> true while key's count in the current window is <= max.
// Old behaviour only evicted expired keys past 5000 entries, so >5000 FRESH keys in one window
// grew the map without limit. Now: past MAX_KEYS, expired keys are evicted first; if the map is
// still over the cap, the oldest-window keys are batch-evicted down to MAX_KEYS - EVICT_BATCH so
// the sort is amortised (one per ~EVICT_BATCH floods, not per hit). Tradeoff under a flood of
// fresh keys: an evicted key's window restarts (it gets a fresh allowance), so protection
// degrades to per-key-bounded-with-restart rather than failing closed - memory and CPU stay
// hard-bounded either way.
const MAX_KEYS = 20000, EVICT_BATCH = 1000;
function hit(map, key, now, windowMs, max) {
  const r = map.get(key) || { t: now, n: 0 };
  if (now - r.t > windowMs) { r.t = now; r.n = 0; }
  r.n++; map.set(key, r);
  if (map.size > MAX_KEYS) {
    for (const [k, v] of map) if (now - v.t > windowMs) map.delete(k);
    if (map.size > MAX_KEYS) { // all fresh: drop the oldest windows down below the cap
      const byAge = [...map.entries()].sort((a, b) => a[1].t - b[1].t);
      const keep = MAX_KEYS - EVICT_BATCH;
      for (let i = 0; i < byAge.length - keep; i++) map.delete(byAge[i][0]);
    }
  }
  return r.n <= max;
}
module.exports = { hit, MAX_KEYS, EVICT_BATCH };
