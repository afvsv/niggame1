import { HayGrid } from './grid';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 2D value noise in [-1, 1]. */
function makeNoise(seed: number): (x: number, y: number) => number {
  const rand = mulberry32(seed);
  const N = 256;
  const table = new Float32Array(N * N);
  for (let i = 0; i < table.length; i++) table[i] = rand() * 2 - 1;
  const at = (x: number, y: number) => table[((y & (N - 1)) * N) + (x & (N - 1))];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = smooth(x - xi), fy = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

export interface StackShape { radiusM: number; heightM: number; seed: number; }

/** Fills the grid with a lumpy dome of hay. */
export function generateStack(grid: HayGrid, shape: StackShape): void {
  const noise = makeNoise(shape.seed);
  const s = grid.cellSize;
  const cx = grid.nx / 2, cz = grid.nz / 2;
  grid.data.fill(0);
  for (let z = 0; z < grid.nz; z++) {
    for (let x = 0; x < grid.nx; x++) {
      const wx = (x + 0.5 - cx) * s;
      const wz = (z + 0.5 - cz) * s;
      const n = noise(wx * 0.35 + 50, wz * 0.35 + 50) * 0.7 + noise(wx * 1.3 + 9, wz * 1.3 + 9) * 0.3;
      const r = Math.hypot(wx, wz) / (shape.radiusM * (1 + 0.07 * n));
      if (r >= 1) continue;
      const h = shape.heightM * Math.pow(1 - r * r, 0.65) + n * 0.35;
      const hc = Math.min(grid.ny, Math.floor(h / s));
      for (let y = 0; y < hc; y++) grid.data[grid.index(x, y, z)] = grid.cellMax;
    }
  }
  grid.recount();
  grid.markAllDirty();
}
