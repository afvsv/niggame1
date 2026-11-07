import * as THREE from 'three';
import { BuildingId, buildingById } from '../data/buildings';
import { BALANCE } from '../data/balance';
import type { AABB } from './colliders';
import type { Conveyor } from '../game/conveyor';
import type { BuildingRef } from '../game/factory';
import type { PathPoint } from '../game/conveyor';
import { Kit, worldBox } from './kit';

const A = BALANCE.automation;

export interface Mats {
  beam: THREE.Material;
  boards: THREE.Material;
  metal: THREE.Material;
  iron: THREE.Material;
  steel: THREE.Material;
  rubber: THREE.Material;
  hay: THREE.Material;
  red: THREE.Material;
  black: THREE.Material;
  yellow: THREE.Material;
  burlap: THREE.Material;
}

const shadowed = <T extends THREE.Mesh>(m: T): T => { m.castShadow = true; m.receiveShadow = true; return m; };

// ---------- machine models ----------

/** Piston rake: a heavy frame that faces the stack and feeds the belt behind it. */
function rakeModel(m: Mats): THREE.Group {
  const kit = new Kit();
  kit.add(m.beam,
    worldBox(1.1, 0.14, 0.9, 0, 0.62, 0),
    worldBox(0.14, 0.62, 0.9, -0.48, 0.31, 0), worldBox(0.14, 0.62, 0.9, 0.48, 0.31, 0));
  kit.add(m.iron, worldBox(0.5, 0.3, 0.5, 0, 0.84, 0.15));
  kit.add(m.steel, worldBox(0.2, 0.2, 0.6, 0, 0.84, -0.35));
  const head = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.1), m.iron));
  head.position.set(0, 0.4, -0.45);
  kit.group.add(head);
  for (let i = 0; i < 6; i++) {
    const tine = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.008, 0.5, 8), m.iron));
    tine.position.set(-0.4 + i * 0.16, 0.28, -0.6);
    tine.rotation.x = 0.5;
    kit.group.add(tine);
  }
  kit.add(m.steel, worldBox(0.5, 0.06, 0.7, 0, 0.75, 0.55));
  for (const s of [-1, 1]) kit.add(m.steel, worldBox(0.05, 0.16, 0.7, s * 0.26, 0.72, 0.55));
  return kit.group;
}

/** Hay generator: a firebox on legs with a chimney and a fuel hatch. */
function generatorModel(m: Mats): THREE.Group {
  const kit = new Kit();
  kit.add(m.boards, worldBox(1.2, 1.0, 1.2, 0, 0.5, 0));
  kit.add(m.iron, worldBox(1.3, 0.12, 1.3, 0, 1.06, 0));
  kit.add(m.red, worldBox(0.5, 0.5, 0.4, 0.3, 0.9, 0.3));
  const chimney = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.3, 12), m.iron));
  chimney.position.set(-0.35, 1.7, -0.3);
  kit.group.add(chimney);
  kit.add(m.iron, worldBox(0.16, 0.5, 0.16, -0.35, 0.25, 0.45), worldBox(0.16, 0.5, 0.16, 0.35, 0.25, 0.45));
  return kit.group;
}

// ---------- belts ----------

function beltSegment(m: Mats, from: THREE.Vector3, to: THREE.Vector3, kit: Kit): void {
  const dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return;
  const cx = (from.x + to.x) / 2, cz = (from.z + to.z) / 2, y = from.y;
  const ang = Math.atan2(dx, dz);
  kit.add(m.rubber, worldBox(0.56, 0.06, len, cx, y, cz, 1.6, ang));
  for (const s of [-1, 1]) {
    const rail = new THREE.BoxGeometry(0.06, 0.14, len + 0.1);
    rail.rotateY(ang);
    rail.translate(cx - Math.cos(ang) * s * 0.3, y + 0.1, cz + Math.sin(ang) * s * 0.3);
    kit.add(m.steel, rail);
  }
  const legs = Math.max(1, Math.round(len / 2));
  for (let i = 0; i < legs; i++) {
    const t = (i + 0.5) / legs;
    const lx = from.x + dx * t, lz = from.z + dz * t;
    kit.add(m.steel, worldBox(0.09, y, 0.09, lx, y / 2, lz), worldBox(0.2, 0.04, 0.2, lx, 0.02, lz));
  }
  for (const p of [from, to]) {
    const roller = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.62, 12), m.steel));
    roller.rotation.z = Math.PI / 2;
    roller.rotation.y = ang;
    roller.position.set(p.x, p.y, p.z);
    kit.group.add(roller);
  }
}

