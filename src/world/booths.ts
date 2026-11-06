import * as THREE from 'three';
import { t } from '../core/i18n';
import { buildModel } from '../tools/models';
import { mulberry32 } from '../gfx/noise';
import { Kit, worldBox, tube } from './kit';
import { timber } from './geo';
import { boardTexture, priceTexture, signTexture } from './signs';

// Furniture of the hangar, after the reference: the "sell hay" kiosk with a conveyor, the supply stall,
// chalk A-frames, bollards and small clutter. Each builder works in local coordinates
// with the front facing +z; the caller places and turns it.

export interface Mats {
  beam: THREE.Material; // dark timber
  boards: THREE.Material; // vertical planks
  metal: THREE.Material; // corrugated sheet
  iron: THREE.Material;
  steel: THREE.Material; // painted blue-grey steel
  rubber: THREE.Material;
  hay: THREE.Material;
  yellow: THREE.Material;
  black: THREE.Material;
  red: THREE.Material;
  burlap: THREE.Material;
  leaf: THREE.Material;
}

const shadowed = <T extends THREE.Mesh>(m: T): T => { m.castShadow = true; m.receiveShadow = true; return m; };

/** Invisible pane that still catches the interaction ray, e.g. across an open serving window. */
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
function hitPane(kit: Kit, w: number, h: number, x: number, y: number, z: number): void {
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), hitMat);
  pane.position.set(x, y, z);
  kit.group.add(pane);
}
export { hitPane };

function signBoard(kit: Kit, m: Mats, text: string, w: number, h: number, x: number, y: number, z: number): void {
  kit.add(m.beam, timber(w + 0.08, h + 0.08, 0.05, x, y, z - 0.03));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.85 }));
  face.position.set(x, y, z);
  kit.group.add(face);
}

export function bale(kit: Kit, m: Mats, x: number, y: number, z: number, ry: number): void {
  kit.add(m.hay, new THREE.BoxGeometry(1.05, 0.48, 0.55).rotateY(ry).translate(x, y + 0.24, z));
}

