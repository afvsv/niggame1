import { describe, expect, it } from 'vitest';
import { Stamina } from './stamina';
import { BALANCE } from '../data/balance';

describe('Stamina', () => {
  it('drains while running, refills after a pause and recovers from exhaustion', () => {
    const s = new Stamina(100);
    for (let i = 0; i < 200 && !s.exhausted; i++) s.update(0.1, 100, 22, true);
    expect(s.value).toBe(0);
    expect(s.exhausted).toBe(true);
    s.update(0.1, 100, 22, false);
    expect(s.value).toBe(0); // still catching breath
    for (let i = 0; i < 20; i++) s.update(0.1, 100, 22, false);
    expect(s.value).toBeGreaterThan(100 * BALANCE.stamina.recoverAt);
    expect(s.exhausted).toBe(false);
  });

  it('adds the difference when the max grows', () => {
    const s = new Stamina(100);
    s.spend(40);
    s.update(0, 115, 22, false);
    expect(s.max).toBe(115);
    expect(s.value).toBe(75);
  });
});
