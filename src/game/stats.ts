import { BALANCE } from '../data/balance';
import { CONTAINERS, ContainerId, DETECTOR, TOOLS, ToolId } from '../data/tools';
import type { Perks } from '../data/needles';
import { Levels, Stat, statValue } from '../data/upgrades';

export interface ToolStats { grab: number; cap: number; cooldown: number; stamina: number }

/** Everything the rules read that upgrades and needles change. Pure: also used for "now → next" previews. */
export interface Derived {
  tools: Record<ToolId, ToolStats>;
  containers: Record<ContainerId, number>;
  /** $ per strand at the counter. */
  price: number;
  speedMul: number;
  walk: number;
  /** Jump height, metres, and the take-off speed that gives it. */
  jumpM: number;
  jumpSpeed: number;
  reach: number;
  staminaMax: number;
  /** Stamina per second. */
  regen: number;
  /** Tool sway and bob, 1 = default. */
  sway: number;
  /** Stamina cost of a swing, 1 = default. */
  swingCost: number;
  detectorRange: number;
  detectorMuffle: number;
  /** How deep into the stack the detector hears, metres. */
  detectorDeep: number;
}

const TOOL_STATS: Record<ToolId, { grab?: Stat; cap?: Stat; size?: Stat }> = {
  hands: { grab: 'hands.grab', cap: 'hands.cap' },
  toy_shovel: { grab: 'toy.grab', cap: 'toy.cap' },
  spade: { size: 'spade.size' },
  pitchfork: { size: 'fork.size' },
};
const CONTAINER_STAT: Record<ContainerId, Stat> = { bucket: 'bucket.cap', wheelbarrow: 'barrow.cap' };

export function derive(levels: Levels, perks: Perks): Derived {
  const s = (k: Stat) => statValue(levels, k);
  const carry = 1 + perks.capacity;
  const swingCost = s('swing.cost');
  const tools = {} as Record<ToolId, ToolStats>;
  for (const t of TOOLS) {
    const m = TOOL_STATS[t.id];
    const size = m.size ? s(m.size) : 1;
    tools[t.id] = {
      grab: Math.round((t.grab + (m.grab ? s(m.grab) : 0)) * size * (1 + perks.grab)),
      cap: Math.round((t.capacity + (m.cap ? s(m.cap) : 0)) * size * carry),
      cooldown: t.cooldown,
      stamina: t.stamina * swingCost,
    };
  }
  const containers = {} as Record<ContainerId, number>;
  for (const c of CONTAINERS) containers[c.id] = Math.round(c.capacity * s(CONTAINER_STAT[c.id]) * carry);
  const P = BALANCE.player;
  const speedMul = s('speed') * (1 + perks.speed);
  const jumpM = P.jumpSpeed ** 2 / (2 * P.gravity) + s('jump');
  const detectorRange = DETECTOR.rangeM * s('detector.range');
  const detectorMuffle = DETECTOR.muffle * s('detector.muffle');
  return {
    tools,
    containers,
    price: BALANCE.hay.pricePerStrand * (1 + perks.price) * s('price'),
    speedMul,
    walk: P.walkSpeed * speedMul,
    jumpM,
    jumpSpeed: Math.sqrt(2 * P.gravity * jumpM),
    reach: BALANCE.reachM + s('reach'),
    staminaMax: Math.round(BALANCE.stamina.max * s('stamina.max')),
    regen: BALANCE.stamina.regen * s('stamina.regen'),
    sway: s('sway'),
    swingCost,
    detectorRange,
    detectorMuffle,
    detectorDeep: detectorRange / (1 + detectorMuffle),
  };
}