/** "Sell hay" kiosk: plank booth with a serving window, slanted roof, a sign on posts and a conveyor up to the window. */
export function sellBooth(m: Mats): { kit: Kit; top: THREE.Vector3; belt: { from: THREE.Vector3; to: THREE.Vector3 } } {
  const kit = new Kit();
  const W = 3.0, D = 2.2, H = 2.5, T = 0.08, fz = D / 2 - T / 2;
  kit.add(m.boards,
    worldBox(W, H, T, 0, H / 2, -D / 2 + T / 2), worldBox(T, H, D, -W / 2 + T / 2, H / 2, 0), worldBox(T, H, D, W / 2 - T / 2, H / 2, 0),
    worldBox(W, 1.0, T, 0, 0.5, fz), worldBox(W, H - 2.05, T, 0, 2.05 + (H - 2.05) / 2, fz),
    worldBox(0.6, 1.05, T, -1.2, 1.525, fz), worldBox(0.6, 1.05, T, 1.2, 1.525, fz),
    worldBox(W - 2 * T, 0.05, D - 2 * T, 0, 0.03, 0)); // floor
  // Frame, battens, the serving ledge.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(m.beam, timber(0.12, H + 0.3, 0.12, sx * W / 2, (H + 0.3) / 2, sz * D / 2));
  kit.add(m.beam, timber(W + 0.04, 0.1, 0.05, 0, 0.22, D / 2 + 0.03), timber(0.05, 0.1, D, -W / 2 - 0.03, 0.22, 0), timber(0.05, 0.1, D, W / 2 + 0.03, 0.22, 0));
  kit.add(m.beam, timber(2.0, 0.07, 0.44, 0, 1.02, D / 2 + 0.17), timber(1.84, 0.06, 0.06, 0, 2.06, D / 2 + 0.02));
  // Roof: boards falling to the front, a fascia and braces under the overhang.
  const back = H + 0.42, front = H + 0.1, len = D + 0.7, ang = Math.atan2(back - front, len);
  kit.add(m.boards, timber(W + 0.34, 0.06, len, 0, (back + front) / 2, 0.25, 1.2, ang, 0, 0));
  kit.add(m.beam, timber(W + 0.36, 0.16, 0.05, 0, front - 0.06, D / 2 + 0.6));
  for (const sx of [-1, 1]) kit.add(m.beam, timber(0.07, 0.7, 0.07, sx * (W / 2 - 0.05), H - 0.05, D / 2 + 0.25, 1.2, -0.8, 0, 0));
  // Sign on two posts standing on the roof.
  for (const sx of [-1, 1]) kit.add(m.beam, timber(0.08, 1.05, 0.08, sx * 0.85, front + 0.45, D / 2 + 0.05));
  signBoard(kit, m, t('counter.sign'), 1.9, 0.5, 0, front + 0.62, D / 2 + 0.12);
  // Prices inside, seen through the window.
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshStandardMaterial({ map: priceTexture(), roughness: 0.95 }));
  board.position.set(0.15, 1.5, -D / 2 + T + 0.01);
  kit.group.add(board);
  kit.solid(-W / 2 - 0.05, W / 2 + 0.05, 0, H + 0.5, -D / 2 - 0.05, D / 2 + 0.4);
  // Conveyor ramp up to the right half of the window.
  const cx = 0.56, z0 = D / 2 + 0.4, z1 = D / 2 + 2.5, y0 = 1.02, y1 = 0.3;
  const L = Math.hypot(z1 - z0, y0 - y1), a = Math.atan2(y0 - y1, z1 - z0), zc = (z0 + z1) / 2, yc = (y0 + y1) / 2;
  kit.add(m.rubber, new THREE.BoxGeometry(0.5, 0.05, L).rotateX(a).translate(cx, yc, zc));
  for (const s of [-1, 1]) kit.add(m.steel, new THREE.BoxGeometry(0.05, 0.15, L + 0.12).rotateX(a).translate(cx + s * 0.28, yc + 0.02, zc));
  for (const [z, y] of [[z0, y0], [z1, y1]]) kit.add(m.steel, new THREE.CylinderGeometry(0.065, 0.065, 0.6, 12).rotateZ(Math.PI / 2).translate(cx, y - 0.02, z));
  for (const s of [-1, 1]) {
    kit.add(m.steel, new THREE.BoxGeometry(0.05, y0 - 0.05, 0.05).translate(cx + s * 0.26, (y0 - 0.05) / 2, z0 + 0.15));
    kit.add(m.steel, new THREE.BoxGeometry(0.05, y1 - 0.05, 0.05).translate(cx + s * 0.26, (y1 - 0.05) / 2, z1 - 0.15));
    kit.add(m.steel, new THREE.BoxGeometry(0.16, 0.03, 0.16).translate(cx + s * 0.26, 0.015, z1 - 0.15));
  }
  kit.add(m.iron, new THREE.BoxGeometry(0.22, 0.2, 0.3).translate(cx + 0.42, 0.62, z0 + 0.25)); // motor
  kit.solid(cx - 0.32, cx + 0.32, 0, 0.8, z0, z1 + 0.05);
  // Bales by the side.
  bale(kit, m, -W / 2 - 0.7, 0, D / 2 - 0.2, Math.PI / 2 + 0.05);
  bale(kit, m, -W / 2 - 0.68, 0.48, D / 2 - 0.25, Math.PI / 2 - 0.08);
  bale(kit, m, -W / 2 - 0.75, 0, D / 2 + 0.45, Math.PI / 2 - 0.15);
  kit.solid(-W / 2 - 1.0, -W / 2 - 0.4, 0, 0.96, D / 2 - 0.75, D / 2 + 1.0);
  hitPane(kit, 2.0, 1.2, 0, 1.55, D / 2 + 0.05); // looking in through the window still counts
  // The conveyor path for cargo: from the low outer end up to the window sill.
  return { kit, top: new THREE.Vector3(0, 1.1, D / 2 + 0.2), belt: { from: new THREE.Vector3(cx, y1, z1), to: new THREE.Vector3(cx, y0, z0) } };
}

