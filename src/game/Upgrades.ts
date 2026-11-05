import type { ItemId } from '../data/tools';
import { Levels, UPGRADES, UpgradeId, isUpgrade, upgradeById, upgradePrice } from '../data/upgrades';

export type UpgradeState = 'maxed' | 'locked' | 'poor' | 'ok';

/** Bought upgrade levels. Requirements: level 1 of an upgrade, or owning a shop item. */
export class Upgrades {
  levels: Levels = {};

  level(id: UpgradeId): number { return this.levels[id] ?? 0; }

  /** Requirements that are not met yet. */
  missing(id: UpgradeId, has: (item: ItemId) => boolean): Array<UpgradeId | ItemId> {
    return upgradeById(id).requires.filter((r) => (isUpgrade(r) ? this.level(r) < 1 : !has(r)));
  }

  /** Price of the next level, or null when maxed. */
  nextPrice(id: UpgradeId): number | null {
    const def = upgradeById(id), lvl = this.level(id);
    return lvl >= def.max ? null : upgradePrice(def, lvl);
  }

  state(id: UpgradeId, money: number, has: (item: ItemId) => boolean): UpgradeState {
    const price = this.nextPrice(id);
    if (price === null) return 'maxed';
    if (this.missing(id, has).length) return 'locked';
    return money + 1e-9 >= price ? 'ok' : 'poor';
  }

  /** Raises the level; the caller checks the state and takes the money. */
  buy(id: UpgradeId): void { this.levels[id] = Math.min(upgradeById(id).max, this.level(id) + 1); }

  /** Levels bought in total, optionally within one branch. */
  bought(branch?: string): number {
    return UPGRADES.filter((u) => !branch || u.branch === branch).reduce((n, u) => n + this.level(u.id), 0);
  }

  serialize(): Levels { return { ...this.levels }; }

  load(l: Levels | undefined): void {
    this.levels = {};
    if (!l) return;
    for (const [id, v] of Object.entries(l)) {
      if (!isUpgrade(id) || !Number.isFinite(v)) continue;
      const lvl = Math.max(0, Math.min(upgradeById(id).max, Math.floor(v as number)));
      if (lvl) this.levels[id] = lvl;
    }
  }
}
