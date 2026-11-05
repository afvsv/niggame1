import * as THREE from 'three';
import type { HayGrid } from '../haystack/grid';

/** Metres of hay along a segment, sampled every 0.25 m. */
export function hayAlong(grid: HayGrid, a: THREE.Vector3, b: THREE.Vector3): number {
  const len = a.distanceTo(b), n = Math.min(60, Math.ceil(len / 0.25));
  if (n === 0) return 0;
  const s = grid.cellSize;
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    if (grid.get(Math.floor((x - grid.originX) / s), Math.floor((y - grid.originY) / s), Math.floor((z - grid.originZ) / s)) > 0) hits++;
  }
  return (hits / n) * len;
}

/** 0..1: 1 right on top of the needle, 0 out of range. Hay muffles the signal. */
export function signalStrength(dist: number, hayM: number, rangeM: number): number {
  const eff = dist + hayM * 0.6;
  return Math.max(0, Math.min(1, 1 - eff / rangeM));
}

/** Beeps faster as the signal grows. `update` returns true on the frame a beep should sound. */
export class DetectorSignal {
  strength = 0;
  /** 1 right after a beep, fades out: drives the LED. */
  blink = 0;
  private sampleT = 0;
  private beepT = 0;

  update(dt: number, active: boolean, sample: () => number): boolean {
    this.blink = Math.max(0, this.blink - dt * 6);
    if (!active) { this.strength = 0; this.beepT = 0; return false; }
    this.sampleT -= dt;
    if (this.sampleT <= 0) { this.strength = sample(); this.sampleT = 0.1; }
    if (this.strength <= 0) return false;
    this.beepT -= dt;
    if (this.beepT > 0) return false;
    this.beepT = 1.1 - 1.02 * Math.pow(this.strength, 0.8);
    this.blink = 1;
    return true;
  }
}
