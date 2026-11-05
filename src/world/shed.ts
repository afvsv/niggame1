import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Colliders } from './colliders';
import { t } from '../core/i18n';
import { SHOP_ITEMS } from '../data/tools';
import { NEEDLES, NeedleId } from '../data/needles';
import { needleName, needlePerk } from '../ui/needleText';
import { buildModel } from '../tools/models';
import { BALANCE } from '../data/balance';
import { Textures } from '../gfx/assets';
import { mulberry32 } from '../gfx/noise';
import { PBRSet } from '../gfx/pbr';
import { triplanarMaterial } from '../gfx/triplanar';
import { BeamSource, Sunbeams } from '../fx/sunbeams';
import { floorStraws } from './straws';
import { BARN, Nature } from './nature';
import { SUN_DIR } from './sky';
import { scaleUV, timber } from './geo';

const FONT = '"Roboto Condensed Variable", "Arial Narrow", sans-serif';

/** Dark weathered plank sign with light uppercase lettering. */
function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2e241b';
  ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,235,200'},${Math.random() * 0.06})`;
    ctx.fillRect(0, Math.random() * 128, 512, 1 + Math.random() * 2);
  }
  ctx.strokeStyle = 'rgba(239,233,218,.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = '#efe9da';
  ctx.font = `700 64px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Chalk A-frame with the current price per strand. */
function priceTexture(): THREE.CanvasTexture {
  const W = 256, H = 384;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#22272a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(236,230,211,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 10, 1 + Math.random() * 2);
  }
  ctx.fillStyle = '#ece6d3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(`$${BALANCE.hay.pricePerStrand.toFixed(2)}`, W / 2, H / 2 - 30);
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(t('counter.price').toUpperCase(), W / 2, H / 2 + 30);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Chalkboard with pinned paper price tags: the supply board. */
function boardTexture(): THREE.CanvasTexture {
  const W = 1024, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#5b3d24';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2f3a33';
  ctx.fillRect(28, 28, W - 56, H - 56);
  for (let i = 0; i < 1600; i++) { // chalk dust
    ctx.fillStyle = `rgba(236,230,211,${Math.random() * 0.06})`;
    ctx.fillRect(28 + Math.random() * (W - 56), 28 + Math.random() * (H - 56), 2 + Math.random() * 14, 1 + Math.random() * 2);
  }
  ctx.fillStyle = '#ece6d3';
  ctx.font = `700 96px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('shop.sign').toUpperCase(), W / 2, 130);
  ctx.fillRect(W / 2 - 220, 196, 440, 4);
  SHOP_ITEMS.slice(0, 3).forEach((item, i) => {
    ctx.save();
    ctx.translate(200 + i * 312, 410);
    ctx.rotate((i - 1) * 0.06 + (i === 1 ? 0.03 : -0.02));
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(-128, -84, 268, 180);
    ctx.fillStyle = '#efe3c2';
    ctx.fillRect(-134, -92, 268, 180);
    ctx.fillStyle = '#2b241b';
    const name = t(`item.${item.id}`);
    let size = 30;
    do ctx.font = `500 ${size}px ${FONT}`; while (ctx.measureText(name).width > 236 && --size > 16);
    ctx.fillText(name, 0, -36);
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText(`$${item.price}`, 0, 34);
    ctx.fillStyle = '#b5523b';
    ctx.beginPath();
    ctx.arc(0, -78, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Needle board by the exit: six framed slots, filled in as needles are found. */
function needleBoard(): { tex: THREE.CanvasTexture; draw(found: readonly NeedleId[]): void } {
  const W = 1024, H = 680;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const rnd = mulberry32(31);
  const dust = Array.from({ length: 1400 }, () => [rnd() * W, rnd() * H, 2 + rnd() * 14, 1 + rnd() * 2, rnd() * 0.06]);
  const drawNeedle = (id: NeedleId, x: number, y: number, ok: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    ctx.strokeStyle = ok ? '#e8edf0' : 'rgba(236,230,211,.18)';
    ctx.fillStyle = ok ? (id === 'desk_pin' ? '#c8382c' : id === 'hat_pin' ? '#f2e6d8' : '#e8edf0') : 'rgba(236,230,211,.18)';
    ctx.lineCap = 'round';
    ctx.lineWidth = id === 'darning' ? 7 : 5;
    ctx.beginPath();
    if (id === 'bent_pin') { ctx.moveTo(-60, 0); ctx.lineTo(20, 0); ctx.lineTo(60, -22); }
    else if (id === 'safety_pin') { ctx.moveTo(60, -6); ctx.lineTo(-50, -6); ctx.arc(-50, 4, 10, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(60, 14); }
    else if (id === 'desk_pin') { ctx.moveTo(0, 0); ctx.lineTo(40, 0); }
    else { ctx.moveTo(-70, 0); ctx.lineTo(70, 0); }
    ctx.stroke();
    ctx.beginPath();
    if (id === 'bent_pin') ctx.arc(-62, 0, 9, 0, Math.PI * 2);
    else if (id === 'desk_pin') ctx.ellipse(-4, 0, 10, 30, 0, 0, Math.PI * 2);
    else if (id === 'hat_pin') ctx.arc(-72, 0, 16, 0, Math.PI * 2);
    else if (id === 'safety_pin') ctx.rect(56, -12, 18, 30);
    if (id !== 'sewing' && id !== 'darning') ctx.fill();
    else { ctx.lineWidth = 3; ctx.ellipse(-62, 0, 7, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  };
  const draw = (found: readonly NeedleId[]) => {
    ctx.fillStyle = '#4a311d';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#262d29';
    ctx.fillRect(24, 24, W - 48, H - 48);
    for (const [x, y, w, h, a] of dust) { ctx.fillStyle = `rgba(236,230,211,${a})`; ctx.fillRect(x, y, w, h); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const open = found.length >= NEEDLES.length;
    ctx.fillStyle = open ? '#9fcf6b' : '#ece6d3';
    ctx.font = `700 66px ${FONT}`;
    ctx.fillText(t(open ? 'board.open' : 'board.locked').toUpperCase(), W / 2, 92);
    ctx.font = `600 34px ${FONT}`;
    ctx.fillStyle = '#c9c2ab';
    ctx.fillText(t('board.sub', { n: found.length, total: NEEDLES.length }), W / 2, 150);
    NEEDLES.forEach((n, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 60 + col * 304, y = 196 + row * 228;
      const ok = found.includes(n.id);
      ctx.strokeStyle = ok ? '#d4ac3f' : 'rgba(236,230,211,.3)';
      ctx.lineWidth = 3;
      ctx.setLineDash(ok ? [] : [10, 8]);
      ctx.strokeRect(x, y, 280, 206);
      ctx.setLineDash([]);
      drawNeedle(n.id, x + 140, y + 74, ok);
      ctx.fillStyle = ok ? '#ece6d3' : 'rgba(236,230,211,.35)';
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText(ok ? needleName(n.id) : '?', x + 140, y + 148);
      if (ok) {
        ctx.font = `500 24px ${FONT}`;
        ctx.fillStyle = '#9fcf6b';
        ctx.fillText(needlePerk(n.id), x + 140, y + 184);
      }
    });
    tex.needsUpdate = true;
  };
  draw([]);
  return { tex, draw };
}

export interface Shed {
  group: THREE.Group;
  counter: THREE.Object3D; // ray target for selling
  shop: THREE.Object3D; // ray target for the supply board
  door: THREE.Object3D; // the exit doors, lock and bar
  board: THREE.Object3D; // the needle board by the exit
  counterTop: THREE.Vector3;
  spawn: THREE.Vector3;
  spawnYaw: number;
  /** Past this z the player has left the barn. */
  exitZ: number;
  inside(x: number, z: number): boolean;
  /** Shows found needles on the board. */
  setNeedles(found: readonly NeedleId[]): void;
  /** Drops the lock and swings the doors open; `instant` for loading an opened barn. */
  unlock(instant?: boolean): void;
  /** Returns true while something that casts shadows is moving. */
  update(dt: number): boolean;
  /** Parts the graphics settings thin out or hide. */
  quality: { grass: THREE.InstancedMesh[]; floorStraws: THREE.InstancedMesh; beams: THREE.Object3D };
}

const HX = BARN.hx, HZ = BARN.hz; // barn half-sizes, metres
const WALL_H = 10; // eaves
const RIDGE = WALL_H + 6;
const DOOR_W = 4.2; // half width of the exit
const DOOR_H = 7;
const OVER = 0.7; // roof overhang
const BAYS = [-HZ + 0.2, -12.67, -6.33, 0, 6.33, 12.67, HZ - 0.2]; // truss positions along z
const AISLE = 10.5; // x of the inner post rows
const WINDOWS = [-12, -4, 4, 12]; // z of the high windows in the sunny (+x) wall
const WIN = { y0: 5.8, y1: 7.6, w: 1.8 };
const LOFT = { z: -HZ + 5, y: 4.6 };

function pbr(set: PBRSet, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: 0, ...extra });
}

/** Plank walls: interior is bare weathered wood, the outside is faded barn red. Gaps let sunlight through. */
function wallMaterial(set: PBRSet): THREE.MeshStandardMaterial {
  const m = pbr(set, { side: THREE.DoubleSide, alphaTest: 0.5, alphaToCoverage: true });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(2.1, 0.62, 0.5), 0.85);`);
  };
  return m;
}

/** A wall from an outline (x across, y up) with optional rectangular openings, UVs in 2 m tiles. Front faces +z. */
function wallShape(outline: Array<[number, number]>, holes: Array<[number, number, number, number]>, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const [x0, y0, x1, y1] of holes) shape.holes.push(new THREE.Path([new THREE.Vector2(x0, y0), new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y1), new THREE.Vector2(x1, y0)]));
  const m = new THREE.Mesh(scaleUV(new THREE.ShapeGeometry(shape), 0.5, 0.5), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const rect = (x0: number, x1: number, h: number): Array<[number, number]> => [[x0, 0], [x1, 0], [x1, h], [x0, h]];

/** Hanging enamel lamp with a warm bulb; returns the group and the light position. */
function lamp(x: number, y: number, z: number, cord: number, beamMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#2f4a3a', roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide });
  const inner = new THREE.MeshStandardMaterial({ color: '#f3efe2', roughness: 0.5, emissive: '#ffd9a0', emissiveIntensity: 0.25, side: THREE.BackSide });
  const cordM = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, cord, 5), beamMat);
  cordM.position.y = -cord / 2;
  const prof = [[0.05, 0], [0.08, -0.06], [0.2, -0.2], [0.32, -0.3]].map(([a, b]) => new THREE.Vector2(a, b));
  const shade = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), shadeMat);
  const shadeIn = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), inner);
  shade.position.y = shadeIn.position.y = -cord;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshStandardMaterial({ color: '#fff2d0', emissive: '#ffd08a', emissiveIntensity: 3 }));
  bulb.position.y = -cord - 0.17;
  const light = new THREE.PointLight('#ffcf8f', 46, 26, 1.5);
  light.position.y = -cord - 0.3;
  g.add(cordM, shade, shadeIn, bulb, light);
  return g;
}

/** Builds the barn the player is locked in: the stack, the counter, supplies, the exit and the yard outside. */
export function buildShed(scene: THREE.Scene, colliders: Colliders, tex: Textures, hayMat: THREE.Material): Shed {
  const group = new THREE.Group();
  scene.add(group);
  const beamMat = pbr(tex.beam);
  const boardMat = pbr(tex.boards);
  const wallMat = wallMaterial(tex.planks);
  const iron = new THREE.MeshStandardMaterial({ color: '#3b3a38', roughness: 0.55, metalness: 0.75 });
  const shadowed = <T extends THREE.Mesh>(m: T) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }) => { colliders.addBox(b); return b; };

  // Floor: packed dirt.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * HX, 2 * HZ).rotateX(-Math.PI / 2),
    triplanarMaterial({ set: tex.dirt, tile: 3, variation: tex.variation, variationTile: 11, brightness: 0.45, tint: '#c9a35a', tintAmount: 0.6, topOnly: true }),
  );
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  group.add(floor);

  // Walls. Shapes face the interior; colliders are 0.3 m slabs reaching above the roof line.
  const back = wallShape(rect(-HX, HX, WALL_H), [], wallMat);
  back.position.set(0, 0, -HZ);
  const left = wallShape(rect(-HZ, HZ, WALL_H), [], wallMat);
  left.position.set(-HX, 0, 0);
  left.rotation.y = Math.PI / 2;
  const right = wallShape(rect(-HZ, HZ, WALL_H), WINDOWS.map((z) => [z - WIN.w / 2, WIN.y0, z + WIN.w / 2, WIN.y1]), wallMat);
  right.position.set(HX, 0, 0);
  right.rotation.y = -Math.PI / 2; // local x runs along world +z
  const front = wallShape([[-HX, 0], [-DOOR_W, 0], [-DOOR_W, DOOR_H], [DOOR_W, DOOR_H], [DOOR_W, 0], [HX, 0], [HX, WALL_H], [-HX, WALL_H]], [], wallMat);
  front.position.set(0, 0, HZ);
  front.rotation.y = Math.PI;
  const gh = RIDGE - WALL_H;
  const gableWin: [number, number, number, number] = [-0.9, gh * 0.3, 0.9, gh * 0.3 + 1.6];
  const gBack = wallShape([[-HX, 0], [HX, 0], [0, gh]], [gableWin], wallMat);
  gBack.position.set(0, WALL_H, -HZ);
  const gFront = wallShape([[-HX, 0], [HX, 0], [0, gh]], [gableWin], wallMat);
  gFront.position.set(0, WALL_H, HZ);
  gFront.rotation.y = Math.PI;
  group.add(back, left, right, front, gBack, gFront);
  const slab = (minX: number, maxX: number, minZ: number, maxZ: number) => box({ minX, maxX, minY: 0, maxY: RIDGE + 2, minZ, maxZ });
  slab(-HX, HX, -HZ - 0.15, -HZ + 0.15);
  slab(-HX - 0.15, -HX + 0.15, -HZ, HZ);
  slab(HX - 0.15, HX + 0.15, -HZ, HZ);
  slab(-HX, -DOOR_W, HZ - 0.15, HZ + 0.15);
  slab(DOOR_W, HX, HZ - 0.15, HZ + 0.15);
  const doorBlock = box({ minX: -DOOR_W, maxX: DOOR_W, minY: 0, maxY: RIDGE + 2, minZ: HZ - 0.4, maxZ: HZ + 0.15 });

  // Timber frame, merged into one mesh.
  const tim: THREE.BufferGeometry[] = [];
  const P = 0.34, IN = HX - 0.2;
  const post = (x: number, z: number, h = WALL_H, p = P) => {
    tim.push(timber(p, h, p, x, h / 2, z));
    box({ minX: x - p / 2, maxX: x + p / 2, minY: 0, maxY: h, minZ: z - p / 2, maxZ: z + p / 2 });
  };
  for (const z of BAYS) post(-IN, z), post(IN, z);
  for (const z of BAYS.slice(1, -1)) if (z > LOFT.z + 0.5) post(-AISLE, z), post(AISLE, z);
  for (const x of [-AISLE, -5.25, 0, 5.25, AISLE]) post(x, -HZ + 0.2);
  for (const x of [-AISLE, -DOOR_W - 0.22, DOOR_W + 0.22, AISLE]) post(x, HZ - 0.2);
  // Girts on the walls, plates on the posts, the door frame.
  for (const side of [-1, 1]) {
    const x = side * (HX - 0.12);
    for (const y of [3.3, 5.4]) tim.push(timber(0.14, 0.24, 2 * HZ, x, y, 0));
    tim.push(timber(0.3, 0.3, 2 * HZ, side * IN, WALL_H - 0.15, 0)); // wall plate
    tim.push(timber(0.3, 0.34, 2 * 12.67 + 0.4, side * AISLE, WALL_H - 0.17, 0)); // aisle plate
  }
  for (const y of [3.3, 5.4]) {
    tim.push(timber(2 * HX, 0.24, 0.14, 0, y, -HZ + 0.12));
    for (const sx of [-1, 1]) tim.push(timber(HX - DOOR_W - 0.4, 0.24, 0.14, sx * (HX + DOOR_W + 0.4) / 2, y, HZ - 0.12));
  }
  tim.push(timber(2 * DOOR_W + 1, 0.4, 0.34, 0, DOOR_H + 0.2, HZ - 0.2)); // door header
  // Trusses: tie beams where the stack is low, collar ties above it everywhere.
  const pitch = Math.atan2(gh, HX);
  const rafterLen = Math.hypot(HX + OVER, gh * (1 + OVER / HX));
  const roofY = (x: number) => RIDGE - Math.abs(x) * Math.tan(pitch);
  const collarY = WALL_H + 3.4, collarHalf = (RIDGE - collarY) / Math.tan(pitch);
  for (const z of BAYS) {
    const end = Math.abs(z) > HZ - 1;
    if (Math.abs(z) >= 6) {
      tim.push(timber(2 * HX, 0.36, 0.3, 0, WALL_H - 0.1, z)); // tie beam
      tim.push(timber(0.26, gh, 0.26, 0, (WALL_H + RIDGE) / 2, z)); // king post
      for (const s of [-1, 1]) { // struts from the king post to the rafters
        const sx = s * HX * 0.45, sy = roofY(sx) - 0.3;
        tim.push(timber(Math.hypot(sx, sy - WALL_H), 0.18, 0.16, sx / 2, (sy + WALL_H) / 2, z, 1.2, 0, 0, Math.atan2(sy - WALL_H, sx)));
      }
    }
    if (!end) tim.push(timber(2 * collarHalf, 0.28, 0.24, 0, collarY, z));
    // Knee braces between the aisle posts and the plate.
    if (!end && z > LOFT.z + 0.5) for (const s of [-1, 1]) for (const d of [-1, 1]) tim.push(timber(0.14, 1.9, 0.14, s * AISLE, WALL_H - 1.0, z + d * 0.62, 1.2, d * 0.72, 0, 0));
  }
  for (let i = 0; i <= 12; i++) {
    const z = -HZ + 0.2 + (i / 12) * (2 * HZ - 0.4);
    for (const side of [-1, 1]) {
      const cx = side * (HX + OVER) / 2, cy = RIDGE - gh * ((HX + OVER) / HX) / 2 - 0.16;
      tim.push(timber(rafterLen, 0.26, 0.16, cx, cy, z, 1.2, 0, 0, -side * pitch));
    }
  }
  for (const side of [-1, 1]) for (const f of [0.3, 0.62]) { // purlins
    const x = side * HX * f;
    tim.push(timber(0.2, 0.2, 2 * HZ + 2 * OVER, x, roofY(x) - 0.38, 0, 1.2, 0, 0, -side * pitch));
  }
  tim.push(timber(0.28, 0.32, 2 * HZ + 2 * OVER, 0, RIDGE - 0.22, 0)); // ridge beam
  // High window frames with a cross.
  for (const z of WINDOWS) {
    const x = HX - 0.1, w = WIN.w, h = WIN.y1 - WIN.y0, yc = (WIN.y0 + WIN.y1) / 2;
    tim.push(timber(0.2, 0.14, w + 0.3, x, WIN.y0 - 0.07, z), timber(0.2, 0.14, w + 0.3, x, WIN.y1 + 0.07, z));
    tim.push(timber(0.2, h, 0.14, x, yc, z - w / 2 - 0.07), timber(0.2, h, 0.14, x, yc, z + w / 2 + 0.07));
    tim.push(timber(0.08, h, 0.08, x, yc, z), timber(0.08, 0.08, w, x, yc, z));
  }
  // Hayloft along the back wall: deck, joists, railing and a ladder.
  const lw = 2 * HX - 0.4, ld = LOFT.z + HZ;
  for (let x = -HX + 1.6; x < HX - 1; x += 4.2) post(x, LOFT.z, LOFT.y, 0.26);
  tim.push(timber(lw, 0.3, 0.26, 0, LOFT.y - 0.15, LOFT.z));
  for (let x = -HX + 0.6; x < HX; x += 1.4) tim.push(timber(0.12, 0.2, ld, x, LOFT.y - 0.24, -HZ + ld / 2));
  for (let x = -HX + 1.6; x < HX - 1; x += 2.1) tim.push(timber(0.1, 1.0, 0.1, x, LOFT.y + 0.56, LOFT.z + 0.1));
  tim.push(timber(lw, 0.12, 0.1, 0, LOFT.y + 1.05, LOFT.z + 0.1), timber(lw, 0.08, 0.06, 0, LOFT.y + 0.55, LOFT.z + 0.1));
  const ladX = 7.5;
  for (const dx of [-0.26, 0.26]) tim.push(timber(0.08, 5.4, 0.1, ladX + dx, 2.65, LOFT.z + 0.7, 1.2, -0.2, 0, 0));
  for (let i = 0; i < 15; i++) {
    const y = 0.3 + i * 0.34;
    tim.push(timber(0.56, 0.05, 0.05, ladX, y, LOFT.z + 0.7 + 0.2 * (2.65 - y) / 2.6 + 0.16));
  }
  box({ minX: ladX - 0.35, maxX: ladX + 0.35, minY: 0, maxY: 5, minZ: LOFT.z + 0.4, maxZ: LOFT.z + 1.4 });
  // Stall partitions along the left aisle.
  const stall: THREE.BufferGeometry[] = [];
  for (const z of [-6.33, 0, 6.33]) {
    stall.push(scaleUV(new THREE.BoxGeometry(HX - AISLE - 0.4, 1.5, 0.08), 2.6, 0.75).translate(-(HX + AISLE) / 2, 0.75, z));
    tim.push(timber(HX - AISLE - 0.3, 0.12, 0.14, -(HX + AISLE) / 2, 1.56, z));
    box({ minX: -HX, maxX: -AISLE - 0.2, minY: 0, maxY: 1.6, minZ: z - 0.08, maxZ: z + 0.08 });
  }
  const loftDeck = scaleUV(new THREE.BoxGeometry(lw, 0.1, ld), lw / 2.4, ld / 2.4).translate(0, LOFT.y + 0.05, -HZ + ld / 2);
  group.add(shadowed(new THREE.Mesh(mergeGeometries([...stall, loftDeck]), boardMat)));
  const frame = shadowed(new THREE.Mesh(mergeGeometries(tim), beamMat));
  group.add(frame);

  // Roof: board strips along z; a few are missing on purpose so sunbeams fall on the stack.
  const roofTop = new THREE.MeshStandardMaterial({ color: '#5d5f61', roughness: 0.55, metalness: 0.5 });
  const roofParts: THREE.BufferGeometry[] = [];
  const holes: BeamSource[] = [];
  const slope = rafterLen, strips = 16, stripW = (2 * HZ + 2 * OVER) / strips;
  const holeAt: Record<string, [number, number]> = { '1:9': [3.0, 5.2], '1:5': [5.4, 7.2], '-1:11': [2.2, 3.8], '1:13': [8.0, 9.4] };
  for (const side of [-1, 1]) {
    for (let k = 0; k < strips; k++) {
      const z = -HZ - OVER + stripW * (k + 0.5);
      const hole = holeAt[`${side}:${k}`];
      const segs: Array<[number, number]> = hole ? [[0, hole[0]], [hole[1], slope]] : [[0, slope]];
      for (const [a, b] of segs) {
        const g = timber(b - a, 0.08, stripW - 0.01, 0, 0, 0, 2);
        g.translate((a + b) / 2, 0.04, 0);
        g.rotateZ(-pitch);
        if (side < 0) g.scale(-1, 1, 1);
        g.translate(0, RIDGE + 0.02, z);
        roofParts.push(side < 0 ? flipWinding(g) : g);
      }
      if (hole) {
        const pt = (s: number, dz: number) => new THREE.Vector3(side * Math.cos(pitch) * s, RIDGE - Math.sin(pitch) * s - 0.05, z + dz);
        const hz = stripW / 2 - 0.02;
        holes.push({ corners: [pt(hole[0], -hz), pt(hole[1], -hz), pt(hole[1], hz), pt(hole[0], hz)], strength: 0.15 });
      }
    }
  }
  const roofGeo = mergeGeometries(roofParts);
  const roof = shadowed(new THREE.Mesh(roofGeo, [boardMat, roofTop]));
  splitRoofGroups(roofGeo);
  group.add(roof);
  for (const z of WINDOWS) {
    const x = HX - 0.05, h = WIN.w / 2;
    holes.push({ corners: [new THREE.Vector3(x, WIN.y1, z - h), new THREE.Vector3(x, WIN.y1, z + h), new THREE.Vector3(x, WIN.y0, z + h), new THREE.Vector3(x, WIN.y0, z - h)], strength: 0.07 });
  }
  const gw = (x: number, y: number) => new THREE.Vector3(x, WALL_H + y, HZ - 0.05);
  holes.push({ corners: [gw(-0.9, gableWin[3]), gw(0.9, gableWin[3]), gw(0.9, gableWin[1]), gw(-0.9, gableWin[1])], strength: 0.08 });

  // Bales, crates and barrels: merged per material.
  const rnd = mulberry32(19);
  const bales: THREE.BufferGeometry[] = [];
  const bale = (x: number, y: number, z: number, r: number) => {
    const g = new THREE.BoxGeometry(1.1, 0.5, 0.55);
    g.rotateY(r + (rnd() - 0.5) * 0.08);
    bales.push(g.translate(x, y + 0.25, z));
  };
  const baleStack = (x0: number, z0: number, cols: number, rows: number, layers: number, r = false) => {
    for (let l = 0; l < layers; l++) for (let i = 0; i < cols - l; i++) for (let j = 0; j < rows; j++) {
      const a = i * 1.12 + l * 0.56, b = j * 0.57;
      bale(x0 + (r ? b : a), l * 0.5, z0 + (r ? a : b), r ? Math.PI / 2 : 0);
    }
    const w = (cols * 1.12), d = rows * 0.57;
    box({ minX: x0 - 0.6, maxX: x0 + (r ? d : w) - 0.5, minY: 0, maxY: layers * 0.5, minZ: z0 - 0.35, maxZ: z0 + (r ? w : d) - 0.3 });
  };
  baleStack(-HX + 1.2, -3.0, 4, 2, 3); // in the left stalls
  baleStack(-HX + 1.0, 2.2, 3, 3, 2);
  baleStack(-HX + 1.0, 8.6, 4, 2, 2);
  baleStack(HX - 2.0, -HZ + 0.9, 4, 3, 4, true); // back right corner, under the loft
  baleStack(-HX + 0.9, -HZ + 0.9, 3, 2, 2);
  for (let i = 0; i < 24; i++) { // rows of bales up on the loft
    if (rnd() < 0.15) continue;
    const x = -HX + 1.0 + i * 1.15;
    bale(x, LOFT.y + 0.1, -HZ + 0.9, 0);
    if (rnd() < 0.6) bale(x, LOFT.y + 0.6, -HZ + 0.9, 0);
    if (rnd() < 0.5) bale(x, LOFT.y + 0.1, -HZ + 2.2 + rnd() * 0.3, (rnd() - 0.5) * 0.3);
  }
  group.add(shadowed(new THREE.Mesh(mergeGeometries(bales), hayMat)));

  const crates: THREE.BufferGeometry[] = [], crateEdges: THREE.BufferGeometry[] = [];
  const crate = (x: number, y: number, z: number, s: number, r: number) => {
    crates.push(scaleUV(new THREE.BoxGeometry(s, s, s), s / 1.2, s / 1.2).rotateY(r).translate(x, y + s / 2, z));
    const e = 0.07;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) crateEdges.push(timber(e, s + 0.01, e, dx * (s / 2 - e / 2), 0, dz * (s / 2 - e / 2)).rotateY(r).translate(x, y + s / 2, z));
    if (y === 0) box({ minX: x - s / 2, maxX: x + s / 2, minY: 0, maxY: s, minZ: z - s / 2, maxZ: z + s / 2 });
  };
  crate(HX - 1.2, 0, 2.2, 0.9, 0.1); crate(HX - 1.3, 0.9, 2.3, 0.7, 0.4); crate(HX - 1.1, 0, 3.3, 0.8, -0.2);
  crate(HX - 1.0, 0, -8.8, 0.9, 0.3); crate(-HX + 1.4, 0, 14.6, 0.8, 0.2); crate(-HX + 2.4, 0, 15.2, 0.7, -0.3);
  crate(-7.4, 0, HZ - 0.9, 0.9, 0.05); crate(-7.3, 0.9, HZ - 0.95, 0.75, -0.2);
  group.add(shadowed(new THREE.Mesh(mergeGeometries(crates), boardMat)), shadowed(new THREE.Mesh(mergeGeometries(crateEdges), beamMat)));

  const staves: THREE.BufferGeometry[] = [], hoops: THREE.BufferGeometry[] = [];
  const barrelProf = [[0, 0], [0.3, 0], [0.34, 0.25], [0.36, 0.5], [0.34, 0.75], [0.3, 1.0], [0, 1.0]].map(([a, b]) => new THREE.Vector2(a, b));
  const barrel = (x: number, z: number) => {
    staves.push(scaleUV(new THREE.LatheGeometry(barrelProf, 18), 3, 1).translate(x, 0, z));
    for (const [y, r] of [[0.12, 0.315], [0.5, 0.362], [0.88, 0.315]]) hoops.push(new THREE.TorusGeometry(r, 0.018, 4, 24).rotateX(Math.PI / 2).translate(x, y, z));
    box({ minX: x - 0.36, maxX: x + 0.36, minY: 0, maxY: 1, minZ: z - 0.36, maxZ: z + 0.36 });
  };
  barrel(HX - 1.0, 5.2); barrel(HX - 1.8, 5.6); barrel(HX - 1.1, -10.6); barrel(-HX + 1.1, 16.2); barrel(8.6, HZ - 0.8);
  group.add(shadowed(new THREE.Mesh(mergeGeometries(staves), beamMat)), shadowed(new THREE.Mesh(mergeGeometries(hoops), iron)));

  // Workbench by the right wall with old tools hanging above it.
  const bench = new THREE.Group();
  bench.position.set(HX - 0.75, 0, -3.2);
  const benchTop = shadowed(new THREE.Mesh(scaleUV(new THREE.BoxGeometry(0.9, 0.1, 3.2), 0.8, 2.6), boardMat));
  benchTop.position.y = 0.92;
  bench.add(benchTop);
  for (const [dx, dz] of [[-0.35, -1.45], [0.35, -1.45], [-0.35, 1.45], [0.35, 1.45]]) {
    const leg = shadowed(new THREE.Mesh(timberGeo(0.1, 0.88, 0.1), beamMat));
    leg.position.set(dx, 0.44, dz);
    bench.add(leg);
  }
  group.add(bench);
  box({ minX: HX - 1.2, maxX: HX - 0.3, minY: 0, maxY: 0.97, minZ: -4.8, maxZ: -1.6 });
  const hang = (id: 'spade' | 'pitchfork' | 'toy_shovel', z: number, tilt: number) => {
    const m = buildModel(id); // working end up, blade facing the room
    m.rotation.set(Math.PI / 2, -Math.PI / 2, 0, 'YXZ');
    const peg = new THREE.Group();
    peg.rotation.x = tilt;
    peg.position.set(HX - 0.2, 1.4, z);
    peg.add(m);
    m.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    group.add(peg);
    return;
  };
  hang('pitchfork', -4.2, 0.05); hang('spade', -3.3, -0.04); hang('spade', -2.6, 0.06);

  // Loose straws on the floor.
  const counterPos = new THREE.Vector3(5.6, 0, 12.4);
  const strawCarpet = floorStraws(6500, BALANCE.stack.radiusM, mulberry32(5), { hx: HX, hz: HZ, counter: [counterPos.x, counterPos.z] });
  group.add(strawCarpet);

  // Selling counter in the front area, facing the stack.
  const counter = new THREE.Group();
  counter.position.copy(counterPos);
  group.add(counter);
  const body = shadowed(new THREE.Mesh(scaleUV(new THREE.BoxGeometry(2.4, 1.0, 0.9), 1.2, 0.5), boardMat));
  body.position.y = 0.5;
  const top = shadowed(new THREE.Mesh(timberGeo(2.6, 0.08, 1.05), beamMat));
  top.position.y = 1.04;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: signTexture(t('counter.sign')), roughness: 0.85 }));
  sign.position.set(0, 1.9, 0);
  sign.rotation.y = Math.PI; // readable from the stack side
  const signBack = shadowed(new THREE.Mesh(timberGeo(1.66, 0.46, 0.04), beamMat));
  signBack.position.set(0, 1.9, 0.025);
  const postL = shadowed(new THREE.Mesh(timberGeo(0.08, 0.9, 0.08), beamMat));
  postL.position.set(-0.75, 1.5, 0.03);
  const postR = postL.clone();
  postR.position.x = 0.75;
  counter.add(body, top, sign, signBack, postL, postR);
  box({ minX: counterPos.x - 1.3, maxX: counterPos.x + 1.3, minY: 0, maxY: 1.08, minZ: counterPos.z - 0.53, maxZ: counterPos.z + 0.53 });

  // Chalk A-frame with the price, between the stack and the counter.
  const aframe = new THREE.Group();
  aframe.position.set(3.6, 0, 11.3);
  aframe.rotation.y = Math.PI - 0.35;
  const chalk = new THREE.MeshStandardMaterial({ map: priceTexture(), roughness: 0.95 });
  for (const side of [1, -1]) {
    const leaf = new THREE.Group();
    leaf.position.set(0, 0, side * 0.22);
    leaf.rotation.x = -side * 0.24;
    const backBoard = shadowed(new THREE.Mesh(timberGeo(0.62, 0.92, 0.025), beamMat));
    backBoard.position.y = 0.46;
    leaf.add(backBoard);
    if (side === 1) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.82), chalk);
      face.position.set(0, 0.47, 0.014);
      leaf.add(face);
    }
    aframe.add(leaf);
  }
  group.add(aframe);
  box({ minX: 3.6 - 0.38, maxX: 3.6 + 0.38, minY: 0, maxY: 0.95, minZ: 11.3 - 0.3, maxZ: 11.3 + 0.3 });

  // Supply board on the other side, facing the stack.
  const shop = new THREE.Group();
  const shopPos = new THREE.Vector3(-5.6, 0, 12.4);
  shop.position.copy(shopPos);
  group.add(shop);
  for (const x of [-0.9, 0.9]) {
    const p = shadowed(new THREE.Mesh(timberGeo(0.1, 2.3, 0.1), beamMat));
    p.position.set(x, 1.15, 0);
    shop.add(p);
  }
  const frameBox = shadowed(new THREE.Mesh(timberGeo(1.9, 1.2, 0.05), beamMat));
  frameBox.position.set(0, 1.55, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.19), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.9 }));
  face.position.set(0, 1.55, -0.03);
  face.rotation.y = Math.PI;
  const visor = shadowed(new THREE.Mesh(timberGeo(2.1, 0.06, 0.3), beamMat));
  visor.position.set(0, 2.28, -0.05);
  visor.rotation.x = -0.15;
  shop.add(frameBox, face, visor);
  box({ minX: shopPos.x - 0.96, maxX: shopPos.x + 0.96, minY: 0, maxY: 2.3, minZ: shopPos.z - 0.08, maxZ: shopPos.z + 0.08 });

  // The exit: two heavy doors barred and padlocked, a sign above and the needle board beside.
  const door = new THREE.Group();
  group.add(door);
  const leaves: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(s * DOOR_W, 0, HZ);
    const leaf = new THREE.Group();
    leaf.position.x = -s * DOOR_W / 2;
    hinge.add(leaf);
    const panel = shadowed(new THREE.Mesh(scaleUV(new THREE.BoxGeometry(DOOR_W - 0.012, DOOR_H - 0.04, 0.12), DOOR_W / 1.6, DOOR_H / 1.6), boardMat));
    panel.position.y = DOOR_H / 2;
    leaf.add(panel);
    const brace: THREE.BufferGeometry[] = [];
    for (const y of [0.5, DOOR_H / 2, DOOR_H - 0.5]) brace.push(timber(DOOR_W - 0.2, 0.26, 0.08, 0, y, -0.1));
    const diag = Math.hypot(DOOR_W - 0.5, DOOR_H / 2 - 0.6);
    for (const [y0, y1] of [[0.5, DOOR_H / 2], [DOOR_H / 2, DOOR_H - 0.5]]) brace.push(timber(diag, 0.22, 0.07, 0, (y0 + y1) / 2, -0.1, 1.2, 0, 0, s * Math.atan2(y1 - y0, DOOR_W - 0.5)));
    leaf.add(shadowed(new THREE.Mesh(mergeGeometries(brace), beamMat)));
    for (const y of [0.9, DOOR_H - 0.9]) { // hinge straps
      const strap = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.03), iron));
      strap.position.set(s * (DOOR_W / 2 - 0.8), y, -0.16);
      leaf.add(strap);
    }
    for (const y of [2.75, 3.65]) { // brackets for the bar
      const br = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.34), iron));
      br.position.set(-s * (DOOR_W / 2 - 1.0), y, -0.3);
      leaf.add(br);
    }
    door.add(hinge);
    leaves.push(hinge);
  }
  const bar = shadowed(new THREE.Mesh(timberGeo(2 * DOOR_W + 0.6, 0.26, 0.22), beamMat));
  bar.position.set(0, 3.2, HZ - 0.45);
  const lock = new THREE.Group();
  lock.position.set(0, 3.2, HZ - 0.6);
  lock.scale.setScalar(1.7);
  const links: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) { // chain wrapped around the bar, hanging down to the lock
    const a = (i / 9) * Math.PI * 2;
    links.push(new THREE.TorusGeometry(0.05, 0.012, 5, 10).rotateY(i % 2 ? Math.PI / 2 : 0).rotateX(a).translate(0, Math.sin(a) * 0.1, 0.09 + Math.cos(a) * 0.1));
  }
  for (let i = 0; i < 3; i++) links.push(new THREE.TorusGeometry(0.05, 0.012, 5, 10).rotateY(i % 2 ? Math.PI / 2 : 0).translate(0, -0.22 - i * 0.08, -0.08));
  lock.add(shadowed(new THREE.Mesh(mergeGeometries(links), iron)));
  const lockBody = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.09), new THREE.MeshStandardMaterial({ color: '#b39549', roughness: 0.35, metalness: 0.85, emissive: '#2a2008' })));
  lockBody.position.set(0, -0.62, -0.08);
  const shackle = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 16, Math.PI), iron));
  shackle.position.set(0, -0.51, -0.08);
  lock.add(lockBody, shackle);
  door.add(bar, lock);
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: signTexture(t('exit.sign')), roughness: 0.85 }));
  exitSign.position.set(0, DOOR_H + 1.0, HZ - 0.08);
  exitSign.rotation.y = Math.PI;
  group.add(exitSign);

  const boardTex = needleBoard();
  const board = new THREE.Group();
  board.position.set(DOOR_W + 2.6, 1.75, HZ - 0.1);
  board.rotation.y = Math.PI;
  const bFrame = shadowed(new THREE.Mesh(timberGeo(2.5, 1.7, 0.08), beamMat));
  const bFace = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshStandardMaterial({ map: boardTex.tex, roughness: 0.9 }));
  bFace.position.z = 0.045;
  board.add(bFrame, bFace);
  group.add(board);

  // Lamps over the front area and the back of the barn.
  group.add(lamp(-5.6, WALL_H - 0.1, 12.67, 2.4, beamMat), lamp(5.6, WALL_H - 0.1, 12.67, 2.4, beamMat), lamp(0, WALL_H - 0.1, -12.67, 2.8, beamMat));

  // Outside, light and dust.
  const nature = new Nature(tex, colliders, beamMat, hayMat);
  nature.grassGroup.visible = false;
  group.add(nature.group);
  const beams = new Sunbeams(holes, SUN_DIR);
  const doorBeam = new Sunbeams([{ corners: [new THREE.Vector3(-DOOR_W, DOOR_H, HZ), new THREE.Vector3(DOOR_W, DOOR_H, HZ), new THREE.Vector3(DOOR_W, 0.01, HZ), new THREE.Vector3(-DOOR_W, 0.01, HZ)], strength: 0.035 }], SUN_DIR);
  doorBeam.group.visible = false;
  beams.group.add(doorBeam.group);
  group.add(beams.group);

  // Unlock animation: the padlock and chain drop, the bar falls aside, the doors swing out.
  let openT = -1, lockVy = 0, barVy = 0;
  const unlock = (instant = false) => {
    if (openT >= 0) return;
    openT = 0;
    colliders.remove(doorBlock);
    nature.grassGroup.visible = true;
    doorBeam.group.visible = true;
    boardTex.draw(NEEDLES.map((n) => n.id));
    if (instant) { // straight to the end state
      lock.position.y = 1.25;
      bar.position.set(0, 0.13, HZ - 1.65);
      bar.rotation.y = 0.35;
      openT = 3.9;
      animate(0.01);
    }
  };
  const animate = (dt: number): boolean => {
    if (openT < 0 || openT > 6) return false;
    openT += dt;
    if (lock.position.y > 1.25) { lockVy -= 18 * dt; lock.position.y = Math.max(1.25, lock.position.y + lockVy * dt); lock.rotation.z += dt * 2; }
    if (openT > 0.5 && bar.position.y > 0.13) {
      barVy -= 18 * dt;
      bar.position.y = Math.max(0.13, bar.position.y + barVy * dt);
      bar.position.z = HZ - 0.45 - Math.min(1, openT - 0.5) * 1.2;
      bar.rotation.y = Math.min(1, openT - 0.5) * 0.35;
    }
    const k = Math.min(1, Math.max(0, (openT - 1.3) / 2.6));
    const a = (1 - (1 - k) ** 3) * 1.75;
    leaves[0].rotation.y = -a;
    leaves[1].rotation.y = a;
    return true;
  };

  return {
    group, counter, shop, door, board, counterTop: new THREE.Vector3(counterPos.x, 1.12, counterPos.z),
    spawn: new THREE.Vector3(0.5, 0, 15.6), spawnYaw: 0, exitZ: HZ + 1.0,
    inside: (x, z) => Math.abs(x) < HX && Math.abs(z) < HZ,
    setNeedles: (found) => boardTex.draw(found),
    unlock,
    update: (dt) => { nature.update(dt); if (beams.group.visible) beams.update(dt); return animate(dt); },
    quality: { grass: nature.grassPatches, floorStraws: strawCarpet, beams: beams.group },
  };
}

function timberGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  return timber(w, h, d, 0, 0, 0, 1.2);
}

/** Mirroring a geometry flips its triangles; restore counter-clockwise order. */
function flipWinding(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.getIndex()!;
  for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  return g;
}

/** Roof boards: upward-facing triangles get the metal sheet material (group 1), the rest show wood. */
function splitRoofGroups(g: THREE.BufferGeometry): void {
  const idx = g.getIndex()!, n = g.getAttribute('normal') as THREE.BufferAttribute;
  const under: number[] = [], over: number[] = [];
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    (n.getY(a) > 0.5 ? over : under).push(a, idx.getX(i + 1), idx.getX(i + 2));
  }
  g.setIndex([...under, ...over]);
  g.clearGroups();
  g.addGroup(0, under.length, 0);
  g.addGroup(under.length, over.length, 1);
}
