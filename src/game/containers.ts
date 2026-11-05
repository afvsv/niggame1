import * as THREE from 'three';
import { CONTAINERS, ContainerId } from '../data/tools';
import { BALANCE } from '../data/balance';
import { buildModel, setFill } from '../tools/models';
import type { Inventory } from './Inventory';
import { fall } from './support';

/** World size of the containers (the models are built at hand size). */
export const CONTAINER_WORLD: Record<ContainerId, { scale: number; radius: number; height: number }> = {
  bucket: { scale: 1.6, radius: 0.22, height: 0.42 },
  wheelbarrow: { scale: 1.25, radius: 0.45, height: 0.8 },
};

interface Prop { obj: THREE.Group; vy: number; shown: number }

/** Containers standing in the world: fall onto what is below them and show their fill. */
export class ContainerProps {
  readonly group = new THREE.Group();
  private readonly props = new Map<ContainerId, Prop>();
  /** Set when something that casts a shadow moved. */
  moved = false;

  constructor(private readonly inv: Inventory) {}

  private prop(id: ContainerId): Prop {
    let p = this.props.get(id);
    if (!p) {
      const model = buildModel(id);
      // The bucket model's base is at -0.12; lift it so y = 0 is the ground.
      if (id === 'bucket') model.position.y = 0.12;
      const obj = new THREE.Group();
      obj.add(model);
      obj.userData = model.userData; // setFill reads the load and hay surface from here
      obj.scale.setScalar(CONTAINER_WORLD[id].scale);
      obj.traverse((o) => { if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh)) { o.castShadow = true; o.receiveShadow = true; } });
      obj.visible = false;
      this.group.add(obj);
      p = { obj, vy: 0, shown: -1 };
      this.props.set(id, p);
    }
    return p;
  }

  update(dt: number, support: (id: ContainerId, x: number, z: number, maxY: number) => number, capacity: (id: ContainerId) => number): void {
    for (const def of CONTAINERS) {
      if (!this.inv.has(def.id)) continue;
      const st = this.inv.state(def.id), p = this.prop(def.id);
      const placed = st.placed;
      if (p.obj.visible !== !!placed) { p.obj.visible = !!placed; this.moved = true; }
      if (!placed) continue;
      const [y, vy] = fall(placed.y, p.vy, support(def.id, placed.x, placed.z, placed.y + 0.05), BALANCE.gravity, dt);
      if (y !== placed.y || !p.obj.position.equals(new THREE.Vector3(placed.x, y, placed.z))) this.moved = true;
      placed.y = y; p.vy = vy;
      p.obj.position.set(placed.x, y, placed.z);
      p.obj.rotation.y = placed.yaw;
      const fill = st.fill / capacity(def.id);
      if (fill !== p.shown) { setFill(p.obj, fill); p.shown = fill; }
    }
  }

  /** The placed container the ray hits first. */
  raycast(ray: THREE.Raycaster): { id: ContainerId; dist: number } | null {
    let best: { id: ContainerId; dist: number } | null = null;
    for (const [id, p] of this.props) {
      if (!p.obj.visible) continue;
      const hit = ray.intersectObject(p.obj, true)[0];
      if (hit && (!best || hit.distance < best.dist)) best = { id, dist: hit.distance };
    }
    return best;
  }

  /** Where its "N / M" label floats. */
  labelAnchor(id: ContainerId, out: THREE.Vector3): THREE.Vector3 | null {
    const st = this.inv.state(id).placed;
    if (!st) return null;
    return out.set(st.x, st.y + CONTAINER_WORLD[id].height + 0.25, st.z);
  }
}
