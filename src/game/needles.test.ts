import { describe, expect, it } from 'vitest';
import { HayGrid } from '../haystack/grid';
import { generateStack } from '../haystack/generate';
import { BALANCE } from '../data/balance';
import { NEEDLES, sumPerks } from '../data/needles';
import { placeNeedles } from './needles';
import { fall, hayTop, supportHeight } from './support';
import { hayAlong, signalStrength } from './detector';
import * as THREE from 'three';

const S = BALANCE.stack, H = BALANCE.hay;
function stack(): HayGrid {
  const g = new HayGrid(S.gridX, S.gridY, S.gridZ, H.cellSize, (-S.gridX * H.cellSize) / 2, 0, (-S.gridZ * H.cellSize) / 2, H.cellMaxStrands);
  generateStack(g, S);
  return g;
}
const depth = (g: HayGrid, p: [number, number, number]) => {
  // Distance to the nearest empty cell, searched on a coarse shell.
  const s = g.cellSize;
  for (let r = 1; r < 60; r++) {
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      for (const dy of [-r, 0, r]) {
        const x = p[0] + Math.cos(a) * r * s, z = p[2] + Math.sin(a) * r * s, y = p[1] + dy * s;
        if (y < 0) continue;
        const [cx, cy, cz] = g.worldToCell(x, y, z);
        if (g.get(cx, cy, cz) === 0) return r * s;
      }
    }
  }
  return Infinity;
};

describe('needles', () => {
  it('hides every needle inside hay, each deeper than the one before', () => {
    const g = stack();
    const ns = placeNeedles(g, 7);
    expect(ns.map((n) => n.id)).toEqual(NEEDLES.map((n) => n.id));
    const depths = ns.map((n) => {
      const [cx, cy, cz] = g.worldToCell(...n.pos);
      expect(g.get(cx, cy, cz)).toBeGreaterThan(0);
      return depth(g, n.pos);
    });
    expect(depths[0]).toBeLessThan(1);
    expect(depths[depths.length - 1]).toBeGreaterThan(depths[0]);
    expect(depths[3]).toBeGreaterThan(depths[1]);
    expect(ns[0].pos[2]).toBeGreaterThan(0); // first one on the door side
  });

  it('sums perks of found needles', () => {
    expect(sumPerks(['sewing', 'darning']).grab).toBeCloseTo(0.5);
    expect(sumPerks([]).price).toBe(0);
  });
});

describe('support and detector', () => {
  it('rests on hay, boxes or the floor and falls when the hay is gone', () => {
    const g = stack();
    const top = hayTop(g, 0, 0, 100);
    expect(top).toBeGreaterThan(S.heightM - 1);
    expect(supportHeight(g, [], 30, 30, 5, 0.2)).toBe(0);
    expect(supportHeight(g, [{ minX: 29, maxX: 31, minY: 0, maxY: 1, minZ: 29, maxZ: 31 }], 30, 30, 5, 0.2)).toBe(1);
    expect(supportHeight(g, [{ minX: 29, maxX: 31, minY: 0, maxY: 9, minZ: 29, maxZ: 31 }], 30, 30, 5, 0.2)).toBe(0); // walls above are ignored
    const [y, vy] = fall(2, 0, 0, 18, 0.1);
    expect(y).toBeLessThan(2);
    expect(vy).toBeLessThan(0);
    expect(fall(0.05, -5, 0, 18, 0.1)).toEqual([0, 0]);
  });

  it('signal is muffled by hay', () => {
    const g = stack();
    const a = new THREE.Vector3(0, 1, 12), b = new THREE.Vector3(0, 1, 0);
    expect(hayAlong(g, a, b)).toBeGreaterThan(5);
    expect(signalStrength(1, 0, 6)).toBeGreaterThan(signalStrength(1, 2, 6));
    expect(signalStrength(10, 0, 6)).toBe(0);
  });
});
