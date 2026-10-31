// Exact float-bit deduplication, including hard-normal edges and signed zero.
export function indexStatic(position, normal) {
  const pBits = new Uint32Array(position.buffer, position.byteOffset, position.length);
  const nBits = new Uint32Array(normal.buffer, normal.byteOffset, normal.length);
  const count = position.length / 3;
  let size = 1; while (size < count * 2) size *= 2;
  const slots = new Uint32Array(size), representatives = [], indices = new Uint32Array(count);
  const mask = size - 1;
  for (let i = 0; i < count; i++) {
    const a = i * 3;
    let hash = 2166136261;
    for (let j = 0; j < 3; j++) hash = Math.imul(hash ^ pBits[a+j], 16777619);
    for (let j = 0; j < 3; j++) hash = Math.imul(hash ^ nBits[a+j], 16777619);
    let slot = (hash ^ (hash >>> 16)) & mask;
    for (;;) {
      const stored = slots[slot];
      if (!stored) {
        const index = representatives.length;
        representatives.push(a); slots[slot] = index + 1; indices[i] = index; break;
      }
      const index = stored - 1, b = representatives[index];
      if (pBits[a]===pBits[b] && pBits[a+1]===pBits[b+1] && pBits[a+2]===pBits[b+2] && nBits[a]===nBits[b] && nBits[a+1]===nBits[b+1] && nBits[a+2]===nBits[b+2]) { indices[i] = index; break; }
      slot = (slot + 1) & mask;
    }
  }
  const Index = representatives.length <= 65536 ? Uint16Array : Uint32Array;
  if (representatives.length * 24 + count * Index.BYTES_PER_ELEMENT >= position.byteLength + normal.byteLength) return null;
  const p = new Float32Array(representatives.length * 3), n = new Float32Array(p.length);
  const outP = new Uint32Array(p.buffer), outN = new Uint32Array(n.buffer);
  representatives.forEach((a,i)=>{for(let j=0;j<3;j++){outP[i*3+j]=pBits[a+j];outN[i*3+j]=nBits[a+j];}});
  return {position:p,normal:n,index:new Index(indices)};
}
