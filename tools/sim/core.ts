// Balance simulator: a greedy player digs, carries, sells and shops, using the game's own numbers,
// stamina rules and upgrade maths. No rendering, no stack geometry: hay is always within reach.
import { BALANCE } from '../../src/data/balance';
import { CONTAINERS, ContainerId, ItemId, TOOLS, ToolId, itemById } from '../../src/data/tools';
import { UPGRADES, UpgradeId } from '../../src/data/upgrades';
import type { Perks } from '../../src/data/needles';
import { Upgrades } from '../../src/game/Upgrades';
import { Derived, derive } from '../../src/game/stats';
import { Stamina } from '../../src/game/stamina';

type XZ = readonly [number, number];

/** Where the player walks, metres. Matches the hangar in src/world/shed.ts. */
export const LAYOUT = {
  stand: BALANCE.stack.radiusM + 0.6, // distance from the stack centre while digging at its edge
  counter: [10.9, -8.3] as XZ, // in front of the kiosk window
  shop: [10.9, 12.6] as XZ, // in front of the supply stall
};

/** Seconds spent on small actions. */
const ACT = { pour: 0.3, take: 0.4, putDown: 0.4, sell: 0.3, shop: 2.5, tree: 1.5 };
/** The kiosk conveyor ride before a dump is paid for (src/game/belt.ts). */
const RIDE = 6.2;
const DT = 0.05;
const NO_PERKS: Perks = { price: 0, grab: 0, speed: 0, capacity: 0 };

