import * as THREE from 'three';

/** Cargo on the kiosk conveyor: `n` strands at path position `t` (0 = the low end, 1 = the window). */
export interface BeltCargo { n: number; t: number }

/** What the game rules see: hay goes in, the belt delivers it, the booth pays on delivery. */
export interface BeltIO {
  dump(n: number): void;
  /** Strands that dropped into the booth since the last call. */
  takeArrived(): number;
  /** Cargo still riding, for saving. */
  riding(): BeltCargo[];
  restore(list: BeltCargo[]): void;
}

/** Seconds from a dump at the low end to the drop through the window. */
export const BELT_RIDE_SECONDS = 3.2;

/** Wad size from the load: hands make a small clump, a wheelbarrow a proper heap. */
const wadScale = (n: number): number => THREE.MathUtils.clamp(0.34 * Math.cbrt(n / 15), 0.3, 1.15);

const FALL_SECONDS = 0.35;
const FALL_SPEED = 3.2; // m/s after the tip over the sill

/** Hay wads that ride up the conveyor, tip over the sill and fall into the booth. */
export class Belt implements BeltIO {
  readonly group = new THREE.Group();
  /** Set while a wad that casts a shadow moves. */
  moved = false;
  private readonly cargo: BeltCargo[] = [];
  private readonly meshes = new Map<BeltCargo, THREE.Mesh>();
  private readonly falling = new Map<BeltCargo, { vy: number; age: number }>();
  private arrived = 0;
  private readonly geo = new THREE.BoxGeometry(1, 0.55, 0.8);
  private readonly dir = new THREE.Vector3();
  private readonly pos = new THREE.Vector3();

  constructor(
    private readonly from: THREE.Vector3, // low end, where the player dumps
    private readonly to: THREE.Vector3, // the window sill
    private readonly mat: THREE.Material,
    private readonly onArrive?: (n: number) => void,
  ) {
    this.dir.copy(to).sub(from).normalize();
  }

  dump(n: number): void {
    if (n <= 0) return;
    const cargo = { n, t: 0 };
    this.cargo.push(cargo);
    this.attach(cargo);
    this.moved = true;
  }

  takeArrived(): number {
    const n = this.arrived;
    this.arrived = 0;
    return n;
  }

  riding(): BeltCargo[] {
    return this.cargo.map((c) => ({ ...c }));
  }

  restore(list: BeltCargo[]): void {
    for (const c of this.cargo) this.detach(c);
    this.cargo.length = 0;
    for (const { n, t } of list) {
      if (!(n > 0) || !(t >= 0 && t < 1)) continue;
      const cargo = { n, t };
      this.cargo.push(cargo);
      this.attach(cargo);
    }
    this.moved = true;
  }

  /** Returns true while a wad that casts a shadow moved. */
  update(dt: number): boolean {
    this.moved = false;
    for (const cargo of [...this.cargo]) {
      cargo.t += (dt / BELT_RIDE_SECONDS); // constant belt speed along the path
      const mesh = this.meshes.get(cargo)!;
      if (cargo.t >= 1) {
        // Over the sill: tip forward and drop inside the booth. The mesh moves to the fall phase.
        this.cargo.splice(this.cargo.indexOf(cargo), 1);
        this.falling.set(cargo, { vy: 0, age: 0 });
        this.pos.copy(this.to).addScaledVector(this.dir, 0.18);
        mesh.position.copy(this.pos);
        mesh.rotation.set(0, 0, 0);
        this.moved = true;
        continue;
      }
      this.placeWad(mesh, cargo);
    }
    for (const [cargo, fall] of [...this.falling]) {
      fall.age += dt;
      fall.vy += 9.8 * dt;
      const mesh = this.meshes.get(cargo)!;
      mesh.position.y -= fall.vy * dt;
      mesh.position.addScaledVector(this.dir, FALL_SPEED * dt);
      mesh.rotation.x -= 2.5 * dt; // tips forward as it falls
      this.moved = true;
      if (fall.age >= FALL_SECONDS) {
        this.falling.delete(cargo);
        this.group.remove(mesh);
        this.meshes.delete(cargo);
        this.arrived += cargo.n;
        this.onArrive?.(cargo.n);
      }
    }
    return this.moved;
  }

  private attach(cargo: BeltCargo): void {
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const s = wadScale(cargo.n);
    mesh.scale.set(s, s, s);
    this.placeWad(mesh, cargo);
    this.group.add(mesh);
    this.meshes.set(cargo, mesh);
  }

  private detach(cargo: BeltCargo): void {
    const mesh = this.meshes.get(cargo);
    if (mesh) this.group.remove(mesh);
    this.meshes.delete(cargo);
  }

  /** Rides slightly above the belt surface, with a gentle wobble in the first moments. */
  private placeWad(mesh: THREE.Mesh, cargo: BeltCargo): void {
    this.pos.lerpVectors(this.from, this.to, cargo.t);
    const s = wadScale(cargo.n);
    this.pos.y += 0.03 + 0.275 * s;
    if (cargo.t < 0.15) this.pos.y += Math.sin(cargo.t * 40) * 0.012 * (1 - cargo.t / 0.15); // the dump thump
    mesh.position.copy(this.pos);
  }
}
