import * as THREE from 'three';

/** One straw along +X from 0 to 1 with radius 1: a bent three-sided tube (9 vertices). */
export function strawGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let r = 0; r < 3; r++) {
    const t = r / 2, bow = 0.06 * 4 * t * (1 - t) * 8, rr = r === 2 ? 0.5 : 1;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      pos.push(t, Math.cos(a) * rr + bow, Math.sin(a) * rr);
      nor.push(0, Math.cos(a) * 0.7 + 0.5, Math.sin(a) * 0.7);
    }
  }
  for (let r = 0; r < 2; r++)
    for (let k = 0; k < 3; k++) {
      const a0 = r * 3 + k, a1 = r * 3 + ((k + 1) % 3);
      idx.push(a0, a1, a1 + 3, a0, a1 + 3, a0 + 3);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

const COLORS = ['#e3c47a', '#d6b060', '#c09445', '#efdb9c', '#a98a46', '#b99b58'].map((c) => new THREE.Color(c));

/**
 * Loose straws lying on the barn floor: a thick skirt around the stack base,
 * a trail towards the counter and a light sprinkle everywhere else.
 */
export function floorStraws(count: number, stackRadius: number, rnd: () => number, area: { hx: number; hz: number; counter: [number, number] }): THREE.InstancedMesh {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const mesh = new THREE.InstancedMesh(strawGeometry(), mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const kind = rnd();
    let x: number, z: number;
    if (kind < 0.62) { // skirt
      const a = rnd() * Math.PI * 2, r = stackRadius - 0.6 + Math.pow(rnd(), 1.8) * 3.6;
      x = Math.cos(a) * r; z = Math.sin(a) * r;
    } else if (kind < 0.8) { // trail to the counter
      const t = rnd(), [cx, cz] = area.counter;
      const sx = cx * (stackRadius / Math.hypot(cx, cz)), sz = cz * (stackRadius / Math.hypot(cx, cz));
      x = sx + t * (cx - sx) + (rnd() - 0.5) * 2.2; z = sz + t * (cz - sz - 0.8) + (rnd() - 0.5) * 1.6;
    } else { // sprinkle
      x = (rnd() - 0.5) * 2 * (area.hx - 0.3); z = (rnd() - 0.5) * 2 * (area.hz - 0.3);
    }
    const len = 0.08 + rnd() * 0.22, rad = 0.003 + rnd() * 0.002;
    e.set((rnd() - 0.5) * 0.25, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.2);
    q.setFromEuler(e);
    p.set(x, rad + rnd() * 0.012, z);
    s.set(len, rad, rad);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    c.copy(COLORS[Math.floor(rnd() * COLORS.length)]).multiplyScalar(0.75 + rnd() * 0.3);
    mesh.setColorAt(i, c);
  }
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
