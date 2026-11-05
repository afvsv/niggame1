import { rich, t } from '../core/i18n';
import type { BenchScore } from '../gfx/bench';
import { GRAPHICS_CHOICES, Graphics, Lang, PRESETS, PRESET_NAMES, Preset, RANGES, Settings, defaultSettings, presetOf } from '../core/settings';

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Range = keyof typeof RANGES;
const OPTION_LABEL: { [K in keyof Graphics]: (v: Graphics[K]) => string } = {
  resolution: (v) => (v === 'auto' ? t('res.auto') : `${v}%`),
  shadows: (v) => t(`shadows.${v}`),
  grass: (v) => t(`amount.${v}`),
  straw: (v) => t(`amount.${v}`),
  beams: (v) => t(v ? 'on' : 'off'),
  antialias: (v) => t(v ? 'on' : 'off'),
};
const RANGE_TEXT: Record<Range, (v: number) => string> = {
  sensitivity: (v) => `${v.toFixed(2)}×`,
  fov: (v) => `${Math.round(v)}°`,
  volume: (v) => `${Math.round(v * 100)}%`,
};

/** Settings screen opened from the pause card. Every change applies at once, behind a light backdrop. */
export class SettingsScreen {
  private root = $('settings');
  private body = $('settings-body');
  private reloadBtn = $('settings-reload');
  isOpen = false;
  onChange: (s: Settings) => void = () => {};
  onClose: () => void = () => {};
  /** "Performance test" button; the owner closes the screen, runs the test and reopens it. */
  onBench: () => void = () => {};
  /** Shown in the hint of the test row; the full run takes up to this long. */
  benchSeconds = 15;
  /** Values fixed at start; changing them needs a reload. */
  private readonly boot: { antialias: boolean; lang: Lang };

