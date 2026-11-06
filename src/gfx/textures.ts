import { Noise, clamp, lerp, mulberry32, smooth } from './noise';
import { PBRData, boxBlur, heightToNormal } from './pbr';

type RGB = readonly [number, number, number];

interface Canvas {
  S: number;
  H: Float32Array; // height
  C: Float32Array; // sRGB colour, 3 floats per texel
  R: Float32Array; // roughness
  A?: Uint8Array; // optional alpha
}

function canvas(S: number, color: RGB, rough: number): Canvas {
  const C = new Float32Array(S * S * 3);
  for (let i = 0; i < S * S; i++) { C[i * 3] = color[0]; C[i * 3 + 1] = color[1]; C[i * 3 + 2] = color[2]; }
  return { S, H: new Float32Array(S * S), C, R: new Float32Array(S * S).fill(rough) };
}

function finish(c: Canvas, normalStrength: number): PBRData {
  const { S, C, A, R } = c;
  const albedo = new Uint8Array(S * S * 4), rough = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    albedo[i * 4] = clamp(C[i * 3], 0, 1) * 255;
    albedo[i * 4 + 1] = clamp(C[i * 3 + 1], 0, 1) * 255;
    albedo[i * 4 + 2] = clamp(C[i * 3 + 2], 0, 1) * 255;
    albedo[i * 4 + 3] = A ? A[i] : 255;
    rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = clamp(R[i], 0, 1) * 255;
    rough[i * 4 + 3] = 255;
  }
  return { size: S, albedo, normal: heightToNormal(c.H, S, normalStrength), rough };
}

interface StrandOpts {
  count: number;
  len: [number, number, number]; // min, max, power (in texels)
  rad: [number, number]; // radius range in texels
  bend: number; // max sideways bow as a fraction of length
  palette: readonly RGB[];
  lum: [number, number];
  base: [number, number]; // height of the first and the last strand
  lift: number; // height of the strand's round profile
  rough: [number, number]; // ridge, edge
  angle?: (r: () => number) => number;
  nodes?: boolean;
}

/**
 * Stamps round, slightly bent strands into the canvas. Later strands lie on top,
 * texels keep the highest surface, everything wraps around the edges.
 */
function strands(c: Canvas, rnd: () => number, o: StrandOpts): void {
  const { S, H, C, R } = c;
  const M = S - 1;
  for (let i = 0; i < o.count; i++) {
    const base = lerp(o.base[0], o.base[1], i / o.count);
    const cx = rnd() * S, cy = rnd() * S;
    const ang = o.angle ? o.angle(rnd) : rnd() * Math.PI;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const len = o.len[0] + Math.pow(rnd(), o.len[2]) * (o.len[1] - o.len[0]);
    const rad = lerp(o.rad[0], o.rad[1], rnd());
    const bend = (rnd() - 0.5) * 2 * o.bend * len;
    const p = o.palette[Math.floor(rnd() * o.palette.length)];
    const lum = lerp(o.lum[0], o.lum[1], rnd());
    const pr = p[0] * lum * lerp(0.95, 1.05, rnd()), pg = p[1] * lum, pb = p[2] * lum * lerp(0.9, 1.1, rnd());
    const n1 = o.nodes ? rnd() : -9, n2 = o.nodes && rnd() < 0.5 ? rnd() : -9;
    const phase = rnd() * 6.283;
    const steps = Math.max(2, Math.ceil(len / Math.max(0.7, rad * 0.6)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, a = (t - 0.5) * len, off = bend * (1 - 4 * (t - 0.5) * (t - 0.5));
      const px = cx + ca * a - sa * off, py = cy + sa * a + ca * off;
      const taper = t < 0.07 ? 0.5 + (0.5 * t) / 0.07 : t > 0.93 ? 0.5 + (0.5 * (1 - t)) / 0.07 : 1;
      const r = rad * taper, r2 = r * r, ir = Math.ceil(r);
      const e1 = ((t - n1) * len) / 2.2, e2 = ((t - n2) * len) / 2.2;
      const node = 1 - 0.38 * (Math.exp(-e1 * e1) + Math.exp(-e2 * e2));
      const along = (0.9 + 0.1 * Math.sin(t * 11 + phase)) * node;
      const x0 = Math.floor(px), y0 = Math.floor(py);
      for (let dy = -ir; dy <= ir; dy++)
        for (let dx = -ir; dx <= ir; dx++) {
          const ddx = x0 + dx + 0.5 - px, ddy = y0 + dy + 0.5 - py;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 > r2) continue;
          const q = Math.sqrt(1 - d2 / r2);
          const h = base + q * o.lift;
          const idx = ((y0 + dy) & M) * S + ((x0 + dx) & M);
          if (h <= H[idx]) continue;
          H[idx] = h;
          const across = (ddy * ca - ddx * sa) / r;
          const fib = 0.93 + 0.07 * Math.sin(across * 7 + phase);
          const k = (0.68 + 0.32 * q) * fib * along;
          C[idx * 3] = pr * k; C[idx * 3 + 1] = pg * k; C[idx * 3 + 2] = pb * k;
          R[idx] = lerp(o.rough[1], o.rough[0], q);
        }
    }
  }
}

