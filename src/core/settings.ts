// Player settings: graphics quality, controls and sound. Stored apart from the game save,
// so resetting progress keeps them.

export type Preset = 'low' | 'medium' | 'high' | 'ultra';
export type Lang = 'auto' | 'ru' | 'en';

export interface Graphics {
  /** 'auto' lowers the render resolution while the frame rate is low. */
  resolution: 'auto' | '50' | '75' | '100';
  shadows: 'off' | 'low' | 'medium' | 'high';
  grass: 'off' | 'low' | 'medium' | 'high';
  /** Loose straws on the stack surface and on the floor. */
  straw: 'low' | 'medium' | 'high';
  /** Light shafts from the roof holes and floating dust. */
  beams: boolean;
  /** MSAA; needs a page reload because it is fixed when the WebGL context is created. */
  antialias: boolean;
}

export interface Settings {
  graphics: Graphics;
  showFps: boolean;
  /** Mouse sensitivity multiplier. */
  sensitivity: number;
  /** Vertical field of view, degrees. */
  fov: number;
  /** Master volume 0..1. */
  volume: number;
  /** Needs a reload: every label is set once at start. */
  lang: Lang;
}

/** Allowed values of every graphics option, in display order. */
export const GRAPHICS_CHOICES: { [K in keyof Graphics]: readonly Graphics[K][] } = {
  resolution: ['auto', '50', '75', '100'],
  shadows: ['off', 'low', 'medium', 'high'],
  grass: ['off', 'low', 'medium', 'high'],
  straw: ['low', 'medium', 'high'],
  beams: [false, true],
  antialias: [false, true],
};

export const PRESETS: Record<Preset, Graphics> = {
  low: { resolution: '75', shadows: 'off', grass: 'low', straw: 'low', beams: false, antialias: false },
  medium: { resolution: 'auto', shadows: 'low', grass: 'medium', straw: 'medium', beams: true, antialias: true },
  high: { resolution: 'auto', shadows: 'medium', grass: 'high', straw: 'high', beams: true, antialias: true },
  ultra: { resolution: '100', shadows: 'high', grass: 'high', straw: 'high', beams: true, antialias: true },
};
export const PRESET_NAMES = Object.keys(PRESETS) as Preset[];

export const RANGES = {
  sensitivity: { min: 0.2, max: 3, step: 0.05, def: 1 },
  fov: { min: 60, max: 100, step: 1, def: 75 },
  volume: { min: 0, max: 1, step: 0.05, def: 0.6 },
} as const;

/** Numbers behind the option names. */
export const SHADOW_MAP = { off: 0, low: 1024, medium: 2048, high: 4096 } as const;
export const GRASS_DENSITY = { off: 0, low: 0.3, medium: 0.6, high: 1 } as const;
export const FLOOR_STRAW_DENSITY = { low: 0.3, medium: 0.6, high: 1 } as const;
export const RESOLUTION_SCALE = { '50': 0.5, '75': 0.75, '100': 1 } as const;

export function presetOf(g: Graphics): Preset | 'custom' {
  const keys = Object.keys(GRAPHICS_CHOICES) as (keyof Graphics)[];
  return PRESET_NAMES.find((p) => keys.every((k) => PRESETS[p][k] === g[k])) ?? 'custom';
}

export function defaultSettings(preset: Preset): Settings {
  return {
    graphics: { ...PRESETS[preset] },
    showFps: false,
    sensitivity: RANGES.sensitivity.def,
    fov: RANGES.fov.def,
    volume: RANGES.volume.def,
    lang: 'auto',
  };
}

const clamp = (v: unknown, r: { min: number; max: number; def: number }) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, v)) : r.def;
const pick = <T>(v: unknown, allowed: readonly T[], def: T): T => (allowed.includes(v as T) ? (v as T) : def);

/** Merges stored (possibly old or hand-edited) data over the defaults, dropping unknown values. */
export function sanitize(raw: unknown, preset: Preset): Settings {
  const d = defaultSettings(preset);
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Settings> & { graphics?: Partial<Graphics> };
  const g: Partial<Graphics> = r.graphics ?? {};
  const graphics = Object.fromEntries(
    (Object.keys(GRAPHICS_CHOICES) as (keyof Graphics)[]).map((k) => [k, pick(g[k], GRAPHICS_CHOICES[k] as readonly unknown[], d.graphics[k])]),
  ) as unknown as Graphics;
  return {
    graphics,
    showFps: typeof r.showFps === 'boolean' ? r.showFps : d.showFps,
    sensitivity: clamp(r.sensitivity, RANGES.sensitivity),
    fov: clamp(r.fov, RANGES.fov),
    volume: clamp(r.volume, RANGES.volume),
    lang: pick(r.lang, ['auto', 'ru', 'en'] as const, 'auto'),
  };
}

/**
 * Guesses a preset from the GPU name: software renderers and phones get "low",
 * integrated laptop graphics "medium", everything else "high".
 */
export function presetForGpu(name: string, coarsePointer = false): Preset {
  const n = name.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(n)) return 'low';
  if (coarsePointer || /mali|adreno|powervr|apple a\d|sgx|tegra|videocore/.test(n)) return 'low';
  if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics|apple gpu/.test(n)) return 'medium';
  return 'high';
}

/** Reads the unmasked GPU name from a throwaway WebGL context. */
export function detectGpu(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'software';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

const KEY = 'niggame.settings.v1';

export function loadSettings(recommended: Preset): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitize(raw ? JSON.parse(raw) : null, recommended);
  } catch {
    return defaultSettings(recommended);
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: settings last for the session */ }
}
