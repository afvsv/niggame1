import { describe, expect, it } from 'vitest';
import { generateStack } from './generate';
import { CHUNK, HayGrid } from './grid';
import { raycastGrid } from './raycast';

const make = () => new HayGrid(32, 20, 32, 0.2, -3.2, 0, -3.2, 10);

describe('HayGrid', () => {
  it('tracks total strands on set/remove', () => {
    const g = make();
    g.set(1, 2, 3, 10);
    expect(g.total).toBe(10);
    expect(g.remove(1, 2, 3, 4)).toBe(4);
    expect(g.get(1, 2, 3)).toBe(6);
    expect(g.remove(1, 2, 3, 100)).toBe(6);
    expect(g.total).toBe(0);
  });

  it('marks chunks dirty only when solidity changes', () => {
    const g = make();
    g.set(5, 5, 5, 10);
    g.dirtyChunks.clear();
    g.remove(5, 5, 5, 3);
    expect(g.dirtyChunks.size).toBe(0);
    g.remove(5, 5, 5, 7);
    expect(g.dirtyChunks.size).toBeGreaterThan(0);
  });

  it('marks neighbour chunk dirty at a chunk border', () => {
    const g = make();
    g.set(CHUNK - 1, 0, 0, 10);
    expect(g.dirtyChunks.has(g.chunkKey(1, 0, 0))).toBe(true);
  });

  it('serializes and restores exactly', () => {
    const g = make();
    generateStack(g, { radiusM: 3, heightM: 3, seed: 42 });
    g.remove(16, 2, 16, 5);
    const s = g.serialize();
    const h = make();
    expect(h.deserialize(s)).toBe(true);
    expect(h.total).toBe(g.total);
    expect(Array.from(h.data)).toEqual(Array.from(g.data));
  });

  it('rejects a save made for a different grid size', () => {
    const g = make();
    generateStack(g, { radiusM: 3, heightM: 3, seed: 1 });
    const other = new HayGrid(16, 16, 16, 0.2, 0, 0, 0, 10);
    expect(other.deserialize(g.serialize())).toBe(false);
  });
});

describe('raycastGrid', () => {
  it('hits the first solid cell and reports the entry face', () => {
    const g = make();
    g.set(10, 3, 10, 10);
    // From the -X side, aiming +X through the cell centre.
    const ox = g.originX + 2 * 0.2, oy = (3 + 0.5) * 0.2, oz = g.originZ + 10.5 * 0.2;
    const hit = raycastGrid(g, ox, oy, oz, 1, 0, 0, 5);
    expect(hit).not.toBeNull();
    expect([hit!.x, hit!.y, hit!.z]).toEqual([10, 3, 10]);
    expect([hit!.nx, hit!.ny, hit!.nz]).toEqual([-1, 0, 0]);
  });

  it('respects max distance', () => {
    const g = make();
    g.set(30, 3, 10, 10);
    const hit = raycastGrid(g, g.originX + 0.1, 0.7, g.originZ + 2.1, 1, 0, 0, 2);
    expect(hit).toBeNull();
  });
});