/** Darkens texels that sit below their neighbourhood: cheap baked cavity occlusion. */
function cavity(c: Canvas, radius: number, gain: number, floor: number): void {
  const blur = boxBlur(c.H, c.S, radius);
  for (let i = 0; i < c.S * c.S; i++) {
    const k = clamp(1 - (blur[i] - c.H[i]) * gain, floor, 1);
    c.C[i * 3] *= k; c.C[i * 3 + 1] *= k; c.C[i * 3 + 2] *= k;
  }
}

const HAY: readonly RGB[] = [
  [0.88, 0.7, 0.38], [0.94, 0.8, 0.5], [0.82, 0.61, 0.3], [0.91, 0.75, 0.44],
  [0.76, 0.56, 0.26], [0.7, 0.58, 0.3], [0.62, 0.43, 0.2], [0.96, 0.86, 0.6],
];

/** Loose hay: thousands of overlapping round straws with deep dark gaps. One tile ≈ 1.6 m. */
export function genHay(S = 1024, seed = 11): PBRData {
  const c = canvas(S, [0.17, 0.12, 0.05], 0.95);
  const k = S / 1024;
  strands(c, mulberry32(seed), {
    count: Math.round(5600 * k * k), len: [70 * k, 330 * k, 1.5], rad: [2.3 * k, 4.2 * k], bend: 0.12,
    palette: HAY, lum: [0.8, 1.04], base: [0, 0.72], lift: 0.28, rough: [0.55, 0.8], nodes: true,
  });
  // Depth: lower layers are in the shade of the ones above.
  for (let i = 0; i < S * S; i++) {
    const d = 0.36 + 0.64 * smooth(0, 1, c.H[i]);
    c.C[i * 3] *= d; c.C[i * 3 + 1] *= d; c.C[i * 3 + 2] *= d;
  }
  cavity(c, Math.round(5 * k), 2.4, 0.45);
  return finish(c, 2.2);
}

