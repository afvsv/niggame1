import * as THREE from 'three';
import { t } from '../core/i18n';
import { buildModel, loadOf } from '../tools/models';
import { mulberry32 } from '../gfx/noise';
import { itemById } from '../data/tools';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Kit, worldBox } from './kit';
import { timber } from './geo';
import { bigSignTexture, dialTexture, createPriceBoard, signTextureLight, tagTexture } from './signs';
import type { PriceBoard } from './signs';

// Furniture of the hangar, after the reference: the "sell hay" kiosk with a conveyor, the supply stall,
// chalk A-frames, bollards and small clutter. Each builder works in local coordinates
// with the front facing +z; the caller places and turns it.

/** World placements shared with shed.ts and the headless Box3 checks. */
export const KIOSK_PLACEMENT = { x: 13.4, z: -8.3, ry: -Math.PI / 2 };
export const STALL_PLACEMENT = { x: 13.25, z: 13.0, ry: -Math.PI / 2 };
/** 1.5 m off the scale, clear of the scale-to-window walk line, face to the yard. */
export const PRICE_FRAME = { x: 11.71, z: -4.63, ry: -1.35 };
export const LIST_FRAME = { x: 11.6, z: 9.4, ry: -Math.PI / 2 + 0.3 };

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

let baleNo = 0;
/** A hay bale: chamfered box, two twine straps across the short side, ±3% per-bale jitter.
 *  With `as` the bale is a named group (for the headless checks), else it merges into the kit. */
export function bale(kit: Kit, m: Mats, x: number, y: number, z: number, ry: number, as?: string): void {
  const rnd = mulberry32(90 + baleNo++);
  const s = 1 + (rnd() - 0.5) * 0.06;
  const turn = ry + (rnd() - 0.5) * 0.1;
  const body = () => new RoundedBoxGeometry(1.05, 0.48, 0.55, 2, 0.03);
  const strap = (dx: number) => new THREE.BoxGeometry(0.012, 0.495, 0.565).translate(dx, 0, 0); // 1/4 and 3/4 of the length
  if (as) {
    const g = new THREE.Group();
    g.name = as;
    const bm = shadowed(new THREE.Mesh(body(), m.hay));
    const s1 = shadowed(new THREE.Mesh(strap(0.2625), m.iron));
    s1.name = 'strap-1';
    const s2 = shadowed(new THREE.Mesh(strap(-0.2625), m.iron));
    s2.name = 'strap-2';
    g.add(bm, s1, s2);
    g.scale.setScalar(s);
    g.rotation.y = turn;
    g.position.set(x, y + 0.24 * s, z);
    kit.group.add(g);
    return;
  }
  kit.add(m.hay, body().scale(s, s, s).rotateY(turn).translate(x, y + 0.24 * s, z));
  kit.add(m.iron, strap(0.2625).scale(s, s, s).rotateY(turn).translate(x, y + 0.24 * s, z),
    strap(-0.2625).scale(s, s, s).rotateY(turn).translate(x, y + 0.24 * s, z));
}

/** "Sell hay" kiosk: plank booth with a serving window, a wide sign, a stocked interior,
 *  the Z-shaped conveyor up to the window, a HAY IN gantry at its low end and a platform scale. */
