// Tools decide how much hay one click takes; containers decide how much you can carry.
export type ToolId = 'hands' | 'toy_shovel' | 'spade' | 'pitchfork';
export type ContainerId = 'bucket' | 'wheelbarrow';
export type ItemId = ToolId | ContainerId;

export interface ToolDef {
  kind: 'tool';
  id: ToolId;
  price: number;
  grab: number; // strands per click
  cooldown: number; // seconds between clicks
  radiusCells: number; // reach around the aimed cell
  requires?: ItemId;
}

export interface ContainerDef {
  kind: 'container';
  id: ContainerId;
  price: number;
  capacity: number; // strands
  requires?: ItemId;
}

export type ItemDef = ToolDef | ContainerDef;

export const HANDS_CAPACITY = 10;

export const TOOLS: readonly ToolDef[] = [
  { kind: 'tool', id: 'hands', price: 0, grab: 2, cooldown: 0.22, radiusCells: 1 },
  { kind: 'tool', id: 'toy_shovel', price: 3, grab: 6, cooldown: 0.3, radiusCells: 1 },
  { kind: 'tool', id: 'spade', price: 30, grab: 18, cooldown: 0.4, radiusCells: 1, requires: 'toy_shovel' },
  { kind: 'tool', id: 'pitchfork', price: 140, grab: 40, cooldown: 0.5, radiusCells: 2, requires: 'spade' },
];

export const CONTAINERS: readonly ContainerDef[] = [
  { kind: 'container', id: 'bucket', price: 8, capacity: 60 },
  { kind: 'container', id: 'wheelbarrow', price: 90, capacity: 300, requires: 'bucket' },
];

/** Shop order. */
export const SHOP_ITEMS: readonly ItemDef[] = [
  TOOLS[1], CONTAINERS[0], TOOLS[2], CONTAINERS[1], TOOLS[3],
];

export const itemById = (id: ItemId): ItemDef =>
  (TOOLS.find((t) => t.id === id) ?? CONTAINERS.find((c) => c.id === id))!;
