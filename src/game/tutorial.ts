import type { ItemId } from '../data/tools';

/** What the tutorial looks at to tick off steps. */
export interface TutorialCtx {
  carried: number;
  sold: number;
  has(id: ItemId): boolean;
  placedAny: boolean;
  fillAny: number;
  containerSold: boolean;
  /** Upgrade levels bought. */
  upgrades: number;
  found: number;
  unlocked: boolean;
  escaped: boolean;
}

/** The onboarding chain, ticked off automatically; later steps skip ahead if already done. */
export const STEPS: ReadonlyArray<{ key: string; done(c: TutorialCtx): boolean }> = [
  { key: 'grab', done: (c) => c.carried > 0 || c.sold > 0 },
  { key: 'sell', done: (c) => c.sold > 0 },
  { key: 'upgrade', done: (c) => c.upgrades > 0 },
  // Any purchase means the player already found the shop: do not insist on the toy shovel.
  { key: 'shovel', done: (c) => BOUGHT.some((id) => c.has(id)) },
  { key: 'bucket', done: (c) => c.has('bucket') },
  { key: 'place', done: (c) => c.placedAny || c.containerSold },
  { key: 'fill', done: (c) => c.fillAny > 0 || c.containerSold },
  { key: 'sellBucket', done: (c) => c.containerSold },
  { key: 'needle', done: (c) => c.found > 0 },
  { key: 'detector', done: (c) => c.has('detector') },
  { key: 'all', done: (c) => c.unlocked },
  { key: 'escape', done: (c) => c.escaped },
];

const BOUGHT: ItemId[] = ['toy_shovel', 'spade', 'pitchfork', 'bucket', 'wheelbarrow', 'detector'];
const ESCAPE = STEPS.findIndex((s) => s.key === 'escape');

export class Tutorial {
  step = 0;

  /** Advances past finished steps. Returns true when the step changed. */
  update(c: TutorialCtx): boolean {
    const before = this.step;
    // Once the doors are open nothing else matters: point at the exit.
    if (c.unlocked) this.step = Math.max(this.step, ESCAPE);
    while (this.step < STEPS.length && STEPS[this.step].done(c)) this.step++;
    return this.step !== before;
  }

  get done(): boolean { return this.step >= STEPS.length; }
  get key(): string | null { return STEPS[this.step]?.key ?? null; }
}
