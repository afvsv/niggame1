import * as THREE from 'three';
import { NEEDLES, NeedleDef, NeedleId } from '../data/needles';
import { mulberry32 } from '../gfx/noise';
import type { HayGrid } from '../haystack/grid';
import { needleModel } from '../tools/models';
import { fall } from './support';
import { BALANCE } from '../data/balance';

export interface NeedleSave { id: NeedleId; pos: [number, number, number]; found: boolean }

/** Height of the stack's top above the centre column. */
function stackTop(grid: HayGrid): number {
  const cx = Math.floor(grid.nx / 2), cz = Math.floor(grid.nz / 2);
  for (let y = grid.ny - 1; y >= 0; y--) if (grid.data[grid.index(cx, y, cz)] > 0) return (y + 1) * grid.cellSize;
  return 0;
}

const filled = (g: HayGrid, x: number, y: number, z: number) => {
  const s = g.cellSize;
  return g.get(Math.floor((x - g.originX) / s), Math.floor((y - g.originY) / s), Math.floor((z - g.originZ) / s)) > 0;
};

/**
 * Hides the needles in a freshly generated stack: each deeper than the previous one, the first
 * shallow on the side facing the door so a new player finds it early. Positions are cell centres.
 */
export function placeNeedles(grid: HayGrid, seed: number, defs: readonly NeedleDef[] = NEEDLES): NeedleSave[] {
  const rnd = mulberry32(seed);
  const s = grid.cellSize, top = stackTop(grid);
  const snap = (v: number, o: number) => o + (Math.floor((v - o) / s) + 0.5) * s;
  const out: NeedleSave[] = [];
  let angle = Math.PI / 2 + (rnd() - 0.5) * 0.7; // +Z: the door side
  defs.forEach((def, i) => {
    if (i > 0) angle += 1.9 + rnd() * 1.4; // spread around the stack
    const dx = Math.cos(angle), dz = Math.sin(angle);
    for (let tries = 0; tries < 12; tries++) {
      const y = snap(Math.max(0.3, def.height * top * (1 - tries * 0.07)), grid.originY);
      // Outward from the centre until the hay ends: that is the surface at this height.
      let R = 0;
      while (R < grid.nx * s && filled(grid, dx * R, y, dz * R)) R += s / 2;
      const r = Number.isFinite(def.depthM) ? R - def.depthM : 0.35;
      if (r < 0.3 && Number.isFinite(def.depthM)) continue; // too thin here, go lower
      const x = snap(dx * Math.max(0.3, r), grid.originX), z = snap(dz * Math.max(0.3, r), grid.originZ);
      if (!filled(grid, x, y, z)) continue;
      out.push({ id: def.id, pos: [x, y, z], found: false });
      return;
    }
    out.push({ id: def.id, pos: [snap(0.3, grid.originX), snap(0.3, grid.originY), snap(0.3, grid.originZ)], found: false });
  });
  return out;
}

function glintTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.15, 'rgba(255,245,200,.7)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(255,255,240,.9)';
  ctx.fillRect(31, 2, 2, 60);
  ctx.fillRect(2, 31, 60, 2);
  return new THREE.CanvasTexture(c);
}

interface Item { save: NeedleSave; obj: THREE.Group; glint: THREE.Sprite; vy: number; exposed: boolean; phase: number }

/** The needles in the world: hidden by the hay around them, glinting once uncovered, falling when freed. */
export class NeedleField {
  readonly group = new THREE.Group();
  private items: Item[] = [];
  private time = 0;

  constructor(saves: NeedleSave[]) {
    const tex = glintTexture();
    const rnd = mulberry32(99);
    for (const save of saves) {
      const obj = needleModel(save.id);
      obj.rotation.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
      obj.position.set(...save.pos);
      obj.visible = !save.found;
      const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#fff2c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glint.visible = false;
      this.group.add(obj, glint);
      this.items.push({ save, obj, glint, vy: 0, exposed: false, phase: rnd() * 6 });
    }
  }

  get saves(): NeedleSave[] { return this.items.map((i) => ({ ...i.save, pos: [...i.save.pos] as [number, number, number] })); }
  get found(): NeedleId[] { return this.items.filter((i) => i.save.found).map((i) => i.save.id); }
  get total(): number { return this.items.length; }
  id(index: number): NeedleId { return this.items[index].save.id; }

  update(dt: number, grid: HayGrid, support: (x: number, z: number, maxY: number) => number): void {
    this.time += dt;
    const s = grid.cellSize;
    for (const it of this.items) {
      if (it.save.found) continue;
      const p = it.save.pos;
      const cx = Math.floor((p[0] - grid.originX) / s), cy = Math.floor((p[1] - grid.originY) / s), cz = Math.floor((p[2] - grid.originZ) / s);
      const free = grid.get(cx, cy, cz) === 0;
      it.exposed = free || !grid.get(cx + 1, cy, cz) || !grid.get(cx - 1, cy, cz) || !grid.get(cx, cy + 1, cz) || !grid.get(cx, cy - 1, cz) || !grid.get(cx, cy, cz + 1) || !grid.get(cx, cy, cz - 1);
      if (free) {
        const [y, vy] = fall(p[1], it.vy, support(p[0], p[2], p[1]) + 0.03, BALANCE.gravity, dt);
        p[1] = y; it.vy = vy;
        it.obj.position.y = y;
      }
      it.glint.visible = it.exposed;
      if (it.exposed) {
        const tw = 0.5 + 0.5 * Math.sin(this.time * 3.1 + it.phase);
        it.glint.position.set(p[0], p[1] + 0.02, p[2]);
        it.glint.scale.setScalar(0.18 + tw * 0.22);
        it.glint.material.opacity = 0.35 + tw * 0.65;
        it.glint.material.rotation = this.time * 0.6 + it.phase;
      }
    }
  }

  /** Nearest uncovered needle the ray passes close to. */
  raycast(o: THREE.Vector3, d: THREE.Vector3, maxDist: number): { index: number; dist: number } | null {
    let best: { index: number; dist: number } | null = null;
    const v = new THREE.Vector3();
    this.items.forEach((it, index) => {
      if (it.save.found || !it.exposed) return;
      v.set(...it.save.pos).sub(o);
      const along = v.dot(d);
      if (along < 0 || along > maxDist) return;
      const miss = Math.sqrt(Math.max(0, v.lengthSq() - along * along));
      if (miss < 0.22 + along * 0.02 && (!best || along < best.dist)) best = { index, dist: along };
    });
    return best;
  }

  /** The closest needle still in the stack, for the detector. */
  nearestHidden(p: THREE.Vector3): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null, bd = Infinity;
    for (const it of this.items) {
      if (it.save.found) continue;
      const v = new THREE.Vector3(...it.save.pos), d = v.distanceToSquared(p);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  position(index: number): THREE.Vector3 { return new THREE.Vector3(...this.items[index].save.pos); }

  collect(index: number): void {
    const it = this.items[index];
    it.save.found = true;
    it.obj.visible = false;
    it.glint.visible = false;
  }
}
