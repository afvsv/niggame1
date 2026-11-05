import { describe, expect, it } from 'vitest';
import { Inventory } from './Inventory';

describe('Inventory', () => {
  it('starts with hands and hand capacity', () => {
    const inv = new Inventory();
    expect(inv.tool.id).toBe('hands');
    expect(inv.capacity).toBe(10);
  });

  it('gates items behind requirements and money', () => {
    const inv = new Inventory();
    expect(inv.buyState('spade', 1000)).toBe('locked');
    expect(inv.buyState('toy_shovel', 1)).toBe('poor');
    expect(inv.buyState('toy_shovel', 3)).toBe('ok');
    inv.add('toy_shovel');
    expect(inv.buyState('toy_shovel', 100)).toBe('owned');
    expect(inv.buyState('spade', 100)).toBe('ok');
  });

  it('activates a newly bought tool and uses the best container', () => {
    const inv = new Inventory();
    inv.add('toy_shovel');
    expect(inv.tool.id).toBe('toy_shovel');
    inv.add('bucket');
    expect(inv.tool.id).toBe('toy_shovel');
    expect(inv.capacity).toBe(60);
    inv.add('wheelbarrow');
    expect(inv.capacity).toBe(300);
  });

  it('cycles through owned tools and round-trips saves', () => {
    const inv = new Inventory();
    inv.add('toy_shovel');
    inv.add('spade');
    expect(inv.cycle(1)).toBe(true);
    expect(inv.tool.id).toBe('hands');
    const copy = new Inventory();
    copy.load(inv.serialize());
    expect(copy.tool.id).toBe('hands');
    expect(copy.has('spade')).toBe(true);
    copy.load({ owned: ['bogus' as never], active: 'spade' });
    expect(copy.tool.id).toBe('hands');
  });
});