export function sellBooth(m: Mats): { kit: Kit; top: THREE.Vector3; belt: { points: THREE.Vector3[] }; priceBoard: PriceBoard } {
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
  // Interior, seen through the window: bracketed shelves with jars and crates, a register, the price card.
  const inner = -D / 2 + T + 0.06;
  const wallZ = -D / 2 + T; // inner face of the back wall
  const shelfGroup = (name: string, y: number) => {
    const g = new THREE.Group();
    g.name = name;
    g.add(shadowed(new THREE.Mesh(timber(1.6, 0.05, 0.3, -0.4, y, inner + 0.16), m.beam)));
    for (const sx of [-1.0, -0.4, 0.25]) {
      g.add(shadowed(new THREE.Mesh(timber(0.06, 0.05, 0.26, sx, y - 0.05, wallZ + 0.15), m.beam)));
      g.add(shadowed(new THREE.Mesh(timber(0.05, 0.18, 0.05, sx, y - 0.14, wallZ + 0.03), m.beam)));
    }
    kit.group.add(g);
    return g;
  };
  const shelf1Top = 1.345, shelf2Top = 1.805;
  shelfGroup('kiosk-shelf-1', 1.32);
  shelfGroup('kiosk-shelf-2', 1.78);
  const kj = mulberry32(31);
  const jarAt = (name: string, i: number, x: number, top: number) => {
    const j = jar(i, 0.22 + kj() * 0.08, 0.06 + kj() * 0.03);
    j.name = name;
    j.position.set(x, top, inner + 0.16);
    kit.group.add(j);
  };
  jarAt('kiosk-jar-1', 0, -1.0, shelf1Top);
  jarAt('kiosk-jar-2', 1, -0.75, shelf1Top);
  jarAt('kiosk-jar-3', 2, 0.1, shelf1Top);
  jarAt('kiosk-jar-4', 3, 0.35, shelf1Top);
  jarAt('kiosk-jar-5', 1, -0.5, shelf2Top);
  const crateAt = (name: string, x: number, top: number) => {
    const c = crate(kj);
    c.name = name;
    c.position.set(x, top, inner + 0.16);
    kit.group.add(c);
  };
  crateAt('kiosk-crate-1', -0.3, shelf1Top);
  crateAt('kiosk-crate-2', 0.1, shelf2Top);
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
  // The price card on a clear stretch of the back wall, right of the register, pinned at the corners.
  const priceBoard = createPriceBoard();
  const board = new THREE.Group();
  board.name = 'price-card';
  const cardFace = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshStandardMaterial({ map: priceBoard.texture, roughness: 0.95 }));
  const pinMat = new THREE.MeshStandardMaterial({ color: '#3b3a38', roughness: 0.5, metalness: 0.6 });
  for (const dx of [-0.36, 0.36]) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.03), pinMat);
    pin.name = 'card-pin';
    pin.position.set(dx, 0.52, 0.012);
    board.add(pin);
  }
  board.add(cardFace);
  board.position.set(0.9, 1.8, -D / 2 + T + 0.01);
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
  // Motor on a base plate by the ramp foot, shaft to the nearest roller (nothing floats).
  const motor = new THREE.Group();
  motor.name = 'motor';
  motor.position.set(cx + 0.42, 0, p2.z + 0.25);
  const motoPlate = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.4), m.iron));
  motoPlate.position.y = 0.035; // bottom rests on the floor (top 0.01)
  const motoBody = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.3), m.iron));
  motoBody.position.y = 0.16;
  motor.add(motoPlate, motoBody);
  const shaftFrom = new THREE.Vector3(0, 0.24, 0), shaftTo = new THREE.Vector3(cx + 0.3 - (cx + 0.42), p1.y - 0.02, p1.z - (p2.z + 0.25));
  const shaftDir = shaftTo.clone().sub(shaftFrom);
  const shaft = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, shaftDir.length(), 10), m.iron));
  shaft.name = 'motor-shaft';
  shaft.position.copy(shaftFrom).addScaledVector(shaftDir, 0.5);
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), shaftDir.clone().normalize());
  motor.add(shaft);
  kit.group.add(motor);
  kit.solid(cx - 0.32, cx + 0.32, 0, 0.85, p0.z - 0.05, p2.z + 0.05);
  // HAY IN gantry over the low end of the belt.
  for (const sx of [-0.75, 0.75]) kit.add(m.beam, timber(0.09, 1.9, 0.09, cx + sx, 0.95, p0.z + 0.35));
  kit.add(m.beam, timber(1.74, 0.52, 0.06, cx, 1.92, p0.z + 0.35));
  const hayIn = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.44), new THREE.MeshStandardMaterial({ map: signTextureLight(t('counter.hayIn')), roughness: 0.9 }));
  hayIn.position.set(cx, 1.92, p0.z + 0.385);
  kit.group.add(hayIn);
  kit.solid(cx - 0.85, cx + 0.85, 0, 2.2, p0.z + 0.28, p0.z + 0.42);
  // Platform scale beside the kiosk: one group, one rotation, dial facing the yard.
  const sx0 = 2.35, sz0 = D / 2 + 1.3;
  const scale = new THREE.Group();
  scale.name = 'scale';
  scale.rotation.y = 0.5;
  const deck = new THREE.Group();
  deck.name = 'scale-deck';
  const baseMesh = shadowed(new THREE.Mesh(worldBox(0.85, 0.34, 0.85, 0, 0.17, 0, 1.2), m.steel));
  baseMesh.name = 'scale-base';
  const plateMesh = shadowed(new THREE.Mesh(worldBox(1.0, 0.06, 1.0, 0, 0.37, 0, 1.2), m.steel));
  plateMesh.name = 'scale-plate';
  deck.add(baseMesh, plateMesh);
  const head = new THREE.Group();
  head.name = 'scale-head';
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.0, 12).translate(0, 0.9, -0.42), m.steel));
  pole.name = 'scale-pole'; // rear edge of the plate
  head.add(pole);
  const dialBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 28).rotateX(Math.PI / 2), m.iron);
  const dialFace = new THREE.Mesh(new THREE.CircleGeometry(0.26, 28), new THREE.MeshStandardMaterial({ map: dialTexture(), roughness: 0.5 }));
  dialFace.position.z = 0.04;
  const dial = new THREE.Group();
  dial.name = 'scale-dial';
  dial.add(dialBody, dialFace);
  dial.position.set(0, 1.55, -0.36);
  head.add(dial);
  scale.add(deck, head);
  scale.position.set(sx0, 0, sz0);
  kit.group.add(scale);
  scale.updateMatrixWorld(true);
  const deckBox = new THREE.Box3().setFromObject(deck), headBox = new THREE.Box3().setFromObject(head);
  kit.solid(deckBox.min.x, deckBox.max.x, 0, deckBox.max.y, deckBox.min.z, deckBox.max.z);
  kit.solid(headBox.min.x, headBox.max.x, 0, headBox.max.y, headBox.min.z, headBox.max.z);
  // Bales beside the kiosk wall, clear of the window line, the walk lane and the inner posts.
  bale(kit, m, -2.2, 0, 2.7, Math.PI / 2 + 0.05, 'bale-kiosk-1');
  bale(kit, m, -2.18, 0.48, 2.75, Math.PI / 2 - 0.08, 'bale-kiosk-2');
  bale(kit, m, -1.9, 0, 3.9, Math.PI / 2 - 0.15, 'bale-kiosk-3');
  kit.solid(-2.55, -1.6, 0, 0.96, 2.1, 4.5);
  hitPane(kit, 2.0, 1.2, 0, 1.55, D / 2 + 0.05); // looking in through the window still counts
  return { kit, top: new THREE.Vector3(0, 1.1, D / 2 + 0.2), belt: { points: [p0, p1, p2] }, priceBoard };
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
  const storeBeam = new THREE.Group();
  storeBeam.name = 'stall-beam';
  storeBeam.add(shadowed(new THREE.Mesh(timber(1.5, 0.08, D + 0.06, 1.8, 2.64, 0), m.beam)));
  kit.group.add(storeBeam);
  kit.add(m.beam, timber(0.06, 2.1, 0.06, 1.55, 1.05, fz + 0.01), timber(0.5, 0.06, 0.04, 1.8, 1.35, fz + 0.01));
  // Posts, awning, red fascia.
  for (const x of [-W / 2 + 0.06, 1.1]) kit.add(m.beam, timber(0.12, 2.95, 0.12, x, 1.475, fz - 0.06));
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) kit.add(m.beam, timber(0.12, 3.05, 0.12, x, 1.525, bz));
  const back = 3.1, front = 2.92, len = D + 0.5, ang = Math.atan2(back - front, len);
  kit.add(m.boards, timber(W + 0.24, 0.06, len, 0, (back + front) / 2, 0.25, 1.2, ang, 0, 0));
  kit.add(m.red, timber(W + 0.26, 0.18, 0.05, 0, front - 0.08, fz + 0.5));
  const awningBeam = new THREE.Group();
  awningBeam.name = 'stall-awning-beam';
  awningBeam.add(shadowed(new THREE.Mesh(timber(W, 0.12, 0.12, 0, 2.9, fz - 0.06), m.beam)));
  kit.group.add(awningBeam);
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
  pail.name = 'pail';
  pail.position.set(-1.65, 0.96, fz - 0.45);
  pail.rotation.y = 0.5;
  pail.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  kit.group.add(pail);
  const cups = cupStack(7, 0); // nested paper cups instead of a pile of pancakes
  cups.name = 'cups';
  cups.position.set(-0.5, 0.96, fz - 0.45);
  kit.group.add(cups);
  const shovel = buildModel('toy_shovel');
  shovel.name = 'toy-shovel';
  shovel.rotation.set(0, 0.35, 0, 'YXZ'); // the model already lies in its own XZ plane: yaw only
  shovel.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  const shovelBox = new THREE.Box3().setFromObject(shovel);
  shovel.position.set(0.5, 0.96 - shovelBox.min.y, fz - 0.45); // Box3.min.y exactly on the counter top
  kit.group.add(shovel);
  const cashTin = tin(); // the flat red placeholder box became a cash tin
  cashTin.name = 'tin';
  cashTin.position.set(1.05, 0.96, fz - 0.45);
  kit.group.add(cashTin);
  // Price tags on the front of the counter, like the reference.
  for (const [x, id] of [[-1.65, 'bucket'], [0.5, 'toy_shovel']] as const) {
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), new THREE.MeshStandardMaterial({ map: tagTexture(t(`item.${id}`), `$${itemById(id).price}`), roughness: 0.9 }));
    tag.position.set(x, 0.55, fz - 0.13);
    kit.group.add(tag);
  }
  // Shelves along the back wall on L-brackets, stocked with jars, crates and cup stacks.
  const rnd = mulberry32(41);
  const shelfTops = [1.275, 1.825, 2.375];
  let propNo = 0;
  [1.25, 1.8, 2.35].forEach((y, si) => {
    const g = new THREE.Group();
    g.name = `stall-shelf-${si + 1}`;
    g.add(shadowed(new THREE.Mesh(timber(2.2, 0.05, 0.34, -1.52, y, bz + 0.22), m.beam)));
    for (const sx of [-2.5, -1.8, -1.1, -0.5]) {
      // L-bracket: a shelf bar and an upright against the wall, both under the board.
      g.add(shadowed(new THREE.Mesh(timber(0.06, 0.05, 0.3, sx, y - 0.045, bz + 0.2), m.beam)));
      g.add(shadowed(new THREE.Mesh(timber(0.06, 0.2, 0.06, sx, y - 0.15, bz + 0.09), m.beam)));
    }
    kit.group.add(g);
    let x = -2.55;
    while (x < -0.6) {
      const kind = rnd();
      const top = shelfTops[si];
      if (kind < 0.45) {
        const j = jar(Math.floor(rnd() * 4), 0.22 + rnd() * 0.08, 0.06 + rnd() * 0.03);
        j.name = `stall-jar-${++propNo}`;
        j.position.set(x + 0.09, top, bz + 0.22);
        kit.group.add(j);
        x += 0.26;
      } else if (kind < 0.75) {
        const c = crate(rnd);
        c.name = `stall-crate-${++propNo}`;
        c.position.set(x + 0.18, top, bz + 0.22);
        kit.group.add(c);
        x += 0.44;
      } else {
        const st = cupStack(5, si);
        st.name = `stall-cups-${++propNo}`;
        st.position.set(x + 0.07, top, bz + 0.22);
        kit.group.add(st);
        x += 0.2;
      }
    }
  });
  // Tools hanging on wall pegs right of the shelves: working end up, flat against the wall.
  const toolSteel = new THREE.MeshStandardMaterial({ color: '#8a8f94', roughness: 0.45, metalness: 0.6 });
  const pegMat = new THREE.MeshStandardMaterial({ color: '#6a6f74', roughness: 0.5, metalness: 0.75 });
  const hangTool = (id: 'spade' | 'pitchfork', x: number) => {
    const wrap = new THREE.Group();
    wrap.name = `tool-${id}`;
    const body = buildModel(id);
    body.name = 'tool-body';
    body.rotation.set(Math.PI / 2, 0, 0, 'YXZ'); // head up, handle down, flat against the wall
    if (id === 'spade') body.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry.type === 'ExtrudeGeometry') { o.name = 'blade'; o.material = toolSteel; }
    });
    body.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    const load = loadOf(body); // the hay load is for held tools: a hung tool hangs clean
    if (load) body.remove(load.mesh);
    const raw = new THREE.Box3().setFromObject(body); // head-up span measured at the origin
    body.position.set(x, 2.4 - raw.max.y, bz + 0.12); // the tip stays 0.2 m under the beam, whatever the tool's length
    wrap.add(body);
    const tb = new THREE.Box3().setFromObject(body);
    for (const [i, dy] of [[1, 0.25], [2, 0.7]] as const) {
      const peg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.07), pegMat));
      peg.name = `peg-${i}`;
      peg.position.set(x, tb.max.y - dy, bz + 0.075);
      wrap.add(peg);
    }
    kit.group.add(wrap);
  };
  hangTool('spade', 0.35);
  hangTool('pitchfork', 0.75);
  kit.solid(-W / 2, W / 2, 0, 3.2, -D / 2, -D / 2 + 0.12);
  kit.solid(1.1, 2.5, 0, 2.7, -D / 2, fz);
  kit.solid(-2.4, 1.1, 0, 0.96, fz - 0.72, fz - 0.1);
  kit.solid(-0.6, 0.8, 0, 0.7, fz + 0.6, fz + 1.75);
  hitPane(kit, 3.6, 2.0, -0.7, 1.9, fz - 0.1); // the open front over the counter
  return kit;
}

