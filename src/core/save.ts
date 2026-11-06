import type { InventorySave } from '../game/Inventory';
import type { NeedleSave } from '../game/needles';
import type { Stats } from '../game/Game';
import type { Levels } from '../data/upgrades';
import type { BeltCargo } from '../game/belt';
import { HayGrid } from '../haystack/grid';

const KEY = 'niggame.save.v1';

export interface SaveData {
  v: 1;
  money: number;
  carried: number;
  grid: string;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  inv?: InventorySave; // added in 0.2; older saves start with bare hands
  // Added in 0.3 (the locked barn). Missing in older saves: needles are hidden again.
  needles?: NeedleSave[];
  tutorial?: number;
  stats?: Stats;
  escaped?: boolean;
  upgrades?: Levels; // added in 0.4
  belt?: BeltCargo[]; // added in 0.5: hay still riding the kiosk conveyor
  build?: import('../game/factory').BuildingSave[]; // added in 0.6: player-built machines
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    return d.v === 1 ? d : null;
  } catch {
    return null;
  }
}

export function writeSave(d: Omit<SaveData, 'v' | 'grid'>, grid: HayGrid): void {
  try {
    const data: SaveData = { v: 1, ...d, grid: grid.serialize() };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('save failed', e);
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}
