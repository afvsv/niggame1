import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Belt, BELT_RIDE_SECONDS } from './belt';

const from = new THREE.Vector3(0, 0.3, 2.1);
const to = new THREE.Vector3(0, 1.02, 0);
const wad = () => new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.1)); // stand-in for the straw pile
const make = (onArrive?: (n: number) => void) => new Belt(from, to, wad, onArrive);

/** Steps the belt past the whole ride and the drop. */
function ride(belt: Belt, dumps: number[] = []): void {
  for (const n of dumps) belt.dump(n);
  const step = 0.05;
  for (let t = 0; t <= BELT_RIDE_SECONDS + 1; t += step) belt.update(step);
}

describe('Belt', () => {
  it('pays for a dump exactly once, when the wad drops into the booth', () => {
    const belt = make();
    belt.dump(40);
    expect(belt.takeArrived()).toBe(0); // still riding
    ride(belt);
    expect(belt.takeArrived()).toBe(40);
    expect(belt.takeArrived()).toBe(0); // no double sale
  });

  it('pays for every dump and calls back per delivery', () => {
    const got: number[] = [];
    const belt = make((n) => got.push(n));
    ride(belt, [10, 5, 30]);
    expect(belt.takeArrived()).toBe(45);
    expect(got).toEqual([10, 5, 30]);
  });

  it('restores riding cargo without selling or duplicating it', () => {
    const first = make();
    first.dump(50);
    first.update(BELT_RIDE_SECONDS * 0.5); // halfway along the belt
    const saved = first.riding();
    expect(saved).toEqual([{ n: 50, t: expect.closeTo(0.5, 5) }]);

    const loaded = make();
    loaded.restore(saved);
    ride(loaded);
    expect(loaded.takeArrived()).toBe(50); // delivered once after the reload
    expect(loaded.takeArrived()).toBe(0);
  });

  it('ignores bad restore records and keeps riding a fresh dump', () => {
    const belt = make();
    belt.restore([{ n: 0, t: 0.2 }, { n: 10, t: 1.4 }, { n: -5, t: 0.3 }]);
    belt.dump(7);
    ride(belt);
    expect(belt.takeArrived()).toBe(7);
  });
});
