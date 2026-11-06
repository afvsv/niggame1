import { describe, expect, it } from 'vitest';
import { Factory } from './factory';
import { Upgrades } from './Upgrades';
import { HayGrid } from '../haystack/grid';
import { Colliders } from '../world/colliders';
import { BALANCE } from '../data/balance';

const A = BALANCE.automation;

/** A small hay grid with a block of full cells around world (0, 0.4, z>0). */
function makeGrid(): HayGrid {
  const g = new HayGrid(40, 24, 40, 0.2, -4, 0, -4, 10);
  for (let y = 2; y < 5; y++)
    for (let z = 20; z < 26; z++)
      for (let x = 18; x < 23; x++) g.set(x, y, z, 10);
  return g;
}

function upWithPlans(): Upgrades {
  const up = new Upgrades();
  up.load({ belt_plans: 1, rake_plans: 1, power: 1 }); // load skips the requirement chain on purpose
  return up;
}

/** A factory with a belt whose start sits right in front of a rake at (0, 0). */
function rig() {
  const grid = makeGrid();
  const colliders = new Colliders(grid);
  const factory = new Factory(grid, colliders, upWithPlans(), { x: 99, z: 99 });
  // The rake stands just off the stack edge (like in play): forward = +z into the filled cells.
  const gen = factory.place('generator', 1.4, -1.0, 0)!; // within the power radius of the rake
  const rake = factory.place('rake', 0, -1.2, 0)!;
  const belt = factory.place('belt', 0, -1.2, 0)!;
  factory.setBeltPath(belt, [{ x: 0.1, y: 0.35, z: 0.2 }, { x: 0.1, y: 0.35, z: 4.2 }]); // starts at the rake output
  return { grid, colliders, factory, gen, rake, belt };
}

