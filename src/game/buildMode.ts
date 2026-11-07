import { BALANCE } from '../data/balance';
import { BuildingId, buildingById } from '../data/buildings';
import { BuildingRef, Factory } from './factory';
import type { PathPoint } from './conveyor';

const A = BALANCE.automation;
const r2 = (v: number) => Math.round(v * 100) / 100;
const snap = (v: number) => Math.round(v / A.snapM) * A.snapM;

export interface BeltPoint { x: number; z: number }

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
    const belt = this.activeBelt(factory, start);
    const from = this.chainEnd;
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
    // Not into forbidden ground or out of the hangar.
    const mx = (from.x + tx) / 2, mz = (from.z + tz) / 2;
    if (!this.host.inside(tx, tz) || !this.host.inside(mx, mz) || this.host.forbidden(mx, mz) || this.host.forbidden(tx, tz)) { this.lastError = 'forbidden'; return false; }
    const price = this.priceOf('belt', len);
    if (this.host.money() < price) { this.lastError = 'no-money'; return false; }
    if (!this.host.spend(price)) { this.lastError = 'no-money'; return false; }
    const pts: PathPoint[] = [...belt.path!, { x: tx, y: 0.35, z: tz }];
    factory.setBeltPath(belt, pts);
    this.chainEnd = { x: tx, z: tz };
    return true;
  }

  /** RMB in belt mode: removes the last segment with a per-metre refund. */
  undoLastSegment(): boolean {
    const start = this.chainEnd ?? { x: 0, z: 0 };
    const belt = this.activeBelt(this.host.factory, start);
    const path = belt.path ?? [];
    if (path.length < 2) return false; // a bare chain start disappears with the mode
    const end = path[path.length - 1], prev = path[path.length - 2];
    const len = Math.hypot(end.x - prev.x, end.z - prev.z);
    this.host.refund(this.priceOf('belt', len));
    belt.path = path.slice(0, -1);
    this.host.factory.setBeltPath(belt, belt.path);
    this.chainEnd = { x: belt.path[belt.path.length - 1].x, z: belt.path[belt.path.length - 1].z };
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
}
