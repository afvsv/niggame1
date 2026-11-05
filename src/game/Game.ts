import * as THREE from 'three';
import { BALANCE } from '../data/balance';
import { ItemId, ToolDef, itemById } from '../data/tools';
import { fmtMoney } from '../core/format';
import { strands, t } from '../core/i18n';
import { Input } from '../core/input';
import { HayParticles } from '../fx/particles';
import { HayGrid } from '../haystack/grid';
import { GridHit, raycastGrid } from '../haystack/raycast';
import { Inventory } from './Inventory';

export type Target = { kind: 'hay'; hit: GridHit } | { kind: 'counter' } | { kind: 'shop' } | null;

/** Hooks for feedback (sound, animation, UI). Game only decides the rules. */
export interface GameEvents {
  grab(got: number, tool: ToolDef): void;
  full(): void;
  sell(value: number, strandsSold: number): void;
  buy(id: ItemId): void;
  toolChange(): void;
  openShop(): void;
}

/** Core gameplay rules: grabbing hay, selling it, buying tools. */
export class Game {
  money = 0;
  carried = 0;
  target: Target = null;
  hint = '';
  private cooldown = 0;
  private readonly dir = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly grid: HayGrid,
    private readonly camera: THREE.Camera,
    private readonly props: { counter: THREE.Object3D; shop: THREE.Object3D },
    private readonly input: Input,
    private readonly particles: HayParticles,
    readonly inv: Inventory,
    private readonly ev: GameEvents,
  ) {}

  get capacity(): number { return this.inv.capacity; }

  private findTarget(): Target {
    const cam = this.camera.position;
    this.camera.getWorldDirection(this.dir);
    const hit = raycastGrid(this.grid, cam.x, cam.y, cam.z, this.dir.x, this.dir.y, this.dir.z, BALANCE.reachM);
    this.raycaster.set(cam, this.dir);
    this.raycaster.far = BALANCE.reachM;
    let best: Target = hit ? { kind: 'hay', hit } : null;
    let bestDist = hit ? hit.dist : Infinity;
    for (const kind of ['counter', 'shop'] as const) {
      const c = this.raycaster.intersectObject(this.props[kind], true)[0];
      if (c && c.distance < bestDist) { best = { kind }; bestDist = c.distance; }
    }
    return best;
  }

  update(dt: number): void {
    this.cooldown -= dt;
    const target = (this.target = this.findTarget());
    const live = this.input.locked; // no interaction while paused or a screen is open
    if (live) this.handleHotbar();
    const use = live && (this.input.lmbPressed || this.input.wasPressed('KeyE'));
    let hint = '';
    if (target?.kind === 'hay') {
      if (this.carried >= this.capacity) {
        hint = t('hint.full');
        if (live && this.input.lmbPressed) this.ev.full();
      } else {
        hint = t('hint.grab');
        if (live && this.input.lmb && this.cooldown <= 0) this.dig(target.hit);
      }
    } else if (target?.kind === 'counter') {
      hint = this.carried > 0
        ? t('hint.sell', { strands: strands(this.carried), money: fmtMoney(this.carried * BALANCE.hay.pricePerStrand) })
        : t('hint.sellEmpty');
      if (use) this.sell();
    } else if (target?.kind === 'shop') {
      hint = t('hint.shop');
      if (use) this.ev.openShop();
    }
    this.hint = live ? hint : '';
  }

  private handleHotbar(): void {
    let changed = false;
    for (let i = 0; i < 9; i++) if (this.input.wasPressed(`Digit${i + 1}`)) changed = this.inv.select(i) || changed;
    if (this.input.wheel) changed = this.inv.cycle(this.input.wheel > 0 ? 1 : -1) || changed;
    if (changed) {
      this.cooldown = Math.max(this.cooldown, 0.2); // no digging mid-switch
      this.ev.toolChange();
    }
  }

  /** Takes strands from the aimed cell first, then from the nearest neighbours. */
  dig(hit: GridHit): number {
    const tool = this.inv.tool;
    const want = Math.min(tool.grab, this.capacity - this.carried);
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
      this.cooldown = tool.cooldown;
      const s = g.cellSize;
      const px = g.originX + (hit.x + 0.5 + hit.nx * 0.5) * s;
      const py = g.originY + (hit.y + 0.5 + hit.ny * 0.5) * s;
      const pz = g.originZ + (hit.z + 0.5 + hit.nz * 0.5) * s;
      this.particles.burst(px, py, pz, hit.nx, hit.ny, hit.nz, Math.min(60, 6 + got * 2));
      this.ev.grab(got, tool);
    }
    return got;
  }

  sell(): number {
    if (this.carried <= 0) return 0;
    const n = this.carried;
    const value = n * BALANCE.hay.pricePerStrand;
    this.money += value;
    this.carried = 0;
    this.ev.sell(value, n);
    return value;
  }

  buy(id: ItemId): boolean {
    if (this.inv.buyState(id, this.money) !== 'ok') return false;
    this.money = Math.max(0, this.money - itemById(id).price);
    this.inv.add(id);
    this.ev.buy(id);
    return true;
  }
}
