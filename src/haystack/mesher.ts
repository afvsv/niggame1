import * as THREE from 'three';
import { CHUNK, HayGrid } from './grid';

// Face directions: axis (0=x,1=y,2=z) and sign. u/v are the other two axes in cyclic order,
// so corners (0,0),(1,0),(1,1),(0,1) are counter-clockwise when seen from the +axis side.
const FACES = [
  { a: 0, s: 1 }, { a: 0, s: -1 },
  { a: 1, s: 1 }, { a: 1, s: -1 },
  { a: 2, s: 1 }, { a: 2, s: -1 },
] as const;
const CORNERS_POS: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
const CORNERS_NEG: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, 1], [1, 1], [1, 0]];
const AO_CURVE = [0.42, 0.62, 0.8, 1.0];
const TEX_TILE_M = 0.8;

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Builds one chunk mesh with face culling and per-vertex ambient occlusion. */
export function buildChunkGeometry(grid: HayGrid, cx: number, cy: number, cz: number): THREE.BufferGeometry | null {
  const solid = (x: number, y: number, z: number): number => (y < 0 ? 1 : grid.get(x, y, z) > 0 ? 1 : 0);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const s = grid.cellSize;
  const x0 = cx * CHUNK, y0 = cy * CHUNK, z0 = cz * CHUNK;
  const x1 = Math.min(grid.nx, x0 + CHUNK), y1 = Math.min(grid.ny, y0 + CHUNK), z1 = Math.min(grid.nz, z0 + CHUNK);
  const c = [0, 0, 0], n = [0, 0, 0], p = [0, 0, 0], q = [0, 0, 0];
  let vcount = 0;

  for (let y = y0; y < y1; y++)
    for (let z = z0; z < z1; z++)
      for (let x = x0; x < x1; x++) {
        const fill = grid.get(x, y, z);
        if (fill === 0) continue;
        c[0] = x; c[1] = y; c[2] = z;
        const h = hash3(x, y, z);
        const shade = (0.86 + h * 0.2) * (0.9 + 0.1 * (fill / grid.cellMax));
        const tint = 0.96 + hash3(z, x, y) * 0.08;
        for (const f of FACES) {
          n[0] = 0; n[1] = 0; n[2] = 0; n[f.a] = f.s;
          if (solid(x + n[0], y + n[1], z + n[2])) continue;
          const u = (f.a + 1) % 3, v = (f.a + 2) % 3;
          const corners = f.s > 0 ? CORNERS_POS : CORNERS_NEG;
          const ao: number[] = [];
          for (const [cu, cv] of corners) {
            // Air layer in front of the face.
            p[0] = c[0] + n[0]; p[1] = c[1] + n[1]; p[2] = c[2] + n[2];
            q[0] = p[0]; q[1] = p[1]; q[2] = p[2]; q[u] += cu ? 1 : -1;
            const s1 = solid(q[0], q[1], q[2]);
            q[0] = p[0]; q[1] = p[1]; q[2] = p[2]; q[v] += cv ? 1 : -1;
            const s2 = solid(q[0], q[1], q[2]);
            q[u] += cu ? 1 : -1;
            const sc = solid(q[0], q[1], q[2]);
            const a = s1 && s2 ? 0 : 3 - (s1 + s2 + sc);
            ao.push(a);
            // Vertex position.
            q[0] = c[0]; q[1] = c[1]; q[2] = c[2];
            q[f.a] += f.s > 0 ? 1 : 0; q[u] += cu; q[v] += cv;
            const wx = grid.originX + q[0] * s, wy = grid.originY + q[1] * s, wz = grid.originZ + q[2] * s;
            pos.push(wx, wy, wz);
            nor.push(n[0], n[1], n[2]);
            const wu = [wx, wy, wz][u], wv = [wx, wy, wz][v];
            uv.push(wu / TEX_TILE_M, wv / TEX_TILE_M);
            const b = AO_CURVE[a] * shade;
            col.push(b * tint, b, b * (2 - tint));
          }
          if (ao[0] + ao[2] >= ao[1] + ao[3]) idx.push(vcount, vcount + 1, vcount + 2, vcount, vcount + 2, vcount + 3);
          else idx.push(vcount + 1, vcount + 2, vcount + 3, vcount + 1, vcount + 3, vcount);
          vcount += 4;
        }
      }

  if (vcount === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(vcount > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
