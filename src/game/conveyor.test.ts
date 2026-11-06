import { describe, expect, it } from 'vitest';
import { Conveyor, DELIVERY_TIME } from './conveyor';

describe('conveyor deliveries', () => {
  it('pays only after the belt and fall, exactly once', () => {
    const c = new Conveyor(), paid: number[] = [];
    c.add(12, 0.48, false);
    c.update(DELIVERY_TIME - 0.1, d => paid.push(d.value));
    expect(paid).toEqual([]);
    c.update(0.11, d => paid.push(d.value));
    c.update(10, d => paid.push(d.value));
    expect(paid).toEqual([0.48]);
  });
  it('restores multiple in-flight loads with their original value', () => {
    const a = new Conveyor(); a.add(10, 0.4, true); a.update(1, () => {}); a.add(20, 1.2, false);
    const b = new Conveyor(); b.load(JSON.parse(JSON.stringify(a.serialize())));
    const paid: number[] = [];
    b.update(DELIVERY_TIME - 1 + 0.01, d => paid.push(d.value));
    expect(paid).toEqual([0.4]); expect(b.deliveries[0].container).toBe(false);
    b.update(1, d => paid.push(d.value)); expect(paid).toEqual([0.4, 1.2]);
  });
});