/** Chalk A-frame sign with `face` on the front leaf: two legs that meet at the apex under a hinge bar. */
export function aFrame(m: Mats, face: THREE.Texture | null): Kit {
  const kit = new Kit();
  const lean = 0.14, legH = 1.0, legW = 0.5, T = 0.025;
  const spread = legH * Math.sin(lean); // each foot sits this far behind the apex
  const lift = (T / 2) * Math.sin(lean); // keeps the dipped bottom corner on the floor
  for (const side of [1, -1]) {
    // one leg, pivoting about its bottom edge: the foot kicks out to z = side*spread, the top meets the apex
    kit.add(m.beam, timber(legW, legH, T, 0, legH / 2, 0).rotateX(-side * lean).translate(0, lift, side * spread));
  }
  kit.add(m.beam, timber(legW + 0.04, 0.07, 0.06, 0, legH * Math.cos(lean) + 0.035, 0)); // visible hinge bar
  const mat = face ? new THREE.MeshStandardMaterial({ map: face, roughness: 0.95 }) : new THREE.MeshStandardMaterial({ color: '#1c2023', roughness: 0.95 });
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.82), mat);
  // chalk leaf on the front leg face, following its lean
  leaf.position.set(0, 0.5 * legH * Math.cos(lean) + lift + 0.004 * Math.sin(lean), 0.5 * spread + (T / 2) * Math.cos(lean) + 0.004);
  leaf.rotation.x = -lean;
  kit.group.add(leaf);
  kit.solid(-0.3, 0.3, 0, 1.06, -0.2, 0.2);
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