/** Supply stall: counter under a red-trimmed awning, the price board on the back wall, a closed store room on the right. */
export function supplyStall(m: Mats): Kit {
  const kit = new Kit();
  const W = 5.0, D = 2.6, bz = -D / 2 + 0.04, fz = D / 2;
  kit.add(m.boards, worldBox(W, 3.0, 0.08, 0, 1.5, bz));
  // Store room on the right.
  kit.add(m.boards, worldBox(1.4, 2.6, 0.08, 1.8, 1.3, fz - 0.04), worldBox(0.08, 2.6, D, 2.46, 1.3, 0), worldBox(0.08, 2.6, D, 1.14, 1.3, 0));
  kit.add(m.beam, timber(1.5, 0.08, D + 0.06, 1.8, 2.64, 0), timber(0.06, 2.1, 0.06, 1.55, 1.05, fz + 0.01), timber(0.5, 0.06, 0.04, 1.8, 1.35, fz + 0.01));
  // Posts, awning, red fascia, sign.
  for (const x of [-W / 2 + 0.06, 1.1]) kit.add(m.beam, timber(0.12, 2.95, 0.12, x, 1.475, fz - 0.06));
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) kit.add(m.beam, timber(0.12, 3.05, 0.12, x, 1.525, bz));
  const back = 3.1, front = 2.92, len = D + 0.5, ang = Math.atan2(back - front, len);
  kit.add(m.boards, timber(W + 0.24, 0.06, len, 0, (back + front) / 2, 0.25, 1.2, ang, 0, 0));
  kit.add(m.red, timber(W + 0.26, 0.18, 0.05, 0, front - 0.08, fz + 0.5));
  kit.add(m.beam, timber(W, 0.12, 0.12, 0, 2.9, fz - 0.06));
  for (const x of [-1.2, 0.6]) kit.add(m.beam, timber(0.08, 0.85, 0.08, x, front + 0.38, fz + 0.1));
  signBoard(kit, m, t('shop.sign'), 2.5, 0.6, -0.3, front + 0.55, fz + 0.17);
  // Counter with a few goods.
  kit.add(m.boards, worldBox(3.4, 0.9, 0.55, -0.66, 0.45, fz - 0.42));
  kit.add(m.beam, timber(3.5, 0.06, 0.64, -0.66, 0.93, fz - 0.42));
  const bucket = buildModel('bucket');
  bucket.position.set(-1.9, 0.96, fz - 0.42);
  bucket.rotation.y = 0.6;
  const shovel = buildModel('toy_shovel');
  shovel.position.set(0.2, 0.98, fz - 0.4);
  shovel.rotation.set(Math.PI / 2, 0, 1.2, 'YXZ');
  kit.group.add(bucket, shovel);
  kit.add(m.boards, worldBox(0.42, 0.3, 0.32, -0.2, 1.11, fz - 0.45, 0.8));
  // Price board on the back wall.
  kit.add(m.beam, timber(2.0, 1.28, 0.05, -0.75, 1.9, bz + 0.07));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.19), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.9 }));
  face.position.set(-0.75, 1.9, bz + 0.1);
  kit.group.add(face);
  // Shelves on the left with jars and boxes.
  for (const y of [1.25, 1.85]) {
    kit.add(m.beam, timber(0.62, 0.04, 0.34, -2.1, y, bz + 0.2));
    kit.add(m.boards, worldBox(0.22, 0.2, 0.22, -2.25, y + 0.12, bz + 0.2, 0.8), worldBox(0.18, 0.16, 0.2, -1.95, y + 0.1, bz + 0.22, 0.8));
  }
  // Out front: a wheelbarrow and a sack.
  const barrow = buildModel('wheelbarrow');
  barrow.position.set(0.1, 0, fz + 1.15);
  barrow.rotation.y = 1.9;
  barrow.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  kit.group.add(barrow);
  kit.add(m.burlap, new THREE.SphereGeometry(0.3, 14, 10).scale(1, 1.35, 0.85).translate(1.65, 0.38, fz + 0.75));
  kit.solid(-W / 2, W / 2, 0, 3.2, -D / 2, -D / 2 + 0.12);
  kit.solid(1.1, 2.5, 0, 2.7, -D / 2, fz);
  kit.solid(-2.4, 1.1, 0, 0.96, fz - 0.72, fz - 0.1);
  kit.solid(-0.6, 0.8, 0, 0.7, fz + 0.6, fz + 1.75);
  kit.solid(1.35, 1.95, 0, 0.8, fz + 0.5, fz + 1.0);
  hitPane(kit, 3.6, 2.0, -0.7, 1.9, fz - 0.1); // the open front over the counter
  return kit;
}

