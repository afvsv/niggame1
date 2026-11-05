import { HayGrid } from '../haystack/grid';

export interface AABB { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number; }

/** Static boxes + the hay grid + the floor plane at y = 0. */
export class Colliders {
  readonly boxes: AABB[] = [];
  constructor(private readonly grid: HayGrid) {}

  addBox(b: AABB): void { this.boxes.push(b); }

  collides(b: AABB): boolean {
    if (b.minY < 0) return true;
    for (const o of this.boxes) {
      if (b.minX < o.maxX && b.maxX > o.minX && b.minY < o.maxY && b.maxY > o.minY && b.minZ < o.maxZ && b.maxZ > o.minZ) return true;
    }
    const g = this.grid, s = g.cellSize, e = 1e-6;
    const x0 = Math.max(0, Math.floor((b.minX - g.originX) / s));
    const x1 = Math.min(g.nx - 1, Math.floor((b.maxX - g.originX) / s - e));
    const y0 = Math.max(0, Math.floor((b.minY - g.originY) / s));
    const y1 = Math.min(g.ny - 1, Math.floor((b.maxY - g.originY) / s - e));
    const z0 = Math.max(0, Math.floor((b.minZ - g.originZ) / s));
    const z1 = Math.min(g.nz - 1, Math.floor((b.maxZ - g.originZ) / s - e));
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) if (g.data[g.index(x, y, z)] > 0) return true;
    return false;
  }
}