/** Jar palettes: muted olive / brick / mustard / steel blue, all with L well above 15%. */
const JAR_PALETTES: Array<[number, number]> = [
  [0x6b7a4a, 0x8a9a68],
  [0x8f4a3a, 0xb06a58],
  [0xc19a3f, 0xdcb96a],
  [0x5c7482, 0x7e96a4],
];
const jarMats = JAR_PALETTES.map(([body, lid]) => ({
  body: new THREE.MeshStandardMaterial({ color: body, roughness: 0.35, metalness: 0 }),
  lid: new THREE.MeshStandardMaterial({ color: lid, roughness: 0.45, metalness: 0.1 }),
  label: new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.85 }),
}));

/** Ceramic jar with a lighter lid and a paper label band. Origin at the bottom centre. */
function jar(i: number, h: number, r: number): THREE.Group {
  const g = new THREE.Group();
  const pm = jarMats[i % jarMats.length];
  const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 14), pm.body));
  body.name = 'jar-body';
  body.position.y = h / 2;
  const lid = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.005, r + 0.005, 0.03, 14), pm.lid));
  lid.position.y = h + 0.015;
  const label = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96 + 0.002, r * 0.92 + 0.002, 0.08, 14), pm.label));
  label.position.y = h * 0.45;
  g.add(body, lid, label);
  return g;
}

