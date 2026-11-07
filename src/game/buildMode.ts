import { BALANCE } from '../data/balance';
import { BuildingId, buildingById } from '../data/buildings';
import { BuildingRef, Factory } from './factory';
import type { PathPoint } from './conveyor';

const A = BALANCE.automation;
const r2 = (v: number) => Math.round(v * 100) / 100;
const snap = (v: number) => Math.round(v / A.snapM) * A.snapM;

export interface BeltPoint { x: number; z: number }

/**
 * Intersection parameter along [p→q] with the segment [a→b] in the x/z plane; -1 = no crossing.
 * A collinear overlap reports its far end so running back along a chain is caught, while the
 * single shared point of a straight extension stays within the join tolerance.
 */
function crossT(px: number, pz: number, qx: number, qz: number, ax: number, az: number, bx: number, bz: number): number {
  const rx = qx - px, rz = qz - pz, sx = bx - ax, sz = bz - az;
  const den = rx * sz - rz * sx;
  const ex = ax - px, ez = az - pz;
  if (Math.abs(den) < 1e-9) {
    if (Math.abs(ex * rz - ez * rx) > 1e-9) return -1; // parallel, on different lines
    const rr = rx * rx + rz * rz;
    if (rr < 1e-12) return 0; // degenerate: the candidate is a point
    const t0 = (ex * rx + ez * rz) / rr, t1 = ((bx - px) * rx + (bz - pz) * rz) / rr;
    const hi = Math.max(t0, t1);
    if (hi < -1e-9 || Math.min(t0, t1) > 1 + 1e-9) return -1; // collinear but disjoint
    return Math.min(1, hi);
  }
  const t = (ex * sz - ez * sx) / den, u = (ex * rz - ez * rx) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return -1;
  return t;
}

/** What the build mode is doing right now. */
export type Activity =
  | { kind: 'none' }
  | { kind: 'ghost'; id: BuildingId; rot: number } // a machine ghost follows the aim
  | { kind: 'belt' }; // drawing a belt chain segment by segment

/** Build-mode rules. Money goes through the host; placement rules live here. */
export class BuildMode {
  activity: Activity = { kind: 'none' };
  /** Seconds [X] has been held on the aimed building (demolition progress). */
  demolishHold = 0;
  /** Set when a placement fails, so the HUD can say why. */
  lastError: '' | 'no-plans' | 'no-money' | 'blocked' | 'forbidden' | 'too-close' | 'no-room' = '';
  /** Draw the last placed segment here so the ghost can follow the chain end. */
  chainEnd: BeltPoint | null = null;

  constructor(private readonly host: {
    factory: Factory;
    inside(x: number, z: number): boolean;
    forbidden(x: number, z: number): boolean;
    money(): number;
    spend(n: number): boolean;
    refund(n: number): void;
    wadCount(): number;
  }) {}

  get busy(): boolean { return this.activity.kind !== 'none'; }

  /** [B] catalogue pick: machines become a ghost, a belt opens chain drawing. */
  choose(id: BuildingId): void {
    this.dropStub(); // a chain that never grew a segment leaves no belt behind
    this.activity = id === 'belt' ? { kind: 'belt' } : { kind: 'ghost', id, rot: 0 };
    this.chainEnd = null;
    this.lastError = '';
  }

  cancel(): void {
    // RMB while drawing a belt: undo the last segment; otherwise leave the build mode.
    if (this.activity.kind === 'belt' && this.undoLastSegment()) return;
    this.activity = { kind: 'none' };
    this.chainEnd = null;
  }

  rotate(): void {
    if (this.activity.kind === 'ghost') this.activity.rot = (this.activity.rot + Math.PI / 2) % (Math.PI * 2);
  }

  /** Machine price at the spot; belts are priced per metre by the segment length. */
  priceOf(id: BuildingId, length = 0): number {
    return id === 'belt' ? Math.round(A.beltPricePerM * length * 100) / 100 : buildingById(id).price;
  }

  /** Placement validity of a machine at a spot (ghost colour + reasons). */
  canPlaceMachine(id: BuildingId, x: number, z: number): boolean {
    this.lastError = '';
    if (!this.host.factory.plansOwned(id)) { this.lastError = 'no-plans'; return false; }
    if (this.host.money() < this.priceOf(id)) { this.lastError = 'no-money'; return false; }
    if (!this.host.inside(x, z)) { this.lastError = 'blocked'; return false; }
    if (this.host.forbidden(x, z)) { this.lastError = 'forbidden'; return false; }
    if (!this.host.factory.canPlace(id, x, z)) { this.lastError = 'blocked'; return false; }
    return true;
  }

