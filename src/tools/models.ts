import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ItemId } from '../data/tools';

// Tool models built in code. Convention: the grip sits near the origin, the working end
// points to -Z, +Y is up. Units are metres. Bare hands have no model: the player only
// sees the straws they hold (like the reference game).

// ---------- materials ----------
function woodTexture(base: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 70; i++) { // grain runs along the handle (canvas Y = cylinder height)
    const x = Math.random() * 128;
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '60,35,15' : '255,230,190'},${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + Math.sin(y * 0.02 + i) * 2.5, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let M: Record<string, THREE.Material> | null = null;
function mats(): Record<string, THREE.Material> {
  if (M) return M;
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
  M = {
    wood: std({ map: woodTexture('#b3814f'), roughness: 0.72 }),
    woodDark: std({ map: woodTexture('#7a5232'), roughness: 0.75 }),
    metal: std({ color: '#c3c9cd', metalness: 0.75, roughness: 0.35 }),
    metalDark: std({ color: '#5f666b', metalness: 0.6, roughness: 0.5 }),
    rust: std({ color: '#6b4a36', metalness: 0.3, roughness: 0.8 }),
    red: std({ color: '#b3301f', roughness: 0.6, envMapIntensity: 0.5 }),
    yellow: std({ color: '#e8b52e', roughness: 0.6, envMapIntensity: 0.5 }),
    green: std({ color: '#4f7f4a', metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide }),
    galv: std({ color: '#aab3b8', metalness: 0.65, roughness: 0.42, side: THREE.DoubleSide }),
    rubber: std({ color: '#262422', roughness: 0.9 }),
    straw: std({ color: '#ffffff', roughness: 0.9, envMapIntensity: 0.35 }),
    strawMass: std({ color: '#d9b15c', roughness: 0.95 }),
  };
  return M;
}

let envTex: THREE.Texture | null = null;
/** Soft studio reflections so metal reads as metal in the held view and icons. */
export function toolEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (!envTex) {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  return envTex;
}

// ---------- helpers ----------
function place<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}
const mesh = (g: THREE.BufferGeometry, m: string) => new THREE.Mesh(g, mats()[m]);
/** Tapered cylinder lying along Z, centred on the origin. `r1` is the -Z end. */
function rod(r0: number, r1: number, len: number, m: string, seg = 12): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r0, r1, len, seg);
  g.rotateX(Math.PI / 2);
  return mesh(g, m);
}
function tube(points: number[][], r: number, m: string, seg = 16, radial = 6): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return mesh(new THREE.TubeGeometry(curve, seg, r, radial), m);
}
/** Flat outline in XZ (tip towards -Z), extruded thin and dished so the edges curl up. */
function blade(outline: Array<[number, number]>, thick: number, dish: number, m: string): THREE.Mesh {
  const s = new THREE.Shape();
  outline.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: thick * 0.4, bevelSegments: 1, curveSegments: 8 });
  g.rotateX(Math.PI / 2); // shape Y -> -Z, extrusion -> -Y
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + dish * p.getX(i) ** 2);
  g.computeVertexNormals();
  return mesh(g, m);
}

// ---------- hay loads ----------
const STRAW = ['#c9a24a', '#b88d3c', '#a77b32', '#d6b25e', '#9a6f2c', '#c49a48'].map((c) => new THREE.Color(c));
function rng(seed: number): () => number {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let strawGeo: THREE.BufferGeometry | null = null;

/** A clump of individual straws that grows from the centre outwards as `fill` rises. */
export class HayLoad {
  readonly mesh: THREE.InstancedMesh;
  private shown = -1;

  constructor(private readonly max: number, size: [number, number, number], opts: { pile?: boolean; len?: [number, number]; seed?: number } = {}) {
    strawGeo ??= new THREE.BoxGeometry(0.0042, 0.0042, 1);
    this.mesh = new THREE.InstancedMesh(strawGeo, mats().straw, max);
    this.mesh.frustumCulled = false;
    const rnd = rng(opts.seed ?? 7);
    const [l0, l1] = opts.len ?? [0.08, 0.2];
    const pts: Array<{ d: number; p: THREE.Vector3 }> = [];
    for (let i = 0; i < max; i++) {
      let x, y, z;
      do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
      if (opts.pile) y = Math.abs(y) * (1 - Math.hypot(x, z) * 0.7); // dome sitting on y = 0
      pts.push({ d: Math.hypot(x, opts.pile ? y * 0.5 : y, z), p: new THREE.Vector3(x * size[0], y * size[1], z * size[2]) });
    }
    pts.sort((a, b) => a.d - b.d);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
    pts.forEach(({ p }, i) => {
      e.set((rnd() - 0.5) * 0.8, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.8);
      s.set(1, 1, l0 + rnd() * (l1 - l0));
      this.mesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e), s));
      this.mesh.setColorAt(i, STRAW[Math.floor(rnd() * STRAW.length)]);
    });
    this.mesh.count = 0;
  }

  set(fill: number): void {
    const n = fill <= 0 ? 0 : Math.min(this.max, Math.max(5, Math.round(fill * this.max)));
    if (n === this.shown) return;
    this.shown = n;
    this.mesh.count = n;
  }
}