// ---------- the world layer of placed buildings ----------

/** Meshes of placed machines and belts, plus pooled wad instances for their cargo. */
export class BuildingViews {
  readonly group = new THREE.Group();
  private readonly anchors = new Map<THREE.Group, BuildingRef>();
  private readonly wads = new Map<Conveyor, THREE.InstancedMesh>();
  private readonly wadGeo = new THREE.BoxGeometry(1, 0.55, 0.8);
  private readonly helpers = {
    pos: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), scale: new THREE.Vector3(), mat: new THREE.Matrix4(),
  };

  constructor(private readonly mats: Mats, private readonly hayMat: THREE.Material) {}

  /** (Re)builds meshes for the placed buildings; removes the gone ones. Call on place/demolish/load. */
  rebuild(refs: BuildingRef[]): void {
    for (const [group, ref] of [...this.anchors]) {
      if (!refs.includes(ref)) {
        group.removeFromParent();
        this.anchors.delete(group);
        if (ref.conveyor) this.dropWads(ref.conveyor);
      }
    }
    const kit = new Kit();
    for (const ref of refs) {
      let anchor = [...this.anchors.entries()].find(([, r]) => r === ref)?.[0];
      if (!anchor) {
        anchor = new THREE.Group();
        this.anchors.set(anchor, ref);
        this.group.add(anchor);
      }
      anchor.position.set(ref.x, 0, ref.z);
      anchor.rotation.y = ref.rot;
      anchor.clear();
      if (ref.id === 'rake') anchor.add(rakeModel(this.mats));
      if (ref.id === 'generator') anchor.add(generatorModel(this.mats));
      if (ref.id === 'belt' && ref.path && ref.path.length >= 2) {
        const local = (p: PathPoint): THREE.Vector3 =>
          new THREE.Vector3(p.x, p.y, p.z).sub(new THREE.Vector3(ref.x, 0, ref.z)).applyAxisAngle(new THREE.Vector3(0, 1, 0), -ref.rot);
        for (let i = 1; i < ref.path.length; i++) beltSegment(this.mats, local(ref.path[i - 1]), local(ref.path[i]), kit);
      }
    }
    kit.place(this.group, () => {}, 0, 0); // colliders are registered by the rules layer, not the view
  }

  /** Ray test over the placed buildings: returns the owning building. */
  raycast(ray: THREE.Raycaster): { ref: BuildingRef; dist: number; point: THREE.Vector3 } | null {
    let best: { ref: BuildingRef; dist: number; point: THREE.Vector3 } | null = null;
    for (const [group, ref] of this.anchors) {
      const hit = ray.intersectObject(group, true)[0];
      if (hit && (!best || hit.distance < best.dist)) best = { ref, dist: hit.distance, point: hit.point.clone() };
    }
    return best;
  }

  /** Mirrors a conveyor's wads with instanced straw piles (no shadows, see the plan). */
  syncWads(conveyor: Conveyor, path: PathPoint[]): void {
    let inst = this.wads.get(conveyor);
    if (!inst) {
      inst = new THREE.InstancedMesh(this.wadGeo, this.hayMat, A.yardItemCap);
      inst.castShadow = false;
      inst.frustumCulled = false;
      inst.count = 0;
      this.group.add(inst);
      this.wads.set(conveyor, inst);
    }
    const { pos, q, e, scale, mat } = this.helpers;
    const y = path.length ? path[0].y : 0.35;
    const at = (s: number): THREE.Vector3 => {
      let left = s;
      for (let i = 1; i < path.length; i++) {
        const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z) || 1;
        if (left <= seg || i === path.length - 1) {
          return pos.set(
            path[i - 1].x + (path[i].x - path[i - 1].x) * (left / seg), y,
            path[i - 1].z + (path[i].z - path[i - 1].z) * (left / seg),
          ).clone();
        }
        left -= seg;
      }
      return new THREE.Vector3(path[path.length - 1].x, path[path.length - 1].y, path[path.length - 1].z);
    };
    const wads = conveyor.wads;
    for (let i = 0; i < Math.max(wads.length, inst.count); i++) {
      if (i < wads.length) {
        const w = wads[i];
        const s = 0.16 * Math.cbrt(w.n / 15);
        e.set(0, Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z) + (i % 2 ? 0.4 : -0.4), 0);
        mat.compose(at(w.s), q.setFromEuler(e), scale.set(s * 1.15, s, s * 1.15));
        inst.setMatrixAt(i, mat);
      } else {
        mat.makeScale(0, 0, 0);
        inst.setMatrixAt(i, mat);
      }
    }
    inst.count = wads.length;
    inst.instanceMatrix.needsUpdate = true;
  }

  dropWads(conveyor: Conveyor): void {
    const inst = this.wads.get(conveyor);
    if (inst) { inst.removeFromParent(); this.wads.delete(conveyor); }
  }
}

