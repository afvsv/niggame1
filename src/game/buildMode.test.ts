import { describe, expect, it } from 'vitest';
import { BuildMode } from './buildMode';
import { Factory } from './factory';
import { Upgrades } from './Upgrades';
import { HayGrid } from '../haystack/grid';
import { Colliders } from '../world/colliders';

/** An empty grid plus a belt-capable factory and a build mode with a purse. */
function rig(fill?: (g: HayGrid) => void) {
  const grid = new HayGrid(40, 24, 40, 0.2, -4, 0, -4, 10);
  fill?.(grid);
  const up = new Upgrades();
  up.load({ belt_plans: 1, rake_plans: 1, power: 1 }); // load skips the requirement chain on purpose
  const factory = new Factory(grid, new Colliders(grid), up, { x: 99, z: 99 });
  const purse = { money: 500 };
  const bm = new BuildMode({
    factory,
    inside: () => true,
    forbidden: () => false,
    money: () => purse.money,
    spend: (n) => { if (purse.money + 1e-9 < n) return false; purse.money -= n; return true; },
    refund: (n) => { purse.money += n; },
    wadCount: () => 0,
  });
  return { grid, factory, bm, purse };
}

/** Fills every cell whose world centre lands in the box, at the given cell layers (y = 0 m and 0.5 m). */
function fillHay(g: HayGrid, x0: number, x1: number, z0: number, z1: number): void {
  for (let z = 0; z < g.nz; z++)
    for (let x = 0; x < g.nx; x++) {
      const wx = g.originX + (x + 0.5) * g.cellSize, wz = g.originZ + (z + 0.5) * g.cellSize;
      if (wx >= x0 && wx <= x1 && wz >= z0 && wz <= z1) for (const y of [0, 2]) g.set(x, y, z, 10);
    }
}

describe('BuildMode belt validation', () => {
  it('rejects a segment that runs through hay', () => {
    const { factory, bm, purse } = rig((g) => fillHay(g, 1.2, 2.2, -0.4, 0.4));
    expect(bm.placeBeltSegment(0.1, 0.1)).toBe(true); // the chain start at (0, 0)
    expect(bm.chainEnd).toEqual({ x: 0, z: 0 });
    expect(bm.canBeltSegment(3, 0.1)).toBe(false);
    expect(bm.lastError).toBe('blocked');
    expect(bm.placeBeltSegment(3, 0.1)).toBe(false);
    const belt = factory.buildings.find((b) => b.id === 'belt')!;
    expect(belt.path!.length).toBe(1); // nothing was added
    expect(purse.money).toBe(500); // and nothing was paid
  });

  it('rejects a segment that runs through a machine footprint', () => {
    const { factory, bm } = rig();
    expect(factory.place('rake', 1.5, 0, 0)).not.toBeNull(); // footprint x 0.9..2.1, z -0.6..0.6
    expect(bm.placeBeltSegment(0.1, 0.1)).toBe(true);
    expect(bm.canBeltSegment(3, 0.1)).toBe(false);
    expect(bm.lastError).toBe('blocked');
    expect(bm.placeBeltSegment(3, 0.1)).toBe(false);
    expect(bm.placeBeltSegment(0.1, 2.1)).toBe(true); // sideways around the machine still works
  });

  it('rejects a segment that crosses another belt chain', () => {
    const { factory, bm } = rig();
    const a = factory.place('belt', 0, 0, 0)!;
    factory.setBeltPath(a, [{ x: 0, y: 0.35, z: 0 }, { x: 0, y: 0.35, z: 2 }]);
    expect(bm.placeBeltSegment(-2.1, 1.1)).toBe(true); // a fresh chain at (-2, 1)
    expect(bm.canBeltSegment(2, 1.1)).toBe(false); // its ghost crosses chain a at (0, 0.2)
    expect(bm.lastError).toBe('blocked');
    expect(bm.placeBeltSegment(2, 1.1)).toBe(false);
  });

  it('places exactly the segment the ghost validated: from the chain start, not from the aim', () => {
    const { factory, bm } = rig();
    expect(bm.placeBeltSegment(0.1, 0.1)).toBe(true); // chain start at (0, 0)
    expect(bm.placeBeltSegment(3, 0.1)).toBe(true); // aim (3, 0): the segment caps at 2.5 m
    const belt = factory.buildings.find((b) => b.id === 'belt')!;
    expect(belt.path!.length).toBe(2);
    expect(belt.path![0]).toEqual({ x: 0, y: 0.35, z: 0 }); // the first click owns the intake
    expect(belt.path![1].x).toBe(2.5);
    expect(belt.conveyor!.length).toBe(2.5); // the player pays for the metres the path really has
    expect(bm.chainEnd).toEqual({ x: 2.5, z: 0 }); // the chain continues from the capped end
  });

  it('accepts extending from a free end: the join touch within 0.35 m is not a crossing', () => {
    const { factory, bm } = rig();
    const a = factory.place('belt', 0, 0, 0)!;
    factory.setBeltPath(a, [{ x: 0, y: 0.35, z: 0 }, { x: 0, y: 0.35, z: 2 }]);
    expect(bm.placeBeltSegment(0.1, 2.1)).toBe(true); // attaches to the free end at (0, 2)
    expect(bm.chainEnd).toEqual({ x: 0, z: 2 });
    expect(bm.canBeltSegment(0.1, 4.1)).toBe(true); // straight on: touches only at the join
    expect(bm.placeBeltSegment(0.1, 4.1)).toBe(true);
    expect(a.path!.length).toBe(3);
  });
});

