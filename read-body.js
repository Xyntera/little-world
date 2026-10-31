'use strict';
// Bound retained request data even when an oversized sender keeps streaming.
const MAX_BODY_BYTES = 65536;
function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [], bytes = 0, settled = false;
    const fail = message => { if (settled) return; settled = true; chunks = []; reject(new Error(message)); };
    req.on('data', chunk => {
      if (settled) return;
      const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += b.length;
      if (bytes > MAX_BODY_BYTES) { fail('body too large'); return; }
      chunks.push(b);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      const body = Buffer.concat(chunks, bytes).toString('utf8'); chunks = [];
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid JSON')); }
    });
    req.on('aborted', () => fail('request aborted'));
    req.on('error', err => fail(err.message || 'request error'));
  });
}
module.exports = { readBody, MAX_BODY_BYTES };