// ---------- ghosts ----------

const ghostOk = new THREE.MeshStandardMaterial({ color: '#7fd06a', transparent: true, opacity: 0.45, depthWrite: false });
const ghostBad = new THREE.MeshStandardMaterial({ color: '#d05a4a', transparent: true, opacity: 0.45, depthWrite: false });

export interface Ghost {
  group: THREE.Group;
  setValid(valid: boolean): void;
  move(x: number, z: number, rot: number): void;
  hide(): void;
  show(): void;
}

/** A translucent preview that follows the aim point: green when placeable, red when not. */
export function makeGhost(id: BuildingId): Ghost {
  const group = new THREE.Group();
  const ghostMats = new Proxy({} as Mats, { get: () => ghostOk });
  if (id === 'rake') group.add(rakeModel(ghostMats));
  if (id === 'generator') group.add(generatorModel(ghostMats));
  if (id === 'belt') {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 2), ghostOk);
    band.position.set(0, 0.35, -1); // ahead of the chain end
    group.add(band);
  }
  group.visible = false;
  return {
    group,
    setValid: (valid: boolean) => group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = valid ? ghostOk : ghostBad;
    }),
    move: (x, z, rot) => { group.position.set(x, 0, z); group.rotation.y = rot; group.visible = true; },
    hide: () => { group.visible = false; },
    show: () => { group.visible = true; },
  };
}

/** Machine colliders for the rules layer: rake/generator occupy their footprint, belts do not. */
export function machineAABBs(id: BuildingId, x: number, z: number): AABB[] {
  if (!buildingById(id).solid) return [];
  const h = 0.6;
  return [{ minX: x - h, maxX: x + h, minY: 0, maxY: 1.4, minZ: z - h, maxZ: z + h }];
}

/** Forbidden placement zones: the exit, the stall, the needle board and the kiosk feed stay clear. */
export function inForbiddenZone(x: number, z: number, kiosk: { x: number; z: number }): boolean {
  const zones: Array<[number, number, number, number]> = [
    [13.4, 2.75, 4.5, 6.0],
    [13.25, 13.0, 4.0, 4.5],
    [13.3, -1.7, 2.0, 3.0],
    [kiosk.x, kiosk.z, 2.4, 3.4],
  ];
  return zones.some(([cx, cz, hx, hz]) => Math.abs(x - cx) < hx && Math.abs(z - cz) < hz);
}