let crateMat: THREE.MeshStandardMaterial | null = null;
const crateStrapMat = new THREE.MeshStandardMaterial({ color: '#5c4a38', roughness: 0.85 });
/** Wooden crate, lighter than the wall boards, corner straps and a front slat. Origin at the bottom centre. */
function crate(rnd: () => number): THREE.Group {
  crateMat ??= new THREE.MeshStandardMaterial({ color: '#e2d3b6', roughness: 0.8 });
  const g = new THREE.Group();
  const w = 0.34, h = 0.2, d = 0.26;
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat));
  body.position.y = h / 2;
  g.add(body);
  for (const dx of [-1, 1]) {
    const st = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.03, h, 0.03), crateStrapMat));
    st.position.set(dx * (w / 2 - 0.02), h / 2, d / 2 - 0.02);
    g.add(st);
  }
  const slat = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.02, 0.008), crateStrapMat));
  slat.position.set(0, h * 0.62, d / 2 + 0.004);
  g.add(slat);
  g.rotation.y = (rnd() - 0.5) * (Math.PI / 18); // ±5 degrees
  return g;
}

const CUP_STRIPE = [0xb04a3a, 0x4a6a5a, 0x9a7a3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
const cupMat = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.8, side: THREE.DoubleSide });
/** A paper cup: truncated cone, open top, one coloured stripe. Origin at the cup base centre. */
function cup(stripe: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'cup';
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.028, 0.09, 14, 1, true), cupMat);
  cone.name = 'cup-cone';
  cone.position.y = 0.045;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0355, 0.02, 14, 1, true), CUP_STRIPE[stripe % CUP_STRIPE.length]);
  band.position.y = 0.045;
  g.add(cone, band);
  return g;
}
/** A nested stack of `n` cups; origin at the bottom of the lowest cup. */
function cupStack(n: number, stripe: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const c = cup(stripe);
    c.position.y = i * 0.012;
    g.add(c);
  }
  return g;
}

