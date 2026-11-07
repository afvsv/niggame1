import { BALANCE } from '../data/balance';
import { BuildingId, buildingById } from '../data/buildings';
import { Conveyor, PathPoint, pathLength } from './conveyor';
import type { HayGrid } from '../haystack/grid';
import { Colliders, AABB } from '../world/colliders';
import type { Upgrades } from './Upgrades';

const A = BALANCE.automation;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface Point2 { x: number; z: number }

export interface BuildingRef {
  id: BuildingId;
  x: number;
  z: number;
  rot: number;
  /** Machines: the AABBs this building registered (kept for Colliders.remove by identity). */
  colliders: AABB[];
  /** Belts: the chain and its load. */
  path?: PathPoint[];
  conveyor?: Conveyor;
  /** Generators: hay in the firebox, strands. */
  fuel?: number;
  /** Rakes: the fractional strand accumulator and the output buffer. */
  acc?: number;
  buffer?: number;
  /** Last computed power share, 0..1. */
  power?: number;
}

export interface BuildingSave {
  id: BuildingId;
  x: number;
  z: number;
  rot: number;
  path?: number[][];
  cargo?: Array<[number, number]>;
  /** Belts: strands waiting in the end buffer. */
  pending?: number;
  fuel?: number;
}

export interface RakeRates { rakeRate: number; rakeWidth: number }

const MACHINE_HALF = 0.6; // machine footprint half-extent, metres

/** All player-built machines: placement, the fixed 20 Hz tick and per-frame belt motion. */
export class Factory {
  readonly buildings: BuildingRef[] = [];
  /** True once the yard wad cap is hit; inserts stall and the HUD shows НЕТ МЕСТА. */
  noRoom = false;

  constructor(
    readonly grid: HayGrid,
    private readonly colliders: Colliders,
    readonly up: Upgrades,
    /** The kiosk belt's low end (HAY IN): belts ending near it hand their load over. */
    private readonly kiosk: Point2,
    private readonly onKioskDump?: (n: number) => void,
    /** Current firebox capacity (Derived.fuelCap): limits the fuel clamp and manual refuelling. */
    private readonly fuelCapOf: () => number = () => A.fuelCap,
  ) {}

  collidersCount(): number { return this.colliders.boxes.length; }

  plansOwned(id: BuildingId): boolean { return this.up.level(buildingById(id).plans) > 0; }

  /** Machine footprint box at a spot, for ghost validation. */
  footprint(x: number, z: number): AABB {
    return { minX: x - MACHINE_HALF, maxX: x + MACHINE_HALF, minY: 0, maxY: 1.4, minZ: z - MACHINE_HALF, maxZ: z + MACHINE_HALF };
  }

  /** Places a building. `validate` also runs the collider check (skipped on load). */
  place(id: BuildingId, x: number, z: number, rot: number, validate = true): BuildingRef | null {
    if (!this.plansOwned(id)) return null;
    const def = buildingById(id);
    const ref: BuildingRef = { id, x, z, rot, colliders: [], acc: 0, buffer: 0, power: id === 'rake' ? 0 : undefined };
    if (id === 'belt') { ref.path = []; ref.conveyor = new Conveyor(0); }
    if (id === 'generator') ref.fuel = 0;
    if (def.solid) {
      const box = this.footprint(x, z);
      if (validate && this.colliders.collides(box)) return null;
      this.colliders.addBox(box);
      ref.colliders.push(box);
    }
    this.buildings.push(ref);
    return ref;
  }

  /** Replaces a belt chain (build mode); the load keeps riding on the new length. */
  setBeltPath(ref: BuildingRef, pts: PathPoint[]): void {
    ref.path = pts;
    if (!ref.conveyor) ref.conveyor = new Conveyor(0);
    ref.conveyor.length = pathLength(pts);
  }

  /** Removes a building: colliders go, the cargo and fuel are lost. Returns the 100% refund. */
  demolish(ref: BuildingRef): number {
    const i = this.buildings.indexOf(ref);
    if (i < 0) return 0;
    this.buildings.splice(i, 1);
    for (const box of ref.colliders) this.colliders.remove(box);
    const price = ref.id === 'belt' && ref.path ? A.beltPricePerM * pathLength(ref.path) : buildingById(ref.id).price;
    return Math.round(price * A.refundPct * 100) / 100;
  }

  wadCount(): number {
    let n = 0;
    for (const b of this.buildings) if (b.conveyor) n += b.conveyor.wadCount;
    return n;
  }