/** Chalk A-frame sign with `face` on the front leaf. */
export function aFrame(m: Mats, face: THREE.Texture | null): Kit {
  const kit = new Kit();
  for (const side of [1, -1]) {
    const g = timber(0.62, 0.92, 0.025, 0, 0.46, 0).rotateX(-side * 0.24).translate(0, 0, side * 0.22);
    kit.add(m.beam, g);
  }
  const mat = face ? new THREE.MeshStandardMaterial({ map: face, roughness: 0.95 }) : new THREE.MeshStandardMaterial({ color: '#1c2023', roughness: 0.95 });
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.82), mat);
  leaf.position.set(0, 0.46, 0.125);
  leaf.rotation.x = -0.24;
  kit.group.add(leaf);
  kit.solid(-0.36, 0.36, 0, 0.95, -0.3, 0.3);
  return kit;
}

/** Yellow steel bollard with black bands. */
export function bollard(m: Mats, kit: Kit, x: number, z: number): void {
  kit.add(m.yellow, new THREE.CylinderGeometry(0.12, 0.12, 1.0, 16).translate(x, 0.5, z), new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, 1.0, z));
  for (const y of [0.62, 0.8]) kit.add(m.black, new THREE.CylinderGeometry(0.124, 0.124, 0.08, 16).translate(x, y, z));
  kit.add(m.yellow, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16).translate(x, 0.015, z));
  kit.solid(x - 0.15, x + 0.15, 0, 1.1, z - 0.15, z + 0.15);
}

/** Survey tripod. */
export function tripod(m: Mats, kit: Kit, x: number, z: number): void {
  const head = new THREE.Vector3(x, 1.45, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    kit.add(m.iron, tube([head, new THREE.Vector3(x + Math.cos(a) * 0.5, 0, z + Math.sin(a) * 0.5)], 0.02, 2, 6));
  }
  kit.add(m.iron, new THREE.BoxGeometry(0.16, 0.08, 0.16).translate(x, 1.48, z), new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6).translate(x, 1.7, z));
  kit.solid(x - 0.35, x + 0.35, 0, 1.6, z - 0.35, z + 0.35);
}

/** Fern in a galvanised tub standing on a crate. */
export function fernPot(m: Mats, kit: Kit, x: number, z: number, crate: THREE.Material): void {
  kit.add(crate, worldBox(0.7, 0.55, 0.7, x, 0.275, z, 0.8));
  kit.add(m.beam, timber(0.72, 0.06, 0.06, x, 0.52, z + 0.33), timber(0.72, 0.06, 0.06, x, 0.52, z - 0.33));
  const prof = [[0, 0], [0.24, 0], [0.3, 0.32], [0.31, 0.34], [0.29, 0.34]].map(([a, b]) => new THREE.Vector2(a, b));
  kit.add(m.steel, new THREE.LatheGeometry(prof, 20).translate(x, 0.55, z));
  const rnd = mulberry32(12);
  const fronds: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rnd() * 0.3, len = 0.5 + rnd() * 0.3, lift = 0.5 + rnd() * 0.5;
    const g = new THREE.PlaneGeometry(0.1, len, 1, 6);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const v = (p.getY(k) + len / 2) / len; // 0 at the root
      const w = p.getX(k) * (1 - v * 0.85);
      p.setXYZ(k, w, Math.sin(v * 1.6) * lift * len * 0.8 - v * v * 0.25, v * len);
    }
    g.computeVertexNormals();
    fronds.push(g.rotateY(a).translate(x, 0.86, z));
  }
  kit.add(m.leaf, ...fronds);
  kit.solid(x - 0.36, x + 0.36, 0, 0.9, z - 0.36, z + 0.36);
}

export { shadowed };
