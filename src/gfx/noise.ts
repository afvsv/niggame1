/** Seeded PRNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Tileable gradient noise, fBm and Worley cells. Periods are in lattice units. */
export class Noise {
  private readonly perm = new Uint8Array(512);
  private readonly gx = new Float32Array(16);
  private readonly gy = new Float32Array(16);
  /** Distances to the nearest and second nearest Worley feature after `worley()`. */
  F1 = 0;
  F2 = 0;
  /** Hash of the nearest Worley cell in [0, 1). */
  cell = 0;

  constructor(seed: number) {
    const r = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.3;
      this.gx[i] = Math.cos(a);
      this.gy[i] = Math.sin(a);
    }
  }

  hash(ix: number, iy: number): number {
    return this.perm[this.perm[ix & 255] + (iy & 255)];
  }

  /** Perlin noise in roughly [-1, 1], periodic with (px, py). */
  perlin(x: number, y: number, px = 256, py = 256): number {
    const P = this.perm, GX = this.gx, GY = this.gy;
    let xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    xi = ((xi % px) + px) % px;
    yi = ((yi % py) + py) % py;
    const xi1 = (xi + 1) % px, yi1 = (yi + 1) % py;
    const h00 = P[P[xi & 255] + (yi & 255)] & 15, h10 = P[P[xi1 & 255] + (yi & 255)] & 15;
    const h01 = P[P[xi & 255] + (yi1 & 255)] & 15, h11 = P[P[xi1 & 255] + (yi1 & 255)] & 15;
    const n00 = GX[h00] * xf + GY[h00] * yf, n10 = GX[h10] * (xf - 1) + GY[h10] * yf;
    const n01 = GX[h01] * xf + GY[h01] * (yf - 1), n11 = GX[h11] * (xf - 1) + GY[h11] * (yf - 1);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const a = n00 + u * (n10 - n00), b = n01 + u * (n11 - n01);
    return (a + v * (b - a)) * 1.414;
  }

  /** Fractal sum of `oct` octaves; tileable when (px, py) are the base periods. */
  fbm(x: number, y: number, oct: number, px = 256, py = 256, gain = 0.5): number {
    let s = 0, a = 1, f = 1, n = 0;
    for (let o = 0; o < oct; o++) {
      s += a * this.perlin(x * f, y * f, px * f, py * f);
      n += a;
      a *= gain;
      f *= 2;
    }
    return s / n;
  }

  /** Tileable Worley noise; fills F1, F2 and cell. */
  worley(x: number, y: number, px: number, py: number): void {
    const xi = Math.floor(x), yi = Math.floor(y);
    let f1 = 9, f2 = 9, c = 0;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const cx = xi + i, cy = yi + j;
        const wx = ((cx % px) + px) % px, wy = ((cy % py) + py) % py;
        const h = this.hash(wx, wy);
        const fx = cx + h / 255, fy = cy + this.hash(wy + 17, wx + 91) / 255;
        const dx = fx - x, dy = fy - y, d = dx * dx + dy * dy;
        if (d < f1) { f2 = f1; f1 = d; c = this.hash(wx + 33, wy + 7) / 256; } else if (d < f2) f2 = d;
      }
    this.F1 = Math.sqrt(f1);
    this.F2 = Math.sqrt(f2);
    this.cell = c;
  }
}