  /** Fixed 20 Hz tick: power, generator burn, rakes. Rates come from the current Derived. */
  tick(dt: number, rates: RakeRates): void {
    // Power starts at zero and is only raised by a working generator in reach.
    for (const m of this.buildings) if (m.id === 'rake') m.power = 0;
    const kwOf = (): number => A.generatorKw + this.up.level('gen_out') * 2;
    const rakes = this.buildings.filter((b) => b.id === 'rake');
    const gens = this.buildings.filter((b) => b.id === 'generator');
    // Which generators reach each rake, and how much demand lands on each generator.
    const gensOf = new Map<BuildingRef, BuildingRef[]>();
    const loadByGen = new Map<BuildingRef, number>();
    for (const m of rakes) {
      const list = gens.filter((g) => Math.hypot(m.x - g.x, m.z - g.z) <= A.powerRadiusM);
      gensOf.set(m, list);
      for (const g of list) loadByGen.set(g, (loadByGen.get(g) ?? 0) + buildingById('rake').kw);
    }
    // Output: a generator with fuel gives min(its load, its capacity); an empty one gives 0.
    const outByGen = new Map<BuildingRef, number>();
    for (const g of gens) {
      const load = loadByGen.get(g) ?? 0;
      outByGen.set(g, (g.fuel ?? 0) > 0 ? Math.min(load, kwOf()) : 0);
    }
    // The whole powered network throttles together: total output / total demand.
    // Overlapping radii must not double-count a rake's demand.
    let totalOut = 0, totalDemand = 0;
    for (const g of gens) if ((g.fuel ?? 0) > 0 && (loadByGen.get(g) ?? 0) > 0) totalOut += outByGen.get(g) ?? 0;
    for (const list of gensOf.values()) {
      if (!list.length) continue;
      totalDemand += buildingById('rake').kw; // unique rakes only: gensOf keys are rakes
    }
    const share = totalDemand > 0 ? Math.min(1, totalOut / totalDemand) : 0;
    for (const [m, list] of gensOf) {
      if (list.length) m.power = share;
    }
    // Burn: each rake's actual draw is split across its sources in proportion to their capacity.
    const drawByGen = new Map<BuildingRef, number>();
    for (const [m, list] of gensOf) {
      if (!list.length) continue;
      const cap = list.length * kwOf();
      const draw = buildingById('rake').kw * (m.power ?? 0);
      for (const g of list) drawByGen.set(g, (drawByGen.get(g) ?? 0) + draw * (kwOf() / cap));
    }
    for (const [g, draw] of drawByGen) {
      if (draw > 0) g.fuel = Math.max(0, (g.fuel ?? 0) - A.burnPerSec * (draw / A.generatorKw) * dt);
    }
    // Rakes: a fractional accumulator drains the grid in whole strands.
    for (const m of rakes) this.tickRake(m, dt, rates, m.power ?? 0);
    this.noRoom = this.wadCount() >= A.yardItemCap;
  }

  /** Per-frame belt motion and exit handling (kiosk hand-over, chain hand-over, stall). */
  update(dt: number, beltSpeed: number): void {
    for (const b of this.buildings) if (b.id === 'belt' && b.conveyor) b.conveyor.update(dt, beltSpeed);
    for (const b of this.buildings) {
      if (b.id !== 'belt' || !b.conveyor || b.conveyor.endPending <= 0) continue;
      const end = b.path?.[b.path.length - 1];
      if (end && Math.hypot(end.x - this.kiosk.x, end.z - this.kiosk.z) <= A.kioskJoinM) {
        this.onKioskDump?.(b.conveyor.endPending);
        b.conveyor.takeOut();
        continue;
      }
      const next = this.nextBelt(b);
      if (next && next.conveyor!.insertAtStart(b.conveyor.endPending)) b.conveyor.takeOut();
      // else: the load waits at the end (stall) until the kiosk or a free chain shows up
    }
    this.noRoom = this.wadCount() >= A.yardItemCap;
  }

  serialize(): BuildingSave[] {
    return this.buildings.map((b) => {
      const base: BuildingSave = { id: b.id, x: r2(b.x), z: r2(b.z), rot: r2(b.rot) };
      if (b.id === 'belt') {
        base.path = (b.path ?? []).map((p) => [r2(p.x), r2(p.y), r2(p.z)]);
        base.cargo = b.conveyor?.serialize().wads ?? [];
        base.pending = b.conveyor?.serialize().pending ?? 0;
      }
      if (b.id === 'generator') base.fuel = Math.round(b.fuel ?? 0);
      return base;
    });
  }

