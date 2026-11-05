import { BRANCHES, BranchId, UPGRADES, UpgradeDef, UpgradeIcon, UpgradeId, isUpgrade, upgradeById } from '../data/upgrades';
import { ItemId, itemById } from '../data/tools';
import { fmtMoney } from '../core/format';
import { fmtNumber, rich, t } from '../core/i18n';
import type { Game } from '../game/Game';
import { Derived, derive } from '../game/stats';
import { replay } from './hud';

// "Дерево улучшений" [Tab]: branches as horizontal bands, steps as columns, lines from requirement to
// upgrade, details and the buy button on the right. Layout follows the reference game's tech tree.

type Entry = { kind: 'item'; id: ItemId } | { kind: 'up'; id: UpgradeId } | { kind: 'group'; of: ItemId };
const I = (id: ItemId): Entry => ({ kind: 'item', id });
const U = (id: UpgradeId): Entry => ({ kind: 'up', id });
const G = (of: ItemId): Entry => ({ kind: 'group', of });

/** Columns per branch. Column 0 holds the root (bare hands); every branch grows from it. */
const LAYOUT: Record<BranchId, Entry[][]> = {
  hand: [[I('hands')], [U('hand_more'), I('toy_shovel'), I('spade'), I('bucket')], [G('toy_shovel'), G('spade'), I('pitchfork'), G('bucket'), I('wheelbarrow')], [G('pitchfork'), G('wheelbarrow')]],
  fitness: [[], [U('boots'), U('back'), U('breath'), U('reach')], [U('springs'), U('steady'), U('swing')]],
  selling: [[], [U('deal')]],
  needles: [[], [I('detector')], [G('detector'), U('precise')]],
};
const COLS = 4;
const W = 224, GAP = 48, CARD_H = 86, HEAD_H = 26, ROW_H = 30, VGAP = 8, PAD_X = 16, BAND_PAD = 14, BAND_GAP = 10, TOP = 10;