describe('BuildMode orphan belts', () => {
  it('undoing below two points removes the belt from the factory', () => {
    const { factory, bm, purse } = rig();
    expect(bm.placeBeltSegment(0.1, 0.1)).toBe(true); // chain start
    expect(bm.placeBeltSegment(3, 0.1)).toBe(true); // segment 1
    expect(bm.placeBeltSegment(5.5, 0.1)).toBe(true); // segment 2
    expect(factory.buildings.filter((b) => b.id === 'belt').length).toBe(1);
    expect(bm.undoLastSegment()).toBe(true);
    const belt = factory.buildings.find((b) => b.id === 'belt')!;
    expect(belt.path!.length).toBe(2); // one segment left
    expect(bm.undoLastSegment()).toBe(true);
    expect(factory.buildings.find((b) => b.id === 'belt')).toBeUndefined(); // no 1-point stub stays behind
    expect(purse.money).toBe(500); // both segments refunded, the stub is not charged
  });

  it('nextBelt never hands a load over to a one-point belt', () => {
    const { factory } = rig();
    const a = factory.place('belt', 0, -2, 0)!;
    factory.setBeltPath(a, [{ x: 0, y: 0.35, z: -2 }, { x: 0, y: 0.35, z: 0 }]); // ends at (0, 0)
    const stub = factory.place('belt', 0.2, 0, 0)!;
    factory.setBeltPath(stub, [{ x: 0.2, y: 0.35, z: 0 }]); // one point, 0.2 m from a's end
    a.conveyor!.insertAtStart(40);
    for (let i = 0; i < 30; i++) factory.update(0.1, 0.7); // 3 s: the load reaches the end
    expect(a.conveyor!.endPending).toBeGreaterThan(0);
    factory.update(0.1, 0.7);
    expect(a.conveyor!.endPending).toBeGreaterThan(0); // the stub gets nothing
    expect(stub.conveyor!.total).toBe(0);
    // A real chain in the same spot takes the load.
    factory.setBeltPath(stub, [{ x: 0.2, y: 0.35, z: 0 }, { x: 0.2, y: 0.35, z: 2 }]);
    factory.update(0.1, 0.7);
    expect(a.conveyor!.endPending).toBe(0);
    expect(stub.conveyor!.total).toBeGreaterThan(0);
  });
});
