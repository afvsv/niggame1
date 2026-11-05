import * as THREE from 'three';
import { BALANCE } from '../data/balance';
import { Audio } from '../core/audio';
import { fmtMoney } from '../core/format';
import { t } from '../core/i18n';
import { Input } from '../core/input';
import { HayParticles } from '../fx/particles';
import { HayGrid } from '../haystack/grid';
import { GridHit, raycastGrid } from '../haystack/raycast';
import { Hud } from '../ui/hud';

type Target = { kind: 'hay'; hit: GridHit } | { kind: 'counter' } | null;

/** Core gameplay rules: grabbing hay and selling it. */
export class Game {
  money = 0;
  carried = 0;
  private cooldown = 0;
  private readonly dir = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly grid: HayGrid,
    private readonly camera: THREE.Camera,
    private readonly counter: THREE.Object3D,
    private readonly input: Input,
    private readonly particles: HayParticles,
    private readonly audio: Audio,
    private readonly hud: Hud,
  ) {}

  get capacity(): number { return BALANCE.hands.capacity; }
  get grab(): number { return BALANCE.hands.grab; }

  private findTarget(): Target {
    const cam = this.camera.position;
    this.camera.getWorldDirection(this.dir);
    const hit = raycastGrid(this.grid, cam.x, cam.y, cam.z, this.dir.x, this.dir.y, this.dir.z, BALANCE.reachM);
    this.raycaster.set(cam, this.dir);
    this.raycaster.far = BALANCE.reachM;
    const c = this.raycaster.intersectObject(this.counter, true)[0];
    if (c && (!hit || c.distance < hit.dist)) return { kind: 'counter' };
    return hit ? { kind: 'hay', hit } : null;
  }

  update(dt: number): void {
    this.cooldown -= dt;
    const target = this.findTarget();
    let hint = '';
    if (target?.kind === 'hay') {
      if (this.carried >= this.capacity) hint = t('hint.full');
      else {
        hint = t('hint.grab');
        if (this.input.lmb && this.cooldown <= 0) this.dig(target.hit);
      }
    } else if (target?.kind === 'counter') {
      hint = this.carried > 0
        ? t('hint.sell', { n: this.carried, money: fmtMoney(this.carried * BALANCE.hay.pricePerStrand) })
        : t('hint.sellEmpty');
      if (this.input.lmbPressed || this.input.wasPressed('KeyE')) this.sell();
    }
    this.hud.update({
      money: this.money,
      hayLeft: this.grid.total,
      carried: this.carried,
      capacity: this.capacity,
      hint: this.input.locked ? hint : '',
      aimActive: target !== null,
    });
  }

  /** Takes strands from the aimed cell first, then from the nearest neighbours. */
  dig(hit: GridHit): number {
    const want = Math.min(this.grab, this.capacity - this.carried);
    if (want <= 0) return 0;
    const g = this.grid;
    let got = g.remove(hit.x, hit.y, hit.z, want);
    if (got < want) {
      const r = BALANCE.hands.radiusCells;
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
      this.cooldown = BALANCE.hands.cooldown;
      const s = g.cellSize;
      const px = g.originX + (hit.x + 0.5 + hit.nx * 0.5) * s;
      const py = g.originY + (hit.y + 0.5 + hit.ny * 0.5) * s;
      const pz = g.originZ + (hit.z + 0.5 + hit.nz * 0.5) * s;
      this.particles.burst(px, py, pz, hit.nx, hit.ny, hit.nz, 6 + got * 2);
      this.audio.rustle(0.6 + got / 10);
    }
    return got;
  }

  sell(): number {
    if (this.carried <= 0) return 0;
    const value = this.carried * BALANCE.hay.pricePerStrand;
    this.money += value;
    this.carried = 0;
    this.hud.pop(`+${fmtMoney(value)}`);
    this.audio.coin();
    return value;
  }
}
