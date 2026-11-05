import { describe, expect, it } from 'vitest';
import { simulate } from './core';

describe('balance', () => {
  const r = simulate({ minutes: 25 });
  it('the first tool comes within two minutes', () => {
    const first = r.purchases.find((p) => p.kind === 'item');
    expect(first?.id).toBe('toy_shovel');
    expect(first!.t).toBeLessThanOrEqual(120);
  });
  it('income keeps growing with purchases', () => {
    const rates = r.purchases.map((p) => p.rate);
    expect(rates[rates.length - 1]).toBeGreaterThan(rates[0] * 5);
  });
});
