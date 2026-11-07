import { describe, expect, it } from 'vitest';
import { devModeEnabled } from './devmode';
import { clearSave, setSaveKey, writeSave } from './save';
import { HayGrid } from '../haystack/grid';

const params = (dev: boolean): URLSearchParams => new URLSearchParams(dev ? 'dev' : '');
const env = (DEV: boolean, VITE_DEV_TOOLS?: string) => ({ DEV, VITE_DEV_TOOLS });

describe('devModeEnabled', () => {
  it('truth table: ?dev plus a dev environment, nothing else turns it on', () => {
    expect(devModeEnabled(params(true), env(true))).toBe(true);
    expect(devModeEnabled(params(false), env(true))).toBe(false);
    expect(devModeEnabled(params(true), env(false))).toBe(false);
    expect(devModeEnabled(params(true), env(false, '1'))).toBe(true);
    expect(devModeEnabled(params(false), env(false, '1'))).toBe(false); // no ?dev: never on
  });
});

describe('dev save slot', () => {
  // Minimal localStorage: the node test env has none worth relying on.
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  } as Storage;
  const grid = new HayGrid(2, 1, 2, 0.5, 0, 0, 0, 1);
  const spot = (x: number, z: number) => ({ x, y: 0, z, yaw: 0, pitch: 0 });

  it('dev mode writes its own key and leaves the normal save untouched', () => {
    setSaveKey('niggame.save.v1');
    writeSave({ money: 100, carried: 0, player: spot(1, 2) }, grid);
    const normal = localStorage.getItem('niggame.save.v1');
    expect(normal).toBeTruthy();
    // the dev session switches the slot and saves its own progress
    setSaveKey('niggame.save.dev');
    writeSave({ money: 1_000_000_000, carried: 0, player: spot(3, 4) }, grid);
    expect(JSON.parse(localStorage.getItem('niggame.save.dev')!).money).toBe(1_000_000_000);
    expect(localStorage.getItem('niggame.save.v1')).toBe(normal); // untouched
    // ?reset clears only the save of the current (dev) mode
    clearSave();
    expect(localStorage.getItem('niggame.save.dev')).toBeNull();
    expect(localStorage.getItem('niggame.save.v1')).toBe(normal);
    setSaveKey('niggame.save.v1');
  });
});
