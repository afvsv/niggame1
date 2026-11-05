import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Colliders } from './colliders';
import { t } from '../core/i18n';
import { SHOP_ITEMS } from '../data/tools';
import { BALANCE } from '../data/balance';
import { Textures } from '../gfx/assets';
import { mulberry32 } from '../gfx/noise';
import { PBRSet } from '../gfx/pbr';
import { triplanarMaterial } from '../gfx/triplanar';
import { BeamSource, Sunbeams } from '../fx/sunbeams';
import { floorStraws } from './straws';
import { BARN_HALF, Nature } from './nature';
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

export interface Shed {
  group: THREE.Group;
  counter: THREE.Object3D; // ray target for selling
  shop: THREE.Object3D; // ray target for the supply board
  spawn: THREE.Vector3;
  spawnYaw: number;
  update(dt: number): void;
}

const HALF = BARN_HALF; // barn half-size, metres
const WALL_H = 10; // eaves
const RIDGE = WALL_H + 4.4;
const DOOR_W = 5; // half width of the doorway
const DOOR_H = 8;
const OVER = 0.7; // roof overhang

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

/** A vertical wall plane facing +normal (interior side), UVs in 2 m tiles. */
function wallPlane(w: number, h: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(w, h), w / 2, h / 2), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Triangle above the eaves, base on y = 0 of the mesh, facing +z. */
function gable(w: number, h: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, 0, h, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([-w / 4, 0, w / 4, 0, 0, h / 2], 2));
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Builds the barn, the yard, the selling counter and the supply board. Registers colliders. */
export function buildShed(scene: THREE.Scene, colliders: Colliders, tex: Textures, hayMat: THREE.Material): Shed {
  const group = new THREE.Group();
  scene.add(group);
  const beamMat = pbr(tex.beam);
  const boardMat = pbr(tex.boards);
  const wallMat = wallMaterial(tex.planks);
  const shadowed = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // Floor: packed dirt inside the barn.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * HALF, 2 * HALF).rotateX(-Math.PI / 2),
    triplanarMaterial({ set: tex.dirt, tile: 3, variation: tex.variation, variationTile: 11, brightness: 0.45, tint: '#c9a35a', tintAmount: 0.6, topOnly: true }),
  );
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  group.add(floor);

  // Walls. Planes face the interior; colliders are 0.3 m slabs.
  const back = wallPlane(2 * HALF, WALL_H, wallMat);
  back.position.set(0, WALL_H / 2, -HALF);
  const left = wallPlane(2 * HALF, WALL_H, wallMat);
  left.position.set(-HALF, WALL_H / 2, 0);
  left.rotation.y = Math.PI / 2;
  const right = wallPlane(2 * HALF, WALL_H, wallMat);
  right.position.set(HALF, WALL_H / 2, 0);
  right.rotation.y = -Math.PI / 2;
  const sideW = HALF - DOOR_W;
  const frontL = wallPlane(sideW, WALL_H, wallMat);
  frontL.position.set(-HALF + sideW / 2, WALL_H / 2, HALF);
  frontL.rotation.y = Math.PI;
  const frontR = frontL.clone();
  frontR.position.x = HALF - sideW / 2;
  const header = wallPlane(2 * DOOR_W, WALL_H - DOOR_H, wallMat);
  header.position.set(0, (WALL_H + DOOR_H) / 2, HALF);
  header.rotation.y = Math.PI;
  const gBack = gable(2 * HALF, RIDGE - WALL_H, wallMat);
  gBack.position.set(0, WALL_H, -HALF);
  const gFront = gable(2 * HALF, RIDGE - WALL_H, wallMat);
  gFront.position.set(0, WALL_H, HALF);
  gFront.rotation.y = Math.PI;
  group.add(back, left, right, frontL, frontR, header, gBack, gFront);
  const slab = (minX: number, maxX: number, minZ: number, maxZ: number) => colliders.addBox({ minX, maxX, minY: 0, maxY: WALL_H + 5, minZ, maxZ });
  slab(-HALF, HALF, -HALF - 0.15, -HALF + 0.15);
  slab(-HALF - 0.15, -HALF + 0.15, -HALF, HALF);
  slab(HALF - 0.15, HALF + 0.15, -HALF, HALF);
  slab(-HALF, -DOOR_W, HALF - 0.15, HALF + 0.15);
  slab(DOOR_W, HALF, HALF - 0.15, HALF + 0.15);

  // Timber frame, merged into one mesh.
  const tim: THREE.BufferGeometry[] = [];
  const P = 0.32, IN = HALF - 0.2;
  const posts: Array<[number, number]> = [];
  for (const z of [-IN, -5.5, 0, 5.5, IN]) posts.push([-IN, z], [IN, z]);
  for (const x of [-5.5, 0, 5.5]) posts.push([x, -IN]);
  posts.push([-DOOR_W - 0.2, IN], [DOOR_W + 0.2, IN]);
  for (const [x, z] of posts) {
    tim.push(timber(P, WALL_H, P, x, WALL_H / 2, z));
    colliders.addBox({ minX: x - P / 2, maxX: x + P / 2, minY: 0, maxY: WALL_H, minZ: z - P / 2, maxZ: z + P / 2 });
  }
  for (const side of [-1, 1]) {
    const x = side * (HALF - 0.12);
    for (const y of [3.3, 6.7]) tim.push(timber(0.14, 0.24, 2 * HALF, x, y, 0));
    tim.push(timber(0.3, 0.3, 2 * HALF, side * IN, WALL_H - 0.15, 0)); // top plate
  }
  for (const y of [3.3, 6.7]) {
    tim.push(timber(2 * HALF, 0.24, 0.14, 0, y, -HALF + 0.12));
    for (const sx of [-1, 1]) tim.push(timber(sideW, 0.24, 0.14, sx * (HALF - sideW / 2), y, HALF - 0.12));
  }
  tim.push(timber(2 * DOOR_W + 0.8, 0.34, 0.3, 0, DOOR_H + 0.17, IN)); // door header
  const pitch = Math.atan2(RIDGE - WALL_H, HALF);
  const rafterLen = Math.hypot(HALF + OVER, (RIDGE - WALL_H) * (1 + OVER / HALF));
  for (const z of [-IN, -5.5, 0, 5.5, IN, -8.25, -2.75, 2.75, 8.25]) {
    const main = Math.abs(z) === IN || Math.abs(z) === 5.5 || z === 0;
    if (main) {
      tim.push(timber(2 * HALF, 0.34, 0.3, 0, WALL_H - 0.1, z)); // tie beam
      tim.push(timber(0.24, RIDGE - WALL_H, 0.24, 0, (WALL_H + RIDGE) / 2, z)); // king post
    }
    for (const side of [-1, 1]) {
      const cx = side * (HALF + OVER) / 2, cy = RIDGE - (RIDGE - WALL_H) * ((HALF + OVER) / HALF) / 2 - 0.16;
      tim.push(timber(rafterLen, 0.24, 0.16, cx, cy, z, 1.2, 0, 0, -side * pitch));
    }
  }
  tim.push(timber(0.26, 0.3, 2 * HALF + 2 * OVER, 0, RIDGE - 0.2, 0)); // ridge beam
  // A ladder against the left wall, up to the hay loft beams.
  for (const dz of [-0.24, 0.24]) tim.push(timber(0.07, 6.2, 0.09, -HALF + 0.55, 3.05, -2 + dz, 1.2, 0, 0, 0.12));
  for (let i = 0; i < 18; i++) {
    const y = 0.3 + i * 0.34;
    tim.push(timber(0.05, 0.05, 0.5, -HALF + 0.55 - 0.12 * (y - 3.05), y, -2, 1.2));
  }
  const frame = shadowed(new THREE.Mesh(mergeGeometries(tim), beamMat));
  group.add(frame);

  // Roof: board strips along z; a few are missing on purpose so sunbeams fall on the stack.
  const roofTop = new THREE.MeshStandardMaterial({ color: '#5d5f61', roughness: 0.55, metalness: 0.5 });
  const roofParts: THREE.BufferGeometry[] = [];
  const holes: BeamSource[] = [];
  const slope = rafterLen, strips = 12, stripW = (2 * HALF + 2 * OVER) / strips;
  const holeAt: Record<string, [number, number]> = { '1:3': [3.1, 5.1], '1:7': [4.4, 6.0], '-1:5': [2.6, 4.0] };
  for (const side of [-1, 1]) {
    for (let k = 0; k < strips; k++) {
      const z = -HALF - OVER + stripW * (k + 0.5);
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
        holes.push({ corners: [pt(hole[0], -hz), pt(hole[1], -hz), pt(hole[1], hz), pt(hole[0], hz)], strength: 0.16 });
      }
    }
  }
  const roofGeo = mergeGeometries(roofParts);
  const roof = shadowed(new THREE.Mesh(roofGeo, [boardMat, roofTop]));
  splitRoofGroups(roofGeo);
  group.add(roof);

  // Square bales stacked by the back-left corner and along the right wall.
  const baleGeo = new THREE.BoxGeometry(1.1, 0.5, 0.55);
  const rnd = mulberry32(19);
  const bale = (x: number, y: number, z: number, r: number) => {
    const m = shadowed(new THREE.Mesh(baleGeo, hayMat));
    m.position.set(x, y + 0.25, z);
    m.rotation.y = r + (rnd() - 0.5) * 0.08;
    group.add(m);
  };
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) for (let j = 0; j < 2; j++) bale(-9.6 + i * 1.12 + row * 0.56, row * 0.5, -9.9 + j * 0.57, 0);
  colliders.addBox({ minX: -10.2, maxX: -5.4, minY: 0, maxY: 1.5, minZ: -10.2, maxZ: -9.3 });
  for (let i = 0; i < 3; i++) bale(9.9, 0, 3 + i * 1.12, Math.PI / 2);
  bale(9.9, 0.5, 3.56, Math.PI / 2);
  bale(9.9, 0.5, 4.68, Math.PI / 2);
  colliders.addBox({ minX: 9.5, maxX: 10.3, minY: 0, maxY: 1.0, minZ: 2.4, maxZ: 5.9 });

  // Loose straws on the floor.
  group.add(floorStraws(4200, BALANCE.stack.radiusM, mulberry32(5)));

  // Selling counter near the front.
  const counter = new THREE.Group();
  counter.position.set(4.5, 0, 8.6);
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
  colliders.addBox({ minX: 4.5 - 1.3, maxX: 4.5 + 1.3, minY: 0, maxY: 1.08, minZ: 8.6 - 0.53, maxZ: 8.6 + 0.53 });

  // Chalk A-frame with the price, between the stack and the counter.
  const aframe = new THREE.Group();
  aframe.position.set(2.7, 0, 7.7);
  aframe.rotation.y = Math.PI - 0.35; // faces the stack, angled towards the middle
  const chalk = new THREE.MeshStandardMaterial({ map: priceTexture(), roughness: 0.95 });
  for (const side of [1, -1]) {
    const leaf = new THREE.Group();
    leaf.position.set(0, 0, side * 0.22);
    leaf.rotation.x = -side * 0.24; // leaves meet at the top
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
  colliders.addBox({ minX: 2.7 - 0.38, maxX: 2.7 + 0.38, minY: 0, maxY: 0.95, minZ: 7.7 - 0.3, maxZ: 7.7 + 0.3 });

  // Supply board on the other side of the entrance, facing the stack.
  const shop = new THREE.Group();
  shop.position.set(-4.5, 0, 8.6);
  group.add(shop);
  for (const x of [-0.9, 0.9]) {
    const post = shadowed(new THREE.Mesh(timberGeo(0.1, 2.3, 0.1), beamMat));
    post.position.set(x, 1.15, 0);
    shop.add(post);
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
  colliders.addBox({ minX: -4.5 - 0.96, maxX: -4.5 + 0.96, minY: 0, maxY: 2.3, minZ: 8.6 - 0.08, maxZ: 8.6 + 0.08 });

  // Outside, light and dust.
  const nature = new Nature(tex, colliders, beamMat, hayMat);
  group.add(nature.group);
  const door = { corners: [new THREE.Vector3(-DOOR_W, DOOR_H, HALF), new THREE.Vector3(DOOR_W, DOOR_H, HALF), new THREE.Vector3(DOOR_W, 0.01, HALF), new THREE.Vector3(-DOOR_W, 0.01, HALF)], strength: 0.035 };
  const beams = new Sunbeams([...holes, door], SUN_DIR);
  group.add(beams.group);

  return {
    group, counter, shop, spawn: new THREE.Vector3(1.5, 0, 9.2), spawnYaw: 0,
    update: (dt) => { nature.update(dt); beams.update(dt); },
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
