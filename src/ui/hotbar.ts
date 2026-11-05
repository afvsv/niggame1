import { ItemId, isContainer } from '../data/tools';
import type { Inventory } from '../game/Inventory';
import { replay } from './hud';

const $ = (id: string) => document.getElementById(id)!;

const PIN = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 14.5s4.5-4.2 4.5-7.6a4.5 4.5 0 0 0-9 0c0 3.4 4.5 7.6 4.5 7.6z"/><circle cx="8" cy="6.9" r="1.6"/></svg>';

/** Owned items as numbered slots. Containers show their fill and a pin when they stand in the world. */
export class Hotbar {
  private root = $('hotbar');
  private key = '';

  constructor(private readonly icons: Map<ItemId, string>) {}

  render(inv: Inventory, capacity: (id: ItemId) => number): void {
    const items = inv.items();
    const key = items.map((d) => {
      if (!isContainer(d.id)) return d.id;
      const st = inv.state(d.id);
      return `${d.id}:${st.fill}:${capacity(d.id)}:${st.placed ? 1 : 0}`;
    }).join(',') + `|${inv.active}`;
    if (key === this.key) return;
    this.key = key;
    this.root.innerHTML = items.map((d, i) => {
      let extra = '', cls = d.id === inv.active ? ' active' : '';
      if (isContainer(d.id)) {
        const st = inv.state(d.id), cap = capacity(d.id);
        extra = `<span class="fill${st.fill >= cap ? ' full' : ''}"><i style="transform:scaleX(${Math.min(1, st.fill / cap)})"></i></span>`;
        if (st.placed) { cls += ' away'; extra += `<span class="pin">${PIN}</span>`; }
      }
      return `<div class="slot${cls}" data-id="${d.id}"><img src="${this.icons.get(d.id) ?? ''}" alt="" draggable="false"><span class="key">${i + 1}</span>${extra}</div>`;
    }).join('');
  }

  flash(id: ItemId): void {
    const slot = this.root.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (slot) replay(slot, 'new');
  }
}
