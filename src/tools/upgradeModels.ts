import * as THREE from 'three';
import type { UpgradeIcon } from '../data/upgrades';
import { mats } from './models';

// Small props for upgrade icons, built from primitives like the tool models.
// They only appear as icons in the tree, so they are rendered once at load.

export const UPGRADE_ICONS: readonly UpgradeIcon[] = ['boots', 'spring', 'level', 'kettlebell', 'bottle', 'ladder', 'feather', 'crate', 'magnifier', 'belt', 'rake', 'plug'];

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
let L: Record<string, THREE.Material> | null = null;
function local(): Record<string, THREE.Material> {
  return (L ??= {
    bootRubber: std({ color: '#30492c', roughness: 0.5, metalness: 0.05 }),
    bootTrim: std({ color: '#1c1b19', roughness: 0.85 }),
    iron: std({ color: '#3a3d40', metalness: 0.7, roughness: 0.45 }),
    glass: std({ color: '#d8eef8', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.45, depthWrite: false }),
    water: std({ color: '#5aa9d8', roughness: 0.15, transparent: true, opacity: 0.7, depthWrite: false }),
    capBlue: std({ color: '#2560a8', roughness: 0.4 }),
    label: std({ color: '#f2f2ea', roughness: 0.7 }),
    vial: std({ color: '#b8e07a', roughness: 0.1, transparent: true, opacity: 0.75, emissive: '#3a5a10', emissiveIntensity: 0.3 }),
    bubble: std({ color: '#ffffff', roughness: 0.1 }),
    feather: std({ color: '#efe9dc', roughness: 0.8, side: THREE.DoubleSide }),
    quill: std({ color: '#cfc4ae', roughness: 0.6 }),
    gold: std({ color: '#e0b345', metalness: 0.9, roughness: 0.3 }),
    brass: std({ color: '#b9933f', metalness: 0.85, roughness: 0.35 }),
  });
}
const m = (key: string): THREE.Material => local()[key] ?? mats()[key];
const mesh = (g: THREE.BufferGeometry, key: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh => {
  const o = new THREE.Mesh(g, m(key));
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
};
const group = (...o: THREE.Object3D[]) => { const g = new THREE.Group(); g.add(...o); return g; };

function boot(): THREE.Group {
  const shaft = mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.25, 18), 'bootRubber', 0, 0.165, 0.02);
  const rim = mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 20), 'bootTrim', 0, 0.29, 0.02, Math.PI / 2);
  const foot = mesh(new THREE.CapsuleGeometry(0.048, 0.1, 6, 14), 'bootRubber', 0, 0.045, -0.05, Math.PI / 2);
  foot.scale.set(1.05, 1, 0.85);
  const sole = mesh(new THREE.BoxGeometry(0.105, 0.022, 0.235), 'bootTrim', 0, 0.011, -0.035);
  return group(shaft, rim, foot, sole);
}
function boots(): THREE.Group {
  const a = boot(), b = boot();
  a.position.set(-0.07, 0, 0.02); a.rotation.y = 0.25;
  b.position.set(0.07, 0, -0.02); b.rotation.y = -0.1;
  return group(a, b);
}

function spring(): THREE.Group {
  const pts: THREE.Vector3[] = [];
  const turns = 6, n = turns * 24;
  for (let i = 0; i <= n; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.06, 0.02 + (i / n) * 0.22, Math.sin(a) * 0.06));
  }
  const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.009, 8), m('metal'));
  const base = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 24), 'rubber', 0, 0.01, 0);
  return group(coil, base);
}

function spiritLevel(): THREE.Group {
  const body = mesh(new THREE.BoxGeometry(0.42, 0.06, 0.045), 'yellow');
  const window = mesh(new THREE.BoxGeometry(0.09, 0.035, 0.05), 'rubber', 0, 0.005, 0);
  const vial = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.075, 12), 'vial', 0, 0.006, 0.012, 0, 0, Math.PI / 2);
  const bubble = mesh(new THREE.SphereGeometry(0.007, 10, 8), 'bubble', 0.004, 0.014, 0.018);
  const capL = mesh(new THREE.BoxGeometry(0.02, 0.064, 0.05), 'metalDark', -0.215, 0, 0);
  const capR = mesh(new THREE.BoxGeometry(0.02, 0.064, 0.05), 'metalDark', 0.215, 0, 0);
  return group(body, window, vial, bubble, capL, capR);
}

