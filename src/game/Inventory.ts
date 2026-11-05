import { CONTAINERS, ContainerDef, HANDS_CAPACITY, ItemId, TOOLS, ToolDef, ToolId, itemById } from '../data/tools';

export type BuyState = 'owned' | 'locked' | 'poor' | 'ok';

export interface InventorySave { owned: ItemId[]; active: ToolId; }

/** What the player owns and holds. Emits `onChange` on any change. */
export class Inventory {
  private owned = new Set<ItemId>(['hands']);
  active: ToolId = 'hands';
  onChange: () => void = () => {};

  has(id: ItemId): boolean { return this.owned.has(id); }

  /** Owned tools in hotbar order. */
  tools(): ToolDef[] { return TOOLS.filter((t) => this.owned.has(t.id)); }

  get tool(): ToolDef { return TOOLS.find((t) => t.id === this.active)!; }

  /** Best owned container, or null when carrying in hands. */
  get container(): ContainerDef | null {
    let best: ContainerDef | null = null;
    for (const c of CONTAINERS) if (this.owned.has(c.id) && (!best || c.capacity > best.capacity)) best = c;
    return best;
  }

  get capacity(): number { return Math.max(HANDS_CAPACITY, this.container?.capacity ?? 0); }

  buyState(id: ItemId, money: number): BuyState {
    if (this.owned.has(id)) return 'owned';
    const def = itemById(id);
    if (def.requires && !this.owned.has(def.requires)) return 'locked';
    return money + 1e-9 >= def.price ? 'ok' : 'poor';
  }

  /** Adds the item. A new tool becomes the active one. */
  add(id: ItemId): void {
    this.owned.add(id);
    const def = itemById(id);
    if (def.kind === 'tool') this.active = def.id;
    this.onChange();
  }

  select(index: number): boolean {
    const list = this.tools();
    const t = list[index];
    if (!t || t.id === this.active) return false;
    this.active = t.id;
    this.onChange();
    return true;
  }

  cycle(delta: number): boolean {
    const list = this.tools();
    if (list.length < 2) return false;
    const i = list.findIndex((t) => t.id === this.active);
    return this.select((i + delta + list.length) % list.length);
  }

  serialize(): InventorySave { return { owned: [...this.owned], active: this.active }; }

  load(s: InventorySave | undefined): void {
    if (!s) return;
    const valid = new Set<string>([...TOOLS.map((t) => t.id), ...CONTAINERS.map((c) => c.id)]);
    this.owned = new Set<ItemId>(['hands', ...s.owned.filter((id): id is ItemId => valid.has(id))]);
    this.active = this.owned.has(s.active) ? s.active : 'hands';
  }
}
