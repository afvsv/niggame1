import { fmtInt, fmtMoney } from '../core/format';
import { t } from '../core/i18n';

const $ = (id: string) => document.getElementById(id)!;

/** Plain DOM HUD. Only touches the DOM when values change. */
export class Hud {
  private money = $('hud-money');
  private hay = $('hud-hay');
  private hint = $('hud-hint');
  private carry = $('hud-carry');
  private pops = $('hud-pops');
  private crosshair = $('crosshair');
  private last: Record<string, string> = {};

  private setText(key: string, el: HTMLElement, text: string): void {
    if (this.last[key] === text) return;
    this.last[key] = text;
    el.textContent = text;
  }

  update(state: { money: number; hayLeft: number; carried: number; capacity: number; hint: string; aimActive: boolean }): void {
    this.setText('money', this.money, fmtMoney(state.money));
    this.setText('hay', this.hay, t('hud.hayLeft', { n: fmtInt(state.hayLeft) }));
    this.setText('carry', this.carry, t('hud.carry', { n: state.carried, cap: state.capacity }));
    this.setText('hint', this.hint, state.hint);
    this.carry.classList.toggle('full', state.carried >= state.capacity);
    this.crosshair.classList.toggle('active', state.aimActive);
  }

  pop(text: string): void {
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = text;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
}
