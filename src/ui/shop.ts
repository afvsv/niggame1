import { SHOP_ITEMS, ItemDef, ItemId } from '../data/tools';
import { fmtMoney } from '../core/format';
import { fmtNumber, rich, strands, t } from '../core/i18n';
import type { Game } from '../game/Game';
import { replay } from './hud';

const $ = (id: string) => document.getElementById(id)!;

const svg = (path: string) =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const LOCK = svg('<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>');
const CHECK = svg('<path d="M3.5 8.5l3 3 6-7"/>');

/** Whole-dollar prices drop the cents. */
export const tagPrice = (v: number): string => (Number.isInteger(v) ? `$${v}` : fmtMoney(v));

/** "Снабжение": the barn's supply board where tools and containers are bought. */
export class ShopScreen {
  private root = $('shop');
  private list = $('shop-list');
  private money = $('shop-money');
  private count = $('shop-count');
  isOpen = false;
  onClose: (relock: boolean) => void = () => {};
  onBuyFail: () => void = () => {};

  constructor(private readonly game: Game, private readonly icons: Map<ItemId, string>) {
    $('shop-title').textContent = t('shop.title');
    $('shop-subtitle').textContent = t('shop.subtitle');
    $('shop-wallet-label').textContent = t('shop.wallet');
    $('shop-close').innerHTML = `${t('shop.close')} <kbd>E</kbd>`;
    $('shop-keys').innerHTML = rich(t('shop.keys'));
    $('shop-close').addEventListener('click', () => this.close(true));
    this.root.addEventListener('mousedown', (e) => { if (e.target === this.root) this.close(true); });
    this.list.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-buy]');
      if (!btn) return;
      const id = btn.dataset.buy as ItemId;
      if (this.game.buy(id)) this.render(id);
      else this.onBuyFail();
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

  private row(def: ItemDef, justBought?: ItemId): string {
    const { inv, money } = this.game;
    const state = inv.buyState(def.id, money);
    const seg = (s: string) => `<span>${s}</span>`;
    const stats = def.kind === 'tool'
      ? `${seg(t('shop.grab', { strands: strands(def.grab) }))} · ${seg(t('shop.cooldown', { s: fmtNumber(def.cooldown) }))}`
      : seg(t('shop.capacity', { strands: strands(def.capacity) }));
    let foot: string;
    if (state === 'owned') foot = `<span class="status owned">${CHECK}${t('shop.owned')}</span>`;
    else if (state === 'locked') foot = `<span class="price">${tagPrice(def.price)}</span><span class="status locked">${LOCK}${t('shop.requires', { item: t(`item.${def.requires}`) })}</span>`;
    else if (state === 'poor') foot = `<span class="price">${tagPrice(def.price)}</span><span class="need">${t('shop.poor', { money: fmtMoney(def.price - money) })}</span>`;
    else foot = `<span class="price">${tagPrice(def.price)}</span><button class="btn" type="button" data-buy="${def.id}">${t('shop.buy')}</button>`;
    return `<li class="card ${state}${justBought === def.id ? ' bought' : ''}">` +
      `<div class="thumb"><img src="${this.icons.get(def.id) ?? ''}" alt="" draggable="false"></div>` +
      `<div class="body"><div class="cat ${def.kind}">${t(`shop.kind.${def.kind}`)}</div>` +
      `<div class="name">${t(`item.${def.id}`)}</div><div class="stats">${stats}</div>` +
      `<div class="foot">${foot}</div></div></li>`;
  }

  render(justBought?: ItemId): void {
    this.money.textContent = fmtMoney(this.game.money);
    this.list.innerHTML = SHOP_ITEMS.map((d) => this.row(d, justBought)).join('');
    const owned = SHOP_ITEMS.filter((d) => this.game.inv.has(d.id)).length;
    this.count.textContent = t('shop.count', { n: owned, total: SHOP_ITEMS.length });
  }
}
