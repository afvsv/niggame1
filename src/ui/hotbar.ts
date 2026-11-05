import type { ItemId } from '../data/tools';
import type { Inventory } from '../game/Inventory';
import { replay } from './hud';

const $ = (id: string) => document.getElementById(id)!;

/** Owned tools as numbered slots under the carry bar. */
export class Hotbar {
  private root = $('hotbar');
  private name = $('hotbar-name');

  constructor(private readonly icons: Map<ItemId, string>) {}

  render(inv: Inventory): void {
    this.root.innerHTML = inv.tools().map((tool, i) =>
      `<div class="slot${tool.id === inv.active ? ' active' : ''}" data-id="${tool.id}">` +
      `<img src="${this.icons.get(tool.id) ?? ''}" alt="" draggable="false"><span class="key">${i + 1}</span></div>`,
    ).join('');
  }

  flash(id: ItemId): void {
    const slot = this.root.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (slot) replay(slot, 'new');
  }

  showName(text: string): void {
    this.name.textContent = text;
    replay(this.name, 'show');
  }
}
