import { ALL_ITEMS, CONTAINERS, ContainerDef, ContainerId, ItemDef, ItemId, TOOLS, ToolDef, ToolId, isContainer, isTool, itemById } from '../data/tools';

export type BuyState = 'owned' | 'locked' | 'poor' | 'ok';

export interface Placement { x: number; y: number; z: number; yaw: number }
/** A container is either in the player's hands / pocket (`placed` null) or standing in the world. */
export interface ContainerState { fill: number; placed: Placement | null }

export interface InventorySave {
  owned: ItemId[];
  active: ItemId;
  lastTool?: ToolId;
  containers?: Partial<Record<ContainerId, ContainerState>>;
}

/** What the player owns and holds. Emits `onChange` on any change. */
export class Inventory {
  private owned = new Set<ItemId>(['hands']);
  active: ItemId = 'hands';
  /** The tool to go back to after putting a container down. */
  lastTool: ToolId = 'hands';
  readonly containers = new Map<ContainerId, ContainerState>();
  onChange: () => void = () => {};

  has(id: ItemId): boolean { return this.owned.has(id); }

  /** Owned items in hotbar order. */
  items(): ItemDef[] { return ALL_ITEMS.filter((t) => this.owned.has(t.id)); }

  get activeDef(): ItemDef { return itemById(this.active); }

  /** The active tool, or the last one used while a container or gadget is in hand. */
  get tool(): ToolDef { return TOOLS.find((t) => t.id === (isTool(this.active) ? this.active : this.lastTool))!; }

  /** The container in the player's hands, if any. */
  get held(): ContainerDef | null {
    return isContainer(this.active) ? CONTAINERS.find((c) => c.id === this.active)! : null;
  }

  state(id: ContainerId): ContainerState {
    let s = this.containers.get(id);
    if (!s) this.containers.set(id, (s = { fill: 0, placed: null }));
    return s;
  }

  /** Placed containers with their definitions. */
  placed(): Array<{ def: ContainerDef; state: ContainerState }> {
    return CONTAINERS.filter((c) => this.owned.has(c.id) && this.state(c.id).placed).map((def) => ({ def, state: this.state(def.id) }));
  }

  /** A container standing in the world cannot be pulled out of the hotbar. */
  canSelect(id: ItemId): boolean {
    return this.owned.has(id) && !(isContainer(id) && this.state(id).placed);
  }

  buyState(id: ItemId, money: number): BuyState {
    if (this.owned.has(id)) return 'owned';
    const def = itemById(id);
    if (def.requires && !this.owned.has(def.requires)) return 'locked';
    return money + 1e-9 >= def.price ? 'ok' : 'poor';
  }

  /** Adds the item and puts it in hand. The caller puts a held container down first. */
  add(id: ItemId): void {
    this.owned.add(id);
    if (isContainer(id)) this.state(id);
    if (!this.setActive(id)) this.onChange();
  }

  /** Makes an owned item active. Returns false if nothing changed or it is not selectable. */
  setActive(id: ItemId): boolean {
    if (id === this.active || !this.canSelect(id)) return false;
    this.active = id;
    if (isTool(id)) this.lastTool = id;
    this.onChange();
    return true;
  }

  /** Item at a hotbar index (0-based). */
  at(index: number): ItemId | null { return this.items()[index]?.id ?? null; }

  /** Next selectable item in the given direction, skipping containers standing in the world. */
  next(delta: number): ItemId | null {
    const list = this.items();
    if (list.length < 2) return null;
    const i = list.findIndex((t) => t.id === this.active);
    for (let k = 1; k < list.length; k++) {
      const id = list[(i + delta * k + list.length * k) % list.length].id;
      if (this.canSelect(id)) return id === this.active ? null : id;
    }
    return null;
  }

  serialize(): InventorySave {
    const containers: Partial<Record<ContainerId, ContainerState>> = {};
    for (const [id, s] of this.containers) containers[id] = { fill: s.fill, placed: s.placed && { ...s.placed } };
    return { owned: [...this.owned], active: this.active, lastTool: this.lastTool, containers };
  }

  load(s: InventorySave | undefined): void {
    if (!s) return;
    const valid = new Set<string>(ALL_ITEMS.map((t) => t.id));
    this.owned = new Set<ItemId>(['hands', ...s.owned.filter((id): id is ItemId => valid.has(id))]);
    this.containers.clear();
    for (const c of CONTAINERS) {
      if (!this.owned.has(c.id)) continue;
      const cs = s.containers?.[c.id];
      const p = cs?.placed;
      const placed = p && [p.x, p.y, p.z, p.yaw].every(Number.isFinite) ? { ...p } : null;
      this.containers.set(c.id, { fill: Math.max(0, Math.min(c.capacity * 2, Math.floor(cs?.fill ?? 0))), placed });
    }
    this.lastTool = s.lastTool && this.owned.has(s.lastTool) ? s.lastTool : 'hands';
    this.active = this.canSelect(s.active) ? s.active : this.lastTool;
  }
}
