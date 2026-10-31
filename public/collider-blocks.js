// Conservative contiguous-block broad phase. Original collider order is part of push-out behavior.
// Only the supplied static prefix is indexed; appended dynamic colliders are always scanned.
export function colliderBlocks(colliders, blockSize = 32) {
  const count = colliders.length, blocks = [];
  for (let start = 0; start < count; start += blockSize) {
    const end = Math.min(count, start + blockSize);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = start; i < end; i++) {
      const c = colliders[i], rx = c.hw !== undefined ? c.hw : c.r, rz = c.hd !== undefined ? c.hd : c.r;
      x0 = Math.min(x0, c.x - rx); x1 = Math.max(x1, c.x + rx);
      z0 = Math.min(z0, c.z - rz); z1 = Math.max(z1, c.z + rz);
    }
    blocks.push({ start, end, x0, z0, x1, z1 });
  }
  return function* scan(position, pad) {
    for (const b of blocks) {
      // Read live position at EACH block: an earlier collider may already have pushed the player.
      const p = position();
      if (p.x < b.x0 - pad || p.x > b.x1 + pad || p.z < b.z0 - pad || p.z > b.z1 + pad) continue;
      for (let i = b.start; i < b.end; i++) yield colliders[i];
    }
    for (let i = count; i < colliders.length; i++) yield colliders[i];
  };
}