// ---------- models ----------
function handful(): THREE.Group {
  const g = new THREE.Group();
  const load = new HayLoad(90, [0.05, 0.03, 0.045], { len: [0.07, 0.16], seed: 3 });
  g.add(load.mesh);
  g.userData.load = load;
  return g;
}

function withLoad(g: THREE.Group, max: number, at: [number, number, number], size: [number, number, number], seed: number): THREE.Group {
  const load = new HayLoad(max, size, { pile: true, len: [0.05, 0.14], seed });
  load.mesh.position.set(...at);
  g.add(load.mesh);
  g.userData.load = load;
  return g;
}

function toyShovel(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(rod(0.012, 0.014, 0.3, 'yellow'), 0, 0, -0.1));
  g.add(place(rod(0.016, 0.016, 0.07, 'yellow'), 0, 0, 0.06, 0, Math.PI / 2, 0)); // T-grip
  g.add(place(rod(0.016, 0.02, 0.04, 'yellow'), 0, 0, -0.26));
  const outline: Array<[number, number]> = [[-0.055, 0], [0.055, 0], [0.065, 0.06], [0.06, 0.13], [0.03, 0.16], [-0.03, 0.16], [-0.06, 0.13], [-0.065, 0.06]];
  g.add(place(blade(outline, 0.005, 5, 'red'), 0, 0.002, -0.275, 0.12, 0, 0));
  return withLoad(g, 40, [0, 0.012, -0.36], [0.04, 0.03, 0.05], 11);
}

function spade(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(rod(0.016, 0.018, 0.74, 'wood'), 0, 0, -0.21));
  // D-grip
  g.add(place(mesh(new THREE.TorusGeometry(0.045, 0.009, 8, 20, Math.PI), 'woodDark'), 0, 0, 0.16, Math.PI / 2, 0, Math.PI));
  g.add(place(rod(0.011, 0.011, 0.09, 'woodDark'), 0, 0, 0.205, 0, Math.PI / 2, 0));
  // socket and blade
  g.add(place(rod(0.02, 0.026, 0.12, 'metalDark'), 0, 0, -0.62));
  const outline: Array<[number, number]> = [[-0.085, 0], [0.085, 0], [0.088, 0.15], [0.07, 0.2], [0.035, 0.23], [0, 0.24], [-0.035, 0.23], [-0.07, 0.2], [-0.088, 0.15]];
  g.add(place(blade(outline, 0.003, 2.2, 'metal'), 0, 0.003, -0.675, 0.06, 0, 0));
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.006, 0.02), mats().metalDark), 0, 0.012, -0.672));
  return withLoad(g, 60, [0, 0.02, -0.79], [0.07, 0.05, 0.08], 12);
}

function pitchfork(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(rod(0.015, 0.017, 0.92, 'wood'), 0, 0, -0.3));
  g.add(place(rod(0.011, 0.016, 0.035, 'woodDark'), 0, 0, 0.175));
  g.add(place(rod(0.012, 0.02, 0.1, 'metalDark'), 0, 0, -0.79));
  g.add(tube([[-0.1, 0.012, -0.87], [-0.05, 0.004, -0.845], [0, 0, -0.84], [0.05, 0.004, -0.845], [0.1, 0.012, -0.87]], 0.007, 'metalDark', 20, 6));
  for (const x of [-0.1, -0.033, 0.033, 0.1]) {
    g.add(tube([[x, 0.012, -0.865], [x * 1.04, 0.006, -0.98], [x * 1.06, 0.02, -1.1], [x * 1.06, 0.06, -1.17]], 0.0045, 'metal', 14, 5));
  }
  return withLoad(g, 80, [0, 0.02, -1.02], [0.1, 0.07, 0.1], 13);
}

