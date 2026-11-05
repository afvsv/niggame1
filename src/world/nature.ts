import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Noise, mulberry32 } from '../gfx/noise';
import { Textures } from '../gfx/assets';
import { triplanarMaterial } from '../gfx/triplanar';
import { Colliders } from './colliders';
import { timber } from './geo';

/** Hangar half-sizes in metres: x across (roofed long walls at ±x), z along (open-topped end walls). */
export const BARN = { hx: 15, hz: 22 };
/** The roll-up exit door in the +x wall: centre z and half width. */
export const EXIT = { z: 2.75, halfW: 2.59 };
export const FENCE = { minX: -30, maxX: 64, minZ: -36, maxZ: 36 };

/** Outside the hangar: meadow, swaying grass, fence, trees, round bales and distant hills. */
export class Nature {
  readonly group = new THREE.Group();
  /** Grass patches, for the quality settings. */
  readonly grassPatches: THREE.InstancedMesh[] = [];
  /** All grass; hidden while the door is shut (the walls hide it). */
  readonly grassGroup: THREE.Group;
  private readonly time = { value: 0 };

  constructor(tex: Textures, colliders: Colliders, beamMat: THREE.Material, hayMat: THREE.Material) {
    const rnd = mulberry32(77);
    // Meadow.
    // The meadow has a hole under the hangar so it can never z-fight with its floor.
    const shape = new THREE.Shape([new THREE.Vector2(-450, -450), new THREE.Vector2(450, -450), new THREE.Vector2(450, 450), new THREE.Vector2(-450, 450)]);
    const X = BARN.hx - 0.1, Z = BARN.hz - 0.1;
    shape.holes.push(new THREE.Path([new THREE.Vector2(-X, -Z), new THREE.Vector2(-X, Z), new THREE.Vector2(X, Z), new THREE.Vector2(X, -Z)]));
    const meadow = new THREE.Mesh(
      new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2),
      triplanarMaterial({ set: tex.grass, tile: 2.4, variation: tex.variation, variationTile: 23, brightness: 0.4, tint: '#d8c27a', tintAmount: 0.5, topOnly: true }),
    );
    meadow.receiveShadow = true;
    this.group.add(meadow);
    this.grassGroup = this.grass(rnd);
    this.group.add(this.grassGroup, this.hills(), this.mountains(), this.trees(rnd), this.fence(beamMat, colliders));
    this.bales(hayMat, colliders);
  }

  update(dt: number): void { this.time.value += dt; }

  /** Swaying grass clumps, densest by the door, split into patches so off-screen ones are culled. */
  private grass(rnd: () => number): THREE.Group {
    // A clump of bent blades, darker at the root.
    const pos: number[] = [], col: number[] = [], nor: number[] = [], idx: number[] = [];
    for (let b = 0; b < 5; b++) {
      const a = rnd() * Math.PI * 2, lean = 0.15 + rnd() * 0.3, h = 0.12 + rnd() * 0.2, w = 0.012 + rnd() * 0.008;
      const ox = (rnd() - 0.5) * 0.16, oz = (rnd() - 0.5) * 0.16;
      const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
      const base = pos.length / 3;
      for (let r = 0; r < 3; r++) {
        const t = r / 2, ww = w * (1 - t * 0.7), y = h * t, off = lean * h * t * t;
        pos.push(ox + dx * off - px * ww, y, oz + dz * off - pz * ww, ox + dx * off + px * ww, y, oz + dz * off + pz * ww);
        const k = 0.25 + t * 0.75;
        for (let j = 0; j < 2; j++) { col.push(k, k, k); nor.push(dx * 0.3, 1, dz * 0.3); }
      }
      const tip = pos.length / 3;
      pos.push(ox + dx * lean * h * 1.3, h * 1.15, oz + dz * lean * h * 1.3);
      col.push(1, 1, 1); nor.push(dx * 0.3, 1, dz * 0.3);
      idx.push(base, base + 1, base + 3, base, base + 3, base + 2, base + 2, base + 3, base + 5, base + 2, base + 5, base + 4, base + 4, base + 5, tip);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
    const time = this.time;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float sway = sin(uTime * 1.6 + root.x * 0.35 + root.z * 0.22) + 0.5 * sin(uTime * 2.7 + root.z * 0.9);
transformed.xz += vec2(0.7, 0.35) * sway * 0.05 * position.y * position.y * 16.0;`);
      // Both sides of a blade are lit like its front.
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
    };
    const PATCH = 8;
    const patches = new Map<string, THREE.Matrix4[]>();
    const colors = new Map<string, THREE.Color[]>();
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sv = new THREE.Vector3(), p = new THREE.Vector3();
    const greens = ['#5f8a2c', '#6e9a33', '#4f7a26', '#80a23c', '#93a046', '#6b8f30'].map((c) => new THREE.Color(c));
    let placed = 0;
    for (let n = 0; n < 90000 && placed < 14000; n++) {
      const x = FENCE.minX - 6 + rnd() * (FENCE.maxX - FENCE.minX + 22), z = FENCE.minZ - 6 + rnd() * (FENCE.maxZ - FENCE.minZ + 12);
      if (Math.abs(x) < BARN.hx + 0.5 && Math.abs(z) < BARN.hz + 0.5) continue;
      if (Math.abs(z - EXIT.z) < 3.6 && x > BARN.hx && x < BARN.hx + 5 && rnd() < 0.85) continue; // trodden path at the door
      const d = Math.hypot(x - BARN.hx, z - EXIT.z); // thinner further from the door
      if (rnd() > 1.4 - d / 34) continue;
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      const sc = 0.7 + rnd() * 0.6;
      sv.set(sc, sc * (0.7 + rnd() * 0.6), sc);
      p.set(x, 0, z);
      const key = `${Math.floor(x / PATCH)},${Math.floor(z / PATCH)}`;
      if (!patches.has(key)) { patches.set(key, []); colors.set(key, []); }
      patches.get(key)!.push(new THREE.Matrix4().compose(p, q, sv));
      colors.get(key)!.push(greens[Math.floor(rnd() * greens.length)].clone().multiplyScalar(0.8 + rnd() * 0.35));
      placed++;
    }
    const group = new THREE.Group();
    for (const [key, ms] of patches) {
      const mesh = new THREE.InstancedMesh(geo, mat, ms.length);
      const cs = colors.get(key)!;
      ms.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, cs[i]); });
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      group.add(mesh);
      this.grassPatches.push(mesh);
    }
    return group;
  }

  private hills(): THREE.Mesh {
    const N = new Noise(5);
    const seg = 128, rings = 8, r0 = 120, r1 = 340;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const near = new THREE.Color('#5a7a36'), far = new THREE.Color('#7a9682');
    for (let r = 0; r <= rings; r++) {
      const t = r / rings, rad = r0 + (r1 - r0) * t;
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        const h = (N.fbm((s / seg) * 6, t * 2, 4, 6, 256) * 0.5 + 0.5) * (14 + t * 42) * Math.min(1, t * 4);
        pos.push(Math.cos(a) * rad, h - 2, Math.sin(a) * rad);
        const c = near.clone().lerp(far, t);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let r = 0; r < rings; r++)
      for (let s = 0; s < seg; s++) {
        const a = r * (seg + 1) + s, b = a + seg + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  }

  /** Pale jagged mountains far away, seen over the hangar walls like in the reference: flat, unlit, no fog. */
  private mountains(): THREE.Mesh {
    const N = new Noise(23);
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const layers = [{ r: 450, h: [70, 150], c: '#dfe3e8', top: '#f4f6f8', f: 9 }, { r: 410, h: [45, 105], c: '#c9ced6', top: '#e6e9ee', f: 14 }];
    for (const L of layers) {
      const seg = 360, base = pos.length / 3, lo = new THREE.Color(L.c), hi = new THREE.Color(L.top);
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        const n = N.fbm((s / seg) * L.f, L.r * 0.01, 4, L.f, 256) * 0.5 + 0.5;
        const ridge = 1 - Math.abs(N.perlin((s / seg) * L.f * 3, 3.3, L.f * 3, 256)); // sharp peaks
        const h = L.h[0] + (L.h[1] - L.h[0]) * Math.min(1, n * 0.7 + ridge * ridge * 0.5);
        const x = Math.cos(a) * L.r, z = Math.sin(a) * L.r;
        pos.push(x, -20, z, x, h, z);
        col.push(lo.r * 0.86, lo.g * 0.86, lo.b * 0.88, hi.r, hi.g, hi.b);
      }
      for (let s = 0; s < seg; s++) {
        const a = base + s * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -5;
    return m;
  }

  private trees(rnd: () => number): THREE.Group {
    const trunks: THREE.BufferGeometry[] = [], crowns: THREE.BufferGeometry[] = [];
    const leaf = ['#3f6a26', '#4c7a2c', '#355d22', '#5a8530'].map((c) => new THREE.Color(c));
    const trunkCol = new THREE.Color('#4a3a2a');
    const paint = (g: THREE.BufferGeometry, c: THREE.Color) => {
      const n = g.getAttribute('position').count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const k = 0.85 + rnd() * 0.3; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return g;
    };
    let placed = 0;
    for (let guard = 0; placed < 46 && guard < 1000; guard++) {
      const a = rnd() * Math.PI * 2, r = 48 + Math.pow(rnd(), 0.7) * 100;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(z - EXIT.z) < 20 && x > 0 && x < 90) continue; // keep the view from the door open
      const sc = 0.8 + rnd() * 0.7, th = 3.2 * sc;
      trunks.push(paint(new THREE.CylinderGeometry(0.16 * sc, 0.3 * sc, th, 7).translate(x, th / 2, z), trunkCol));
      const c = leaf[Math.floor(rnd() * leaf.length)];
      const blobs = 4 + Math.floor(rnd() * 3);
      for (let b = 0; b < blobs; b++) {
        const g = new THREE.IcosahedronGeometry((1.5 + rnd() * 1.1) * sc, 1);
        const p = g.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.9 + rnd() * 0.2), p.getY(i) * (0.85 + rnd() * 0.2), p.getZ(i) * (0.9 + rnd() * 0.2));
        g.translate(x + (rnd() - 0.5) * 2.6 * sc, th + (0.6 + rnd() * 1.8) * sc, z + (rnd() - 0.5) * 2.6 * sc);
        crowns.push(paint(g.index ? g.toNonIndexed() : g, c));
      }
      placed++;
    }
    const group = new THREE.Group();
    const strip = (gs: THREE.BufferGeometry[]) => gs.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; });
    const trunkMesh = new THREE.Mesh(mergeGeometries(strip(trunks)), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    const crownGeo = mergeGeometries(strip(crowns));
    crownGeo.computeVertexNormals();
    const crownMesh = new THREE.Mesh(crownGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
    group.add(trunkMesh, crownMesh);
    return group;
  }

  private fence(beamMat: THREE.Material, colliders: Colliders): THREE.Mesh {
    const parts: THREE.BufferGeometry[] = [];
    const F = FENCE, step = 2.4;
    const side = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / step), ang = Math.atan2(z1 - z0, x1 - x0);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        parts.push(timber(0.14, 1.35, 0.14, x, 0.62, z, 1.2, 0, (i * 0.37) % 0.3, ((i * 0.53) % 0.1) - 0.05));
      }
      for (const y of [0.55, 1.05]) parts.push(timber(len, 0.1, 0.05, (x0 + x1) / 2, y, (z0 + z1) / 2, 1.2, 0, -ang, 0));
      colliders.addBox({ minX: Math.min(x0, x1) - 0.1, maxX: Math.max(x0, x1) + 0.1, minY: 0, maxY: 3, minZ: Math.min(z0, z1) - 0.1, maxZ: Math.max(z0, z1) + 0.1 });
    };
    side(F.minX, F.minZ, F.maxX, F.minZ);
    side(F.minX, F.maxZ, F.maxX, F.maxZ);
    side(F.minX, F.minZ, F.minX, F.maxZ);
    side(F.maxX, F.minZ, F.maxX, F.maxZ);
    const m = new THREE.Mesh(mergeGeometries(parts), beamMat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  private bales(hayMat: THREE.Material, colliders: Colliders): void {
    const geo = new THREE.CylinderGeometry(0.75, 0.75, 1.2, 28, 1);
    geo.rotateZ(Math.PI / 2);
    const spots: Array<[number, number, number, number]> = [[25.6, 0.75, 13.2, 1.7], [24.4, 0.75, 14.9, 1.3], [25.0, 2.05, 14.1, 1.6], [29.5, 0.75, -16, 2.6], [-21, 0.75, 27, 0.5]];
    for (const [x, y, z, r] of spots) {
      const m = new THREE.Mesh(geo, hayMat);
      m.position.set(x, y, z);
      m.rotation.y = r;
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      if (y < 1) colliders.addBox({ minX: x - 0.8, maxX: x + 0.8, minY: 0, maxY: 1.5, minZ: z - 0.8, maxZ: z + 0.8 });
    }
  }
}
