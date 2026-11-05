import { PRESET_NAMES, Preset } from '../core/settings';

/**
 * Built-in performance test: renders the hangar with every preset in turn from fixed spots and
 * picks the best preset that this computer keeps smooth. Frame times come from the main loop,
 * so the numbers include everything a real frame does (game logic, HUD, shadow refreshes).
 */

/** Frame-time summary of one preset. */
export interface BenchScore {
  preset: Preset;
  /** Mean frames per second. */
  fps: number;
  /** Frame rate of the slowest 5 % of frames — shows hitches that the mean hides. */
  low: number;
}

export interface BenchPose { x: number; z: number; yaw: number; pitch: number }

/** A preset counts as smooth when it holds ~60 FPS on a 60 Hz screen without regular hitches. */
export const SMOOTH = { fps: 50, low: 30 } as const;

export function score(preset: Preset, dts: readonly number[]): BenchScore {
  if (!dts.length) return { preset, fps: 0, low: 0 };
  const sorted = [...dts].sort((a, b) => a - b);
  const total = sorted.reduce((s, x) => s + x, 0);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return { preset, fps: Math.round(sorted.length / total), low: Math.round(1 / Math.max(p95, 1e-3)) };
}

/** Seconds of warm-up and of measuring per preset. */
export const BENCH_TIMING = { warm: 0.8, measure: 3.6 } as const;
/** Upper bound of a full run in seconds (it stops early on slow computers). */
export const BENCH_SECONDS = Math.ceil(PRESET_NAMES.length * (BENCH_TIMING.warm + BENCH_TIMING.measure));

export const smooth = (s: BenchScore) => s.fps >= SMOOTH.fps && s.low >= SMOOTH.low;

/** The highest preset such that it and every lower one ran smooth; "low" when none did. */
export function pickPreset(scores: readonly BenchScore[]): Preset {
  let best: Preset = 'low';
  for (const p of PRESET_NAMES) {
    const s = scores.find((x) => x.preset === p);
    if (!s || !smooth(s)) break;
    best = p;
  }
  return best;
}

/** Runs the presets from low to ultra and stops early once one is clearly too slow. */
export class Benchmark {
  readonly scores: BenchScore[] = [];
  done = false;
  private i = 0;
  private t = 0;
  private dts: number[] = [];

  /**
   * @param apply  switches the scene to a preset (called for the first one right away)
   * @param poses  camera spots, each shown for an equal share of the measuring time
   */
  constructor(
    private readonly apply: (p: Preset) => void,
    private readonly poses: readonly BenchPose[],
    private readonly warm: number = BENCH_TIMING.warm,
    private readonly measure: number = BENCH_TIMING.measure,
  ) {
    apply(PRESET_NAMES[0]);
  }

  get preset(): Preset { return PRESET_NAMES[this.i]; }
  get step(): number { return Math.min(this.i + 1, PRESET_NAMES.length); }
  get steps(): number { return PRESET_NAMES.length; }
  /** 0..1 over the whole run (assuming every preset runs). */
  get progress(): number { return Math.min(1, (this.i + Math.min(1, this.t / (this.warm + this.measure))) / PRESET_NAMES.length); }

  /** Feeds one raw (unclamped) frame interval in seconds and returns the camera pose for the next frame. */
  tick(dt: number): BenchPose {
    if (this.done) return this.pose();
    this.t += dt;
    // The first frames after a switch compile shaders and resize the shadow map; skip them.
    if (this.t > this.warm) this.dts.push(dt);
    if (this.t >= this.warm + this.measure) this.next();
    return this.pose();
  }

  private next(): void {
    const s = score(this.preset, this.dts);
    this.scores.push(s);
    this.i++;
    this.t = 0;
    this.dts = [];
    // Below ~40 FPS the heavier presets cannot pass, so do not make the player sit through them.
    if (this.i >= PRESET_NAMES.length || s.fps < SMOOTH.fps * 0.8) { this.done = true; return; }
    this.apply(this.preset);
  }

  private pose(): BenchPose {
    const n = this.poses.length;
    const u = Math.max(0, Math.min(0.9999, (this.t - this.warm) / this.measure)) * n;
    const k = Math.floor(u);
    const p = this.poses[k];
    // A slow look left and right so the view is not a single frozen frame.
    return { ...p, yaw: p.yaw + Math.sin((u - k) * Math.PI * 2) * 0.25 };
  }
}

/** Last test result, kept per GPU so a new video card or browser is tested afresh. */
export interface BenchRecord { gpu: string; preset: Preset; scores: BenchScore[] }

const KEY = 'niggame.bench.v1';

export function loadBench(gpu: string): BenchRecord | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as BenchRecord | null;
    return r && r.gpu === gpu && PRESET_NAMES.includes(r.preset) && Array.isArray(r.scores) ? r : null;
  } catch {
    return null;
  }
}

export function saveBench(r: BenchRecord): void {
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ }
}
