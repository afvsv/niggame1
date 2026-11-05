import * as THREE from 'three';
import type { ItemId } from '../data/tools';

// Low-poly tool models built from primitives. Convention: the grip sits near the
// origin, the working end points to -Z, +Y is up. Units are metres.

const mats = new Map<string, THREE.Material>();
function mat(color: string, doubleSide = false): THREE.Material {
  const key = color + (doubleSide ? '2' : '');
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide });
    mats.set(key, m);
  }
  return m;
}

const C = {
  wood: '#a7774a', woodDark: '#6e4a2a', metal: '#a3abb0', metalDark: '#6f777c',
  glove: '#c99a5b', cuff: '#8a5a33', toyRed: '#d4573f', toyYellow: '#e8c046',
  green: '#5b7f4f', tire: '#2c2a28', straw: '#dcbb63',
};

function place<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}
const box = (w: number, h: number, d: number, color: string) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
/** Cylinder lying along Z. */
function rod(r: number, len: number, color: string, seg = 8): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return new THREE.Mesh(g, mat(color));
}

function glove(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(box(0.09, 0.036, 0.1, C.glove), 0, 0, -0.05));
  for (let i = 0; i < 4; i++) {
    const f = place(box(0.019, 0.026, 0.065, C.glove), -0.032 + i * 0.021, -0.004, -0.128, -0.35, 0, 0);
    g.add(f);
  }
  g.add(place(box(0.022, 0.026, 0.06, C.glove), -0.058, -0.006, -0.06, 0, -0.7, 0));
  g.add(place(box(0.1, 0.05, 0.055, C.cuff), 0, 0, 0.025));
  return g;
}

function toyShovel(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(rod(0.014, 0.32, C.toyYellow), 0, 0, -0.1));
  g.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), mat(C.toyYellow)), 0, 0, 0.07));
  const blade = place(new THREE.Group(), 0, 0, -0.26, 0.12, 0, 0);
  blade.add(place(box(0.13, 0.012, 0.15, C.toyRed), 0, 0, -0.075));
  for (const s of [-1, 1]) blade.add(place(box(0.012, 0.03, 0.15, C.toyRed), s * 0.065, 0.012, -0.075));
  blade.add(place(box(0.13, 0.03, 0.012, C.toyRed), 0, 0.012, 0));
  g.add(blade);
  return g;
}

function spadeBlade(): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-0.085, 0);
  s.lineTo(0.085, 0);
  s.lineTo(0.085, -0.17);
  s.quadraticCurveTo(0.06, -0.215, 0, -0.235);
  s.quadraticCurveTo(-0.06, -0.215, -0.085, -0.17);
  s.lineTo(-0.085, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  return new THREE.Mesh(geo, mat(C.metal));
}

function spade(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(rod(0.017, 0.76, C.wood), 0, 0, -0.2));
  g.add(place(box(0.12, 0.024, 0.024, C.woodDark), 0, 0, 0.19));
  g.add(place(rod(0.022, 0.09, C.metalDark), 0, 0, -0.6));
  g.add(place(box(0.17, 0.014, 0.02, C.metalDark), 0, 0.004, -0.645));
  g.add(place(spadeBlade(), 0, 0.004, -0.645));
  return g;
}

function pitchfork(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(rod(0.016, 0.95, C.wood), 0, 0, -0.3));
  g.add(place(rod(0.021, 0.08, C.metalDark), 0, 0, -0.79));
  g.add(place(box(0.2, 0.016, 0.022, C.metalDark), 0, 0, -0.835));
  for (let i = 0; i < 4; i++) {
    const tine = place(rod(0.0055, 0.3, C.metal, 6), -0.075 + i * 0.05, 0.012, -0.99, 0.08, 0, 0);
    g.add(tine);
  }
  return g;
}

function bucket(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.105, 0.24, 20, 1, true), mat(C.metal, true)));
  g.add(place(new THREE.Mesh(new THREE.CircleGeometry(0.105, 20), mat(C.metalDark)), 0, -0.12, 0, -Math.PI / 2));
  g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 24), mat(C.metalDark)), 0, 0.12, 0, Math.PI / 2));
  g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.03, 20), mat(C.straw)), 0, 0.085, 0));
  g.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.005, 6, 20, Math.PI), mat(C.metalDark)), 0, 0.12, 0, -0.35, 0, 0));
  return g;
}

function wheelbarrow(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(box(0.5, 0.22, 0.66, C.green), 0, 0.44, 0));
  g.add(place(box(0.46, 0.03, 0.62, C.straw), 0, 0.555, 0));
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 18), mat(C.tire));
  g.add(place(wheel, 0, 0.16, -0.42, 0, 0, Math.PI / 2));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 10), mat(C.metal));
  g.add(place(hub, 0, 0.16, -0.42, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) {
    g.add(place(rod(0.018, 0.95, C.wood), s * 0.2, 0.36, 0.08, -0.12, 0, 0));
    g.add(place(box(0.03, 0.32, 0.03, C.woodDark), s * 0.18, 0.16, 0.24));
  }
  return g;
}

export function buildModel(id: ItemId): THREE.Group {
  switch (id) {
    case 'hands': return glove();
    case 'toy_shovel': return toyShovel();
    case 'spade': return spade();
    case 'pitchfork': return pitchfork();
    case 'bucket': return bucket();
    case 'wheelbarrow': return wheelbarrow();
  }
}

/** How each item is posed for its icon: model rotation plus camera elevation. */
export function iconPose(id: ItemId): { rot: THREE.Euler; elevation: number } {
  switch (id) {
    case 'bucket': return { rot: new THREE.Euler(0, 0, 0), elevation: 0.5 };
    case 'wheelbarrow': return { rot: new THREE.Euler(0, -2.3, 0), elevation: 0.55 };
    case 'hands': return { rot: new THREE.Euler(0.9, 0.5, 0, 'YXZ'), elevation: 0.3 };
    // Long tools: lay the handle along the icon diagonal, working end up-right, blade facing the camera.
    default: return { rot: new THREE.Euler().setFromQuaternion(diagonalTool()), elevation: 0.15 };
  }
}

function diagonalTool(): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); // blade normal -> -X
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // tip -> +X, blade faces camera
  const diag = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4); // tip -> up-right
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 1, 0).normalize(), 0.45); // a bit of depth
  q.copy(tilt).multiply(diag).multiply(yaw).multiply(roll);
  return q;
}