/** Packed floor: dirt or sand, pebbles and trodden straw bits. One tile ≈ 3 m. */
export function genDirt(S = 512, seed = 5, o: { light?: number; tint?: RGB; straws?: number } = {}): PBRData {
  const L0 = o.light ?? 0.36, [tr, tg, tb] = o.tint ?? [1, 0.82, 0.62];
  const N = new Noise(seed);
  const c = canvas(S, [0, 0, 0], 0.92);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x, u = x / S, v = y / S;
      const f = N.fbm(u * 8, v * 8, 5, 8, 8), big = N.fbm(u * 2 + 5, v * 2 + 1, 3, 2, 2);
      const crumb = N.perlin(u * 96, v * 96, 96, 96);
      N.worley(u * 22, v * 22, 22, 22);
      const size = 0.12 + N.cell * 0.22;
      const peb = N.cell > 0.8 ? 1 - smooth(size * 0.6, size, N.F1) : 0;
      const L = L0 + f * 0.1 + big * 0.08 + crumb * 0.03;
      let r = L * tr, g = L * tg, b = L * tb;
      if (peb > 0) { const pl = 0.3 + N.cell * 0.12 + f * 0.1; r = lerp(r, pl, peb); g = lerp(g, pl * 0.9, peb); b = lerp(b, pl * 0.76, peb); }
      const wet = clamp(-big * 1.4, 0, 0.5);
      r *= 1 - wet * 0.35; g *= 1 - wet * 0.35; b *= 1 - wet * 0.3;
      c.C[i * 3] = r; c.C[i * 3 + 1] = g; c.C[i * 3 + 2] = b;
      c.H[i] = 0.2 + f * 0.12 + crumb * 0.03 + peb * 0.14;
      c.R[i] = 0.93 - peb * 0.18 - wet * 0.25;
    }
  strands(c, mulberry32(seed + 1), {
    count: Math.round((o.straws ?? 520) * (S / 512) ** 2), len: [10, 70, 1.6], rad: [1.0, 1.9], bend: 0.15,
    palette: HAY, lum: [0.6, 0.95], base: [0.3, 0.42], lift: 0.12, rough: [0.6, 0.8],
  });
  cavity(c, 3, 2, 0.6);
  return finish(c, 3.2);
}

const GRASS: readonly RGB[] = [
  [0.36, 0.52, 0.18], [0.44, 0.6, 0.22], [0.3, 0.45, 0.16], [0.52, 0.62, 0.26], [0.56, 0.55, 0.28], [0.27, 0.4, 0.15],
];

/** Meadow seen from above: dense short blades over dark soil. One tile ≈ 2 m. */
export function genGrass(S = 512, seed = 3): PBRData {
  const c = canvas(S, [0.15, 0.17, 0.07], 0.95);
  const k = S / 512;
  strands(c, mulberry32(seed), {
    count: Math.round(9000 * k * k), len: [8 * k, 30 * k, 1.3], rad: [0.8 * k, 1.5 * k], bend: 0.25,
    palette: GRASS, lum: [0.75, 1.1], base: [0, 0.75], lift: 0.25, rough: [0.62, 0.85],
  });
  for (let i = 0; i < S * S; i++) {
    const d = 0.45 + 0.55 * c.H[i];
    c.C[i * 3] *= d; c.C[i * 3 + 1] *= d; c.C[i * 3 + 2] *= d;
  }
  cavity(c, 3, 2, 0.55);
  return finish(c, 2.5);
}

export interface PlankOpts {
  boards: number; // per tile, across u
  gaps: boolean; // cut-outs between boards (alpha = 0)
  seed: number;
  light: RGB;
  dark: RGB;
  weather: number; // 0..1 how grey and blotchy
}

