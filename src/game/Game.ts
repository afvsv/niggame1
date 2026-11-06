import * as THREE from 'three';
import { BALANCE } from '../data/balance';
import { ContainerDef, ContainerId, ItemId, ToolDef, isContainer, itemById } from '../data/tools';
import { NeedleId, Perks, sumPerks } from '../data/needles';
import { UPGRADES, UpgradeId, upgradePrice, upgradeById } from '../data/upgrades';
import { fmtMoney } from '../core/format';
import { strands, t } from '../core/i18n';
import { Input } from '../core/input';
import { HayParticles } from '../fx/particles';
import { HayGrid } from '../haystack/grid';
import { GridHit, raycastGrid } from '../haystack/raycast';
import { Conveyor } from './conveyor';
import { CONTAINER_WORLD, ContainerProps } from './containers';
import { DetectorSignal, hayAlong, signalStrength } from './detector';
import { Inventory } from './Inventory';
import { NeedleField } from './needles';
import { Stamina } from './stamina';
import { Derived, ToolStats, derive } from './stats';
import { UpgradeState, Upgrades } from './Upgrades';

export type Target =
  | { kind: 'hay'; hit: GridHit }
  | { kind: 'counter' } | { kind: 'shop' } | { kind: 'door' } | { kind: 'board' }
  | { kind: 'container'; id: ContainerId }
  | { kind: 'needle'; index: number }
  | null;

/** Hooks for feedback (sound, animation, UI). Game only decides the rules. */
export interface GameEvents {
  grab(got: number, tool: ToolDef): void;
  full(): void;
  sell(value: number, strandsSold: number): void;
  loadBelt(strands: number): void;
  buy(id: ItemId): void;
  upgrade(id: UpgradeId, price: number): void;
  /** Ran out of stamina. */
  tired(): void;
  toolChange(): void;
  openShop(): void;
  pour(n: number, id: ContainerId): void;
  place(id: ContainerId): void;
  pickUp(id: ContainerId): void;
  /** A short message in place of the hint, e.g. why a slot cannot be selected. */
  notice(text: string): void;
  needle(index: number): void;
  unlocked(): void;
  escaped(): void;
  beep(strength: number): void;
}

/** The hangar as the rules see it. */
export interface World {
  counter: THREE.Object3D;
  shop: THREE.Object3D;
  door: THREE.Object3D;
  board: THREE.Object3D;
  containers: ContainerProps;
  needles: NeedleField;
  /** Where something dropped at (x, z) from `maxY` comes to rest. */
  support(x: number, z: number, maxY: number, r: number): number;
  /** Keeps a put-down container inside the room the player stands in. */
  clamp(x: number, z: number, from: THREE.Vector3): [number, number];
  /** True once the player has walked out of the hangar. */
  exited(x: number, z: number): boolean;
}

export interface Stats { earned: number; sold: number; time: number; containerSold: boolean }

