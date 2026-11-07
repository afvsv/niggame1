import { BUILDINGS, BuildingId, buildingById } from '../data/buildings';
import { fmtMoney } from '../core/format';
import { rich, t } from '../core/i18n';
import type { Game } from '../game/Game';
import type { Factory } from '../game/factory';
import { replay } from './hud';

const $ = (id: string) => document.getElementById(id)!;

const PLAN_OF: Record<BuildingId, string> = { belt: 'belt_plans', rake: 'rake_plans', generator: 'power' };

/** "Стройка" [B]: machines and belts are picked here and placed with the ghost in the yard. */
export class BuildScreen {
  private root = $('build');
  private list = $('build-list');
  private money = $('build-money');
  isOpen = false;
  onClose: (relock: boolean) => void = () => {};
  /** Picking a row closes the screen and opens the ghost / belt mode in the yard. */
  onPick: (id: BuildingId) => void = () => {};

  constructor(private readonly game: Game, private readonly factory: Factory) {
    $('build-title').textContent = t('build.title');
    $('build-subtitle').textContent = t('build.subtitle');
    $('build-wallet-label').textContent = t('build.wallet');
    $('build-close').innerHTML = `${t('build.close')} <kbd>E</kbd>`;
    $('build-keys').innerHTML = rich(t('shop.keys'));
    $('build-close').addEventListener('click', () => this.close(true));
    this.root.addEventListener('mousedown', (e) => { if (e.target === this.root) this.close(true); });
    this.list.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-build]');
      if (!btn) return;
      const id = btn.dataset.build as BuildingId;
      if (!this.factory.plansOwned(id)) return; // locked rows do not pick
      this.close(true);
      this.onPick(id);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') this.close(false);
      else if (e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); this.close(true); }
    });
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.render();
    this.root.classList.remove('hidden');
    replay(this.root, 'enter');
  }

  close(relock: boolean): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.add('hidden');
    this.onClose(relock);
  }

  private priceText(id: BuildingId): string {
    return id === 'belt' ? t('build.beltPrice') : fmtMoney(buildingById(id).price);
  }

  private row(id: BuildingId): string {
    const owned = this.factory.plansOwned(id);
    const money = this.game.money;
    const price = buildingById(id).price;
    let foot: string;
    if (!owned) foot = `<span class="price">${this.priceText(id)}</span><span class="status locked">${t('build.plansLocked', { item: t(`up.${PLAN_OF[id]}`) })}</span>`;
    else if (money < price && id !== 'belt') foot = `<span class="price">${this.priceText(id)}</span><span class="need">${t('shop.poor', { money: fmtMoney(price - money) })}</span>`;
    else foot = `<span class="price">${this.priceText(id)}</span><button class="btn" type="button" data-build="${id}">${t('build.pick')}</button>`;
    const desc = t(`build.desc.${id}`);
    return `<li class="card${owned ? '' : ' locked'}">` +
      `<div class="body"><div class="cat">${t('build.kind')}</div>` +
      `<div class="name">${t(`build.item.${id}`)}</div><div class="stats">${desc}</div>` +
      `<div class="foot">${foot}</div></div></li>`;
  }

  render(): void {
    this.money.textContent = fmtMoney(this.game.money);
    this.list.innerHTML = BUILDINGS.map((b) => this.row(b.id)).join('');
  }
}