/** Vertical boards with grain, knots, butt joints, nails and bevelled edges. */
export function genPlanks(S: number, o: PlankOpts): PBRData {
  const N = new Noise(o.seed);
  const rnd = mulberry32(o.seed * 7 + 1);
  const c = canvas(S, [0, 0, 0], 0.85);
  if (o.gaps) c.A = new Uint8Array(S * S).fill(255);
  // Board layout across u.
  const w: number[] = [];
  for (let i = 0; i < o.boards; i++) w.push(0.75 + rnd() * 0.5);
  const sum = w.reduce((a, b) => a + b, 0);
  const starts: number[] = [];
  let acc = 0;
  for (const x of w) { starts.push(Math.round((acc / sum) * S)); acc += x; }
  starts.push(S);
  const boardOf = new Int16Array(S);
  for (let b = 0; b < o.boards; b++) for (let x = starts[b]; x < starts[b + 1]; x++) boardOf[x] = b;
  const boards = w.map(() => ({
    tone: 0.82 + rnd() * 0.32, seam: rnd(), gray: rnd(), gap: rnd() < 0.45,
    knots: Array.from({ length: Math.floor(rnd() * 2.4) }, () => ({ u: 0.25 + rnd() * 0.5, v: rnd(), s: 3 + rnd() * 5 })),
  }));
  const gapPx = Math.max(1, Math.round(S / 220));
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x, b = boardOf[x], B = boards[b];
      const bw = starts[b + 1] - starts[b], lx = x - starts[b], v = y / S;
      if (o.gaps && B.gap && lx < gapPx) {
        c.A![i] = 0; c.H[i] = 0; c.R[i] = 1;
        c.C[i * 3] = 0.05; c.C[i * 3 + 1] = 0.04; c.C[i * 3 + 2] = 0.03;
        continue;
      }
      // Knots bend the grain around them.
      let warp = 0, knot = 0;
      for (const k of B.knots) {
        let dv = (v - k.v) * S;
        dv -= Math.round(dv / S) * S;
        const du = lx - k.u * bw;
        const d = Math.hypot(du / k.s, dv / (k.s * 1.7));
        warp += (Math.sign(du) * 6) / (1 + d * d);
        knot = Math.max(knot, 1 - smooth(0.6, 1.1, d));
      }
      const g1 = N.fbm((x / S) * 40 + b * 3.1, v * 2, 3, 40, 2);
      const g2 = N.perlin((x / S) * 140, v * 10 + b * 5.7, 140, 10);
      const grain = 0.5 + 0.5 * Math.sin(x * 0.9 + g1 * 14 + warp);
      const weather = N.fbm((x / S) * 4 + 7, v * 4, 4, 4, 4);
      const t = clamp(0.5 + g1 * 0.9, 0, 1);
      let r = lerp(o.dark[0], o.light[0], t) * B.tone;
      let g = lerp(o.dark[1], o.light[1], t) * B.tone;
      let bl = lerp(o.dark[2], o.light[2], t) * B.tone;
      const gk = 0.9 + 0.1 * grain + g2 * 0.05;
      r *= gk; g *= gk; bl *= gk;
      const gray = clamp(o.weather * (0.35 + weather * 0.8 + B.gray * 0.3), 0, 0.85);
      const L = (r + g + bl) / 3;
      r = lerp(r, L * 1.02, gray); g = lerp(g, L, gray); bl = lerp(bl, L * 0.96, gray);
      if (knot > 0) { const kk = 1 - knot * 0.55; r *= kk; g *= kk * 0.95; bl *= kk * 0.9; }
      // Bevelled board edges and the butt joint.
      const e = Math.min(lx - (o.gaps && B.gap ? gapPx : 0), bw - 1 - lx);
      const bevel = smooth(0, Math.max(2, S / 170), e);
      let dv = (v - B.seam) * S;
      dv -= Math.round(dv / S) * S;
      const seam = 1 - smooth(0.5, 2.2, Math.abs(dv));
      const shade = (0.62 + 0.38 * bevel) * (1 - seam * 0.6);
      // Two nails above the joint.
      const nu = Math.min(Math.abs(lx - bw * 0.3), Math.abs(lx - bw * 0.7)), nv = Math.abs(dv - 6);
      const nail = 1 - smooth(1.2, 2.2, Math.hypot(nu, nv));
      r *= shade; g *= shade; bl *= shade;
      if (nail > 0) { r = lerp(r, 0.16, nail); g = lerp(g, 0.14, nail); bl = lerp(bl, 0.13, nail); }
      c.C[i * 3] = r; c.C[i * 3 + 1] = g; c.C[i * 3 + 2] = bl;
      c.H[i] = (0.55 + grain * 0.06 + g2 * 0.05 - knot * 0.08) * bevel * (1 - seam * 0.5) + nail * 0.05;
      c.R[i] = clamp(0.78 + weather * 0.15 + gray * 0.1 - nail * 0.4, 0.35, 1);
    }
  return finish(c, 2.4);
}

