import * as THREE from 'three';
import { Colliders } from './colliders';
import { t } from '../core/i18n';

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

function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2b2219';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#c9a24c';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#f3e3b0';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface Shed {
  group: THREE.Group;
  counter: THREE.Object3D; // ray target for selling
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
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTexture(t('counter.sign')) }));
  sign.position.set(0, 1.9, 0);
  sign.rotation.y = Math.PI; // readable from the stack side
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), beamMat);
  postL.position.set(-0.75, 1.5, 0);
  const postR = postL.clone();
  postR.position.x = 0.75;
  counter.add(body, top, sign, postL, postR);
  colliders.addBox({ minX: 4.5 - 1.3, maxX: 4.5 + 1.3, minY: 0, maxY: 1.08, minZ: 8.6 - 0.53, maxZ: 8.6 + 0.53 });

  return { group, counter, spawn: new THREE.Vector3(1.5, 0, 9.2), spawnYaw: 0 };
}
