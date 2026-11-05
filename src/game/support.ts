import type { HayGrid } from '../haystack/grid';
import type { AABB } from '../world/colliders';

/** Top of the highest hay cell in the column under (x, z) that is not above `maxY`; 0 for none. */
export function hayTop(grid: HayGrid, x: number, z: number, maxY: number): number {
  const s = grid.cellSize;
  const cx = Math.floor((x - grid.originX) / s), cz = Math.floor((z - grid.originZ) / s);
  if (cx < 0 || cz < 0 || cx >= grid.nx || cz >= grid.nz) return 0;
  for (let y = Math.min(grid.ny - 1, Math.floor((maxY - grid.originY) / s)); y >= 0; y--) {
    const v = grid.data[grid.index(cx, y, cz)];
    if (v === 0) continue;
    // Partly dug cells sit lower, roughly like the smooth surface drawn over them.
    const top = grid.originY + (y + 0.3 + 0.7 * (v / grid.cellMax)) * s;
    if (top <= maxY + 0.02) return top;
  }
  return 0;
}

/**
 * Height an object of footprint radius `r` comes to rest at when dropped at (x, z) from `maxY`:
 * the floor, hay or the top of a box (bale, counter) below it.
 */
export function supportHeight(grid: HayGrid, boxes: readonly AABB[], x: number, z: number, maxY: number, r: number): number {
  let h = 0;
  const k = r * 0.7;
  for (const [dx, dz] of [[0, 0], [k, 0], [-k, 0], [0, k], [0, -k]]) h = Math.max(h, hayTop(grid, x + dx, z + dz, maxY));
  for (const b of boxes) {
    if (b.maxY > maxY + 1e-6 || x + k <= b.minX || x - k >= b.maxX || z + k <= b.minZ || z - k >= b.maxZ) continue;
    h = Math.max(h, b.maxY);
  }
  return h;
}

/** Simple fall under gravity onto the support below. Returns the new height and vertical speed. */
export function fall(y: number, vy: number, support: number, g: number, dt: number): [number, number] {
  if (y <= support + 1e-4) return [support, 0];
  vy -= g * dt;
  const ny = y + vy * dt;
  return ny <= support ? [support, 0] : [ny, vy];
}
