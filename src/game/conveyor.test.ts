import { describe, expect, it } from 'vitest';
import { Conveyor, pathLength } from './conveyor';
import { BALANCE } from '../data/balance';

const A = BALANCE.automation;
const make = (length = 4) => new Conveyor(length);

describe('Conveyor', () => {
  it('computes the path length', () => {
    const pts = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }, { x: 3, y: 0, z: 2 }];
    expect(pathLength(pts)).toBeCloseTo(5);
  });

  it('inserts with the minimum gap between wads', () => {
    const c = make();
    expect(c.insert(50, 0)).toBe(true);
    expect(c.insert(30, A.gapM / 2)).toBe(false); // too close to the first wad
    expect(c.insert(30, A.gapM)).toBe(true);
    expect(c.wads.length).toBe(2);
    expect(c.insert(30, -5)).toBe(false); // outside the belt
  });

  it('merges a start feed into the first wad while it has room', () => {
    const c = make();
    c.insert(60, 0.2);
    expect(c.insertAtStart(40)).toBe(true); // 60 + 40 = wadMax
    expect(c.wads[0].n).toBe(A.wadMaxStrands);
    expect(c.wads.length).toBe(1);
    expect(c.insertAtStart(10)).toBe(false); // the start wad is full: the feed waits for it to leave
    expect(c.wads.length).toBe(1);
  });

  it('moves wads by speed × dt and hands them out at the end', () => {
    const c = make(2);
    c.insert(40, 0);
    c.update(1, 0.7);
    expect(c.wads[0].s).toBeCloseTo(0.7);
    c.update(2, 0.7);
    expect(c.total).toBe(40); // 40 strands walked 2.1 m: 1.4 on the belt, 0.6+… into the end buffer
    const out = c.takeOut();
    expect(out).toBe(40);
    expect(c.takeOut()).toBe(0);
  });

  it('jams when the end buffer is full and unjams after it drains', () => {
    const c = make(2);
    c.insert(A.wadMaxStrands, 0); // one full wad walks straight out into the buffer
    c.update(10, 0.7);
    expect(c.jammed).toBe(true);
    expect(c.insert(10, 0)).toBe(false); // no room while jammed
    expect(c.total).toBe(A.wadMaxStrands);
    expect(c.takeOut()).toBe(A.wadMaxStrands);
    expect(c.jammed).toBe(false);
  });

  it('rejects an insert bigger than the wad cap', () => {
    const c = make(4);
    expect(c.insert(250, 1)).toBe(false); // a wheelbarrow dump: the caller splits it
    expect(c.insert(A.wadMaxStrands, 1)).toBe(true);
  });

  it('keeps the end buffer and a waiting wad through a save round-trip', () => {
    const c = make(2);
    c.insert(A.wadMaxStrands, 0); // walks out into the end buffer
    c.insert(60, 1.99); // the next wad, waiting right at the exit
    c.update(10, 0.7);
    expect(c.jammed).toBe(true); // buffer full, the waiting wad held at the exit
    const totalBefore = c.total;
    const data = c.serialize();
    expect(data.pending).toBe(A.wadMaxStrands);
    const loaded = make(2);
    expect(loaded.load(data)).toBe(true);
    expect(loaded.total).toBe(totalBefore);
    expect(loaded.jammed).toBe(true);
  });

  it('survives a save round-trip and rejects junk', () => {
    const c = make(4);
    c.insert(30, 0.5);
    c.insert(20, 3);
    c.update(1, 0.7);
    const data = c.serialize();
    const loaded = make(4);
    expect(loaded.load(data)).toBe(true);
    expect(loaded.wads.length).toBe(c.wads.length);
    expect(loaded.endPending).toBe(c.endPending);
    const junk = make(4);
    expect(junk.load('nope' as never)).toBe(false); // not an array
    junk.load([[10, 1], [-5, 2], [0, 0], [10, 99]]); // junk entries are dropped one by one
    expect(junk.wads.length).toBe(1);
    expect(junk.wads[0]).toEqual({ n: 10, s: 1 });
  });
});