/** Core gameplay rules: digging, carrying in containers, selling, buying, finding needles. */
export class Game {
  money = 0;
  /** Hay in the hands / on the tool. */
  carried = 0;
  target: Target = null;
  hint = '';
  unlocked = false;
  escaped = false;
  perks: Perks = sumPerks([]);
  readonly up = new Upgrades();
  /** Current numbers after upgrades and needle bonuses. */
  d: Derived = derive({}, this.perks);
  readonly stamina = new Stamina();
  stats: Stats = { earned: 0, sold: 0, time: 0, containerSold: false };
  readonly detector = new DetectorSignal();
  readonly conveyor = new Conveyor();
  private cooldown = 0;
  private noticeT = 0;
  private readonly dir = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly grid: HayGrid,
    private readonly camera: THREE.Camera,
    private readonly world: World,
    private readonly input: Input,
    private readonly particles: HayParticles,
    readonly inv: Inventory,
    private readonly ev: GameEvents,
  ) {
    this.refreshPerks();
  }

  /** Recomputes bonuses after a needle, an upgrade or loading a save. */
  refreshPerks(): void {
    this.perks = sumPerks(this.world.needles.found);
    this.d = derive(this.up.levels, this.perks);
    this.unlocked = this.world.needles.found.length >= this.world.needles.total;
  }

  get found(): NeedleId[] { return this.world.needles.found; }

  get toolStats(): ToolStats { return this.d.tools[this.inv.tool.id]; }
  /** How much the hands / current tool hold. */
  get capacity(): number { return this.toolStats.cap; }
  containerCapacity(id: ContainerId): number { return this.d.containers[id]; }
  get grab(): number { return this.toolStats.grab; }
  get price(): number { return this.d.price; }

  private has = (id: ItemId) => this.inv.has(id);
  upgradeState(id: UpgradeId): UpgradeState { return this.up.state(id, this.money, this.has); }
  missing(id: UpgradeId): Array<UpgradeId | ItemId> { return this.up.missing(id, this.has); }

  /** How many upgrades can be bought right now (the HUD hints at the tree). */
  upgradesAffordable(): number {
    let n = 0;
    for (const u of UPGRADES) if (this.upgradeState(u.id) === 'ok') n++;
    return n;
  }

  /** Buys the next level of an upgrade. */
  buyUpgrade(id: UpgradeId): boolean {
    if (this.upgradeState(id) !== 'ok') return false;
    const price = upgradePrice(upgradeById(id), this.up.level(id));
    this.money = Math.max(0, this.money - price);
    this.up.buy(id);
    this.refreshPerks();
    this.ev.upgrade(id, price);
    return true;
  }

  /** What the held item carries right now: [amount, capacity]. Null for the detector. */
  load(): [number, number] | null {
    const held = this.inv.held;
    if (held) return [this.inv.state(held.id).fill, this.containerCapacity(held.id)];
    if (this.inv.active === 'detector') return null;
    return [this.carried, this.capacity];
  }

  private detectorHint(): string {
    return this.found.length >= this.world.needles.total ? t('hint.detectorDone') : t('hint.detector');
  }

  private findTarget(): Target {
    const cam = this.camera.position;
    this.camera.getWorldDirection(this.dir);
    const reach = this.d.reach;
    const hit = raycastGrid(this.grid, cam.x, cam.y, cam.z, this.dir.x, this.dir.y, this.dir.z, reach);
    this.raycaster.set(cam, this.dir);
    this.raycaster.far = reach;
    let best: Target = hit ? { kind: 'hay', hit } : null;
    let bestDist = hit ? hit.dist : Infinity;
    // An uncovered needle wins over the hay cell it lies in.
    const n = this.world.needles.raycast(cam, this.dir, reach);
    if (n && n.dist <= bestDist + 0.35) { best = { kind: 'needle', index: n.index }; bestDist = n.dist; }
    const c = this.world.containers.raycast(this.raycaster);
    if (c && c.dist < bestDist) { best = { kind: 'container', id: c.id }; bestDist = c.dist; }
    for (const kind of ['counter', 'shop', 'door', 'board'] as const) {
      const h = this.raycaster.intersectObject(this.world[kind], true)[0];
      if (h && h.distance < bestDist) { best = { kind }; bestDist = h.distance; }
    }
    return best;
  }

  /** `sprinting`: the player ran this frame. */
  update(dt: number, sprinting = false): void {
    this.cooldown -= dt;
    const wasTired = this.stamina.exhausted;
    this.stamina.update(dt, this.d.staminaMax, this.d.regen, sprinting);
    this.noticeT -= dt;
    const live = this.input.locked; // no interaction while paused or a screen is open
    if (live) {
      this.stats.time += dt;
      this.conveyor.update(dt, (d) => {
        this.money += d.value;
        this.stats.earned += d.value;
        this.stats.sold += d.n;
        if (d.container) this.stats.containerSold = true;
        this.ev.sell(d.value, d.n);
      });
    }
    const target = (this.target = this.findTarget());
    if (live) {
      this.handleHotbar();
      if (this.input.wasPressed('KeyQ') && this.inv.held) this.putDown();
    }
    const click = live && this.input.lmbPressed;
    const use = live && (this.input.lmbPressed || this.input.wasPressed('KeyE'));
    const take = live && this.input.wasPressed('KeyE');
    const held = this.inv.held;
    const name = (id: ItemId, form = '') => t(`item.${id}${form}`);
    let hint = '';

    switch (target?.kind) {
      case 'needle':
        hint = t('hint.needle');
        if (use) this.pickNeedle(target.index);
        break;
      case 'container': {
        const st = this.inv.state(target.id), cap = this.containerCapacity(target.id);
        const canPour = !held && this.inv.active !== 'detector' && this.carried > 0;
        if (canPour && st.fill < cap) {
          hint = t('hint.pour', { item: name(target.id, '.acc'), n: `${st.fill} / ${cap}` });
          if (click) this.pour(target.id);
        } else {
          hint = t(st.fill >= cap ? 'hint.takeFull' : 'hint.take', { item: name(target.id, '.acc') });
          if (click && canPour) this.ev.full();
        }
        if (take) this.pickUp(target.id);
        break;
      }
      case 'counter': {
        const n = this.carried + (held ? this.inv.state(held.id).fill : 0);
        hint = n > 0 ? t('hint.sell', { strands: strands(n), money: fmtMoney(n * this.price) }) : t('hint.sellEmpty');
        if (use) this.sell();
        break;
      }
      case 'shop':
        hint = t('hint.shop');
        if (use) this.ev.openShop();
        break;
      case 'door':
        hint = this.unlocked ? t('hint.doorOpen') : t('hint.doorLocked', { n: this.found.length, total: this.world.needles.total });
        break;
      case 'board':
        hint = t('hint.board', { n: this.found.length, total: this.world.needles.total });
        break;
      case 'hay':
        if (held) {
          hint = t('hint.place', { item: name(held.id, '.acc') });
          if (click) this.putDown(target.hit);
        } else if (this.inv.active === 'detector') {
          hint = this.detectorHint();
        } else if (this.carried >= this.capacity) {
          const near = this.inv.placed()[0];
          hint = near ? t('hint.fullPour', { item: name(near.def.id, '.acc') }) : t('hint.full');
          if (click) this.ev.full();
        } else {
          hint = t('hint.grab');
          if (live && this.input.lmb && this.cooldown <= 0) this.dig(target.hit);
        }
        break;
      default:
        if (held) {
          hint = t('hint.place', { item: name(held.id, '.acc') });
          if (click) this.putDown();
        } else if (this.inv.active === 'detector') hint = this.detectorHint();
    }
    if (this.noticeT > 0) hint = this.hint; // keep the notice up for a moment
    else this.hint = live ? hint : '';

    // Detector: from the coil, a little ahead of the eyes.
    const cam = this.camera.position;
    const beep = this.detector.update(dt, live && this.inv.active === 'detector', () => {
      const tip = cam.clone().addScaledVector(this.dir, 0.6).add(new THREE.Vector3(0, -0.6, 0));
      const n = this.world.needles.nearestHidden(tip);
      return n ? signalStrength(tip.distanceTo(n), hayAlong(this.grid, tip, n), this.d.detectorRange, this.d.detectorMuffle) : 0;
    });
    if (beep) this.ev.beep(this.detector.strength);

    if (!wasTired && this.stamina.exhausted) {
      this.ev.tired();
      if (live) this.notice(t('hint.tired'));
    }

    if (this.unlocked && !this.escaped && this.world.exited(cam.x, cam.z)) {
      this.escaped = true;
      this.ev.escaped();
    }
  }

  private notice(text: string): void {
    this.hint = text;
    this.noticeT = 2.2;
    this.ev.notice(text);
  }

  private handleHotbar(): void {
    let want: ItemId | null = null;
    for (let i = 0; i < 9; i++) if (this.input.wasPressed(`Digit${i + 1}`)) want = this.inv.at(i) ?? want;
    if (this.input.wheel) want = this.inv.next(this.input.wheel > 0 ? 1 : -1) ?? want;
    if (!want || want === this.inv.active) return;
    if (!this.inv.canSelect(want)) {
      this.notice(t('hint.placedElsewhere', { item: t(`item.${want}`) }));
      return;
    }
    this.switchTo(want);
  }

  /** Changes the item in hand; a held container is put down first. */
  switchTo(id: ItemId): boolean {
    if (this.inv.held && id !== this.inv.active) this.putDown();
    if (!this.inv.setActive(id)) return false;
    this.cooldown = Math.max(this.cooldown, 0.2); // no digging mid-switch
    this.ev.toolChange();
    return true;
  }

  /** Puts the held container on the ground where the player looks (or at their feet). */
  putDown(at?: GridHit): boolean {
    const def = this.inv.held;
    if (!def) return false;
    const cam = this.camera.position;
    this.camera.getWorldDirection(this.dir);
    let x: number, z: number;
    if (at) {
      const s = this.grid.cellSize;
      x = this.grid.originX + (at.x + 0.5) * s;
      z = this.grid.originZ + (at.z + 0.5) * s;
    } else {
      const flat = Math.hypot(this.dir.x, this.dir.z) || 1;
      const floorDist = this.dir.y < -0.2 ? cam.y / -this.dir.y : Infinity;
      const d = Math.min(1.2, floorDist * flat);
      x = cam.x + (this.dir.x / flat) * Math.max(0.7, d);
      z = cam.z + (this.dir.z / flat) * Math.max(0.7, d);
    }
    [x, z] = this.world.clamp(x, z, cam);
    const r = CONTAINER_WORLD[def.id].radius;
    const y = this.world.support(x, z, cam.y - 0.3, r);
    const yaw = Math.atan2(cam.x - x, cam.z - z);
    this.inv.state(def.id).placed = { x, y, z, yaw };
    this.inv.setActive(this.inv.lastTool);
    this.cooldown = Math.max(this.cooldown, 0.25);
    this.ev.place(def.id);
    return true;
  }

  pickUp(id: ContainerId): void {
    if (this.inv.held) this.putDown();
    const st = this.inv.state(id);
    st.placed = null;
    const n = Math.min(this.carried, this.containerCapacity(id) - st.fill);
    if (n > 0) { st.fill += n; this.carried -= n; }
    this.inv.setActive(id);
    this.cooldown = Math.max(this.cooldown, 0.25);
    this.ev.pickUp(id);
  }

  /** Empties the hands into a placed container. */
  pour(id: ContainerId): number {
    const st = this.inv.state(id), p = st.placed;
    const n = Math.min(this.carried, this.containerCapacity(id) - st.fill);
    if (n <= 0 || !p) return 0;
    st.fill += n;
    this.carried -= n;
    this.particles.burst(p.x, p.y + CONTAINER_WORLD[id].height, p.z, 0, 1, 0, Math.min(40, 6 + n));
    this.cooldown = Math.max(this.cooldown, 0.15);
    this.ev.pour(n, id);
    return n;
  }

  /** Takes strands from the aimed cell first, then from the nearest neighbours. */
  dig(hit: GridHit): number {
    const tool = this.inv.tool;
    const want = Math.min(this.grab, this.capacity - this.carried);
    if (want <= 0) return 0;
    const g = this.grid;
    let got = g.remove(hit.x, hit.y, hit.z, want);
    if (got < want) {
      const r = tool.radiusCells;
      const cand: Array<[number, number, number, number]> = [];
      for (let dy = -r; dy <= r; dy++)
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++) {
            if (!dx && !dy && !dz) continue;
            const x = hit.x + dx, y = hit.y + dy, z = hit.z + dz;
            if (g.get(x, y, z) === 0) continue;
            // Prefer cells towards the surface we hit (along the face normal) and higher up.
            const d = (dx - hit.nx) ** 2 + (dy - hit.ny) ** 2 + (dz - hit.nz) ** 2 - dy * 0.3;
            cand.push([d, x, y, z]);
          }
      cand.sort((a, b) => a[0] - b[0]);
      for (const [, x, y, z] of cand) {
        if (got >= want) break;
        got += g.remove(x, y, z, want - got);
      }
    }
    if (got > 0) {
      this.carried += got;
      const st = this.toolStats;
      // Out of breath: swings get slow until the bar partly refills.
      this.cooldown = st.cooldown * (this.stamina.exhausted ? BALANCE.stamina.tiredSlow : 1);
      this.stamina.spend(st.stamina);
      const s = g.cellSize;
      const px = g.originX + (hit.x + 0.5 + hit.nx * 0.5) * s;
      const py = g.originY + (hit.y + 0.5 + hit.ny * 0.5) * s;
      const pz = g.originZ + (hit.z + 0.5 + hit.nz * 0.5) * s;
      this.particles.burst(px, py, pz, hit.nx, hit.ny, hit.nz, Math.min(60, 6 + got * 2));
      this.ev.grab(got, tool);
    }
    return got;
  }

  /** Loads the belt; payment occurs only when the load has fallen off its end. */
  sell(): number {
    const held = this.inv.held;
    const inBox = held ? this.inv.state(held.id).fill : 0;
    const n = this.carried + inBox;
    if (n <= 0) return 0;
    const value = n * this.price;
    this.carried = 0;
    if (held) this.inv.state(held.id).fill = 0;
    this.conveyor.add(n, value, inBox > 0);
    this.ev.loadBelt(n);
    return value;
  }

  buy(id: ItemId): boolean {
    if (this.inv.buyState(id, this.money) !== 'ok') return false;
    this.money = Math.max(0, this.money - itemById(id).price);
    if (this.inv.held) this.putDown(); // the new item goes into the hands
    this.inv.add(id);
    if (isContainer(id)) this.pickUpCarried(id);
    this.ev.buy(id);
    return true;
  }

  /** A new container in hand takes what the hands were holding. */
  private pickUpCarried(id: ContainerId): void {
    const st = this.inv.state(id);
    const n = Math.min(this.carried, this.containerCapacity(id) - st.fill);
    if (n > 0) { st.fill += n; this.carried -= n; }
  }

  pickNeedle(index: number): void {
    this.world.needles.collect(index);
    this.refreshPerks();
    this.ev.needle(index);
    if (this.unlocked) this.ev.unlocked();
  }

  /** Capacity of a container definition with the current perks. */
  capOf(def: ContainerDef): number { return this.containerCapacity(def.id); }
}
