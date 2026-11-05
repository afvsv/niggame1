import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AABB } from './colliders';

/**
 * Box whose UVs come from its final world position: side faces map (horizontal, y), tops map (x, z).
 * Boards, siding and concrete keep their pattern upright and continuous across neighbouring boxes.
 */
export function worldBox(w: number, h: number, d: number, x: number, y: number, z: number, tile = 1.6, ry = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  return projectUV(g.translate(x, y, z), tile);
}

/** Planar UVs from world position, picked per vertex by the normal: walls (horizontal, y), floors (x, z). */
export function projectUV(g: THREE.BufferGeometry, tile: number): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    if (ny > 0.5) uv.setXY(i, px / tile, pz / tile);
    else if (nx > 0.5) uv.setXY(i, pz / tile, py / tile);
    else uv.setXY(i, px / tile, py / tile);
  }
  return g;
}

/** A slab of `depth` from an outline in (x, y), centred on z = 0, with world-projected UVs once placed. */
export function prism(outline: Array<[number, number]>, depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: false });
  g.clearGroups();
  return g.translate(0, 0, -depth / 2);
}

/** Collects geometry per material and local collision boxes, then merges them into a placed group. */
export class Kit {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private readonly solids: Array<[number, number, number, number, number, number]> = [];
  readonly group = new THREE.Group();

  add(mat: THREE.Material, ...geos: THREE.BufferGeometry[]): this {
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat)!.push(...geos);
    return this;
  }

  /** A solid box in local coordinates. */
  solid(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): this {
    this.solids.push([x0, x1, y0, y1, z0, z1]);
    return this;
  }

  /** Merges the geometry, moves the group to (x, z) turned by `ry` and registers the colliders. */
  place(parent: THREE.Object3D, addBox: (b: AABB) => void, x: number, z: number, ry = 0, shadows = true): THREE.Group {
    for (const [mat, geos] of this.parts) {
      const m = new THREE.Mesh(mergeGeometries(geos.map(normalise)), mat);
      m.castShadow = shadows;
      m.receiveShadow = true;
      this.group.add(m);
    }
    this.group.position.set(x, 0, z);
    this.group.rotation.y = ry;
    parent.add(this.group);
    this.group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const [x0, x1, y0, y1, z0, z1] of this.solids) {
      const b: AABB = { minX: Infinity, maxX: -Infinity, minY: y0, maxY: y1, minZ: Infinity, maxZ: -Infinity };
      for (const cx of [x0, x1]) for (const cz of [z0, z1]) {
        v.set(cx, 0, cz).applyMatrix4(this.group.matrixWorld);
        b.minX = Math.min(b.minX, v.x); b.maxX = Math.max(b.maxX, v.x);
        b.minZ = Math.min(b.minZ, v.z); b.maxZ = Math.max(b.maxZ, v.z);
      }
      addBox(b);
    }
    return this.group;
  }
}

/** mergeGeometries needs the same attributes everywhere: indexed, position + normal + uv. */
function normalise(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g : g.setIndex([...Array(g.getAttribute('position').count).keys()]);
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name);
  if (!out.getAttribute('uv')) out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.getAttribute('position').count * 2), 2));
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  return out;
}

/** Steel tube along a list of points. */
export function tube(points: THREE.Vector3[], r: number, segs = 32, radial = 8): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segs, r, radial, false);
}
