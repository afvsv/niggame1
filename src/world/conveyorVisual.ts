import * as THREE from 'three';
import { BELT_DROP, BELT_TRAVEL, Delivery } from '../game/conveyor';

/** Visual-only cargo; the game queue is the authority for payment. Local coordinates match sellBooth. */
export class ConveyorVisual {
  private readonly loads: THREE.Group[] = [];
  private readonly marker: THREE.Mesh[] = [];
  private phase = 0;
  constructor(private readonly belt: THREE.Group, private readonly hay: THREE.Material, steel: THREE.Material) {
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.015, 0.025), steel);
      belt.add(bar); this.marker.push(bar);
    }
  }
  update(dt: number, deliveries: readonly Delivery[]): void {
    this.phase = (this.phase + dt / BELT_TRAVEL) % 1;
    const lowZ = 3.6, highZ = 1.5, lowY = 0.34, highY = 1.06;
    const position = (o: THREE.Object3D, p: number) => {
      o.position.set(0.56, THREE.MathUtils.lerp(lowY, highY, p), THREE.MathUtils.lerp(lowZ, highZ, p));
    };
    this.marker.forEach((o, i) => { position(o, (i / this.marker.length + this.phase) % 1); o.rotation.x = Math.atan2(0.72, 2.1); });
    while (this.loads.length < deliveries.length) {
      const g = new THREE.Group();
      // A loose, irregular tuft rather than a solid cube of hay.
      for (let i = 0; i < 11; i++) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.48 + (i % 3) * 0.05, 5), this.hay);
        mesh.rotation.set(Math.PI / 2 + (i % 3 - 1) * 0.18, (i * 2.4) % Math.PI, (i % 5 - 2) * 0.25);
        mesh.position.set((i % 4 - 1.5) * 0.055, 0.04 + (i % 3) * 0.035, (i % 5 - 2) * 0.035);
        g.add(mesh);
      }
      this.belt.add(g); this.loads.push(g);
    }
    this.loads.forEach((g, i) => {
      const d = deliveries[i]; g.visible = !!d;
      if (!d) return;
      const p = Math.min(1, d.elapsed / BELT_TRAVEL); position(g, p);
      if (d.elapsed > BELT_TRAVEL) {
        const fall = Math.min(1, (d.elapsed - BELT_TRAVEL) / BELT_DROP);
        g.position.z -= 0.45 * fall; g.position.y -= 0.72 * fall * fall;
        g.rotation.x = fall * 1.5; g.scale.setScalar(1 - fall * 0.35);
      } else { g.rotation.x = 0; g.scale.setScalar(1); }
    });
  }
}
