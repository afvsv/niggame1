import { describe, expect, it } from 'vitest';
import { UPGRADES, statValue, upgradeById, upgradePrice } from './upgrades';
import { ALL_ITEMS } from './tools';
import { derive } from '../game/stats';
import { sumPerks } from './needles';
import { Upgrades } from '../game/Upgrades';

describe('upgrades', () => {
  it('has unique ids and valid requirements', () => {
    const ids = new Set(UPGRADES.map((u) => u.id));
    expect(ids.size).toBe(UPGRADES.length);
    const items = new Set<string>(ALL_ITEMS.map((i) => i.id));
    for (const u of UPGRADES) for (const r of u.requires) expect(ids.has(r as never) || items.has(r)).toBe(true);
  });

  it('prices grow by base × growth^level', () => {
    const d = upgradeById('hand_more');
    expect(upgradePrice(d, 0)).toBe(0.25);
    expect(upgradePrice(d, 1)).toBe(0.43);
    expect(upgradePrice(d, 4)).toBeCloseTo(0.25 * 1.7 ** 4, 2);
  });

  it('combines stats by mode', () => {
    expect(statValue({}, 'hands.grab')).toBe(0);
    expect(statValue({}, 'speed')).toBe(1);
    expect(statValue({ hand_more: 3 }, 'hands.grab')).toBe(3);
    expect(statValue({ boots: 2 }, 'speed')).toBeCloseTo(1.1);
    expect(statValue({ swing: 2 }, 'swing.cost')).toBeCloseTo(0.85 ** 2);
  });

  it('derives tool, container and player numbers', () => {
    const base = derive({}, sumPerks([]));
    expect(base.tools.hands).toMatchObject({ grab: 2, cap: 10 });
    expect(base.containers.bucket).toBe(200);
    const up = derive({ hand_more: 2, bucket_more: 1, spade_more: 1, reach: 1, springs: 1, precise: 1 }, sumPerks([]));
    expect(up.tools.hands).toMatchObject({ grab: 4, cap: 14 });
    expect(up.containers.bucket).toBe(240);
    expect(up.tools.spade.grab).toBe(Math.round(18 * 1.12));
    expect(up.reach).toBeCloseTo(base.reach + 0.3);
    expect(up.jumpM).toBeCloseTo(base.jumpM + 0.05);
    expect(up.detectorDeep).toBeGreaterThan(base.detectorDeep);
    // Needle bonuses still apply on top.
    expect(derive({}, sumPerks(['desk_pin'])).containers.bucket).toBe(300);
  });

  it('gates levels behind requirements, money and the max', () => {
    const u = new Upgrades();
    const has = (id: string) => id === 'hands';
    expect(u.state('hand_more', 0.1, has)).toBe('poor');
    expect(u.state('hand_more', 0.25, has)).toBe('ok');
    expect(u.state('toy_more', 100, has)).toBe('locked');
    expect(u.state('springs', 100, has)).toBe('locked');
    u.buy('boots');
    expect(u.state('springs', 100, has)).toBe('ok');
    for (let i = 0; i < 9; i++) u.buy('boots');
    expect(u.level('boots')).toBe(5);
    expect(u.state('boots', 1e9, has)).toBe('maxed');
    u.load({ boots: 99, nope: 3, deal: 2.7 } as never);
    expect(u.levels).toEqual({ boots: 5, deal: 2 });
  });

  it('chains the automation plans across branches', () => {
    const u = new Upgrades();
    const has = (id: string) => id === 'hands';
    expect(u.state('belt_plans', 40, has)).toBe('ok'); // available from the start
    expect(u.state('rake_plans', 1000, has)).toBe('locked'); // needs belt_plans
    expect(u.state('power', 1000, has)).toBe('locked'); // needs rake_plans
    u.buy('belt_plans');
    expect(u.state('rake_plans', 60, has)).toBe('ok');
    expect(u.state('power', 1000, has)).toBe('locked');
    u.buy('rake_plans');
    expect(u.state('power', 150, has)).toBe('ok');
    expect(u.state('rake_rate', 40, has)).toBe('ok');
  });

  it('derives automation numbers from the new stats', () => {
    const base = derive({}, sumPerks([]));
    expect(base.beltSpeed).toBeCloseTo(0.7);
    expect(base.rakeRate).toBe(12);
    expect(base.rakeWidth).toBeCloseTo(1.0);
    expect(base.powerGen).toBe(6);
    expect(base.fuelCap).toBe(100);
    const up = derive({ belt_speed: 2, rake_rate: 1, rake_width: 2, gen_out: 3, firebox: 5 }, sumPerks([]));
    expect(up.beltSpeed).toBeCloseTo(0.7 * 1.3); // pct: 1 + 0.15×2
    expect(up.rakeRate).toBeCloseTo(12 * 1.15);
    expect(up.rakeWidth).toBeCloseTo(2.0);
    expect(up.powerGen).toBe(12);
    expect(up.fuelCap).toBe(225);
  });
});