  /** Loads buildings from a save; junk entries are skipped. Colliders are created fresh. */
  load(list: unknown): boolean {
    if (!Array.isArray(list)) return false;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const s = item as BuildingSave;
      if (!Number.isFinite(s.x) || !Number.isFinite(s.z)) continue;
      if (!this.plansOwned(s.id)) continue; // the plans are gone from an older save: skip
      const ref = this.place(s.id, s.x, s.z, Number.isFinite(s.rot) ? s.rot : 0, false);
      if (!ref) continue; // duplicate spot: skip
      if (ref.id === 'belt') {
        const pts = Array.isArray(s.path)
          ? s.path.filter((p) => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite)).map((p) => ({ x: p[0], y: p[1] ?? 0.35, z: p[2] ?? 0 }))
          : [];
        if (pts.length >= 2) this.setBeltPath(ref, pts);
        if (ref.conveyor && Array.isArray(s.cargo)) {
          ref.conveyor.load({ wads: s.cargo, pending: Number.isFinite(s.pending) ? s.pending : 0 });
        }
      }
      if (ref.id === 'generator' && Number.isFinite(s.fuel)) {
        ref.fuel = Math.min(this.fuelCapOf(), Math.max(0, s.fuel as number));
      }
    }
    return true;
  }

  private nextBelt(b: BuildingRef): BuildingRef | null {
    const end = b.path?.[b.path.length - 1];
    if (!end) return null;
    let best: BuildingRef | null = null, bestDist: number = A.joinTolM;
    for (const o of this.buildings) {
      if (o === b || o.id !== 'belt' || !o.path?.length) continue;
      const d = Math.hypot(o.path[0].x - end.x, o.path[0].z - end.z);
      if (d <= bestDist) { best = o; bestDist = d; }
    }
    return best;
  }

  private beltInReach(m: BuildingRef): BuildingRef | null {
    const fx = m.x + Math.sin(m.rot) * A.rakePickM, fz = m.z + Math.cos(m.rot) * A.rakePickM;
    let best: BuildingRef | null = null, bestDist: number = A.rakePickM;
    for (const o of this.buildings) {
      if (o.id !== 'belt' || !o.path?.length) continue;
      const d = Math.hypot(o.path[0].x - fx, o.path[0].z - fz);
      if (d <= bestDist) { best = o; bestDist = d; }
    }
    return best;
  }

  private tickRake(m: BuildingRef, dt: number, rates: RakeRates, power: number): void {
    const belt = this.beltInReach(m);
    if (!belt?.conveyor || power <= 0 || this.noRoom) { m.acc = 0; return; }
    // The intake box: ahead of the machine, `rakeWidth` wide, `rakeReachM` deep, over all heights.
    const fx = Math.sin(m.rot), fz = Math.cos(m.rot);
    const rx = -fz * (rates.rakeWidth / 2), rz = fx * (rates.rakeWidth / 2); // right vector
    const x0 = Math.min(m.x + fx * 0.4 + rx, m.x + fx * A.rakeReachM - rx);
    const x1 = Math.max(m.x + fx * 0.4 + rx, m.x + fx * A.rakeReachM - rx);
    const z0 = Math.min(m.z + fz * 0.4 + rz, m.z + fz * A.rakeReachM - rz);
    const z1 = Math.max(m.z + fz * 0.4 + rz, m.z + fz * A.rakeReachM - rz);
    const cells: Array<[number, number, number]> = [];
    const g = this.grid, s = g.cellSize;
    const cx0 = Math.max(0, Math.floor((x0 - g.originX) / s)), cx1 = Math.min(g.nx - 1, Math.floor((x1 - g.originX) / s));
    const cz0 = Math.max(0, Math.floor((z0 - g.originZ) / s)), cz1 = Math.min(g.nz - 1, Math.floor((z1 - g.originZ) / s));
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) for (let y = 0; y < g.ny; y++) {
      if (g.get(x, y, z) > 0) cells.push([x, y, z]);
    }
    if (!cells.length) { m.acc = 0; return; } // dry zone: idle
    m.acc = (m.acc ?? 0) + rates.rakeRate * power * dt;
    let n = Math.floor(m.acc);
    if (n <= 0) return;
    n = Math.min(n, A.wadMaxStrands - (m.buffer ?? 0));
    if (n <= 0) return; // the output buffer is full: wait for the belt to move
    // Prefer cells towards the machine and higher up, like a hand dig does.
    cells.sort((a, b) => {
      const da = (g.originX + (a[0] + 0.5) * s - m.x) ** 2 + (g.originZ + (a[2] + 0.5) * s - m.z) ** 2 - a[1] * 0.05;
      const db = (g.originX + (b[0] + 0.5) * s - m.x) ** 2 + (g.originZ + (b[2] + 0.5) * s - m.z) ** 2 - b[1] * 0.05;
      return da - db;
    });
    let got = 0;
    for (const [x, y, z] of cells) {
      if (got >= n) break;
      got += g.remove(x, y, z, n - got);
    }
    m.acc -= got;
    m.buffer = (m.buffer ?? 0) + got;
    if (m.buffer > 0 && belt.conveyor.insertAtStart(m.buffer)) m.buffer = 0; // else: waits for room
  }
}
