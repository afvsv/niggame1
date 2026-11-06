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

/** Seconds from a dump at the low end to the drop through the window (≈4.3 m of belt at 0.7 m/s). */
export const BELT_RIDE_SECONDS = 6.2;

/** Pile width for a load of `n` strands: a handful makes a small clump, a wheelbarrow a heap. */
export function pileWidth(n: number): number {
  return THREE.MathUtils.clamp(0.16 * Math.cbrt(n / 15), 0.13, 0.5);
}

const FALL_SECONDS = 0.35;
const FALL_SPEED = 3.2; // m/s after the tip over the sill

/** Hay loads that ride up the conveyor, tip over the sill and fall into the booth. */
export class Belt implements BeltIO {
  readonly group = new THREE.Group();
  /** Set while something that casts a shadow moves. */
  moved = false;
  private readonly cargo: BeltCargo[] = [];
  private readonly meshes = new Map<BeltCargo, THREE.Object3D>();
  private readonly falling = new Map<BeltCargo, { vy: number; age: number }>();
  private arrived = 0;
  private readonly dir = new THREE.Vector3();
  private readonly pos = new THREE.Vector3();
  /** Cumulative length at each path point; cargo travels by arc length. */
  private readonly lens: number[] = [];
  readonly total: number;

  constructor(
    private readonly path: THREE.Vector3[], // low end → knee(s) → the window sill
    private readonly makeWad: (n: number) => THREE.Object3D,
    private readonly onArrive?: (n: number) => void,
  ) {
    let acc = 0;
    this.lens.push(0);
    for (let i = 1; i < path.length; i++) { acc += path[i].distanceTo(path[i - 1]); this.lens.push(acc); }
    this.total = acc;
    this.dir.copy(path[path.length - 1]).sub(path[path.length - 2]).normalize();
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
      cargo.t += dt / BELT_RIDE_SECONDS; // constant belt speed along the path
      const mesh = this.meshes.get(cargo)!;
      if (cargo.t >= 1) {
        // Over the sill: tip forward and drop inside the booth. The wad moves to the fall phase.
        this.cargo.splice(this.cargo.indexOf(cargo), 1);
        this.falling.set(cargo, { vy: 0, age: 0 });
        this.pos.copy(this.path[this.path.length - 1]).addScaledVector(this.dir, 0.18);
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
    const wad = this.makeWad(cargo.n);
    this.placeWad(wad, cargo);
    this.group.add(wad);
    this.meshes.set(cargo, wad);
  }

  private detach(cargo: BeltCargo): void {
    const wad = this.meshes.get(cargo);
    if (wad) this.group.remove(wad);
    this.meshes.delete(cargo);
  }

  /** Rides on the belt surface, with a gentle wobble in the first moments. */
  private placeWad(mesh: THREE.Object3D, cargo: BeltCargo): void {
    const s = cargo.t * this.total;
    let i = 1;
    while (i < this.lens.length - 1 && this.lens[i] < s) i++;
    const seg = this.lens[i] - this.lens[i - 1] || 1;
    this.pos.lerpVectors(this.path[i - 1], this.path[i], (s - this.lens[i - 1]) / seg);
    this.pos.y += 0.035;
    if (cargo.t < 0.1) this.pos.y += Math.sin(cargo.t * 60) * 0.012 * (1 - cargo.t / 0.1); // the dump thump
    mesh.position.copy(this.pos);
  }
}