function kettlebell(): THREE.Group {
  const ball = mesh(new THREE.SphereGeometry(0.1, 24, 18), 'iron', 0, 0.1, 0);
  ball.scale.set(1, 0.92, 1);
  const handle = mesh(new THREE.TorusGeometry(0.06, 0.016, 10, 24, Math.PI), 'iron', 0, 0.17, 0);
  const foot = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20), 'iron', 0, 0.012, 0);
  return group(ball, handle, foot);
}

function bottle(): THREE.Group {
  const water = mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.15, 20), 'water', 0, 0.08, 0);
  const body = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 24, 1, true), 'glass', 0, 0.1, 0);
  const shoulder = mesh(new THREE.SphereGeometry(0.045, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'glass', 0, 0.2, 0);
  const label = mesh(new THREE.CylinderGeometry(0.0465, 0.0465, 0.06, 24, 1, true), 'label', 0, 0.1, 0);
  const band = mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.012, 24, 1, true), 'capBlue', 0, 0.1, 0);
  const cap = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 16), 'capBlue', 0, 0.255, 0);
  const bottom = mesh(new THREE.CylinderGeometry(0.045, 0.043, 0.006, 24), 'glass', 0, 0.003, 0);
  return group(water, label, band, body, shoulder, cap, bottom);
}

function ladder(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.07, 0.07]) g.add(mesh(new THREE.BoxGeometry(0.022, 0.52, 0.03), 'galv', x, 0.26, 0));
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 10), 'metal', 0, 0.05 + i * 0.085, 0, 0, 0, Math.PI / 2));
  for (const x of [-0.07, 0.07]) g.add(mesh(new THREE.BoxGeometry(0.03, 0.02, 0.04), 'rubber', x, 0.01, 0));
  return g;
}

function feather(): THREE.Group {
  const s = new THREE.Shape();
  s.moveTo(0, 0.02);
  s.bezierCurveTo(0.05, 0.08, 0.06, 0.22, 0.01, 0.34);
  s.bezierCurveTo(0.0, 0.36, -0.01, 0.36, -0.015, 0.34);
  s.bezierCurveTo(-0.05, 0.22, -0.045, 0.08, 0, 0.02);
  const vane = new THREE.Mesh(new THREE.ShapeGeometry(s, 24), m('feather'));
  // A gentle curl so the light catches it.
  const p = vane.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, -0.25 * p.getX(i) ** 2 * 10 + Math.sin(p.getY(i) * 6) * 0.006);
  vane.geometry.computeVertexNormals();
  const quill = mesh(new THREE.CylinderGeometry(0.0025, 0.004, 0.38, 8), 'quill', 0, 0.17, 0.002);
  return group(vane, quill);
}

function crate(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.18, 0.2), 'woodDark', 0, 0.09, 0));
  for (const y of [0.03, 0.09, 0.15]) g.add(mesh(new THREE.BoxGeometry(0.31, 0.045, 0.012), 'wood', 0, y, 0.104));
  for (const x of [-0.145, 0.145]) g.add(mesh(new THREE.BoxGeometry(0.02, 0.19, 0.215), 'wood', x, 0.095, 0));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 22), 'gold', -0.05 + (i % 2) * 0.012, 0.186 + i * 0.009, 0.01 + i * 0.004));
  const loose = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 22), 'gold', 0.07, 0.19, -0.03, 0.5, 0, 0.3);
  g.add(loose);
  return g;
}

