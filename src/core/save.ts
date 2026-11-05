import { HayGrid } from '../haystack/grid';

const KEY = 'niggame.save.v1';

export interface SaveData {
  v: 1;
  money: number;
  carried: number;
  grid: string;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
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
