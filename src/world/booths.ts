import * as THREE from 'three';
import { t } from '../core/i18n';
import { buildModel } from '../tools/models';
import { mulberry32 } from '../gfx/noise';
import { itemById } from '../data/tools';
import { Kit, worldBox } from './kit';
import { timber } from './geo';
import { bigSignTexture, dialTexture, priceTexture, signTextureLight, tagTexture } from './signs';

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

export function bale(kit: Kit, m: Mats, x: number, y: number, z: number, ry: number): void {
  kit.add(m.hay, new THREE.BoxGeometry(1.05, 0.48, 0.55).rotateY(ry).translate(x, y + 0.24, z));
}

/** "Sell hay" kiosk: plank booth with a serving window, a wide sign, a stocked interior,
 *  the Z-shaped conveyor up to the window, a HAY IN gantry at its low end and a platform scale. */
export function sellBooth(m: Mats): { kit: Kit; top: THREE.Vector3; belt: { points: THREE.Vector3[] } } {
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
  // Wide sign across the whole front, like the reference.
  kit.add(m.beam, timber(W + 0.1, 0.78, 0.05, 0, front + 0.72, D / 2 + 0.16));
  const bigSign = new THREE.Mesh(new THREE.PlaneGeometry(2.95, 0.72), new THREE.MeshStandardMaterial({ map: bigSignTexture(t('counter.sign').toUpperCase()), roughness: 0.85 }));
  bigSign.position.set(0, front + 0.72, D / 2 + 0.19);
  kit.group.add(bigSign);
  // Interior, seen through the window: shelves with jars, a register and the price card.
  const inner = -D / 2 + T + 0.06;
  for (const y of [1.32, 1.78]) kit.add(m.beam, timber(1.6, 0.05, 0.3, -0.4, y, inner + 0.16));
  for (const [x, y] of [[-1.0, 1.46], [-0.75, 1.46], [-0.5, 1.92], [0.1, 1.46], [0.35, 1.46]]) {
    kit.add(m.black, new THREE.CylinderGeometry(0.075, 0.075, 0.26, 10).translate(x, y, inner + 0.16)); // jars
  }
  kit.add(m.boards, worldBox(0.34, 0.2, 0.24, -0.05, 1.53, inner + 0.16, 0.6), worldBox(0.3, 0.18, 0.22, 0.5, 1.98, inner + 0.16, -0.3));
  const register = new THREE.Group(); // a simple till on the counter inside
  register.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.26), m.iron));
  const keys = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), new THREE.MeshStandardMaterial({ color: '#6b6257', roughness: 0.6 }));
  keys.position.set(0, 0.1, 0.02);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshBasicMaterial({ map: dialTexture(), toneMapped: false }));
  led.position.set(0, 0.115, -0.1);
  led.rotation.x = -0.9;
  register.add(keys, led);
  register.position.set(0.55, 1.1, inner + 0.2);
  register.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  kit.group.add(register);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshStandardMaterial({ map: priceTexture(), roughness: 0.95 }));
  board.position.set(-0.75, 1.5, -D / 2 + T + 0.01);
  kit.group.add(board);
  kit.solid(-W / 2 - 0.05, W / 2 + 0.05, 0, H + 0.5, -D / 2 - 0.05, D / 2 + 0.4);
  // Z-shaped conveyor: a long flat run at waist height, then the climb to the window sill.
  const cx = 0.56;
  const p0 = new THREE.Vector3(cx, 0.3, D / 2 + 4.6); // low outer end
  const p1 = new THREE.Vector3(cx, 0.3, D / 2 + 2.5); // the knee
  const p2 = new THREE.Vector3(cx, 1.02, D / 2 + 0.4); // the window sill
  const flatL = p1.z - p0.z, rampL = Math.hypot(p2.z - p1.z, p2.y - p1.y);
  kit.add(m.rubber, new THREE.BoxGeometry(0.5, 0.05, flatL + 0.1).translate(cx, 0.285, (p0.z + p1.z) / 2));
  for (const s of [-1, 1]) kit.add(m.steel, new THREE.BoxGeometry(0.05, 0.15, flatL + 0.2).translate(cx + s * 0.28, 0.305, (p0.z + p1.z) / 2));
  for (const z of [p0.z + 0.15, (p0.z + p1.z) / 2, p1.z - 0.15]) for (const s of [-1, 1]) {
    kit.add(m.steel, new THREE.BoxGeometry(0.05, 0.3, 0.05).translate(cx + s * 0.26, 0.15, z));
    kit.add(m.steel, new THREE.BoxGeometry(0.16, 0.03, 0.16).translate(cx + s * 0.26, 0.015, z));
  }
  // Ramp from the sill (high, near the window) down to the knee: the +z end of the box must land
  // on the knee, so the slope sign follows (sill.y - knee.y) over the +z run toward the knee.
  const a = Math.atan2(p2.y - p1.y, p1.z - p2.z), zc = (p1.z + p2.z) / 2, yc = (p1.y + p2.y) / 2;
  kit.add(m.rubber, new THREE.BoxGeometry(0.5, 0.05, rampL).rotateX(a).translate(cx, yc, zc));
  for (const s of [-1, 1]) kit.add(m.steel, new THREE.BoxGeometry(0.05, 0.15, rampL + 0.12).rotateX(a).translate(cx + s * 0.28, yc + 0.02, zc));
  for (const [z, y] of [[p0.z, p0.y], [p1.z, p1.y], [p2.z, p2.y]]) kit.add(m.steel, new THREE.CylinderGeometry(0.065, 0.065, 0.6, 12).rotateZ(Math.PI / 2).translate(cx, y - 0.02, z));
  for (const s of [-1, 1]) {
    kit.add(m.steel, new THREE.BoxGeometry(0.05, p2.y - 0.05, 0.05).translate(cx + s * 0.26, (p2.y - 0.05) / 2, p2.z + 0.15));
    kit.add(m.steel, new THREE.BoxGeometry(0.16, 0.03, 0.16).translate(cx + s * 0.26, 0.015, p2.z + 0.15));
    kit.add(m.steel, new THREE.BoxGeometry(0.05, 0.34, 0.05).translate(cx + s * 0.26, 0.17, p1.z + 0.12));
  }
  kit.add(m.iron, new THREE.BoxGeometry(0.22, 0.2, 0.3).translate(cx + 0.42, 0.62, p2.z + 0.25)); // motor
  kit.solid(cx - 0.32, cx + 0.32, 0, 0.85, p0.z - 0.05, p2.z + 0.05);
  // HAY IN gantry over the low end of the belt.
  for (const sx of [-0.75, 0.75]) kit.add(m.beam, timber(0.09, 1.9, 0.09, cx + sx, 0.95, p0.z + 0.35));
  kit.add(m.beam, timber(1.74, 0.52, 0.06, cx, 1.92, p0.z + 0.35));
  const hayIn = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.44), new THREE.MeshStandardMaterial({ map: signTextureLight(t('counter.hayIn')), roughness: 0.9 }));
  hayIn.position.set(cx, 1.92, p0.z + 0.385);
  kit.group.add(hayIn);
  kit.solid(cx - 0.85, cx + 0.85, 0, 2.2, p0.z + 0.28, p0.z + 0.42);
  // Platform scale beside the kiosk, dial facing the yard.
  const sx0 = 2.35, sz0 = D / 2 + 1.3;
  kit.add(m.steel, worldBox(0.85, 0.34, 0.85, sx0, 0.17, sz0, 1.2), worldBox(1.0, 0.06, 1.0, sx0, 0.37, sz0, 1.2));
  kit.add(m.steel, new THREE.CylinderGeometry(0.045, 0.06, 1.0, 12).translate(sx0, 0.9, sz0));
  const dialBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 28).rotateX(Math.PI / 2), m.iron);
  const dialFace = new THREE.Mesh(new THREE.CircleGeometry(0.26, 28), new THREE.MeshStandardMaterial({ map: dialTexture(), roughness: 0.5 }));
  dialFace.position.z = 0.04;
  const dial = new THREE.Group();
  dial.add(dialBody, dialFace);
  dial.position.set(sx0, 1.52, sz0);
  kit.group.add(dial);
  kit.solid(sx0 - 0.5, sx0 + 0.5, 0, 0.45, sz0 - 0.5, sz0 + 0.5);
  // Bales by the side.
  bale(kit, m, -W / 2 - 0.7, 0, D / 2 - 0.2, Math.PI / 2 + 0.05);
  bale(kit, m, -W / 2 - 0.68, 0.48, D / 2 - 0.25, Math.PI / 2 - 0.08);
  bale(kit, m, -W / 2 - 0.75, 0, D / 2 + 0.45, Math.PI / 2 - 0.15);
  kit.solid(-W / 2 - 1.0, -W / 2 - 0.4, 0, 0.96, D / 2 - 0.75, D / 2 + 1.0);
  hitPane(kit, 2.0, 1.2, 0, 1.55, D / 2 + 0.05); // looking in through the window still counts
  return { kit, top: new THREE.Vector3(0, 1.1, D / 2 + 0.2), belt: { points: [p0, p1, p2] } };
}

