import { describe, expect, it } from 'vitest';
import { STEPS, Tutorial, TutorialCtx } from './tutorial';

const ctx = (o: Partial<TutorialCtx> = {}): TutorialCtx => ({
  carried: 0, sold: 0, has: () => false, placedAny: false, fillAny: 0, containerSold: false, upgrades: 0, found: 0, unlocked: false, escaped: false, ...o,
});

describe('Tutorial', () => {
  it('walks the steps in order and skips the ones already done', () => {
    const tut = new Tutorial();
    expect(tut.update(ctx())).toBe(false);
    expect(tut.key).toBe('grab');
    tut.update(ctx({ carried: 4 }));
    expect(tut.key).toBe('sell');
    tut.update(ctx({ sold: 10 }));
    expect(tut.key).toBe('upgrade');
    tut.update(ctx({ sold: 10, upgrades: 1 }));
    expect(tut.key).toBe('shovel');
    // An old save that already owns the bucket and sold from it jumps to the needle hunt.
    tut.update(ctx({ sold: 900, has: (id) => id === 'toy_shovel' || id === 'bucket', containerSold: true }));
    expect(tut.key).toBe('needle');
    // Buying the bucket first skips the toy shovel; opening the doors skips to the exit.
    const b = new Tutorial();
    b.update(ctx({ sold: 5, has: (id) => id === 'bucket' }));
    expect(b.key).toBe('upgrade'); // the tree is new to everyone, old saves included
    b.update(ctx({ sold: 5, upgrades: 2, has: (id) => id === 'bucket' }));
    expect(b.key).toBe('place');
    b.update(ctx({ sold: 5, has: (id) => id === 'bucket', found: 6, unlocked: true }));
    expect(b.key).toBe('escape');
    tut.update(ctx({ sold: 1, has: () => true, containerSold: true, found: 6, unlocked: true, escaped: true }));
    expect(tut.done).toBe(true);
    expect(tut.step).toBe(STEPS.length);
  });
});
