import { describe, expect, it } from 'vitest';
import { Inventory } from './Inventory';

describe('Inventory', () => {
  it('starts with bare hands', () => {
    const inv = new Inventory();
    expect(inv.tool.id).toBe('hands');
    expect(inv.tool.capacity).toBe(10);
    expect(inv.held).toBeNull();
  });

  it('gates items behind requirements and money', () => {
    const inv = new Inventory();
    expect(inv.buyState('spade', 1000)).toBe('locked');
    expect(inv.buyState('toy_shovel', 1)).toBe('poor');
    expect(inv.buyState('toy_shovel', 3)).toBe('ok');
    inv.add('toy_shovel');
    expect(inv.buyState('toy_shovel', 100)).toBe('owned');
    expect(inv.buyState('spade', 100)).toBe('ok');
    expect(inv.buyState('detector', 100)).toBe('locked');
  });

  it('puts bought items in hand and lists containers in the hotbar', () => {
    const inv = new Inventory();
    inv.add('toy_shovel');
    expect(inv.active).toBe('toy_shovel');
    inv.add('bucket');
    expect(inv.held?.id).toBe('bucket');
    expect(inv.tool.id).toBe('toy_shovel'); // the tool to return to
    expect(inv.items().map((i) => i.id)).toEqual(['hands', 'toy_shovel', 'bucket']);
    expect(inv.at(2)).toBe('bucket');
  });

  it('cannot select a container standing in the world', () => {
    const inv = new Inventory();
    inv.add('bucket');
    inv.state('bucket').placed = { x: 1, y: 0, z: 2, yaw: 0 };
    expect(inv.setActive('hands')).toBe(true);
    expect(inv.canSelect('bucket')).toBe(false);
    expect(inv.setActive('bucket')).toBe(false);
    expect(inv.next(1)).toBeNull(); // the only other item is the placed bucket
    expect(inv.placed().map((p) => p.def.id)).toEqual(['bucket']);
  });

  it('round-trips saves, including container state', () => {
    const inv = new Inventory();
    inv.add('toy_shovel');
    inv.add('bucket');
    inv.state('bucket').fill = 42;
    inv.state('bucket').placed = { x: 1, y: 0.5, z: 2, yaw: 1 };
    inv.setActive('toy_shovel');
    const copy = new Inventory();
    copy.load(JSON.parse(JSON.stringify(inv.serialize())));
    expect(copy.active).toBe('toy_shovel');
    expect(copy.state('bucket')).toEqual({ fill: 42, placed: { x: 1, y: 0.5, z: 2, yaw: 1 } });
    copy.load({ owned: ['bogus' as never, 'spade'], active: 'bucket' });
    expect(copy.active).toBe('hands');
    expect(copy.has('spade')).toBe(true);
    // Saves from before containers were placeable: owned bucket in the pocket.
    copy.load({ owned: ['toy_shovel', 'bucket'], active: 'toy_shovel' });
    expect(copy.state('bucket')).toEqual({ fill: 0, placed: null });
    expect(copy.canSelect('bucket')).toBe(true);
  });
});
