import { describe, expect, it } from 'vitest';
import { createPriceBoard, priceText } from './signs';
import { derive } from '../game/stats';

// Headless canvas: the board paints with a 2d context that node does not have.
const ctxStub: Record<string, unknown> = new Proxy({}, {
  get: (_t, k: string) => (k === 'measureText' ? () => ({ width: 24 }) : () => undefined),
  set: () => true,
});
(globalThis as unknown as Record<string, unknown>).document = {
  createElement: () => ({ width: 256, height: 384, getContext: () => ctxStub, style: {} }),
} as unknown as Document;

describe('price text (defect 26)', () => {
  it('formats 3 decimals below a dollar and 2 from a dollar', () => {
    expect(priceText(0.04)).toBe('$0.040');
    expect(priceText(0.044)).toBe('$0.044');
    expect(priceText(0.0484)).toBe('$0.048');
    expect(priceText(1)).toBe('$1.00');
    expect(priceText(1.25)).toBe('$1.25');
  });

  it('the game price equals the base price times the Bent pin perk and the deal levels', () => {
    const noPerks = { price: 0, grab: 0, speed: 0, capacity: 0 };
    const base = derive({}, noPerks).price;
    expect(base).toBeCloseTo(0.04, 6);
    expect(derive({}, { ...noPerks, price: 0.1 }).price).toBeCloseTo(base * 1.1, 6); // Bent pin: $0.044
    expect(derive({ deal: 1 }, { ...noPerks, price: 0.1 }).price).toBeCloseTo(base * 1.1 * 1.1, 6); // deal on top
  });

  it('the board repaints only when the formatted price changes', () => {
    const board = createPriceBoard();
    expect(board.text).toBe('$0.040'); // painted once with the base price
    expect(board.redraws).toBe(1);
    board.update(0.04);
    expect(board.redraws).toBe(1); // the same price: no repaint
    board.update(0.044); // Bent pin collected
    expect(board.text).toBe('$0.044');
    expect(board.redraws).toBe(2);
    board.update(0.044);
    expect(board.redraws).toBe(2); // nothing changed again
    board.update(0.0484); // + the deal upgrade
    expect(board.text).toBe('$0.048');
    expect(board.redraws).toBe(3);
  });
});