interface Rect { x: number; y: number; w: number; h: number }
const keyOf = (e: Entry) => (e.kind === 'group' ? `group:${e.of}` : `${e.kind}:${e.id}`);
const groupOf = (of: ItemId) => UPGRADES.filter((u) => u.of === of);
/** Where an upgrade sits: its own card, or a row in its item's group. */
const homeOf = (id: UpgradeId) => { const u = upgradeById(id); return u.of && u.of !== 'hands' ? `group:${u.of}` : `up:${id}`; };
const branchOf = (key: string): BranchId => {
  const [kind, id] = key.split(':');
  if (kind === 'up') return upgradeById(id as UpgradeId).branch;
  for (const b of BRANCHES) if (LAYOUT[b.id].some((col) => col.some((e) => keyOf(e) === key || (e.kind === 'group' && e.of === id)))) return b.id;
  return 'hand';
};
const color = (b: BranchId) => BRANCHES.find((x) => x.id === b)!.color;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r2 = (v: number) => Math.round(v * 100) / 100;
const perStrand = (v: number) => `$${v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;

/** "now → next" value of an upgrade for a set of derived numbers. */
function valueText(id: UpgradeId, d: Derived): string {
  const tool = (k: keyof Derived['tools']) => t('up.tool.val', { grab: d.tools[k].grab, cap: d.tools[k].cap });
  switch (id) {
    case 'hand_more': return t('up.hand_more.val', { grab: d.tools.hands.grab, cap: d.tools.hands.cap });
    case 'toy_more': return tool('toy_shovel');
    case 'spade_more': return tool('spade');
    case 'fork_more': return tool('pitchfork');
    case 'bucket_more': return t('up.container.val', { cap: d.containers.bucket });
    case 'barrow_more': return t('up.container.val', { cap: d.containers.wheelbarrow });
    case 'boots': return t('up.boots.val', { v: fmtNumber(r2(d.walk)) });
    case 'springs': return t('up.springs.val', { v: fmtNumber(r2(d.jumpM)) });
    case 'steady': return t('up.steady.val', { v: Math.round(d.sway * 100) });
    case 'back': return t('up.back.val', { v: d.staminaMax });
    case 'breath': return t('up.breath.val', { v: fmtNumber(Math.round(d.regen * 10) / 10) });
    case 'reach': return t('up.reach.val', { v: fmtNumber(r2(d.reach)) });
    case 'swing': return t('up.swing.val', { v: Math.round(d.swingCost * 100) });
    case 'deal': return t('up.deal.val', { v: perStrand(d.price) });
    case 'coil': return t('up.coil.val', { range: fmtNumber(Math.round(d.detectorRange * 10) / 10), deep: fmtNumber(Math.round(d.detectorDeep * 10) / 10) });
    case 'precise': return t('up.precise.val', { deep: fmtNumber(Math.round(d.detectorDeep * 10) / 10) });
  }
}

const $ = (id: string) => document.getElementById(id)!;
const lock = () => `<svg width="10" height="12" viewBox="0 0 10 12" aria-label="${t('tree.locked')}"><path d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="1" y="5" width="8" height="6.5" rx="1" fill="currentColor"/></svg>`;

export class TreeScreen {
  private root = $('tree');
  private view = $('tree-view');
  private canvas = $('tree-canvas');
  private detail = $('tree-detail');
  private search = $('tree-search') as HTMLInputElement;
  private rects = new Map<string, Rect>();
  private bands = new Map<BranchId, Rect>();
  private edges: Array<{ from: string; to: string }> = [];
  private width = 0;
  private height = 0;
  private selected = 'up:hand_more';
  isOpen = false;
  onClose: (relock: boolean) => void = () => {};
  onBuyFail: () => void = () => {};

  constructor(
    private readonly game: Game,
    private readonly itemIcons: Map<ItemId, string>,
    private readonly upIcons: Map<UpgradeIcon, string>,
  ) {
    $('tree-title').textContent = t('tree.title');
    this.search.placeholder = t('tree.search');
    $('tree-foot').innerHTML = rich(t('tree.keys'));
    this.layout();
    this.root.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const buy = el.closest<HTMLElement>('[data-buy]');
      if (buy) { this.buy(buy.dataset.buy as UpgradeId); return; }
      const branch = el.closest<HTMLElement>('[data-branch]');
      if (branch) { this.scrollToBranch(branch.dataset.branch as BranchId); return; }
      const node = el.closest<HTMLElement>('[data-key]');
      if (node) this.select(node.dataset.key!);
    });
    this.canvas.addEventListener('dblclick', (e) => {
      const node = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      const [kind, id] = (node?.dataset.key ?? '').split(':');
      if (kind === 'up') this.buy(id as UpgradeId);
    });
    this.search.addEventListener('input', () => this.filter(true));
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Tab') { e.preventDefault(); this.close(true); }
      else if (e.code === 'Escape') { e.preventDefault(); this.close(false); }
      else if ((e.code === 'Space' || e.code === 'Enter') && e.target !== this.search) {
        e.preventDefault();
        const [kind, id] = this.selected.split(':');
        if (kind === 'up') this.buy(id as UpgradeId);
      }
    });
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    document.body.classList.add('in-tree');
    // Start on something useful: the cheapest upgrade that can be bought now.
    const [kind, id] = this.selected.split(':');
    if (kind !== 'up' || this.game.upgradeState(id as UpgradeId) !== 'ok') {
      const ok = UPGRADES.filter((u) => this.game.upgradeState(u.id) === 'ok')
        .sort((a, b) => (this.game.up.nextPrice(a.id) ?? 0) - (this.game.up.nextPrice(b.id) ?? 0))[0];
      if (ok) this.selected = `up:${ok.id}`;
    }
    this.render();
    this.root.classList.remove('hidden');
    replay(this.root, 'enter');
    this.reveal(this.selected, false);
  }

  close(relock: boolean): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.search.blur();
    document.body.classList.remove('in-tree');
    this.root.classList.add('hidden');
    this.onClose(relock);
  }

  // ---------- layout ----------
  private entryHeight(e: Entry): number {
    return e.kind === 'group' ? HEAD_H + groupOf(e.of).length * ROW_H + 4 : CARD_H;
  }

  private parents(e: Entry): string[] {
    if (e.kind === 'group') return [`item:${e.of}`];
    if (e.kind === 'item') {
      if (e.id === 'hands') return [];
      const req = itemById(e.id).requires;
      return [req ? `item:${req}` : 'item:hands'];
    }
    const req = upgradeById(e.id).requires.map((r) => (isUpgrade(r) ? homeOf(r) : `item:${r}`));
    return req.length ? req : ['item:hands'];
  }

  private layout(): void {
    let top = TOP;
    for (const b of BRANCHES) {
      const cols = LAYOUT[b.id];
      let bottom = top + BAND_PAD;
      cols.forEach((col, c) => {
        let y = top + BAND_PAD;
        for (const e of col) {
          // Line up with the requirement when it is in this band, otherwise stack.
          const py = this.parents(e).map((k) => this.rects.get(k)?.y ?? -1).filter((v) => v >= top);
          y = Math.max(y, py.length ? Math.min(...py) : y);
          const h = this.entryHeight(e);
          const rect = { x: PAD_X + c * (W + GAP), y, w: W, h };
          this.rects.set(keyOf(e), rect);
          if (e.kind === 'group') groupOf(e.of).forEach((u, i) => this.rects.set(`up:${u.id}`, { x: rect.x, y: y + HEAD_H + i * ROW_H, w: W, h: ROW_H }));
          for (const p of this.parents(e)) this.edges.push({ from: p, to: keyOf(e) });
          y += h + VGAP;
        }
        bottom = Math.max(bottom, y - VGAP);
      });
      this.bands.set(b.id, { x: 0, y: top, w: 0, h: bottom + BAND_PAD - top });
      top = bottom + BAND_PAD + BAND_GAP;
    }
    this.width = PAD_X * 2 + COLS * W + (COLS - 1) * GAP;
    this.height = top;
  }

  // ---------- state ----------
  private itemState(id: ItemId): 'owned' | 'locked' | 'shop' {
    if (this.game.inv.has(id)) return 'owned';
    const req = itemById(id).requires;
    return req && !this.game.inv.has(req) ? 'locked' : 'shop';
  }

  private upIcon(u: UpgradeDef): string {
    const src = u.of ? this.itemIcons.get(u.of) : u.icon ? this.upIcons.get(u.icon) : '';
    return `<img src="${src ?? ''}" alt="" draggable="false">${u.of ? '<i class="badge">+</i>' : ''}`;
  }

  private satisfied(key: string): boolean {
    const [kind, id] = key.split(':');
    if (kind === 'item') return this.game.inv.has(id as ItemId);
    if (kind === 'up') return this.game.up.level(id as UpgradeId) > 0;
    return true;
  }

  // ---------- render ----------
  render(): void {
    $('tree-money').textContent = fmtMoney(this.game.money);
    const parts: string[] = [];
    for (const b of BRANCHES) {
      const r = this.bands.get(b.id)!;
      parts.push(`<div class="tband" style="--b:${b.color};top:${r.y}px;height:${r.h}px"></div>`);
    }
    parts.push(`<svg class="tlines" width="${this.width}" height="${this.height}" aria-hidden="true"></svg>`);
    for (const b of BRANCHES) for (const col of LAYOUT[b.id]) for (const e of col) parts.push(this.entryHtml(e, b.id));
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.canvas.innerHTML = parts.join('');
    $('tree-steps').innerHTML = Array.from({ length: COLS - 1 }, (_, i) =>
      `<span style="left:${PAD_X + (i + 1) * (W + GAP)}px;width:${W}px">${i === 0 ? t('tree.step1') : t('tree.steps', { n: i + 1 })}</span>`).join('');
    $('tree-steps').style.width = `${this.width}px`;
    this.renderSide();
    this.renderSelection();
    this.filter();
  }

  private entryHtml(e: Entry, branch: BranchId): string {
    const key = keyOf(e), r = this.rects.get(key)!;
    const pos = `--b:${color(branch)};left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
    const label = `<span class="tbr">${esc(t(`branch.${branch}`))}</span>`;
    if (e.kind === 'group') {
      const rows = groupOf(e.of).map((u) => {
        const st = this.game.upgradeState(u.id), lvl = this.game.up.level(u.id);
        const state = st === 'locked' ? lock() : st === 'maxed' ? t('tree.owned') : fmtMoney(this.game.up.nextPrice(u.id)!);
        return `<button type="button" class="tr s-${st}" data-key="up:${u.id}" data-name="${esc(t(`up.${u.id}`).toLowerCase())}">` +
          `<span class="ti">${this.upIcon(u)}</span><span class="trn">${esc(t(`up.${u.id}`))}</span>` +
          `<span class="trs">${state}</span><span class="trl">${lvl}/${u.max}</span></button>`;
      }).join('');
      return `<div class="tg" data-group="${key}" style="${pos}"><div class="tgh">${esc(t('tree.group', { item: t(`item.${e.of}`) }))}</div>${rows}</div>`;
    }
    if (e.kind === 'item') {
      const st = this.itemState(e.id);
      const foot = e.id === 'hands'
        ? `<span class="tst done">${t('tree.done')}</span><span class="tst">${t('tree.owned')}</span>`
        : `<span class="tst">${t(st === 'owned' ? 'tree.owned' : st === 'locked' ? 'tree.locked' : 'tree.inShop')}</span>`;
      return `<button type="button" class="tn s-${st}" data-key="${key}" data-name="${esc(t(`item.${e.id}`).toLowerCase())}" style="${pos}">` +
        `<span class="ti"><img src="${this.itemIcons.get(e.id) ?? ''}" alt="" draggable="false"></span>` +
        `<span class="tb">${label}<span class="tnm">${esc(t(`item.${e.id}`))}</span><span class="tft">${foot}</span></span></button>`;
    }
    const u = upgradeById(e.id), st = this.game.upgradeState(e.id), lvl = this.game.up.level(e.id);
    const state = st === 'locked' ? `<span class="tst">${t('tree.locked')}</span>`
      : st === 'maxed' ? `<span class="tst">${t('tree.owned')}</span>`
        : `<span class="tprice">${fmtMoney(this.game.up.nextPrice(e.id)!)}</span>`;
    return `<button type="button" class="tn s-${st}" data-key="${key}" data-name="${esc(t(`up.${e.id}`).toLowerCase())}" style="${pos}">` +
      `<span class="ti">${this.upIcon(u)}</span>` +
      `<span class="tb">${label}<span class="tnm">${esc(t(`up.${e.id}`))}</span><span class="tft">${state}<span class="tlv">${lvl}/${u.max}</span></span></span></button>`;
  }

  private renderLines(): void {
    const sel = this.selected.startsWith('up:') ? homeOf(this.selected.slice(3) as UpgradeId) : this.selected;
    const paths = this.edges.map(({ from, to }) => {
      const a = this.rects.get(from), b = this.rects.get(to);
      if (!a || !b) return { d: '', cls: '' };
      const x1 = a.x + a.w, y1 = a.y + Math.min(a.h / 2, CARD_H / 2);
      const x2 = b.x, y2 = b.y + (to.startsWith('group:') ? HEAD_H / 2 : b.h / 2);
      const xm = b.x - GAP / 2;
      const hl = from === sel || to === sel;
      return { d: `M${x1} ${y1}H${xm}V${y2}H${x2}`, cls: hl ? 'hl' : this.satisfied(from) ? 'on' : '' };
    });
    // Highlighted lines last so they draw on top.
    paths.sort((p, q) => Number(p.cls === 'hl') - Number(q.cls === 'hl'));
    this.canvas.querySelector('svg')!.innerHTML = paths.map((p) => `<path class="${p.cls}" d="${p.d}"/>`).join('');
  }

  private renderSide(): void {
    const b = branchOf(this.selected);
    const total = UPGRADES.filter((u) => u.branch === b).reduce((n, u) => n + u.max, 0);
    const now = $('tree-branch-now');
    now.style.setProperty('--b', color(b));
    now.innerHTML = `<h3>${esc(t(`branch.${b}`))}</h3><small>${t('tree.bought', { n: this.game.up.bought(b), total })}</small><p>${esc(t(`branch.${b}.sub`))}</p>`;
    $('tree-branches').innerHTML = BRANCHES.map((x) =>
      `<li><button type="button" data-branch="${x.id}" class="${x.id === b ? 'on' : ''}" style="--b:${x.color}">${esc(t(`branch.${x.id}`))}</button></li>`).join('');
    $('tree-side').style.setProperty('--b', color(b));
  }

  private renderSelection(): void {
    this.canvas.querySelectorAll('.sel').forEach((el) => el.classList.remove('sel'));
    this.canvas.querySelector(`[data-key="${this.selected}"]`)?.classList.add('sel');
    this.renderLines();
    this.renderDetail();
  }

  private renderDetail(): void {
    const [kind, id] = this.selected.split(':');
    const b = branchOf(this.selected);
    const head = (icon: string, name: string) =>
      `<div class="td-head" style="--b:${color(b)}"><span class="ti">${icon}</span><div><div class="tbr">${esc(t(`branch.${b}`))}</div><div class="td-name">${esc(name)}</div></div></div>`;
    const d = this.game.d;
    if (kind === 'item') {
      const item = id as ItemId, def = itemById(item), st = this.itemState(item);
      const icon = `<img src="${this.itemIcons.get(item) ?? ''}" alt="" draggable="false">`;
      let desc: string;
      if (item === 'hands') desc = t('tree.desc.hands', { grab: d.tools.hands.grab, cap: d.tools.hands.cap });
      else if (def.kind === 'tool') desc = t('tree.desc.tool', { grab: d.tools[def.id].grab, cap: d.tools[def.id].cap });
      else if (def.kind === 'container') desc = t('tree.desc.container', { cap: d.containers[def.id] });
      else desc = t('tree.desc.detector', { range: fmtNumber(Math.round(d.detectorRange * 10) / 10), deep: fmtNumber(Math.round(d.detectorDeep * 10) / 10) });
      if (item !== 'hands' && st !== 'owned') desc += ` ${t('tree.desc.unlocks')}`;
      const meta = `${t('tree.unlock')} · ${t(st === 'owned' ? 'tree.boughtItem' : 'tree.notBought')}`;
      const note = st === 'owned' ? (item === 'hands' ? '' : t('tree.shopOwned'))
        : st === 'locked' ? t('tree.needs', { list: t(`item.${def.requires}`) }) : t('tree.shopNote', { money: fmtMoney(def.price) });
      const status = t(st === 'owned' ? 'tree.owned' : st === 'locked' ? 'tree.locked' : 'tree.inShop');
      this.detail.innerHTML = head(icon, t(`item.${item}`)) + `<div class="td-meta">${meta}</div><p class="td-desc">${esc(desc)}</p>` +
        `<div class="td-buy">${item === 'hands' ? '' : `<div class="td-price item">${fmtMoney(def.price)}</div>`}<div class="td-status s-${st}">${status}</div>` +
        `<div class="td-note ${st === 'owned' ? 'ok' : ''}">${esc(note)}</div></div>`;
      return;
    }
    const u = upgradeById(id as UpgradeId), lvl = this.game.up.level(u.id), st = this.game.upgradeState(u.id);
    const next = st === 'maxed' ? null : derive({ ...this.game.up.levels, [u.id]: lvl + 1 }, this.game.perks);
    const change = next
      ? `<p class="td-change">${esc(t('tree.now', { v: valueText(u.id, d) }))} <span class="arrow">→</span> ${esc(t('tree.next', { v: valueText(u.id, next) }))}</p>`
      : `<p class="td-change">${esc(t('tree.now', { v: valueText(u.id, d) }))}</p>`;
    let buy: string;
    if (st === 'maxed') buy = `<div class="td-status s-owned">${t('tree.maxed')}</div>`;
    else {
      const price = this.game.up.nextPrice(u.id)!;
      const missing = this.game.missing(u.id).map((r) => t(isUpgrade(r) ? `up.${r}` : `item.${r}`)).join(', ');
      const note = st === 'locked' ? t('tree.needs', { list: missing }) : st === 'poor' ? t('tree.poor', { money: fmtMoney(price - this.game.money) }) : '';
      buy = `<div class="td-price">${fmtMoney(price)}</div>` +
        `<button type="button" class="td-btn" data-buy="${u.id}"${st === 'ok' ? '' : ' disabled'}>${t('tree.buy', { n: lvl + 1 })}</button>` +
        `<div class="td-note">${esc(note)}</div>`;
    }
    this.detail.innerHTML = head(this.upIcon(u), t(`up.${u.id}`)) +
      `<div class="td-meta">${t('tree.level', { n: lvl, max: u.max })}</div><p class="td-desc">${esc(t(`up.${u.id}.desc`))}</p>${change}` +
      `<div class="td-buy">${buy}</div>`;
  }

  // ---------- actions ----------
  select(key: string): void {
    if (!this.rects.has(key)) return;
    const branchChanged = branchOf(key) !== branchOf(this.selected);
    this.selected = key;
    if (branchChanged) this.renderSide();
    this.renderSelection();
  }

  private buy(id: UpgradeId): void {
    if (!this.game.buyUpgrade(id)) { this.onBuyFail(); return; }
    this.selected = `up:${id}`;
    this.render();
    const el = this.canvas.querySelector<HTMLElement>(`[data-key="up:${id}"]`);
    if (el) replay(el, 'bought');
    replay($('tree-money'), 'bump');
  }

  private filter(pick = false): void {
    const q = this.search.value.trim().toLowerCase();
    let first: string | null = null;
    this.canvas.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
      const hit = !q || (el.dataset.name ?? '').includes(q);
      el.classList.toggle('dim', !hit);
      if (hit && q && !first) first = el.dataset.key!;
    });
    this.canvas.querySelectorAll<HTMLElement>('.tg').forEach((g) => g.classList.toggle('dim', !!q && !g.querySelector('[data-key]:not(.dim)')));
    if (pick && first) { this.select(first); this.reveal(first, true); }
  }

  private reveal(key: string, smooth: boolean): void {
    const r = this.rects.get(key);
    if (!r) return;
    const v = this.view;
    const top = r.y - v.clientHeight / 2 + r.h / 2 + 30;
    // Scroll sideways only when the card is out of view, so the root column stays visible on wide screens.
    const left = r.x + r.w + 24 > v.scrollLeft + v.clientWidth ? r.x + r.w + 24 - v.clientWidth : r.x < v.scrollLeft ? r.x - 16 : v.scrollLeft;
    v.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
  }

  private scrollToBranch(b: BranchId): void {
    const r = this.bands.get(b)!;
    this.view.scrollTo({ top: Math.max(0, r.y - 10), behavior: 'smooth' });
    const first = LAYOUT[b].flat()[0];
    if (first) this.select(first.kind === 'group' ? `up:${groupOf(first.of)[0].id}` : keyOf(first));
  }
}
