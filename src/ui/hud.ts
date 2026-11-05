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
  carried: number;
  capacity: number;
  carrierName: string;
  hint: string;
  aimActive: boolean;
}

/** Plain DOM HUD. Only touches the DOM when values change. */
export class Hud {
  private money = $('hud-money');
  private hay = $('hud-hay');
  private hint = $('hud-hint');
  private carry = $('carry');
  private carryName = $('carry-name');
  private carryNum = $('carry-num');
  private carryFill = $('carry-fill');
  private pops = $('hud-pops');
  private crosshair = $('crosshair');
  private last: Record<string, string> = {};
  private shownMoney = NaN;

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
    if (this.changed('carryName', s.carrierName)) this.carryName.textContent = s.carrierName;
    const num = `${fmtInt(s.carried)} / ${fmtInt(s.capacity)}`;
    if (this.changed('carryNum', num)) {
      this.carryNum.textContent = num;
      this.carryFill.style.transform = `scaleX(${Math.min(1, s.carried / s.capacity)})`;
      this.carry.classList.toggle('full', s.carried >= s.capacity);
    }
    if (this.changed('aim', String(s.aimActive))) this.crosshair.classList.toggle('active', s.aimActive);
  }

  bumpMoney(): void { replay(this.money, 'bump'); }
  shakeCarry(): void { replay(this.carry, 'shake'); }

  pop(text: string, tone: 'good' | 'spend' = 'good'): void {
    const el = document.createElement('div');
    el.className = `pop ${tone}`;
    el.textContent = text;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
}
