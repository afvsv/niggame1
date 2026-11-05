import { describe, expect, it } from 'vitest';
import { PRESETS, defaultSettings, presetForGpu, presetOf, sanitize } from './settings';

describe('settings', () => {
  it('recognises presets and custom mixes', () => {
    expect(presetOf(PRESETS.medium)).toBe('medium');
    expect(presetOf({ ...PRESETS.high, beams: false })).toBe('custom');
  });

  it('repairs stored data', () => {
    const s = sanitize({ graphics: { shadows: 'insane', grass: 'off' }, fov: 500, volume: 'loud', lang: 'de' }, 'high');
    expect(s.graphics.shadows).toBe(PRESETS.high.shadows);
    expect(s.graphics.grass).toBe('off');
    expect(s.fov).toBe(100);
    expect(s.volume).toBe(defaultSettings('high').volume);
    expect(s.lang).toBe('auto');
    expect(sanitize(null, 'low')).toEqual(defaultSettings('low'));
  });

  it('guesses a preset from the GPU name', () => {
    expect(presetForGpu('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)')).toBe('low');
    expect(presetForGpu('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('medium');
    expect(presetForGpu('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('high');
    expect(presetForGpu('Adreno (TM) 650')).toBe('low');
    expect(presetForGpu('NVIDIA GeForce RTX 3060', true)).toBe('low');
  });
});
