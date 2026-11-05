import * as THREE from 'three';
import { CHUNK, HayGrid } from './grid';

/**
 * Smooth haystack surface from the strand grid (naive surface nets).
 * Density of a cell: 0 when empty, 0.52..1 by fill, so every non-empty cell is
 * visible and partially dug cells shrink smoothly. Iso level 0.5.
 * The geometry has two groups: 0 = hay surface, 1 = loose straws sticking out.
 */
const ISO = 0.5;
const PAD = 2; // dual cubes cached around the chunk: [x0 - PAD, x1 + 1)

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The 12 cube edges as pairs of corner indices (corner = a + 2b + 4c for offsets a, b, c on x, y, z).
const EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7], // along x
  [0, 2], [1, 3], [4, 6], [5, 7], // along y
  [0, 4], [1, 5], [2, 6], [3, 7], // along z
] as const;

// Straw colours (sRGB), converted to linear once.
const STRAW = [
  [0.88, 0.73, 0.4], [0.95, 0.84, 0.55], [0.8, 0.62, 0.3], [0.72, 0.6, 0.3], [0.62, 0.47, 0.22], [0.97, 0.9, 0.66],
].map((c) => c.map((v) => Math.pow(v, 2.2)));

export function buildChunkGeometry(grid: HayGrid, cx: number, cy: number, cz: number): THREE.BufferGeometry | null {
  const s = grid.cellSize, max = grid.cellMax, nx = grid.nx, ny = grid.ny, nz = grid.nz, data = grid.data;
  const dens = (x: number, y: number, z: number): number => {
    if (y < 0) return 1;
    if (x < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return 0;
    const f = data[(y * nz + z) * nx + x];
    return f === 0 ? 0 : 0.52 + (0.48 * f) / max;
  };
  const x0 = cx * CHUNK, y0 = cy * CHUNK, z0 = cz * CHUNK;
  const x1 = Math.min(nx, x0 + CHUNK), y1 = Math.min(ny, y0 + CHUNK), z1 = Math.min(nz, z0 + CHUNK);
  // Cells that own edges: the lower cell of each edge. The first chunk also owns edges from outside the grid.
  const lx0 = cx === 0 ? -1 : x0, ly0 = y0, lz0 = cz === 0 ? -1 : z0;

  const W = x1 - x0 + PAD + 1, Hh = y1 - y0 + PAD + 1, D = z1 - z0 + PAD + 1;
  const vid = new Int32Array(W * Hh * D).fill(-2); // -2 = not computed, -1 = no vertex
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  const cubeVerts: number[] = []; // dual cube coords per vertex, for straws
  const d8 = new Float32Array(8);

  const vertexOf = (i: number, j: number, k: number): number => {
    const li = i - x0 + PAD, lj = j - y0 + PAD, lk = k - z0 + PAD;
    const key = (lj * D + lk) * W + li;
    const cached = vid[key];
    if (cached !== -2) return cached;
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = dens(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1));
      d8[c] = v;
      if (v >= ISO) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) { vid[key] = -1; return -1; }
    let px = 0, py = 0, pz = 0, n = 0;
    for (const [a, b] of EDGES) {
      const da = d8[a], db = d8[b];
      if ((da >= ISO) === (db >= ISO)) continue;
      const t = (ISO - da) / (db - da);
      px += (a & 1) + t * ((b & 1) - (a & 1));
      py += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1));
      pz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1));
      n++;
    }
    px /= n; py /= n; pz /= n;
    const wx = grid.originX + (i + 0.5 + px) * s;
    let wy = grid.originY + (j + 0.5 + py) * s;
    const wz = grid.originZ + (k + 0.5 + pz) * s;
    if (j < 0) wy = Math.min(wy, 0) - 0.02; // tuck the skirt under the floor
    // Smooth normal from a wide (4×4×4) density gradient, and occlusion from the same neighbourhood
    // (how much hay surrounds the vertex: about half on a flat surface).
    let gx = 0, gy = 0, gz = 0, occ = 0;
    for (let b = -1; b <= 2; b++)
      for (let c = -1; c <= 2; c++)
        for (let a = -1; a <= 2; a++) {
          const v = dens(i + a, j + b, k + c);
          if (v === 0) continue;
          occ++;
          const wa = a <= 0 ? -1 : 1, wb = b <= 0 ? -1 : 1, wc = c <= 0 ? -1 : 1;
          const fa = a === -1 || a === 2 ? 0.5 : 1, fb = b === -1 || b === 2 ? 0.5 : 1, fc = c === -1 || c === 2 ? 0.5 : 1;
          gx += v * wa * fa * fb * fc; gy += v * wb * fa * fb * fc; gz += v * wc * fa * fb * fc;
        }
    const gl = Math.hypot(gx, gy, gz) || 1;
    gx = -gx / gl; gy = -gy / gl; gz = -gz / gl;
    occ /= 64;
    const ao = Math.max(0.32, Math.min(1, 1.08 - (occ - 0.42) * 1.7));
    const h = hash3(i, j, k);
    const tint = 0.9 + h * 0.16;
    const id = pos.length / 3;
    pos.push(wx, wy, wz);
    nor.push(gx, gy, gz);
    col.push(ao * tint, ao * tint * (0.98 + h * 0.03), ao * tint * (0.94 + hash3(k, i, j) * 0.1));
    cubeVerts.push(i, j, k);
    vid[key] = id;
    return id;
  };

  const e = [0, 0, 0], u3 = [0, 0, 0], v3 = [0, 0, 0];
  for (let y = ly0; y < y1; y++)
    for (let z = lz0; z < z1; z++)
      for (let x = lx0; x < x1; x++) {
        const inside = dens(x, y, z) >= ISO;
        for (let a = 0; a < 3; a++) {
          if (a === 1 && y < 0) continue; // the floor is never drawn
          e[0] = x; e[1] = y; e[2] = z; e[a]++;
          if (inside === (dens(e[0], e[1], e[2]) >= ISO)) continue;
          const u = (a + 1) % 3, v = (a + 2) % 3;
          // Skip edges whose quad would need cubes outside the cached window or the grid's padding.
          u3[0] = 0; u3[1] = 0; u3[2] = 0; u3[u] = 1;
          v3[0] = 0; v3[1] = 0; v3[2] = 0; v3[v] = 1;
          const c00 = vertexOf(x - u3[0] - v3[0], y - u3[1] - v3[1], z - u3[2] - v3[2]);
          const c10 = vertexOf(x - v3[0], y - v3[1], z - v3[2]);
          const c11 = vertexOf(x, y, z);
          const c01 = vertexOf(x - u3[0], y - u3[1], z - u3[2]);
          if (c00 < 0 || c10 < 0 || c11 < 0 || c01 < 0) continue;
          if (inside) idx.push(c00, c10, c11, c00, c11, c01);
          else idx.push(c00, c11, c10, c00, c01, c11);
        }
      }
  if (idx.length === 0) return null;
  const surfaceIndexCount = idx.length;

  // Loose straws poking out of the surface, seeded by the dual cube so they stay put between rebuilds.
  const vcount = pos.length / 3;
  const used = new Uint8Array(vcount);
  for (const i of idx) used[i] = 1;
  const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), nrm = new THREE.Vector3(), dir = new THREE.Vector3();
  const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), base = new THREE.Vector3(), up = new THREE.Vector3();
  for (let vi = 0; vi < vcount; vi++) {
    if (!used[vi]) continue;
    const ci = cubeVerts[vi * 3], cj = cubeVerts[vi * 3 + 1], ck = cubeVerts[vi * 3 + 2];
    nrm.set(nor[vi * 3], nor[vi * 3 + 1], nor[vi * 3 + 2]);
    if (cj < 0 || nrm.y < -0.4) continue;
    let seed = hash3(ci * 3 + 1, cj * 7 + 2, ck * 5 + 3);
    const rnd = () => (seed = hash3(Math.floor(seed * 1e9), 17, 31));
    const count = seed < 0.25 ? 2 : seed < 0.75 ? 1 : 0;
    for (let n = 0; n < count; n++) {
      up.set(Math.abs(nrm.y) < 0.9 ? 0 : 1, Math.abs(nrm.y) < 0.9 ? 1 : 0, 0);
      t1.crossVectors(nrm, up).normalize();
      t2.crossVectors(nrm, t1);
      const phi = rnd() * Math.PI * 2, lift = 0.08 + rnd() * 0.55;
      dir.copy(t1).multiplyScalar(Math.cos(phi)).addScaledVector(t2, Math.sin(phi)).addScaledVector(nrm, lift).normalize();
      base.set(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2])
        .addScaledVector(t1, (rnd() - 0.5) * s * 0.9).addScaledVector(t2, (rnd() - 0.5) * s * 0.9).addScaledVector(nrm, -0.025);
      const len = 0.1 + rnd() * rnd() * 0.3, rad = 0.0035 + rnd() * 0.0025, sag = (rnd() - 0.3) * 0.12 * len;
      const c = STRAW[Math.floor(rnd() * STRAW.length)];
      const ao = col[vi * 3 + 1];
      p1.crossVectors(dir, nrm);
      if (p1.lengthSq() < 1e-6) p1.set(1, 0, 0);
      p1.normalize();
      p2.crossVectors(dir, p1);
      const first = pos.length / 3;
      for (let r = 0; r < 3; r++) {
        const t = r / 2, along = t * len, bow = sag * 4 * t * (1 - t);
        const cxw = base.x + dir.x * along + nrm.x * bow, cyw = base.y + dir.y * along + nrm.y * bow, czw = base.z + dir.z * along + nrm.z * bow;
        const rr = rad * (r === 2 ? 0.45 : 1);
        const light = (0.55 + 0.45 * Math.min(1, ao * 1.3)) * (0.85 + t * 0.25);
        for (let k = 0; k < 3; k++) {
          const ang = (k / 3) * Math.PI * 2;
          const ox = p1.x * Math.cos(ang) + p2.x * Math.sin(ang), oy = p1.y * Math.cos(ang) + p2.y * Math.sin(ang), oz = p1.z * Math.cos(ang) + p2.z * Math.sin(ang);
          pos.push(cxw + ox * rr, cyw + oy * rr, czw + oz * rr);
          nor.push(ox * 0.6 + nrm.x * 0.4, oy * 0.6 + nrm.y * 0.4, oz * 0.6 + nrm.z * 0.4);
          col.push(c[0] * light, c[1] * light, c[2] * light);
        }
      }
      for (let r = 0; r < 2; r++)
        for (let k = 0; k < 3; k++) {
          const a0 = first + r * 3 + k, a1 = first + r * 3 + ((k + 1) % 3), b0 = a0 + 3, b1 = a1 + 3;
          idx.push(a0, a1, b1, a0, b1, b0);
        }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.addGroup(0, surfaceIndexCount, 0);
  g.addGroup(surfaceIndexCount, idx.length - surfaceIndexCount, 1);
  g.computeBoundingSphere();
  return g;
}