/** Rough hewn timber for posts and beams; grain runs along v. One tile ≈ 1 m. */
export function genBeam(S = 256, seed = 21): PBRData {
  const N = new Noise(seed);
  const c = canvas(S, [0, 0, 0], 0.85);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x, u = x / S, v = y / S;
      const g1 = N.fbm(u * 24, v * 2, 3, 24, 2);
      const g2 = N.perlin(u * 90, v * 6, 90, 6);
      const grain = 0.5 + 0.5 * Math.sin(u * S * 1.1 + g1 * 10);
      const adze = N.fbm(u * 3, v * 7, 3, 3, 7);
      const crackN = Math.abs(N.perlin(u * 6 + 3, v * 1.2, 6, 1.2 * 1));
      const crack = 1 - smooth(0.0, 0.035, crackN);
      const t = clamp(0.5 + g1 * 0.8 + adze * 0.3, 0, 1);
      const k = (0.85 + 0.15 * grain) * (1 - crack * 0.65);
      c.C[i * 3] = lerp(0.27, 0.46, t) * k;
      c.C[i * 3 + 1] = lerp(0.19, 0.34, t) * k;
      c.C[i * 3 + 2] = lerp(0.12, 0.23, t) * k;
      c.H[i] = 0.5 + adze * 0.25 + grain * 0.05 + g2 * 0.04 - crack * 0.3;
      c.R[i] = 0.8 + adze * 0.1 + crack * 0.1;
    }
  return finish(c, 2.6);
}

/** Board-formed concrete: blue-grey, horizontal form lines, pores and damp stains. One tile ≈ 2 m. */
export function genConcrete(S = 512, seed = 41): PBRData {
  const N = new Noise(seed);
  const c = canvas(S, [0, 0, 0], 0.9);
  const rows = 8; // form boards per tile
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x, u = x / S, v = y / S;
      const f = N.fbm(u * 6, v * 6, 5, 6, 6), big = N.fbm(u * 2 + 3, v * 2 + 9, 3, 2, 2);
      const row = Math.floor(v * rows), rv = v * rows - row;
      const tone = 0.94 + 0.12 * (((row * 7919) % 13) / 13 - 0.5);
      const grain = N.perlin(u * 60, v * 4 + row * 3.3, 60, 4) * 0.5 + N.perlin(u * 160, v * 160, 160, 160) * 0.3;
      const line = 1 - smooth(0, 0.035, Math.min(rv, 1 - rv));
      N.worley(u * 40, v * 40, 40, 40);
      const pore = N.cell > 0.7 ? 1 - smooth(0.04, 0.12, N.F1) : 0;
      const streak = clamp(N.fbm(u * 18, v * 2, 3, 18, 2) * 1.2, 0, 1) * smooth(0.2, 1, 1 - v);
      let L = (0.4 + f * 0.08 + big * 0.06 + grain * 0.04) * tone;
      L *= 1 - line * 0.35 - pore * 0.45 - streak * 0.18;
      c.C[i * 3] = L * 0.9; c.C[i * 3 + 1] = L * 0.95; c.C[i * 3 + 2] = L * 1.06;
      c.H[i] = 0.5 + f * 0.1 + grain * 0.06 - line * 0.25 - pore * 0.3;
      c.R[i] = 0.88 + f * 0.06 - streak * 0.1;
    }
  return finish(c, 2.0);
}

/** Weathered corrugated steel sheet: ridges along v, grey with rust runs. One tile ≈ 1.2 m, 12 ridges. */
export function genMetal(S = 512, seed = 51): PBRData {
  const N = new Noise(seed);
  const c = canvas(S, [0, 0, 0], 0.6);
  const ridges = 12;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x, u = x / S, v = y / S;
      const wave = 0.5 + 0.5 * Math.sin(u * ridges * Math.PI * 2);
      const rust = clamp(N.fbm(u * 10, v * 1.6, 4, 10, 2) * 1.6 + N.fbm(u * 3 + 4, v * 3, 3, 3, 3) * 0.8, 0, 1);
      const dirt = clamp(N.fbm(u * 5 + 9, v * 5, 4, 5, 5) * 0.8 + 0.3, 0, 1);
      const spot = N.perlin(u * 90, v * 90, 90, 90);
      const lit = 0.86 + wave * 0.14;
      let r = lerp(0.42, 0.46, dirt), g = lerp(0.41, 0.4, dirt), b = lerp(0.4, 0.36, dirt);
      r = lerp(r, 0.44, rust); g = lerp(g, 0.27, rust); b = lerp(b, 0.15, rust);
      const k = lit * (0.92 + spot * 0.08);
      c.C[i * 3] = r * k; c.C[i * 3 + 1] = g * k; c.C[i * 3 + 2] = b * k;
      c.H[i] = wave * 0.8 + spot * 0.03 - rust * 0.05;
      c.R[i] = 0.5 + rust * 0.4 + dirt * 0.08;
    }
  return finish(c, 5.0);
}