/** Supply stall: wide SUPPLY CO sign over the awning, an OPEN sign and a lantern,
 *  shelves stocked to the back wall, goods on the counter with price tags on its front,
 *  tools hanging on the wall. */
export function supplyStall(m: Mats): Kit {
  const kit = new Kit();
  const W = 5.0, D = 2.6, bz = -D / 2 + 0.04, fz = D / 2;
  kit.add(m.boards, worldBox(W, 3.0, 0.08, 0, 1.5, bz));
  // Store room on the right.
  kit.add(m.boards, worldBox(1.4, 2.6, 0.08, 1.8, 1.3, fz - 0.04), worldBox(0.08, 2.6, D, 2.46, 1.3, 0), worldBox(0.08, 2.6, D, 1.14, 1.3, 0));
  kit.add(m.beam, timber(1.5, 0.08, D + 0.06, 1.8, 2.64, 0), timber(0.06, 2.1, 0.06, 1.55, 1.05, fz + 0.01), timber(0.5, 0.06, 0.04, 1.8, 1.35, fz + 0.01));
  // Posts, awning, red fascia.
  for (const x of [-W / 2 + 0.06, 1.1]) kit.add(m.beam, timber(0.12, 2.95, 0.12, x, 1.475, fz - 0.06));
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) kit.add(m.beam, timber(0.12, 3.05, 0.12, x, 1.525, bz));
  const back = 3.1, front = 2.92, len = D + 0.5, ang = Math.atan2(back - front, len);
  kit.add(m.boards, timber(W + 0.24, 0.06, len, 0, (back + front) / 2, 0.25, 1.2, ang, 0, 0));
  kit.add(m.red, timber(W + 0.26, 0.18, 0.05, 0, front - 0.08, fz + 0.5));
  kit.add(m.beam, timber(W, 0.12, 0.12, 0, 2.9, fz - 0.06));
  // The wide SUPPLY CO. board on the awning edge, an OPEN sign and a lantern on the left post.
  kit.add(m.beam, timber(W + 0.1, 0.86, 0.05, 0, 3.42, fz + 0.42));
  const bigSign = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, 0.8), new THREE.MeshStandardMaterial({ map: signTextureLight(t('shop.sign'), t('shop.sub')), roughness: 0.85 }));
  bigSign.position.set(0, 3.42, fz + 0.45);
  kit.group.add(bigSign);
  const open = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), new THREE.MeshStandardMaterial({ map: signTextureLight(t('shop.open')), roughness: 0.9 }));
  open.position.set(-0.9, 2.62, fz + 0.12);
  kit.group.add(open);
  const lantern = new THREE.Group(); // kerosene lantern on the left post
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.16, 12), new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9a3c', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.05, 12), m.red);
  top.position.y = 0.105;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.02, 0.05, 12), m.red);
  base.position.y = -0.1;
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 14), m.iron);
  hoop.position.y = 0.16;
  lantern.add(top, glass, base, hoop);
  lantern.position.set(-W / 2 + 0.35, 2.3, fz - 0.2);
  lantern.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  kit.group.add(lantern);
  // Counter with goods: a big wooden pail, a stack of cups, the yellow shovel and a red box.
  kit.add(m.boards, worldBox(3.4, 0.9, 0.55, -0.66, 0.45, fz - 0.42));
  kit.add(m.beam, timber(3.5, 0.06, 0.64, -0.66, 0.93, fz - 0.42));
  const pailProf = [[0, 0], [0.13, 0], [0.145, 0.02], [0.16, 0.26], [0.17, 0.28], [0.155, 0.28], [0.14, 0.26], [0.125, 0.03], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y));
  const pail = new THREE.Mesh(new THREE.LatheGeometry(pailProf, 20), m.boards);
  for (const y of [0.07, 0.2]) pail.add(new THREE.Mesh(new THREE.TorusGeometry(0.14 + y * 0.08, 0.008, 6, 24).rotateX(Math.PI / 2).translate(0, y, 0), m.iron));
  pail.position.set(-1.65, 0.96, fz - 0.45);
  pail.rotation.y = 0.5;
  pail.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  kit.group.add(pail);
  const cups = new THREE.Group(); // a stack of paper cups
  for (let i = 0; i < 7; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.052 - i * 0.002, 0.045 - i * 0.002, 0.012, 14), m.burlap);
    cup.position.y = 0.006 + i * 0.011;
    cups.add(cup);
  }
  cups.position.set(-0.5, 0.96, fz - 0.45);
  kit.group.add(cups);
  const shovel = buildModel('toy_shovel');
  shovel.position.set(0.5, 1.0, fz - 0.45);
  shovel.rotation.set(Math.PI / 2, 0.15, 0.5, 'YXZ'); // lying flat on the counter
  shovel.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  kit.group.add(shovel);
  kit.add(m.red, worldBox(0.36, 0.16, 0.26, 1.05, 1.04, fz - 0.45, 0.2));
  // Price tags on the front of the counter, like the reference.
  for (const [x, id] of [[-1.65, 'bucket'], [0.5, 'toy_shovel']] as const) {
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), new THREE.MeshStandardMaterial({ map: tagTexture(t(`item.${id}`), `$${itemById(id).price}`), roughness: 0.9 }));
    tag.position.set(x, 0.55, fz - 0.13);
    kit.group.add(tag);
  }
  // Shelves along the back wall on L-brackets, stocked with jars, crates and cups.
  const rnd = mulberry32(41);
  for (const y of [1.25, 1.8, 2.35]) {
    kit.add(m.beam, timber(2.2, 0.05, 0.34, -1.52, y, bz + 0.22));
    for (const sx of [-2.5, -1.8, -1.1, -0.5]) {
      // L-bracket: a shelf bar and an upright against the wall, both under the board.
      kit.add(m.beam, timber(0.06, 0.05, 0.3, sx, y - 0.045, bz + 0.2), timber(0.06, 0.2, 0.06, sx, y - 0.15, bz + 0.09));
    }
    let x = -2.55;
    while (x < -0.6) {
      const kind = rnd();
      if (kind < 0.45) {
        kit.add(m.black, new THREE.CylinderGeometry(0.09, 0.09, 0.26, 10).translate(x + 0.09, y + 0.15, bz + 0.22));
        x += 0.26;
      } else if (kind < 0.75) {
        kit.add(m.boards, worldBox(0.34, 0.22, 0.26, x + 0.18, y + 0.13, bz + 0.22, 0.7));
        x += 0.44;
      } else {
        for (let i = 0; i < 5; i++) kit.add(m.burlap, new THREE.CylinderGeometry(0.06 - i * 0.002, 0.05 - i * 0.002, 0.014, 12).translate(x + 0.07, y + 0.03 + i * 0.012, bz + 0.22));
        x += 0.2;
      }
    }
  }
  // Tools hanging on hooks right of the shelves: working end up, flat against the wall.
  const hangTool = (id: 'spade' | 'pitchfork', x: number) => {
    const tool = buildModel(id);
    tool.rotation.set(Math.PI / 2, 0, 0, 'YXZ'); // head up, handle down, teeth flat on the wall
    tool.position.set(x, 1.95, bz + 0.16);
    tool.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    kit.group.add(tool);
    kit.add(m.iron, new THREE.TorusGeometry(0.03, 0.007, 6, 14).translate(x, 2.36, bz + 0.12));
  };
  hangTool('spade', 0.85);
  hangTool('pitchfork', 1.15);
  kit.solid(-W / 2, W / 2, 0, 3.2, -D / 2, -D / 2 + 0.12);
  kit.solid(1.1, 2.5, 0, 2.7, -D / 2, fz);
  kit.solid(-2.4, 1.1, 0, 0.96, fz - 0.72, fz - 0.1);
  kit.solid(-0.6, 0.8, 0, 0.7, fz + 0.6, fz + 1.75);
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
