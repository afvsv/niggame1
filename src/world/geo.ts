import * as THREE from 'three';

/** Scales the UVs of a geometry, e.g. so one texture repeat covers `tile` metres. */
export function scaleUV(geo: THREE.BufferGeometry, su: number, sv: number, ou = 0, ov = 0): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
  uv.needsUpdate = true;
  return geo;
}

/**
 * Box with UVs in metres / tile, grain (v) running along the longest side of each face.
 * Placed and rotated by the given transform so many boxes can be merged into one mesh.
 */
export function timber(w: number, h: number, d: number, x: number, y: number, z: number, tile = 1.2, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const dims = [w, h, d];
  const long = dims.indexOf(Math.max(w, h, d));
  const off = (x * 7.13 + y * 3.71 + z * 5.37) % 1; // vary the texture between boxes
  for (let i = 0; i < p.count; i++) {
    const c = [p.getX(i), p.getY(i), p.getZ(i)];
    const ax = Math.abs(n.getX(i)) > 0.5 ? 0 : Math.abs(n.getY(i)) > 0.5 ? 1 : 2;
    const t = [0, 1, 2].filter((a) => a !== ax);
    let ua = t[0], va = t[1];
    if (ua === long) { ua = t[1]; va = t[0]; }
    uv.setXY(i, c[ua] / tile + off, c[va] / tile + off * 3.1);
  }
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/** Cheap tileable-free hash in [0, 1). */
export function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