describe('Factory', () => {
  it('requires the plans and registers/deregisters machine colliders', () => {
    const grid = makeGrid();
    const up = new Upgrades(); // no plans bought
    const factory = new Factory(grid, new Colliders(grid), up, { x: 99, z: 99 });
    expect(factory.place('rake', 5, -3, 0)).toBeNull(); // free spot, but no plans
    up.load({ rake_plans: 1 }); // the Factory trusts its own plans; the tree gates the chain
    expect(factory.place('rake', 5, -3, 0)).not.toBeNull();
    factory.buildings.length = 0;
    const up2 = new Upgrades();
    up2.load({ belt_plans: 1, rake_plans: 1, power: 1 });
    const factory2 = new Factory(grid, new Colliders(grid), up2, { x: 99, z: 99 });
    const ref = factory2.place('rake', 5, -3, 0)!;
    expect(ref.id).toBe('rake');
    const boxes = factory.collidersCount();
    const refund = factory2.demolish(ref);
    expect(refund).toBeCloseTo(A.rakePrice);
    expect(factory2.collidersCount()).toBe(boxes - ref.colliders.length);
  });

  it('the rake pulls whole strands through the belt at its rated rate', () => {
    const { grid, factory, belt, gen } = rig();
    gen.fuel = A.fuelCap;
    const before = grid.total;
    const dt = 0.05;
    for (let i = 0; i < 40; i++) factory.tick(dt, { rakeRate: 12, rakeWidth: 1 }); // 2 s
    const pulled = before - grid.total;
    expect(pulled).toBeGreaterThanOrEqual(12 * 2 - 1); // ~12/s, integer removes only
    expect(pulled).toBeLessThanOrEqual(12 * 2);
    factory.update(dt, 0.7);
    expect(belt.conveyor!.total).toBeGreaterThan(0);
    expect(belt.conveyor!.wads.every((w) => w.s > 0)).toBe(true);
  });

  it('the rake stops when there is no belt in reach and when the zone is dry', () => {
    const { grid, factory, belt } = rig();
    factory.demolish(belt);
    const before = grid.total;
    for (let i = 0; i < 20; i++) factory.tick(0.05, { rakeRate: 12, rakeWidth: 1 }); // 1 s, no belt
    expect(grid.total).toBe(before); // nothing pulled, nothing spilled on the floor
    // Dry the intake zone out: the rake idles even with a belt back in place.
    const belt2 = factory.place('belt', 0, -1.2, 0)!;
    factory.setBeltPath(belt2, [{ x: 0.1, y: 0.35, z: 0.2 }, { x: 0.1, y: 0.35, z: 4.2 }]);
    for (let x = 0; x < 40; x++) for (let y = 0; y < 24; y++) for (let z = 0; z < 40; z++) {
      const wx = grid.originX + (x + 0.5) * grid.cellSize, wz = grid.originZ + (z + 0.5) * grid.cellSize;
      if (wx > -1 && wx < 1 && wz > -1 && wz < 3) grid.set(x, y, z, 0);
    }
    const after = grid.total;
    for (let i = 0; i < 20; i++) factory.tick(0.05, { rakeRate: 12, rakeWidth: 1 });
    expect(grid.total).toBe(after);
  });

  it('the generator burns fuel in proportion to the load', () => {
    const { factory, gen } = rig();
    gen.fuel = A.fuelCap;
    for (let i = 0; i < 100; i++) factory.tick(0.05, { rakeRate: 12, rakeWidth: 1 }); // 5 s
    const burned = A.fuelCap - gen.fuel;
    expect(burned).toBeGreaterThan(0);
    expect(burned).toBeLessThan(A.burnPerSec * 5); // 0.8 kW of 6 kW: well under the full-rate burn
  });

  it('a belt that ends at the kiosk hands its load over; others stall at the end', () => {
    const grid = makeGrid();
    const dumped: number[] = [];
    const factory = new Factory(grid, new Colliders(grid), upWithPlans(), { x: 2, z: 2 }, (n) => dumped.push(n));
    const belt = factory.place('belt', 0, 0, 0)!;
    factory.setBeltPath(belt, [{ x: 0, y: 0.35, z: 0 }, { x: 0, y: 0.35, z: 1.9 }]); // the end is ~0.14 m from the kiosk point
    belt.conveyor!.insert(30, 0);
    for (let i = 0; i < 30; i++) factory.update(0.1, 0.7); // 3 s at 0.7 m/s: past the end
    expect(dumped.length).toBeGreaterThan(0);
    expect(dumped.reduce((a, b) => a + b, 0)).toBe(30);
    // A belt far from the kiosk and from any other belt: the load waits at the end.
    const far = factory.place('belt', -5, -5, 0)!;
    factory.setBeltPath(far, [{ x: -5, y: 0.35, z: -5 }, { x: -5, y: 0.35, z: -3.2 }]);
    far.conveyor!.insert(25, 0);
    for (let i = 0; i < 30; i++) factory.update(0.1, 0.7);
    expect(far.conveyor!.endPending).toBeGreaterThan(0);
    expect(far.conveyor!.total).toBe(25);
  });

  it('the yard wad cap flags NO ROOM', () => {
    const grid = makeGrid();
    const factory = new Factory(grid, new Colliders(grid), upWithPlans(), { x: 99, z: 99 });
    const belt = factory.place('belt', 0, 0, 0)!;
    factory.setBeltPath(belt, [{ x: 0, y: 0.35, z: 0 }, { x: 0, y: 0.35, z: 500 }]);
    for (let i = 0; i < A.yardItemCap; i++) belt.conveyor!.insert(1, i * A.gapM);
    expect(factory.wadCount()).toBe(A.yardItemCap);
    factory.update(0.01, 0.7);
    expect(factory.noRoom).toBe(true);
  });

  it('survives a save round-trip and re-creates colliders', () => {
    const { factory, belt, gen } = rig();
    gen.fuel = 77;
    belt.conveyor!.insert(44, 1);
    const data = factory.serialize();
    const grid2 = makeGrid();
    const factory2 = new Factory(grid2, new Colliders(grid2), upWithPlans(), { x: 99, z: 99 });
    const boxesBefore = factory2.collidersCount();
    expect(factory2.load(data)).toBe(true);
    expect(factory2.buildings.length).toBe(factory.buildings.length);
    expect(factory2.collidersCount()).toBe(boxesBefore + 2); // rake + generator re-registered
    const belt2 = factory2.buildings.find((b) => b.id === 'belt')!;
    expect(belt2.conveyor!.total).toBe(44);
    expect(factory2.buildings.find((b) => b.id === 'generator')!.fuel).toBe(77);
  });
});