let tinTex: THREE.CanvasTexture | null = null;
/** 64x64 noise map so the tin paint reads as dented metal, not a flat placeholder. */
function noiseTex(): THREE.CanvasTexture {
  tinTex ??= (() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 400; i++) {
      const l = 232 + Math.random() * 23;
      ctx.fillStyle = `rgb(${l | 0},${(l * 0.9) | 0},${(l * 0.85) | 0})`;
      ctx.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 4, 1 + Math.random() * 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  return tinTex;
}

const tinCornerMat = new THREE.MeshStandardMaterial({ color: '#3b3a38', roughness: 0.5, metalness: 0.7 });
/** Cash tin instead of the red placeholder box: body, raised lid, dark corners, front latch. Origin at the bottom centre. */
function tin(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#a8352c', roughness: 0.55, metalness: 0.15, map: noiseTex() });
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.26), bodyMat));
  body.name = 'tin-body';
  body.position.y = 0.08;
  const lid = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.02, 0.27), bodyMat));
  lid.name = 'tin-lid';
  lid.position.y = 0.17;
  g.add(body, lid);
  for (const dx of [-1, 1]) {
    const c = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.165, 0.045), tinCornerMat));
    c.name = `tin-corner-${dx < 0 ? 1 : 2}`;
    c.position.set(dx * 0.155, 0.082, -0.105);
    g.add(c);
  }
  const latch = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.015), tinCornerMat));
  latch.name = 'tin-latch';
  latch.position.set(0, 0.145, 0.14);
  g.add(latch);
  return g;
}