/** Roll-up door: painted teal steel slats with worn edges and grime at the bottom. One tile ≈ 1.2 m, 10 slats. */
export function genShutter(S = 512, seed = 61): PBRData {
  const N = new Noise(seed);
  const c = canvas(S, [0, 0, 0], 0.55);
  const slats = 10;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x, u = x / S, v = y / S;
      const sv = v * slats - Math.floor(v * slats);
      const profile = Math.sin(sv * Math.PI); // rounded slat
      const groove = 1 - smooth(0, 0.08, Math.min(sv, 1 - sv));
      const mid = 1 - smooth(0.02, 0.06, Math.abs(sv - 0.5)); // pressed rib in the middle
      const wear = clamp(N.fbm(u * 14, v * 14, 4, 14, 14) * 1.5 - 0.35 + groove * 0.4, 0, 1);
      const grime = clamp(N.fbm(u * 4 + 2, v * 4, 3, 4, 4) * 0.9 + 0.2, 0, 1);
      const scratch = N.perlin(u * 200, v * 8, 200, 8) > 0.55 ? 1 : 0;
      let r = 0.16, g = 0.3, b = 0.28;
      r = lerp(r, 0.24, wear * 0.6); g = lerp(g, 0.24, wear * 0.6); b = lerp(b, 0.2, wear * 0.6);
      if (scratch) { r = lerp(r, 0.4, 0.4); g = lerp(g, 0.42, 0.4); b = lerp(b, 0.4, 0.4); }
      const k = (0.72 + profile * 0.28) * (1 - groove * 0.5) * (1 - grime * 0.25) * (1 - mid * 0.15);
      c.C[i * 3] = r * k; c.C[i * 3 + 1] = g * k; c.C[i * 3 + 2] = b * k;
      c.H[i] = profile * 0.6 - groove * 0.3 - mid * 0.12;
      c.R[i] = 0.45 + wear * 0.35 + grime * 0.1;
    }
  return finish(c, 3.0);
}

/** Low-frequency RGB noise used to break up tiling. */
export function genVariation(S = 256, seed = 9): Uint8Array {
  const N = new Noise(seed);
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, o = (y * S + x) * 4;
      out[o] = clamp(0.5 + N.fbm(u * 4, v * 4, 4, 4, 4) * 0.9, 0, 1) * 255;
      out[o + 1] = clamp(0.5 + N.fbm(u * 3 + 11, v * 3 + 5, 4, 3, 3) * 0.9, 0, 1) * 255;
      out[o + 2] = clamp(0.5 + N.fbm(u * 9 + 2, v * 9 + 8, 3, 9, 9) * 0.9, 0, 1) * 255;
      out[o + 3] = 255;
    }
  return out;
}

export interface TextureJobs {
  hay: PBRData;
  sand: PBRData; // hangar floor
  grass: PBRData;
  boards: PBRData; // roof boards and furniture, no gaps
  beam: PBRData;
  siding: PBRData; // hangar walls: dark vertical boards, no gaps
  concrete: PBRData;
  metal: PBRData; // corrugated roof sheets
  shutter: PBRData; // the roll-up exit door
}

export const TEXTURE_JOBS: { [K in keyof TextureJobs]: () => TextureJobs[K] } = {
  hay: () => genHay(1024),
  sand: () => genDirt(512, 15, { light: 0.58, tint: [1, 0.84, 0.63], straws: 70 }),
  grass: () => genGrass(512),
  boards: () => genPlanks(256, { boards: 5, gaps: false, seed: 8, light: [0.55, 0.4, 0.26], dark: [0.36, 0.25, 0.15], weather: 0.3 }),
  beam: () => genBeam(256),
  siding: () => genPlanks(512, { boards: 8, gaps: false, seed: 31, light: [0.44, 0.31, 0.21], dark: [0.25, 0.17, 0.11], weather: 0.22 }),
  concrete: () => genConcrete(512),
  metal: () => genMetal(512),
  shutter: () => genShutter(512),
};
