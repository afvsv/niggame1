// Player-built machines for the build mode [B]. Numbers for their behaviour live in BALANCE.automation.
// A building is unlocked by a plans upgrade ('belt_plans', 'rake_plans', 'power') and placed for money.

export type BuildingId = 'belt' | 'rake' | 'generator';

export interface BuildingDef {
  id: BuildingId;
  /** Belt is priced per metre (BALANCE.automation.beltPricePerM); the rest are flat. */
  price: number;
  /** The plans upgrade that opens this building. */
  plans: UpgradeId;
  /** Power draw in kW; the generator produces, so its draw is negative. */
  kw: number;
  /** Machines block movement and hold needles up; belts stay walkable. */
  solid: boolean;
}

import type { UpgradeId } from './upgrades';

export const BUILDINGS: readonly BuildingDef[] = [
  { id: 'belt', price: 0, plans: 'belt_plans', kw: 0, solid: false },
  { id: 'rake', price: 120, plans: 'rake_plans', kw: 0.8, solid: true },
  { id: 'generator', price: 150, plans: 'power', kw: -6, solid: true },
];

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));
export const buildingById = (id: BuildingId): BuildingDef => BY_ID.get(id)!;
export const isBuilding = (id: string): id is BuildingId => BY_ID.has(id as BuildingId);
