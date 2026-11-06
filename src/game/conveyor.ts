import { BALANCE } from '../data/balance';

const A = BALANCE.automation;

/** A hay wad on a belt: `n` strands at `s` metres from the belt start. */
export interface BeltWad { n: number; s: number }

export interface PathPoint { x: number; y: number; z: number }

/** Length of a polyline, metres. */
export function pathLength(pts: readonly PathPoint[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return len;
}

/**
 * Player-built belt logic: wads measured in metres along the chain, minimum gaps, an end buffer.
 * Pure data — visuals (pooled wad meshes) live in the world layer.
 */
export class Conveyor {
  /** Sorted by `s`. */
  readonly wads: BeltWad[] = [];
  /** Strands that reached the end and wait for pickup. */
  endPending = 0;
  /** True while the end buffer is full: nothing moves, nothing is accepted. */
  jammed = false;
  /** Metres along the chain; grows as segments are added. */
  length = 0;

  constructor(length: number) {
    this.length = length;
  }

  get total(): number {
    let t = this.endPending;
    for (const w of this.wads) t += w.n;
    return t;
  }

  get wadCount(): number {
    return this.wads.length + (this.endPending > 0 ? 1 : 0);
  }

  /** Places `n` strands at `s`; rejects overlaps (min gap) and the very end (that is the exit). */
  insert(n: number, s: number): boolean {
    if (!(n > 0) || this.jammed) return false;
    s = Math.max(0, Math.min(this.length, s));
    if (s >= this.length) return false;
    const i = this.findIndex(s);
    if (i > 0 && s - this.wads[i - 1].s < A.gapM - 1e-9) return false;
    if (i < this.wads.length && this.wads[i].s - s < A.gapM - 1e-9) return false;
    this.wads.splice(i, 0, { n, s });
    return true;
  }

  /** Feed from a machine: merges into the start wad while it has room, else starts one at s = 0. */
  insertAtStart(n: number): boolean {
    if (!(n > 0) || this.jammed) return false;
    const first = this.wads[0];
    if (first && first.s < A.gapM) {
      if (first.n + n <= A.wadMaxStrands) { first.n += n; return true; }
      return false; // the start wad is full: the feed waits
    }
    this.wads.unshift({ n, s: 0 });
    return true;
  }

  /** Moves the load; wads reaching the end pour into the end buffer. Full buffer = jam. */
  update(dt: number, speed: number): void {
    if (this.jammed) return;
    const d = speed * dt;
    for (const w of this.wads) w.s += d;
    while (this.wads.length && this.wads[this.wads.length - 1].s >= this.length) {
      const room = A.wadMaxStrands - this.endPending;
      if (room <= 0) break;
      const w = this.wads[this.wads.length - 1];
      const take = Math.min(w.n, room);
      this.endPending += take;
      w.n -= take;
      if (w.n <= 0) this.wads.pop();
      else w.s = this.length - 0.01;
    }
    if (this.endPending >= A.wadMaxStrands) this.jammed = true; // the end is full: nothing moves
  }

  /** Takes everything the end has buffered; unjams the belt. */
  takeOut(): number {
    const n = this.endPending;
    if (n > 0) {
      this.endPending = 0;
      this.jammed = false;
    }
    return n;
  }

  serialize(): Array<[number, number]> {
    return this.wads.map((w) => [w.n, Math.round(w.s * 100) / 100]);
  }

  /** Loads validated wads; junk entries are dropped one by one. Returns false for a non-array. */
  load(list: unknown): boolean {
    if (!Array.isArray(list)) return false;
    const wads: BeltWad[] = [];
    for (const item of list) {
      if (!Array.isArray(item) || item.length !== 2) continue;
      const [n, s] = item;
      if (!Number.isFinite(n) || n <= 0 || n > A.wadMaxStrands) continue;
      if (!Number.isFinite(s) || s < 0 || s >= this.length) continue;
      wads.push({ n, s });
    }
    wads.sort((a, b) => a.s - b.s);
    this.wads.length = 0;
    this.wads.push(...wads);
    return true;
  }

  private findIndex(s: number): number {
    let i = 0;
    while (i < this.wads.length && this.wads[i].s < s) i++;
    return i;
  }
}