function magnifier(): THREE.Group {
  const rim = mesh(new THREE.TorusGeometry(0.08, 0.012, 12, 32), 'brass', 0, 0.2, 0);
  const lens = mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.008, 32), 'glass', 0, 0.2, 0, Math.PI / 2);
  const neck = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 12), 'brass', 0, 0.105, 0);
  const handle = mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.13, 14), 'woodDark', 0, 0.02, 0);
  return group(rim, lens, neck, handle);
}

function belt(): THREE.Group {
  const g = new THREE.Group();
  // A short belt segment: dark band between two steel rails, with rollers at both ends.
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.03, 0.16), 'rubber', 0, 0.09, 0));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.32, 0.06, 0.025), 'metalDark', 0, 0.1, s * 0.09));
  for (const x of [-0.14, 0.14]) g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.17, 14).rotateZ(Math.PI / 2), 'metal', x, 0.09, 0));
  for (const x of [-0.1, 0.1]) g.add(mesh(new THREE.BoxGeometry(0.03, 0.075, 0.03), 'metalDark', x, 0.037, 0));
  return g;
}

function rake(): THREE.Group {
  const g = new THREE.Group();
  // A piston rake: heavy frame on feet, a row of curved tines facing the stack.
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.12), 'woodDark', 0, 0.16, 0));
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.12, 0.14), 'metalDark', 0, 0.08, 0.02));
  for (const x of [-0.12, 0.12]) g.add(mesh(new THREE.BoxGeometry(0.05, 0.13, 0.05), 'iron', x, 0.065, -0.02));
  const head = mesh(new THREE.BoxGeometry(0.28, 0.05, 0.04), 'metalDark', 0, 0.19, -0.14);
  g.add(head);
  for (let i = 0; i < 5; i++) {
    const tine = mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.14, 8), 'metal', -0.12 + i * 0.06, 0.12, -0.19, -0.5);
    g.add(tine);
  }
  return g;
}

function plug(): THREE.Group {
  const g = new THREE.Group();
  // A plug with two pins and a loop of cable.
  const body = mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.09, 18), 'rubber', 0, 0.12, 0, Math.PI / 2 - 0.35);
  g.add(body);
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.06, 10), 'brass', s * 0.025, 0.15, 0.075, Math.PI / 2 - 0.35));
  const cable: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * 0.9 - (i / 14) * Math.PI * 1.4;
    cable.push(new THREE.Vector3(Math.cos(a) * 0.09 + 0.04, 0.012 + Math.sin(i / 14 * Math.PI) * 0.02, Math.sin(a) * 0.05 - 0.02));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cable), 16, 0.011, 8), m('rubber')));
  return g;
}

const POSES: Record<UpgradeIcon, [THREE.Euler, number]> = {
  boots: [new THREE.Euler(0, -0.7, 0), 0.35],
  spring: [new THREE.Euler(0, 0, 0), 0.45],
  level: [new THREE.Euler(0.15, -0.5, 0.55), 0.35],
  kettlebell: [new THREE.Euler(0, 0.5, 0), 0.4],
  bottle: [new THREE.Euler(0, 0, -0.35), 0.25],
  ladder: [new THREE.Euler(0.2, -0.6, -0.45), 0.25],
  feather: [new THREE.Euler(0.3, 0.4, -0.7), 0.25],
  crate: [new THREE.Euler(0, -0.6, 0), 0.5],
  magnifier: [new THREE.Euler(0, 0.3, -0.75), 0.2],
  belt: [new THREE.Euler(0.35, 0.6, 0), 0.3],
  rake: [new THREE.Euler(0.25, 0.5, 0), 0.3],
  plug: [new THREE.Euler(0.2, -0.4, 0), 0.25],
};

export function upgradeIconModel(id: UpgradeIcon): { model: THREE.Group; pose: { rot: THREE.Euler; elevation: number; fill: number } } {
  const build = { boots, spring, level: spiritLevel, kettlebell, bottle, ladder, feather, crate, magnifier, belt, rake, plug }[id];
  const [rot, elevation] = POSES[id];
  return { model: build(), pose: { rot, elevation, fill: 0 } };
}
