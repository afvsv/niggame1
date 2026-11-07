import * as THREE from 'three';
import { AABB, Colliders } from './colliders';
import { t } from '../core/i18n';
import { NEEDLES, NeedleId } from '../data/needles';
import { buildModel } from '../tools/models';
import { BALANCE } from '../data/balance';
import { Textures } from '../gfx/assets';
import { mulberry32 } from '../gfx/noise';
import { PBRSet } from '../gfx/pbr';
import { triplanarMaterial } from '../gfx/triplanar';
import { Sunbeams } from '../fx/sunbeams';
import { floorStraws } from './straws';
import { BARN, EXIT, Nature } from './nature';
import { SUN_DIR } from './sky';
import { timber } from './geo';
import { Kit, prism, projectUV, tube, worldBox } from './kit';
import { Mats, aFrame, bale, bollard, fernPot, hitPane, sellBooth, shadowed, supplyStall } from './booths';
import { hazardTexture, ledClock, needleBoard, plateTexture, priceListTexture, priceTexture } from './signs';
import { Belt } from '../game/belt';
import { HayLoad } from '../tools/models';

export interface Shed {
  group: THREE.Group;
  counter: THREE.Object3D; // ray target for selling: the kiosk and its conveyor
  shop: THREE.Object3D; // ray target for the supply stall
  door: THREE.Object3D; // the roll-up exit door and its lock
  board: THREE.Object3D; // the needle board by the exit
  counterTop: THREE.Vector3;
  belt: Belt; // the kiosk conveyor: dumps ride up and pay on delivery
  beltLow: THREE.Vector3; // the low end of the kiosk belt (HAY IN), world space
  mats: Mats;
  spawn: THREE.Vector3;
  spawnYaw: number;
  /** True once the player has walked out through the exit. */
  exited(x: number, z: number): boolean;
  inside(x: number, z: number): boolean;
  /** Shows found needles on the board. */
  setNeedles(found: readonly NeedleId[]): void;
  /** Drops the lock and rolls the door up; `instant` for loading an opened hangar. */
  unlock(instant?: boolean): void;
  /** Returns true while something that casts shadows is moving. `play` rides the kiosk belt. */
  update(dt: number, play?: boolean): boolean;
  /** Parts the graphics settings thin out or hide. */
  quality: { grass: THREE.InstancedMesh[]; floorStraws: THREE.InstancedMesh; beams: THREE.Object3D };
}

// The hangar, after the reference: an open-topped yard with tall plank walls on a concrete plinth,
// lean-to tin roofs along both long walls and bare steel arches over the middle. The exit is a roll-up
// door in the +x wall; the selling kiosk stands in the far corner of that wall, the supply stall near the door.
const HX = BARN.hx, HZ = BARN.hz; // half-sizes, metres
const WALL_H = 9; // long walls: posts and plate
const SIDING_TOP = 9.3;
const END_H = 7.5; // end walls under the open middle
const BASE_H = 1.5; // concrete plinth
const IN = HX - 5.5; // inner post rows = inner edge of the roofs
const SLOPE = 0.235; // the roofs rise towards the walls
const rafterY = (ax: number) => 7.9 + (ax - IN) * SLOPE; // rafter centre line at |x| = ax
const BAYS = [-16.5, -11, -5.5, 0, 5.5, 11, 16.5];
const FRAMES = [-(HZ - 0.3), ...BAYS, HZ - 0.3];
const PX = HX - 0.3; // wall posts
// The inner post at the kiosk bay (z = -5.5) stood on the walk up to the conveyor; without the kiosk
// in the far corner the post there is back, so the frame reads as complete again.
const NO_INNER_POST = new Set(['1,-5.5']);
const DOOR_H = 5;
const D0 = EXIT.z - EXIT.halfW, D1 = EXIT.z + EXIT.halfW, DW = D1 - D0;

function pbr(set: PBRSet, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: 0, ...extra });
}