  /**
   * @param recommended  preset for this computer: from the last performance test if there was one,
   *                     otherwise a guess from the GPU name
   */
  constructor(private readonly s: Settings, private recommended: Preset, private bench: BenchScore[] | null = null) {
    this.boot = { antialias: s.graphics.antialias, lang: s.lang };
    $('settings-title').textContent = t('settings.title');
    $('settings-subtitle').textContent = t('settings.subtitle');
    $('settings-note').textContent = t('settings.reloadNote');
    $('settings-defaults').textContent = t('settings.defaults');
    this.reloadBtn.textContent = t('settings.reload');
    $('settings-close').innerHTML = `${t('settings.close')} <kbd>Esc</kbd>`;
    $('settings-close').addEventListener('click', () => this.close());
    $('settings-defaults').addEventListener('click', () => {
      Object.assign(this.s, defaultSettings(this.recommended), { lang: this.s.lang });
      this.changed();
    });
    this.reloadBtn.addEventListener('click', () => location.reload());
    this.root.addEventListener('mousedown', (e) => { if (e.target === this.root) this.close(); });
    this.body.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button[data-bench]')) { this.onBench(); return; }
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-k]');
      if (b) this.pick(b.dataset.k!, b.dataset.v!);
    });
    this.body.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      const k = el.dataset.r as Range | undefined;
      if (!k) return;
      this.s[k] = Number(el.value);
      (el.nextElementSibling as HTMLElement).textContent = RANGE_TEXT[k](this.s[k]);
      this.onChange(this.s);
    });
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.code === 'Escape') this.close(); });
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.render();
    this.root.classList.remove('hidden');
    this.root.classList.add('enter');
    document.body.classList.add('in-settings');
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.add('hidden');
    this.root.classList.remove('enter');
    document.body.classList.remove('in-settings');
    this.onClose();
  }

  /** Stores a finished test: its preset becomes the recommended one. */
  setBench(scores: BenchScore[], preset: Preset): void {
    this.bench = scores;
    this.recommended = preset;
  }

  /** Re-render after an outside change (e.g. the F3 hotkey). */
  refresh(): void { if (this.isOpen) this.render(); }

  private pick(k: string, raw: string): void {
    const v: unknown = raw === 'true' ? true : raw === 'false' ? false : raw;
    if (k === 'preset') Object.assign(this.s.graphics, PRESETS[v as Preset]);
    else if (k === 'showFps') this.s.showFps = v as boolean;
    else if (k === 'lang') this.s.lang = v as Lang;
    else (this.s.graphics as unknown as Record<string, unknown>)[k] = v;
    this.changed();
  }

  private changed(): void {
    this.onChange(this.s);
    this.render();
  }

  private seg(k: string, options: { v: string | boolean; label: string }[], current: unknown, extra = ''): string {
    return `<div class="seg">${options
      .map((o) => `<button type="button" data-k="${k}" data-v="${String(o.v)}"${o.v === current ? ' class="on"' : ''}>${esc(o.label)}</button>`)
      .join('')}${extra}</div>`;
  }

  private row(label: string, control: string, hint = ''): string {
    return `<div class="set-row"><span class="set-label"><span>${label}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</span>${control}</div>`;
  }

  private gfxRow<K extends keyof Graphics>(k: K, hint = ''): string {
    const label = esc(t(`settings.${k}`)) + (k === 'antialias' ? ' *' : '');
    const opts = GRAPHICS_CHOICES[k].map((v) => ({ v: v as string | boolean, label: OPTION_LABEL[k](v) }));
    return this.row(label, this.seg(k, opts, this.s.graphics[k]), hint);
  }

  private range(k: Range): string {
    const r = RANGES[k];
    const control = `<div class="slider"><input type="range" data-r="${k}" min="${r.min}" max="${r.max}" step="${r.step}" value="${this.s[k]}" aria-label="${esc(t(`settings.${k}`))}"><output>${RANGE_TEXT[k](this.s[k])}</output></div>`;
    return this.row(esc(t(`settings.${k}`)), control);
  }

  private render(): void {
    const preset = presetOf(this.s.graphics);
    const presetOpts = PRESET_NAMES.map((p) => ({ v: p as string, label: t(`q.${p}`) }));
    const custom = preset === 'custom' ? `<span class="seg-custom">${esc(t('settings.custom'))}</span>` : '';
    this.body.innerHTML = [
      `<h3>${esc(t('settings.graphics'))}</h3>`,
      this.row(esc(t('settings.preset')), this.seg('preset', presetOpts, preset, custom), t(this.bench ? 'settings.recommendedTest' : 'settings.recommended', { p: t(`q.${this.recommended}`) })),
      this.row(
        esc(t('settings.bench')),
        `<button type="button" class="btn ghost" data-bench>${esc(t(this.bench ? 'settings.benchAgain' : 'settings.benchRun'))}</button>`,
        this.bench ? `${this.bench.map((b) => `${t(`q.${b.preset}`)} ${b.fps}`).join(' · ')} FPS` : t('settings.benchHint', { s: this.benchSeconds }),
      ),
      this.gfxRow('resolution', t('settings.resolutionHint')),
      this.gfxRow('shadows'),
      this.gfxRow('grass'),
      this.gfxRow('straw'),
      this.gfxRow('beams'),
      this.gfxRow('antialias'),
      this.row(rich(t('settings.showFps')), this.seg('showFps', [{ v: false, label: t('off') }, { v: true, label: t('on') }], this.s.showFps)),
      `<h3>${esc(t('settings.controls'))}</h3>`,
      this.range('sensitivity'),
      this.range('fov'),
      this.range('volume'),
      this.row(`${esc(t('settings.lang'))} *`, this.seg('lang', (['auto', 'ru', 'en'] as const).map((l) => ({ v: l as string, label: t(`lang.${l}`) })), this.s.lang)),
    ].join('');
    const needsReload = this.s.graphics.antialias !== this.boot.antialias || this.s.lang !== this.boot.lang;
    this.reloadBtn.classList.toggle('hidden', !needsReload);
  }
}