  /** Places the ghosted machine; returns false when the spot is invalid or money is short. */
  placeMachine(id: BuildingId, x: number, z: number, rot: number): BuildingRef | null {
    if (!this.canPlaceMachine(id, x, z)) return null;
    if (!this.host.spend(this.priceOf(id))) { this.lastError = 'no-money'; return null; }
    return this.host.factory.place(id, x, z, rot);
  }

  /** Ghost validity of a belt segment (no mutation). */
  canBeltSegment(aimX: number, aimZ: number): boolean {
    this.lastError = '';
    const start = { x: r2(snap(aimX)), z: r2(snap(aimZ)) };
    const from = this.chainEnd ?? start;
    if (!this.chainEnd) {
      return this.host.money() >= this.priceOf('belt', A.segmentMinM)
        && !this.host.forbidden(start.x, start.z) && this.host.inside(start.x, start.z);
    }
    let tx = snap(aimX), tz = snap(aimZ);
    const dist = Math.hypot(tx - from.x, tz - from.z);
    const len = Math.min(dist, A.segmentMaxM);
    if (len < A.segmentMinM - 1e-9) return false;
    const tx2 = r2(snap(from.x + (tx - from.x) / (dist || 1) * len));
    const tz2 = r2(snap(from.z + (tz - from.z) / (dist || 1) * len));
    const mx = (from.x + tx2) / 2, mz = (from.z + tz2) / 2;
    if (!this.host.inside(tx2, tz2) || !this.host.inside(mx, mz) || this.host.forbidden(mx, mz) || this.host.forbidden(tx2, tz2)) return false;
    if (this.beltBlocked(from, tx2, tz2)) { this.lastError = 'blocked'; return false; }
    return this.host.money() >= this.priceOf('belt', len);
  }

