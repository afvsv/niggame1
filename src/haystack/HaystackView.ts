import * as THREE from 'three';
import { HayGrid } from './grid';
import { buildChunkGeometry } from './mesher';

/** Owns chunk meshes and rebuilds the dirty ones a few per frame. */
export class HaystackView {
  readonly group = new THREE.Group();
  private meshes = new Map<number, THREE.Mesh>();
  /** Set whenever a chunk mesh changed this frame (static shadows need a refresh). */
  changed = false;

  constructor(private readonly grid: HayGrid, private readonly materials: THREE.Material[]) {
    this.group.name = 'haystack';
  }

  /** Rebuild dirty chunks for up to `budgetMs` (at least one per call). Pass Infinity to rebuild everything. */
  update(budgetMs = 5): void {
    const t0 = performance.now();
    let done = 0;
    for (const key of this.grid.dirtyChunks) {
      if (done > 0 && performance.now() - t0 > budgetMs) break;
      this.grid.dirtyChunks.delete(key);
      this.rebuild(key);
      done++;
    }
    if (done > 0) this.changed = true;
  }

  private rebuild(key: number): void {
    const [cx, cy, cz] = this.grid.chunkCoords(key);
    const geo = buildChunkGeometry(this.grid, cx, cy, cz);
    const old = this.meshes.get(key);
    if (old) {
      old.geometry.dispose();
      if (!geo) { this.group.remove(old); this.meshes.delete(key); return; }
      old.geometry = geo;
      return;
    }
    if (!geo) return;
    const m = new THREE.Mesh(geo, this.materials);
    m.matrixAutoUpdate = false;
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    this.meshes.set(key, m);
  }
}