function bucket(): THREE.Group {
  const g = new THREE.Group();
  const prof = [[0, -0.12], [0.098, -0.12], [0.104, -0.112], [0.128, 0.108], [0.137, 0.116], [0.137, 0.122], [0.129, 0.122], [0.122, 0.11], [0.098, -0.108], [0, -0.108]];
  g.add(mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 28), 'galv'));
  for (const y of [-0.04, 0.04]) {
    const r = 0.104 + (y + 0.12) * 0.11;
    g.add(place(mesh(new THREE.TorusGeometry(r, 0.0025, 4, 36), 'galv'), 0, y, 0, Math.PI / 2));
  }
  const arc: number[][] = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; arc.push([Math.cos(a) * 0.138, 0.11 + Math.sin(a) * 0.12, Math.sin(a) * 0.03]); }
  g.add(tube(arc, 0.004, 'metalDark', 24, 5));
  g.add(place(mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.02, 24), 'strawMass'), 0, 0.075, 0));
  return withLoad(g, 50, [0, 0.085, 0], [0.1, 0.05, 0.1], 14);
}

function wheelbarrow(): THREE.Group {
  const g = new THREE.Group();
  // Tray: open square frustum, wider at the top.
  const tray = new THREE.CylinderGeometry(0.5, 0.32, 0.26, 4, 1, true);
  tray.rotateY(Math.PI / 4);
  tray.scale(0.7, 1, 1);
  g.add(place(mesh(tray, 'green'), 0, 0.46, 0.02));
  g.add(place(mesh(new THREE.PlaneGeometry(0.32, 0.44), 'green'), 0, 0.331, 0.02, -Math.PI / 2));
  const mound = place(mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'strawMass'), 0, 0.5, 0.02);
  mound.scale.set(0.95, 0.35, 1.25);
  g.add(mound);
  // Wheel
  const wheel = new THREE.Group();
  wheel.add(mesh(new THREE.TorusGeometry(0.125, 0.038, 10, 28), 'rubber'));
  wheel.add(place(rod(0.035, 0.035, 0.07, 'metalDark'), 0, 0, 0));
  for (let i = 0; i < 6; i++) wheel.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.2, 0.008), mats().metal), 0, 0, 0, 0, 0, (i / 6) * Math.PI));
  g.add(place(wheel, 0, 0.165, -0.47, 0, Math.PI / 2, 0));
  for (const s of [-1, 1]) {
    g.add(place(rod(0.016, 0.019, 1.05, 'wood'), s * 0.19, 0.38, 0.1, -0.16, s * -0.05, 0));
    g.add(place(rod(0.02, 0.02, 0.12, 'rubber'), s * 0.21, 0.455, 0.6, -0.16, 0, 0));
    g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.02), mats().metalDark), s * 0.17, 0.17, 0.28));
  }
  return withLoad(g, 70, [0, 0.58, 0.02], [0.2, 0.06, 0.3], 15);
}

export function buildModel(id: ItemId): THREE.Group {
  switch (id) {
    case 'hands': return handful();
    case 'toy_shovel': return toyShovel();
    case 'spade': return spade();
    case 'pitchfork': return pitchfork();
    case 'bucket': return bucket();
    case 'wheelbarrow': return wheelbarrow();
  }
}

export const loadOf = (g: THREE.Object3D): HayLoad | undefined => g.userData.load as HayLoad | undefined;

/** How each item is posed for its icon: model rotation, camera elevation and how full it looks. */
export function iconPose(id: ItemId): { rot: THREE.Euler; elevation: number; fill: number } {
  switch (id) {
    case 'hands': return { rot: new THREE.Euler(0, 0.6, 0), elevation: 0.6, fill: 1 };
    case 'bucket': return { rot: new THREE.Euler(0, 0, 0), elevation: 0.5, fill: 1 };
    case 'wheelbarrow': return { rot: new THREE.Euler(0, -2.3, 0), elevation: 0.55, fill: 1 };
    // Long tools: handle along the icon diagonal, working end up-right, blade facing the camera.
    default: return { rot: new THREE.Euler().setFromQuaternion(diagonalTool()), elevation: 0.15, fill: 0 };
  }
}

function diagonalTool(): THREE.Quaternion {
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  const diag = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4);
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 1, 0).normalize(), 0.45);
  return tilt.multiply(diag).multiply(yaw).multiply(roll);
}