/** Builds the hangar the player is locked in: walls and roofs, the kiosk, the stall, the exit and the land outside. */
export function buildShed(scene: THREE.Scene, colliders: Colliders, tex: Textures, hayMat: THREE.Material): Shed {
  const group = new THREE.Group();
  scene.add(group);
  const box = (b: AABB) => { colliders.addBox(b); return b; };
  const m: Mats = {
    beam: pbr(tex.beam, { color: '#857565' }),
    boards: pbr(tex.boards),
    metal: pbr(tex.metal, { metalness: 0.5 }),
    iron: new THREE.MeshStandardMaterial({ color: '#3b3a38', roughness: 0.55, metalness: 0.75 }),
    steel: new THREE.MeshStandardMaterial({ color: '#5d6d74', roughness: 0.5, metalness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#1f1f1e', roughness: 0.92 }),
    hay: hayMat,
    yellow: new THREE.MeshStandardMaterial({ color: '#d9a51c', roughness: 0.55, metalness: 0.15 }),
    black: new THREE.MeshStandardMaterial({ color: '#1a1917', roughness: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: '#97302a', roughness: 0.7 }),
    burlap: new THREE.MeshStandardMaterial({ color: '#a08660', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#4f6d36', roughness: 0.8, side: THREE.DoubleSide }),
  };
  const siding = pbr(tex.siding);
  const concrete = pbr(tex.concrete);
  const archMat = new THREE.MeshStandardMaterial({ color: '#c9cdcd', roughness: 0.45, metalness: 0.35 });

  // Floor: light packed sand.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * HX, 2 * HZ).rotateX(-Math.PI / 2),
    triplanarMaterial({ set: tex.sand, tile: 3, variation: tex.variation, variationTile: 11, brightness: 0.35, tint: '#c9ab7c', tintAmount: 0.35, topOnly: true }),
  );
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  group.add(floor);

  const shell = new Kit();
  const tim: THREE.BufferGeometry[] = [];
  const post = (x: number, z: number, h: number, p = 0.3) => {
    tim.push(timber(p, h, p, x, h / 2, z));
    box({ minX: x - p / 2, maxX: x + p / 2, minY: 0, maxY: h, minZ: z - p / 2, maxZ: z + p / 2 });
  };

  // Long walls: a concrete plinth, dark siding above. The +x wall has the exit.
  for (const s of [-1, 1]) {
    const x = s * HX;
    const spans: Array<[number, number]> = s > 0 ? [[-HZ, D0], [D1, HZ]] : [[-HZ, HZ]];
    for (const [z0, z1] of spans) {
      const zc = (z0 + z1) / 2, len = z1 - z0;
      shell.add(concrete, worldBox(0.3, BASE_H, len, x, BASE_H / 2, zc, 2));
      shell.add(siding, worldBox(0.14, SIDING_TOP - BASE_H, len, x, (SIDING_TOP + BASE_H) / 2, zc, 2.4));
      box({ minX: x - 0.2, maxX: x + 0.2, minY: 0, maxY: 14, minZ: z0, maxZ: z1 });
    }
  }
  shell.add(siding, worldBox(0.14, SIDING_TOP - DOOR_H, DW, HX, (SIDING_TOP + DOOR_H) / 2, EXIT.z, 2.4));
  // End walls: lower and open above the middle; under the roofs the siding follows the roof line.
  const under = (ax: number) => rafterY(ax) + 0.2;
  const E = HX - 0.07;
  const endOutline: Array<[number, number]> = [[-E, BASE_H], [E, BASE_H], [E, under(E)], [IN, under(IN)], [IN, END_H], [-IN, END_H], [-IN, under(IN)], [-E, under(E)]];
  for (const s of [-1, 1]) {
    const z = s * HZ;
    shell.add(concrete, worldBox(2 * HX - 0.3, BASE_H, 0.3, 0, BASE_H / 2, z, 2));
    shell.add(siding, projectUV(prism(endOutline, 0.14).translate(0, 0, z), 2.4));
    box({ minX: -HX, maxX: HX, minY: 0, maxY: 14, minZ: z - 0.2, maxZ: z + 0.2 });
    for (const x of [-4.75, 0, 4.75]) post(x, s * (HZ - 0.3), END_H);
    tim.push(timber(2 * IN, 0.24, 0.32, 0, END_H - 0.12, s * (HZ - 0.3))); // top rail
  }

  // Timber frame: wall posts, inner posts under the roof edge, plates, girts, rafters and purlins.
  const pitch = Math.atan(SLOPE);
  for (const s of [-1, 1]) {
    for (const z of FRAMES) {
      post(s * PX, z, WALL_H);
      if (!NO_INNER_POST.has(`${s},${z}`)) post(s * IN, z, 7.42);
    }
    tim.push(timber(0.3, 0.3, 2 * HZ - 0.3, s * PX, WALL_H - 0.15, 0)); // wall plate
    tim.push(timber(0.16, 0.22, 2 * HZ - 0.3, s * (HX - 0.15), 5.3, 0)); // girt
    tim.push(timber(0.3, 0.36, 2 * HZ - 0.3, s * IN, 7.6, 0)); // eave beam
    for (const z of BAYS) for (const d of [-1, 1]) if (!NO_INNER_POST.has(`${s},${z}`)) tim.push(timber(0.12, 1.5, 0.12, s * IN, 6.95, z + d * 0.5, 1.2, d * 0.75, 0, 0)); // knee braces
    const a0 = IN - 0.35, a1 = HX + 0.4, ac = (a0 + a1) / 2, len = (a1 - a0) / Math.cos(pitch);
    for (const z of FRAMES) tim.push(timber(len, 0.24, 0.14, s * ac, rafterY(ac), z, 1.2, 0, 0, s * pitch));
    for (const ax of [IN + 0.3, IN + 2.75, HX - 0.5]) tim.push(timber(0.12, 0.1, 2 * HZ + 0.4, s * ax, rafterY(ax) + 0.17, 0));
    tim.push(timber(0.05, 0.22, 2 * HZ + 0.6, s * (a0 - 0.02), rafterY(a0) + 0.17, 0)); // fascia
    // Corrugated sheet over it all, ridges running down the slope.
    const sheet = new THREE.BoxGeometry(len, 0.03, 2 * HZ + 0.6);
    const p = sheet.getAttribute('position') as THREE.BufferAttribute, uv = sheet.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) / 1.2, p.getX(i) / 1.2);
    shell.add(m.metal, sheet.rotateZ(s * pitch).translate(s * ac, rafterY(ac) + 0.235, 0));
  }

  // Bare steel arches over the open middle, springing from the eave beams.
  const chord = 2 * IN, sag = 6.2, R = (chord * chord / 4 + sag * sag) / (2 * sag), y0 = rafterY(IN) + 0.12, cy = y0 + sag - R;
  const half = Math.asin(IN / R);
  for (const z of FRAMES) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = -half + (i / 24) * 2 * half;
      pts.push(new THREE.Vector3(R * Math.sin(a), cy + R * Math.cos(a), z));
    }
    shell.add(archMat, tube(pts, 0.055, 48, 8));
    for (const s of [-1, 1]) shell.add(m.iron, new THREE.BoxGeometry(0.34, 0.04, 0.34).translate(s * IN, y0 - 0.1, z));
  }

  // The exit frame: a header across the wall posts at z = 0 and 5.5, the drum housing above it.
  tim.push(timber(0.32, 0.3, 5.8, PX, DOOR_H + 0.15, EXIT.z));
  shell.add(m.beam, ...tim);
  shell.add(m.steel, worldBox(0.48, 0.6, DW + 0.5, HX - 0.71, DOOR_H + 0.32, EXIT.z, 1.2));
  for (const z of [D0 + 0.05, D1 - 0.05]) shell.add(m.steel, new THREE.BoxGeometry(0.12, DOOR_H, 0.1).translate(HX - 0.1, DOOR_H / 2, z)); // guide rails
  shell.place(group, box, 0, 0);

  // Hazard stripes on the jambs, the exit plate, two lamps and the red clock above.
  const hazard = hazardTexture();
  hazard.repeat.set(1, 5);
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.6 });
  for (const [z, face] of [[0, 1], [5.5, -1]] as const) {
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.5).rotateY(-Math.PI / 2), hazardMat);
    front.position.set(PX - 0.155, 0.75, z);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.5).rotateY(face > 0 ? 0 : Math.PI), hazardMat);
    side.position.set(PX, 0.75, z + face * 0.155);
    group.add(front, side);
  }
  const wallFace = HX - 0.075;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.44).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: plateTexture(t('exit.sign')), roughness: 0.5, metalness: 0.2 }));
  plate.position.set(wallFace - 0.01, DOOR_H + 1.25, EXIT.z);
  group.add(plate);
  const lampKit = new Kit();
  const lens = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd890', emissiveIntensity: 2.2 });
  for (const dz of [-1.45, 1.45]) {
    lampKit.add(m.iron, new THREE.BoxGeometry(0.08, 0.2, 0.2).translate(wallFace - 0.04, DOOR_H + 1.25, EXIT.z + dz));
    lampKit.add(m.iron, new THREE.BoxGeometry(0.3, 0.12, 0.26).translate(wallFace - 0.2, DOOR_H + 1.32, EXIT.z + dz));
    lampKit.add(lens, new THREE.BoxGeometry(0.26, 0.02, 0.22).translate(wallFace - 0.2, DOOR_H + 1.255, EXIT.z + dz));
  }
  lampKit.add(m.iron, new THREE.BoxGeometry(0.08, 0.52, 1.5).translate(wallFace - 0.04, DOOR_H + 2.1, EXIT.z));
  lampKit.place(group, box, 0, 0, 0, false);
  const clock = ledClock();
  const clockFace = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.43).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: clock.tex, toneMapped: false }));
  clockFace.position.set(wallFace - 0.085, DOOR_H + 2.1, EXIT.z);
  group.add(clockFace);

  // The roll-up door: a curtain hung from the drum (scaled from the top as it rolls), a bottom bar
  // with a hasp, and a padlock through the hasp.
  const door = new THREE.Group();
  group.add(door);
  const shutterMaps = [tex.shutter.map, tex.shutter.normalMap, tex.shutter.roughnessMap].map((x) => {
    const c = x.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.needsUpdate = true;
    return c;
  });
  const curtain = new THREE.Group();
  curtain.position.set(HX - 0.02, DOOR_H, EXIT.z);
  const shutterMat = new THREE.MeshStandardMaterial({ map: shutterMaps[0], normalMap: shutterMaps[1], roughnessMap: shutterMaps[2], roughness: 1, metalness: 0.35, side: THREE.DoubleSide });
  curtain.add(shadowed(new THREE.Mesh(new THREE.PlaneGeometry(DW, DOOR_H).rotateY(-Math.PI / 2).translate(0, -DOOR_H / 2, 0), shutterMat)));
  const bottom = new THREE.Group();
  bottom.position.set(HX - 0.06, 0, EXIT.z);
  bottom.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, DW).translate(0, 0.05, 0), m.steel)));
  bottom.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.09).translate(-0.07, 0.25, 0), m.steel))); // hasp
  const lock = new THREE.Group();
  lock.position.set(HX - 0.2, 0, EXIT.z);
  lock.scale.setScalar(1.3);
  const lockBody = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.17), new THREE.MeshStandardMaterial({ color: '#b39549', roughness: 0.35, metalness: 0.85, emissive: '#2a2008' })));
  lockBody.position.y = 0.154;
  const shackle = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 16, Math.PI).rotateY(Math.PI / 2), m.iron));
  shackle.position.y = 0.23;
  lock.add(lockBody, shackle);
  door.add(curtain, bottom, lock);
  const doorPane = new Kit(); // the opening between the jambs counts as the door from a step away
  hitPane(doorPane, DW, DOOR_H, 0, DOOR_H / 2, 0);
  doorPane.group.position.set(PX - 0.15, 0, EXIT.z);
  doorPane.group.rotation.y = -Math.PI / 2;
  door.add(doorPane.group);
  const doorBlock = box({ minX: HX - 0.45, maxX: HX + 0.3, minY: 0, maxY: 14, minZ: D0, maxZ: D1 });
  const roll = (k: number) => { // 1 = shut, 0 = rolled up
    curtain.scale.y = Math.max(0.001, k);
    curtain.visible = k > 0.01;
    shutterMaps.forEach((x) => x.repeat.set(DW / 1.2, (k * DOOR_H) / 1.2));
    bottom.position.y = DOOR_H * (1 - k);
  };
  roll(1);

  // Needle board on legs beside the exit.
  const boardTex = needleBoard();
  const boardKit = new Kit();
  boardKit.add(m.beam, timber(2.5, 1.7, 0.08, 0, 1.85, 0));
  for (const x of [-1.1, 1.1]) boardKit.add(m.beam, timber(0.1, 2.75, 0.1, x, 1.375, -0.07), timber(0.1, 0.08, 0.7, x, 0.04, -0.07));
  const bFace = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshStandardMaterial({ map: boardTex.tex, roughness: 0.9 }));
  bFace.position.set(0, 1.85, 0.045);
  boardKit.group.add(bFace);
  boardKit.solid(-1.25, 1.25, 0, 2.8, -0.42, 0.1);
  const board = boardKit.place(group, box, HX - 1.7, -1.7, -Math.PI / 2);

  // Along the exit wall: the selling kiosk closer to the stack (the far corner made the walk too long),
  // the supply stall past the door.
  const sell = sellBooth(m);
  const counter = sell.kit.place(group, box, 13.4, -8.3, -Math.PI / 2);
  const counterTop = sell.top.clone().applyMatrix4(counter.matrixWorld);
  // The cargo on the belt is the same loose-straw pile the hands and tools show.
  const beltLow = sell.belt.points[0].clone().applyMatrix4(counter.matrixWorld);
  const belt = new Belt(
    sell.belt.points.map((p) => p.clone().applyMatrix4(counter.matrixWorld)),
    (n) => {
      const w = Math.cbrt(n / 15); // the pile grows with the load, like the handful does
      const pile = new HayLoad(Math.round(Math.min(220, 60 * w)), [0.16 * w, 0.1 * w, 0.16 * w], { pile: true, len: [0.05, 0.13], seed: 101 + n });
      pile.set(1);
      pile.mesh.castShadow = false; // cargo shadows would redraw the shadow map every frame
      return pile.mesh;
    },
  );
  group.add(belt.group);
  aFrame(m, priceTexture()).place(group, box, 10.9, -5.4, -Math.PI / 2 + 0.5);
  const shop = supplyStall(m).place(group, box, 13.25, 13.0, -Math.PI / 2);
  aFrame(m, priceListTexture()).place(group, box, 11.6, 9.4, -Math.PI / 2 + 0.3);

  // Clutter: bollards, a tripod and a fern by the door, bales, crates and barrels along the walls.
  const rnd = mulberry32(19);
  const props = new Kit();
  bollard(m, props, HX - 0.8, D0 - 0.6);
  bollard(m, props, HX - 0.8, D1 + 0.6);
  fernPot(m, props, 14.1, 8.6, m.boards);
  const baleStack = (x0: number, z0: number, cols: number, rows: number, layers: number) => { // long side along z
    for (let l = 0; l < layers; l++) for (let i = 0; i < cols - l; i++) for (let j = 0; j < rows; j++) {
      bale(props, m, x0 + j * 0.57 * Math.sign(-x0), l * 0.48, z0 + i * 1.07 + l * 0.53, Math.PI / 2 + (rnd() - 0.5) * 0.08);
    }
    const x1 = x0 + (rows - 1) * 0.57 * Math.sign(-x0);
    props.solid(Math.min(x0, x1) - 0.3, Math.max(x0, x1) + 0.3, 0, layers * 0.48, z0 - 0.55, z0 + (cols - 1) * 1.07 + 0.55);
  };
  baleStack(-14.2, -9.6, 5, 2, 3);
  baleStack(-14.2, 6.3, 3, 2, 2);
  baleStack(-14.2, -20.6, 3, 3, 2);
  baleStack(14.1, -9.0, 3, 2, 2);
  const crate = (x: number, y: number, z: number, s: number, r: number) => {
    props.add(m.boards, worldBox(s, s, s, x, y + s / 2, z, 0.8, r));
    const e = 0.07;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) props.add(m.beam, timber(e, s + 0.01, e, dx * (s / 2 - e / 2), 0, dz * (s / 2 - e / 2)).rotateY(r).translate(x, y + s / 2, z));
    if (y === 0) props.solid(x - s / 2, x + s / 2, 0, s, z - s / 2, z + s / 2);
  };
  crate(-14.0, 0, 12.3, 0.9, 0.1); crate(-13.95, 0.9, 12.35, 0.7, 0.4); crate(-14.05, 0, 13.4, 0.8, -0.2);
  crate(12.4, 0, 7.6, 0.9, 0.3); crate(12.5, 0, 8.9, 0.7, -0.15); // by the door, clear of the kiosk
  crate(-7.4, 0, HZ - 0.9, 0.9, 0.05); crate(-7.3, 0.9, HZ - 0.95, 0.75, -0.2);
  const barrelProf = [[0, 0], [0.3, 0], [0.34, 0.25], [0.36, 0.5], [0.34, 0.75], [0.3, 1.0], [0, 1.0]].map(([a, b]) => new THREE.Vector2(a, b));
  const barrel = (x: number, z: number) => {
    const g = new THREE.LatheGeometry(barrelProf, 18);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i));
    props.add(m.beam, g.translate(x, 0, z));
    for (const [y, r] of [[0.12, 0.315], [0.5, 0.362], [0.88, 0.315]]) props.add(m.iron, new THREE.TorusGeometry(r, 0.018, 4, 24).rotateX(Math.PI / 2).translate(x, y, z));
    props.solid(x - 0.36, x + 0.36, 0, 1, z - 0.36, z + 0.36);
  };
  barrel(-14.0, 14.8); barrel(-13.2, 15.3); barrel(9.0, HZ - 0.9); barrel(-14.1, -17.0);
  // Workbench on the far wall with old tools hanging above it.
  props.add(m.boards, worldBox(0.9, 0.1, 3.0, -14.05, 0.92, 2.7, 0.8), worldBox(0.04, 1.3, 3.0, -14.83, 2.35, 2.7, 1.6));
  for (const [dx, dz] of [[-0.35, -1.35], [0.35, -1.35], [-0.35, 1.35], [0.35, 1.35]]) props.add(m.beam, timber(0.1, 0.88, 0.1, -14.05 + dx, 0.44, 2.7 + dz));
  props.solid(-14.5, -13.6, 0, 0.97, 1.2, 4.2);
  props.place(group, box, 0, 0);
  const hang = (id: 'spade' | 'pitchfork', z: number, tilt: number) => {
    const tool = buildModel(id); // working end up, blade facing the room
    tool.rotation.set(Math.PI / 2, Math.PI / 2, 0, 'YXZ');
    tool.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    const peg = new THREE.Group();
    peg.rotation.x = tilt;
    peg.position.set(-HX + 0.3, 1.75, z);
    peg.add(tool);
    group.add(peg);
  };
  hang('pitchfork', 1.8, 0.05); hang('spade', 2.7, -0.04); hang('spade', 3.4, 0.06);

  // Loose straws on the floor.
  const strawCarpet = floorStraws(6500, BALANCE.stack.radiusM, mulberry32(5), { hx: HX, hz: HZ, counter: [counterTop.x, counterTop.z] });
  group.add(strawCarpet);

  // Outside, and faint dust in the sunlight over the open middle.
  const nature = new Nature(tex, colliders, m.beam, hayMat);
  nature.grassGroup.visible = false;
  group.add(nature.group);
  const yb = rafterY(IN) + 0.2;
  const beams = new Sunbeams([{ corners: [new THREE.Vector3(-IN, yb, -HZ), new THREE.Vector3(IN, yb, -HZ), new THREE.Vector3(IN, yb, HZ), new THREE.Vector3(-IN, yb, HZ)], strength: 0.012 }], SUN_DIR);
  group.add(beams.group);

  // Unlock: the shackle pops, the padlock falls onto the floor, then the door rolls up.
  let openT = -1, clockT = 1, clockText = '';
  const unlock = (instant = false) => {
    if (openT >= 0) return;
    openT = 0;
    colliders.remove(doorBlock);
    nature.grassGroup.visible = true;
    boardTex.draw(NEEDLES.map((n) => n.id));
    if (instant) { openT = 4.9; animate(0.2); }
  };
  const animate = (dt: number): boolean => {
    if (openT < 0 || openT > 5) return false;
    openT += dt;
    shackle.position.y = 0.23 + Math.min(1, openT / 0.25) * 0.04;
    const tip = Math.min(1, Math.max(0, (openT - 0.35) / 0.45));
    lock.rotation.z = tip * tip * (Math.PI / 2); // tips over away from the door
    lock.position.y = tip * 0.045;
    const k = Math.min(1, Math.max(0, (openT - 1.0) / 3.0));
    roll(1 - k * k * (3 - 2 * k));
    return true;
  };
  const pad = (n: number) => String(n).padStart(2, '0');
  const tickClock = (dt: number) => {
    clockT += dt;
    if (clockT < 0.25) return;
    clockT = 0;
    const d = new Date();
    const text = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    if (text !== clockText) { clockText = text; clock.draw(text); }
  };

  return {
    group, counter, shop, door, board, counterTop, belt, beltLow, mats: m,
    spawn: new THREE.Vector3(-2.0, 0, 18.6), spawnYaw: -0.35,
    exited: (x) => x > HX + 1.0,
    inside: (x, z) => Math.abs(x) < HX && Math.abs(z) < HZ,
    setNeedles: (found) => boardTex.draw(found),
    unlock,
    update: (dt, play = true) => {
      nature.update(dt); tickClock(dt);
      if (beams.group.visible) beams.update(dt);
      const doorMoving = animate(dt);
      if (play) belt.update(dt); // the kiosk belt sleeps with the factory: no sales from the pause card
      return doorMoving;
    },
    quality: { grass: nature.grassPatches, floorStraws: strawCarpet, beams: beams.group },
  };
}