  /** Belt placement: continues the active chain from its free end (snapped, 1–2.5 m). */
  placeBeltSegment(aimX: number, aimZ: number): boolean {
    this.lastError = '';
    const factory = this.host.factory;
    const start = { x: r2(snap(aimX)), z: r2(snap(aimZ)) };
    if (!this.chainEnd) {
      // Attach to the free end of an existing chain within the join tolerance, else start fresh.
      const near = factory.buildings.find((b) => b.id === 'belt' && b.path?.length &&
        Math.hypot(b.path[b.path.length - 1].x - start.x, b.path[b.path.length - 1].z - start.z) <= A.joinTolM);
      this.chainEnd = near
        ? { x: near.path![near.path!.length - 1].x, z: near.path![near.path!.length - 1].z }
        : start;
      return true; // laying the start is free
    }
    const from = this.chainEnd!;
    // The chain being drawn lives at its free end: a fresh belt starts there, not at the aim,
    // so the placed path is exactly the segment the ghost validated.
    const belt = this.activeBelt(factory, from);
    // Snap the aim to the build grid, then clamp the segment length.
    let tx = snap(aimX), tz = snap(aimZ);
    const dx = tx - from.x, dz = tz - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist < A.segmentMinM - 1e-9) { this.lastError = 'too-close'; return false; }
    const capped = Math.min(dist, A.segmentMaxM);
    tx = from.x + (dx / dist) * capped;
    tz = from.z + (dz / dist) * capped;
    tx = r2(snap(tx)); tz = r2(snap(tz));
    const len = Math.hypot(tx - from.x, tz - from.z);
    if (len < A.segmentMinM - 1e-9) { this.lastError = 'too-close'; return false; }
    // Not into forbidden ground, out of the hangar, or through hay, machines and other belts.
    const mx = (from.x + tx) / 2, mz = (from.z + tz) / 2;
    if (!this.host.inside(tx, tz) || !this.host.inside(mx, mz) || this.host.forbidden(mx, mz) || this.host.forbidden(tx, tz)) { this.lastError = 'forbidden'; return false; }
    if (this.beltBlocked(from, tx, tz)) { this.lastError = 'blocked'; return false; }
    const price = this.priceOf('belt', len);
    if (this.host.money() < price) { this.lastError = 'no-money'; return false; }
    if (!this.host.spend(price)) { this.lastError = 'no-money'; return false; }
    const pts: PathPoint[] = [...belt.path!, { x: tx, y: 0.35, z: tz }];
    factory.setBeltPath(belt, pts);
    this.chainEnd = { x: tx, z: tz };
    return true;
  }

  /** RMB in belt mode: removes the last segment with a per-metre refund; the chain vanishes below two points. */
  undoLastSegment(): boolean {
    if (!this.chainEnd) return false;
    const factory = this.host.factory;
    const belt = factory.buildings.find((b) => b.id === 'belt' && b.path?.length &&
      b.path[b.path.length - 1].x === this.chainEnd!.x && b.path[b.path.length - 1].z === this.chainEnd!.z);
    if (!belt) { this.chainEnd = null; return false; }
    const path = belt.path ?? [];
    if (path.length < 2) { // a bare chain start disappears with the undo
      factory.discard(belt);
      this.chainEnd = null;
      return true;
    }
    const end = path[path.length - 1], prev = path[path.length - 2];
    this.host.refund(this.priceOf('belt', Math.hypot(end.x - prev.x, end.z - prev.z)));
    factory.setBeltPath(belt, path.slice(0, -1));
    if (belt.path!.length < 2) { // below two points the belt has no segments: no stub may stay behind
      factory.discard(belt);
      this.chainEnd = null;
      return true;
    }
    const last = belt.path![belt.path!.length - 1];
    this.chainEnd = { x: last.x, z: last.z };
    return true;
  }

  /** Demolition: hold [X]; the progress bar is the held time. Returns true when it went off. */
  demolishStep(dt: number, target: BuildingRef | null, xHeld: boolean): boolean {
    if (!target || !xHeld) { this.demolishHold = 0; return false; }
    this.demolishHold += dt;
    if (this.demolishHold < A.demolishHoldS) return false;
    this.demolishHold = 0;
    const refund = this.host.factory.demolish(target);
    this.host.refund(refund);
    return true;
  }

  private activeBelt(factory: Factory, start: BeltPoint): BuildingRef {
    // The chain being drawn: reuse the belt that owns chainEnd, else start a new one there.
    if (this.chainEnd) {
      const owner = factory.buildings.find((b) => b.id === 'belt' && b.path?.length &&
        b.path[b.path.length - 1].x === this.chainEnd!.x && b.path[b.path.length - 1].z === this.chainEnd!.z);
      if (owner) return owner;
    }
    const fresh = factory.place('belt', start.x, start.z, 0);
    factory.setBeltPath(fresh!, [{ x: start.x, y: 0.35, z: start.z }]);
    return fresh!;
  }

  /** The belt that owns chainEnd, if any. */
  private ownerOf(factory: Factory): BuildingRef | null {
    if (!this.chainEnd) return null;
    return factory.buildings.find((b) => b.id === 'belt' && b.path?.length &&
      b.path[b.path.length - 1].x === this.chainEnd!.x && b.path[b.path.length - 1].z === this.chainEnd!.z) ?? null;
  }

  /** Switching items or leaving the mode: a chain with no segments yet is discarded, no refund. */
  private dropStub(): void {
    if (this.activity.kind !== 'belt') return;
    const belt = this.ownerOf(this.host.factory);
    if (belt && (belt.path?.length ?? 0) < 2) {
      this.host.factory.discard(belt);
      this.chainEnd = null;
    }
  }

  /**
   * A segment is blocked when a sample point (every 0.25 m along it, at y 0 m and 0.5 m) sits in a
   * hay cell or inside a solid machine, or when it crosses another belt chain beyond the join end.
   */
  private beltBlocked(from: BeltPoint, toX: number, toZ: number): boolean {
    const factory = this.host.factory;
    const g = factory.grid;
    const dx = toX - from.x, dz = toZ - from.z;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / 0.25));
    for (let i = 0; i <= steps; i++) {
      const x = from.x + (dx * i) / steps, z = from.z + (dz * i) / steps;
      for (const wy of [0, 0.5]) {
        const [cx, cy, cz] = g.worldToCell(x, wy, z);
        if (g.get(cx, cy, cz) > 0) return true;
        for (const b of factory.buildings)
          for (const box of b.colliders)
            if (x >= box.minX && x <= box.maxX && wy >= box.minY && wy <= box.maxY && z >= box.minZ && z <= box.maxZ) return true;
      }
    }
    for (const o of factory.buildings) {
      if (o.id !== 'belt' || !o.path || o.path.length < 2) continue;
      for (let i = 1; i < o.path.length; i++) {
        const t = crossT(from.x, from.z, toX, toZ, o.path[i - 1].x, o.path[i - 1].z, o.path[i].x, o.path[i].z);
        if (t >= 0 && t * len > A.joinTolM + 1e-9) return true;
      }
    }
    return false;
  }
}
