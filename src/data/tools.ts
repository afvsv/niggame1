// Tools decide how much hay one click takes and how much the hands can hold.
// Containers are carried, put down by the stack, filled and taken to the counter.
export type ToolId = 'hands' | 'toy_shovel' | 'spade' | 'pitchfork';
export type ContainerId = 'bucket' | 'wheelbarrow';
export type GadgetId = 'detector';
export type ItemId = ToolId | ContainerId | GadgetId;

export interface ToolDef {
  kind: 'tool';
  id: ToolId;
  price: number;
  grab: number; // strands per click
  capacity: number; // strands the tool (or hands) can hold
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

export interface DetectorDef {
  kind: 'detector';
  id: GadgetId;
  price: number;
  rangeM: number; // through open air; hay muffles the signal
  requires?: ItemId;
}

export type ItemDef = ToolDef | ContainerDef | DetectorDef;

export const TOOLS: readonly ToolDef[] = [
  { kind: 'tool', id: 'hands', price: 0, grab: 2, capacity: 10, cooldown: 0.22, radiusCells: 1 },
  { kind: 'tool', id: 'toy_shovel', price: 3, grab: 6, capacity: 24, cooldown: 0.3, radiusCells: 1 },
  { kind: 'tool', id: 'spade', price: 30, grab: 18, capacity: 72, cooldown: 0.4, radiusCells: 1, requires: 'toy_shovel' },
  { kind: 'tool', id: 'pitchfork', price: 140, grab: 40, capacity: 160, cooldown: 0.5, radiusCells: 2, requires: 'spade' },
];

export const CONTAINERS: readonly ContainerDef[] = [
  { kind: 'container', id: 'bucket', price: 8, capacity: 200 },
  { kind: 'container', id: 'wheelbarrow', price: 90, capacity: 800, requires: 'bucket' },
];

export const DETECTOR: DetectorDef = { kind: 'detector', id: 'detector', price: 60, rangeM: 6, requires: 'bucket' };

/** Hotbar order: tools, then containers, then gadgets. */
export const ALL_ITEMS: readonly ItemDef[] = [...TOOLS, ...CONTAINERS, DETECTOR];

/** Shop order. */
export const SHOP_ITEMS: readonly ItemDef[] = [TOOLS[1], CONTAINERS[0], TOOLS[2], DETECTOR, CONTAINERS[1], TOOLS[3]];

export const itemById = (id: ItemId): ItemDef => ALL_ITEMS.find((t) => t.id === id)!;
export const isContainer = (id: ItemId): id is ContainerId => id === 'bucket' || id === 'wheelbarrow';
export const isTool = (id: ItemId): id is ToolId => TOOLS.some((t) => t.id === id);
