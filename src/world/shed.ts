import * as THREE from 'three';
import { Colliders } from './colliders';
import { t } from '../core/i18n';
import { SHOP_ITEMS } from '../data/tools';
import { BALANCE } from '../data/balance';

const FONT = '"Roboto Condensed Variable", "Arial Narrow", sans-serif';

function noiseTexture(base: string, dots: string[], size = 256, count = 5000): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = dots[i % dots.length];
    ctx.globalAlpha = 0.25 + Math.random() * 0.4;
    const r = Math.random() * 2.2;
    ctx.fillRect(Math.random() * size, Math.random() * size, r, r);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function planksTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    const l = 30 + Math.random() * 14;
    ctx.fillStyle = `hsl(28, 32%, ${l}%)`;
    ctx.fillRect(i * 32, 0, 32, 256);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(i * 32, 0, 2, 256);
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      ctx.fillRect(i * 32 + Math.random() * 30, Math.random() * 256, 1, 10 + Math.random() * 40);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
}

const HALF = 11; // shed half-size, metres
const WALL_H = 10;

/** Builds the barn, the yard floor, lighting and the selling counter. Registers colliders. */
export function buildShed(scene: THREE.Scene, colliders: Colliders): Shed {
  const group = new THREE.Group();
  scene.add(group);

  scene.background = new THREE.Color('#9cc3e0');
  scene.fog = new THREE.Fog('#9cc3e0', 40, 120);
  scene.add(new THREE.HemisphereLight('#fff4dc', '#5a4a33', 1.6));
  const sun = new THREE.DirectionalLight('#fff1d0', 1.6);
  sun.position.set(12, 25, 30);
  scene.add(sun);

  // Ground: dirt inside, grass outside.
  const dirt = noiseTexture('#7d6446', ['#5e4a33', '#9a7f5c', '#6b553b']);
  dirt.repeat.set(12, 12);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), new THREE.MeshLambertMaterial({ map: dirt }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  group.add(floor);
  const grassTex = noiseTexture('#6f8f45', ['#5a7a37', '#86a556', '#4d6b2e']);
  grassTex.repeat.set(60, 60);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ map: grassTex }));
  grass.rotation.x = -Math.PI / 2;
  group.add(grass);

  // Walls (back + sides), open front at +Z.
  const wood = planksTexture();
  const wallMat = new THREE.MeshLambertMaterial({ map: wood });
  const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, collide = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    group.add(m);
    if (collide) colliders.addBox({ minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  };
  wood.repeat.set(4, 2);
  addBox(2 * HALF, WALL_H, 0.3, 0, WALL_H / 2, -HALF, wallMat);
  addBox(0.3, WALL_H, 2 * HALF, -HALF, WALL_H / 2, 0, wallMat);
  addBox(0.3, WALL_H, 2 * HALF, HALF, WALL_H / 2, 0, wallMat);

  // Roof with a few beams and posts.
  const beamMat = new THREE.MeshLambertMaterial({ color: '#4a3826' });
  const roofMat = new THREE.MeshLambertMaterial({ color: '#6d6f73', side: THREE.DoubleSide });
  for (let i = -1; i <= 1; i++) addBox(2 * HALF, 0.35, 0.35, 0, WALL_H - 0.2, i * 7, beamMat, false);
  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(HALF * 1.12, 0.15, 2 * HALF + 0.6), roofMat);
    roof.position.set(side * HALF / 2, WALL_H + 1.6, 0);
    roof.rotation.z = -side * 0.3;
    group.add(roof);
  }
  for (const x of [-HALF + 0.2, HALF - 0.2]) addBox(0.4, WALL_H, 0.4, x, WALL_H / 2, HALF - 0.2, beamMat);

  // Selling counter near the front.
  const counter = new THREE.Group();
  counter.position.set(4.5, 0, 8.6);
  group.add(counter);
  const counterWood = new THREE.MeshLambertMaterial({ color: '#7a5634' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.9), counterWood);
  body.position.y = 0.5;
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.05), new THREE.MeshLambertMaterial({ color: '#a37a4c' }));
  top.position.y = 1.04;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshLambertMaterial({ map: signTexture(t('counter.sign')) }));
  sign.position.set(0, 1.9, 0);
  sign.rotation.y = Math.PI; // readable from the stack side
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), beamMat);
  postL.position.set(-0.75, 1.5, 0);
  const postR = postL.clone();
  postR.position.x = 0.75;
  counter.add(body, top, sign, postL, postR);
  colliders.addBox({ minX: 4.5 - 1.3, maxX: 4.5 + 1.3, minY: 0, maxY: 1.08, minZ: 8.6 - 0.53, maxZ: 8.6 + 0.53 });

  // Chalk A-frame with the price, between the stack and the counter.
  const aframe = new THREE.Group();
  aframe.position.set(2.7, 0, 7.7);
  aframe.rotation.y = Math.PI - 0.35; // faces the stack, angled towards the middle
  const chalk = new THREE.MeshLambertMaterial({ map: priceTexture() });
  for (const side of [1, -1]) {
    const leaf = new THREE.Group();
    leaf.position.set(0, 0, side * 0.22);
    leaf.rotation.x = -side * 0.24; // leaves meet at the top
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.025), counterWood);
    back.position.y = 0.46;
    leaf.add(back);
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
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 0.1), beamMat);
    post.position.set(x, 1.15, 0);
    shop.add(post);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 0.05), counterWood);
  frame.position.set(0, 1.55, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.19), new THREE.MeshLambertMaterial({ map: boardTexture() }));
  face.position.set(0, 1.55, -0.03);
  face.rotation.y = Math.PI;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.3), beamMat);
  visor.position.set(0, 2.28, -0.05);
  visor.rotation.x = -0.15;
  shop.add(frame, face, visor);
  colliders.addBox({ minX: -4.5 - 0.96, maxX: -4.5 + 0.96, minY: 0, maxY: 2.3, minZ: 8.6 - 0.08, maxZ: 8.6 + 0.08 });

  return { group, counter, shop, spawn: new THREE.Vector3(1.5, 0, 9.2), spawnYaw: 0 };
}
