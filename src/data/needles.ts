// The needles hidden in the stack. Each one found gives a small permanent bonus;
// all of them unlock the barn door.
export type NeedleId = 'bent_pin' | 'sewing' | 'safety_pin' | 'desk_pin' | 'darning' | 'hat_pin';

/** Bonuses as fractions added to 1 (0.25 = +25 %). */
export interface Perk { price?: number; grab?: number; speed?: number; capacity?: number }
export type Perks = Required<Perk>;

export interface NeedleDef {
  id: NeedleId;
  perk: Perk;
  /** How deep under the stack surface it lies, metres (Infinity = the very core). */
  depthM: number;
  /** Height in the stack, 0 = floor, 1 = top. */
  height: number;
}

export const NEEDLES: readonly NeedleDef[] = [
  { id: 'bent_pin', perk: { price: 0.1 }, depthM: 0.3, height: 0.14 },
  { id: 'sewing', perk: { grab: 0.25 }, depthM: 0.8, height: 0.3 },
  { id: 'safety_pin', perk: { speed: 0.1 }, depthM: 1.4, height: 0.5 },
  { id: 'desk_pin', perk: { capacity: 0.5 }, depthM: 2.2, height: 0.22 },
  { id: 'darning', perk: { grab: 0.25 }, depthM: 3.4, height: 0.4 },
  { id: 'hat_pin', perk: { price: 0.25 }, depthM: Infinity, height: 0.08 },
];

export function sumPerks(found: Iterable<NeedleId>): Perks {
  const p: Perks = { price: 0, grab: 0, speed: 0, capacity: 0 };
  const set = new Set(found);
  for (const n of NEEDLES) {
    if (!set.has(n.id)) continue;
    for (const k of Object.keys(n.perk) as Array<keyof Perk>) p[k] += n.perk[k] ?? 0;
  }
  return p;
}
