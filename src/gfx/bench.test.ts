import { describe, expect, it } from 'vitest';
import { Benchmark, pickPreset, score } from './bench';
import { Preset } from '../core/settings';

const run = (fpsOf: Record<Preset, number>) => {
  const applied: Preset[] = [];
  const b = new Benchmark((p) => applied.push(p), [{ x: 0, z: 0, yaw: 0, pitch: 0 }, { x: 1, z: 1, yaw: 1, pitch: 0 }]);
  for (let guard = 0; !b.done && guard < 10000; guard++) b.tick(1 / fpsOf[b.preset]);
  return { b, applied };
};

describe('benchmark', () => {
  it('scores mean FPS and the slow tail', () => {
    const dts = [...Array(95).fill(1 / 60), ...Array(5).fill(1 / 20)];
    const s = score('low', dts);
    expect(s.fps).toBe(55); // 100 frames in 1.83 s
    expect(s.low).toBe(20);
  });

  it('picks the highest preset that it and all lower ones ran smooth', () => {
    const sc = (preset: Preset, fps: number, low = fps) => ({ preset, fps, low });
    expect(pickPreset([sc('low', 60), sc('medium', 59), sc('high', 45), sc('ultra', 58)])).toBe('medium');
    expect(pickPreset([sc('low', 60), sc('medium', 60, 25)])).toBe('low');
    expect(pickPreset([sc('low', 30)])).toBe('low');
    expect(pickPreset(['low', 'medium', 'high', 'ultra'].map((p) => sc(p as Preset, 60)))).toBe('ultra');
  });

  it('runs every preset in order and stops after a clearly slow one', () => {
    const all = run({ low: 60, medium: 60, high: 60, ultra: 60 });
    expect(all.applied).toEqual(['low', 'medium', 'high', 'ultra']);
    expect(all.b.scores.map((s) => s.fps)).toEqual([60, 60, 60, 60]);
    const slow = run({ low: 60, medium: 35, high: 60, ultra: 60 });
    expect(slow.applied).toEqual(['low', 'medium']);
    expect(pickPreset(slow.b.scores)).toBe('low');
  });
});