const toStack = (p: XZ) => Math.max(1, Math.hypot(p[0], p[1]) - LAYOUT.stand);
const between = (a: XZ, b: XZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export interface Purchase {
  t: number; // seconds since the start
  id: ItemId | UpgradeId;
  kind: 'item' | 'upgrade';
  level: number;
  price: number;
  rate: number; // $ per minute right after the purchase
}

export interface SimResult { purchases: Purchase[]; seconds: number; money: number; sold: number }

/** One player: time, money, stamina and what they own. */
class Player {
  t = 0;
  money = 0;
  sold = 0;
  carried = 0;
  readonly stamina: Stamina;
  d: Derived;

  constructor(readonly owned: Set<ItemId>, readonly ups: Upgrades, readonly perks: Perks) {
    this.d = derive(ups.levels, perks);
    this.stamina = new Stamina(this.d.staminaMax);
  }

  refresh(): void { this.d = derive(this.ups.levels, this.perks); }

  wait(s: number): void {
    for (let left = s; left > 1e-9; left -= DT) {
      const dt = Math.min(DT, left);
      this.stamina.update(dt, this.d.staminaMax, this.d.regen, false);
      this.t += dt;
    }
  }

  /** Runs while there is breath to spare, walks otherwise. */
  walk(m: number): void {
    const P = BALANCE.player;
    while (m > 0) {
      const sprint = !this.stamina.exhausted && this.stamina.frac > 0.5; // keeps half the bar for digging
      m -= (sprint ? P.sprintSpeed : P.walkSpeed) * this.d.speedMul * DT;
      this.stamina.update(DT, this.d.staminaMax, this.d.regen, sprint);
      this.t += DT;
    }
  }

  /** Swings until the hands hold `upTo` strands; skips a last swing that would take less than half a grab. */
  dig(tool: ToolId, upTo: number): void {
    const st = this.d.tools[tool];
    const target = Math.min(upTo, st.cap);
    while (target - this.carried >= Math.min(target, st.grab / 2)) {
      this.carried = Math.min(target, this.carried + st.grab);
      const cd = st.cooldown * (this.stamina.exhausted ? BALANCE.stamina.tiredSlow : 1);
      this.stamina.spend(st.stamina);
      this.wait(cd);
    }
  }

  sell(n: number): void {
    this.money += n * this.d.price;
    this.sold += n;
    // The dump itself is quick; the belt delivers while the player is already walking back.
    this.wait(ACT.sell + RIDE * 0.5);
  }

  /** Stack → counter → stack with `tool` and the biggest container owned. Ends at the counter if `stayAtCounter`. */
  trip(tool: ToolId, box: ContainerId | null, stayAtCounter: boolean): void {
    let n: number;
    if (box) {
      const cap = this.d.containers[box];
      let fill = 0;
      while (fill < cap) {
        this.dig(tool, this.d.tools[tool].cap);
        const pour = Math.min(this.carried, cap - fill);
        fill += pour;
        this.carried -= pour;
        this.wait(ACT.pour);
      }
      this.dig(tool, this.d.tools[tool].cap); // hands full too, then pick the container up
      this.wait(ACT.take);
      n = fill + this.carried;
    } else {
      this.dig(tool, this.d.tools[tool].cap);
      n = this.carried;
    }
    this.walk(toStack(LAYOUT.counter));
    this.carried = 0;
    this.sell(n);
    if (stayAtCounter) return;
    this.walk(toStack(LAYOUT.counter));
    if (box) this.wait(ACT.putDown);
  }

  bestBox(): ContainerId | null {
    let best: ContainerId | null = null;
    for (const c of CONTAINERS) if (this.owned.has(c.id) && (!best || this.d.containers[c.id] > this.d.containers[best])) best = c.id;
    return best;
  }
}

/** Steady income in $ per minute for this loadout, and the tool that gives it. */
export function incomeRate(owned: Set<ItemId>, levels: Upgrades['levels'], perks: Perks = NO_PERKS): { rate: number; tool: ToolId } {
  let best = { rate: 0, tool: 'hands' as ToolId };
  for (const tool of TOOLS) {
    if (!owned.has(tool.id)) continue;
    const ups = new Upgrades();
    ups.levels = { ...levels };
    const p = new Player(owned, ups, perks);
    const box = p.bestBox();
    for (let i = 0; i < 2; i++) p.trip(tool.id, box, false); // settle into the stamina rhythm
    const t0 = p.t, m0 = p.money;
    for (let i = 0; i < 6; i++) p.trip(tool.id, box, false);
    const rate = ((p.money - m0) / (p.t - t0)) * 60;
    if (rate > best.rate) best = { rate, tool: tool.id };
  }
  return best;
}

type Goal = { kind: 'item'; id: ItemId; price: number } | { kind: 'upgrade'; id: UpgradeId; price: number };

/**
 * What the player saves for next: first the scripted items in order (the tutorial asks for the toy shovel,
 * then the bucket), then the shortest payback, with the detector right after the spade.
 */
function nextGoal(owned: Set<ItemId>, ups: Upgrades, perks: Perks, rate: number, script: readonly ItemId[]): Goal | null {
  const scripted = script.find((id) => !owned.has(id));
  if (scripted) return { kind: 'item', id: scripted, price: itemById(scripted).price };
  if (owned.has('spade') && !owned.has('detector')) return { kind: 'item', id: 'detector', price: itemById('detector').price };
  let best: Goal | null = null, bestPay = Infinity;
  const consider = (g: Goal, rateAfter: number) => {
    const gain = rateAfter - rate;
    if (gain <= 1e-6) return;
    const pay = g.price / gain;
    if (pay < bestPay) { bestPay = pay; best = g; }
  };
  for (const t of [...TOOLS, ...CONTAINERS]) {
    if (owned.has(t.id) || (t.requires && !owned.has(t.requires))) continue;
    consider({ kind: 'item', id: t.id, price: t.price }, incomeRate(new Set([...owned, t.id]), ups.levels, perks).rate);
  }
  let cheapest: Goal | null = null;
  for (const u of UPGRADES) {
    const price = ups.nextPrice(u.id);
    if (price === null || ups.missing(u.id, (i) => owned.has(i)).length) continue;
    const g: Goal = { kind: 'upgrade', id: u.id, price };
    consider(g, incomeRate(owned, { ...ups.levels, [u.id]: ups.level(u.id) + 1 }, perks).rate);
    if (!cheapest || price < cheapest.price) cheapest = g;
  }
  // Nothing pays back any more (jumps, sway, detector range): buy what is cheapest, as players do.
  return best ?? cheapest;
}


export interface SimOptions { minutes?: number; perks?: Perks; script?: readonly ItemId[] }

/** The tutorial order of the first shop items. */
export const TUTORIAL: readonly ItemId[] = ['toy_shovel', 'bucket'];

/** Plays `minutes` of the early game. */
export function simulate({ minutes = 40, perks = NO_PERKS, script = TUTORIAL }: SimOptions = {}): SimResult {
  const owned = new Set<ItemId>(['hands']);
  const ups = new Upgrades();
  const p = new Player(owned, ups, perks);
  const purchases: Purchase[] = [];
  let { rate, tool } = incomeRate(owned, ups.levels, perks);
  let goal = nextGoal(owned, ups, perks, rate, script);
  while (p.t < minutes * 60 && goal) {
    p.trip(tool, p.bestBox(), true);
    let atShop = false;
    while (goal && p.money + 1e-9 >= goal.price) {
      p.money -= goal.price;
      if (goal.kind === 'item') {
        if (!atShop) p.walk(between(LAYOUT.counter, LAYOUT.shop));
        atShop = true;
        p.wait(ACT.shop);
        owned.add(goal.id);
      } else {
        p.wait(ACT.tree);
        ups.buy(goal.id);
        p.refresh();
      }
      ({ rate, tool } = incomeRate(owned, ups.levels, perks));
      purchases.push({ t: p.t, id: goal.id, kind: goal.kind, level: goal.kind === 'upgrade' ? ups.level(goal.id) : 1, price: goal.price, rate });
      goal = nextGoal(owned, ups, perks, rate, script);
    }
    p.walk(toStack(atShop ? LAYOUT.shop : LAYOUT.counter));
    if (p.bestBox()) p.wait(ACT.putDown);
  }
  return { purchases, seconds: p.t, money: p.money, sold: p.sold };
}
