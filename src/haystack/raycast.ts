import { HayGrid } from './grid';

export interface GridHit {
  x: number; y: number; z: number; // cell
  dist: number; // metres from origin to the entry point
  nx: number; ny: number; nz: number; // face normal of the entry face
}

/** Amanatides & Woo voxel traversal. Direction must be normalised. */
export function raycastGrid(
  grid: HayGrid,
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number,
): GridHit | null {
  const s = grid.cellSize;
  const gx = (ox - grid.originX) / s, gy = (oy - grid.originY) / s, gz = (oz - grid.originZ) / s;
  let x = Math.floor(gx), y = Math.floor(gy), z = Math.floor(gz);
  const stepX = Math.sign(dx), stepY = Math.sign(dy), stepZ = Math.sign(dz);
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmx = dx > 0 ? (x + 1 - gx) * tdx : dx < 0 ? (gx - x) * tdx : Infinity;
  let tmy = dy > 0 ? (y + 1 - gy) * tdy : dy < 0 ? (gy - y) * tdy : Infinity;
  let tmz = dz > 0 ? (z + 1 - gz) * tdz : dz < 0 ? (gz - z) * tdz : Infinity;
  const maxT = maxDist / s;
  let t = 0, nx = 0, ny = 0, nz = 0;
  for (let guard = 0; guard < 4096 && t <= maxT; guard++) {
    if (grid.get(x, y, z) > 0) return { x, y, z, dist: t * s, nx, ny, nz };
    if (tmx < tmy && tmx < tmz) { t = tmx; x += stepX; tmx += tdx; nx = -stepX; ny = 0; nz = 0; }
    else if (tmy < tmz) { t = tmy; y += stepY; tmy += tdy; nx = 0; ny = -stepY; nz = 0; }
    else { t = tmz; z += stepZ; tmz += tdz; nx = 0; ny = 0; nz = -stepZ; }
  }
  return null;
}
