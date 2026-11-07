import { describe, expect, it } from 'vitest';
import { autoIncome, simulate } from './core';
import { Upgrades } from '../../src/game/Upgrades';
import { derive } from '../../src/game/stats';
import { sumPerks } from '../../src/data/needles';

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

describe('automation', () => {
  it('a full rig outearns the cap after the plans are bought', () => {
    const up = new Upgrades();
    up.load({ belt_plans: 1, rake_plans: 1, power: 1 });
    const perks = sumPerks([]);
    const price = derive(up.levels, perks).price;
    const rig = autoIncome(up.levels, perks, price);
    expect(rig.strandsPerMin).toBeGreaterThanOrEqual(600);
    expect(rig.net).toBeGreaterThan(0);
    // The rig (plans ~$250 + machines $270 + belt $120 ≈ $650) pays back within 30 minutes.
    const minutes = rig.cost / rig.net;
    expect(minutes).toBeLessThanOrEqual(30);
  });
});
