import { fmtMoney } from '../core/format';
import { strands, t } from '../core/i18n';
import type { Stats } from '../game/Game';
import { replay } from './hud';

const $ = (id: string) => document.getElementById(id)!;

const clock = (s: number) => {
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h ? `${h}:${String(m % 60).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** "You got out": run stats, a new game or staying to walk around. */
export class EndingScreen {
  private root = $('ending');
  isOpen = false;
  onNewGame: () => void = () => {};
  onStay: () => void = () => {};

  constructor() {
    $('ending-title').textContent = t('ending.title');
    $('ending-subtitle').textContent = t('ending.subtitle');
    $('ending-note').textContent = t('ending.note');
    $('ending-stay').textContent = t('ending.stay');
    $('ending-new').textContent = t('ending.new');
    $('ending-stay').addEventListener('click', () => { this.close(); this.onStay(); });
    $('ending-new').addEventListener('click', () => this.onNewGame());
  }

  open(s: Stats, needles: number): void {
    const rows: Array<[string, string]> = [
      [t('ending.time'), clock(s.time)],
      [t('ending.earned'), fmtMoney(s.earned)],
      [t('ending.sold'), strands(s.sold)],
      [t('ending.needles'), String(needles)],
    ];
    $('ending-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    this.isOpen = true;
    this.root.classList.remove('hidden');
    replay(this.root, 'enter');
  }

  close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }
}
