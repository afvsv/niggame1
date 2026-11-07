// The upgrade tree. Bought with money in the tree screen [Tab]; each level costs base × growth^level.
// Shop items appear in the tree as "unlock" cards: they are bought in the shop and open their own upgrades.
import type { ItemId } from './tools';

export type BranchId = 'hand' | 'fitness' | 'selling' | 'needles';

export type UpgradeId =
  | 'hand_more' | 'toy_more' | 'spade_more' | 'fork_more' | 'bucket_more' | 'barrow_more'
  | 'boots' | 'springs' | 'steady' | 'back' | 'breath' | 'reach' | 'swing'
  | 'deal'
  | 'coil' | 'precise'
;

/**
 * What an upgrade changes. `add` stats sum `per × level`; `pct` stats multiply by `1 + Σ per × level`;
 * `pow` stats multiply by `per^level` (for reductions such as stamina cost).
 */
export const STAT_MODE = {
  'hands.grab': 'add', 'hands.cap': 'add', 'toy.grab': 'add', 'toy.cap': 'add',
  'spade.size': 'pct', 'fork.size': 'pct', 'bucket.cap': 'pct', 'barrow.cap': 'pct',
  'speed': 'pct', 'jump': 'add', 'sway': 'pow', 'stamina.max': 'pct', 'stamina.regen': 'pct',
  'reach': 'add', 'swing.cost': 'pow',
  'price': 'pct',
  'detector.range': 'pct', 'detector.muffle': 'pow',
} as const;
export type Stat = keyof typeof STAT_MODE;

/** 3D icon models drawn for upgrades that do not belong to a shop item. */
export type UpgradeIcon = 'boots' | 'spring' | 'level' | 'kettlebell' | 'bottle' | 'ladder' | 'feather' | 'crate' | 'magnifier';

export interface UpgradeDef {
  id: UpgradeId;
  branch: BranchId;
  max: number;
  /** Price of the first level. */
  base: number;
  growth: number;
  effects: ReadonlyArray<{ stat: Stat; per: number }>;
  /** Upgrades need level 1 of these; items must be owned. */
  requires: ReadonlyArray<UpgradeId | ItemId>;
  /** An upgrade of a shop item uses the item's icon with a "+" badge and sits in the item's group. */
  of?: ItemId;
  icon?: UpgradeIcon;
}

const up = (d: Omit<UpgradeDef, 'requires'> & { requires?: UpgradeDef['requires'] }): UpgradeDef => ({ requires: d.of ? [d.of] : [], ...d });

export const UPGRADES: readonly UpgradeDef[] = [
  // Hand work: bigger handfuls and bigger tools.
  up({ id: 'hand_more', branch: 'hand', max: 5, base: 0.25, growth: 1.7, of: 'hands', effects: [{ stat: 'hands.grab', per: 1 }, { stat: 'hands.cap', per: 2 }] }),
  up({ id: 'toy_more', branch: 'hand', max: 3, base: 2, growth: 1.6, of: 'toy_shovel', effects: [{ stat: 'toy.grab', per: 2 }, { stat: 'toy.cap', per: 6 }] }),
  up({ id: 'spade_more', branch: 'hand', max: 2, base: 15, growth: 1.7, of: 'spade', effects: [{ stat: 'spade.size', per: 0.12 }] }),
  up({ id: 'fork_more', branch: 'hand', max: 3, base: 60, growth: 1.7, of: 'pitchfork', effects: [{ stat: 'fork.size', per: 0.12 }] }),
  up({ id: 'bucket_more', branch: 'hand', max: 5, base: 6, growth: 1.6, of: 'bucket', effects: [{ stat: 'bucket.cap', per: 0.2 }] }),
  up({ id: 'barrow_more', branch: 'hand', max: 3, base: 45, growth: 1.7, of: 'wheelbarrow', effects: [{ stat: 'barrow.cap', per: 0.2 }] }),
  // Fitness: moving, reaching and stamina.
  up({ id: 'boots', branch: 'fitness', max: 5, base: 6, growth: 1.6, icon: 'boots', effects: [{ stat: 'speed', per: 0.05 }] }),
  up({ id: 'back', branch: 'fitness', max: 5, base: 8, growth: 1.6, icon: 'kettlebell', effects: [{ stat: 'stamina.max', per: 0.15 }] }),
  up({ id: 'breath', branch: 'fitness', max: 5, base: 10, growth: 1.6, icon: 'bottle', effects: [{ stat: 'stamina.regen', per: 0.2 }] }),
  up({ id: 'reach', branch: 'fitness', max: 5, base: 6, growth: 1.6, icon: 'ladder', effects: [{ stat: 'reach', per: 0.3 }] }),
  up({ id: 'springs', branch: 'fitness', max: 5, base: 12, growth: 1.6, icon: 'spring', requires: ['boots'], effects: [{ stat: 'jump', per: 0.05 }] }),
  up({ id: 'steady', branch: 'fitness', max: 5, base: 5, growth: 1.5, icon: 'level', requires: ['boots'], effects: [{ stat: 'sway', per: 0.8 }] }),
  up({ id: 'swing', branch: 'fitness', max: 5, base: 12, growth: 1.6, icon: 'feather', requires: ['reach'], effects: [{ stat: 'swing.cost', per: 0.85 }] }),
  // Selling.
  up({ id: 'deal', branch: 'selling', max: 5, base: 4, growth: 1.9, icon: 'crate', effects: [{ stat: 'price', per: 0.1 }] }),
  // Needle search.
  up({ id: 'coil', branch: 'needles', max: 3, base: 40, growth: 1.7, of: 'detector', effects: [{ stat: 'detector.range', per: 0.2 }] }),
  up({ id: 'precise', branch: 'needles', max: 1, base: 90, growth: 1, icon: 'magnifier', requires: ['detector'], effects: [{ stat: 'detector.muffle', per: 0.5 }] }),
  // Power: the generator and its fuel box.
];

export const BRANCHES: ReadonlyArray<{ id: BranchId; color: string }> = [
  { id: 'hand', color: '#f0a43a' },
  { id: 'fitness', color: '#d9a46c' },
  { id: 'selling', color: '#e8875a' },
  { id: 'needles', color: '#a98ad8' },
];

export type Levels = Partial<Record<UpgradeId, number>>;

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));
export const upgradeById = (id: UpgradeId): UpgradeDef => BY_ID.get(id)!;
export const isUpgrade = (id: string): id is UpgradeId => BY_ID.has(id as UpgradeId);

/** Price of the next level when `level` levels are already bought. */
export function upgradePrice(def: UpgradeDef, level: number): number {
  return Math.round(def.base * def.growth ** level * 100) / 100;
}

/** Combined value of a stat for these levels (see STAT_MODE). */
export function statValue(levels: Levels, stat: Stat): number {
  const mode = STAT_MODE[stat];
  let v = mode === 'add' ? 0 : 1;
  for (const u of UPGRADES) {
    const lvl = levels[u.id] ?? 0;
    if (!lvl) continue;
    for (const e of u.effects) {
      if (e.stat !== stat) continue;
      if (mode === 'add') v += e.per * lvl;
      else if (mode === 'pct') v += e.per * lvl;
      else v *= e.per ** lvl;
    }
  }
  return v;
}
