import * as THREE from 'three';
import { fmtInt, fmtMoney } from '../core/format';
import { rich, t } from '../core/i18n';

const $ = (id: string) => document.getElementById(id)!;

/** Restarts a CSS animation class on an element. */
export function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export interface HudState {
  money: number;
  hayLeft: number;
  hint: string;
  aimActive: boolean;
  /** Name of the item in hand and what it carries; load is null for the detector. */
  heldName: string;
  load: [number, number] | null;
  found: number;
  total: number;
  unlocked: boolean;
  step: { n: number; total: number; text: string } | null;
  /** Detector signal 0..1, or null when the detector is not in hand. */
  signal: number | null;
}

export interface WorldLabel { key: string; pos: THREE.Vector3; title: string; value: string; full: boolean; occluded?: boolean }

/** Plain DOM HUD. Only touches the DOM when values change. */
export class Hud {
  private money = $('hud-money');
  private hay = $('hud-hay');
  private hint = $('hud-hint');
  private heldName = $('held-name');
  private heldLoad = $('held-load');
  private held = $('held');
  private pops = $('hud-pops');
  private crosshair = $('crosshair');
  private objCount = $('obj-count');
  private objGoal = $('obj-goal');
  private pips = $('obj-pips');
  private step = $('obj-step');
  private stepN = $('obj-step-n');
  private stepText = $('obj-step-text');
  private signal = $('signal');
  private bars = [...$('signal-bars').children] as HTMLElement[];
  private toastEl = $('toast');
  private labelsRoot = $('labels');
  private labels = new Map<string, { el: HTMLElement; title: HTMLElement; value: HTMLElement }>();
  private last: Record<string, string> = {};
  private shownMoney = NaN;
  private toastTimer = 0;
  private readonly v = new THREE.Vector3();

  constructor() {
    $('obj-title').textContent = t('obj.title');
    $('signal-label').textContent = t('hud.signal');
  }

  private changed(key: string, value: string): boolean {
    if (this.last[key] === value) return false;
    this.last[key] = value;
    return true;
  }

  update(s: HudState, dt: number): void {
    // Money counts towards the real value so gains and spends read as motion.
    if (Number.isNaN(this.shownMoney)) this.shownMoney = s.money;
    const diff = s.money - this.shownMoney;
    this.shownMoney = Math.abs(diff) < 0.005 ? s.money : this.shownMoney + diff * Math.min(1, dt * 9);
    const money = fmtMoney(this.shownMoney);
    if (this.changed('money', money)) this.money.textContent = money;

    const hay = t('hud.hayLeft', { n: fmtInt(s.hayLeft) });
    if (this.changed('hay', hay)) this.hay.textContent = hay;
    if (this.changed('hint', s.hint)) this.hint.innerHTML = rich(s.hint);
    if (this.changed('aim', String(s.aimActive))) this.crosshair.classList.toggle('active', s.aimActive);

    if (this.changed('heldName', s.heldName)) this.heldName.textContent = s.heldName;
    const load = s.load ? `${fmtInt(s.load[0])} / ${fmtInt(s.load[1])}` : '';
    if (this.changed('load', load)) {
      this.heldLoad.textContent = load;
      this.held.classList.toggle('full', !!s.load && s.load[0] >= s.load[1]);
      this.held.style.setProperty('--fill', s.load ? String(Math.min(1, s.load[0] / s.load[1])) : '0');
    }

    const obj = `${s.found}/${s.total}/${s.unlocked}`;
    if (this.changed('obj', obj)) {
      this.objCount.textContent = `${s.found} / ${s.total}`;
      this.objGoal.textContent = t(s.unlocked ? 'obj.goalOpen' : 'obj.goal', { total: s.total });
      this.pips.innerHTML = Array.from({ length: s.total }, (_, i) => `<i class="${i < s.found ? 'on' : ''}"></i>`).join('');
      $('objective').classList.toggle('open', s.unlocked);
    }
    const step = s.step ? `${s.step.n}|${s.step.total}|${s.step.text}` : '';
    if (this.changed('step', step)) {
      this.step.classList.toggle('hidden', !s.step);
      if (s.step) {
        this.stepN.textContent = t('obj.step', { n: s.step.n, total: s.step.total });
        this.stepText.innerHTML = rich(s.step.text);
        replay(this.step, 'fresh');
      }
    }

    const sig = s.signal === null ? '' : String(Math.round(s.signal * 10));
    if (this.changed('signal', sig)) {
      this.signal.classList.toggle('hidden', s.signal === null);
      const lit = s.signal === null ? 0 : Math.ceil(s.signal * 5 - 0.001);
      this.bars.forEach((b, i) => b.classList.toggle('on', i < lit));
      this.signal.classList.toggle('hot', (s.signal ?? 0) > 0.75);
    }

    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) this.toastEl.classList.add('hidden');
  }

  /** Floating "N / M" labels over placed containers. */
  updateLabels(list: WorldLabel[], camera: THREE.Camera): void {
    const seen = new Set<string>();
    const w = window.innerWidth, h = window.innerHeight;
    for (const l of list) {
      seen.add(l.key);
      let e = this.labels.get(l.key);
      if (!e) {
        const el = document.createElement('div');
        el.className = 'wlabel';
        el.innerHTML = '<b></b><span></span>';
        this.labelsRoot.appendChild(el);
        e = { el, title: el.children[0] as HTMLElement, value: el.children[1] as HTMLElement };
        this.labels.set(l.key, e);
      }
      const dist = this.v.copy(l.pos).distanceTo(camera.position);
      this.v.project(camera);
      const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2 && dist < 40;
      e.el.style.display = visible ? '' : 'none';
      if (!visible) continue;
      e.el.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) translate(-50%, -100%) scale(${Math.max(0.7, Math.min(1, 6 / dist))})`;
      if (e.title.textContent !== l.title) e.title.textContent = l.title;
      if (e.value.textContent !== l.value) e.value.textContent = l.value;
      e.el.classList.toggle('full', l.full);
      e.el.classList.toggle('occluded', !!l.occluded);
    }
    for (const [k, e] of this.labels) if (!seen.has(k)) { e.el.remove(); this.labels.delete(k); }
  }

  bumpMoney(): void { replay(this.money, 'bump'); }
  shakeHeld(): void { replay(this.held, 'shake'); }

  /** Big card in the upper middle: needle found, door unlocked. */
  toast(kicker: string, title: string, text: string, tone: 'needle' | 'open' = 'needle', seconds = 4.5): void {
    $('toast-kicker').textContent = kicker;
    $('toast-title').textContent = title;
    $('toast-text').textContent = text;
    this.toastEl.className = tone;
    replay(this.toastEl, 'show');
    this.toastTimer = seconds;
  }

  pop(text: string, tone: 'good' | 'spend' = 'good'): void {
    const el = document.createElement('div');
    el.className = `pop ${tone}`;
    el.textContent = text;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
}
